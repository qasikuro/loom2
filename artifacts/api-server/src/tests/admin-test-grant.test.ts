import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  characterTable,
  db,
  moderationLogsTable,
  rewardEventsTable,
  userRewardsTable,
} from "@workspace/db";
import { getStarsGrantStatus, grantStarsIdempotently } from "../services/adminTestGrantService";

const suffix = randomUUID();
const ADMIN_ID = `test-grant-admin-${suffix}`;
const USER_ID = `test-grant-user-${suffix}`;
const USERNAME = `granttest${suffix.replaceAll("-", "").slice(0, 18)}`;
const EVENT_TYPE = "test_admin_grant";
const REF_ID = `test-grant-${suffix}`;

describe("admin repeatable Stars grant service", () => {
  beforeAll(async () => {
    await db.insert(characterTable).values({
      userId: USER_ID,
      username: USERNAME,
      name: "Test Grant User",
    });
    await db.insert(userRewardsTable).values({
      userId: USER_ID,
      stars: 5,
      lifetimeStars: 5,
    });
  });

  afterAll(async () => {
    await db.delete(moderationLogsTable).where(and(
      eq(moderationLogsTable.adminId, ADMIN_ID),
      eq(moderationLogsTable.targetUserId, USER_ID),
    ));
    await db.delete(rewardEventsTable).where(eq(rewardEventsTable.userId, USER_ID));
    await db.delete(userRewardsTable).where(eq(userRewardsTable.userId, USER_ID));
    await db.delete(characterTable).where(eq(characterTable.userId, USER_ID));
  });

  it("allows distinct confirmed grants while making retries of each grant idempotent", async () => {
    const firstInput = {
      adminId: ADMIN_ID,
      targetUsername: USERNAME,
      amount: 1_000,
      eventType: EVENT_TYPE,
      refId: `${REF_ID}-first`,
      reason: "Automated repeatable grant test.",
    };

    const first = await grantStarsIdempotently(firstInput);
    expect(first).toMatchObject({
      username: USERNAME,
      amount: 1_000,
      granted: true,
      alreadyGranted: false,
      starsBefore: 5,
      starsAfter: 1_005,
      targetUserId: USER_ID,
    });

    const retry = await grantStarsIdempotently(firstInput);
    expect(retry).toMatchObject({
      amount: 1_000,
      granted: false,
      alreadyGranted: true,
      starsBefore: 1_005,
      starsAfter: 1_005,
    });

    const second = await grantStarsIdempotently({
      ...firstInput,
      refId: `${REF_ID}-second`,
    });
    expect(second).toMatchObject({
      username: USERNAME,
      amount: 1_000,
      granted: true,
      alreadyGranted: false,
      starsBefore: 1_005,
      starsAfter: 2_005,
      targetUserId: USER_ID,
    });

    const [balance] = await db
      .select({ stars: userRewardsTable.stars, lifetimeStars: userRewardsTable.lifetimeStars })
      .from(userRewardsTable)
      .where(eq(userRewardsTable.userId, USER_ID));
    expect(balance).toEqual({ stars: 2_005, lifetimeStars: 2_005 });

    const [auditCount] = await db
      .select({ count: count() })
      .from(moderationLogsTable)
      .where(and(
        eq(moderationLogsTable.adminId, ADMIN_ID),
        eq(moderationLogsTable.targetUserId, USER_ID),
        eq(moderationLogsTable.action, "grant_test_stars"),
      ));
    expect(Number(auditCount.count)).toBe(2);

    const status = await getStarsGrantStatus({
      targetUsername: USERNAME,
      eventType: EVENT_TYPE,
    });
    expect(status?.grantsCount).toBe(2);
  });
});
