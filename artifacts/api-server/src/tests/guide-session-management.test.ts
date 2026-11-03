import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import {
  campfireRoomsTable,
  characterTable,
  db,
  guideSessionAttendeesTable,
  guideSessionsTable,
  notificationsTable,
} from "@workspace/db";
import { setTestUserId } from "./helpers/testApp";
import guideSessionsRouter from "../routes/guide-sessions";

const app = express();
app.use(express.json());
app.use("/api", guideSessionsRouter);

const suffix = randomUUID();
const guideId = `test-session-manager-guide-${suffix}`;
const attendeeId = `test-session-manager-attendee-${suffix}`;
const hiddenAttendeeId = `test-session-manager-hidden-${suffix}`;
const outsiderId = `test-session-manager-outsider-${suffix}`;
let roomId: string | null = null;
let rescheduleSessionId: string | null = null;
let cancelSessionId: string | null = null;

beforeAll(async () => {
  await db.insert(characterTable).values([
    { userId: guideId, name: "Session Manager Guide", isGuide: true, isPublic: true, isBanned: false, isHidden: false },
    { userId: attendeeId, name: "Joined Participant", isPublic: true, isBanned: false, isHidden: false },
    { userId: hiddenAttendeeId, name: "Hidden Participant", isPublic: true, isBanned: false, isHidden: true },
    { userId: outsiderId, name: "Session Manager Outsider", isPublic: true, isBanned: false, isHidden: false },
  ]);
  const [room] = await db.insert(campfireRoomsTable).values({
    name: "Session management verification",
    createdBy: guideId,
    mood: "Hopeful",
    isPreset: false,
  }).returning({ id: campfireRoomsTable.id });
  roomId = room.id;

  const startsAt = new Date(Date.now() + 2 * 60 * 60_000);
  const endsAt = new Date(startsAt.getTime() + 45 * 60_000);
  const sessions = await db.insert(guideSessionsTable).values([
    {
      guideId,
      roomId: room.id,
      title: "Session to reschedule",
      description: "Management route test.",
      startsAt,
      endsAt,
      capacity: 8,
      status: "scheduled",
    },
    {
      guideId,
      roomId: room.id,
      title: "Session to cancel",
      description: "Cancellation notification test.",
      startsAt: new Date(startsAt.getTime() + 24 * 60 * 60_000),
      endsAt: new Date(endsAt.getTime() + 24 * 60 * 60_000),
      capacity: 8,
      status: "scheduled",
    },
  ]).returning({ id: guideSessionsTable.id });
  [rescheduleSessionId, cancelSessionId] = sessions.map(session => session.id);

  await db.insert(guideSessionAttendeesTable).values([
    { sessionId: rescheduleSessionId, userId: guideId },
    { sessionId: rescheduleSessionId, userId: attendeeId },
    { sessionId: rescheduleSessionId, userId: hiddenAttendeeId },
    { sessionId: cancelSessionId, userId: guideId },
    { sessionId: cancelSessionId, userId: attendeeId },
    { sessionId: cancelSessionId, userId: hiddenAttendeeId },
  ]);
});

afterAll(async () => {
  const sessionIds = [rescheduleSessionId, cancelSessionId].filter((id): id is string => !!id);
  if (sessionIds.length) {
    await db.delete(notificationsTable).where(and(
      inArray(notificationsTable.userId, [attendeeId, hiddenAttendeeId]),
      inArray(notificationsTable.refId, sessionIds),
    ));
    await db.delete(guideSessionAttendeesTable).where(inArray(guideSessionAttendeesTable.sessionId, sessionIds));
    await db.delete(guideSessionsTable).where(inArray(guideSessionsTable.id, sessionIds));
  }
  if (roomId) await db.delete(campfireRoomsTable).where(eq(campfireRoomsTable.id, roomId));
  await db.delete(characterTable).where(inArray(characterTable.userId, [
    guideId, attendeeId, hiddenAttendeeId, outsiderId,
  ]));
});

describe("guide session management", () => {
  it("returns a fresh JSON session list when a client reuses its previous ETag", async () => {
    setTestUserId(guideId);
    const listUrl = `/api/guide-sessions?guideId=${encodeURIComponent(guideId)}`;
    const first = await request(app).get(listUrl);
    expect(first.status).toBe(200);
    expect(Array.isArray(first.body)).toBe(true);
    expect(first.headers.etag).toBeTruthy();

    const second = await request(app).get(listUrl).set("If-None-Match", first.headers.etag);
    expect(second.status).toBe(200);
    expect(Array.isArray(second.body)).toBe(true);
    expect(second.body).toEqual(first.body);
    expect(second.headers.etag).not.toBe(first.headers.etag);
  });

  it("only allows the guide to reschedule, preserves duration, and notifies visible joined participants", async () => {
    expect(rescheduleSessionId).toBeTruthy();
    setTestUserId(outsiderId);
    const denied = await request(app).patch(`/api/guide-sessions/${rescheduleSessionId}`)
      .send({ startsAt: new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString() });
    expect(denied.status).toBe(404);

    setTestUserId(guideId);
    const nextStart = new Date(Date.now() + 4 * 24 * 60 * 60_000);
    const response = await request(app).patch(`/api/guide-sessions/${rescheduleSessionId}`)
      .send({ startsAt: nextStart.toISOString() });
    expect(response.status).toBe(200);
    expect(new Date(response.body.startsAt).getTime()).toBe(nextStart.getTime());
    expect(new Date(response.body.endsAt).getTime() - new Date(response.body.startsAt).getTime()).toBe(45 * 60_000);

    const notices = await db.select({
      userId: notificationsTable.userId,
      type: notificationsTable.type,
      refId: notificationsTable.refId,
    }).from(notificationsTable).where(eq(notificationsTable.refId, rescheduleSessionId!));
    expect(notices).toEqual([{
      userId: attendeeId,
      type: "guide_session_rescheduled",
      refId: rescheduleSessionId,
    }]);
  });

  it("cancels only upcoming scheduled sessions and notifies joined participants", async () => {
    expect(cancelSessionId).toBeTruthy();
    setTestUserId(outsiderId);
    const denied = await request(app).delete(`/api/guide-sessions/${cancelSessionId}`);
    expect(denied.status).toBe(404);

    setTestUserId(guideId);
    const response = await request(app).delete(`/api/guide-sessions/${cancelSessionId}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, notified: 1 });

    const [session] = await db.select({ status: guideSessionsTable.status })
      .from(guideSessionsTable).where(eq(guideSessionsTable.id, cancelSessionId!));
    expect(session.status).toBe("cancelled");

    const notices = await db.select({
      userId: notificationsTable.userId,
      type: notificationsTable.type,
      refId: notificationsTable.refId,
    }).from(notificationsTable).where(eq(notificationsTable.refId, cancelSessionId!));
    expect(notices).toEqual([{
      userId: attendeeId,
      type: "guide_session_cancelled",
      refId: cancelSessionId,
    }]);
  });

  it("rejects rescheduling a session less than five minutes from now", async () => {
    setTestUserId(guideId);
    const response = await request(app).patch(`/api/guide-sessions/${rescheduleSessionId}`)
      .send({ startsAt: new Date(Date.now() + 60_000).toISOString() });
    expect(response.status).toBe(400);
  });
});
