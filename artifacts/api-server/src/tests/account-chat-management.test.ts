import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  accountDeletionJobsTable,
  characterTable,
  db,
  deletedAccountHashesTable,
  messages as messagesTable,
  outfitsTable,
  storiesTable,
} from "@workspace/db";
import { createTestApp, setTestUserId } from "./helpers/testApp";
import messagesRouter from "../routes/messages";
import blocksRouter from "../routes/blocks";
import accountRouter from "../routes/account";
import { hashAuthUserId } from "../services/accountDeletion";
import * as sseEmitter from "../lib/sseEmitter";

vi.mock("../services/accountDeletion", async importOriginal => ({
  ...await importOriginal<typeof import("../services/accountDeletion")>(),
  queueAccountDeletionCleanup: vi.fn(),
}));

const prefix = `chat-safety-${randomUUID()}`;
const deletedUser = `${prefix}-deleted`;
const survivor = `${prefix}-survivor`;
const friendA = `${prefix}-friend-a`;
const friendB = `${prefix}-friend-b`;
const blocker = `${prefix}-blocker`;
const blocked = `${prefix}-blocked`;
const users = [deletedUser, survivor, friendA, friendB, blocker, blocked];
const app = createTestApp();
app.use((req, _res, next) => {
  req.log = { error: (...args: unknown[]) => console.error(...args) } as typeof req.log;
  next();
});
app.use("/api", messagesRouter);
app.use("/api", blocksRouter);
app.use("/api", accountRouter);

let ownedStoryId = "";
let survivorStoryId = "";
let ownedOutfitId = "";
let survivorOutfitId = "";
const messageIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];

beforeAll(async () => {
  await db.insert(characterTable).values(users.map((userId, index) => ({
    userId,
    name: `Fixture ${index}`,
    isPublic: true,
    isBanned: false,
  })));

  const [ownedStory] = await db.insert(storiesTable).values({
    userId: deletedUser, chapterTitle: "Owned story", mood: "Hopeful",
    isPublic: true, isHidden: false, date: new Date(), panels: [],
  }).returning({ id: storiesTable.id });
  ownedStoryId = ownedStory.id;
  const [otherStory] = await db.insert(storiesTable).values({
    userId: survivor, chapterTitle: "Survivor story", mood: "Hopeful",
    isPublic: true, isHidden: false, date: new Date(), panels: [],
  }).returning({ id: storiesTable.id });
  survivorStoryId = otherStory.id;

  const [ownedOutfit] = await db.insert(outfitsTable).values({
    userId: deletedUser, name: "Owned outfit", date: new Date(), isPublic: true,
  }).returning({ id: outfitsTable.id });
  ownedOutfitId = ownedOutfit.id;
  const [otherOutfit] = await db.insert(outfitsTable).values({
    userId: survivor, name: "Survivor outfit", date: new Date(), isPublic: true,
  }).returning({ id: outfitsTable.id });
  survivorOutfitId = otherOutfit.id;

  await db.insert(messagesTable).values([
    { id: messageIds[0], fromUserId: deletedUser, toUserId: survivor, content: "Keep this delivered text", imageUri: "/api/images/deleted-photo.jpg" },
    { id: messageIds[1], fromUserId: survivor, toUserId: deletedUser, content: "Keep the survivor's message", imageUri: "/api/images/survivor-photo.jpg" },
    { id: messageIds[2], fromUserId: friendA, toUserId: friendB, content: "Friend chat remains" },
    { id: messageIds[3], fromUserId: blocker, toUserId: blocked, content: "Blocked chat remains" },
    { id: messageIds[4], fromUserId: blocked, toUserId: blocker, content: "Reply remains" },
  ]);

  await db.execute(sql`
    INSERT INTO follows (follower_id, following_id) VALUES
      (${friendA}, ${friendB}), (${friendB}, ${friendA}),
      (${blocker}, ${blocked}), (${blocked}, ${blocker})
    ON CONFLICT DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO friend_requests (sender_id, recipient_id) VALUES
      (${friendA}, ${friendB}), (${blocked}, ${blocker})
    ON CONFLICT DO NOTHING
  `);
});

