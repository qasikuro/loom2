import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
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

/**
 * Grant a reward to a user for a specific event.
 * Idempotent: duplicate (userId, eventType, refId) tuples are silently ignored.
 * Atomic: event insert + balance increment are wrapped in a single transaction
 * so a partial failure cannot leave the event marked as granted without currency.
 * Returns whether the reward was newly granted and the amounts credited.
 */
export async function grantReward(
  db:        NodePgDatabase<any>,
  userId:    string,
  eventType: string,
  refId:     string = "",
  amounts?:  RewardAmounts,
): Promise<{ granted: boolean; amounts: RewardAmounts }> {
  const creditAmounts = amounts ?? defaultAmounts(eventType);
  const stars  = creditAmounts.stars  ?? 0;
  const aura   = creditAmounts.aura   ?? 0;
  const shards = creditAmounts.shards ?? 0;

  try {
    let granted = false;

    await db.transaction(async (tx) => {
      // Attempt to insert the event record. ON CONFLICT DO NOTHING means if this
      // exact (userId, eventType, refId) was already granted, nothing happens and
      // .returning() gives us an empty array — so we bail out without touching balances.
      const [event] = await tx
        .insert(rewardEventsTable)
        .values({ userId, eventType, refId })
        .onConflictDoNothing()
        .returning({ id: rewardEventsTable.id });

      if (!event) return; // Already granted — idempotent no-op

      // Atomically upsert the user_rewards row within the same transaction.
      // If this statement throws, the whole transaction rolls back, restoring
      // the reward_events insert and preventing a phantom "granted but no balance" state.
      await tx
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

      granted = true;
    });

    return { granted, amounts: creditAmounts };
  } catch {
    // Swallow errors — reward grants must never block the main action
    return { granted: false, amounts: creditAmounts };
  }
}
