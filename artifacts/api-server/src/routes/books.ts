/**
 * Books & Chapters API
 *
 * Books are the top-level long-form publishing container for Story Studio.
 * Each book has ordered chapters; each chapter stores its pages as JSONB.
 *
 * Routes:
 *   GET    /books                    — list authenticated user's books
 *   POST   /books                    — create a book
 *   GET    /books/:id                — get a single book (with chapter count)
 *   PATCH  /books/:id                — update book metadata
 *   DELETE /books/:id                — delete a book and all its chapters
 *   GET    /books/:id/chapters       — list chapters for a book (ordered)
 *   POST   /books/:id/chapters       — create a chapter
 *   GET    /chapters/:id             — get a single chapter (includes pages JSONB)
 *   PATCH  /chapters/:id             — update chapter (title, status, pages, orderIndex, …)
 *   DELETE /chapters/:id             — delete a chapter
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { db, booksTable, chaptersTable } from "@workspace/db";
import { requireAuth, getUserId } from "../middleware/auth";

const router: IRouter = Router();

// ── Zod schemas ───────────────────────────────────────────────────────────────

const BookInputSchema = z.object({
  title:         z.string().min(1).max(200),
  subtitle:      z.string().max(300).default(""),
  seriesType:    z.enum(["standalone", "series", "oneshot"]).default("standalone"),
  genre:         z.array(z.string()).default([]),
  language:      z.string().default("English"),
  ageRating:     z.string().default("All Ages"),
  visibility:    z.enum(["public", "private"]).default("public"),
  coverImageUri: z.string().url().nullish(),
});

const ChapterInputSchema = z.object({
  title:      z.string().min(1).max(300),
  orderIndex: z.number().int().min(0).optional(),
  status:     z.enum(["draft", "published"]).optional(),
  publishedAt: z.string().nullish(),
  pageCount:  z.number().int().min(0).optional(),
  pages:      z.array(z.unknown()).optional(),
});

// ── Books ─────────────────────────────────────────────────────────────────────

/** GET /books — list the authenticated user's books with chapter counts */
router.get("/books", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select({
        book:         booksTable,
        chapterCount: count(chaptersTable.id),
      })
      .from(booksTable)
      .leftJoin(chaptersTable, eq(chaptersTable.bookId, booksTable.id))
      .where(eq(booksTable.userId, userId))
      .groupBy(booksTable.id)
      .orderBy(desc(booksTable.updatedAt));

    return res.json(rows.map(r => ({ ...serializeBook(r.book), chapterCount: Number(r.chapterCount) })));
  } catch (err) {
    req.log.error({ err }, "Failed to list books");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /books — create a book */
router.post("/books", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const parsed = BookInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const [book] = await db
      .insert(booksTable)
      .values({ userId, ...parsed.data, coverImageUri: parsed.data.coverImageUri ?? null })
      .returning();
    return res.status(201).json({ ...serializeBook(book!), chapterCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create book");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /books/:id — get a single book with chapter count */
router.get("/books/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const bookId = String(req.params.id);
  try {
    const rows = await db
      .select({ book: booksTable, chapterCount: count(chaptersTable.id) })
      .from(booksTable)
      .leftJoin(chaptersTable, eq(chaptersTable.bookId, booksTable.id))
      .where(and(eq(booksTable.id, bookId), eq(booksTable.userId, userId)))
      .groupBy(booksTable.id)
      .limit(1);

    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const { book, chapterCount } = rows[0]!;
    return res.json({ ...serializeBook(book), chapterCount: Number(chapterCount) });
  } catch (err) {
    req.log.error({ err }, "Failed to get book");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** PATCH /books/:id — update book metadata */
router.patch("/books/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const bookId = String(req.params.id);
  const parsed = BookInputSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const [updated] = await db
      .update(booksTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(booksTable.id, bookId), eq(booksTable.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(serializeBook(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update book");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /books/:id — delete a book (cascades to chapters) */
router.delete("/books/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const bookId = String(req.params.id);
  try {
    await db.delete(booksTable).where(and(eq(booksTable.id, bookId), eq(booksTable.userId, userId)));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete book");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Chapters ──────────────────────────────────────────────────────────────────

/** GET /books/:id/chapters — list chapters ordered by orderIndex */
router.get("/books/:id/chapters", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const bookId = String(req.params.id);
  try {
    // Verify book belongs to user
    const books = await db
      .select({ id: booksTable.id })
      .from(booksTable)
      .where(and(eq(booksTable.id, bookId), eq(booksTable.userId, userId)))
      .limit(1);
    if (!books.length) return res.status(404).json({ error: "Not found" });

    const rows = await db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.bookId, bookId))
      .orderBy(asc(chaptersTable.orderIndex), asc(chaptersTable.createdAt));

    return res.json(rows.map(serializeChapter));
  } catch (err) {
    req.log.error({ err }, "Failed to list chapters");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /books/:id/chapters — create a chapter in a book */
router.post("/books/:id/chapters", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const bookId = String(req.params.id);
  const parsed = ChapterInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    // Verify ownership
    const books = await db
      .select({ id: booksTable.id })
      .from(booksTable)
      .where(and(eq(booksTable.id, bookId), eq(booksTable.userId, userId)))
      .limit(1);
    if (!books.length) return res.status(404).json({ error: "Not found" });

    const { pages, publishedAt, ...rest } = parsed.data;
    const [chapter] = await db
      .insert(chaptersTable)
      .values({
        bookId,
        title:      rest.title,
        orderIndex: rest.orderIndex ?? 0,
        status:     rest.status ?? "draft",
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        pageCount:  rest.pageCount ?? 0,
        pages:      (pages ?? []) as typeof chaptersTable.$inferInsert["pages"],
      })
      .returning();

    // Bump book updatedAt
    await db.update(booksTable).set({ updatedAt: new Date() }).where(eq(booksTable.id, bookId));

    return res.status(201).json(serializeChapter(chapter!));
  } catch (err) {
    req.log.error({ err }, "Failed to create chapter");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /chapters/:id — get a single chapter (with full pages JSONB) */
router.get("/chapters/:id", requireAuth, async (req, res) => {
  const userId    = getUserId(req);
  const chapterId = String(req.params.id);
  try {
    const rows = await db
      .select({ chapter: chaptersTable })
      .from(chaptersTable)
      .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
      .where(and(eq(chaptersTable.id, chapterId), eq(booksTable.userId, userId)))
      .limit(1);

    if (!rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(serializeChapter(rows[0]!.chapter));
  } catch (err) {
    req.log.error({ err }, "Failed to get chapter");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** PATCH /chapters/:id — update chapter (title, status, pages, orderIndex) */
router.patch("/chapters/:id", requireAuth, async (req, res) => {
  const userId    = getUserId(req);
  const chapterId = String(req.params.id);
  const parsed    = ChapterInputSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    // Verify ownership via book join
    const rows = await db
      .select({ chapter: chaptersTable })
      .from(chaptersTable)
      .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
      .where(and(eq(chaptersTable.id, chapterId), eq(booksTable.userId, userId)))
      .limit(1);
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const { pages, publishedAt, ...rest } = parsed.data;
    const updateSet: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if (pages !== undefined) updateSet.pages = pages;
    if (publishedAt !== undefined) updateSet.publishedAt = publishedAt ? new Date(publishedAt) : null;

    const [updated] = await db
      .update(chaptersTable)
      .set(updateSet as Partial<typeof chaptersTable.$inferInsert>)
      .where(eq(chaptersTable.id, chapterId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });

    // Bump book updatedAt
    await db.update(booksTable).set({ updatedAt: new Date() }).where(eq(booksTable.id, updated.bookId));

    return res.json(serializeChapter(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update chapter");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /chapters/:id — delete a chapter */
router.delete("/chapters/:id", requireAuth, async (req, res) => {
  const userId    = getUserId(req);
  const chapterId = String(req.params.id);
  try {
    const rows = await db
      .select({ bookId: chaptersTable.bookId })
      .from(chaptersTable)
      .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
      .where(and(eq(chaptersTable.id, chapterId), eq(booksTable.userId, userId)))
      .limit(1);
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    await db.delete(chaptersTable).where(eq(chaptersTable.id, chapterId));
    await db.update(booksTable).set({ updatedAt: new Date() }).where(eq(booksTable.id, rows[0]!.bookId));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete chapter");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Serializers ───────────────────────────────────────────────────────────────

function serializeBook(b: typeof booksTable.$inferSelect) {
  return {
    id:            b.id,
    title:         b.title,
    subtitle:      b.subtitle,
    seriesType:    b.seriesType,
    genre:         b.genre,
    language:      b.language,
    ageRating:     b.ageRating,
    visibility:    b.visibility,
    coverImageUri: b.coverImageUri ?? null,
    createdAt:     b.createdAt.toISOString(),
    updatedAt:     b.updatedAt.toISOString(),
  };
}

function serializeChapter(c: typeof chaptersTable.$inferSelect) {
  return {
    id:          c.id,
    bookId:      c.bookId,
    title:       c.title,
    orderIndex:  c.orderIndex,
    status:      c.status,
    publishedAt: c.publishedAt?.toISOString() ?? null,
    pageCount:   c.pageCount,
    pages:       c.pages,
    createdAt:   c.createdAt.toISOString(),
    updatedAt:   c.updatedAt.toISOString(),
  };
}

export default router;
