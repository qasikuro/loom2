import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  characterTable,
  bookCommentsTable,
  booksTable,
  chaptersTable,
  contentCommentsTable,
  db,
  notificationsTable,
  outfitsTable,
  reportsTable,
  runStartupMigrations,
  storiesTable,
} from "@workspace/db";
import { setTestUserId } from "./helpers/testApp";
import contentCommentsRouter from "../routes/content-comments";

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  Object.assign(req, { log: { error: () => undefined, info: () => undefined, warn: () => undefined } });
  next();
});
app.use("/api", contentCommentsRouter);

const suffix = randomUUID();
const ownerId = `comment-notify-owner-${suffix}`;
const authorId = `comment-notify-author-${suffix}`;
const replierId = `comment-notify-replier-${suffix}`;
let storyId = "";
let outfitId = "";
let bookId = "";
let chapterId = "";
const reportedCommentIds: string[] = [];
const reportedLegacyCommentIds: string[] = [];

beforeAll(async () => {
  await runStartupMigrations();
  await db.insert(characterTable).values([
    { userId: ownerId, name: "Comment Owner", isPublic: true },
    { userId: authorId, name: "Comment Author", isPublic: true },
    { userId: replierId, name: "Comment Replier", isPublic: true },
  ]);
  const [story] = await db.insert(storiesTable).values({
    userId: ownerId,
    chapterTitle: "A kind story",
    mood: "Hopeful",
    date: new Date(),
    visibility: "public",
    isPublic: true,
    contentType: "story",
  }).returning({ id: storiesTable.id });
  storyId = story.id;
  const [outfit] = await db.insert(outfitsTable).values({
    userId: ownerId,
    name: "A public outfit",
    date: new Date(),
    visibility: "public",
    isPublic: true,
  }).returning({ id: outfitsTable.id });
  outfitId = outfit.id;
  const [book] = await db.insert(booksTable).values({
    userId: ownerId,
    title: "A public legacy book",
    visibility: "public",
  }).returning({ id: booksTable.id });
  bookId = book.id;
  const [chapter] = await db.insert(chaptersTable).values({
    bookId,
    title: "A published chapter",
    status: "published",
    publishedAt: new Date(),
  }).returning({ id: chaptersTable.id });
  chapterId = chapter.id;
});

afterAll(async () => {
  if (storyId) {
    if (reportedCommentIds.length) {
      await db.delete(reportsTable).where(and(
        eq(reportsTable.targetType, "comment"),
        inArray(reportsTable.targetId, reportedCommentIds),
      ));
    }
    if (reportedLegacyCommentIds.length) {
      await db.delete(reportsTable).where(and(
        eq(reportsTable.targetType, "comment"),
        inArray(reportsTable.targetId, reportedLegacyCommentIds),
      ));
      await db.delete(bookCommentsTable).where(inArray(bookCommentsTable.id, reportedLegacyCommentIds));
    }
    await db.delete(notificationsTable).where(or(
      inArray(notificationsTable.userId, [ownerId, authorId, replierId]),
      inArray(notificationsTable.actorId, [ownerId, authorId, replierId]),
    ));
    await db.delete(contentCommentsTable).where(and(
      eq(contentCommentsTable.contentType, "story"),
      eq(contentCommentsTable.contentId, storyId),
    ));
    await db.delete(storiesTable).where(eq(storiesTable.id, storyId));
  }
  if (outfitId) {
    await db.delete(contentCommentsTable).where(and(
      eq(contentCommentsTable.contentType, "outfit"),
      eq(contentCommentsTable.contentId, outfitId),
    ));
    await db.delete(outfitsTable).where(eq(outfitsTable.id, outfitId));
  }
  if (chapterId) await db.delete(chaptersTable).where(eq(chaptersTable.id, chapterId));
  if (bookId) await db.delete(booksTable).where(eq(booksTable.id, bookId));
  await db.delete(characterTable).where(inArray(characterTable.userId, [ownerId, authorId, replierId]));
});

function postComment(userId: string, content: string, parentId?: string) {
  setTestUserId(userId);
  return request(app)
    .post(`/api/content/story/${storyId}/comments`)
    .send({ content, ...(parentId ? { parentId } : {}) });
}

function reportComment(userId: string, commentId: string, reason: string) {
  setTestUserId(userId);
  return request(app)
    .post(`/api/content-comments/${commentId}/report`)
    .send({ reason });
}

function requestOutfitComments(userId: string) {
  setTestUserId(userId);
  return request(app).get(`/api/content/outfit/${outfitId}/comments`);
}

function postOutfitComment(userId: string, content: string) {
  setTestUserId(userId);
  return request(app)
    .post(`/api/content/outfit/${outfitId}/comments`)
    .send({ content });
}