afterAll(async () => {
  await db.delete(accountDeletionJobsTable).where(eq(accountDeletionJobsTable.userId, deletedUser));
  await db.delete(deletedAccountHashesTable).where(eq(deletedAccountHashesTable.userIdHash, hashAuthUserId(deletedUser)));
    await db.delete(messagesTable).where(or(
      inArray(messagesTable.fromUserId, users),
      inArray(messagesTable.toUserId, users),
    ));
  await db.delete(storiesTable).where(inArray(storiesTable.id, [ownedStoryId, survivorStoryId].filter(Boolean)));
  await db.delete(outfitsTable).where(inArray(outfitsTable.id, [ownedOutfitId, survivorOutfitId].filter(Boolean)));
  await db.execute(sql`
    DELETE FROM follows WHERE follower_id IN (${sql.join(users.map(id => sql`${id}`), sql`, `)})
       OR following_id IN (${sql.join(users.map(id => sql`${id}`), sql`, `)})
  `);
  await db.execute(sql`
    DELETE FROM friend_requests WHERE sender_id IN (${sql.join(users.map(id => sql`${id}`), sql`, `)})
       OR recipient_id IN (${sql.join(users.map(id => sql`${id}`), sql`, `)})
  `);
  await db.execute(sql`
    DELETE FROM blocks WHERE blocker_id IN (${sql.join(users.map(id => sql`${id}`), sql`, `)})
       OR blocked_id IN (${sql.join(users.map(id => sql`${id}`), sql`, `)})
  `);
  await db.delete(characterTable).where(inArray(characterTable.userId, users));
});

