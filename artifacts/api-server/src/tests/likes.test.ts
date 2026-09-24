import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { db, runStartupMigrations, characterTable, blocksTable, booksTable, chaptersTable, chapterLikesTable, profileLikesTable, storyLikesTable, storiesTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { createTestApp, setTestUserId } from "./helpers/testApp";

const app = createTestApp();
const VIEWER = "test-likes-viewer";
const AUTHOR = "test-likes-author";
const PRIVATE = "test-likes-private";
let publicStoryId: string;
let privateStoryId: string;
let hiddenStoryId: string;
let bookId: string;
let privateBookId: string;
let publicChapterId: string;
let draftChapterId: string;
let privateBookChapterId: string;

beforeAll(async () => {
  await runStartupMigrations();
  await db.insert(characterTable).values([
    { userId: VIEWER, name: "Like viewer", isPublic: true, isBanned: false },
    { userId: AUTHOR, name: "Like author", isPublic: true, isBanned: false },
    { userId: PRIVATE, name: "Private author", isPublic: false, isBanned: false },
  ]).onConflictDoNothing();

  const created = await db.insert(storiesTable).values([
    { userId: AUTHOR, chapterTitle: "Likeable story", mood: "Hopeful", isPublic: true, isHidden: false, date: new Date(), panels: [] },
    { userId: PRIVATE, chapterTitle: "Private story", mood: "Hopeful", isPublic: true, isHidden: false, date: new Date(), panels: [] },
    { userId: AUTHOR, chapterTitle: "Hidden story", mood: "Hopeful", isPublic: true, isHidden: true, date: new Date(), panels: [] },
  ]).returning({ id: storiesTable.id });
  [publicStoryId, privateStoryId, hiddenStoryId] = created.map(row => row.id);

  const [book] = await db.insert(booksTable).values({
    userId: AUTHOR,
    title: "Likeable book",
    visibility: "public",
  }).returning({ id: booksTable.id });
  bookId = book.id;
  const createdChapters = await db.insert(chaptersTable).values([
    { bookId, title: "Published chapter", status: "published", publishedAt: new Date(), pages: [] },
    { bookId, title: "Draft chapter", status: "draft", pages: [] },
  ]).returning({ id: chaptersTable.id });
  [publicChapterId, draftChapterId] = createdChapters.map(row => row.id);
  const [privateBook] = await db.insert(booksTable).values({
    userId: AUTHOR,
    title: "Private book",
    visibility: "private",
  }).returning({ id: booksTable.id });
  privateBookId = privateBook.id;
  const [privateChapter] = await db.insert(chaptersTable).values({
    bookId: privateBookId,
    title: "Private book chapter",
    status: "published",
    publishedAt: new Date(),
    pages: [],
  }).returning({ id: chaptersTable.id });
  privateBookChapterId = privateChapter.id;
});

afterAll(async () => {
  await db.delete(blocksTable).where(
    and(eq(blocksTable.blockerId, VIEWER), eq(blocksTable.blockedId, AUTHOR)),
  );
  const storyIds = [publicStoryId, privateStoryId, hiddenStoryId].filter(Boolean);
  if (storyIds.length) {
    await db.delete(storyLikesTable).where(inArray(storyLikesTable.storyId, storyIds));
    await db.delete(storiesTable).where(inArray(storiesTable.id, storyIds));
  }
  const chapterIds = [publicChapterId, draftChapterId, privateBookChapterId].filter(Boolean);
  if (chapterIds.length) {
    await db.delete(chapterLikesTable).where(inArray(chapterLikesTable.chapterId, chapterIds));
    await db.delete(chaptersTable).where(inArray(chaptersTable.id, chapterIds));
  }
  if (bookId) await db.delete(booksTable).where(eq(booksTable.id, bookId));
  if (privateBookId) await db.delete(booksTable).where(eq(booksTable.id, privateBookId));
  await db.delete(profileLikesTable).where(
    and(
      eq(profileLikesTable.likerId, VIEWER),
      eq(profileLikesTable.profileUserId, AUTHOR),
    ),
  );
  await db.delete(characterTable).where(inArray(characterTable.userId, [VIEWER, AUTHOR, PRIVATE]));
});

describe("profile likes", () => {
  it("are persistent, idempotent, and returned on the public profile", async () => {
    setTestUserId(VIEWER);
    const first = await request(app).post(`/api/users/${AUTHOR}/like`);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ profileLiked: true, profileLikeCount: 1 });

    const repeated = await request(app).post(`/api/users/${AUTHOR}/like`);
    expect(repeated.body).toEqual({ profileLiked: true, profileLikeCount: 1 });

    const profile = await request(app).get(`/api/users/${AUTHOR}`);
    expect(profile.body.profileLiked).toBe(true);
    expect(profile.body.profileLikeCount).toBe(1);

    const removed = await request(app).delete(`/api/users/${AUTHOR}/like`);
    expect(removed.body).toEqual({ profileLiked: false, profileLikeCount: 0 });
    const repeatedRemoval = await request(app).delete(`/api/users/${AUTHOR}/like`);
    expect(repeatedRemoval.body).toEqual({ profileLiked: false, profileLikeCount: 0 });
  });

  it("rejects self-likes and likes of private profiles", async () => {
    setTestUserId(VIEWER);
    expect((await request(app).post(`/api/users/${VIEWER}/like`)).status).toBe(400);
    expect((await request(app).post(`/api/users/${PRIVATE}/like`)).status).toBe(404);
  });

  it("rejects likes when either user has blocked the other", async () => {
    setTestUserId(VIEWER);
    await db.insert(blocksTable).values({ blockerId: VIEWER, blockedId: AUTHOR });
    expect((await request(app).post(`/api/users/${AUTHOR}/like`)).status).toBe(403);
    expect((await request(app).post(`/api/stories/${publicStoryId}/like`)).status).toBe(403);
    expect((await request(app).post(`/api/chapters/${publicChapterId}/like`)).status).toBe(403);
    await db.delete(blocksTable).where(
      and(eq(blocksTable.blockerId, VIEWER), eq(blocksTable.blockedId, AUTHOR)),
    );
  });
});

