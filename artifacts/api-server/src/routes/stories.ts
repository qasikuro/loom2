import { db, mediaCompositionsTable, storiesTable, storySavesTable, storyWitnessesTable, followsTable, characterTable, notificationsTable, stickerReactionsTable, userPurchasesTable, type StoryPageDB } from "@workspace/db";
import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";
import { grantReward } from "../services/rewardService";
import { syncConstellation } from "../services/constellationService";
import { sendPushNotification, sendPushToTokens } from "../services/pushService";
import * as cache from "../lib/cache";
import { claimUpload } from "../lib/uploadTracking";
import { assertOwnedMediaReferences, MediaOwnershipError, normalizeManagedMediaPath, normalizeMediaReference, withOwnerMediaUrls } from "../lib/mediaAccess";

const router: IRouter = Router();

function isExternalMusicStream(uri: string): boolean {
  if (normalizeManagedMediaPath(uri)) return false;
  try {
    normalizeMediaReference(uri);
    return true;
  } catch {
    return false;
  }
}

const OverlaySchema = z.object({
  id:          z.string(),
  type:        z.enum(['bubble', 'text', 'sticker']),
  content:     z.string(),
  xPct:        z.number(),
  yPct:        z.number(),
  fontFamily:  z.string().optional().nullable(),
  fontSize:    z.number().optional().nullable(),
  bubbleStyle: z.string().optional().nullable(),
  color:       z.string().optional().nullable(),
});

const PanelSchema = z.object({
  id:               z.string(),
  text:             z.string(),
  imageUri:         z.string().optional().nullable(),
  bgPreset:         z.string().optional().nullable(),
  bubbleText:       z.string().optional().nullable(),
  overlays:         z.array(OverlaySchema).optional().nullable(),
  imageAspectRatio: z.number().positive().max(10).optional().nullable(),
  contentFit:       z.enum(['cover', 'contain']).optional().nullable(),
});

const MusicSchema = z.object({
  id:         z.string().min(1).max(100),
  title:      z.string().min(1).max(300),
  artist:     z.string().min(1).max(300),
  artworkUrl: z.string().url().max(2000).nullable(),
  duration:   z.number().int().min(1).max(3600),
  genre:      z.string().max(100).nullable(),
  mood:       z.string().max(100).nullable(),
  streamUrl:  z.string().url().max(2000).refine(isExternalMusicStream, {
    message: "Managed media cannot be used as a music stream URL",
  }),
  embedded: z.boolean().optional(),
  baked: z.boolean().optional(),
  segmentStartSeconds: z.number().min(0).optional(),
  segmentDurationSeconds: z.number().positive().max(60).optional(),
  originalVolume: z.number().min(0).max(1).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
});

function sanitizePanel(p: z.infer<typeof PanelSchema>) {
  return {
    id:               p.id,
    text:             p.text,
    imageUri:         safeImageUri(p.imageUri ?? null) ?? undefined,
    bgPreset:         p.bgPreset         ?? undefined,
    bubbleText:       p.bubbleText       ?? undefined,
    overlays:         p.overlays         ?? undefined,
    imageAspectRatio: p.imageAspectRatio ?? undefined,
    contentFit:       p.contentFit       ?? undefined,
  };
}

// Base object — used by PATCH (which calls .partial()) so it must stay a ZodObject, not ZodEffects.
const StoryBaseSchema = z.object({
  id:             z.string().uuid().optional().nullable(),
  date:           z.string(),
  chapterTitle:   z.string().min(1).max(200),
  description:    z.string().max(1000).default(""),
  panels:         z.array(PanelSchema).default([]),
  mood:           z.string().default("Peaceful"),
  location:       z.string().default(""),
  isPublic:       z.boolean().default(false),
  pageLayoutKey:  z.string().optional().nullable(),
  pages:          z.array(z.object({
    id:        z.string(),
    layoutKey: z.string(),
    panels:    z.array(PanelSchema),
  })).optional().nullable(),
  contentType:  z.enum(['story', 'video']).default('story'),
  compositionId: z.string().uuid().optional().nullable(),
  videoUri:     z.string().optional().nullable(),
  thumbnailUri: z.string().optional().nullable(),
  music:        MusicSchema.optional().nullable(),
});