describe("server-enforced chat and account actions", () => {
  it("loads recent messages first and keyset-paginates older conversation history", async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    await db.insert(messagesTable).values([
      { id: ids[0], fromUserId: friendA, toUserId: friendB, content: "Page one", createdAt: new Date("2099-01-01T00:00:00.000Z") },
      { id: ids[1], fromUserId: friendB, toUserId: friendA, content: "Page two", createdAt: new Date("2099-01-02T00:00:00.000Z") },
      { id: ids[2], fromUserId: friendA, toUserId: friendB, content: "Page three", createdAt: new Date("2099-01-03T00:00:00.000Z") },
    ]);
    setTestUserId(friendA);
    const latest = await request(app).get(`/api/messages/${friendB}?limit=2`);
    expect(latest.status).toBe(200);
    expect(latest.body.map((message: { id: string }) => message.id)).toEqual([ids[1], ids[2]]);

    const oldestInPage = latest.body[0] as { createdAt: string; id: string };
    const older = await request(app)
      .get(`/api/messages/${friendB}`)
      .query({ limit: 2, before: oldestInPage.createdAt, beforeId: oldestInPage.id });
    expect(older.status).toBe(200);
    expect(older.body.map((message: { id: string }) => message.id)).toContain(ids[0]);
  });

  it("rejects invalid conversation page cursors", async () => {
    setTestUserId(friendA);
    const invalid = await request(app)
      .get(`/api/messages/${friendB}`)
      .query({ before: "not-a-date", beforeId: "not-a-uuid" });
    expect(invalid.status).toBe(400);
  });

  it("removes a friend without blocking or deleting either account or chat", async () => {
    setTestUserId(friendA);
    const response = await request(app).delete(`/api/friends/${friendB}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ removed: true });

    const follows = await db.execute(sql`
      SELECT 1 FROM follows
       WHERE (follower_id = ${friendA} AND following_id = ${friendB})
          OR (follower_id = ${friendB} AND following_id = ${friendA})
    `);
    const requests = await db.execute(sql`
      SELECT 1 FROM friend_requests
       WHERE (sender_id = ${friendA} AND recipient_id = ${friendB})
          OR (sender_id = ${friendB} AND recipient_id = ${friendA})
    `);
    expect(follows.rows).toHaveLength(0);
    expect(requests.rows).toHaveLength(0);
    expect((await db.select().from(characterTable).where(inArray(characterTable.userId, [friendA, friendB])))).toHaveLength(2);
    expect((await request(app).get(`/api/messages/${friendB}`)).body.map((row: { id: string }) => row.id)).toContain(messageIds[2]);
    expect((await request(app).post(`/api/messages/${friendB}`).send({ content: "Still allowed after removing friend" })).status).toBe(201);
  });

  it("blocks both users from new DMs and friend requests but keeps chat history readable", async () => {
    const events = vi.spyOn(sseEmitter, "emitSSEEvent");
    setTestUserId(blocker);
    const response = await request(app).post(`/api/users/${blocked}/block`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ blocked: true });
    expect(events).toHaveBeenCalledWith(`messages:${blocker}`, expect.objectContaining({ type: "block_relationship_changed" }));
    expect(events).not.toHaveBeenCalledWith(`messages:${blocked}`, expect.anything());
    events.mockRestore();

    expect((await request(app).get(`/api/messages/${blocked}`)).status).toBe(200);
    expect((await request(app).get("/api/messages")).body.map((row: { partnerId: string }) => row.partnerId)).toContain(blocked);
    expect((await request(app).post(`/api/messages/${blocked}`).send({ content: "Blocked DM" })).status).toBe(403);
    expect((await request(app).post(`/api/messages/${blocked}/typing`)).status).toBe(403);
    expect((await request(app).post(`/api/friends/requests/${blocked}`)).status).toBe(403);

    setTestUserId(blocked);
    expect((await request(app).get(`/api/messages/${blocker}`)).status).toBe(200);
    expect((await request(app).post(`/api/messages/${blocker}`).send({ content: "Blocked reply" })).status).toBe(403);
    expect((await request(app).post(`/api/friends/requests/${blocker}`)).status).toBe(403);
    const persistedMessages = await db.select().from(messagesTable).where(inArray(messagesTable.id, [messageIds[3], messageIds[4]]));
    expect(persistedMessages).toHaveLength(2);
  });

  it("allows contact again after the blocker unblocks, without losing retained messages", async () => {
    setTestUserId(blocker);
    expect((await request(app).delete(`/api/users/${blocked}/block`)).status).toBe(200);
    setTestUserId(blocked);
    expect((await request(app).post(`/api/messages/${blocker}`).send({ content: "Allowed after unblock" })).status).toBe(201);
    expect((await request(app).get(`/api/messages/${blocker}`)).body).toHaveLength(3);
  });

  it("deletes only the requested account's data and leaves the other participant's data intact", async () => {
    const events = vi.spyOn(sseEmitter, "emitSSEEvent");
    setTestUserId(deletedUser);
    // A forged body must never choose which account the server deletes.
    const deletion = await request(app).delete("/api/account").send({ userId: survivor });
    expect(deletion.status).toBe(202);
    expect(deletion.body.deleted).toBe(true);
    expect(events).toHaveBeenCalledWith(`messages:${survivor}`, { type: "partner_account_deleted", partnerId: deletedUser });
    events.mockRestore();

    expect(await db.select().from(characterTable).where(eq(characterTable.userId, deletedUser))).toHaveLength(0);
    expect(await db.select().from(characterTable).where(eq(characterTable.userId, survivor))).toHaveLength(1);
    expect(await db.select().from(storiesTable).where(eq(storiesTable.id, ownedStoryId))).toHaveLength(0);
    expect(await db.select().from(storiesTable).where(eq(storiesTable.id, survivorStoryId))).toHaveLength(1);
    expect(await db.select().from(outfitsTable).where(eq(outfitsTable.id, ownedOutfitId))).toHaveLength(0);
    expect(await db.select().from(outfitsTable).where(eq(outfitsTable.id, survivorOutfitId))).toHaveLength(1);

    setTestUserId(survivor);
    const conversation = await request(app).get(`/api/messages/${deletedUser}`);
    expect(conversation.status).toBe(200);
    expect(conversation.body.map((row: { id: string }) => row.id)).toEqual(expect.arrayContaining([messageIds[0], messageIds[1]]));
    const retained = await db.select().from(messagesTable).where(inArray(messagesTable.id, [messageIds[0], messageIds[1]]));
    expect(retained.find(message => message.id === messageIds[0])?.imageUri).toBeNull();
    expect(retained.find(message => message.id === messageIds[1])?.imageUri).toBe("/api/images/survivor-photo.jpg");

    setTestUserId(survivor);
    const inbox = await request(app).get("/api/messages");
    expect(inbox.status).toBe(200);
    expect(inbox.body.find((thread: { partnerId: string }) => thread.partnerId === deletedUser)?.partnerName).toBe("Deleted account");
    expect(inbox.body.find((thread: { partnerId: string }) => thread.partnerId === deletedUser)?.partnerDeleted).toBe(true);
    expect((await request(app).post(`/api/messages/${deletedUser}`).send({
      clientMessageId: randomUUID(),
      content: "New message",
    })).status).toBe(404);
    expect((await request(app).post(`/api/messages/${deletedUser}/typing`)).status).toBe(404);
    const retainedConversation = await db.select({ id: messagesTable.id }).from(messagesTable).where(or(
      and(eq(messagesTable.fromUserId, deletedUser), eq(messagesTable.toUserId, survivor)),
      and(eq(messagesTable.fromUserId, survivor), eq(messagesTable.toUserId, deletedUser)),
    ));
    expect(retainedConversation.map(message => message.id)).toEqual(expect.arrayContaining([messageIds[0], messageIds[1]]));
    expect(retainedConversation).toHaveLength(2);

    setTestUserId(deletedUser);
    expect((await request(app).get("/api/messages")).status).toBe(403);
    await db.update(deletedAccountHashesTable).set({ expiresAt: new Date(0) })
      .where(eq(deletedAccountHashesTable.userIdHash, hashAuthUserId(deletedUser)));
    expect((await request(app).get("/api/messages")).status).toBe(403);
  });
});
