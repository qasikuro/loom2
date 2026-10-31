import { Router, type Request } from "express";
import { getAuth } from "@clerk/express";
import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  blocksTable,
  bookCommentsTable,
  booksTable,
  chaptersTable,
  characterTable,
  commentLikesTable,
  contentCommentLikesTable,
  contentCommentsTable,
  db,
  followsTable,
  guideSessionAttendeesTable,
  guideSessionsTable,
  guideTutorialsTable,
  outfitsTable,
  storiesTable,
} from "@workspace/db";
import { clerkAuth, getUserId, requireAuth } from "../middleware/auth";
import { friendsSql, readableContentSql, readableProfileSql } from "../lib/contentVisibility";
import { normalizePublicMediaFields } from "../lib/publicMediaUri";

const router = Router();
const CONTENT_TYPES = ["story", "video", "outfit", "book", "tutorial", "session"] as const;
const KINDNESS_TAGS = ["creativity", "smile", "outfit", "colors", "relaxing", "keepCreating"] as const;
const CREATOR_REACTIONS = ["heart", "sparkle", "flower", "clap"] as const;
type ContentType = typeof CONTENT_TYPES[number];

const contentTypeSchema = z.enum(CONTENT_TYPES);
const commentInputSchema = z.object({
  content: z.string().trim().min(1).max(500),
  parentId: z.string().uuid().nullable().optional(),
  kindnessTag: z.enum(KINDNESS_TAGS).nullable().optional(),
});
const creatorReactionSchema = z.object({
  reaction: z.enum(CREATOR_REACTIONS).nullable(),
});

function optionalUserId(req: Request): string | null {
  try {
    return getAuth(req).userId ?? null;
  } catch {
    return null;
  }
}

async function usersBlocked(a: string, b: string): Promise<boolean> {
  if (!a || !b || a === b) return false;
  const [block] = await db.select({ id: blocksTable.id }).from(blocksTable)
    .where(or(
      and(eq(blocksTable.blockerId, a), eq(blocksTable.blockedId, b)),
      and(eq(blocksTable.blockerId, b), eq(blocksTable.blockedId, a)),
    )).limit(1);
  return !!block;
}

type ReadableContent = { ownerId: string };

async function getReadableContent(
  contentType: ContentType,
  contentId: string,
  viewerId: string | null,
): Promise<ReadableContent | null> {
  const viewer = viewerId ?? "";

  if (contentType === "story" || contentType === "video") {
    const [row] = await db.select({ ownerId: storiesTable.userId }).from(storiesTable)
      .where(and(
        eq(storiesTable.id, contentId),
        eq(storiesTable.contentType, contentType),
        eq(storiesTable.isHidden, false),
        readableContentSql(storiesTable.userId, viewer, storiesTable.visibility, storiesTable.isPublic),
      )).limit(1);
    return row ?? null;
  }

  if (contentType === "outfit") {
    const [row] = await db.select({ ownerId: outfitsTable.userId }).from(outfitsTable)
      .where(and(
        eq(outfitsTable.id, contentId),
        eq(outfitsTable.isHidden, false),
        readableContentSql(outfitsTable.userId, viewer, outfitsTable.visibility, outfitsTable.isPublic),
      )).limit(1);
    return row ?? null;
  }

  if (contentType === "book") {
    const [row] = await db.select({ ownerId: booksTable.userId }).from(chaptersTable)
      .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
      .innerJoin(characterTable, eq(characterTable.userId, booksTable.userId))
      .where(and(
        eq(chaptersTable.id, contentId),
        eq(chaptersTable.status, "published"),
        eq(characterTable.isHidden, false),
        readableContentSql(booksTable.userId, viewer, booksTable.visibility),
      )).limit(1);
    return row ?? null;
  }

  if (contentType === "tutorial") {
    const [tutorial] = await db.select().from(guideTutorialsTable)
      .where(eq(guideTutorialsTable.id, contentId)).limit(1);
    if (!tutorial) return null;
    if (tutorial.guideId === viewer) return { ownerId: tutorial.guideId };
    if (!viewer || tutorial.status !== "published") return null;

    const [visibleProfile] = await db.select({ userId: characterTable.userId })
      .from(characterTable)
      .where(and(
        eq(characterTable.userId, tutorial.guideId),
        readableProfileSql(characterTable.userId, viewer),
      )).limit(1);
    if (!visibleProfile) return null;

    if (tutorial.visibility === "public" || tutorial.visibility === "unlisted") {
      return { ownerId: tutorial.guideId };
    }
    if (tutorial.visibility === "followers") {
      const [follow] = await db.select({ userId: followsTable.followerId }).from(followsTable)
        .where(and(eq(followsTable.followerId, viewer), eq(followsTable.followingId, tutorial.guideId)))
        .limit(1);
      return follow ? { ownerId: tutorial.guideId } : null;
    }
    if (tutorial.visibility === "friends") {
      const [friend] = await db.select({ userId: followsTable.followerId }).from(followsTable)
        .where(and(eq(followsTable.followingId, tutorial.guideId), friendsSql(tutorial.guideId, viewer)))
        .limit(1);
      return friend ? { ownerId: tutorial.guideId } : null;
    }
    return null;
  }

  if (!viewer) return null;
  const [session] = await db.select({
    ownerId: guideSessionsTable.guideId,
    status: guideSessionsTable.status,
  }).from(guideSessionsTable).where(eq(guideSessionsTable.id, contentId)).limit(1);
  if (!session || session.status === "cancelled" || await usersBlocked(viewer, session.ownerId)) return null;
  if (session.ownerId === viewer) return { ownerId: session.ownerId };

  const [attendee] = await db.select({ userId: guideSessionAttendeesTable.userId })
    .from(guideSessionAttendeesTable)
    .where(and(
      eq(guideSessionAttendeesTable.sessionId, contentId),
      eq(guideSessionAttendeesTable.userId, viewer),
    )).limit(1);
  return attendee ? { ownerId: session.ownerId } : null;
}