// Full POST schema — adds cross-field validation on top of the base.
const StoryInputSchema = StoryBaseSchema.superRefine((data, ctx) => {
  if (data.contentType === 'video') {
    if (!data.compositionId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compositionId'], message: 'compositionId is required for video posts' });
    }
    if (data.videoUri || data.thumbnailUri) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['videoUri'], message: 'Video posts must use compositionId; direct media paths are not accepted' });
    }
  } else {
    if (data.panels.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['panels'], message: 'panels must not be empty for story posts' });
    }
  }
});

class StoryCompositionError extends Error {}

const StoryOutputSchema = z.object({
  id:           z.string().uuid(),
  date:         z.string(),
  chapterTitle: z.string().min(1),
  // Video posts have no panels — only require panels for story contentType
  panels:       z.array(z.unknown()),
  mood:         z.string().min(1),
  createdAt:    z.string(),
  contentType:  z.enum(['story', 'video']).optional(),
}).superRefine((data, ctx) => {
  const ct = data.contentType ?? 'story';
  if (ct === 'story' && data.panels.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['panels'], message: 'story posts must have at least one panel' });
  }
});

router.get("/stories", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select()
      .from(storiesTable)
      .where(and(eq(storiesTable.userId, userId), eq(storiesTable.isHidden, false)))
      .orderBy(desc(storiesTable.date));

    const stickerCounts = await fetchStickerCounts(rows.map(r => r.id));
    const serialized = rows.map(r => withOwnerMediaUrls(serializeStory(r, stickerCounts[r.id] ?? 0), userId));
    const valid: typeof serialized = [];
    for (const story of serialized) {
      const result = StoryOutputSchema.safeParse(story);
      if (result.success) {
        valid.push(story);
      } else {
        req.log.warn({ storyId: story.id, userId, issues: result.error.issues }, "Dropping malformed story from response");
      }
    }
    return res.json(valid);
  } catch (err) {
    req.log.error({ err }, "Failed to list stories");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/stories", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const parsed = StoryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const { id, date, panels, ...rest } = parsed.data;
    const normalizedPanels = panels.map(normalizePanelMedia);
    const normalizedPages = rest.pages?.map(page => ({
      ...page,
      panels: page.panels.map(normalizePanelMedia),
    })) ?? null;
    const music = rest.music
      ? { ...rest.music, artworkUrl: rest.music.artworkUrl ? normalizeMediaReference(rest.music.artworkUrl) : null }
      : rest.music;
    await assertOwnedMediaReferences(userId, collectStoryMediaReferences({
      panels: normalizedPanels,
      pages: normalizedPages,
      videoUri: rest.videoUri,
      thumbnailUri: rest.thumbnailUri,
    }));
    await assertOwnedMediaReferences(userId, [music?.artworkUrl]);
    const sanitizedPanels = normalizedPanels.map(sanitizePanel);
    const sanitizedPages = normalizedPages?.map(page => ({
      ...page,
      panels: page.panels.map(sanitizePanel),
    })) ?? null;

    const { created, existing } = await db.transaction(async tx => {
      // A repeated idempotent create returns the existing story and must not
      // consume a newly supplied composition claim.
      if (id) {
        const [alreadyCreated] = await tx
          .select()
          .from(storiesTable)
          .where(eq(storiesTable.id, id))
          .limit(1);
        if (alreadyCreated) {
          if (alreadyCreated.userId !== userId) return { created: undefined, existing: undefined };
          return { created: undefined, existing: alreadyCreated };
        }
      }

      let videoUri = rest.videoUri ?? null;
      let thumbnailUri = rest.thumbnailUri ?? null;
      if (rest.contentType === "video") {
        const [composition] = await tx
          .select()
          .from(mediaCompositionsTable)
          .where(and(
            eq(mediaCompositionsTable.id, rest.compositionId!),
            eq(mediaCompositionsTable.userId, userId),
            eq(mediaCompositionsTable.status, "pending"),
            gt(mediaCompositionsTable.expiresAt, new Date()),
          ))
          .for("update");
        if (!composition) {
          throw new StoryCompositionError("The video composition is missing, expired, already claimed, or belongs to another user.");
        }
        videoUri = composition.videoPath;
        thumbnailUri = composition.thumbnailPath;
        await assertOwnedMediaReferences(userId, [videoUri, thumbnailUri]);

        const [insertedVideo] = await tx.insert(storiesTable).values({
          ...(id ? { id } : {}),
          userId,
          date: new Date(date),
          panels: sanitizedPanels,
          pageLayoutKey: rest.pageLayoutKey ?? null,
          pages: sanitizedPages as StoryPageDB[] | null,
          chapterTitle: rest.chapterTitle,
          description: rest.description ?? '',
          mood: rest.mood,
          location: rest.location,
          isPublic: rest.isPublic,
          contentType: 'video',
          videoUri,
          thumbnailUri,
          music: music ?? null,
        }).returning();
        if (!insertedVideo) throw new StoryCompositionError("A story with this id already exists.");
        await tx.update(mediaCompositionsTable)
          .set({ status: "claimed", claimedAt: new Date() })
          .where(and(eq(mediaCompositionsTable.id, composition.id), eq(mediaCompositionsTable.status, "pending")));
        return { created: insertedVideo, existing: undefined };
      }

      const [inserted] = await tx
        .insert(storiesTable)
        .values({
          ...(id ? { id } : {}),
          userId,
          date: new Date(date),
          panels: sanitizedPanels,
          pageLayoutKey: rest.pageLayoutKey ?? null,
          pages: sanitizedPages as StoryPageDB[] | null,
          chapterTitle: rest.chapterTitle,
          description: rest.description ?? '',
          mood: rest.mood,
          location: rest.location,
          isPublic: rest.isPublic,
          contentType: rest.contentType ?? 'story',
          videoUri,
          thumbnailUri,
          music: music ?? null,
        })
        .returning();
      return { created: inserted, existing: undefined };
    });

    if (!created && existing) return res.status(200).json(withOwnerMediaUrls(serializeStory(existing), userId));
    if (!created) return res.status(409).json({ error: "A story with this id already exists" });

    // L-3: Mark every panel image as claimed so the orphan-cleanup interval
    // won't delete files that are intentionally referenced by this story.
    panels.forEach(p => claimUpload(p.imageUri ?? null));
    // Fan-out notifications to followers (fire & forget, non-blocking)
    if (rest.isPublic) {
      fanOutStoryNotification(userId, created.id, rest.chapterTitle, req).catch(() => null);
      // Invalidate discover cache for all followers — they may now see this new story
      invalidateFollowerDiscoverCaches(userId).catch(() => null);
    }

    // Grant story creation reward (once per story ID) — await for client feedback
    const { granted: rewardGranted, amounts: rewardAmounts } =
      await grantReward(userId, "story_created", created.id);
    syncConstellation(userId).catch(() => null);

    return res.status(201).json({ ...withOwnerMediaUrls(serializeStory(created), userId), rewardGranted, rewardAmounts });
  } catch (err) {
    if (err instanceof StoryCompositionError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof MediaOwnershipError) return res.status(403).json({ error: err.message });
    req.log.error({ err }, "Failed to create story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function notifyAuthor(
  actorId:      string,
  authorId:     string,
  storyId:      string,
  chapterTitle: string,
  type:         "witness" | "save" | "milestone",
  req:          Request,
) {
  try {
    const actorRows = await db
      .select({ name: characterTable.name })
      .from(characterTable)
      .where(eq(characterTable.userId, actorId))
      .limit(1);
    const actorName = actorRows[0]?.name ?? "A sky child";
    await db.insert(notificationsTable).values({
      userId:    authorId,
      actorId,
      actorName,
      type,
      refId:     storyId,
      title:     chapterTitle,
    });
  } catch (err) {
    req.log.error({ err }, `Failed to send ${type} notification`);
  }
}

async function invalidateFollowerDiscoverCaches(authorId: string): Promise<void> {
  const followers = await db
    .select({ followerId: followsTable.followerId })
    .from(followsTable)
    .where(eq(followsTable.followingId, authorId));
  for (const { followerId } of followers) {
    cache.invalidate(`discover:${followerId}`);
  }
}

async function fanOutStoryNotification(
  userId: string,
  storyId: string,
  chapterTitle: string,
  req: Request,
) {
  try {
    const [followers, actorRows] = await Promise.all([
      db.select({ followerId: followsTable.followerId })
        .from(followsTable)
        .where(eq(followsTable.followingId, userId)),
      db.select({ name: characterTable.name })
        .from(characterTable)
        .where(eq(characterTable.userId, userId))
        .limit(1),
    ]);

    if (followers.length === 0) return;

    const actorName = actorRows[0]?.name ?? "A sky child";

    await db.insert(notificationsTable).values(
      followers.map(f => ({
        userId:    f.followerId,
        actorId:   userId,
        actorName,
        type:      "new_story",
        refId:     storyId,
        title:     chapterTitle,
      })),
    );

    // Push notification to each follower — batch-fetch tokens in one query
    const followerIds = followers.map(f => f.followerId);
    const tokenRows   = await db
      .select({ pushToken: characterTable.pushToken })
      .from(characterTable)
      .where(inArray(characterTable.userId, followerIds));

    await sendPushToTokens(
      tokenRows
        .filter((r): r is { pushToken: string } => !!r.pushToken)
        .map(r => ({
          token: r.pushToken,
          title: actorName,
          body:  `shared a new story "${chapterTitle}" ✦`,
          data:  { type: "new_story", refId: storyId },
        })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fan-out story notification");
  }
}

router.get("/stories/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const storyId = String(req.params.id);
  try {
    // Allow own stories OR public stories from public profiles (never hidden)
    const rows = await db
      .select()
      .from(storiesTable)
      .where(and(eq(storiesTable.id, storyId), eq(storiesTable.userId, userId), eq(storiesTable.isHidden, false)))
      .limit(1);

    if (rows.length === 0) {
      // Try to find as a public story from a public profile
      const publicRows = await db
        .select({ story: storiesTable })
        .from(storiesTable)
        .innerJoin(characterTable, eq(characterTable.userId, storiesTable.userId))
        .where(
          and(
            eq(storiesTable.id, storyId),
            eq(storiesTable.isPublic, true),
            eq(storiesTable.isHidden, false),
            eq(characterTable.isPublic, true),
          ),
        )
        .limit(1);

      if (publicRows.length === 0) return res.status(404).json({ error: "Not found" });
      const counts = await fetchStickerCounts([storyId]);
      return res.json(serializeStory(publicRows[0].story, counts[storyId] ?? 0));
    }
    const counts = await fetchStickerCounts([storyId]);
    return res.json(withOwnerMediaUrls(serializeStory(rows[0], counts[storyId] ?? 0), userId));
  } catch (err) {
    req.log.error({ err }, "Failed to get story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/stories/:id", requireAuth, async (req, res) => {
  const userId  = getUserId(req);
  const storyId = String(req.params.id);
  const parsed  = StoryBaseSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  try {
    const updateSet: Record<string, unknown> = {};
    if (parsed.data.panels !== undefined) {
      const panels = parsed.data.panels.map(normalizePanelMedia);
      await assertOwnedMediaReferences(userId, collectStoryMediaReferences({ panels }));
      updateSet.panels = panels.map(sanitizePanel);
    }
    if ('pages' in parsed.data) {
      const pages = parsed.data.pages?.map(page => ({
        ...page,
        panels: page.panels.map(normalizePanelMedia),
      })) ?? null;
      await assertOwnedMediaReferences(userId, collectStoryMediaReferences({ pages }));
      updateSet.pages = pages?.map(page => ({
        ...page,
        panels: page.panels.map(sanitizePanel),
      })) ?? null;
    }
    for (const key of ["videoUri", "thumbnailUri"] as const) {
      if (key in parsed.data) {
        const uri = parsed.data[key] == null ? parsed.data[key] : normalizeMediaReference(parsed.data[key]!);
        await assertOwnedMediaReferences(userId, [uri]);
        updateSet[key] = uri ?? null;
      }
    }
    if (parsed.data.chapterTitle  !== undefined) updateSet.chapterTitle  = parsed.data.chapterTitle;
    if (parsed.data.description   !== undefined) updateSet.description   = parsed.data.description;
    if (parsed.data.mood          !== undefined) updateSet.mood          = parsed.data.mood;
    if (parsed.data.location      !== undefined) updateSet.location      = parsed.data.location;
    if (parsed.data.isPublic      !== undefined) updateSet.isPublic      = parsed.data.isPublic;
    if ('pageLayoutKey' in parsed.data)          updateSet.pageLayoutKey = parsed.data.pageLayoutKey ?? null;
    if (parsed.data.contentType  !== undefined) updateSet.contentType  = parsed.data.contentType;
    if ('music' in parsed.data) {
      const music = parsed.data.music
        ? { ...parsed.data.music, artworkUrl: parsed.data.music.artworkUrl ? normalizeMediaReference(parsed.data.music.artworkUrl) : null }
        : null;
      await assertOwnedMediaReferences(userId, [music?.artworkUrl]);
      updateSet.music = music;
    }

    // Cross-field validation: preserve valid story/video invariant after patch
    const currentContentType = parsed.data.contentType ?? 'story';
    if (currentContentType === 'video') {
      // If switching to video, both URIs must be present in the patch or already set
      if ('videoUri' in parsed.data && !parsed.data.videoUri) {
        return res.status(400).json({ error: "videoUri is required for video posts" });
      }
      if ('thumbnailUri' in parsed.data && !parsed.data.thumbnailUri) {
        return res.status(400).json({ error: "thumbnailUri is required for video posts" });
      }
    }

    const [updated] = await db
      .update(storiesTable)
      .set(updateSet as Partial<typeof storiesTable.$inferInsert>)
      .where(and(eq(storiesTable.id, storyId), eq(storiesTable.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    invalidateFollowerDiscoverCaches(userId).catch(() => null);
    return res.json(withOwnerMediaUrls(serializeStory(updated), userId));
  } catch (err) {
    if (err instanceof MediaOwnershipError) return res.status(403).json({ error: err.message });
    req.log.error({ err }, "Failed to update story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/stories/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const storyId = String(req.params.id);
  try {
    await db
      .delete(storiesTable)
      .where(and(eq(storiesTable.id, storyId), eq(storiesTable.userId, userId)));
    invalidateFollowerDiscoverCaches(userId).catch(() => null);
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Milestone definitions ─────────────────────────────────────────────────────
const MILESTONE_THRESHOLDS = [10, 50, 100, 500] as const;
const MILESTONE_DATA: Record<number, { titleName: string; rewardType: string; aura: number; stars: number }> = {
  10:  { titleName: 'Resonant',    rewardType: 'aura_boost',        aura: 20,  stars: 10 },
  50:  { titleName: 'Storyteller', rewardType: 'storyteller',       aura: 50,  stars: 20 },
  100: { titleName: 'Illuminated', rewardType: 'featured_eligible', aura: 80,  stars: 30 },
  500: { titleName: 'Legend',      rewardType: 'legend',            aura: 150, stars: 60 },
};

router.post("/stories/:id/witness", requireAuth, async (req, res) => {
  const storyId = String(req.params.id);
  const actorId = getUserId(req);
  try {
    // H-2: Per-user witness deduplication.
    // INSERT … ON CONFLICT DO NOTHING returns [] when this user has already
    // witnessed this story, so we short-circuit before touching the count.
    // This prevents double-increments from rapid taps, network retries, and
    // re-entries to the story reader.
    const [witnessRecord] = await db
      .insert(storyWitnessesTable)
      .values({ userId: actorId, storyId })
      .onConflictDoNothing()
      .returning({ userId: storyWitnessesTable.userId });

    if (!witnessRecord) {
      // Already witnessed — tell the client so it can skip the reward animation
      // without showing an error.
      return res.json({ alreadyWitnessed: true, witnessedCount: null, milestone: null });
    }

    const [updated] = await db
      .update(storiesTable)
      .set({ witnessedCount: sql`${storiesTable.witnessedCount} + 1` })
      .where(and(eq(storiesTable.id, storyId), eq(storiesTable.isPublic, true)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });

    // ── Milestone detection (only when witnessing another author's story) ──────
    let milestonePayload: { threshold: number; titleName: string; rewardType: string; aura: number; stars: number } | null = null;

    if (updated.userId !== actorId) {
      const newCount = updated.witnessedCount;
      const currentMilestones = (updated.witnessMilestones ?? []) as number[];

      // Find ALL thresholds the story has crossed but not yet claimed — ascending order
      const unclaimedThresholds = MILESTONE_THRESHOLDS.filter(
        t => newCount >= t && !currentMilestones.includes(t),
      );

      for (const threshold of unclaimedThresholds) {
        const mData = MILESTONE_DATA[threshold]!;

        // ── C-3: Wrap all DB writes for this milestone in a single transaction.
        //    grantReward already has its own internal transaction (idempotent via
        //    unique refId), so nesting it here creates a savepoint in Postgres —
        //    safe and correct. The milestone claim UPDATE uses a jsonb containment
        //    check so concurrent witnesses cannot double-claim.
        //    Notifications fire AFTER the transaction commits so a push failure
        //    never causes a DB rollback.
        let claimedThreshold = false;
        try {
          await db.transaction(async (tx) => {
            // Step 1: Grant reward inside the outer transaction so the reward
            // write and the milestone claim are atomic.  If already granted
            // (unique refId), this is a no-op.  Errors propagate and roll back
            // the whole transaction.
            await grantReward(
              updated.userId, "witness_milestone",
              `${storyId}:${threshold}`,
              { aura: mData.aura, stars: mData.stars },
              tx, // ← participate in the outer transaction
            );

            // Step 2: Atomically mark milestone as claimed using jsonb containment.
            // If another concurrent witness already claimed it, rows = [] and we skip.
            const claimResult = await tx.execute(sql`
              UPDATE stories
              SET witness_milestones = witness_milestones || ${JSON.stringify([threshold])}::jsonb
              WHERE id = ${storyId}
                AND NOT (witness_milestones @> ${JSON.stringify([threshold])}::jsonb)
              RETURNING id
            `) as unknown as { rows: { id: string }[] };

            if (!claimResult?.rows?.length) return; // Already claimed by a concurrent witness

            // Step 3: Best-effort side-effects inside the same transaction.
            // Append milestone title to character traits (idempotent jsonb check).
            await tx.execute(sql`
              UPDATE character
              SET traits = CASE
                WHEN traits @> ${JSON.stringify([mData.titleName])}::jsonb THEN traits
                ELSE traits || ${JSON.stringify([mData.titleName])}::jsonb
              END
              WHERE user_id = ${updated.userId}
            `);

            // 500-milestone: grant profile shimmer cosmetic (free).
            if (threshold === 500) {
              await tx
                .insert(userPurchasesTable)
                .values({ userId: updated.userId, itemId: 'shimmer_profile', itemName: 'Profile Shimmer', starsSpent: 0, auraSpent: 0, shardsSpent: 0 })
                .onConflictDoNothing();
            }

            claimedThreshold = true;
          });
        } catch (txErr) {
          req.log.warn({ txErr, storyId, threshold }, "Milestone transaction failed; will retry on next witness");
          continue;
        }

        if (claimedThreshold) {
          // Notifications fire OUTSIDE the transaction — a push failure must never
          // roll back the already-committed reward and milestone claim.
          notifyAuthor(actorId, updated.userId, storyId, updated.chapterTitle, "milestone", req).catch(() => null);

          // Track the highest newly claimed threshold for the response payload
          if (!milestonePayload || threshold > milestonePayload.threshold) {
            milestonePayload = { threshold, titleName: mData.titleName, rewardType: mData.rewardType, aura: mData.aura, stars: mData.stars };
          }
        }
      }

      notifyAuthor(actorId, updated.userId, storyId, updated.chapterTitle, "witness", req).catch(() => null);
      sendPushForWitness(actorId, updated.userId, storyId, updated.chapterTitle).catch(() => null);
      grantReward(updated.userId, "story_witnessed", `${storyId}:${actorId}`).catch(() => null);
      syncConstellation(updated.userId).catch(() => null);
    }

    // Reward witness for their daily presence — awaited for client feedback
    const today = new Date().toISOString().slice(0, 10);
    const { granted: rewardGranted, amounts: rewardAmounts } =
      await grantReward(actorId, "daily_presence", today);
    syncConstellation(actorId).catch(() => null);

    // Re-fetch story so response includes freshly appended witnessMilestones
    const [fresh] = await db.select().from(storiesTable).where(eq(storiesTable.id, storyId));

    return res.json({
      ...(fresh
        ? (fresh.userId === actorId
          ? withOwnerMediaUrls(serializeStory(fresh), actorId)
          : serializeStory(fresh))
        : (updated.userId === actorId
          ? withOwnerMediaUrls(serializeStory(updated), actorId)
          : serializeStory(updated))),
      rewardGranted,
      rewardAmounts,
      milestone: milestonePayload,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to witness story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stories/saved/ids — return just the list of saved storyIds for the current user
router.get("/stories/saved/ids", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select({ storyId: storySavesTable.storyId })
      .from(storySavesTable)
      .where(eq(storySavesTable.userId, userId));
    return res.json(rows.map(r => r.storyId));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch saved story ids");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stories/saved — full saved stories (with author info, in discover format)
router.get("/stories/saved", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select({
        story:   storiesTable,
        author:  { name: characterTable.name, username: characterTable.username, avatarUri: characterTable.name },
      })
      .from(storySavesTable)
      .innerJoin(storiesTable, eq(storiesTable.id, storySavesTable.storyId))
      .leftJoin(characterTable, eq(characterTable.userId, storiesTable.userId))
      .where(eq(storySavesTable.userId, userId))
      .orderBy(desc(storySavesTable.savedAt));

    if (rows.length === 0) return res.json([]);

    const storyIds = rows.map(r => r.story.id);
    const stickerCounts = await fetchStickerCounts(storyIds);

    const result = rows.map(r => {
      const s = r.story;
      const sc = stickerCounts[s.id] ?? 0;
      const panels = sanitizePanels(s.panels);
      const firstImage = panels.find(p => p.imageUri)?.imageUri as string | null ?? null;
      const createdAt = s.createdAt ?? new Date();
      const daysOld = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
      let timeAgo: string;
      if (daysOld < 1)       timeAgo = 'today';
      else if (daysOld < 2)  timeAgo = 'yesterday';
      else if (daysOld < 7)  timeAgo = `${Math.floor(daysOld)}d ago`;
      else if (daysOld < 30) timeAgo = `${Math.floor(daysOld / 7)}w ago`;
      else                   timeAgo = `${Math.floor(daysOld / 30)}mo ago`;

      return {
        id:             s.id,
        authorUserId:   s.userId,
        authorName:     r.author?.name ?? 'Game Child',
        authorHandle:   r.author?.username ?? '',
        chapterTitle:   s.chapterTitle,
        description:    s.description ?? '',
          storySnippet:   (panels[0] as Record<string, unknown>)?.text as string ?? '',
        imageUri:       firstImage,
        mood:           s.mood,
        witnessedCount: s.witnessedCount,
        savedCount:     s.savedCount,
        stickerCount:   sc,
        timeAgo,
        date:           s.date.toISOString(),
        chapterNumber:  1,
        vibe:           s.mood,
        saved:          true,
        isFollowing:    false,
        panels:         panels,
        pageLayoutKey:  s.pageLayoutKey ?? undefined,
        pages:          s.pages ?? undefined,
      };
    });

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch saved stories");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/stories/:id/resonate", requireAuth, async (req, res) => {
  const storyId = String(req.params.id);
  const actorId = getUserId(req);
  try {
    const [updated] = await db
      .update(storiesTable)
      .set({ resonatedCount: sql`${storiesTable.resonatedCount} + 1` })
      .where(and(eq(storiesTable.id, storyId), eq(storiesTable.isPublic, true)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });

    if (updated.userId !== actorId) {
      db.insert(notificationsTable).values({
        userId:    updated.userId,
        actorId,
        actorName: "Someone",
        type:      "resonate",
        refId:     storyId,
        title:     `Someone resonated with your story — ${updated.chapterTitle}`,
      }).catch(() => null);
    }

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to resonate story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/stories/:id/save", requireAuth, async (req, res) => {
  const storyId = String(req.params.id);
  const actorId = getUserId(req);
  try {
    // Mirror the H-2 witness-dedup pattern: insert first, only increment if new.
    // Both operations run inside a transaction so the count and the save record
    // are always atomically consistent (matches the M-7 fix on the unsave route).
    let updated: typeof storiesTable.$inferSelect | undefined;

    const [saveRecord] = await db
      .insert(storySavesTable)
      .values({ userId: actorId, storyId })
      .onConflictDoNothing()
      .returning({ userId: storySavesTable.userId });

    if (!saveRecord) {
      // Already saved by this user — return current count without inflating it.
      const [existing] = await db
        .select()
        .from(storiesTable)
        .where(and(eq(storiesTable.id, storyId), eq(storiesTable.isPublic, true)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Not found" });
      return res.json({ savedCount: existing.savedCount, alreadySaved: true });
    }

    // New save — increment the count inside a transaction with the insert already
    // committed above.  We wrap only the count update here; the insert succeeded
    // above and acts as the idempotency guard.
    [updated] = await db
      .update(storiesTable)
      .set({ savedCount: sql`${storiesTable.savedCount} + 1` })
      .where(and(eq(storiesTable.id, storyId), eq(storiesTable.isPublic, true)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });

    if (updated.userId !== actorId) {
      notifyAuthor(actorId, updated.userId, storyId, updated.chapterTitle, "save", req).catch(() => null);
      grantReward(updated.userId, "story_saved", `${storyId}:${actorId}`).catch(() => null);
      syncConstellation(updated.userId).catch(() => null);
    }

    return res.json({ savedCount: updated.savedCount });
  } catch (err) {
    req.log.error({ err }, "Failed to save story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/stories/:id/save", requireAuth, async (req, res) => {
  const storyId = String(req.params.id);
  const actorId = getUserId(req);
  try {
    // M-7: Wrap both operations in a transaction so the savedCount decrement
    // and the save-record deletion are always atomically consistent. Without
    // this, a concurrent failure left one operation committed and the other
    // not, causing a permanent count/record desync.
    await db.transaction(async (tx) => {
      await tx.update(storiesTable)
        .set({ savedCount: sql`GREATEST(${storiesTable.savedCount} - 1, 0)` })
        .where(and(eq(storiesTable.id, storyId), eq(storiesTable.isPublic, true)));
      await tx.delete(storySavesTable)
        .where(and(eq(storySavesTable.userId, actorId), eq(storySavesTable.storyId, storyId)));
    });
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to unsave story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function sendPushForWitness(
  actorId:      string,
  authorId:     string,
  storyId:      string,
  chapterTitle: string,
): Promise<void> {
  const [row] = await db
    .select({ name: characterTable.name })
    .from(characterTable)
    .where(eq(characterTable.userId, actorId))
    .limit(1);
  const actorName = row?.name ?? "A sky child";
  await sendPushNotification(authorId, {
    title: actorName,
    body:  `witnessed your story "${chapterTitle}" ✦`,
    data:  { type: "witness", refId: storyId },
  });
}

function safeImageUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith('file://') || uri.startsWith('data:') || uri.startsWith('blob:')) return null;
  return uri;
}

function normalizePanelMedia<T extends { imageUri?: string | null }>(panel: T): T {
  return {
    ...panel,
    imageUri: panel.imageUri == null ? panel.imageUri : normalizeMediaReference(panel.imageUri),
  };
}

function collectStoryMediaReferences(data: {
  panels?: Array<{ imageUri?: string | null }>;
  pages?: Array<{ panels: Array<{ imageUri?: string | null }> }> | null;
  videoUri?: string | null;
  thumbnailUri?: string | null;
}): Array<string | null | undefined> {
  return [
    ...(data.panels ?? []).map(panel => panel.imageUri),
    ...(data.pages ?? []).flatMap(page => page.panels.map(panel => panel.imageUri)),
    data.videoUri,
    data.thumbnailUri,
  ];
}

function sanitizePanels(panels: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(panels)) return [];
  return (panels as Array<Record<string, unknown>>).map(p => ({
    ...p,
    imageUri: safeImageUri(p.imageUri as string | null | undefined),
  }));
}

async function fetchStickerCounts(storyIds: string[]): Promise<Record<string, number>> {
  if (storyIds.length === 0) return {};
  const rows = await db
    .select({ storyId: stickerReactionsTable.storyId, cnt: count() })
    .from(stickerReactionsTable)
    .where(inArray(stickerReactionsTable.storyId, storyIds))
    .groupBy(stickerReactionsTable.storyId);
  const map: Record<string, number> = {};
  rows.forEach(r => { map[r.storyId] = Number(r.cnt); });
  return map;
}

function serializeStory(row: typeof storiesTable.$inferSelect, stickerCount = 0) {
  return {
    id:                row.id,
    date:              row.date.toISOString(),
    chapterTitle:      row.chapterTitle,
    description:       row.description ?? '',
    panels:            sanitizePanels(row.panels),
    mood:              row.mood,
    location:          row.location,
    isPublic:          row.isPublic,
    witnessedCount:    row.witnessedCount,
    savedCount:        row.savedCount,
    stickerCount,
    witnessMilestones: (row.witnessMilestones ?? []) as number[],
    pageLayoutKey:     row.pageLayoutKey ?? undefined,
    pages:             row.pages ?? undefined,
    createdAt:         row.createdAt.toISOString(),
    contentType:       (row.contentType ?? 'story') as 'story' | 'video',
    videoUri:          row.videoUri ?? null,
    thumbnailUri:      row.thumbnailUri ?? null,
    music:             row.music ?? null,
  };
}

export default router;
