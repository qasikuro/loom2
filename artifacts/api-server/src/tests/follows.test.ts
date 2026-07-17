import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp, setTestUserId } from "./helpers/testApp";
import { db, characterTable, followsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

const app = createTestApp();

// ── Fixture user IDs ──────────────────────────────────────────────────────────
const ALICE = "test-follows-alice";
const BOB   = "test-follows-bob";
const CAROL = "test-follows-carol";

beforeAll(async () => {
  await db.insert(characterTable).values([
    { userId: ALICE, name: "Alice", isPublic: true, isBanned: false },
    { userId: BOB,   name: "Bob",   isPublic: true, isBanned: false },
    { userId: CAROL, name: "Carol", isPublic: true, isBanned: false },
  ]).onConflictDoNothing();
});

afterAll(async () => {
  // Clean up all follows rows created by these test users
  for (const userId of [ALICE, BOB, CAROL]) {
    await db.delete(followsTable).where(eq(followsTable.followerId, userId));
    await db.delete(followsTable).where(eq(followsTable.followingId, userId));
  }
  await db.delete(characterTable).where(
    inArray(characterTable.userId, [ALICE, BOB, CAROL]),
  );
});

beforeEach(async () => {
  // Clean slate between tests
  for (const userId of [ALICE, BOB, CAROL]) {
    await db.delete(followsTable).where(eq(followsTable.followerId, userId));
    await db.delete(followsTable).where(eq(followsTable.followingId, userId));
  }
});

// ── POST /api/follows/:targetUserId ──────────────────────────────────────────

describe("POST /api/follows/:targetUserId", () => {
  it("returns 201 and following:true when Alice follows Bob", async () => {
    setTestUserId(ALICE);
    const res = await request(app).post(`/api/follows/${BOB}`);
    expect(res.status).toBe(201);
    expect(res.body.following).toBe(true);
  });

  it("persists the follow row in the database", async () => {
    setTestUserId(ALICE);
    await request(app).post(`/api/follows/${BOB}`);

    const rows = await db
      .select()
      .from(followsTable)
      .where(and(eq(followsTable.followerId, ALICE), eq(followsTable.followingId, BOB)));

    expect(rows).toHaveLength(1);
  });

  it("is idempotent — duplicate follow does not error", async () => {
    setTestUserId(ALICE);
    await request(app).post(`/api/follows/${BOB}`);
    const res2 = await request(app).post(`/api/follows/${BOB}`);
    expect(res2.status).toBe(201);

    // Only one row exists
    const rows = await db
      .select()
      .from(followsTable)
      .where(and(eq(followsTable.followerId, ALICE), eq(followsTable.followingId, BOB)));

    expect(rows).toHaveLength(1);
  });

  it("returns 400 when a user tries to follow themselves", async () => {
    setTestUserId(ALICE);
    const res = await request(app).post(`/api/follows/${ALICE}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yourself/i);
  });

  it("allows following multiple different users independently", async () => {
    setTestUserId(ALICE);
    const r1 = await request(app).post(`/api/follows/${BOB}`);
    const r2 = await request(app).post(`/api/follows/${CAROL}`);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    const rows = await db
      .select()
      .from(followsTable)
      .where(eq(followsTable.followerId, ALICE));

    const ids = rows.map(r => r.followingId);
    expect(ids).toContain(BOB);
    expect(ids).toContain(CAROL);
  });
});

// ── DELETE /api/follows/:targetUserId ─────────────────────────────────────────

describe("DELETE /api/follows/:targetUserId", () => {
  it("returns 200 and following:false after unfollowing", async () => {
    setTestUserId(ALICE);
    // Seed the follow first
    await db.insert(followsTable).values({ followerId: ALICE, followingId: BOB }).onConflictDoNothing();

    const res = await request(app).delete(`/api/follows/${BOB}`);
    expect(res.status).toBe(200);
    expect(res.body.following).toBe(false);
  });

  it("removes the follow row from the database", async () => {
    setTestUserId(ALICE);
    await db.insert(followsTable).values({ followerId: ALICE, followingId: BOB }).onConflictDoNothing();

    await request(app).delete(`/api/follows/${BOB}`);

    const rows = await db
      .select()
      .from(followsTable)
      .where(and(eq(followsTable.followerId, ALICE), eq(followsTable.followingId, BOB)));

    expect(rows).toHaveLength(0);
  });

  it("is idempotent — unfollowing someone not followed does not error", async () => {
    setTestUserId(ALICE);
    // No follow row exists
    const res = await request(app).delete(`/api/follows/${BOB}`);
    expect(res.status).toBe(200);
    expect(res.body.following).toBe(false);
  });

  it("only removes the targeted follow, not others", async () => {
    setTestUserId(ALICE);
    await db.insert(followsTable).values([
      { followerId: ALICE, followingId: BOB },
      { followerId: ALICE, followingId: CAROL },
    ]).onConflictDoNothing();

    await request(app).delete(`/api/follows/${BOB}`);

    const rows = await db
      .select()
      .from(followsTable)
      .where(eq(followsTable.followerId, ALICE));

    const ids = rows.map(r => r.followingId);
    expect(ids).not.toContain(BOB);
    expect(ids).toContain(CAROL);
  });
});

// ── GET /api/follows/following ─────────────────────────────────────────────

describe("GET /api/follows/following", () => {
  it("returns an empty array when not following anyone", async () => {
    setTestUserId(ALICE);
    const res = await request(app).get("/api/follows/following");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns the IDs of followed users", async () => {
    setTestUserId(ALICE);
    await db.insert(followsTable).values([
      { followerId: ALICE, followingId: BOB },
      { followerId: ALICE, followingId: CAROL },
    ]).onConflictDoNothing();

    const res = await request(app).get("/api/follows/following");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain(BOB);
    expect(res.body).toContain(CAROL);
    expect(res.body).toHaveLength(2);
  });

  it("only returns IDs for the requesting user, not others", async () => {
    // BOB follows CAROL — ALICE should NOT see this
    await db.insert(followsTable).values({ followerId: BOB, followingId: CAROL }).onConflictDoNothing();

    setTestUserId(ALICE);
    const res = await request(app).get("/api/follows/following");
    expect(res.status).toBe(200);
    expect(res.body).not.toContain(CAROL);
  });

  it("reflects unfollows immediately", async () => {
    setTestUserId(ALICE);
    await db.insert(followsTable).values({ followerId: ALICE, followingId: BOB }).onConflictDoNothing();

    await request(app).delete(`/api/follows/${BOB}`);

    const res = await request(app).get("/api/follows/following");
    expect(res.status).toBe(200);
    expect(res.body).not.toContain(BOB);
  });
});
