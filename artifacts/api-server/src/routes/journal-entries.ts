import { db, journalEntriesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";

const router: IRouter = Router();

const JournalEntryInputSchema = z.object({
  id:         z.string().uuid().optional().nullable(),
  date:       z.string(),
  type:       z.enum(["diary", "friend", "moment"]),
  text:       z.string().min(1),
  mood:       z.string().default("Peaceful"),
  imageUri:   z.string().nullable().optional(),
  friendName: z.string().nullable().optional(),
});

router.get("/journal-entries", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(journalEntriesTable)
      .orderBy(desc(journalEntriesTable.date));
    return res.json(rows.map(serializeEntry));
  } catch (err) {
    req.log.error({ err }, "Failed to list journal entries");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/journal-entries", async (req, res) => {
  const parsed = JournalEntryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const { id, date, ...rest } = parsed.data;

    const [created] = await db
      .insert(journalEntriesTable)
      .values({
        ...(id ? { id } : {}),
        date: new Date(date),
        ...rest,
      })
      .onConflictDoUpdate({
        target: journalEntriesTable.id,
        set: { date: new Date(date), ...rest },
      })
      .returning();

    return res.status(201).json(serializeEntry(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create journal entry");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/journal-entries/:id", async (req, res) => {
  try {
    await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id, req.params.id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete journal entry");
    return res.status(500).json({ error: "Internal server error" });
  }
});

function serializeEntry(row: typeof journalEntriesTable.$inferSelect) {
  return {
    id:         row.id,
    date:       row.date.toISOString(),
    type:       row.type,
    text:       row.text,
    mood:       row.mood,
    imageUri:   row.imageUri  ?? undefined,
    friendName: row.friendName ?? undefined,
    createdAt:  row.createdAt.toISOString(),
  };
}

export default router;
