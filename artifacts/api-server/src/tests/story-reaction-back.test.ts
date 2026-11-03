import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  runStartupMigrations,
  characterTable,
  notificationsTable,
  stickerReactionsTable,
  storiesTable,
} from "@workspace/db";
import { createTestApp, setTestUserId } from "./helpers/testApp";

const app = createTestApp();
const runId = randomUUID();
const viewerId = `reaction-reply-viewer-${runId}`;
const reactorId = `reaction-reply-actor-${runId}`;
const unrelatedUserId = `reaction-reply-unrelated-${runId}`;
let storyId: string;
let otherStoryId: string;
let notificationId: string;
let unrelatedNotificationId: string;

beforeAll(async () => {
  await runStartupMigrations();
  await db.insert(characterTable).values([
    { userId: viewerId, name: "Reply viewer", username: `replyviewer${runId.slice(0, 6)}` },
    { userId: reactorId, name: "Story reactor", username: `reactor${runId.slice(0, 6)}` },
    { userId: unrelatedUserId, name: "Unrelated user" },
  ]);

  const stories = await db.insert(storiesTable).values([
    {
      userId: viewerId,
      chapterTitle: "A story to reply to",
      mood: "Hopeful",
      isPublic: true,
      date: new Date(),
      panels: [],
    },
    {
      userId: reactorId,
      chapterTitle: "Another person's story",
      mood: "Peaceful",
      isPublic: true,
      date: new Date(),
      panels: [],
    },
  ]).returning({ id: storiesTable.id });
  [storyId, otherStoryId] = stories.map(story => story.id);

  const notifications = await db.insert(notificationsTable).values([
    {
      userId: viewerId,
      actorId: reactorId,
      actorName: "Story reactor",
      type: "witness",
      refId: storyId,
      title: "Story reactor viewed your story",
    },
    {
      userId: unrelatedUserId,
      actorId: reactorId,
      actorName: "Story reactor",
      type: "resonate",
      refId: storyId,
      title: "A different viewer's notification",
    },
  ]).returning({ id: notificationsTable.id });
  [notificationId, unrelatedNotificationId] = notifications.map(row => row.id);
});

afterAll(async () => {
  const cleanupStoryIds = [storyId, otherStoryId].filter(Boolean);
  if (cleanupStoryIds.length) {
    await db.delete(stickerReactionsTable).where(
      eq(stickerReactionsTable.fromUserId, viewerId),
    );
    await db.delete(notificationsTable).where(
      inArray(notificationsTable.refId, cleanupStoryIds),
    );
    await db.delete(storiesTable).where(
      inArray(storiesTable.id, cleanupStoryIds),
    );
  }
  await db.delete(characterTable).where(
    inArray(characterTable.userId, [viewerId, reactorId, unrelatedUserId]),
  );
});

describe("POST /api/stories/:id/reaction-back", () => {
  it("persists the reply for the notification's reactor and safely confirms retries", async () => {
    setTestUserId(viewerId);
    const path = `/api/stories/${storyId}/reaction-back`;
    const body = { notificationId, stickerType: "Dreamy", recipientId: unrelatedUserId };

    const first = await request(app).post(path).send(body);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      ok: true,
      alreadySent: false,
      recipientId: reactorId,
      stickerType: "Dreamy",
    });

    const [saved] = await db.select({
      fromUserId: stickerReactionsTable.fromUserId,
      toUserId: stickerReactionsTable.toUserId,
      storyId: stickerReactionsTable.storyId,
      stickerType: stickerReactionsTable.stickerType,
    }).from(stickerReactionsTable).where(
      and(
        eq(stickerReactionsTable.fromUserId, viewerId),
        eq(stickerReactionsTable.storyId, storyId),
        eq(stickerReactionsTable.stickerType, "Dreamy"),
      ),
    );
    expect(saved).toEqual({
      fromUserId: viewerId,
      toUserId: reactorId,
      storyId,
      stickerType: "Dreamy",
    });

    const [inboxNotification] = await db.select({
      userId: notificationsTable.userId,
      actorId: notificationsTable.actorId,
      type: notificationsTable.type,
      refId: notificationsTable.refId,
    }).from(notificationsTable).where(
      and(
        eq(notificationsTable.userId, reactorId),
        eq(notificationsTable.actorId, viewerId),
        eq(notificationsTable.refId, storyId),
      ),
    );
    expect(inboxNotification).toEqual({
      userId: reactorId,
      actorId: viewerId,
      type: "sticker",
      refId: storyId,
    });

    const retry = await request(app).post(path).send(body);
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ ok: true, alreadySent: true, recipientId: reactorId });
    const replies = await db.select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, reactorId),
        eq(notificationsTable.actorId, viewerId),
        eq(notificationsTable.refId, storyId),
        eq(notificationsTable.type, "sticker"),
      ));
    expect(replies).toHaveLength(1);
  });

  it("rejects notifications owned by another user, unrelated stories, and invalid stickers", async () => {
    setTestUserId(viewerId);

    const wrongOwner = await request(app)
      .post(`/api/stories/${storyId}/reaction-back`)
      .send({ notificationId: unrelatedNotificationId, stickerType: "Soft" });
    expect(wrongOwner.status).toBe(404);

    const wrongStory = await request(app)
      .post(`/api/stories/${otherStoryId}/reaction-back`)
      .send({ notificationId, stickerType: "Soft" });
    expect(wrongStory.status).toBe(404);

    const invalidSticker = await request(app)
      .post(`/api/stories/${storyId}/reaction-back`)
      .send({ notificationId, stickerType: "NotASticker" });
    expect(invalidSticker.status).toBe(400);
  });
});
