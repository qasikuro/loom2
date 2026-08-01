import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { userRewardsTable, rewardEventsTable } from "@workspace/db";

export interface RewardAmounts {
  stars?:  number;
  aura?:   number;
  shards?: number;
}

const REWARD_AMOUNTS: Record<string, RewardAmounts> = {
  journal_daily:           { stars: 2, aura: 1,  shards: 3 },
  story_created:           { stars: 3, aura: 2,  shards: 1 },
  story_witnessed:         { stars: 1 },
  story_saved:             { stars: 2, shards: 2 },
  sticker_sent:            { aura: 2 },
  sticker_received:        { stars: 1, shards: 1 },
  follow_given:            { stars: 1, aura: 1 },
  daily_presence:          { stars: 2, aura: 3 },
};

export function defaultAmounts(eventType: string): RewardAmounts {
  return REWARD_AMOUNTS[eventType] ?? {};
}

// Type alias so callers can pass the drizzle transaction object without
// importing drizzle internals.  Both `db` and the `tx` yielded inside
// `db.transaction()` satisfy this interface.
type DbOrTx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

/**
 * Grant a reward to a user for a specific event.
 *
 * Idempotent: duplicate (userId, eventType, refId) tuples are silently ignored.
 *
 * Atomic (standalone): when called without `extTx`, the event insert and
 * balance increment are wrapped in their own transaction so a partial failure
 * cannot leave the event marked as granted without currency.  Errors are
 * swallowed — reward grants must never block the caller's main action.
 *
 * Atomic (nested): when `extTx` is provided the queries run directly on that
 * transaction object.  Postgres promotes the inner statements to savepoints,
 * making the reward part of the outer transaction's commit/rollback.  Errors
 * propagate so the outer transaction can roll back if needed.
 */
export async function grantReward(
  userId:    string,
  eventType: string,
  refId:     string = "",
  amounts?:  RewardAmounts,
  extTx?:    DbOrTx,
): Promise<{ granted: boolean; amounts: RewardAmounts }> {
  const creditAmounts = amounts ?? defaultAmounts(eventType);
  const stars  = creditAmounts.stars  ?? 0;
  const aura   = creditAmounts.aura   ?? 0;
  const shards = creditAmounts.shards ?? 0;

  async function runQueries(runner: DbOrTx): Promise<boolean> {
    const [event] = await runner
      .insert(rewardEventsTable)
      .values({ userId, eventType, refId })
      .onConflictDoNothing()
      .returning({ id: rewardEventsTable.id });

    if (!event) return false; // Already granted — idempotent no-op

    await runner
      .insert(userRewardsTable)
      .values({
        userId,
        stars,
        auraEnergy:    aura,
        memoryShards:  shards,
        lifetimeStars: stars,
      })
      .onConflictDoUpdate({
        target: userRewardsTable.userId,
        set: {
          stars:         sql`${userRewardsTable.stars}         + ${stars}`,
          auraEnergy:    sql`${userRewardsTable.auraEnergy}    + ${aura}`,
          memoryShards:  sql`${userRewardsTable.memoryShards}  + ${shards}`,
          lifetimeStars: sql`${userRewardsTable.lifetimeStars} + ${stars}`,
          updatedAt:     sql`now()`,
        },
      });

    return true;
  }

  if (extTx) {
    // Running inside a caller-managed transaction.  Errors propagate so the
    // outer transaction rolls back everything atomically.
    const granted = await runQueries(extTx);
    return { granted, amounts: creditAmounts };
  }

  try {
    let granted = false;
    await db.transaction(async (innerTx) => {
      granted = await runQueries(innerTx);
    });
    return { granted, amounts: creditAmounts };
  } catch {
    // Swallow errors — standalone reward grants must never block the caller
    return { granted: false, amounts: creditAmounts };
  }
}
