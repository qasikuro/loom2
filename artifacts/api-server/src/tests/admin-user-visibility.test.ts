import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { characterTable, db, moderationLogsTable } from "@workspace/db";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next(),
  getAuth: (req: { headers: Record<string, string | string[] | undefined> }) => ({
    userId: req.headers["x-test-user-id"] ?? null,
  }),
  clerkClient: {
    users: {
      getUser: async () => null,
      getUserList: async () => ({ data: [] }),
    },
  },
}));

import adminRouter from "../routes/admin";

const ADMIN_ID = `test-hide-admin-${randomUUID()}`;
const TARGET_ID = `test-hide-user-${randomUUID()}`;
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  Object.assign(req, { log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } });
  next();
});
app.use("/", adminRouter);

const adminRequest = (path: string) =>
  request(app).put(path).set("x-test-user-id", ADMIN_ID);

describe("admin user visibility controls", () => {
  beforeAll(async () => {
    await db.insert(characterTable).values([
      { userId: ADMIN_ID, name: "Visibility Admin", isAdmin: true },
      { userId: TARGET_ID, name: "Visibility Target" },
    ]);
  });

  afterAll(async () => {
    await db.delete(moderationLogsTable).where(and(
      eq(moderationLogsTable.adminId, ADMIN_ID),
      eq(moderationLogsTable.targetUserId, TARGET_ID),
    ));
    await db.delete(characterTable).where(eq(characterTable.userId, TARGET_ID));
    await db.delete(characterTable).where(eq(characterTable.userId, ADMIN_ID));
  });

  it("hides and restores a user without banning them, and records the moderation actions", async () => {
    const hidden = await adminRequest(`/admin/users/${TARGET_ID}/hide`);
    expect(hidden.status).toBe(200);
    expect(hidden.body).toEqual({ ok: true, isHidden: true });

    const [hiddenUser] = await db
      .select({ isHidden: characterTable.isHidden, isBanned: characterTable.isBanned })
      .from(characterTable)
      .where(eq(characterTable.userId, TARGET_ID));
    expect(hiddenUser).toEqual({ isHidden: true, isBanned: false });

    // Retry is idempotent and does not create duplicate history entries.
    expect((await adminRequest(`/admin/users/${TARGET_ID}/hide`)).status).toBe(200);
    const [hideLogCount] = await db
      .select({ count: count() })
      .from(moderationLogsTable)
      .where(and(
        eq(moderationLogsTable.adminId, ADMIN_ID),
        eq(moderationLogsTable.targetId, TARGET_ID),
        eq(moderationLogsTable.action, "hide_user"),
      ));
    expect(Number(hideLogCount.count)).toBe(1);

    const restored = await adminRequest(`/admin/users/${TARGET_ID}/unhide`);
    expect(restored.status).toBe(200);
    expect(restored.body).toEqual({ ok: true, isHidden: false });
    const [restoredUser] = await db
      .select({ isHidden: characterTable.isHidden, isBanned: characterTable.isBanned })
      .from(characterTable)
      .where(eq(characterTable.userId, TARGET_ID));
    expect(restoredUser).toEqual({ isHidden: false, isBanned: false });
  });

  it("does not let an administrator hide their own account", async () => {
    const result = await adminRequest(`/admin/users/${ADMIN_ID}/hide`);
    expect(result.status).toBe(400);
  });
});
