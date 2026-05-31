import { db, userRewardsTable, constellationProgressTable, userPurchasesTable } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { syncConstellation } from "../services/constellationService";

const router: IRouter = Router();

// ── Shop catalog (source of truth — validated server-side) ──────────────────
export interface ShopItem {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  category:    "frame" | "accent" | "theme";
  cost:        { stars?: number; aura?: number; shards?: number };
}

export const SHOP_CATALOG: ShopItem[] = [
  {
    id:          "frame_starlight",
    name:        "Starlight Frame",
    description: "A golden radiant frame that surrounds your profile with starlight.",
    icon:        "✦",
    category:    "frame",
    cost:        { stars: 30 },
  },
  {
    id:          "frame_moonveil",
    name:        "Moonveil Frame",
    description: "A silver crescent frame woven from moonlight and quiet wishes.",
    icon:        "◑",
    category:    "frame",
    cost:        { stars: 40, shards: 10 },
  },
  {
    id:          "accent_aura",
    name:        "Aura Glow",
    description: "Wraps your bio in a soft purple luminescence.",
    icon:        "◈",
    category:    "accent",
    cost:        { aura: 25 },
  },
  {
    id:          "theme_locket",
    name:        "Memory Locket",
    description: "A vintage golden-locket theme for your journal entries.",
    icon:        "◇",
    category:    "theme",
    cost:        { shards: 20 },
  },
  {
    id:          "theme_aurora",
    name:        "Aurora Theme",
    description: "Paint your journal pages with the colours of the northern lights.",
    icon:        "⋆",
    category:    "theme",
    cost:        { aura: 15, shards: 15 },
  },
];

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

// ── GET /api/rewards/shop — catalog + user's purchased item IDs ─────────────
router.get("/rewards/shop", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const purchases = await db
      .select({ itemId: userPurchasesTable.itemId })
      .from(userPurchasesTable)
      .where(eq(userPurchasesTable.userId, userId));

    return res.json({
      catalog:      SHOP_CATALOG,
      purchasedIds: purchases.map((p) => p.itemId),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch shop");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Sentinel errors used to signal rollback intent inside a transaction ──────
//
// In Drizzle (and pg transactions in general), the transaction callback must
// THROW to roll back — returning normally always commits.  These sentinel
// classes let us throw inside the callback and then discriminate the error
// in the outer catch block, mapping each case to the right HTTP response.
//
class InsufficientFundsError extends Error {
  constructor() { super("insufficient_funds"); this.name = "InsufficientFundsError"; }
}
class AlreadyOwnedError extends Error {
  constructor() { super("already_owned"); this.name = "AlreadyOwnedError"; }
}

// ── POST /api/rewards/spend — deduct currency and record purchase ─────────────
//
// Atomicity guarantees:
//   1. Everything runs inside a single DB transaction.
//   2. Balance deduction uses a conditional WHERE (balance >= cost) — if
//      0 rows are updated the handler throws InsufficientFundsError, which
//      rolls back the whole transaction and prevents negative balances.
//   3. The purchase insert uses ON CONFLICT DO NOTHING.  If 0 rows are
//      returned (item already owned), the handler throws AlreadyOwnedError,
//      rolling back the deduction so the user is never charged twice.
//
router.post("/rewards/spend", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { itemId } = req.body as { itemId?: string };

  if (!itemId) {
    return res.status(400).json({ error: "itemId is required" });
  }

  const item = SHOP_CATALOG.find((i) => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  const starsNeeded  = item.cost.stars  ?? 0;
  const auraNeeded   = item.cost.aura   ?? 0;
  const shardsNeeded = item.cost.shards ?? 0;

  try {
    const newBalance = await db.transaction(async (tx) => {
      // ── Step 1: ensure balance row exists ─────────────────────────────
      await tx
        .insert(userRewardsTable)
        .values({ userId })
        .onConflictDoNothing();

      // ── Step 2: atomic conditional deduction ──────────────────────────
      // WHERE enforces non-negative balance.  If 0 rows updated → throw
      // so the transaction rolls back with no change to the DB.
      const [deducted] = await tx
        .update(userRewardsTable)
        .set({
          stars:        sql`${userRewardsTable.stars}        - ${starsNeeded}`,
          auraEnergy:   sql`${userRewardsTable.auraEnergy}   - ${auraNeeded}`,
          memoryShards: sql`${userRewardsTable.memoryShards} - ${shardsNeeded}`,
          updatedAt:    sql`now()`,
        })
        .where(and(
          eq(userRewardsTable.userId, userId),
          gte(userRewardsTable.stars,        starsNeeded),
          gte(userRewardsTable.auraEnergy,   auraNeeded),
          gte(userRewardsTable.memoryShards, shardsNeeded),
        ))
        .returning();

      if (!deducted) {
        throw new InsufficientFundsError();
      }

      // ── Step 3: record purchase (ON CONFLICT DO NOTHING) ──────────────
      // Unique constraint (user_id, item_id) prevents duplicate purchases.
      // If 0 rows returned the item was already owned → throw to roll back
      // the deduction above so the user keeps their currency.
      const [purchased] = await tx
        .insert(userPurchasesTable)
        .values({
          userId,
          itemId:      item.id,
          itemName:    item.name,
          starsSpent:  starsNeeded,
          auraSpent:   auraNeeded,
          shardsSpent: shardsNeeded,
        })
        .onConflictDoNothing()
        .returning();

      if (!purchased) {
        throw new AlreadyOwnedError();
      }

      return deducted;
    });

    return res.json({
      success: true,
      newBalance: {
        stars:         newBalance.stars,
        auraEnergy:    newBalance.auraEnergy,
        memoryShards:  newBalance.memoryShards,
        lifetimeStars: newBalance.lifetimeStars,
      },
    });
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return res.status(402).json({ error: "insufficient_funds" });
    }
    if (err instanceof AlreadyOwnedError) {
      return res.status(409).json({ error: "already_owned" });
    }
    req.log.error({ err }, "Failed to spend rewards");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
