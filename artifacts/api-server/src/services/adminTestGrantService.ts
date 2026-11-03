import { and, count, eq, sql } from "drizzle-orm";
import {
  db,
  characterTable,
  moderationLogsTable,
  rewardEventsTable,
  userRewardsTable,
} from "@workspace/db";

export interface StarsGrantInput {
  adminId: string;
  targetUsername: string;
  amount: number;
  eventType: string;
  refId: string;
  reason: string;
}

export interface StarsGrantResult {
  username: string;
  amount: number;
  granted: boolean;
  alreadyGranted: boolean;
  starsBefore: number;
  starsAfter: number;
  targetUserId: string;
}

export async function grantStarsIdempotently(
  input: StarsGrantInput,
): Promise<StarsGrantResult | null> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({
        userId: characterTable.userId,
        username: characterTable.username,
      })
      .from(characterTable)
      .where(eq(characterTable.username, input.targetUsername))
      .limit(1);

    if (!target) return null;

    const [current] = await tx
      .select({ stars: userRewardsTable.stars })
      .from(userRewardsTable)
      .where(eq(userRewardsTable.userId, target.userId))
      .limit(1);
    const starsBefore = current?.stars ?? 0;

    // A request-specific reward_events key makes retries safe, including
    // concurrent requests, while allowing a later intentional grant.
    const [claim] = await tx
      .insert(rewardEventsTable)
      .values({
        userId: target.userId,
        eventType: input.eventType,
        refId: input.refId,
      })
      .onConflictDoNothing()
      .returning({ id: rewardEventsTable.id });

    if (!claim) {
      return {
        username: target.username ?? input.targetUsername,
        amount: input.amount,
        granted: false,
        alreadyGranted: true,
        starsBefore,
        starsAfter: starsBefore,
        targetUserId: target.userId,
      };
    }

    const [updatedRewards] = await tx
      .insert(userRewardsTable)
      .values({
        userId: target.userId,
        stars: input.amount,
        lifetimeStars: input.amount,
      })
      .onConflictDoUpdate({
        target: userRewardsTable.userId,
        set: {
          stars: sql`${userRewardsTable.stars} + ${input.amount}`,
          lifetimeStars: sql`${userRewardsTable.lifetimeStars} + ${input.amount}`,
        },
      })
      .returning({ stars: userRewardsTable.stars });

    await tx.insert(moderationLogsTable).values({
      adminId: input.adminId,
      action: "grant_test_stars",
      targetType: "user",
      targetId: target.userId,
      targetUserId: target.userId,
      reason: input.reason,
      snapshot: {
        username: input.targetUsername,
        currency: "stars",
        amount: input.amount,
        balanceBefore: starsBefore,
        balanceAfter: updatedRewards.stars,
        grantRef: input.refId,
      },
    });

    return {
      username: target.username ?? input.targetUsername,
      amount: input.amount,
      granted: true,
      alreadyGranted: false,
      starsBefore,
      starsAfter: updatedRewards.stars,
      targetUserId: target.userId,
    };
  });
}

export async function getStarsGrantStatus(input: {
  targetUsername: string;
  eventType: string;
}): Promise<{ username: string; name: string; starsBalance: number; grantsCount: number } | null> {
  const [target] = await db
    .select({
      userId: characterTable.userId,
      username: characterTable.username,
      name: characterTable.name,
    })
    .from(characterTable)
    .where(eq(characterTable.username, input.targetUsername))
    .limit(1);

  if (!target) return null;

  const [[rewards], [grantEvents]] = await Promise.all([
    db
      .select({ stars: userRewardsTable.stars })
      .from(userRewardsTable)
      .where(eq(userRewardsTable.userId, target.userId))
      .limit(1),
    db
      .select({ count: count() })
      .from(rewardEventsTable)
      .where(and(
        eq(rewardEventsTable.userId, target.userId),
        eq(rewardEventsTable.eventType, input.eventType),
      ))
  ]);

  return {
    username: target.username ?? input.targetUsername,
    name: target.name ?? input.targetUsername,
    starsBalance: rewards?.stars ?? 0,
    grantsCount: Number(grantEvents?.count ?? 0),
  };
}
