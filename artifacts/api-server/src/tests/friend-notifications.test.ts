import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  db,
  characterTable,
  friendRequestsTable,
  notificationsTable,
} from "@workspace/db";
import { createTestApp, setTestUserId } from "./helpers/testApp";

const app = createTestApp();
const prefix = `friend-notifications-${randomUUID()}`;
const requester = `${prefix}-requester`;
const recipient = `${prefix}-recipient`;
const users = [requester, recipient];

beforeAll(async () => {
  await db.insert(characterTable).values([
    { userId: requester, name: "Requesting Player", isPublic: true },
    { userId: recipient, name: "Receiving Player", isPublic: true },
  ]);
});

afterAll(async () => {
  await db.delete(friendRequestsTable).where(
    or(
      eq(friendRequestsTable.senderId, requester),
      eq(friendRequestsTable.recipientId, recipient),
    ),
  );
  await db.delete(notificationsTable).where(
    or(
      inArray(notificationsTable.userId, users),
      inArray(notificationsTable.actorId, users),
    ),
  );
  await db.delete(characterTable).where(inArray(characterTable.userId, users));
});

describe("friend request notifications", () => {
  it("persists and routes request and acceptance activity to the right users", async () => {
    setTestUserId(requester);
    const sent = await request(app)
      .post(`/api/friends/requests/${recipient}`)
      .send({});
    expect(sent.status).toBe(201);

    const requestNotification = await db.select().from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, recipient),
        eq(notificationsTable.type, "friend_request"),
      ));
    expect(requestNotification).toHaveLength(1);
    expect(requestNotification[0]).toMatchObject({
      actorId: requester,
      actorName: "Requesting Player",
      refId: sent.body.id,
      title: "Sent you a friend request",
    });

    setTestUserId(recipient);
    const accepted = await request(app)
      .post(`/api/friends/requests/${sent.body.id}/accept`)
      .send({});
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ accepted: true });

    const acceptanceNotification = await db.select().from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, requester),
        eq(notificationsTable.type, "friend_accepted"),
      ));
    expect(acceptanceNotification).toHaveLength(1);
    expect(acceptanceNotification[0]).toMatchObject({
      actorId: recipient,
      actorName: "Receiving Player",
      refId: recipient,
      title: "Accepted your friend request",
    });
  });
});
