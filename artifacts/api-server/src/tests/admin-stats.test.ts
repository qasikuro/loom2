import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { db, characterTable } from "@workspace/db";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next(),
  getAuth: (req: { headers: Record<string, string | string[] | undefined> }) => ({
    userId: req.headers["x-test-user-id"] ?? null,
  }),
  clerkClient: { users: { getUser: async () => null } },
}));

import adminRouter from "../routes/admin";

const ADMIN_ID = "test-admin-stats-admin";
const ONLINE_ID = "test-admin-stats-online";
const HIDDEN_ID = "test-admin-stats-hidden";
const STALE_ID = "test-admin-stats-stale";
const BANNED_ID = "test-admin-stats-banned";
const FIXTURE_IDS = [ADMIN_ID, ONLINE_ID, HIDDEN_ID, STALE_ID, BANNED_ID];

const app = express();
app.use(express.json());
app.use("/", adminRouter);

describe("GET /admin/stats online user count", () => {
  beforeAll(async () => {
    await db.delete(characterTable).where(inArray(characterTable.userId, FIXTURE_IDS));
  });

  afterAll(async () => {
    await db.delete(characterTable).where(inArray(characterTable.userId, FIXTURE_IDS));
  });

  it("counts recent, visible, non-banned users rather than SSE connections", async () => {
    const onlineSince = new Date(Date.now() - 5 * 60 * 1000);
    const [baseline] = await db
      .select({ onlineUsers: count() })
      .from(characterTable)
      .where(and(
        eq(characterTable.showOnlineStatus, true),
        eq(characterTable.isBanned, false),
        gte(characterTable.lastSeenAt, onlineSince),
      ));

    const recent = new Date(Date.now() - 60 * 1000);
    const stale = new Date(Date.now() - 10 * 60 * 1000);
    await db.insert(characterTable).values([
      { userId: ADMIN_ID, isAdmin: true },
      { userId: ONLINE_ID, showOnlineStatus: true, lastSeenAt: recent },
      { userId: HIDDEN_ID, showOnlineStatus: false, lastSeenAt: recent },
      { userId: STALE_ID, showOnlineStatus: true, lastSeenAt: stale },
      { userId: BANNED_ID, showOnlineStatus: true, isBanned: true, lastSeenAt: recent },
    ]);

    const response = await request(app)
      .get("/admin/stats")
      .set("x-test-user-id", ADMIN_ID);

    expect(response.status).toBe(200);
    expect(response.body.onlineUsers).toBe(Number(baseline?.onlineUsers ?? 0) + 1);
  });
});