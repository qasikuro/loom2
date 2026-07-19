import { db, storiesTable, storySavesTable, followsTable, characterTable, notificationsTable, stickerReactionsTable, userPurchasesTable, type StoryPageDB } from "@workspace/db";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";
import { grantReward } from "../services/rewardService";
import { syncConstellation } from "../services/constellationService";
import { sendPushNotification, sendPushToTokens } from "../services/pushService";
import * as cache from "../lib/cache";

const router: IRouter = Router();

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
  id:         z.string(),
  text:       z.string(),
  imageUri:   z.string().optional().nullable(),
  bgPreset:   z.string().optional().nullable(),
  bubbleText: z.string().optional().nullable(),
  overlays:   z.array(OverlaySchema).optional().nullable(),
});

const StoryInputSchema = z.object({
  id:             z.string().uuid().optional().nullable(),
  date:           z.string(),
  chapterTitle:   z.string().min(1).max(200),
  description:    z.string().max(1000).default(""),
  panels:         z.array(PanelSchema).min(1),
  mood:           z.string().default("Peaceful"),
  location:       z.string().default(""),
  isPublic:       z.boolean().default(false),
  pageLayoutKey:  z.string().optional().nullable(),
  pages:          z.array(z.object({
    id:        z.string(),
    layoutKey: z.string(),
    panels:    z.array(PanelSchema),
  })).optional().nullable(),
});

