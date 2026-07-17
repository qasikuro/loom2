import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, setTestUserId } from "./helpers/testApp";
import { db, characterTable, storiesTable, followsTable } from "@workspace/db";

const app = createTestApp();

// ── Fixture user IDs (prefixed to avoid collision with real data) ─────────────
const ME       = "test-disc-me";
const FRIEND   = "test-disc-friend";     // ME follows FRIEND
const STRANGER = "test-disc-stranger";
const PRIVATE  = "test-disc-private";    // private profile

const SHARED_MOOD = "Dreamy";

function makeDate(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 86_400_000);
}

// ── Seed IDs (tracked for cleanup) ───────────────────────────────────────────
let storyFriendId:     string;
let storyStrangerId:   string;
let storyPrivateId:    string;
let storyOwnId:        string;
let storyOldId:        string;
let storyMoodMatchId:  string;

beforeAll(async () => {
  // Characters
  await db.insert(characterTable).values([
    { userId: ME,       name: "Me",       mood: SHARED_MOOD, isPublic: true,  isBanned: false },
    { userId: FRIEND,   name: "Friend",   mood: "Hopeful",   isPublic: true,  isBanned: false },
    { userId: STRANGER, name: "Stranger", mood: "Hopeful",   isPublic: true,  isBanned: false },
    { userId: PRIVATE,  name: "Private",  mood: "Hopeful",   isPublic: false, isBanned: false },
  ]).onConflictDoNothing();

  // ME follows FRIEND
  await db.insert(followsTable).values({ followerId: ME, followingId: FRIEND }).onConflictDoNothing();

  // Stories
  const [s1] = await db.insert(storiesTable).values({
    userId: FRIEND, chapterTitle: "Friend story", mood: "Hopeful",
    isPublic: true, isHidden: false, date: makeDate(1), panels: [],
  }).returning({ id: storiesTable.id });
  storyFriendId = s1.id;

  const [s2] = await db.insert(storiesTable).values({
    userId: STRANGER, chapterTitle: "Stranger story", mood: "Hopeful",
    isPublic: true, isHidden: false, date: makeDate(2), panels: [],
  }).returning({ id: storiesTable.id });
  storyStrangerId = s2.id;

  // Story by private-profile user → should NOT appear
  const [s3] = await db.insert(storiesTable).values({
    userId: PRIVATE, chapterTitle: "Private story", mood: "Hopeful",
    isPublic: true, isHidden: false, date: makeDate(1), panels: [],
  }).returning({ id: storiesTable.id });
  storyPrivateId = s3.id;

  // Own story → should NOT appear
  const [s4] = await db.insert(storiesTable).values({
    userId: ME, chapterTitle: "My own story", mood: SHARED_MOOD,
    isPublic: true, isHidden: false, date: makeDate(1), panels: [],
  }).returning({ id: storiesTable.id });
  storyOwnId = s4.id;

  // Old story (35 days ago) → lower recency score
  const [s5] = await db.insert(storiesTable).values({
    userId: STRANGER, chapterTitle: "Old story", mood: "Hopeful",
    isPublic: true, isHidden: false, date: makeDate(35), panels: [],
  }).returning({ id: storiesTable.id });
  storyOldId = s5.id;

  // Mood-matching story by stranger → higher mood score, no follow bonus
  const [s6] = await db.insert(storiesTable).values({
    userId: STRANGER, chapterTitle: "Mood match story", mood: SHARED_MOOD,
    isPublic: true, isHidden: false, date: makeDate(3), panels: [],
  }).returning({ id: storiesTable.id });
  storyMoodMatchId = s6.id;
});

afterAll(async () => {
  const storyIds = [storyFriendId, storyStrangerId, storyPrivateId, storyOwnId, storyOldId, storyMoodMatchId]
    .filter(Boolean);

  if (storyIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    await db.delete(storiesTable).where(inArray(storiesTable.id, storyIds));
  }

  const { eq, and } = await import("drizzle-orm");
  await db.delete(followsTable).where(
    and(eq(followsTable.followerId, ME), eq(followsTable.followingId, FRIEND)),
  );

  const { inArray: inArr2 } = await import("drizzle-orm");
  await db.delete(characterTable).where(
    inArr2(characterTable.userId, [ME, FRIEND, STRANGER, PRIVATE]),
  );
});

describe("GET /api/discover", () => {
  it("returns a 200 with an array", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("excludes the requesting user's own stories", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    const authorIds = res.body.map((p: any) => p.authorUserId);
    expect(authorIds).not.toContain(ME);
  });

  it("excludes stories from private-profile users", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    const authorIds = res.body.map((p: any) => p.authorUserId);
    expect(authorIds).not.toContain(PRIVATE);
  });

  it("includes public stories from other users", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain(storyFriendId);
    expect(ids).toContain(storyStrangerId);
  });

  it("ranks followed-author stories above unfollowed-author stories", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);

    const friendIdx   = res.body.findIndex((p: any) => p.id === storyFriendId);
    const strangerIdx = res.body.findIndex((p: any) => p.id === storyStrangerId);

    // Both should appear
    expect(friendIdx).toBeGreaterThanOrEqual(0);
    expect(strangerIdx).toBeGreaterThanOrEqual(0);
    // Friend (followed) ranked above stranger (not followed, not mood-matched)
    expect(friendIdx).toBeLessThan(strangerIdx);
  });

  it("ranks mood-matched stories above non-matching unfollowed stories", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);

    const moodIdx    = res.body.findIndex((p: any) => p.id === storyMoodMatchId);
    const strangerIdx = res.body.findIndex((p: any) => p.id === storyStrangerId);

    expect(moodIdx).toBeGreaterThanOrEqual(0);
    expect(strangerIdx).toBeGreaterThanOrEqual(0);
    // Mood-match story should rank above non-matching stranger story of similar age
    expect(moodIdx).toBeLessThan(strangerIdx);
  });

  it("ranks fresh stories above old stories with same engagement", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);

    const strangerIdx = res.body.findIndex((p: any) => p.id === storyStrangerId);
    const oldIdx      = res.body.findIndex((p: any) => p.id === storyOldId);

    // Both should be present (old story is 35 days old — recency bonus = 0)
    expect(strangerIdx).toBeGreaterThanOrEqual(0);
    expect(oldIdx).toBeGreaterThanOrEqual(0);
    expect(strangerIdx).toBeLessThan(oldIdx);
  });

  it("each item has the expected shape", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);

    for (const post of res.body) {
      expect(post).toHaveProperty("id");
      expect(post).toHaveProperty("authorUserId");
      expect(post).toHaveProperty("chapterTitle");
      expect(post).toHaveProperty("mood");
      expect(post).toHaveProperty("witnessedCount");
      expect(post).toHaveProperty("savedCount");
      expect(post).toHaveProperty("date");
      expect(Array.isArray(post.panels)).toBe(true);
      expect(typeof post.isFollowing).toBe("boolean");
    }
  });

  it("correctly marks followed authors with isFollowing: true", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);

    const friendPost = res.body.find((p: any) => p.id === storyFriendId);
    expect(friendPost).toBeDefined();
    expect(friendPost.isFollowing).toBe(true);

    const strangerPost = res.body.find((p: any) => p.id === storyStrangerId);
    expect(strangerPost).toBeDefined();
    expect(strangerPost.isFollowing).toBe(false);
  });
});