type CommentRow = {
  id: string;
  contentType: ContentType;
  contentId: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUri: string | null;
  authorIsPublic: boolean;
  authorIsHidden: boolean;
  authorIsBanned: boolean;
  parentId: string | null;
  content: string;
  kindnessTag: string | null;
  creatorReaction: string | null;
  likeCount: number;
  isHidden: boolean;
  createdAt: Date;
};

async function rowsForContent(
  contentType: ContentType,
  contentId: string,
  parentId: string | null,
): Promise<CommentRow[]> {
  const parentCondition = parentId
    ? eq(contentCommentsTable.parentId, parentId)
    : isNull(contentCommentsTable.parentId);
  const rows = await db.select({
    id: contentCommentsTable.id,
    authorId: contentCommentsTable.userId,
    authorName: characterTable.name,
    authorUsername: characterTable.username,
    authorAvatarUri: characterTable.avatarUri,
    authorIsPublic: characterTable.isPublic,
    authorIsHidden: characterTable.isHidden,
    authorIsBanned: characterTable.isBanned,
    parentId: contentCommentsTable.parentId,
    content: contentCommentsTable.content,
    kindnessTag: contentCommentsTable.kindnessTag,
    creatorReaction: contentCommentsTable.creatorReaction,
    likeCount: contentCommentsTable.likeCount,
    isHidden: contentCommentsTable.isHidden,
    createdAt: contentCommentsTable.createdAt,
  }).from(contentCommentsTable)
    .innerJoin(characterTable, eq(characterTable.userId, contentCommentsTable.userId))
    .where(and(
      eq(contentCommentsTable.contentType, contentType),
      eq(contentCommentsTable.contentId, contentId),
      parentCondition,
    ))
    .orderBy(desc(contentCommentsTable.createdAt))
    .limit(100);

  const normalized: CommentRow[] = rows.map(row => ({
    ...row,
    contentType,
    contentId,
    parentId: row.parentId ?? null,
    kindnessTag: row.kindnessTag ?? null,
    creatorReaction: row.creatorReaction ?? null,
    likeCount: Number(row.likeCount),
  }));

  if (contentType !== "book") return normalized;

  const legacyParentCondition = parentId
    ? eq(bookCommentsTable.parentId, parentId)
    : isNull(bookCommentsTable.parentId);
  const legacyRows = await db.select({
    id: bookCommentsTable.id,
    authorId: bookCommentsTable.userId,
    authorName: characterTable.name,
    authorUsername: characterTable.username,
    authorAvatarUri: characterTable.avatarUri,
    authorIsPublic: characterTable.isPublic,
    authorIsHidden: characterTable.isHidden,
    authorIsBanned: characterTable.isBanned,
    parentId: bookCommentsTable.parentId,
    content: bookCommentsTable.content,
    kindnessTag: bookCommentsTable.kindnessTag,
    creatorReaction: bookCommentsTable.creatorReaction,
    likeCount: bookCommentsTable.likeCount,
    isHidden: bookCommentsTable.isHidden,
    createdAt: bookCommentsTable.createdAt,
  }).from(bookCommentsTable)
    .innerJoin(characterTable, eq(characterTable.userId, bookCommentsTable.userId))
    .where(and(eq(bookCommentsTable.chapterId, contentId), legacyParentCondition))
    .orderBy(desc(bookCommentsTable.createdAt))
    .limit(100);

  return [
    ...normalized,
    ...legacyRows.map(row => ({
      ...row,
      contentType,
      contentId,
      parentId: row.parentId ?? null,
      kindnessTag: row.kindnessTag ?? null,
      creatorReaction: row.creatorReaction ?? null,
      likeCount: Number(row.likeCount),
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 100);
}

async function replyCountsFor(
  contentType: ContentType,
  contentId: string,
  parentIds: string[],
): Promise<Map<string, number>> {
  const countsByParent = new Map<string, number>();
  if (!parentIds.length) return countsByParent;

  const current = await db.select({
    parentId: contentCommentsTable.parentId,
    total: count(),
  }).from(contentCommentsTable)
    .where(and(
      eq(contentCommentsTable.contentType, contentType),
      eq(contentCommentsTable.contentId, contentId),
      inArray(contentCommentsTable.parentId, parentIds),
      eq(contentCommentsTable.isHidden, false),
    ))
    .groupBy(contentCommentsTable.parentId);
  for (const row of current) {
    if (row.parentId) countsByParent.set(row.parentId, Number(row.total));
  }

  if (contentType === "book") {
    const legacy = await db.select({
      parentId: bookCommentsTable.parentId,
      total: count(),
    }).from(bookCommentsTable)
      .where(and(
        eq(bookCommentsTable.chapterId, contentId),
        inArray(bookCommentsTable.parentId, parentIds),
        eq(bookCommentsTable.isHidden, false),
      ))
      .groupBy(bookCommentsTable.parentId);
    for (const row of legacy) {
      if (row.parentId) countsByParent.set(row.parentId, (countsByParent.get(row.parentId) ?? 0) + Number(row.total));
    }
  }
  return countsByParent;
}

async function serializeComments(
  rows: CommentRow[],
  viewerId: string | null,
  contentOwnerId: string,
  replyCounts: Map<string, number>,
) {
  const blockedIds = new Set<string>();
  if (viewerId) {
    const blocks = await db.select({
      blockerId: blocksTable.blockerId,
      blockedId: blocksTable.blockedId,
    }).from(blocksTable)
      .where(or(eq(blocksTable.blockerId, viewerId), eq(blocksTable.blockedId, viewerId)));
    for (const row of blocks) blockedIds.add(row.blockerId === viewerId ? row.blockedId : row.blockerId);
  }
  const visibleRows = rows.filter(row => !blockedIds.has(row.authorId));
  const ids = visibleRows.map(row => row.id);
  const likedIds = new Set<string>();
  if (viewerId && ids.length) {
    const likes = await db.select({ commentId: contentCommentLikesTable.commentId })
      .from(contentCommentLikesTable)
      .where(and(eq(contentCommentLikesTable.userId, viewerId), inArray(contentCommentLikesTable.commentId, ids)));
    for (const like of likes) likedIds.add(like.commentId);
    if (visibleRows.some(row => row.contentType === "book")) {
      const legacyLikes = await db.select({ commentId: commentLikesTable.commentId })
        .from(commentLikesTable)
        .where(and(eq(commentLikesTable.userId, viewerId), inArray(commentLikesTable.commentId, ids)));
      for (const like of legacyLikes) likedIds.add(like.commentId);
    }
  }

  return visibleRows.map(row => {
    const publicAuthor = row.authorIsPublic && !row.authorIsHidden && !row.authorIsBanned;
    const removed = row.isHidden;
    return normalizePublicMediaFields({
      id: row.id,
      contentType: row.contentType,
      contentId: row.contentId,
      authorName: removed ? "Community member" : publicAuthor ? row.authorName : "Private player",
      authorUsername: !removed && publicAuthor ? row.authorUsername : null,
      authorAvatarUri: !removed && publicAuthor ? row.authorAvatarUri : null,
      parentId: row.parentId,
      content: removed ? "This comment was removed." : row.content,
      kindnessTag: removed ? null : row.kindnessTag,
      creatorReaction: removed ? null : row.creatorReaction,
      likeCount: row.likeCount,
      replyCount: replyCounts.get(row.id) ?? 0,
      likedByMe: !removed && likedIds.has(row.id),
      isMine: row.authorId === viewerId,
      isContentOwner: contentOwnerId === viewerId,
      createdAt: row.createdAt.toISOString(),
    });
  });
}

async function findComment(commentId: string) {
  const [current] = await db.select({
    id: contentCommentsTable.id,
    contentType: contentCommentsTable.contentType,
    contentId: contentCommentsTable.contentId,
    authorId: contentCommentsTable.userId,
    parentId: contentCommentsTable.parentId,
    isHidden: contentCommentsTable.isHidden,
  }).from(contentCommentsTable).where(eq(contentCommentsTable.id, commentId)).limit(1);
  if (current) return { ...current, storage: "current" as const };

  const [legacy] = await db.select({
    id: bookCommentsTable.id,
    contentId: bookCommentsTable.chapterId,
    authorId: bookCommentsTable.userId,
    parentId: bookCommentsTable.parentId,
    isHidden: bookCommentsTable.isHidden,
  }).from(bookCommentsTable).where(eq(bookCommentsTable.id, commentId)).limit(1);
  if (legacy) return { ...legacy, contentType: "book" as const, storage: "legacy" as const };
  return null;
}

router.get("/content/:contentType/:contentId/comments", clerkAuth, async (req, res) => {
  const parsedType = contentTypeSchema.safeParse(req.params.contentType);
  const contentId = String(req.params.contentId);
  const parentId = typeof req.query.parentId === "string" ? req.query.parentId : null;
  const viewerId = optionalUserId(req);
  if (!parsedType.success || !z.string().uuid().safeParse(contentId).success ||
      (parentId && !z.string().uuid().safeParse(parentId).success)) {
    return res.status(400).json({ error: "Invalid content reference" });
  }

  try {
    const readable = await getReadableContent(parsedType.data, contentId, viewerId);
    if (!readable) return res.status(404).json({ error: "Content is unavailable" });
    if (parentId) {
      const parent = await findComment(parentId);
      if (!parent || parent.contentType !== parsedType.data || parent.contentId !== contentId || parent.isHidden) {
        return res.status(404).json({ error: "Comment is unavailable" });
      }
    }
    const rows = await rowsForContent(parsedType.data, contentId, parentId);
    const counts = parentId ? new Map<string, number>() : await replyCountsFor(parsedType.data, contentId, rows.map(row => row.id));
    return res.json({ comments: await serializeComments(rows, viewerId, readable.ownerId, counts) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load content comments");
    return res.status(500).json({ error: "Unable to load comments" });
  }
});

router.post("/content/:contentType/:contentId/comments", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const parsedType = contentTypeSchema.safeParse(req.params.contentType);
  const contentId = String(req.params.contentId);
  const parsedBody = commentInputSchema.safeParse(req.body);
  if (!parsedType.success || !z.string().uuid().safeParse(contentId).success || !parsedBody.success) {
    return res.status(400).json({ error: "Invalid comment" });
  }

  try {
    const [profile] = await db.select({
      isBanned: characterTable.isBanned,
      suspendedUntil: characterTable.suspendedUntil,
    }).from(characterTable).where(eq(characterTable.userId, userId)).limit(1);
    if (!profile || profile.isBanned || (profile.suspendedUntil && profile.suspendedUntil > new Date())) {
      return res.status(403).json({ error: "This account cannot comment right now" });
    }

    const readable = await getReadableContent(parsedType.data, contentId, userId);
    if (!readable) return res.status(404).json({ error: "Content is unavailable" });
    if (await usersBlocked(userId, readable.ownerId)) return res.status(404).json({ error: "Content is unavailable" });

    const parentId = parsedBody.data.parentId ?? null;
    if (parentId) {
      const parent = await findComment(parentId);
      if (!parent || parent.contentType !== parsedType.data || parent.contentId !== contentId || parent.isHidden) {
        return res.status(400).json({ error: "Choose an active comment in this thread to reply to" });
      }
      if (await usersBlocked(userId, parent.authorId)) {
        return res.status(404).json({ error: "Comment is unavailable" });
      }
      const parentRows = await rowsForContent(parsedType.data, contentId, parent.parentId);
      const parentIsReply = parentRows.some(row => row.id === parentId && !!row.parentId);
      if (parentIsReply) return res.status(400).json({ error: "Replies can only be one level deep" });
    }

    const [created] = await db.insert(contentCommentsTable).values({
      contentType: parsedType.data,
      contentId,
      userId,
      parentId,
      content: parsedBody.data.content,
      kindnessTag: parsedBody.data.kindnessTag ?? null,
    }).returning();
    if (!created) return res.status(500).json({ error: "Comment was not saved" });

    const rows = await rowsForContent(parsedType.data, contentId, parentId);
    const row = rows.find(item => item.id === created.id);
    if (!row) return res.status(201).json({
      id: created.id,
      contentType: parsedType.data,
      contentId,
      authorName: profile ? (await db.select({ name: characterTable.name }).from(characterTable).where(eq(characterTable.userId, userId)).limit(1))[0]?.name ?? "Player" : "Player",
      authorUsername: null,
      authorAvatarUri: null,
      parentId,
      content: created.content,
      kindnessTag: created.kindnessTag,
      creatorReaction: null,
      likeCount: 0,
      replyCount: 0,
      likedByMe: false,
      isMine: true,
      isContentOwner: readable.ownerId === userId,
      createdAt: created.createdAt.toISOString(),
    });
    const [serialized] = await serializeComments([row], userId, readable.ownerId, new Map());
    return res.status(201).json(serialized);
  } catch (error) {
    req.log.error({ err: error }, "Failed to create content comment");
    return res.status(500).json({ error: "Unable to post comment" });
  }
});

router.post("/content-comments/:commentId/like", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const commentId = String(req.params.commentId);
  if (!z.string().uuid().safeParse(commentId).success) return res.status(400).json({ error: "Invalid comment" });

  try {
    const comment = await findComment(commentId);
    if (!comment || comment.isHidden) return res.status(404).json({ error: "Comment is unavailable" });
    const contentType = contentTypeSchema.safeParse(comment.contentType);
    if (!contentType.success) return res.status(404).json({ error: "Comment is unavailable" });
    const readable = await getReadableContent(contentType.data, comment.contentId, userId);
    if (!readable || await usersBlocked(userId, comment.authorId)) return res.status(404).json({ error: "Comment is unavailable" });

    const liked = await db.transaction(async tx => {
      const [currentLike] = await tx.select({ commentId: contentCommentLikesTable.commentId })
        .from(contentCommentLikesTable)
        .where(and(eq(contentCommentLikesTable.commentId, commentId), eq(contentCommentLikesTable.userId, userId)))
        .limit(1);
      const legacyLikes = comment.storage === "legacy"
        ? await tx.select({ commentId: commentLikesTable.commentId }).from(commentLikesTable)
          .where(and(eq(commentLikesTable.commentId, commentId), eq(commentLikesTable.userId, userId))).limit(1)
        : [];
      if (currentLike || legacyLikes.length) {
        await tx.delete(contentCommentLikesTable)
          .where(and(eq(contentCommentLikesTable.commentId, commentId), eq(contentCommentLikesTable.userId, userId)));
        if (comment.storage === "legacy") {
          await tx.delete(commentLikesTable)
            .where(and(eq(commentLikesTable.commentId, commentId), eq(commentLikesTable.userId, userId)));
        }
        const table = comment.storage === "legacy" ? "book_comments" : "content_comments";
        await tx.execute(sql`UPDATE ${sql.raw(table)} SET like_count = GREATEST(like_count - 1, 0) WHERE id = ${commentId}::uuid`);
        return false;
      }
      const [inserted] = await tx.insert(contentCommentLikesTable).values({ commentId, userId })
        .onConflictDoNothing().returning();
      if (inserted) {
        const table = comment.storage === "legacy" ? "book_comments" : "content_comments";
        await tx.execute(sql`UPDATE ${sql.raw(table)} SET like_count = like_count + 1 WHERE id = ${commentId}::uuid`);
      }
      return !!inserted;
    });
    return res.json({ liked });
  } catch (error) {
    req.log.error({ err: error }, "Failed to toggle comment like");
    return res.status(500).json({ error: "Unable to update like" });
  }
});

router.put("/content-comments/:commentId/creator-reaction", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const commentId = String(req.params.commentId);
  const parsed = creatorReactionSchema.safeParse(req.body);
  if (!z.string().uuid().safeParse(commentId).success || !parsed.success) {
    return res.status(400).json({ error: "Invalid reaction" });
  }
  try {
    const comment = await findComment(commentId);
    if (!comment || comment.isHidden) return res.status(404).json({ error: "Comment is unavailable" });
    const contentType = contentTypeSchema.safeParse(comment.contentType);
    if (!contentType.success) return res.status(404).json({ error: "Comment is unavailable" });
    const readable = await getReadableContent(contentType.data, comment.contentId, userId);
    if (!readable) return res.status(404).json({ error: "Content is unavailable" });
    if (readable.ownerId !== userId) return res.status(403).json({ error: "Only the content owner can react" });

    if (comment.storage === "legacy") {
      await db.update(bookCommentsTable).set({
        creatorReaction: parsed.data.reaction,
        updatedAt: new Date(),
      }).where(eq(bookCommentsTable.id, commentId));
    } else {
      await db.update(contentCommentsTable).set({
        creatorReaction: parsed.data.reaction,
        updatedAt: new Date(),
      }).where(eq(contentCommentsTable.id, commentId));
    }
    return res.json({ creatorReaction: parsed.data.reaction });
  } catch (error) {
    req.log.error({ err: error }, "Failed to save creator comment reaction");
    return res.status(500).json({ error: "Unable to save reaction" });
  }
});

router.delete("/content-comments/:commentId", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const commentId = String(req.params.commentId);
  if (!z.string().uuid().safeParse(commentId).success) return res.status(400).json({ error: "Invalid comment" });
  try {
    const comment = await findComment(commentId);
    if (!comment || comment.isHidden) return res.status(404).json({ error: "Comment is unavailable" });
    const contentType = contentTypeSchema.safeParse(comment.contentType);
    if (!contentType.success) return res.status(404).json({ error: "Comment is unavailable" });
    const readable = await getReadableContent(contentType.data, comment.contentId, userId);
    if (!readable) return res.status(404).json({ error: "Content is unavailable" });
    if (comment.authorId !== userId && readable.ownerId !== userId) {
      return res.status(403).json({ error: "You cannot remove this comment" });
    }
    if (comment.storage === "legacy") {
      await db.update(bookCommentsTable).set({ isHidden: true, updatedAt: new Date() })
        .where(eq(bookCommentsTable.id, commentId));
    } else {
      await db.update(contentCommentsTable).set({ isHidden: true, updatedAt: new Date() })
        .where(eq(contentCommentsTable.id, commentId));
    }
    return res.json({ deleted: true });
  } catch (error) {
    req.log.error({ err: error }, "Failed to remove content comment");
    return res.status(500).json({ error: "Unable to remove comment" });
  }
});

export default router;
