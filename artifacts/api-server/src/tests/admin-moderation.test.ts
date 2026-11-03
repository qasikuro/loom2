import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  characterTable,
  bookCommentsTable,
  booksTable,
  chaptersTable,
  contentCommentsTable,
  db,
  moderationLogsTable,
  notificationsTable,
  reportsTable,
  storiesTable,
} from "@workspace/db";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next(),
  getAuth: (req: { headers: Record<string, string | string[] | undefined> }) => ({
    userId: req.headers["x-test-user-id"] ?? null,
  }),
  clerkClient: { users: { getUser: async () => null } },
}));

import adminModerationRouter from "../routes/admin-moderation";

const ADMIN_ID = `test-mod-admin-${randomUUID()}`;
const AUTHOR_ID = `test-mod-author-${randomUUID()}`;
const REPORTER_ID = `test-mod-reporter-${randomUUID()}`;
const STORY_ID = randomUUID();
const COMMENT_ID = randomUUID();
const BOOK_ID = randomUUID();
const CHAPTER_ID = randomUUID();
const LEGACY_COMMENT_ID = randomUUID();
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  Object.assign(req, { log: { error: vi.fn() } });
  next();
});
app.use("/", adminModerationRouter);

const adminRequest = (method: "get" | "post" | "put", path: string) =>
  request(app)[method](path).set("x-test-user-id", ADMIN_ID);

