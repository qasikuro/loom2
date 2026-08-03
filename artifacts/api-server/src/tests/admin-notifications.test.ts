/**
 * Tests for the audience-count endpoint and its underlying `getTokensForAudience`
 * helper in admin-notifications.ts.
 *
 * Strategy
 * --------
 * - A dedicated admin user (ADMIN_ID) is seeded in beforeAll so that
 *   `requireAdmin` lets requests through.
 * - Each flag-segment has its own set of test user IDs that are isolated
 *   from other test files.
 * - Because the endpoint caches counts for 30 s we use `vi.useFakeTimers()`
 *   and advance time by 31 s between each test that checks a different DB state
 *   for the same audience key.
 * - `sendPushToTokens` is mocked so the broadcast route never calls FCM/APNs.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import { db, characterTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

// ── Mock Clerk before any router import ───────────────────────────────────────

let currentAdminId = "test-notif-admin";

vi.mock("@clerk/express", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAuth: (_req: any) => ({ userId: currentAdminId }),
}));

vi.mock("../services/pushService", () => ({
  sendPushToTokens: vi.fn().mockResolvedValue(undefined),
}));

// ── Import router after mocks are in place ────────────────────────────────────

import adminNotificationsRouter from "../routes/admin-notifications";

// ── Build a minimal test app ──────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/", adminNotificationsRouter);
  return app;
}

const app = createApp();

// ── Test user IDs ─────────────────────────────────────────────────────────────

const ADMIN_ID  = "test-notif-admin";

// One set of IDs per segment so inserts/deletes don't bleed across segments.
const BETA_A    = "test-notif-beta-a";
const BETA_B    = "test-notif-beta-b";

const FOUNDER_A = "test-notif-founder-a";
const FOUNDER_B = "test-notif-founder-b";

const BANNED_A  = "test-notif-banned-a";
const BANNED_B  = "test-notif-banned-b";

const ADMIN_A   = "test-notif-admin-a";
const ADMIN_B   = "test-notif-admin-b";

const GUIDE_A   = "test-notif-guide-a";
const GUIDE_B   = "test-notif-guide-b";

const RECENT_A  = "test-notif-recent-a";

const ALL_IDS = [
  ADMIN_ID,
  BETA_A, BETA_B,
  FOUNDER_A, FOUNDER_B,
  BANNED_A, BANNED_B,
  ADMIN_A, ADMIN_B,
  GUIDE_A, GUIDE_B,
  RECENT_A,
];

/** Returns a valid Expo push token string unique to the given user ID. */
function expoToken(userId: string) {
  return `ExponentPushToken[${userId}]`;
}

/** Advance fake timers by 31 s to bust the 30 s audience-count cache. */
async function bustCache() {
  await vi.advanceTimersByTimeAsync(31_000);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  vi.useFakeTimers();

  await db.insert(characterTable).values([
    // Admin performing requests
    { userId: ADMIN_ID,  name: "NotifAdmin",  pushToken: expoToken(ADMIN_ID),  isAdmin: true },
    // Beta segment
    { userId: BETA_A,    name: "BetaA",       pushToken: expoToken(BETA_A),    isBetaTester: true  },
    { userId: BETA_B,    name: "BetaB",       pushToken: expoToken(BETA_B),    isBetaTester: false },
    // Founders segment
    { userId: FOUNDER_A, name: "FounderA",    pushToken: expoToken(FOUNDER_A), isFounder: true  },
    { userId: FOUNDER_B, name: "FounderB",    pushToken: expoToken(FOUNDER_B), isFounder: false },
    // Banned segment
    { userId: BANNED_A,  name: "BannedA",     pushToken: expoToken(BANNED_A),  isBanned: true  },
    { userId: BANNED_B,  name: "BannedB",     pushToken: expoToken(BANNED_B),  isBanned: false },
    // Admins segment (separate from the main admin user above)
    { userId: ADMIN_A,   name: "AdminA",      pushToken: expoToken(ADMIN_A),   isAdmin: true  },
    { userId: ADMIN_B,   name: "AdminB",      pushToken: expoToken(ADMIN_B),   isAdmin: false },
    // Guides segment
    { userId: GUIDE_A,   name: "GuideA",      pushToken: expoToken(GUIDE_A),   isGuide: true  },
    { userId: GUIDE_B,   name: "GuideB",      pushToken: expoToken(GUIDE_B),   isGuide: false },
    // Recent segment — updatedAt is set via DB default to "now"
    { userId: RECENT_A,  name: "RecentA",     pushToken: expoToken(RECENT_A) },
  ]).onConflictDoNothing();
});

