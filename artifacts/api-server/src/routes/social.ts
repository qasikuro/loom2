import { db, characterTable, storiesTable, followsTable } from "@workspace/db";
import { and, desc, eq, ilike, ne, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";

const router: IRouter = Router();

// ── User search ───────────────────────────────────────────────────────────────

router.get("/users/search", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const q = String(req.query.q ?? "").trim();
  if (q.length < 1) return res.json([]);

  try {
    const rows = await db
      .select({
        userId:   characterTable.userId,
        username: characterTable.username,
        name:     characterTable.name,
        bio:      characterTable.bio,
        traits:   characterTable.traits,
      })
      .from(characterTable)
      .where(
        and(
          eq(characterTable.isPublic, true),
          ne(characterTable.userId, userId),
          or(
            ilike(characterTable.username, `${q}%`),
            ilike(characterTable.name, `%${q}%`),
          ),
        ),
      )
      .limit(20);

    const followingRows = await db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, userId));

    const followingSet = new Set(followingRows.map(r => r.followingId));

    return res.json(rows.map(r => ({
      userId:      r.userId,
      username:    r.username,
      name:        r.name,
      bio:         r.bio,
      traits:      r.traits,
      isFollowing: followingSet.has(r.userId),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to search users");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Follow ────────────────────────────────────────────────────────────────────

router.post("/follows/:targetUserId", requireAuth, async (req, res) => {
  const userId       = getUserId(req);
  const targetUserId = String(req.params.targetUserId);

  if (targetUserId === userId) {
    return res.status(400).json({ error: "Cannot follow yourself" });
  }

  try {
    await db
      .insert(followsTable)
      .values({ followerId: userId, followingId: targetUserId })
      .onConflictDoNothing();
    return res.status(201).json({ following: true });
  } catch (err) {
    req.log.error({ err }, "Failed to follow");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Unfollow ──────────────────────────────────────────────────────────────────

router.delete("/follows/:targetUserId", requireAuth, async (req, res) => {
  const userId       = getUserId(req);
  const targetUserId = String(req.params.targetUserId);

  try {
    await db
      .delete(followsTable)
      .where(
        and(
          eq(followsTable.followerId, userId),
          eq(followsTable.followingId, targetUserId),
        ),
      );
    return res.status(200).json({ following: false });
  } catch (err) {
    req.log.error({ err }, "Failed to unfollow");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Who I follow ──────────────────────────────────────────────────────────────

router.get("/follows/following", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, userId));
    return res.json(rows.map(r => r.followingId));
  } catch (err) {
    req.log.error({ err }, "Failed to get following list");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Discover feed (ranked) ────────────────────────────────────────────────────

router.get("/discover", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const [myCharRows, followingRows, stories] = await Promise.all([
      db.select({ mood: characterTable.mood })
        .from(characterTable)
        .where(eq(characterTable.userId, userId))
        .limit(1),

      db.select({ followingId: followsTable.followingId })
        .from(followsTable)
        .where(eq(followsTable.followerId, userId)),

      db.select({
        id:             storiesTable.id,
        userId:         storiesTable.userId,
        chapterTitle:   storiesTable.chapterTitle,
        mood:           storiesTable.mood,
        location:       storiesTable.location,
        witnessedCount: storiesTable.witnessedCount,
        savedCount:     storiesTable.savedCount,
        panels:         storiesTable.panels,
        date:           storiesTable.date,
        authorName:     characterTable.name,
        authorUsername: characterTable.username,
      })
        .from(storiesTable)
        .innerJoin(characterTable, eq(characterTable.userId, storiesTable.userId))
        .where(eq(storiesTable.isPublic, true))
        .orderBy(desc(storiesTable.date))
        .limit(200),
    ]);

    const myMood      = myCharRows[0]?.mood ?? "Hopeful";
    const followingSet = new Set(followingRows.map(r => r.followingId));
    const now          = Date.now();

    const scored = stories.map(row => {
      const isFollowing = followingSet.has(row.userId);
      const moodMatch   = row.mood === myMood;
      const engagement  = Math.min(2, (row.witnessedCount + row.savedCount) / 25);
      const daysOld     = (now - row.date.getTime()) / 86_400_000;
      const recency     = Math.max(0, 1 - daysOld / 30);
      const score       = (isFollowing ? 4 : 0) + (moodMatch ? 2 : 0) + engagement + recency;
      return { row, score, isFollowing };
    });

    scored.sort((a, b) => b.score - a.score);

    return res.json(
      scored.slice(0, 50).map(({ row, isFollowing }) => {
        const panels = row.panels as Array<{ text?: string; imageUri?: string; overlays?: unknown[] }>;
        return {
          id:             row.id,
          authorUserId:   row.userId,
          authorName:     row.authorName,
          authorUsername: row.authorUsername ?? null,
          chapterTitle:   row.chapterTitle,
          storySnippet:   panels[0]?.text ?? "",
          imageUri:       panels[0]?.imageUri ?? null,
          mood:           row.mood,
          location:       row.location,
          witnessedCount: row.witnessedCount,
          savedCount:     row.savedCount,
          date:           row.date.toISOString(),
          panels,
          isFollowing,
        };
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get discover feed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
