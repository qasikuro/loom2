import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, sql, and, gte } from "drizzle-orm";
import {
  constellationProgressTable,
  journalEntriesTable,
  storiesTable,
  stickerReactionsTable,
  followsTable,
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
  db:     NodePgDatabase<any>,
  userId: string,
): Promise<void> {
  try {
    // ── Fetch all aggregate counts in parallel ─────────────────────────────
    const [
      journalRows,
      storyRows,
      stickersReceivedRows,
      stickersSentRows,
      followsGivenRows,
      savedStoriesRows,
      witnessedStoriesRows,
    ] = await Promise.all([
      // All journal entry dates (for streak calculation)
      db
        .selectDistinct({ date: sql<string>`DATE(${journalEntriesTable.date})` })
        .from(journalEntriesTable)
        .where(eq(journalEntriesTable.userId, userId))
        .orderBy(sql`DATE(${journalEntriesTable.date}) DESC`),

      // Total story count
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(storiesTable)
        .where(eq(storiesTable.userId, userId)),

      // Total stickers received
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(stickerReactionsTable)
        .where(eq(stickerReactionsTable.toUserId, userId)),

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

      // Saves received (savedCount sum on own stories)
      db
        .select({ total: sql<number>`cast(coalesce(sum(${storiesTable.savedCount}), 0) as int)` })
        .from(storiesTable)
        .where(eq(storiesTable.userId, userId)),

      // Stories with at least 3 witnesses
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(storiesTable)
        .where(and(eq(storiesTable.userId, userId), gte(storiesTable.witnessedCount, 3))),
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

    const journalCount     = journalDates.length;
    const storyCount       = storyRows[0]?.count         ?? 0;
    const stickersReceived = stickersReceivedRows[0]?.count ?? 0;
    const stickersSent     = stickersSentRows[0]?.count  ?? 0;
    const followsGiven     = followsGivenRows[0]?.count  ?? 0;
    const savesReceived    = savedStoriesRows[0]?.total   ?? 0;
    const witnessedStories = witnessedStoriesRows[0]?.count ?? 0;

    // ── Determine unlocked stars ───────────────────────────────────────────
    const unlocked: string[] = [];

    const socialUnlocked   = followsGiven >= 5 && stickersReceived >= 5;
    const memoryUnlocked   = journalCount  >= 10 && savesReceived  >= 5;
    const quietUnlocked    = quietStreak   >= 7;
    const helpingUnlocked  = stickersSent  >= 20;
    const creativeUnlocked = storyCount    >= 5  && witnessedStories >= 1;
    // Seasonal unlocks once any 3 other stars are achieved
    const preSeasonalCount = [socialUnlocked, memoryUnlocked, quietUnlocked, helpingUnlocked, creativeUnlocked].filter(Boolean).length;
    const seasonalUnlocked = preSeasonalCount >= 3;

    if (socialUnlocked)   unlocked.push("social");
    if (memoryUnlocked)   unlocked.push("memory");
    if (quietUnlocked)    unlocked.push("quiet");
    if (helpingUnlocked)  unlocked.push("helping");
    if (creativeUnlocked) unlocked.push("creative");
    if (seasonalUnlocked) unlocked.push("seasonal");

    const activeTitle = titleForCount(unlocked.length);

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
        seasonalCount: preSeasonalCount,
        unlockedStars: unlocked,
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
          seasonalCount:   preSeasonalCount,
          unlockedStars:   unlocked,
          activeTitle:     sql`COALESCE(${constellationProgressTable.activeTitle}, ${activeTitle})`,
          updatedAt:       sql`now()`,
        },
      });
  } catch {
    // Fire-and-forget: never block the main request
  }
}
