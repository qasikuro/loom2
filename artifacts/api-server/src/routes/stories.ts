import { db, storiesTable, followsTable, characterTable, notificationsTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";

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
    return res.json(rows.map(serializeStory));
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
          chapterTitle: rest.chapterTitle, mood: rest.mood,
          location: rest.location, isPublic: rest.isPublic,
        },
      })
      .returning();

    // Fan-out notifications to followers (fire & forget, non-blocking)
    if (rest.isPublic) {
      fanOutStoryNotification(userId, created.id, rest.chapterTitle, req).catch(() => null);
    }

    return res.status(201).json(serializeStory(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

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
      return res.json(serializeStory(publicRows[0].story));
    }
    return res.json(serializeStory(rows[0]));
  } catch (err) {
    req.log.error({ err }, "Failed to get story");
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
  try {
    // Allow witnessing any public story from a public profile
    const [updated] = await db
      .update(storiesTable)
      .set({ witnessedCount: sql`${storiesTable.witnessedCount} + 1` })
      .where(
        and(
          eq(storiesTable.id, storyId),
          eq(storiesTable.isPublic, true),
        ),
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(serializeStory(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to witness story");
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

function serializeStory(row: typeof storiesTable.$inferSelect) {
  return {
    id:             row.id,
    date:           row.date.toISOString(),
    chapterTitle:   row.chapterTitle,
    panels:         sanitizePanels(row.panels),
    mood:           row.mood,
    location:       row.location,
    isPublic:       row.isPublic,
    witnessedCount: row.witnessedCount,
    savedCount:     row.savedCount,
    pageLayoutKey:  row.pageLayoutKey ?? undefined,
    pages:          row.pages ?? undefined,
    createdAt:      row.createdAt.toISOString(),
  };
}

export default router;
