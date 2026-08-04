import { Router } from "express";
import { and, count, eq, gt, sql, sum } from "drizzle-orm";
import { db, booksTable, chaptersTable, bookFollowsTable, bookCommentsTable } from "@workspace/db";
import { requireAuth, getUserId } from "../middleware/auth";

const router = Router();

/**
 * GET /creator/dashboard
 * Returns aggregated stats for the authenticated creator:
 *   - totals: reads, followers, comments (all-time)
 *   - weekly: new followers + comments in last 7 days
 *   - topBooks: up to 5 books with chapter counts and read totals
 *   - engagementTrend: comment counts per day for last 7 days
 */
router.get("/creator/dashboard", requireAuth, async (req, res) => {
  const userId = getUserId(req);

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // ── Run queries in parallel ───────────────────────────────────────────────

    const [
      totalReadsRow,
      totalFollowersRow,
      totalCommentsRow,
      newFollowersRow,
      newCommentsRow,
      topBooksRows,
      trendRows,
    ] = await Promise.all([

      // Total reads across all user's chapters
      db
        .select({ total: sql<number>`COALESCE(SUM(${chaptersTable.readCount}), 0)` })
        .from(chaptersTable)
        .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
        .where(eq(booksTable.userId, userId)),

      // Total followers across all user's books
      db
        .select({ total: count() })
        .from(bookFollowsTable)
        .innerJoin(booksTable, eq(booksTable.id, bookFollowsTable.bookId))
        .where(eq(booksTable.userId, userId)),

      // Total comments across all user's chapters
      db
        .select({ total: count() })
        .from(bookCommentsTable)
        .innerJoin(chaptersTable, eq(chaptersTable.id, bookCommentsTable.chapterId))
        .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
        .where(eq(booksTable.userId, userId)),

      // New followers in last 7 days
      db
        .select({ total: count() })
        .from(bookFollowsTable)
        .innerJoin(booksTable, eq(booksTable.id, bookFollowsTable.bookId))
        .where(
          and(
            eq(booksTable.userId, userId),
            gt(bookFollowsTable.createdAt, sevenDaysAgo),
          )
        ),

      // New comments in last 7 days
      db
        .select({ total: count() })
        .from(bookCommentsTable)
        .innerJoin(chaptersTable, eq(chaptersTable.id, bookCommentsTable.chapterId))
        .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
        .where(
          and(
            eq(booksTable.userId, userId),
            gt(bookCommentsTable.createdAt, sevenDaysAgo),
          )
        ),

      // Top 5 books by read count with chapter counts
      db
        .select({
          id:           booksTable.id,
          title:        booksTable.title,
          coverImageUri:booksTable.coverImageUri,
          updatedAt:    booksTable.updatedAt,
          chapterCount: count(chaptersTable.id),
          totalReads:   sql<number>`COALESCE(SUM(${chaptersTable.readCount}), 0)`,
        })
        .from(booksTable)
        .leftJoin(chaptersTable, eq(chaptersTable.bookId, booksTable.id))
        .where(eq(booksTable.userId, userId))
        .groupBy(
          booksTable.id, booksTable.title, booksTable.coverImageUri, booksTable.updatedAt,
        )
        .orderBy(sql`COALESCE(SUM(${chaptersTable.readCount}), 0) DESC`)
        .limit(5),

      // Engagement trend: comments per day for last 7 days
      db
        .select({
          day:   sql<string>`DATE_TRUNC('day', ${bookCommentsTable.createdAt})::date::text`,
          count: count(),
        })
        .from(bookCommentsTable)
        .innerJoin(chaptersTable, eq(chaptersTable.id, bookCommentsTable.chapterId))
        .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
        .where(
          and(
            eq(booksTable.userId, userId),
            gt(bookCommentsTable.createdAt, sevenDaysAgo),
          )
        )
        .groupBy(sql`DATE_TRUNC('day', ${bookCommentsTable.createdAt})::date`)
        .orderBy(sql`DATE_TRUNC('day', ${bookCommentsTable.createdAt})::date`),
    ]);

    // ── Build 7-day trend array (fill gaps with 0) ────────────────────────────
    const trendMap = new Map<string, number>(
      trendRows.map(r => [r.day, Number(r.count)])
    );
    const trend: Array<{ date: string; comments: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      trend.push({ date: key, comments: trendMap.get(key) ?? 0 });
    }

    return res.json({
      totals: {
        reads:     Number(totalReadsRow[0]?.total     ?? 0),
        followers: Number(totalFollowersRow[0]?.total ?? 0),
        comments:  Number(totalCommentsRow[0]?.total  ?? 0),
      },
      weekly: {
        newFollowers: Number(newFollowersRow[0]?.total ?? 0),
        newComments:  Number(newCommentsRow[0]?.total  ?? 0),
      },
      topBooks: topBooksRows.map(b => ({
        id:           b.id,
        title:        b.title,
        coverImageUri:b.coverImageUri ?? null,
        updatedAt:    b.updatedAt,
        chapterCount: Number(b.chapterCount),
        totalReads:   Number(b.totalReads),
      })),
      engagementTrend: trend,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch creator dashboard");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
