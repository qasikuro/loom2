/**
 * Book Reader API
 *
 * Public / reader-side endpoints for the Story Studio book reader experience.
 * These complement the creator-side routes in books.ts.
 *
 * Routes:
 *   GET    /books/:id/public              — public book page (optional auth)
 *   GET    /chapters/:id/read             — chapter content + increment read count
 *   GET    /chapters/:id/comments         — threaded comments
 *   POST   /chapters/:id/comments         — post a comment
 *   POST   /comments/:id/like             — like / unlike a comment (toggle)
 *   POST   /books/:id/follow              — follow a book
 *   DELETE /books/:id/follow              — unfollow a book
 */
import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  booksTable,
  chaptersTable,
  bookFollowsTable,
  bookCommentsTable,
  commentLikesTable,
  characterTable,
} from "@workspace/db";
import { clerkAuth, requireAuth, getUserId } from "../middleware/auth";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract userId without throwing — returns null if unauthenticated. */
function tryGetUserId(req: Request): string | null {
  try {
    return getAuth(req).userId ?? null;
  } catch {
    return null;
  }
}

// ── Discover books (all public) ───────────────────────────────────────────────

/**
 * GET /public-books
 * Returns all public books ordered by most recently updated, with author stub.
 * No auth required. (Named /public-books to avoid conflict with /books/:id)
 */
