import { db, userRewardsTable, constellationProgressTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { syncConstellation } from "../services/constellationService";

const router: IRouter = Router();

// ── GET /api/rewards — current balance (auto-creates zero row if missing) ───
router.get("/rewards", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const [row] = await db
      .insert(userRewardsTable)
      .values({ userId })
      .onConflictDoUpdate({
        target: userRewardsTable.userId,
        set: { updatedAt: sql`now()` },
      })
      .returning();

    return res.json({
      stars:         row.stars,
      auraEnergy:    row.auraEnergy,
      memoryShards:  row.memoryShards,
      lifetimeStars: row.lifetimeStars,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch rewards");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/constellation — full constellation progress (auto-syncs) ───────
router.get("/constellation", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const existing = await db
      .select()
      .from(constellationProgressTable)
      .where(eq(constellationProgressTable.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      // First access — compute from scratch
      await syncConstellation(db as any, userId);
    }

    const [row] = await db
      .select()
      .from(constellationProgressTable)
      .where(eq(constellationProgressTable.userId, userId))
      .limit(1);

    if (!row) {
      return res.json({
        socialCount: 0, memoryCount: 0, quietStreak: 0,
        helpingCount: 0, creativeCount: 0, seasonalCount: 0,
        unlockedStars: [], activeTitle: null,
      });
    }

    return res.json({
      socialCount:   row.socialCount,
      memoryCount:   row.memoryCount,
      quietStreak:   row.quietStreak,
      helpingCount:  row.helpingCount,
      creativeCount: row.creativeCount,
      seasonalCount: row.seasonalCount,
      unlockedStars: row.unlockedStars,
      activeTitle:   row.activeTitle,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch constellation");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
