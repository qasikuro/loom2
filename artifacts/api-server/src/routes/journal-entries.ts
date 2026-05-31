import { db, journalEntriesTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";
import { grantReward } from "../services/rewardService";
import { syncConstellation } from "../services/constellationService";

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

router.get("/journal-entries", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select()
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.userId, userId))
      .orderBy(desc(journalEntriesTable.date));
    return res.json(rows.map(serializeEntry));
  } catch (err) {
    req.log.error({ err }, "Failed to list journal entries");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/journal-entries", requireAuth, async (req, res) => {
  const userId = getUserId(req);
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
        userId,
        date: new Date(date),
        ...rest,
      })
      .onConflictDoUpdate({
        target: journalEntriesTable.id,
        set: { userId, date: new Date(date), ...rest },
      })
      .returning();

    // Grant daily journal reward (once per calendar day) — await so we can
    // return granted status to the client for feedback display
    const today = new Date().toISOString().slice(0, 10);
    const { granted: rewardGranted, amounts: rewardAmounts } =
      await grantReward(db as any, userId, "journal_daily", today);
    syncConstellation(db as any, userId).catch(() => null);

    return res.status(201).json({ ...serializeEntry(created), rewardGranted, rewardAmounts });
  } catch (err) {
    req.log.error({ err }, "Failed to create journal entry");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/journal-entries/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const entryId = String(req.params.id);
  try {
    await db
      .delete(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.id, entryId),
          eq(journalEntriesTable.userId, userId),
        ),
      );
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
