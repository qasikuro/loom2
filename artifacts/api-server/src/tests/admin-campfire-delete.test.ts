/**
 * Tests for DELETE /admin/campfire-messages/:id
 *
 * Verifies:
 *   1. 200 is returned and the message row is removed from the DB.
 *   2. Pending reports targeting that message are auto-resolved.
 *   3. 404 is returned when the message does not exist.
 *
 * Strategy
 * --------
 * - Uses the full `app` so that pino-http is present (req.log is used in the
 *   success path).
 * - Clerk is mocked so that the x-test-user-id header becomes the acting userId.
 * - pushService is mocked to prevent real push notifications.
 * - All test rows use isolated IDs prefixed with "test-cf-del-" to avoid
 *   collisions with other test files.
 */

import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";

// ── Mocks (must be declared before any imports that pull in the mocked modules) ─

vi.mock("@clerk/express", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

vi.mock("@clerk/shared/keys", () => ({
  publishableKeyFromHost: () => "pk_test_placeholder_xxxxxxxxxxxxxxxx",
}));

vi.mock("../services/pushService", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
  sendPushToTokens:     vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/sseEmitter", () => ({
  emitSSEEvent:          vi.fn(),
  connectedClientCount:  vi.fn().mockReturnValue(0),
  addSSEClient:          vi.fn().mockReturnValue("1"),
  removeSSEClient:       vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import supertest from "supertest";
import { and, eq, inArray } from "drizzle-orm";

import app from "../app";
import {
  db,
  characterTable,
  campfireRoomsTable,
  campfireMessagesTable,
  reportsTable,
  notificationsTable,
} from "@workspace/db";
import { emitSSEEvent } from "../lib/sseEmitter";

// ── Test identities ────────────────────────────────────────────────────────────

const ADMIN_ID  = "test-cf-del-admin";
const AUTHOR_ID = "test-cf-del-author";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Authenticated DELETE as the admin user. */
const adminDelete = (path: string) =>
  supertest(app)
    .delete(`/api${path}`)
    .set("x-test-user-id", ADMIN_ID);

// ── Lifecycle ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await db
    .insert(characterTable)
    .values([
      { userId: ADMIN_ID,  name: "CfDelAdmin",  isAdmin: true },
      { userId: AUTHOR_ID, name: "CfDelAuthor", isAdmin: false },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  // Remove any notifications inserted by the endpoint during tests.
  await db
    .delete(notificationsTable)
    .where(inArray(notificationsTable.userId, [ADMIN_ID, AUTHOR_ID]));

  await db
    .delete(characterTable)
    .where(inArray(characterTable.userId, [ADMIN_ID, AUTHOR_ID]));
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("DELETE /admin/campfire-messages/:id", () => {
  it("returns 404 when the message does not exist", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await adminDelete(`/admin/campfire-messages/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("returns 200 and removes the message row from the DB", async () => {
    // Seed a campfire room + message.
    const [room] = await db
      .insert(campfireRoomsTable)
      .values({ name: "Test Room", mood: "Dreamy", createdBy: ADMIN_ID })
      .returning({ id: campfireRoomsTable.id });

    const expiresAt = new Date(Date.now() + 60_000);
    const [msg] = await db
      .insert(campfireMessagesTable)
      .values({
        roomId:     room.id,
        userId:     AUTHOR_ID,
        authorName: "CfDelAuthor",
        content:    "Hello campfire",
        expiresAt,
      })
      .returning({ id: campfireMessagesTable.id });

    const res = await adminDelete(`/admin/campfire-messages/${msg.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify the row is gone.
    const remaining = await db
      .select({ id: campfireMessagesTable.id })
      .from(campfireMessagesTable)
      .where(eq(campfireMessagesTable.id, msg.id));

    expect(remaining).toHaveLength(0);

    // Cleanup the room (message is already deleted).
    await db.delete(campfireRoomsTable).where(eq(campfireRoomsTable.id, room.id));
  });

  it("emits a deleted_message SSE event to the room channel after deletion", async () => {
    const mockEmit = vi.mocked(emitSSEEvent);
    mockEmit.mockClear();

    const [room] = await db
      .insert(campfireRoomsTable)
      .values({ name: "SSE Test Room", mood: "Dreamy", createdBy: ADMIN_ID })
      .returning({ id: campfireRoomsTable.id });

    const expiresAt = new Date(Date.now() + 60_000);
    const [msg] = await db
      .insert(campfireMessagesTable)
      .values({
        roomId:     room.id,
        userId:     AUTHOR_ID,
        authorName: "CfDelAuthor",
        content:    "SSE test message",
        expiresAt,
      })
      .returning({ id: campfireMessagesTable.id });

    const res = await adminDelete(`/admin/campfire-messages/${msg.id}`);
    expect(res.status).toBe(200);

    // SSE event must target the correct campfire channel with the deleted messageId
    expect(mockEmit).toHaveBeenCalledWith(
      `campfire:${room.id}`,
      { type: "deleted_message", messageId: msg.id },
    );

    // Cleanup
    await db.delete(campfireRoomsTable).where(eq(campfireRoomsTable.id, room.id));
  });

  it("auto-resolves pending reports targeting the deleted message", async () => {
    // Seed room + message.
    const [room] = await db
      .insert(campfireRoomsTable)
      .values({ name: "Test Room 2", mood: "Cozy", createdBy: ADMIN_ID })
      .returning({ id: campfireRoomsTable.id });

    const expiresAt = new Date(Date.now() + 60_000);
    const [msg] = await db
      .insert(campfireMessagesTable)
      .values({
        roomId:     room.id,
        userId:     AUTHOR_ID,
        authorName: "CfDelAuthor",
        content:    "Reported message",
        expiresAt,
      })
      .returning({ id: campfireMessagesTable.id });

    // Insert two reports: one pending (should be resolved) and one already
    // resolved (should remain unchanged).
    const [pendingReport, resolvedReport] = await db
      .insert(reportsTable)
      .values([
        {
          reporterId: ADMIN_ID,
          targetType: "campfire_message",
          targetId:   msg.id,
          reason:     "spam",
          status:     "pending",
        },
        {
          reporterId: ADMIN_ID,
          targetType: "campfire_message",
          targetId:   msg.id,
          reason:     "spam",
          status:     "resolved",
        },
      ])
      .returning({ id: reportsTable.id, status: reportsTable.status });

    const res = await adminDelete(`/admin/campfire-messages/${msg.id}`);
    expect(res.status).toBe(200);

    // Pending report must now be resolved.
    const [afterPending] = await db
      .select({ status: reportsTable.status, resolvedById: reportsTable.resolvedById })
      .from(reportsTable)
      .where(eq(reportsTable.id, pendingReport.id));

    expect(afterPending.status).toBe("resolved");
    expect(afterPending.resolvedById).toBe(ADMIN_ID);

    // Already-resolved report must remain resolved (status unchanged).
    const [afterResolved] = await db
      .select({ status: reportsTable.status })
      .from(reportsTable)
      .where(eq(reportsTable.id, resolvedReport.id));

    expect(afterResolved.status).toBe("resolved");

    // Cleanup.
    await db
      .delete(reportsTable)
      .where(
        inArray(reportsTable.id, [pendingReport.id, resolvedReport.id]),
      );
    await db.delete(campfireRoomsTable).where(eq(campfireRoomsTable.id, room.id));
  });
});