describe("content comment notifications", () => {
  it("notifies content owners and replied-to authors once, without notifying the actor", async () => {
    const root = await postComment(authorId, "A kind top-level comment");
    expect(root.status).toBe(201);
    const rootCommentId = root.body.id as string;

    let ownerNotices = await db.select().from(notificationsTable)
      .where(and(eq(notificationsTable.userId, ownerId), eq(notificationsTable.type, "content_comment")));
    expect(ownerNotices).toHaveLength(1);
    expect(ownerNotices[0]?.actorId).toBe(authorId);
    expect(ownerNotices[0]?.refId).toBe(`story:${storyId}:${rootCommentId}:`);

    const ownComment = await postComment(ownerId, "The owner comments too");
    expect(ownComment.status).toBe(201);
    ownerNotices = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, ownerId));
    expect(ownerNotices).toHaveLength(1);

    const reply = await postComment(replierId, "A thoughtful reply", rootCommentId);
    expect(reply.status).toBe(201);
    const replyRef = `story:${storyId}:${reply.body.id}:${rootCommentId}`;
    const replyNotices = await db.select().from(notificationsTable)
      .where(and(inArray(notificationsTable.userId, [ownerId, authorId]), eq(notificationsTable.refId, replyRef)));
    expect(replyNotices).toHaveLength(2);
    expect(replyNotices.map(notice => notice.userId).sort()).toEqual([authorId, ownerId].sort());
    expect(replyNotices.every(notice => notice.type === "content_reply")).toBe(true);

    const selfOwnedThread = await postComment(ownerId, "A comment by the owner");
    expect(selfOwnedThread.status).toBe(201);
    const replyToOwner = await postComment(replierId, "A reply to the owner", selfOwnedThread.body.id);
    expect(replyToOwner.status).toBe(201);
    const sameRecipientNotices = await db.select().from(notificationsTable)
      .where(and(eq(notificationsTable.userId, ownerId), eq(notificationsTable.refId,
        `story:${storyId}:${replyToOwner.body.id}:${selfOwnedThread.body.id}`)));
    expect(sameRecipientNotices).toHaveLength(1);
  });

  it("accepts private comment reports once per reporter without penalizing the author", async () => {
    const comment = await postComment(authorId, "A comment to report");
    expect(comment.status).toBe(201);
    const commentId = comment.body.id as string;
    reportedCommentIds.push(commentId);

    const selfReport = await reportComment(authorId, commentId, "Spam or misleading");
    expect(selfReport.status).toBe(400);

    const firstReport = await reportComment(replierId, commentId, "Spam or misleading");
    expect(firstReport.status).toBe(201);
    expect(firstReport.body).toEqual({ ok: true, duplicate: false });

    const duplicateReport = await reportComment(replierId, commentId, "Other");
    expect(duplicateReport.status).toBe(200);
    expect(duplicateReport.body).toEqual({ ok: true, duplicate: true });

    const secondReport = await reportComment(ownerId, commentId, "Harassment or hate speech");
    expect(secondReport.status).toBe(201);

    const rows = await db.select().from(reportsTable).where(and(
      eq(reportsTable.targetType, "comment"),
      eq(reportsTable.targetId, commentId),
    ));
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.status === "pending")).toBe(true);

    const [author] = await db.select({ isBanned: characterTable.isBanned }).from(characterTable)
      .where(eq(characterTable.userId, authorId));
    expect(author.isBanned).toBe(false);
  });

  it("accepts reports on an eligible legacy book comment once per reporter", async () => {
    const [comment] = await db.insert(bookCommentsTable).values({
      chapterId,
      userId: authorId,
      content: "A legacy book comment to report",
    }).returning({ id: bookCommentsTable.id });
    reportedLegacyCommentIds.push(comment.id);

    const selfReport = await reportComment(authorId, comment.id, "Spam or misleading");
    expect(selfReport.status).toBe(400);

    const firstReport = await reportComment(replierId, comment.id, "Spam or misleading");
    expect(firstReport.status).toBe(201);
    expect(firstReport.body).toEqual({ ok: true, duplicate: false });

    const duplicateReport = await reportComment(replierId, comment.id, "Other");
    expect(duplicateReport.status).toBe(200);
    expect(duplicateReport.body).toEqual({ ok: true, duplicate: true });

    const secondReport = await reportComment(ownerId, comment.id, "Harassment or hate speech");
    expect(secondReport.status).toBe(201);

    const rows = await db.select().from(reportsTable).where(and(
      eq(reportsTable.targetType, "comment"),
      eq(reportsTable.targetId, comment.id),
    ));
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.reporterId).sort()).toEqual([ownerId, replierId].sort());
  });
});

describe("public outfit comments", () => {
  it("lets one signed-in visitor post and another account read the saved outfit comment", async () => {
    const posted = await postOutfitComment(authorId, "The colors look wonderful.");
    expect(posted.status).toBe(201);
    expect(posted.body).toMatchObject({
      contentType: "outfit",
      contentId: outfitId,
      content: "The colors look wonderful.",
      isMine: true,
      isContentOwner: false,
    });

    const authorRefresh = await requestOutfitComments(authorId);
    expect(authorRefresh.status).toBe(200);
    expect(authorRefresh.body.comments).toContainEqual(expect.objectContaining({
      id: posted.body.id,
      contentType: "outfit",
      contentId: outfitId,
      content: "The colors look wonderful.",
      isMine: true,
    }));

    const otherAccountRefresh = await requestOutfitComments(replierId);
    expect(otherAccountRefresh.status).toBe(200);
    expect(otherAccountRefresh.body.comments).toContainEqual(expect.objectContaining({
      id: posted.body.id,
      contentType: "outfit",
      contentId: outfitId,
      content: "The colors look wonderful.",
      isMine: false,
      isContentOwner: false,
    }));
  });
});