describe("admin moderation", () => {
  beforeAll(async () => {
    await db.insert(characterTable).values([
      { userId: ADMIN_ID, name: "Moderation Admin", isAdmin: true },
      { userId: AUTHOR_ID, name: "Reported Author", username: `author-${randomUUID().slice(0, 8)}` },
      { userId: REPORTER_ID, name: "Reporter", username: `reporter-${randomUUID().slice(0, 8)}` },
    ]);
    await db.insert(storiesTable).values({
      id: STORY_ID,
      userId: AUTHOR_ID,
      chapterTitle: "Test story for moderation",
      description: "A test preview",
      mood: "Calm",
      isPublic: true,
      date: new Date(),
    });
    await db.insert(booksTable).values({
      id: BOOK_ID,
      userId: AUTHOR_ID,
      title: "Legacy moderation book",
      visibility: "public",
    });
    await db.insert(chaptersTable).values({
      id: CHAPTER_ID,
      bookId: BOOK_ID,
      title: "Legacy moderation chapter",
      status: "published",
      publishedAt: new Date(),
    });
    await db.insert(reportsTable).values([
      { reporterId: REPORTER_ID, targetType: "story", targetId: STORY_ID, reason: "Harassment" },
      { reporterId: REPORTER_ID, targetType: "story", targetId: STORY_ID, reason: "Harassment" },
      { reporterId: REPORTER_ID, targetType: "story", targetId: STORY_ID, reason: "Spam" },
      { reporterId: REPORTER_ID, targetType: "comment", targetId: COMMENT_ID, reason: "Spam or misleading" },
      { reporterId: REPORTER_ID, targetType: "comment", targetId: LEGACY_COMMENT_ID, reason: "Harassment" },
    ]);
    await db.insert(contentCommentsTable).values({
      id: COMMENT_ID,
      contentType: "story",
      contentId: STORY_ID,
      userId: AUTHOR_ID,
      content: "A reported comment should be visible to moderators.",
    });
    await db.insert(bookCommentsTable).values({
      id: LEGACY_COMMENT_ID,
      chapterId: CHAPTER_ID,
      userId: AUTHOR_ID,
      content: "An older book comment should be visible to moderators.",
    });
  });

  afterAll(async () => {
    await db.delete(moderationLogsTable).where(or(
      eq(moderationLogsTable.adminId, ADMIN_ID),
      eq(moderationLogsTable.targetId, STORY_ID),
      eq(moderationLogsTable.targetUserId, AUTHOR_ID),
    ));
    await db.delete(notificationsTable).where(and(
      eq(notificationsTable.userId, AUTHOR_ID),
      or(eq(notificationsTable.refId, STORY_ID), eq(notificationsTable.refId, LEGACY_COMMENT_ID)),
    ));
    await db.delete(reportsTable).where(or(
      eq(reportsTable.reporterId, REPORTER_ID),
      and(eq(reportsTable.targetType, "story"), eq(reportsTable.targetId, STORY_ID)),
      and(eq(reportsTable.targetType, "comment"), eq(reportsTable.targetId, COMMENT_ID)),
    ));
    await db.delete(contentCommentsTable).where(eq(contentCommentsTable.id, COMMENT_ID));
    await db.delete(bookCommentsTable).where(eq(bookCommentsTable.id, LEGACY_COMMENT_ID));
    await db.delete(chaptersTable).where(eq(chaptersTable.id, CHAPTER_ID));
    await db.delete(booksTable).where(eq(booksTable.id, BOOK_ID));
    await db.delete(storiesTable).where(eq(storiesTable.id, STORY_ID));
    await db.delete(characterTable).where(inArray(characterTable.userId, [ADMIN_ID, AUTHOR_ID, REPORTER_ID]));
  });

  it("requires an authenticated admin", async () => {
    expect((await request(app).get("/admin/moderation/queue")).status).toBe(401);
  });

  it("groups reports into prioritized queue items and exposes real report records", async () => {
    const queue = await adminRequest("get", "/admin/moderation/queue?filter=high");
    expect(queue.status).toBe(200);
    expect(queue.body.items).toHaveLength(1);
    expect(queue.body.items[0]).toMatchObject({
      targetId: STORY_ID,
      contentType: "Story",
      reportCount: 3,
      priority: "high",
      userName: "Reported Author",
    });

    const reports = await adminRequest("get", "/admin/moderation/reports?status=open");
    expect(reports.status).toBe(200);
    expect(reports.body.total).toBe(5);
    expect(reports.body.reports).toContainEqual(expect.objectContaining({
      targetType: "comment",
      targetId: COMMENT_ID,
      contentType: "Comment",
      preview: "A reported comment should be visible to moderators.",
      userName: "Reported Author",
      reporterName: "Reporter",
    }));
    const legacyCommentReport = reports.body.reports.find(
      (report: { targetId: string }) => report.targetId === LEGACY_COMMENT_ID,
    );
    expect(legacyCommentReport).toMatchObject({
      targetType: "comment",
      contentType: "Comment",
      title: "Legacy moderation book",
      preview: "An older book comment should be visible to moderators.",
      userName: "Reported Author",
      reporterName: "Reporter",
      status: "open",
    });
    const legacyQueue = await adminRequest("get", "/admin/moderation/queue");
    expect(legacyQueue.status).toBe(200);
    expect(legacyQueue.body.items).toContainEqual(expect.objectContaining({
      targetType: "comment",
      targetId: LEGACY_COMMENT_ID,
      preview: "An older book comment should be visible to moderators.",
    }));
    expect(reports.body.reports).toContainEqual(expect.objectContaining({
      targetType: "story",
      targetId: STORY_ID,
      reporterName: "Reporter",
      status: "open",
    }));

    const reviewing = await adminRequest("put", `/admin/moderation/reports/${legacyCommentReport.id}/status`)
      .send({ status: "reviewing", reason: "Checking the report" });
    expect(reviewing.status).toBe(200);
    const reviewingReports = await adminRequest("get", "/admin/moderation/reports?status=reviewing");
    expect(reviewingReports.body.total).toBe(1);
  });

  it("lets moderators hide and restore a reported comment without automatic account penalties", async () => {
    const hidden = await adminRequest("post", "/admin/moderation/actions").send({
      targetType: "comment",
      targetId: COMMENT_ID,
      action: "hide",
      reason: "Reviewing a reported comment",
    });
    expect(hidden.status).toBe(200);

    const [comment] = await db.select({
      isHidden: contentCommentsTable.isHidden,
    }).from(contentCommentsTable).where(eq(contentCommentsTable.id, COMMENT_ID));
    expect(comment.isHidden).toBe(true);

    const [author] = await db.select({
      isBanned: characterTable.isBanned,
    }).from(characterTable).where(eq(characterTable.userId, AUTHOR_ID));
    expect(author.isBanned).toBe(false);

    const [report] = await db.select({
      status: reportsTable.status,
    }).from(reportsTable).where(and(
      eq(reportsTable.targetType, "comment"),
      eq(reportsTable.targetId, COMMENT_ID),
    ));
    expect(report.status).toBe("resolved");

    const restored = await adminRequest("post", "/admin/moderation/actions").send({
      targetType: "comment",
      targetId: COMMENT_ID,
      action: "restore",
      reason: "Restore after review",
    });
    expect(restored.status).toBe(200);
  });

  it("hides and restores a legacy book comment without changing its text or report history", async () => {
    const hidden = await adminRequest("post", "/admin/moderation/actions").send({
      targetType: "comment",
      targetId: LEGACY_COMMENT_ID,
      action: "hide",
      reason: "Reviewing a legacy book comment",
    });
    expect(hidden.status).toBe(200);

    const [hiddenComment] = await db.select({
      content: bookCommentsTable.content,
      isHidden: bookCommentsTable.isHidden,
    }).from(bookCommentsTable).where(eq(bookCommentsTable.id, LEGACY_COMMENT_ID));
    expect(hiddenComment).toEqual({
      content: "An older book comment should be visible to moderators.",
      isHidden: true,
    });

    const [resolvedReport] = await db.select({
      status: reportsTable.status,
      reporterId: reportsTable.reporterId,
    }).from(reportsTable).where(and(
      eq(reportsTable.targetType, "comment"),
      eq(reportsTable.targetId, LEGACY_COMMENT_ID),
    ));
    expect(resolvedReport).toMatchObject({ status: "resolved", reporterId: REPORTER_ID });

    const restored = await adminRequest("post", "/admin/moderation/actions").send({
      targetType: "comment",
      targetId: LEGACY_COMMENT_ID,
      action: "restore",
      reason: "Restore after review",
    });
    expect(restored.status).toBe(200);

    const [restoredComment] = await db.select({
      content: bookCommentsTable.content,
      isHidden: bookCommentsTable.isHidden,
    }).from(bookCommentsTable).where(eq(bookCommentsTable.id, LEGACY_COMMENT_ID));
    expect(restoredComment).toEqual({
      content: "An older book comment should be visible to moderators.",
      isHidden: false,
    });

    const reportHistory = await db.select({
      status: reportsTable.status,
      reporterId: reportsTable.reporterId,
    }).from(reportsTable).where(and(
      eq(reportsTable.targetType, "comment"),
      eq(reportsTable.targetId, LEGACY_COMMENT_ID),
    ));
    expect(reportHistory).toEqual([{ status: "resolved", reporterId: REPORTER_ID }]);
  });

  it("records hide/restore actions, and keeps AI flags explicitly unavailable", async () => {
    const hidden = await adminRequest("post", "/admin/moderation/actions").send({
      targetType: "story",
      targetId: STORY_ID,
      action: "hide",
      reason: "Test moderation hide",
    });
    expect(hidden.status).toBe(200);
    expect(hidden.body.ok).toBe(true);

    const hiddenRecords = await adminRequest("get", "/admin/moderation/records?kind=hidden");
    expect(hiddenRecords.status).toBe(200);
    expect(hiddenRecords.body.records).toContainEqual(expect.objectContaining({
      targetId: STORY_ID,
      adminId: ADMIN_ID,
      reason: "Test moderation hide",
    }));

    const restored = await adminRequest("post", "/admin/moderation/actions").send({
      targetType: "story",
      targetId: STORY_ID,
      targetUserId: AUTHOR_ID,
      action: "restore",
      reason: "Test restore",
    });
    expect(restored.status).toBe(200);

    const history = await adminRequest("get", `/admin/moderation/records?kind=history&q=${STORY_ID}`);
    expect(history.status).toBe(200);
    expect(history.body.records.length).toBeGreaterThanOrEqual(2);

    const removed = await adminRequest("post", "/admin/moderation/actions").send({
      targetType: "story",
      targetId: STORY_ID,
      targetUserId: AUTHOR_ID,
      action: "remove",
      reason: "Test permanent removal",
    });
    expect(removed.status).toBe(200);
    const removedRecords = await adminRequest("get", `/admin/moderation/records?kind=removed&q=${STORY_ID}`);
    expect(removedRecords.status).toBe(200);
    expect(removedRecords.body.records[0]).toMatchObject({
      targetId: STORY_ID,
      reason: "Test permanent removal",
      adminId: ADMIN_ID,
    });

    const suspended = await adminRequest("post", "/admin/moderation/actions").send({
      targetType: "user",
      targetId: AUTHOR_ID,
      targetUserId: AUTHOR_ID,
      action: "suspend_user",
      suspensionDays: 2,
      reason: "Test temporary suspension",
    });
    expect(suspended.status).toBe(200);
    const [suspendedUser] = await db
      .select({ suspendedUntil: characterTable.suspendedUntil, isBanned: characterTable.isBanned })
      .from(characterTable)
      .where(eq(characterTable.userId, AUTHOR_ID));
    expect(suspendedUser.suspendedUntil?.getTime()).toBeGreaterThan(Date.now());
    expect(suspendedUser.isBanned).toBe(false);

    const banned = await adminRequest("post", "/admin/moderation/actions").send({
      targetType: "user",
      targetId: AUTHOR_ID,
      targetUserId: AUTHOR_ID,
      action: "ban_user",
      reason: "Test permanent ban",
    });
    expect(banned.status).toBe(200);
    const [bannedUser] = await db
      .select({ suspendedUntil: characterTable.suspendedUntil, isBanned: characterTable.isBanned })
      .from(characterTable)
      .where(eq(characterTable.userId, AUTHOR_ID));
    expect(bannedUser.isBanned).toBe(true);
    expect(bannedUser.suspendedUntil).toBeNull();

    const ai = await adminRequest("get", "/admin/moderation/queue?filter=ai_flagged");
    expect(ai.status).toBe(200);
    expect(ai.body).toMatchObject({ items: [], total: 0, aiAvailable: false });
  });
});