describe("book chapter likes", () => {
  it("are idempotent and expose viewer state and count in discover", async () => {
    setTestUserId(VIEWER);
    const first = await request(app).post(`/api/chapters/${publicChapterId}/like`);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ liked: true, likeCount: 1 });
    expect((await request(app).post(`/api/chapters/${publicChapterId}/like`)).body)
      .toEqual({ liked: true, likeCount: 1 });

    const feed = await request(app).get("/api/discover");
    const chapter = feed.body.find((item: { id: string }) => item.id === publicChapterId);
    expect(chapter).toMatchObject({ bookId, liked: true, likeCount: 1 });

    expect((await request(app).delete(`/api/chapters/${publicChapterId}/like`)).body)
      .toEqual({ liked: false, likeCount: 0 });
    expect((await request(app).delete(`/api/chapters/${publicChapterId}/like`)).body)
      .toEqual({ liked: false, likeCount: 0 });
  });

  it("rejects unpublished chapters and chapters in private books", async () => {
    setTestUserId(VIEWER);
    expect((await request(app).post(`/api/chapters/${draftChapterId}/like`)).status).toBe(404);
    expect((await request(app).post(`/api/chapters/${privateBookChapterId}/like`)).status).toBe(404);
  });
});

describe("story likes", () => {
  it("updates counts once and exposes viewer state in discover", async () => {
    setTestUserId(VIEWER);
    const first = await request(app).post(`/api/stories/${publicStoryId}/like`);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ liked: true, likeCount: 1 });
    expect((await request(app).post(`/api/stories/${publicStoryId}/like`)).body)
      .toEqual({ liked: true, likeCount: 1 });

    const feed = await request(app).get("/api/discover");
    const post = feed.body.find((item: { id: string }) => item.id === publicStoryId);
    expect(post).toMatchObject({ liked: true, likeCount: 1 });

    expect((await request(app).delete(`/api/stories/${publicStoryId}/like`)).body)
      .toEqual({ liked: false, likeCount: 0 });
    expect((await request(app).delete(`/api/stories/${publicStoryId}/like`)).body)
      .toEqual({ liked: false, likeCount: 0 });
  });

  it("does not allow likes on private-author or hidden stories", async () => {
    setTestUserId(VIEWER);
    expect((await request(app).post(`/api/stories/${privateStoryId}/like`)).status).toBe(404);
    expect((await request(app).post(`/api/stories/${hiddenStoryId}/like`)).status).toBe(404);
  });
});