import express from "express";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  characterTable,
  db,
  notificationsTable,
  pushDevicesTable,
} from "@workspace/db";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: { headers: Record<string, string | string[] | undefined> }) => ({
    userId: req.headers["x-test-user-id"] ?? null,
  }),
  clerkClient: { users: { getUser: async () => null } },
}));

import notificationsRouter from "../routes/notifications";
import pushRouter from "../routes/push";
import { sendPushToTokens } from "../services/pushService";

const USER_A = `push-test-a-${randomUUID()}`;
const USER_B = `push-test-b-${randomUUID()}`;
const ACTOR = `push-test-actor-${randomUUID()}`;
const TOKEN = `ExponentPushToken[${randomUUID()}]`;
const TOKEN_2 = `ExponentPushToken[${randomUUID()}]`;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  Object.assign(req, { log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } });
  next();
});
app.use("/", notificationsRouter);
app.use("/", pushRouter);

function asUser(userId: string) {
  return {
    delete: (path: string) => request(app).delete(path).set("x-test-user-id", userId),
    post: (path: string) => request(app).post(path).set("x-test-user-id", userId),
  };
}

describe("notification ownership and push-device registration", () => {
  let userANotificationId = "";
  let userBNotificationId = "";

  beforeAll(async () => {
    await db.insert(characterTable).values([
      { userId: USER_A, name: "Push Test A" },
      { userId: USER_B, name: "Push Test B" },
      { userId: ACTOR, name: "Push Test Actor" },
    ]);
    const inserted = await db.insert(notificationsTable).values([
      { userId: USER_A, actorId: ACTOR, actorName: "Actor", type: "follow", refId: ACTOR, title: "Own item" },
      { userId: USER_B, actorId: ACTOR, actorName: "Actor", type: "follow", refId: ACTOR, title: "Other item" },
    ]).returning({ id: notificationsTable.id, userId: notificationsTable.userId });
    userANotificationId = inserted.find(row => row.userId === USER_A)!.id;
    userBNotificationId = inserted.find(row => row.userId === USER_B)!.id;
  });

  afterAll(async () => {
    await db.delete(pushDevicesTable).where(inArray(pushDevicesTable.token, [TOKEN, TOKEN_2]));
    await db.delete(notificationsTable).where(inArray(notificationsTable.id, [userANotificationId, userBNotificationId]));
    await db.delete(characterTable).where(inArray(characterTable.userId, [USER_A, USER_B, ACTOR]));
  });

  it("does not let one account delete another account's notification", async () => {
    const response = await asUser(USER_A).delete(`/notifications/${userBNotificationId}`);
    expect(response.status).toBe(200);
    const remains = await db.select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.id, userBNotificationId),
        eq(notificationsTable.userId, USER_B),
      ));
    expect(remains).toHaveLength(1);
  });

  it("moves a reused device token to the active account and scopes unregister", async () => {
    const first = await asUser(USER_A).post("/push/register").send({ token: TOKEN, platform: "android" });
    expect(first.status).toBe(200);

    const moved = await asUser(USER_B).post("/push/register").send({ token: TOKEN, platform: "android" });
    expect(moved.status).toBe(200);

    const [device] = await db.select().from(pushDevicesTable).where(eq(pushDevicesTable.token, TOKEN));
    expect(device?.userId).toBe(USER_B);
    const [oldOwner] = await db.select({ pushToken: characterTable.pushToken })
      .from(characterTable).where(eq(characterTable.userId, USER_A));
    expect(oldOwner?.pushToken).toBeNull();

    const wrongOwnerDelete = await asUser(USER_A).delete("/push/register").send({ token: TOKEN });
    expect(wrongOwnerDelete.status).toBe(200);
    const [stillRegistered] = await db.select().from(pushDevicesTable).where(eq(pushDevicesTable.token, TOKEN));
    expect(stillRegistered?.userId).toBe(USER_B);

    const correctOwnerDelete = await asUser(USER_B).delete("/push/register").send({ token: TOKEN });
    expect(correctOwnerDelete.status).toBe(200);
    const removed = await db.select().from(pushDevicesTable).where(eq(pushDevicesTable.token, TOKEN));
    expect(removed).toHaveLength(0);
  });

  it("fans legacy single-token notifications out to every active device", async () => {
    await db.insert(pushDevicesTable).values([
      { token: TOKEN, userId: USER_A, platform: "android" },
      { token: TOKEN_2, userId: USER_A, platform: "ios" },
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: "ok" }, { status: "ok" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await sendPushToTokens([{ token: TOKEN, title: "Test", body: "Hello" }]);
      expect(fetchMock).toHaveBeenCalledOnce();
      const options = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
      const sent = JSON.parse(String(options?.body)) as { to: string }[];
      expect(sent.map(message => message.to).sort()).toEqual([TOKEN, TOKEN_2].sort());
    } finally {
      vi.unstubAllGlobals();
      await db.delete(pushDevicesTable).where(inArray(pushDevicesTable.token, [TOKEN, TOKEN_2]));
    }
  });
});
