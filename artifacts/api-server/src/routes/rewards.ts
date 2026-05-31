import { db, userRewardsTable, constellationProgressTable, userPurchasesTable } from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { syncConstellation } from "../services/constellationService";

const router: IRouter = Router();

// ── Shop catalog (source of truth — validated server-side) ──────────────────
export interface ShopItem {
  id:             string;
  name:           string;
  description:    string;
  icon:           string;
  category:       "frame" | "accent" | "theme";
  cost:           { stars?: number; aura?: number; shards?: number };
  seasonal?:      boolean;
  seasonalLabel?: string;
  seasonalUntil?: string;
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
  // ── Seasonal items (Summer 2026, expire Aug 31) ───────────────────────────
  {
    id:             "frame_solstice",
    name:           "Summer Solstice Frame",
    description:    "A sun-drenched golden frame shimmering with warm light. Limited time only.",
    icon:           "☀",
    category:       "frame",
    cost:           { stars: 50 },
    seasonal:       true,
    seasonalLabel:  "Summer",
    seasonalUntil:  "2026-08-31",
  },
  {
    id:             "accent_twilight",
    name:           "Twilight Veil",
    description:    "A warm amber shimmer wraps your profile in long summer evenings.",
    icon:           "◐",
    category:       "accent",
    cost:           { aura: 30 },
    seasonal:       true,
    seasonalLabel:  "Summer",
    seasonalUntil:  "2026-08-31",
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

// ── GET /api/constellation — full constellation progress (always re-syncs) ──
router.get("/constellation", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    // Capture previous unlocked stars BEFORE re-syncing so we can diff
    const [before] = await db
      .select({ unlockedStars: constellationProgressTable.unlockedStars })
      .from(constellationProgressTable)
      .where(eq(constellationProgressTable.userId, userId))
      .limit(1);

    const previousStars: string[] = (before?.unlockedStars as string[]) ?? [];

    // Always re-sync so counts and star thresholds are current
    await syncConstellation(db as any, userId);

    const [row] = await db
      .select()
      .from(constellationProgressTable)
      .where(eq(constellationProgressTable.userId, userId))
      .limit(1);

    if (!row) {
      return res.json({
        socialCount: 0, memoryCount: 0, quietStreak: 0,
        helpingCount: 0, creativeCount: 0, seasonalCount: 0,
        unlockedStars: [], activeTitle: null, newlyUnlocked: [],
      });
    }

    // Diff: stars present now that were absent before
    const currentStars = (row.unlockedStars as string[]) ?? [];
    const newlyUnlocked = currentStars.filter(s => !previousStars.includes(s));

    return res.json({
      socialCount:   row.socialCount,
      memoryCount:   row.memoryCount,
      quietStreak:   row.quietStreak,
      helpingCount:  row.helpingCount,
      creativeCount: row.creativeCount,
      seasonalCount: row.seasonalCount,
      unlockedStars: row.unlockedStars,
      activeTitle:   row.activeTitle,
      newlyUnlocked,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch constellation");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/rewards/shop — catalog + purchased IDs + active cosmetics ───────
router.get("/rewards/shop", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const [purchases, rewardsRow] = await Promise.all([
      db
        .select({ itemId: userPurchasesTable.itemId })
        .from(userPurchasesTable)
        .where(eq(userPurchasesTable.userId, userId)),
      db
        .select({ activeCosmetics: userRewardsTable.activeCosmetics })
        .from(userRewardsTable)
        .where(eq(userRewardsTable.userId, userId))
        .limit(1),
    ]);

    const purchasedIds     = purchases.map((p) => p.itemId);
    const rawActive        = (rewardsRow[0]?.activeCosmetics ?? {}) as Record<string, string>;
    // Sanitise: only keep active entries where the item is actually owned
    const activeCosmetics: Record<string, string> = {};
    for (const [category, itemId] of Object.entries(rawActive)) {
      if (purchasedIds.includes(itemId)) activeCosmetics[category] = itemId;
    }

    return res.json({ catalog: SHOP_CATALOG, purchasedIds, activeCosmetics });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch shop");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/rewards/active-cosmetics — persist active cosmetic selection ────
router.put("/rewards/active-cosmetics", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { activeCosmetics } = req.body as { activeCosmetics?: Record<string, string> };

  if (!activeCosmetics || typeof activeCosmetics !== "object") {
    return res.status(400).json({ error: "activeCosmetics object is required" });
  }

  try {
    // Validate: only store entries where the item is actually owned
    const purchases = await db
      .select({ itemId: userPurchasesTable.itemId })
      .from(userPurchasesTable)
      .where(eq(userPurchasesTable.userId, userId));
    const purchasedIds = purchases.map((p) => p.itemId);

    const sanitised: Record<string, string> = {};
    for (const [category, itemId] of Object.entries(activeCosmetics)) {
      if (typeof itemId === "string" && purchasedIds.includes(itemId)) {
        sanitised[category] = itemId;
      }
    }

    await db
      .insert(userRewardsTable)
      .values({ userId, activeCosmetics: sanitised })
      .onConflictDoUpdate({
        target: userRewardsTable.userId,
        set: { activeCosmetics: sanitised, updatedAt: sql`now()` },
      });

    return res.json({ success: true, activeCosmetics: sanitised });
  } catch (err) {
    req.log.error({ err }, "Failed to persist active cosmetics");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/constellation/title — user picks which earned title to display ──
router.put("/constellation/title", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { title } = req.body as { title?: string };
  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "title is required" });
  }
  const VALID_TITLES = [
    "Star Wanderer", "Memory Keeper", "Sky Child",
    "Constellation Dreamer", "Guiding Light", "Child of the Sky",
  ];
  if (!VALID_TITLES.includes(title)) {
    return res.status(400).json({ error: "Invalid title" });
  }
  try {
    await db
      .update(constellationProgressTable)
      .set({ activeTitle: title, updatedAt: sql`now()` })
      .where(eq(constellationProgressTable.userId, userId));
    return res.json({ activeTitle: title });
  } catch (err) {
    req.log.error({ err }, "Failed to update constellation title");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/rewards/purchases — full purchase history ───────────────────────
router.get("/rewards/purchases", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select()
      .from(userPurchasesTable)
      .where(eq(userPurchasesTable.userId, userId))
      .orderBy(desc(userPurchasesTable.purchasedAt));
    return res.json(rows.map(p => ({
      id:          p.id,
      itemId:      p.itemId,
      itemName:    p.itemName,
      starsSpent:  p.starsSpent,
      auraSpent:   p.auraSpent,
      shardsSpent: p.shardsSpent,
      purchasedAt: p.purchasedAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch purchase history");
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
