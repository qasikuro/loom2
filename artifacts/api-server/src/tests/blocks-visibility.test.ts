import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, setTestUserId } from "./helpers/testApp";
import { db, characterTable, storiesTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

const app = createTestApp();

// ── Fixture user IDs ──────────────────────────────────────────────────────────
const VIEWER  = "test-blk-viewer";   // the requesting user
const BLOCKER = "test-blk-blocker";  // VIEWER has blocked BLOCKER
const BLOCKED = "test-blk-blocked";  // BLOCKED has blocked VIEWER
const NEUTRAL = "test-blk-neutral";  // no block relationship — control user

// ── Seed IDs ──────────────────────────────────────────────────────────────────
let storyBlockerId: string;
let storyBlockedId: string;
let storyNeutralId: string;

beforeAll(async () => {
  // Characters — all public, not banned
  await db.insert(characterTable).values([
    { userId: VIEWER,  name: "Viewer",  isPublic: true, isBanned: false, mood: "Hopeful" },
    { userId: BLOCKER, name: "Blocker", isPublic: true, isBanned: false, mood: "Hopeful" },
    { userId: BLOCKED, name: "Blocked", isPublic: true, isBanned: false, mood: "Hopeful" },
    { userId: NEUTRAL, name: "Neutral", isPublic: true, isBanned: false, mood: "Hopeful" },
  ]).onConflictDoNothing();

  // VIEWER has blocked BLOCKER
  await db.execute(sql`
    INSERT INTO blocks (blocker_id, blocked_id)
    VALUES (${VIEWER}, ${BLOCKER})
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING
  `);

  // BLOCKED has blocked VIEWER (reverse direction)
  await db.execute(sql`
    INSERT INTO blocks (blocker_id, blocked_id)
    VALUES (${BLOCKED}, ${VIEWER})
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING
  `);

  // Stories for each non-viewer user
  const [s1] = await db.insert(storiesTable).values({
    userId: BLOCKER, chapterTitle: "Blocker story", mood: "Hopeful",
    isPublic: true, isHidden: false, date: new Date(), panels: [],
  }).returning({ id: storiesTable.id });
  storyBlockerId = s1.id;

  const [s2] = await db.insert(storiesTable).values({
    userId: BLOCKED, chapterTitle: "Blocked story", mood: "Hopeful",
    isPublic: true, isHidden: false, date: new Date(), panels: [],
  }).returning({ id: storiesTable.id });
  storyBlockedId = s2.id;

  const [s3] = await db.insert(storiesTable).values({
    userId: NEUTRAL, chapterTitle: "Neutral story", mood: "Hopeful",
    isPublic: true, isHidden: false, date: new Date(), panels: [],
  }).returning({ id: storiesTable.id });
  storyNeutralId = s3.id;
});

afterAll(async () => {
  // Remove blocks
  await db.execute(sql`
    DELETE FROM blocks
     WHERE (blocker_id = ${VIEWER}  AND blocked_id = ${BLOCKER})
        OR (blocker_id = ${BLOCKED} AND blocked_id = ${VIEWER})
  `);

  // Remove stories
  const storyIds = [storyBlockerId, storyBlockedId, storyNeutralId].filter(Boolean);
  if (storyIds.length > 0) {
    await db.delete(storiesTable).where(inArray(storiesTable.id, storyIds));
  }

  // Remove characters
  await db.delete(characterTable).where(
    inArray(characterTable.userId, [VIEWER, BLOCKER, BLOCKED, NEUTRAL]),
  );
});

// ── Discover feed — block filtering ──────────────────────────────────────────

describe("GET /api/discover — blocked user filtering", () => {
  it("excludes stories from users the viewer has blocked", async () => {
    setTestUserId(VIEWER);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = res.body.map((p: any) => p.id);
    expect(ids).not.toContain(storyBlockerId);
  });

  it("excludes stories from users who have blocked the viewer", async () => {
    setTestUserId(VIEWER);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = res.body.map((p: any) => p.id);
    expect(ids).not.toContain(storyBlockedId);
  });

  it("still includes stories from unblocked users", async () => {
    setTestUserId(VIEWER);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain(storyNeutralId);
  });

  it("viewer's own stories do not appear regardless of blocks", async () => {
    setTestUserId(VIEWER);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authorIds = res.body.map((p: any) => p.authorUserId);
    expect(authorIds).not.toContain(VIEWER);
  });

  it("from the blocker's perspective — viewer's stories do not appear", async () => {
    // Seed a story for VIEWER so there is something to check
    const [s] = await db.insert(storiesTable).values({
      userId: VIEWER, chapterTitle: "Viewer story", mood: "Hopeful",
      isPublic: true, isHidden: false, date: new Date(), panels: [],
    }).returning({ id: storiesTable.id });

    try {
      setTestUserId(BLOCKER);
      const res = await request(app).get("/api/discover");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authorIds = res.body.map((p: any) => p.authorUserId);
      expect(authorIds).not.toContain(VIEWER);
    } finally {
      await db.delete(storiesTable).where(inArray(storiesTable.id, [s.id]));
    }
  });
});

// ── User search — block filtering ─────────────────────────────────────────────

describe("GET /api/users/search — blocked user filtering", () => {
  it("excludes users the viewer has blocked from search results", async () => {
    setTestUserId(VIEWER);
    // "Blocker" is the name of the user VIEWER blocked
    const res = await request(app).get("/api/users/search?q=Blocker");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userIds = res.body.map((u: any) => u.userId);
    expect(userIds).not.toContain(BLOCKER);
  });

  it("excludes users who have blocked the viewer from search results", async () => {
    setTestUserId(VIEWER);
    // "Blocked" is the name of the user who blocked VIEWER
    const res = await request(app).get("/api/users/search?q=Blocked");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userIds = res.body.map((u: any) => u.userId);
    expect(userIds).not.toContain(BLOCKED);
  });

  it("still returns unblocked users in search results", async () => {
    setTestUserId(VIEWER);
    const res = await request(app).get("/api/users/search?q=Neutral");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userIds = res.body.map((u: any) => u.userId);
    expect(userIds).toContain(NEUTRAL);
  });

  it("from the blocker's perspective — viewer does not appear in search", async () => {
    setTestUserId(BLOCKER);
    const res = await request(app).get("/api/users/search?q=Viewer");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userIds = res.body.map((u: any) => u.userId);
    expect(userIds).not.toContain(VIEWER);
  });

  it("returns an empty array when the only match is blocked", async () => {
    setTestUserId(VIEWER);
    // Only BLOCKER's name starts with "Blocker" in our fixture set
    const res = await request(app).get("/api/users/search?q=Blocker");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userIds = res.body.map((u: any) => u.userId);
    expect(userIds).not.toContain(BLOCKER);
  });
});
