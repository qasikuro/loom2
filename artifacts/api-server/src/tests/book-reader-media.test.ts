import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { db, booksTable, chaptersTable, characterTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createTestApp, setTestUserId } from "./helpers/testApp";
import bookReaderRouter from "../routes/book-reader";

const app = createTestApp();
app.use("/api", bookReaderRouter);
const authorId = `test-book-media-${randomUUID()}`;
const bookId = randomUUID();
const chapterId = randomUUID();
const oldHost = "https://obsolete-book-workspace.pike.replit.dev";
const chapterPages = [
  { id: "opening", layoutKey: "solo", panels: [{ id: "text", text: "Opening text" }] },
  { id: "page-photo", layoutKey: "solo", panels: [
    { id: "photo", text: "Page photo", imageUri: `${oldHost}/api/images/chapter.jpg?ticket=expired` },
  ] },
];

beforeAll(async () => {
  await db.insert(characterTable).values({
    userId: authorId, name: "Book author", mood: "Hopeful", isPublic: true,
    avatarUri: `${oldHost}/api/images/author.jpg?ticket=expired`,
  });
  await db.insert(booksTable).values({
    id: bookId, userId: authorId, title: "Media normalization fixture",
    visibility: "public", coverImageUri: `${oldHost}/api/images/cover.jpg?ticket=expired`,
  });
  await db.insert(chaptersTable).values({
    id: chapterId, bookId, title: "Chapter", status: "published",
    publishedAt: new Date(), pageCount: 2, pages: chapterPages,
  });
});

afterAll(async () => {
  await db.delete(chaptersTable).where(eq(chaptersTable.id, chapterId));
  await db.delete(booksTable).where(eq(booksTable.id, bookId));
  await db.delete(characterTable).where(eq(characterTable.userId, authorId));
});

describe("public book media references", () => {
  it("normalizes book covers and author avatars in each public book listing", async () => {
    setTestUserId("test-book-media-viewer");
    const listings = await Promise.all([
      request(app).get("/api/public-books"),
      request(app).get(`/api/users/${authorId}/books`),
      request(app).get(`/api/books/${bookId}/public`),
    ]);
    for (const response of listings) expect(response.status).toBe(200);

    const publicCard = (listings[0]!.body as Array<Record<string, string | null>>).find(
      row => row.id === bookId,
    );
    const authorBooks = listings[1]!.body as Array<Record<string, string | null>>;
    const publicDetail = listings[2]!.body as Record<string, string | null>;

    expect(publicCard?.coverImageUri).toBe("/api/images/cover.jpg");
    expect(publicCard?.authorAvatarUri).toBe("/api/images/author.jpg");
    expect(authorBooks[0]?.coverImageUri?.split("?")[0]).toBe("/api/images/cover.jpg");
    expect(publicDetail.coverImageUri?.split("?")[0]).toBe("/api/images/cover.jpg");
    expect(publicDetail.authorAvatarUri?.split("?")[0]).toBe("/api/images/author.jpg");
  });

  it("normalizes historical links inside the public chapter reader's nested panels", async () => {
    const response = await request(app).get(`/api/chapters/${chapterId}/read`);
    expect(response.status).toBe(200);
    expect(response.body.pages[0].panels[0].text).toBe("Opening text");
    expect(response.body.pages[1].panels[0].imageUri.split("?")[0]).toBe("/api/images/chapter.jpg");
  });
});