const StoryOutputSchema = z.object({
  id:           z.string().uuid(),
  date:         z.string(),
  chapterTitle: z.string().min(1),
  panels:       z.array(z.unknown()).min(1),
  mood:         z.string().min(1),
  createdAt:    z.string(),
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
    const serialized = rows.map(r => serializeStory(r, stickerCounts[r.id] ?? 0));
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
    const sanitizedPanels = panels.map(p => ({
      id:         p.id,
      text:       p.text,
      imageUri:   safeImageUri(p.imageUri ?? null) ?? undefined,
      bgPreset:   p.bgPreset   ?? undefined,
      bubbleText: p.bubbleText ?? undefined,
      overlays:   p.overlays   ?? undefined,
    }));

    const insertValues = {
      ...(id ? { id } : {}),
      userId,
      date:          new Date(date),
      panels:        sanitizedPanels,
      pageLayoutKey: rest.pageLayoutKey ?? null,
      pages:         (rest.pages ?? null) as StoryPageDB[] | null,
      chapterTitle:  rest.chapterTitle,
      description:   rest.description ?? '',
      mood:          rest.mood,
      location:      rest.location,
      isPublic:      rest.isPublic,
    };

    const [created] = await db
      .insert(storiesTable)
      .values(insertValues)
      .onConflictDoUpdate({
        target: storiesTable.id,
        set: {
          userId, date: new Date(date), panels: sanitizedPanels,
          pageLayoutKey: rest.pageLayoutKey ?? null,
          pages: (rest.pages ?? null) as StoryPageDB[] | null,
          chapterTitle: rest.chapterTitle, description: rest.description ?? '',
          mood: rest.mood, location: rest.location, isPublic: rest.isPublic,
        },
      })
      .returning();

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

    return res.status(201).json({ ...serializeStory(created), rewardGranted, rewardAmounts });
  } catch (err) {
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
    return res.json(serializeStory(rows[0], counts[storyId] ?? 0));
  } catch (err) {
    req.log.error({ err }, "Failed to get story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/stories/:id", requireAuth, async (req, res) => {
  const userId  = getUserId(req);
  const storyId = String(req.params.id);
  const parsed  = StoryInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  try {
    const updateSet: Record<string, unknown> = {};
    if (parsed.data.chapterTitle  !== undefined) updateSet.chapterTitle  = parsed.data.chapterTitle;
    if (parsed.data.description   !== undefined) updateSet.description   = parsed.data.description;
    if (parsed.data.mood          !== undefined) updateSet.mood          = parsed.data.mood;
    if (parsed.data.location      !== undefined) updateSet.location      = parsed.data.location;
    if (parsed.data.isPublic      !== undefined) updateSet.isPublic      = parsed.data.isPublic;
    if ('pageLayoutKey' in parsed.data)          updateSet.pageLayoutKey = parsed.data.pageLayoutKey ?? null;
    if ('pages' in parsed.data)                  updateSet.pages         = (parsed.data.pages ?? null) as unknown;
    if (parsed.data.panels        !== undefined) {
      updateSet.panels = parsed.data.panels.map(p => ({
        id:         p.id,
        text:       p.text,
        imageUri:   safeImageUri(p.imageUri ?? null) ?? undefined,
        bgPreset:   p.bgPreset   ?? undefined,
        bubbleText: p.bubbleText ?? undefined,
        overlays:   p.overlays   ?? undefined,
      }));
    }

    const [updated] = await db
      .update(storiesTable)
      .set(updateSet as Partial<typeof storiesTable.$inferInsert>)
      .where(and(eq(storiesTable.id, storyId), eq(storiesTable.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    invalidateFollowerDiscoverCaches(userId).catch(() => null);
    return res.json(serializeStory(updated));
  } catch (err) {
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

        // ── Step 1: Grant reward FIRST (idempotent via unique refId in reward_events).
        //    If this throws, we skip the claim entirely so the milestone can be retried
        //    on the next witness — prevents a permanently-claimed-but-unrewarded state.
        try {
          await grantReward(
            updated.userId, "witness_milestone",
            `${storyId}:${threshold}`,
            { aura: mData.aura, stars: mData.stars },
          );
        } catch (grantErr) {
          req.log.warn({ grantErr, storyId, threshold }, "Milestone reward grant failed; will retry on next witness");
          continue; // Do NOT mark claimed — allows retry when next witness arrives
        }

        // ── Step 2: Atomically mark milestone as claimed.
        //    Uses jsonb containment check to be safe against concurrent witnesses.
        //    grantReward is already idempotent, so even if two witnesses race here,
        //    the reward is granted exactly once by the unique reward_events index.
        const claimResult = await db.execute(sql`
          UPDATE stories
          SET witness_milestones = witness_milestones || ${JSON.stringify([threshold])}::jsonb
          WHERE id = ${storyId}
            AND NOT (witness_milestones @> ${JSON.stringify([threshold])}::jsonb)
          RETURNING id
        `).catch(err => { req.log.warn({ err, storyId, threshold }, "Milestone claim update failed"); return { rows: [] }; }) as unknown as { rows: { id: string }[] };

        if (claimResult?.rows?.length) {
          // ── Step 3: Best-effort side-effects (non-critical — already rewarded above) ──

          // Append milestone title to character traits (idempotent)
          db.execute(sql`
            UPDATE character
            SET traits = CASE
              WHEN traits @> ${JSON.stringify([mData.titleName])}::jsonb THEN traits
              ELSE traits || ${JSON.stringify([mData.titleName])}::jsonb
            END
            WHERE user_id = ${updated.userId}
          `).catch(err => req.log.warn({ err }, "Failed to append milestone title to traits"));

          // 500-milestone: grant profile shimmer cosmetic (free — no currency spent)
          if (threshold === 500) {
            db.insert(userPurchasesTable)
              .values({ userId: updated.userId, itemId: 'shimmer_profile', itemName: 'Profile Shimmer', starsSpent: 0, auraSpent: 0, shardsSpent: 0 })
              .onConflictDoNothing()
              .catch(err => req.log.warn({ err }, "Failed to grant shimmer cosmetic"));
          }

          // Send milestone notification to creator so they can open the story and see the modal
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
      ...(fresh ? serializeStory(fresh) : serializeStory(updated)),
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
    const [updated] = await db
      .update(storiesTable)
      .set({ savedCount: sql`${storiesTable.savedCount} + 1` })
      .where(and(eq(storiesTable.id, storyId), eq(storiesTable.isPublic, true)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });

    // Persist who saved this story (idempotent)
    await db.insert(storySavesTable)
      .values({ userId: actorId, storyId })
      .onConflictDoNothing();

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
    await Promise.all([
      db.update(storiesTable)
        .set({ savedCount: sql`GREATEST(${storiesTable.savedCount} - 1, 0)` })
        .where(and(eq(storiesTable.id, storyId), eq(storiesTable.isPublic, true))),
      db.delete(storySavesTable)
        .where(and(eq(storySavesTable.userId, actorId), eq(storySavesTable.storyId, storyId))),
    ]);
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
  };
}

export default router;