router.get("/public-books", async (req, res) => {
  try {
    const rows = await db
      .select({
        book:         booksTable,
        chapterCount: count(chaptersTable.id),
        authorName:   characterTable.name,
        authorUsername: characterTable.username,
        authorAvatarUri: characterTable.avatarUri,
      })
      .from(booksTable)
      .leftJoin(chaptersTable, and(
        eq(chaptersTable.bookId, booksTable.id),
        eq(chaptersTable.status, "published"),
      ))
      .leftJoin(characterTable, eq(characterTable.userId, booksTable.userId))
      .where(eq(booksTable.visibility, "public"))
      .groupBy(booksTable.id, characterTable.name, characterTable.username, characterTable.avatarUri)
      .orderBy(desc(booksTable.updatedAt))
      .limit(60);

    return res.json(rows.map(r => ({
      id:              r.book.id,
      title:           r.book.title,
      subtitle:        r.book.subtitle,
      description:     (r.book as Record<string, unknown>).description as string | null ?? r.book.subtitle,
      genre:           r.book.genre,
      ageRating:       r.book.ageRating,
      coverImageUri:   r.book.coverImageUri ?? null,
      chapterCount:    Number(r.chapterCount),
      authorUserId:    r.book.userId,
      authorName:      r.authorName ?? null,
      authorUsername:  r.authorUsername ?? null,
      authorAvatarUri: r.authorAvatarUri ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list discover books");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public books by user ──────────────────────────────────────────────────────

/**
 * GET /users/:userId/books
 * Returns all public books for a given user (no auth required).
 */
router.get("/users/:userId/books", async (req, res) => {
  const authorId = String(req.params.userId);
  try {
    const rows = await db
      .select({
        book:         booksTable,
        chapterCount: count(chaptersTable.id),
      })
      .from(booksTable)
      .leftJoin(chaptersTable, and(
        eq(chaptersTable.bookId, booksTable.id),
        eq(chaptersTable.status, "published"),
      ))
      .where(and(
        eq(booksTable.userId, authorId),
        eq(booksTable.visibility, "public"),
      ))
      .groupBy(booksTable.id)
      .orderBy(desc(booksTable.updatedAt));

    return res.json(rows.map(r => ({
      id:             r.book.id,
      title:          r.book.title,
      subtitle:       r.book.subtitle,
      genre:          r.book.genre,
      coverImageUri:  r.book.coverImageUri ?? null,
      chapterCount:   Number(r.chapterCount),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list user books");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public book page ──────────────────────────────────────────────────────────

/**
 * GET /books/:id/public
 * Returns public book metadata + published chapters + author stub.
 * Optional auth: if authenticated the response includes `isFollowing`.
 */
router.get("/books/:id/public", clerkAuth, async (req, res) => {
  const bookId = String(req.params.id);
  const userId = tryGetUserId(req);

  try {
    // Book must exist and be public
    const books = await db
      .select()
      .from(booksTable)
      .where(and(eq(booksTable.id, bookId), eq(booksTable.visibility, "public")))
      .limit(1);
    if (!books.length) return res.status(404).json({ error: "Not found" });
    const book = books[0]!;

    // Published chapters (no auth check — public)
    const chapters = await db
      .select()
      .from(chaptersTable)
      .where(and(eq(chaptersTable.bookId, bookId), eq(chaptersTable.status, "published")))
      .orderBy(asc(chaptersTable.orderIndex), asc(chaptersTable.publishedAt));

    // Follow count
    const [followRow] = await db
      .select({ total: count() })
      .from(bookFollowsTable)
      .where(eq(bookFollowsTable.bookId, bookId));
    const followCount = Number(followRow?.total ?? 0);

    // Is the requesting user following?
    let isFollowing = false;
    if (userId) {
      const rows = await db
        .select({ id: bookFollowsTable.id })
        .from(bookFollowsTable)
        .where(and(eq(bookFollowsTable.bookId, bookId), eq(bookFollowsTable.userId, userId)))
        .limit(1);
      isFollowing = rows.length > 0;
    }

    // Author profile (best-effort — may not exist for all users)
    const [authorRow] = await db
      .select({ name: characterTable.name, username: characterTable.username, avatarUri: characterTable.avatarUri })
      .from(characterTable)
      .where(eq(characterTable.userId, book.userId))
      .limit(1);

    return res.json({
      id:             book.id,
      title:          book.title,
      subtitle:       book.subtitle,
      description:    book.description,
      seriesType:     book.seriesType,
      genre:          book.genre,
      language:       book.language,
      ageRating:      book.ageRating,
      coverImageUri:  book.coverImageUri ?? null,
      authorUserId:   book.userId,
      authorName:     authorRow?.name     ?? 'Unknown Author',
      authorUsername: authorRow?.username ?? null,
      authorAvatarUri:authorRow?.avatarUri ?? null,
      followCount,
      isFollowing,
      chapters: chapters.map(c => ({
        id:          c.id,
        title:       c.title,
        orderIndex:  c.orderIndex,
        publishedAt: c.publishedAt?.toISOString() ?? null,
        pageCount:   c.pageCount,
        readCount:   (c as unknown as { readCount?: number }).readCount ?? 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get public book");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Chapter reader ────────────────────────────────────────────────────────────

/**
 * GET /chapters/:id/read
 * Returns chapter content (full pages JSONB) and increments read count.
 * Requires: chapter must be published AND its parent book must be public.
 * No auth required (public read).
 */
router.get("/chapters/:id/read", async (req, res) => {
  const chapterId = String(req.params.id);
  try {
    const rows = await db
      .select({ chapter: chaptersTable })
      .from(chaptersTable)
      .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
      .where(
        and(
          eq(chaptersTable.id, chapterId),
          eq(chaptersTable.status, "published"),
          eq(booksTable.visibility, "public"),
        )
      )
      .limit(1);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const chapter = rows[0]!.chapter;

    // Increment read count (best-effort, fire-and-forget)
    db.execute(
      sql`UPDATE chapters SET read_count = COALESCE(read_count, 0) + 1 WHERE id = ${chapterId}`
    ).catch(() => { /* ignore */ });

    return res.json({
      id:          chapter.id,
      bookId:      chapter.bookId,
      title:       chapter.title,
      orderIndex:  chapter.orderIndex,
      publishedAt: chapter.publishedAt?.toISOString() ?? null,
      pageCount:   chapter.pageCount,
      pages:       chapter.pages,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to read chapter");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Comments ──────────────────────────────────────────────────────────────────

const CommentInputSchema = z.object({
  content:  z.string().min(1).max(2000),
  parentId: z.string().uuid().nullish(),
});

/**
 * GET /chapters/:id/comments
 * Returns top-level comments (with reply counts) ordered by newest first.
 * Pass ?parentId=<uuid> to fetch replies for a specific comment.
 * Chapter must be published and belong to a public book.
 */
router.get("/chapters/:id/comments", async (req, res) => {
  const chapterId = String(req.params.id);
  const { parentId } = req.query as { parentId?: string };

  try {
    // Enforce: published chapter on a public book
    const chapterCheck = await db
      .select({ id: chaptersTable.id })
      .from(chaptersTable)
      .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
      .where(
        and(
          eq(chaptersTable.id, chapterId),
          eq(chaptersTable.status, "published"),
          eq(booksTable.visibility, "public"),
        )
      )
      .limit(1);
    if (!chapterCheck.length) return res.status(404).json({ error: "Not found" });

    const condition = parentId
      ? and(eq(bookCommentsTable.chapterId, chapterId), eq(bookCommentsTable.parentId, parentId))
      : and(eq(bookCommentsTable.chapterId, chapterId), isNull(bookCommentsTable.parentId));

    const comments = await db
      .select()
      .from(bookCommentsTable)
      .where(condition)
      .orderBy(desc(bookCommentsTable.createdAt))
      .limit(100);

    // For top-level comments, attach reply counts
    let replyCounts: Record<string, number> = {};
    if (!parentId && comments.length > 0) {
      const ids = comments.map(c => c.id);
      // Count replies for each comment
      const counts = await db
        .select({ parentId: bookCommentsTable.parentId, total: count() })
        .from(bookCommentsTable)
        .where(and(
          eq(bookCommentsTable.chapterId, chapterId),
          sql`parent_id = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)}])`
        ))
        .groupBy(bookCommentsTable.parentId);
      replyCounts = Object.fromEntries(
        counts.filter(r => r.parentId).map(r => [r.parentId!, Number(r.total)])
      );
    }

    return res.json(comments.map(c => ({
      id:          c.id,
      chapterId:   c.chapterId,
      userId:      c.userId,
      parentId:    c.parentId ?? null,
      content:     c.content,
      likeCount:   c.likeCount,
      replyCount:  replyCounts[c.id] ?? 0,
      createdAt:   c.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get comments");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /chapters/:id/comments — post a comment (auth required) */
router.post("/chapters/:id/comments", requireAuth, async (req, res) => {
  const userId    = getUserId(req);
  const chapterId = String(req.params.id);
  const parsed    = CommentInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    // Chapter must be published and belong to a public book
    const chapters = await db
      .select({ id: chaptersTable.id })
      .from(chaptersTable)
      .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
      .where(
        and(
          eq(chaptersTable.id, chapterId),
          eq(chaptersTable.status, "published"),
          eq(booksTable.visibility, "public"),
        )
      )
      .limit(1);
    if (!chapters.length) return res.status(404).json({ error: "Chapter not found" });

    const [comment] = await db
      .insert(bookCommentsTable)
      .values({
        chapterId,
        userId,
        content:  parsed.data.content,
        parentId: parsed.data.parentId ?? undefined,
      })
      .returning();

    return res.status(201).json({
      id:        comment!.id,
      chapterId: comment!.chapterId,
      userId:    comment!.userId,
      parentId:  comment!.parentId ?? null,
      content:   comment!.content,
      likeCount: comment!.likeCount,
      replyCount: 0,
      createdAt: comment!.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to post comment");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /comments/:id/like — toggle like on a comment */
router.post("/comments/:id/like", requireAuth, async (req, res) => {
  const userId    = getUserId(req);
  const commentId = String(req.params.id);
  try {
    // Check if already liked
    const existing = await db
      .select()
      .from(commentLikesTable)
      .where(and(eq(commentLikesTable.commentId, commentId), eq(commentLikesTable.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      // Unlike
      await db.delete(commentLikesTable).where(
        and(eq(commentLikesTable.commentId, commentId), eq(commentLikesTable.userId, userId))
      );
      await db.execute(sql`
        UPDATE book_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = ${commentId}
      `);
      return res.json({ liked: false });
    } else {
      // Like
      await db.insert(commentLikesTable).values({ commentId, userId }).onConflictDoNothing();
      await db.execute(sql`
        UPDATE book_comments SET like_count = like_count + 1 WHERE id = ${commentId}
      `);
      return res.json({ liked: true });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to toggle comment like");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Follow / Unfollow ─────────────────────────────────────────────────────────

/** POST /books/:id/follow — follow a book */
router.post("/books/:id/follow", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const bookId = String(req.params.id);
  try {
    const books = await db
      .select({ id: booksTable.id })
      .from(booksTable)
      .where(eq(booksTable.id, bookId))
      .limit(1);
    if (!books.length) return res.status(404).json({ error: "Not found" });

    await db
      .insert(bookFollowsTable)
      .values({ bookId, userId })
      .onConflictDoNothing();
    return res.status(201).json({ following: true });
  } catch (err) {
    req.log.error({ err }, "Failed to follow book");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /books/:id/follow — unfollow a book */
router.delete("/books/:id/follow", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const bookId = String(req.params.id);
  try {
    await db.delete(bookFollowsTable).where(
      and(eq(bookFollowsTable.bookId, bookId), eq(bookFollowsTable.userId, userId))
    );
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to unfollow book");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
