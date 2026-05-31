import { db, storiesTable, followsTable, characterTable, notificationsTable, stickerReactionsTable } from "@workspace/db";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";
import { grantReward } from "../services/rewardService";
import { syncConstellation } from "../services/constellationService";

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

router.get("/stories", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select()
      .from(storiesTable)
      .where(and(eq(storiesTable.userId, userId), eq(storiesTable.isHidden, false)))
      .orderBy(desc(storiesTable.date));

    const stickerCounts = await fetchStickerCounts(rows.map(r => r.id));
    return res.json(rows.map(r => serializeStory(r, stickerCounts[r.id] ?? 0)));
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
      pages:         (rest.pages ?? null) as any,
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
          pages: (rest.pages ?? null) as any,
          chapterTitle: rest.chapterTitle, description: rest.description ?? '',
          mood: rest.mood, location: rest.location, isPublic: rest.isPublic,
        },
      })
      .returning();

    // Fan-out notifications to followers (fire & forget, non-blocking)
    if (rest.isPublic) {
      fanOutStoryNotification(userId, created.id, rest.chapterTitle, req).catch(() => null);
    }

    // Grant story creation reward (once per story ID) — await for client feedback
    const { granted: rewardGranted, amounts: rewardAmounts } =
      await grantReward(db as any, userId, "story_created", created.id);
    syncConstellation(db as any, userId).catch(() => null);

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
  type:         "witness" | "save",
  req:          any,
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

async function fanOutStoryNotification(
  userId: string,
  storyId: string,
  chapterTitle: string,
  req: any,
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
      .set(updateSet as any)
      .where(and(eq(storiesTable.id, storyId), eq(storiesTable.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
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
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

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

    // Notify the story author (fire-and-forget, skip if own story)
    if (updated.userId !== actorId) {
      notifyAuthor(actorId, updated.userId, storyId, updated.chapterTitle, "witness", req).catch(() => null);
      // Reward story owner for receiving a witness
      grantReward(db as any, updated.userId, "story_witnessed", `${storyId}:${actorId}`).catch(() => null);
      syncConstellation(db as any, updated.userId).catch(() => null);
    }
    // Reward witness for their daily presence — await for client feedback
    const today = new Date().toISOString().slice(0, 10);
    const { granted: rewardGranted, amounts: rewardAmounts } =
      await grantReward(db as any, actorId, "daily_presence", today);
    syncConstellation(db as any, actorId).catch(() => null);

    return res.json({ ...serializeStory(updated), rewardGranted, rewardAmounts });
  } catch (err) {
    req.log.error({ err }, "Failed to witness story");
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

    if (updated.userId !== actorId) {
      notifyAuthor(actorId, updated.userId, storyId, updated.chapterTitle, "save", req).catch(() => null);
      // Reward story owner for receiving a save
      grantReward(db as any, updated.userId, "story_saved", `${storyId}:${actorId}`).catch(() => null);
      syncConstellation(db as any, updated.userId).catch(() => null);
    }

    return res.json({ savedCount: updated.savedCount });
  } catch (err) {
    req.log.error({ err }, "Failed to save story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/stories/:id/save", requireAuth, async (req, res) => {
  const storyId = String(req.params.id);
  try {
    const [updated] = await db
      .update(storiesTable)
      .set({ savedCount: sql`GREATEST(${storiesTable.savedCount} - 1, 0)` })
      .where(and(eq(storiesTable.id, storyId), eq(storiesTable.isPublic, true)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json({ savedCount: updated.savedCount });
  } catch (err) {
    req.log.error({ err }, "Failed to unsave story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

function safeImageUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith('file://') || uri.startsWith('data:') || uri.startsWith('blob:')) return null;
  return uri;
}

function sanitizePanels(panels: unknown): unknown[] {
  if (!Array.isArray(panels)) return [];
  return panels.map((p: any) => ({ ...p, imageUri: safeImageUri(p.imageUri) }));
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
    id:             row.id,
    date:           row.date.toISOString(),
    chapterTitle:   row.chapterTitle,
    description:    row.description ?? '',
    panels:         sanitizePanels(row.panels),
    mood:           row.mood,
    location:       row.location,
    isPublic:       row.isPublic,
    witnessedCount: row.witnessedCount,
    savedCount:     row.savedCount,
    stickerCount,
    pageLayoutKey:  row.pageLayoutKey ?? undefined,
    pages:          row.pages ?? undefined,
    createdAt:      row.createdAt.toISOString(),
  };
}

export default router;
