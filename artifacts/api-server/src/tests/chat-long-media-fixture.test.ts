import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { and, eq, inArray, or } from "drizzle-orm";
import { db, messages as messagesTable, characterTable } from "@workspace/db";
import { createTestApp, setTestUserId } from "./helpers/testApp";

const storage = vi.hoisted(() => ({
  saved: [] as string[],
  deleted: [] as string[],
}));

vi.mock("../lib/objectStorage", () => ({
  objectStorageClient: {
    bucket: () => ({
      file: (path: string) => ({
        save: async () => { storage.saved.push(path); },
        delete: async () => { storage.deleted.push(path); },
      }),
    }),
  },
}));

import messagesRouter from "../routes/messages";
import chatFixturesRouter, {
  CHAT_FIXTURE_GRACE_PERIOD_MS,
  cleanupExpiredChatPerformanceFixtures,
} from "../routes/test-chat-fixtures";

const app = createTestApp();
app.use("/api", messagesRouter);
app.use("/api", chatFixturesRouter);

const ownerId = `chat-performance-owner-${randomUUID()}`;
const otherOwnerId = `chat-performance-other-${randomUUID()}`;
let partnerId: string | undefined;

beforeAll(async () => {
  vi.stubEnv("DEFAULT_OBJECT_STORAGE_BUCKET_ID", "chat-fixture-test-bucket");
  vi.stubEnv("SESSION_SECRET", "chat-fixture-test-signing-only");
  await db.insert(characterTable).values([
    { userId: ownerId, name: "Fixture test owner", isPublic: false },
    { userId: otherOwnerId, name: "Other fixture owner", isPublic: false },
  ]);
});

afterAll(async () => {
  if (partnerId) {
    const { pool } = await import("@workspace/db");
    await pool.query(
      "DELETE FROM messages WHERE (from_user_id=$1 AND to_user_id=$2) OR (from_user_id=$2 AND to_user_id=$1)",
      [ownerId, partnerId],
    );
    await db.delete(characterTable).where(eq(characterTable.userId, partnerId));
  }
  await db.delete(messagesTable).where(inArray(messagesTable.fromUserId, [ownerId, otherOwnerId]));
  await db.delete(characterTable).where(inArray(characterTable.userId, [ownerId, otherOwnerId]));
  vi.unstubAllEnvs();
});

describe("development chat performance fixtures", () => {
  it("seeds a long mixed-media DM with a known older anchor and safely removes it", async () => {
    setTestUserId(ownerId);
    const created = await request(app).post("/api/test-fixtures/chat-long-media");
    expect(created.status).toBe(201);
    expect(created.body.messageCount).toBe(440);
    expect(created.body.photoMessageCount).toBeGreaterThanOrEqual(20);
    expect(created.body.videoMessageCount).toBeGreaterThanOrEqual(20);
    expect(created.body.olderMessageId).toMatch(/^[0-9a-f-]{36}$/i);
    const createdPartnerId = created.body.partnerId as string;
    partnerId = createdPartnerId;

    const rows = await db.select().from(messagesTable).where(or(
      and(eq(messagesTable.fromUserId, ownerId), eq(messagesTable.toUserId, createdPartnerId)),
      and(eq(messagesTable.fromUserId, createdPartnerId), eq(messagesTable.toUserId, ownerId)),
    ));
    expect(rows).toHaveLength(440);
    expect(rows.filter(row => row.imageUri)).toHaveLength(created.body.photoMessageCount);
    expect(rows.filter(row => row.videoUri && row.thumbnailUri)).toHaveLength(created.body.videoMessageCount);
    const anchor = rows.find(row => row.id === created.body.olderMessageId);
    expect(anchor?.content).toBe("CHAT_PERFORMANCE_OLDER_ANCHOR");
    expect(Date.now() - (anchor?.createdAt.getTime() ?? Date.now())).toBeGreaterThan(200_000);
    expect(storage.saved).toHaveLength(60);

    const recentPage = await request(app).get(`/api/messages/${createdPartnerId}?limit=50`);
    expect(recentPage.status).toBe(200);
    expect(recentPage.body.some((row: { imageUri: string | null }) => row.imageUri)).toBe(true);
    expect(recentPage.body.some((row: { videoUri: string | null; thumbnailUri: string | null }) =>
      row.videoUri && row.thumbnailUri,
    )).toBe(true);

    setTestUserId(otherOwnerId);
    expect((await request(app).delete(`/api/test-fixtures/chat-long-media/${createdPartnerId}`)).status).toBe(404);
    setTestUserId(ownerId);
    const removed = await request(app).delete(`/api/test-fixtures/chat-long-media/${createdPartnerId}`);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ removed: true });
    expect(storage.deleted).toHaveLength(60);
    expect(await db.select().from(messagesTable).where(or(
      and(eq(messagesTable.fromUserId, ownerId), eq(messagesTable.toUserId, createdPartnerId)),
      and(eq(messagesTable.fromUserId, createdPartnerId), eq(messagesTable.toUserId, ownerId)),
    ))).toEqual([]);
    expect(await db.select().from(characterTable).where(eq(characterTable.userId, createdPartnerId))).toEqual([]);
    partnerId = undefined;
  });

  it("returns not found when fixture routes are reached in production mode", async () => {
    setTestUserId(ownerId);
    vi.stubEnv("NODE_ENV", "production");
    expect((await request(app).post("/api/test-fixtures/chat-long-media")).status).toBe(404);
    vi.stubEnv("NODE_ENV", "test");
  });

  it("expires only old synthetic fixtures and leaves ordinary chats and uploaded media alone", async () => {
    setTestUserId(ownerId);
    const created = await request(app).post("/api/test-fixtures/chat-long-media");
    expect(created.status).toBe(201);
    const createdPartnerId = created.body.partnerId as string;
    partnerId = createdPartnerId;

    const ordinaryUpload = "/api/images/ordinary-user-upload.jpg";
    const [ordinaryMessage] = await db.insert(messagesTable).values({
      fromUserId: ownerId,
      toUserId: otherOwnerId,
      content: "A normal conversation must remain untouched.",
      imageUri: ordinaryUpload,
    }).returning();

    // A fresh fixture is retained until its full grace period has elapsed.
    storage.deleted.length = 0;
    await cleanupExpiredChatPerformanceFixtures();
    expect(await db.select().from(characterTable).where(eq(characterTable.userId, createdPartnerId))).toHaveLength(1);
    expect(storage.deleted).toHaveLength(0);

    const oldDate = new Date(Date.now() - CHAT_FIXTURE_GRACE_PERIOD_MS - 1);
    await db.update(messagesTable).set({ createdAt: oldDate }).where(or(
      and(eq(messagesTable.fromUserId, ownerId), eq(messagesTable.toUserId, createdPartnerId)),
      and(eq(messagesTable.fromUserId, createdPartnerId), eq(messagesTable.toUserId, ownerId)),
    ));

    await cleanupExpiredChatPerformanceFixtures();

    expect(storage.deleted).toHaveLength(60);
    expect(storage.deleted.every(path => path.includes(`chat-perf-${createdPartnerId.split("-").slice(-5).join("-")}`))).toBe(true);
    expect(storage.deleted).not.toContain("images/ordinary-user-upload.jpg");
    expect(await db.select().from(characterTable).where(eq(characterTable.userId, createdPartnerId))).toEqual([]);
    expect(await db.select().from(messagesTable).where(eq(messagesTable.id, ordinaryMessage.id))).toEqual([ordinaryMessage]);
    expect(ordinaryMessage.imageUri).toBe(ordinaryUpload);
    partnerId = undefined;
  });
});
