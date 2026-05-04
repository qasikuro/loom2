import { db, storiesTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";

const router: IRouter = Router();

const PanelSchema = z.object({
  id:       z.string(),
  text:     z.string(),
  imageUri: z.string().optional().nullable(),
});

const StoryInputSchema = z.object({
  id:           z.string().uuid().optional().nullable(),
  date:         z.string(),
  chapterTitle: z.string().min(1).max(200),
  panels:       z.array(PanelSchema).min(1),
  mood:         z.string().default("Peaceful"),
  location:     z.string().default(""),
  isPublic:     z.boolean().default(false),
});

router.get("/stories", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(storiesTable)
      .orderBy(desc(storiesTable.date));
    return res.json(rows.map(serializeStory));
  } catch (err) {
    req.log.error({ err }, "Failed to list stories");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/stories", async (req, res) => {
  const parsed = StoryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const { id, date, panels, ...rest } = parsed.data;
    const sanitizedPanels = panels.map(p => ({
      id:       p.id,
      text:     p.text,
      imageUri: p.imageUri ?? undefined,
    }));

    const insertValues = {
      ...(id ? { id } : {}),
      date:   new Date(date),
      panels: sanitizedPanels,
      ...rest,
    };

    const [created] = await db
      .insert(storiesTable)
      .values(insertValues)
      .onConflictDoUpdate({
        target: storiesTable.id,
        set: { date: new Date(date), panels: sanitizedPanels, ...rest },
      })
      .returning();

    return res.status(201).json(serializeStory(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stories/:id", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(storiesTable)
      .where(eq(storiesTable.id, req.params.id))
      .limit(1);

    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    return res.json(serializeStory(rows[0]));
  } catch (err) {
    req.log.error({ err }, "Failed to get story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/stories/:id", async (req, res) => {
  try {
    await db.delete(storiesTable).where(eq(storiesTable.id, req.params.id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/stories/:id/witness", async (req, res) => {
  try {
    const [updated] = await db
      .update(storiesTable)
      .set({ witnessedCount: sql`${storiesTable.witnessedCount} + 1` })
      .where(eq(storiesTable.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(serializeStory(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to witness story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

function serializeStory(row: typeof storiesTable.$inferSelect) {
  return {
    id:             row.id,
    date:           row.date.toISOString(),
    chapterTitle:   row.chapterTitle,
    panels:         row.panels,
    mood:           row.mood,
    location:       row.location,
    isPublic:       row.isPublic,
    witnessedCount: row.witnessedCount,
    savedCount:     row.savedCount,
    createdAt:      row.createdAt.toISOString(),
  };
}

export default router;
