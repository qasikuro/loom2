import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db, characterTable, storiesTable, booksTable, chaptersTable } from "@workspace/db";
import { createTestApp, setTestUserId } from "./helpers/testApp";
import storiesRouter from "../routes/stories";

const app = createTestApp();
app.use("/api", storiesRouter);
const prefix = `test-reel-media-${randomUUID()}`;
const viewer = `${prefix}-viewer`;
const author = `${prefix}-author`;
const oldHost = "https://obsolete-reel-workspace.pike.replit.dev";
const external = "https://cdn.example.com/api/images/external.jpg";
const storyIds: string[] = [];
let storyId: string;
let videoId: string;
let externalId: string;
let bookId: string;
let chapterId: string;
type Post = {
  id: string;
  authorAvatarUri: string | null;
  imageUri: string | null;
  panels: { text: string; imageUri: string | null }[];
  pages?: { id: string; panels: { imageUri?: string }[] }[];
  videoUri?: string | null;
  thumbnailUri?: string | null;
};

beforeAll(async () => {
  await db.insert(characterTable).values([
    { userId: viewer, name: "Viewer", mood: "Hopeful", isPublic: true },
    { userId: author, name: "Author", mood: "Hopeful", isPublic: true,
      avatarUri: `${oldHost}/api/images/avatar.jpg?ticket=expired` },
  ]);
  const [story] = await db.insert(storiesTable).values({
    userId: author, chapterTitle: "Story with text before its photo",
    mood: "Hopeful", isPublic: true, date: new Date(),
    panels: [{ id: "opening-text", text: "Opening text" }, { id: "story-photo", text: "Photo", imageUri: `${oldHost}/api/images/story.jpg` }],
    pages: [{ id: "story-page", layoutKey: "solo", panels: [
      { id: "panel", text: "Page photo", imageUri: `${oldHost}/api/images/nested.jpg` },
    ] }],
  }).returning();
  storyId = story.id;
  storyIds.push(storyId);
  const [video] = await db.insert(storiesTable).values({
    userId: author, chapterTitle: "Video reel", mood: "Hopeful", isPublic: true,
    date: new Date(), contentType: "video",
    videoUri: `${oldHost}/api/videos/clip.mp4?ticket=expired`,
    thumbnailUri: `${oldHost}/api/images/thumbnail.jpg`,
  }).returning();
  videoId = video.id;
  storyIds.push(videoId);
  const [externalStory] = await db.insert(storiesTable).values({
    userId: author, chapterTitle: "External photo", mood: "Hopeful",
    isPublic: true, date: new Date(), panels: [{ id: "external-photo", text: "External", imageUri: external }],
  }).returning();
  externalId = externalStory.id;
  storyIds.push(externalId);
  const [book] = await db.insert(booksTable).values({
    userId: author, title: "Reel media fixture", visibility: "public",
  }).returning();
  bookId = book.id;
  const [chapter] = await db.insert(chaptersTable).values({
    bookId, title: "Chapter with photo after opening page",
    status: "published", publishedAt: new Date(), pageCount: 2,
    pages: [
      { id: "opening", layoutKey: "solo", panels: [{ id: "text", text: "Opening text" }] },
      { id: "photo", layoutKey: "solo", panels: [
        { id: "photo-panel", text: "Photo", imageUri: `${oldHost}/api/images/chapter.jpg` },
      ] },
    ],
  }).returning();
  chapterId = chapter.id;
});

afterAll(async () => {
  if (chapterId) await db.delete(chaptersTable).where(eq(chaptersTable.id, chapterId));
  if (bookId) await db.delete(booksTable).where(eq(booksTable.id, bookId));
  if (storyIds.length) await db.delete(storiesTable).where(inArray(storiesTable.id, storyIds));
  await db.delete(characterTable).where(inArray(characterTable.userId, [viewer, author]));
});

async function feed(): Promise<Post[]> {
  setTestUserId(viewer);
  const response = await request(app).get("/api/discover");
  expect(response.status).toBe(200);
  return response.body;
}

describe("Reels media response", () => {
  it("returns canonical author avatars for both stories and book chapters", async () => {
    const posts = await feed();
    expect(posts.find(post => post.id === storyId)?.authorAvatarUri).toBe("/api/images/avatar.jpg");
    expect(posts.find(post => post.id === chapterId)?.authorAvatarUri).toBe("/api/images/avatar.jpg");
  });

  it("selects a later story image and normalizes nested page media", async () => {
    const post = (await feed()).find(item => item.id === storyId);
    expect(post?.imageUri).toBe("/api/images/story.jpg");
    expect(post?.panels[0]).toMatchObject({ text: "Opening text", imageUri: null });
    expect(post?.panels[1].imageUri).toBe("/api/images/story.jpg");
    expect(post?.pages?.[0].panels[0].imageUri).toBe("/api/images/nested.jpg");
  });

  it("uses the first available chapter photo even when its opening page is text-only", async () => {
    const post = (await feed()).find(item => item.id === chapterId);
    expect(post?.imageUri).toBe("/api/images/chapter.jpg");
    expect(post?.panels[0]).toMatchObject({ text: "Opening text", imageUri: null });
  });

  it("normalizes video and thumbnail links without copying expired tickets", async () => {
    const post = (await feed()).find(item => item.id === videoId);
    expect(post?.videoUri).toBe("/api/videos/clip.mp4");
    expect(post?.thumbnailUri).toBe("/api/images/thumbnail.jpg");
  });

  it("leaves unrelated external images unchanged", async () => {
    const post = (await feed()).find(item => item.id === externalId);
    expect(post?.imageUri).toBe(external);
    expect(post?.panels[0].imageUri).toBe(external);
  });

  it("normalizes legacy links returned by a public story profile", async () => {
    setTestUserId(viewer);
    const response = await request(app).get(`/api/users/${author}/stories`);
    expect(response.status).toBe(200);
    const post = (response.body as Post[]).find(item => item.id === storyId);
    expect(post?.panels[1].imageUri).toBe("/api/images/story.jpg");
    expect(post?.pages?.[0].panels[0].imageUri).toBe("/api/images/nested.jpg");
  });

  it("normalizes legacy links returned by an individual public story", async () => {
    setTestUserId(viewer);
    const response = await request(app).get(`/api/stories/${storyId}`);
    expect(response.status).toBe(200);
    expect(response.body.panels[1].imageUri).toBe("/api/images/story.jpg");
    expect(response.body.pages[0].panels[0].imageUri).toBe("/api/images/nested.jpg");
  });
});