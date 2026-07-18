import { db, userRewardsTable, constellationProgressTable, userPurchasesTable } from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { syncConstellation } from "../services/constellationService";

const router: IRouter = Router();

// ── Shop catalog (source of truth — validated server-side) ──────────────────
export interface ShopItem {
  id:              string;
  name:            string;
  description:     string;
  icon:            string;
  category:        "frame" | "accent" | "theme" | "effect";
  cost:            { stars?: number; aura?: number; shards?: number };
  seasonal?:       boolean;
  seasonalLabel?:  string;
  // Months (1–12) in which this item is purchasable; repeats every year.
  // Omit for always-available items.
  seasonalMonths?: number[];
}

// Returns true if the item is currently available for purchase.
function isItemAvailable(item: ShopItem, month: number): boolean {
  if (!item.seasonal || !item.seasonalMonths) return true;
  return item.seasonalMonths.includes(month);
}

export const SHOP_CATALOG: ShopItem[] = [
  // ── Profile Effects ───────────────────────────────────────────────────────
  {
    id:          "effect_butterfly",
    name:        "Ethereal Butterflies",
    description: "Luminous butterflies drift across your profile, wings catching the light of distant stars.",
    icon:        "🦋",
    category:    "effect",
    cost:        { stars: 0 },
  },
  {
    id:          "effect_fireflies",
    name:        "Firefly Glow",
    description: "Golden fireflies blink softly around you like scattered wishes under a summer sky.",
    icon:        "✨",
    category:    "effect",
    cost:        { stars: 0 },
  },
  {
    id:          "effect_hearts",
    name:        "Floating Hearts",
    description: "Soft hearts rise gently from below, carrying warmth to every corner of your sky.",
    icon:        "💜",
    category:    "effect",
    cost:        { stars: 0 },
  },
  {
    id:             "effect_fire",
    name:           "Sky Lanterns",
    description:    "Warm amber flames float upward like sky lanterns released at summer dusk.",
    icon:           "🔥",
    category:       "effect",
    cost:           { stars: 0 },
    seasonal:       true,
    seasonalLabel:  "Summer",
    seasonalMonths: [6, 7, 8],
  },
  {
    id:             "effect_blossom",
    name:           "Cherry Blossom Rain",
    description:    "Delicate pink petals spiral through your profile in a gentle spring shower.",
    icon:           "🌸",
    category:       "effect",
    cost:           { stars: 0 },
    seasonal:       true,
    seasonalLabel:  "Spring",
    seasonalMonths: [3, 4, 5],
  },
  {
    id:             "effect_leaves",
    name:           "Forest Whisper",
    description:    "Autumn leaves drift quietly through your profile, carrying the scent of rain on stone.",
    icon:           "🍃",
    category:       "effect",
    cost:           { stars: 0 },
    seasonal:       true,
    seasonalLabel:  "Autumn",
    seasonalMonths: [9, 10, 11],
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
    await syncConstellation(userId);

    const [row] = await db
      .select()
      .from(constellationProgressTable)
      .where(eq(constellationProgressTable.userId, userId))
      .limit(1);

    if (!row) {
      return res.json({
        socialCount: 0, memoryCount: 0, quietStreak: 0,
        helpingCount: 0, creativeCount: 0, seasonalCount: 0,
        unlockedStars: [], starUnlockDates: {}, activeTitle: null, newlyUnlocked: [],
      });
    }

    // Diff: stars present now that were absent before
    const currentStars = (row.unlockedStars as string[]) ?? [];
    const newlyUnlocked = currentStars.filter(s => !previousStars.includes(s));

    return res.json({
      socialCount:     row.socialCount,
      memoryCount:     row.memoryCount,
      quietStreak:     row.quietStreak,
      helpingCount:    row.helpingCount,
      creativeCount:   row.creativeCount,
      seasonalCount:   row.seasonalCount,
      unlockedStars:   row.unlockedStars,
      starUnlockDates: row.starUnlockDates ?? {},
      activeTitle:     row.activeTitle,
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

    // Split catalog: currently-available items vs out-of-season seasonal previews
    const currentMonth = new Date().getMonth() + 1; // 1-indexed
    const catalog        = SHOP_CATALOG.filter(item => isItemAvailable(item, currentMonth));
    const seasonalPreview = SHOP_CATALOG
      .filter(item => item.seasonal && !isItemAvailable(item, currentMonth))
      .map(item => ({ ...item, availableNow: false as const }));

    // _ts forces a unique response body each call → unique ETag → Express never sends 304
    return res.set('Cache-Control', 'no-store').json({ catalog, seasonalPreview, purchasedIds, activeCosmetics, _ts: Date.now() });
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
//
// Entitlement model: titles are indexed 1–6 by star count.  A user may only
// choose a title whose index (1-based) is ≤ the number of stars they have
// actually unlocked.  We load their constellation row first and reject any
// request for an unearned title with 403.
//
router.put("/constellation/title", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { title } = req.body as { title?: string };
  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "title is required" });
  }

  // Ordered list mirrors constellationService TITLES map (index = stars needed)
  const ORDERED_TITLES = [
    "Star Wanderer",        // 1 star
    "Memory Keeper",        // 2 stars
    "Sky Child",            // 3 stars
    "Constellation Dreamer",// 4 stars
    "Guiding Light",        // 5 stars
    "Child of the Sky",     // 6 stars
  ];

  const titleIndex = ORDERED_TITLES.indexOf(title); // 0-based
  if (titleIndex === -1) {
    return res.status(400).json({ error: "Invalid title" });
  }

  try {
    // Fetch the user's current constellation progress to check earned stars
    const [progress] = await db
      .select({ unlockedStars: constellationProgressTable.unlockedStars })
      .from(constellationProgressTable)
      .where(eq(constellationProgressTable.userId, userId))
      .limit(1);

    const earnedCount = (progress?.unlockedStars as string[] | undefined)?.length ?? 0;

    // Title at index N requires N+1 stars
    if (earnedCount === 0 || titleIndex >= earnedCount) {
      return res.status(403).json({ error: "title_not_earned" });
    }

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

  // Block seasonal items that are currently out of season
  const currentMonth = new Date().getMonth() + 1;
  if (!isItemAvailable(item, currentMonth)) {
    return res.status(403).json({ error: "seasonal_unavailable" });
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