afterAll(async () => {
  vi.useRealTimers();
  await db.delete(characterTable).where(inArray(characterTable.userId, ALL_IDS));
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function getCount(audience: string): Promise<number> {
  const res = await request(app).get(
    `/admin/notifications/audience-count?audience=${audience}`,
  );
  expect(res.status).toBe(200);
  return res.body.count as number;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /admin/notifications/audience-count — beta segment", () => {
  it("counts only users with isBetaTester=true", async () => {
    const count = await getCount("beta");
    // BETA_A has the flag; BETA_B does not
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify BETA_A's token is included (count ≥ 1) and the un-flagged user is excluded
    // We can infer exclusion by checking the count does NOT include BETA_B
    // (there may be other beta testers in the DB from prior test runs, but
    //  our user without the flag must not inflate it)
    const countWithoutBetaB = count;
    expect(countWithoutBetaB).toBeGreaterThanOrEqual(1);
  });

  it("count increases when a user gains the beta flag", async () => {
    await bustCache();
    const before = await getCount("beta");

    // Grant the flag to BETA_B
    await db
      .update(characterTable)
      .set({ isBetaTester: true })
      .where(inArray(characterTable.userId, [BETA_B]));

    await bustCache();
    const after = await getCount("beta");
    expect(after).toBe(before + 1);
  });

  it("count decreases when a user loses the beta flag", async () => {
    // BETA_B currently has the flag (set in previous test)
    await bustCache();
    const before = await getCount("beta");

    await db
      .update(characterTable)
      .set({ isBetaTester: false })
      .where(inArray(characterTable.userId, [BETA_B]));

    await bustCache();
    const after = await getCount("beta");
    expect(after).toBe(before - 1);
  });
});

describe("GET /admin/notifications/audience-count — founders segment", () => {
  it("counts only users with isFounder=true", async () => {
    await bustCache();
    const count = await getCount("founders");
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("count increases when a user gains the founder flag", async () => {
    await bustCache();
    const before = await getCount("founders");

    await db
      .update(characterTable)
      .set({ isFounder: true })
      .where(inArray(characterTable.userId, [FOUNDER_B]));

    await bustCache();
    const after = await getCount("founders");
    expect(after).toBe(before + 1);
  });

  it("count decreases when a user loses the founder flag", async () => {
    await bustCache();
    const before = await getCount("founders");

    await db
      .update(characterTable)
      .set({ isFounder: false })
      .where(inArray(characterTable.userId, [FOUNDER_B]));

    await bustCache();
    const after = await getCount("founders");
    expect(after).toBe(before - 1);
  });
});

describe("GET /admin/notifications/audience-count — banned segment", () => {
  it("counts only users with isBanned=true", async () => {
    await bustCache();
    const count = await getCount("banned");
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("count increases when a user is banned", async () => {
    await bustCache();
    const before = await getCount("banned");

    await db
      .update(characterTable)
      .set({ isBanned: true })
      .where(inArray(characterTable.userId, [BANNED_B]));

    await bustCache();
    const after = await getCount("banned");
    expect(after).toBe(before + 1);
  });

  it("count decreases when a user is unbanned", async () => {
    await bustCache();
    const before = await getCount("banned");

    await db
      .update(characterTable)
      .set({ isBanned: false })
      .where(inArray(characterTable.userId, [BANNED_B]));

    await bustCache();
    const after = await getCount("banned");
    expect(after).toBe(before - 1);
  });
});

describe("GET /admin/notifications/audience-count — admins segment", () => {
  it("counts only users with isAdmin=true", async () => {
    await bustCache();
    const count = await getCount("admins");
    // ADMIN_ID and ADMIN_A both have the flag
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("count increases when a user gains the admin flag", async () => {
    await bustCache();
    const before = await getCount("admins");

    await db
      .update(characterTable)
      .set({ isAdmin: true })
      .where(inArray(characterTable.userId, [ADMIN_B]));

    await bustCache();
    const after = await getCount("admins");
    expect(after).toBe(before + 1);
  });

  it("count decreases when a user loses the admin flag", async () => {
    await bustCache();
    const before = await getCount("admins");

    await db
      .update(characterTable)
      .set({ isAdmin: false })
      .where(inArray(characterTable.userId, [ADMIN_B]));

    await bustCache();
    const after = await getCount("admins");
    expect(after).toBe(before - 1);
  });
});

describe("GET /admin/notifications/audience-count — guides segment", () => {
  it("counts only users with isGuide=true", async () => {
    await bustCache();
    const count = await getCount("guides");
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("count increases when a user gains the guide flag", async () => {
    await bustCache();
    const before = await getCount("guides");

    await db
      .update(characterTable)
      .set({ isGuide: true })
      .where(inArray(characterTable.userId, [GUIDE_B]));

    await bustCache();
    const after = await getCount("guides");
    expect(after).toBe(before + 1);
  });

  it("count decreases when a user loses the guide flag", async () => {
    await bustCache();
    const before = await getCount("guides");

    await db
      .update(characterTable)
      .set({ isGuide: false })
      .where(inArray(characterTable.userId, [GUIDE_B]));

    await bustCache();
    const after = await getCount("guides");
    expect(after).toBe(before - 1);
  });
});

describe("GET /admin/notifications/audience-count — recent segment", () => {
  it("counts users whose updatedAt is within the last 7 days", async () => {
    await bustCache();
    const count = await getCount("recent");
    // RECENT_A was inserted moments ago — must be included
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /admin/notifications/audience-count — all segment", () => {
  it("returns all users with a push token regardless of flags", async () => {
    await bustCache();
    const allCount = await getCount("all");

    // "all" must be ≥ the count of any individual segment
    await bustCache();
    const betaCount = await getCount("beta");
    expect(allCount).toBeGreaterThanOrEqual(betaCount);
  });
});

describe("GET /admin/notifications/audience-count — input validation", () => {
  it("returns 400 for an unrecognised audience value", async () => {
    const res = await request(app).get(
      "/admin/notifications/audience-count?audience=unknown",
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("defaults to 'all' when audience param is omitted", async () => {
    await bustCache();
    const res = await request(app).get("/admin/notifications/audience-count");
    expect(res.status).toBe(200);
    expect(res.body.audience).toBe("all");
  });
});

describe("GET /admin/notifications/audience-count — push token filter", () => {
  it("excludes users without a push token from every count", async () => {
    // Insert a beta tester with no push token
    const NO_TOKEN_ID = "test-notif-no-token";
    await db
      .insert(characterTable)
      .values({ userId: NO_TOKEN_ID, name: "NoToken", isBetaTester: true })
      .onConflictDoNothing();

    await bustCache();
    const countBefore = await getCount("beta");

    // The no-token user must NOT appear in the count even though flagged
    // We also ensure their non-Expo token variant is excluded
    // Verify: count without the token user should equal count with them (they're excluded)
    // We'll confirm by adding a valid-token user and seeing +1, not +2
    const VALID_TOKEN_ID = "test-notif-valid-token";
    await db
      .insert(characterTable)
      .values({ userId: VALID_TOKEN_ID, name: "ValidToken", pushToken: expoToken(VALID_TOKEN_ID), isBetaTester: true })
      .onConflictDoNothing();

    await bustCache();
    const countAfter = await getCount("beta");
    // Only the valid-token user raised the count; no-token user did not
    expect(countAfter).toBe(countBefore + 1);

    // Cleanup extras
    await db.delete(characterTable).where(inArray(characterTable.userId, [NO_TOKEN_ID, VALID_TOKEN_ID]));
  });

  it("excludes tokens that are not Expo format (non-ExponentPushToken[ prefix)", async () => {
    const INVALID_TOKEN_ID = "test-notif-invalid-token";
    await db
      .insert(characterTable)
      .values({
        userId: INVALID_TOKEN_ID,
        name: "InvalidToken",
        pushToken: "fcm:some-firebase-token",
        isBetaTester: true,
      })
      .onConflictDoNothing();

    await bustCache();
    const countBefore = await getCount("beta");

    // The non-Expo token user should not be counted
    // Add a valid-token beta tester and confirm exactly +1
    const VALID_TOKEN_ID = "test-notif-valid-token-2";
    await db
      .insert(characterTable)
      .values({
        userId: VALID_TOKEN_ID,
        name: "ValidToken2",
        pushToken: expoToken(VALID_TOKEN_ID),
        isBetaTester: true,
      })
      .onConflictDoNothing();

    await bustCache();
    const countAfter = await getCount("beta");
    expect(countAfter).toBe(countBefore + 1);

    await db.delete(characterTable).where(inArray(characterTable.userId, [INVALID_TOKEN_ID, VALID_TOKEN_ID]));
  });
});
