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
const BANNED   = "test-disc-banned";     // banned user — stories must not appear
const HIDDEN   = "test-disc-hidden";     // temporarily hidden user — public activity must not appear

const SHARED_MOOD = "Dreamy";

function makeDate(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 86_400_000);
}

// ── Seed IDs (tracked for cleanup) ───────────────────────────────────────────
let storyFriendId:     string;
let storyStrangerId:   string;
let storyPrivateId:    string;
let storyOwnId:        string;
let videoOwnId:        string;
let videoPrivateOwnId: string;
let storyOldId:        string;
let storyMoodMatchId:  string;
let storyBannedId:     string;
let storyHiddenId:     string;

beforeAll(async () => {
  // Characters
  await db.insert(characterTable).values([
    { userId: ME,       name: "Me",       mood: SHARED_MOOD, isPublic: true,  isBanned: false },
    { userId: FRIEND,   name: "Friend",   mood: "Hopeful",   isPublic: true,  isBanned: false },
    { userId: STRANGER, name: "Stranger", mood: "Hopeful",   isPublic: true,  isBanned: false },
    { userId: PRIVATE,  name: "Private",  mood: "Hopeful",   isPublic: false, isBanned: false },
    { userId: BANNED,   name: "Banned",   mood: "Hopeful",   isPublic: true,  isBanned: true  },
    { userId: HIDDEN,   name: "Hidden",   mood: "Hopeful",   isPublic: true,  isBanned: false, isHidden: true },
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

  // Own public story → visible in the author's Reels feed
  const [s4] = await db.insert(storiesTable).values({
    userId: ME, chapterTitle: "My own story", mood: SHARED_MOOD,
    isPublic: true, isHidden: false, date: makeDate(1), panels: [],
  }).returning({ id: storiesTable.id });
  storyOwnId = s4.id;

  const [ownVideo] = await db.insert(storiesTable).values({
    userId: ME, chapterTitle: "My public video", mood: SHARED_MOOD,
    isPublic: true, isHidden: false, date: new Date(), panels: [],
    contentType: "video", videoUri: "/api/videos/my-video.mp4",
    thumbnailUri: "/api/images/my-video.jpg",
  }).returning({ id: storiesTable.id });
  videoOwnId = ownVideo.id;

  const [privateOwnVideo] = await db.insert(storiesTable).values({
    userId: PRIVATE, chapterTitle: "Private profile public video", mood: "Hopeful",
    isPublic: true, isHidden: false, date: new Date(), panels: [],
    contentType: "video", videoUri: "/api/videos/private-owner-video.mp4",
    thumbnailUri: "/api/images/private-owner-video.jpg",
  }).returning({ id: storiesTable.id });
  videoPrivateOwnId = privateOwnVideo.id;

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

  // Story by a banned user → must NOT appear in the discover feed
  const [s7] = await db.insert(storiesTable).values({
    userId: BANNED, chapterTitle: "Banned user story", mood: "Hopeful",
    isPublic: true, isHidden: false, date: makeDate(1), panels: [],
  }).returning({ id: storiesTable.id });
  storyBannedId = s7.id;

  const [s8] = await db.insert(storiesTable).values({
    userId: HIDDEN, chapterTitle: "Hidden user story", mood: "Hopeful",
    isPublic: true, isHidden: false, date: makeDate(1), panels: [],
  }).returning({ id: storiesTable.id });
  storyHiddenId = s8.id;
});

afterAll(async () => {
  const storyIds = [storyFriendId, storyStrangerId, storyPrivateId, storyOwnId, videoOwnId, videoPrivateOwnId, storyOldId, storyMoodMatchId, storyBannedId, storyHiddenId]
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
    inArr2(characterTable.userId, [ME, FRIEND, STRANGER, PRIVATE, BANNED, HIDDEN]),
  );
});

describe("GET /api/discover", () => {
  it("returns a 200 with an array", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns JSON instead of a bodyless 304 for a matching prior ETag", async () => {
    setTestUserId(ME);
    const first = await request(app).get("/api/discover");
    expect(first.status).toBe(200);
    expect(first.headers.etag).toBeTruthy();

    const second = await request(app)
      .get("/api/discover")
      .set("If-None-Match", first.headers.etag);

    expect(second.status).toBe(200);
    expect(Array.isArray(second.body)).toBe(true);
    expect(second.body).toEqual(first.body);
    expect(second.headers.etag).not.toBe(first.headers.etag);
  });

  it("shows the requesting user's public stories and videos", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    const ownPosts = (res.body as {
      authorUserId: string;
      id: string;
      contentType?: string;
      videoUri?: string | null;
    }[]).filter(post => post.authorUserId === ME);
    expect(ownPosts.map(post => post.id)).toContain(videoOwnId);
    expect(ownPosts.map(post => post.id)).toContain(storyOwnId);
    const ownStory = ownPosts.find(post => post.id === storyOwnId);
    expect(ownStory).toMatchObject({ contentType: "story" });
    const ownVideo = ownPosts.find(post => post.id === videoOwnId);
    expect(ownVideo).toMatchObject({
      contentType: "video",
      videoUri: "/api/videos/my-video.mp4",
    });
  });

  it("excludes stories from private-profile users", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authorIds = res.body.map((p: any) => p.authorUserId);
    expect(authorIds).not.toContain(PRIVATE);
  });

  it("shows a private-profile owner their own public video without exposing it to others", async () => {
    setTestUserId(PRIVATE);
    const ownerResponse = await request(app).get("/api/discover");
    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body.map((post: { id: string }) => post.id)).toContain(videoPrivateOwnId);

    setTestUserId(ME);
    const otherResponse = await request(app).get("/api/discover");
    expect(otherResponse.status).toBe(200);
    expect(otherResponse.body.map((post: { id: string }) => post.id)).not.toContain(videoPrivateOwnId);
    expect(otherResponse.body.map((post: { id: string }) => post.id)).not.toContain(storyPrivateId);
  });

  it("includes public stories from other users", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = res.body.map((p: any) => p.id);
    expect(ids).toContain(storyFriendId);
    expect(ids).toContain(storyStrangerId);
  });

  it("ranks followed-author stories above unfollowed-author stories", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const friendIdx   = res.body.findIndex((p: any) => p.id === storyFriendId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const moodIdx    = res.body.findIndex((p: any) => p.id === storyMoodMatchId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strangerIdx = res.body.findIndex((p: any) => p.id === storyStrangerId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  it("excludes stories from banned users", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = res.body.map((p: any) => p.id);
    expect(ids).not.toContain(storyBannedId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authorIds = res.body.map((p: any) => p.authorUserId);
    expect(authorIds).not.toContain(BANNED);
  });

  it("excludes stories from temporarily hidden users", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = res.body.map((p: any) => p.id);
    expect(ids).not.toContain(storyHiddenId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authorIds = res.body.map((p: any) => p.authorUserId);
    expect(authorIds).not.toContain(HIDDEN);
  });

  it("hides a hidden user's public profile from others but keeps it available to its owner", async () => {
    setTestUserId(ME);
    expect((await request(app).get(`/api/users/${HIDDEN}`)).status).toBe(404);

    setTestUserId(HIDDEN);
    expect((await request(app).get(`/api/users/${HIDDEN}`)).status).toBe(200);
  });

  it("correctly marks followed authors with isFollowing: true", async () => {
    setTestUserId(ME);
    const res = await request(app).get("/api/discover");
    expect(res.status).toBe(200);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const friendPost = res.body.find((p: any) => p.id === storyFriendId);
    expect(friendPost).toBeDefined();
    expect(friendPost.isFollowing).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strangerPost = res.body.find((p: any) => p.id === storyStrangerId);
    expect(strangerPost).toBeDefined();
    expect(strangerPost.isFollowing).toBe(false);
  });

  it("clears non-followers' cached Discover stories when the owner makes one private", async () => {
    // ME has a cached feed containing STRANGER's public story, but does not
    // follow STRANGER. The owner's visibility change must invalidate it too.
    setTestUserId(ME);
    const before = await request(app).get("/api/discover");
    expect(before.body.map((post: { id: string }) => post.id)).toContain(storyStrangerId);

    setTestUserId(STRANGER);
    const update = await request(app)
      .patch(`/api/stories/${storyStrangerId}`)
      .send({ isPublic: false });
    expect(update.status).toBe(200);

    setTestUserId(ME);
    const after = await request(app).get("/api/discover");
    expect(after.status).toBe(200);
    expect(after.body.map((post: { id: string }) => post.id)).not.toContain(storyStrangerId);
  });
});
