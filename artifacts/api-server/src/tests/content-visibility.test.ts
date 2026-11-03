import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq, inArray, or, and } from "drizzle-orm";
import { db, characterTable, followsTable, blocksTable, storiesTable, storySavesTable, outfitsTable, booksTable, chaptersTable, guideTutorialsTable } from "@workspace/db";
import { createTestApp, setTestUserId } from "./helpers/testApp";
import visibilityRouter from "../routes/content-visibility";
import storiesRouter from "../routes/stories";
import outfitsRouter from "../routes/outfits";
import bookReaderRouter from "../routes/book-reader";
import tutorialsRouter from "../routes/guide-tutorials";
import { canReadFriendsMedia, isPubliclyReadableMedia, canReadGuideTutorialMedia } from "../lib/mediaAccess";

const prefix = `privacy-${randomUUID()}`;
const owner = `${prefix}-owner`;
const friend = `${prefix}-friend`;
const stranger = `${prefix}-stranger`;
const follower = `${prefix}-follower`;
const users = [owner, friend, stranger, follower];
const videoId = randomUUID();
const hiddenId = randomUUID();
const outfitId = randomUUID();
const bookId = randomUUID();
const chapterId = randomUUID();
const tutorialId = randomUUID();
const videoPath = `/api/videos/${prefix}.mp4`;
const photoPath = `/api/images/${prefix}.png`;
const secretPath = `/api/images/${prefix}-secret.png`;
const tutorialPath = `/api/images/${prefix}-tutorial.png`;
const app = createTestApp();
app.use((req, _res, next) => { req.log = { error: console.error } as typeof req.log; next(); });
app.use("/api", visibilityRouter, storiesRouter, outfitsRouter, bookReaderRouter, tutorialsRouter);

beforeAll(async () => {
  await db.insert(characterTable).values(users.map(userId => ({ userId, name: "Privacy fixture", isPublic: userId !== owner })));
  await db.insert(followsTable).values([
    { followerId: owner, followingId: friend }, { followerId: friend, followingId: owner },
    { followerId: follower, followingId: owner },
  ]);
  await db.insert(storiesTable).values([
    { id: videoId, userId: owner, chapterTitle: "A friend's video", mood: "Hopeful", date: new Date(),
      isPublic: false, visibility: "friends", contentType: "video", videoUri: videoPath, thumbnailUri: photoPath, panels: [] },
    { id: hiddenId, userId: owner, chapterTitle: "Owner only", mood: "Hopeful", date: new Date(),
      isPublic: false, panels: [{ id: "secret", text: "Secret", imageUri: secretPath }] },
  ]);
  await db.insert(outfitsTable).values({ id: outfitId, userId: owner, name: "Friends outfit", date: new Date(), visibility: "friends" });
  await db.insert(booksTable).values({ id: bookId, userId: owner, title: "Friends book", visibility: "friends" });
  await db.insert(chaptersTable).values({ id: chapterId, bookId, title: "Chapter", orderIndex: 0, status: "published", pages: [] });
  await db.insert(guideTutorialsTable).values({
    id: tutorialId, guideId: owner, title: "Friends tutorial", description: "Fixture",
    status: "published", visibility: "friends", steps: [{ id: "step", type: "image", title: "Step", body: "", mediaUri: tutorialPath }],
  });
});

afterAll(async () => {
  await db.delete(storySavesTable).where(inArray(storySavesTable.userId, users));
  await db.delete(blocksTable).where(or(inArray(blocksTable.blockerId, users), inArray(blocksTable.blockedId, users)));
  await db.delete(followsTable).where(or(inArray(followsTable.followerId, users), inArray(followsTable.followingId, users)));
  await db.delete(chaptersTable).where(eq(chaptersTable.bookId, bookId));
  await db.delete(booksTable).where(eq(booksTable.id, bookId));
  await db.delete(guideTutorialsTable).where(eq(guideTutorialsTable.id, tutorialId));
  await db.delete(storiesTable).where(eq(storiesTable.userId, owner));
  await db.delete(outfitsTable).where(eq(outfitsTable.userId, owner));
  await db.delete(characterTable).where(inArray(characterTable.userId, users));
});

