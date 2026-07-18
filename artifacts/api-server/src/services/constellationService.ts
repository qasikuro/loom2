import { eq, sql, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  constellationProgressTable,
  journalEntriesTable,
  storiesTable,
  stickerReactionsTable,
  followsTable,
  outfitsTable,
} from "@workspace/db";

const TITLES: Record<number, string> = {
  1: "Star Wanderer",
  2: "Memory Keeper",
  3: "Sky Child",
  4: "Constellation Dreamer",
  5: "Guiding Light",
  6: "Child of the Sky",
};

function titleForCount(count: number): string | null {
  if (count <= 0) return null;
  return TITLES[Math.min(count, 6)] ?? null;
}

/**
 * Recompute and persist a user's constellation progress.
 * Uses aggregate queries — fast even for large datasets.
 */
export async function syncConstellation(
  userId: string,
): Promise<void> {
  try {
    // ── Fetch all aggregate counts in parallel ─────────────────────────────
    const [
      journalRows,
      journalCountRows,
      storyRows,
      stickersSentRows,
      followsGivenRows,
      outfitRows,
    ] = await Promise.all([
      // All journal entry dates (for quiet-streak calculation)
      db
        .selectDistinct({ date: sql<string>`DATE(${journalEntriesTable.date})` })
        .from(journalEntriesTable)
        .where(eq(journalEntriesTable.userId, userId))
        .orderBy(sql`DATE(${journalEntriesTable.date}) DESC`),

      // Total entry count — every new entry increments this (used for memoryCount)
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(journalEntriesTable)
        .where(eq(journalEntriesTable.userId, userId)),

      // Total story count
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(storiesTable)
        .where(eq(storiesTable.userId, userId)),

      // Total stickers sent
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(stickerReactionsTable)
        .where(eq(stickerReactionsTable.fromUserId, userId)),

      // Follows given
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(followsTable)
        .where(eq(followsTable.followerId, userId)),

      // Total outfits logged (seasonal participation)
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(outfitsTable)
        .where(and(eq(outfitsTable.userId, userId), eq(outfitsTable.isHidden, false))),
    ]);

    // ── Compute quiet streak ───────────────────────────────────────────────
    const journalDates = journalRows.map((r) => r.date);
    let quietStreak   = 0;
    const today       = new Date().toISOString().slice(0, 10);
    let expected      = today;
    for (const d of journalDates) {
      if (d !== expected) break;
      quietStreak++;
      const prev = new Date(expected);
      prev.setDate(prev.getDate() - 1);
      expected = prev.toISOString().slice(0, 10);
    }

    // memoryCount = total entries ever written (every journal entry counts)
    const journalCount = journalCountRows[0]?.count ?? 0;
    const storyCount   = storyRows[0]?.count        ?? 0;
    const stickersSent = stickersSentRows[0]?.count  ?? 0;
    const followsGiven = followsGivenRows[0]?.count  ?? 0;
    const outfitCount  = outfitRows[0]?.count        ?? 0;

    // ── Determine unlocked stars ───────────────────────────────────────────
    const unlocked: string[] = [];

    // Requirements are intentionally self-achievable (no dependency on others' actions)
    const socialUnlocked   = followsGiven >= 5;
    const memoryUnlocked   = journalCount >= 10;
    const quietUnlocked    = quietStreak  >= 7;
    const helpingUnlocked  = stickersSent >= 20;
    const creativeUnlocked = storyCount   >= 5;
    // Seasonal star: unlocks after logging 6 outfits (seasonal wardrobe participation)
    const seasonalUnlocked = outfitCount  >= 6;

    if (socialUnlocked)   unlocked.push("social");
    if (memoryUnlocked)   unlocked.push("memory");
    if (quietUnlocked)    unlocked.push("quiet");
    if (helpingUnlocked)  unlocked.push("helping");
    if (creativeUnlocked) unlocked.push("creative");
    if (seasonalUnlocked) unlocked.push("seasonal");

    const activeTitle = titleForCount(unlocked.length);

    // ── Resolve per-star unlock dates ─────────────────────────────────────
    // Fetch existing row to preserve previously-recorded unlock dates.
    const [existingRow] = await db
      .select({ starUnlockDates: constellationProgressTable.starUnlockDates, unlockedStars: constellationProgressTable.unlockedStars })
      .from(constellationProgressTable)
      .where(eq(constellationProgressTable.userId, userId))
      .limit(1);

    const prevDates: Record<string, string> = (existingRow?.starUnlockDates as Record<string, string>) ?? {};
    const prevUnlocked: string[] = (existingRow?.unlockedStars as string[]) ?? [];
    const now = new Date().toISOString();
    const starUnlockDates: Record<string, string> = { ...prevDates };
    for (const key of unlocked) {
      if (!prevUnlocked.includes(key) && !starUnlockDates[key]) {
        starUnlockDates[key] = now;
      }
    }

    // ── Upsert constellation_progress ────────────────────────────────────
    await db
      .insert(constellationProgressTable)
      .values({
        userId,
        socialCount:   followsGiven,
        memoryCount:   journalCount,
        quietStreak,
        lastJournalDate: journalDates[0] ?? null,
        helpingCount:  stickersSent,
        creativeCount: storyCount,
        seasonalCount: outfitCount,
        unlockedStars: unlocked,
        starUnlockDates,
        activeTitle,
      })
      .onConflictDoUpdate({
        target: constellationProgressTable.userId,
        set: {
          socialCount:     followsGiven,
          memoryCount:     journalCount,
          quietStreak,
          lastJournalDate: journalDates[0] ?? null,
          helpingCount:    stickersSent,
          creativeCount:   storyCount,
          seasonalCount:   outfitCount,
          unlockedStars:   unlocked,
          starUnlockDates: sql`${constellationProgressTable.starUnlockDates} || ${JSON.stringify(starUnlockDates)}::jsonb`,
          activeTitle:     sql`COALESCE(${constellationProgressTable.activeTitle}, ${activeTitle})`,
          updatedAt:       sql`now()`,
        },
      });
  } catch {
    // Fire-and-forget: never block the main request
  }
}