describe("Profile and post audience boundaries", () => {
  it("applies current audiences to saved posts instead of preserving access from an old save", async () => {
    await db.insert(storySavesTable).values([
      { userId: friend, storyId: videoId }, { userId: friend, storyId: hiddenId },
    ]);
    setTestUserId(friend);
    const before = await request(app).get("/api/stories/saved");
    expect(before.status).toBe(200);
    expect(before.body.map((post: { id: string }) => post.id)).toEqual([videoId]);
    expect(before.body[0].contentType).toBe("video");
    expect(before.body[0].videoUri).toContain(videoPath);
    setTestUserId(owner);
    await request(app).patch(`/api/my-posts/story/${videoId}/visibility`).send({ visibility: "private" }).expect(200);
    setTestUserId(friend);
    const after = await request(app).get("/api/stories/saved").expect(200);
    expect(after.body).toEqual([]);
    setTestUserId(owner);
    await request(app).patch(`/api/my-posts/story/${videoId}/visibility`).send({ visibility: "friends" }).expect(200);
  });

  it("preserves the friends audience when an older editor resends isPublic false", async () => {
    setTestUserId(owner);
    await request(app).patch(`/api/stories/${videoId}`).send({ isPublic: false }).expect(200);
    await request(app).patch(`/api/outfits/${outfitId}`).send({ isPublic: false }).expect(200);
    const result = await request(app).get("/api/my-posts/visibility").expect(200);
    for (const id of [videoId, outfitId]) {
      expect(result.body.find((post: { id: string }) => post.id === id)?.visibility).toBe("friends");
    }
  });

  it("opens a private profile for its owner and reciprocal friend, not a stranger or one-way follower", async () => {
    for (const viewer of [owner, friend]) {
      setTestUserId(viewer);
      expect((await request(app).get(`/api/users/${owner}`)).status).toBe(200);
    }
    for (const viewer of [stranger, follower]) {
      setTestUserId(viewer);
      const result = await request(app).get(`/api/users/${owner}`);
      expect(result.status).toBe(403);
      expect(result.body.code).toBe("PROFILE_PRIVATE");
    }
  });

  it("returns video fields separately from stories and keeps legacy private stories owner-only", async () => {
    setTestUserId(friend);
    const videos = await request(app).get(`/api/users/${owner}/stories?type=video`);
    expect(videos.status).toBe(200);
    expect(videos.body).toHaveLength(1);
    expect(videos.body[0]).toMatchObject({ id: videoId, contentType: "video" });
    expect(videos.body[0].videoUri).toContain(videoPath);
    expect(videos.body[0].thumbnailUri).toContain(photoPath);
    expect((await request(app).get(`/api/users/${owner}/stories`)).body).toEqual([]);
    setTestUserId(owner);
    expect((await request(app).get(`/api/users/${owner}/stories`)).body.map((r: { id: string }) => r.id)).toContain(hiddenId);
  });

  it("enforces friends-only direct content access and reader-bound media", async () => {
    setTestUserId(friend);
    expect((await request(app).get(`/api/stories/${videoId}`)).status).toBe(200);
    expect((await request(app).get(`/api/stories/${hiddenId}`)).status).toBe(404);
    expect((await request(app).get(`/api/users/${owner}/outfits`)).body.map((r: { id: string }) => r.id)).toContain(outfitId);
    expect((await request(app).get(`/api/books/${bookId}/public`)).status).toBe(200);
    expect((await request(app).get(`/api/chapters/${chapterId}/read`)).status).toBe(200);
    expect((await request(app).get(`/api/guide-tutorials/${tutorialId}`)).status).toBe(200);
    expect(await canReadFriendsMedia(videoPath, friend, owner)).toBe(true);
    expect(await canReadFriendsMedia(secretPath, friend, owner)).toBe(false);
    expect(await canReadGuideTutorialMedia(tutorialPath, friend, owner)).toBe(true);
    expect(await isPubliclyReadableMedia(videoPath, owner)).toBe(false);
    for (const viewer of [stranger, follower]) {
      setTestUserId(viewer);
      expect((await request(app).get(`/api/stories/${videoId}`)).status).toBe(404);
      expect((await request(app).get(`/api/books/${bookId}/public`)).status).toBe(404);
      expect((await request(app).get(`/api/guide-tutorials/${tutorialId}`)).status).toBe(404);
      expect(await canReadFriendsMedia(videoPath, viewer, owner)).toBe(false);
    }
  });

  it("only lets authors change each supported content type and preserves owner-only originals", async () => {
    const posts = [["story", videoId], ["outfit", outfitId], ["book", bookId], ["tutorial", tutorialId]];
    setTestUserId(owner);
    const list = await request(app).get("/api/my-posts/visibility");
    expect(list.status).toBe(200);
    expect(list.body.find((r: { id: string }) => r.id === hiddenId).visibility).toBe("private");
    for (const [kind, id] of posts) {
      setTestUserId(stranger);
      expect((await request(app).patch(`/api/my-posts/${kind}/${id}/visibility`).send({ visibility: "public" })).status).toBe(404);
      setTestUserId(owner);
      expect((await request(app).patch(`/api/my-posts/${kind}/${id}/visibility`).send({ visibility: "private" })).status).toBe(200);
    }
    setTestUserId(friend);
    expect((await request(app).get(`/api/stories/${videoId}`)).status).toBe(404);
    expect((await request(app).get(`/api/users/${owner}/outfits`)).body).toEqual([]);
    expect((await request(app).get(`/api/books/${bookId}/public`)).status).toBe(404);
    expect((await request(app).get(`/api/guide-tutorials/${tutorialId}`)).status).toBe(404);
    expect(await canReadFriendsMedia(videoPath, friend, owner)).toBe(false);
    setTestUserId(owner);
    for (const [kind, id] of posts) {
      expect((await request(app).patch(`/api/my-posts/${kind}/${id}/visibility`).send({ visibility: "friends" })).status).toBe(200);
    }
  });

  it("revokes friends-only access after blocking or removing a reciprocal connection", async () => {
    await db.insert(blocksTable).values({ blockerId: owner, blockedId: friend });
    setTestUserId(friend);
    expect((await request(app).get(`/api/users/${owner}`)).status).toBe(403);
    expect((await request(app).get(`/api/stories/${videoId}`)).status).toBe(404);
    expect(await canReadFriendsMedia(videoPath, friend, owner)).toBe(false);
    await db.delete(blocksTable).where(and(eq(blocksTable.blockerId, owner), eq(blocksTable.blockedId, friend)));
    await db.delete(followsTable).where(and(eq(followsTable.followerId, owner), eq(followsTable.followingId, friend)));
    expect((await request(app).get(`/api/users/${owner}`)).status).toBe(403);
    expect(await canReadFriendsMedia(videoPath, friend, owner)).toBe(false);
    expect(await canReadGuideTutorialMedia(tutorialPath, friend, owner)).toBe(false);
  });
});
