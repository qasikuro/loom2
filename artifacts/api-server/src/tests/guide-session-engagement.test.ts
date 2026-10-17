import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import {
  blocksTable,
  campfireRoomsTable,
  characterTable,
  db,
  followsTable,
  guideSessionAttendeesTable,
  guideSessionActivitiesTable,
  guideSessionActivityResponsesTable,
  guideSessionPollVotesTable,
  guideSessionPollsTable,
  guideSessionQuestionsTable,
  guideSessionQuestionVotesTable,
  guideSessionRecapsTable,
  guideSessionsTable,
  guideTutorialsTable,
} from "@workspace/db";
import { canReadGuideTutorialMedia } from "../lib/mediaAccess";
import { hasGuideSessionInteractionsSchema } from "../lib/guideSessionEngagementSchema";
import { setTestUserId } from "./helpers/testApp";
import guideSessionsRouter from "../routes/guide-sessions";

const app = express();
app.use(express.json());
app.use("/api", guideSessionsRouter);

const suffix = randomUUID();
const guideId = `test-engagement-guide-${suffix}`;
const firstAttendeeId = `test-engagement-first-${suffix}`;
const secondAttendeeId = `test-engagement-second-${suffix}`;
const outsiderId = `test-engagement-outsider-${suffix}`;
const mediaPath = `/api/images/guide-session-test-${suffix}.jpg`;
let tutorialId: string | null = null;
let followerTutorialId: string | null = null;
let sessionId: string | null = null;
let followerSessionId: string | null = null;
let roomId: string | null = null;

beforeAll(async () => {
  await db.insert(characterTable).values([
    { userId: guideId, name: "Engagement Guide", isGuide: true, isPublic: true, isBanned: false, isHidden: false },
    { userId: firstAttendeeId, name: "First Attendee", isPublic: true, isBanned: false, isHidden: false },
    { userId: secondAttendeeId, name: "Second Attendee", isPublic: true, isBanned: false, isHidden: false },
    { userId: outsiderId, name: "Session Outsider", isPublic: true, isBanned: false, isHidden: false },
  ]);
  const [room] = await db.insert(campfireRoomsTable).values({
    name: "Engagement verification",
    createdBy: guideId,
    mood: "Hopeful",
    isPreset: false,
  }).returning({ id: campfireRoomsTable.id });
  roomId = room.id;
  const [tutorial] = await db.insert(guideTutorialsTable).values({
    guideId,
    title: "Guide test tutorial",
    description: "Tutorial used for isolated guide-session verification.",
    visibility: "public",
    status: "published",
    steps: [
      { id: "step-1", type: "image", title: "Look", body: "Step one" },
      { id: "step-2", type: "text", title: "Try", body: "Step two" },
      { id: "step-3", type: "tip", title: "Share", body: "Step three" },
    ],
  }).returning({ id: guideTutorialsTable.id });
  tutorialId = tutorial.id;
  const [followerTutorial] = await db.insert(guideTutorialsTable).values({
    guideId,
    title: "Follower-only tutorial",
    description: "Private steps for followers.",
    visibility: "followers",
    status: "published",
    steps: [{ id: "private-step", type: "image", title: "Look closer", body: "Follower media", mediaUri: mediaPath }],
  }).returning({ id: guideTutorialsTable.id });
  followerTutorialId = followerTutorial.id;
  const [session] = await db.insert(guideSessionsTable).values({
    guideId,
    roomId: room.id,
    title: "Guide interaction test",
    description: "Temporary live session for engagement and privacy tests.",
    startsAt: new Date(Date.now() - 60_000),
    endsAt: new Date(Date.now() + 60 * 60_000),
    capacity: 5,
    status: "scheduled",
    tutorialId: tutorial.id,
  }).returning({ id: guideSessionsTable.id });
  sessionId = session.id;
  await db.insert(guideSessionAttendeesTable).values([
    { sessionId: session.id, userId: guideId },
    { sessionId: session.id, userId: firstAttendeeId },
    { sessionId: session.id, userId: secondAttendeeId },
  ]);
  const [followerSession] = await db.insert(guideSessionsTable).values({
    guideId,
    roomId: room.id,
    title: "Follower tutorial session",
    description: "A session that includes follower-only content.",
    startsAt: new Date(Date.now() - 60_000),
    endsAt: new Date(Date.now() + 60 * 60_000),
    capacity: 5,
    status: "scheduled",
    tutorialId: followerTutorial.id,
  }).returning({ id: guideSessionsTable.id });
  followerSessionId = followerSession.id;
  await db.insert(guideSessionAttendeesTable).values({ sessionId: followerSession.id, userId: guideId });
  await db.insert(followsTable).values({ followerId: firstAttendeeId, followingId: guideId });
});

afterAll(async () => {
  if (sessionId) {
    if (await hasGuideSessionInteractionsSchema()) {
      const activities = await db.select({ id: guideSessionActivitiesTable.id })
        .from(guideSessionActivitiesTable).where(eq(guideSessionActivitiesTable.sessionId, sessionId));
      if (activities.length) {
        await db.delete(guideSessionActivityResponsesTable)
          .where(inArray(guideSessionActivityResponsesTable.activityId, activities.map(activity => activity.id)));
      }
      await db.delete(guideSessionActivitiesTable).where(eq(guideSessionActivitiesTable.sessionId, sessionId));
      const questions = await db.select({ id: guideSessionQuestionsTable.id })
        .from(guideSessionQuestionsTable).where(eq(guideSessionQuestionsTable.sessionId, sessionId));
      if (questions.length) {
        await db.delete(guideSessionQuestionVotesTable)
          .where(inArray(guideSessionQuestionVotesTable.questionId, questions.map(question => question.id)));
      }
    }
    const polls = await db.select({ id: guideSessionPollsTable.id })
      .from(guideSessionPollsTable).where(eq(guideSessionPollsTable.sessionId, sessionId));
    if (polls.length) {
      await db.delete(guideSessionPollVotesTable)
        .where(inArray(guideSessionPollVotesTable.pollId, polls.map(poll => poll.id)));
    }
    await db.delete(guideSessionPollsTable).where(eq(guideSessionPollsTable.sessionId, sessionId));
    await db.delete(guideSessionQuestionsTable).where(eq(guideSessionQuestionsTable.sessionId, sessionId));
    await db.delete(guideSessionRecapsTable).where(eq(guideSessionRecapsTable.sessionId, sessionId));
    await db.delete(guideSessionAttendeesTable).where(eq(guideSessionAttendeesTable.sessionId, sessionId));
    await db.delete(guideSessionsTable).where(eq(guideSessionsTable.id, sessionId));
  }
  if (followerSessionId) {
    await db.delete(guideSessionAttendeesTable).where(eq(guideSessionAttendeesTable.sessionId, followerSessionId));
    await db.delete(guideSessionsTable).where(eq(guideSessionsTable.id, followerSessionId));
  }
  if (tutorialId) await db.delete(guideTutorialsTable).where(eq(guideTutorialsTable.id, tutorialId));
  if (followerTutorialId) await db.delete(guideTutorialsTable).where(eq(guideTutorialsTable.id, followerTutorialId));
  if (roomId) await db.delete(campfireRoomsTable).where(eq(campfireRoomsTable.id, roomId));
  await db.delete(followsTable).where(and(
    eq(followsTable.followerId, firstAttendeeId),
    eq(followsTable.followingId, guideId),
  ));
  await db.delete(blocksTable).where(and(
    eq(blocksTable.blockerId, firstAttendeeId),
    eq(blocksTable.blockedId, guideId),
  ));
  await db.delete(characterTable).where(inArray(characterTable.userId, [
    guideId, firstAttendeeId, secondAttendeeId, outsiderId,
  ]));
});

describe("guide session participation and tutorial privacy", () => {
  it("keeps attendee progress private while showing each account's own saved progress", async () => {
    expect(sessionId).toBeTruthy();
    setTestUserId(firstAttendeeId);
    const firstSave = await request(app).patch(`/api/guide-sessions/${sessionId}/progress`)
      .send({ completedSteps: 2 });
    expect(firstSave.status).toBe(200);
    expect(firstSave.body.tutorialProgress).toBe(2);

    setTestUserId(secondAttendeeId);
    const secondSave = await request(app).patch(`/api/guide-sessions/${sessionId}/progress`)
      .send({ completedSteps: 1 });
    expect(secondSave.status).toBe(200);
    expect(secondSave.body.tutorialProgress).toBe(1);

    const firstRead = await request(app).get(`/api/guide-sessions/${sessionId}`);
    expect(firstRead.status).toBe(200);
    expect(firstRead.body.tutorialProgress).toBe(1);
    expect(firstRead.body.tutorial.id).toBe(tutorialId);
    setTestUserId(firstAttendeeId);
    const firstAgain = await request(app).get(`/api/guide-sessions/${sessionId}`);
    expect(firstAgain.body.tutorialProgress).toBe(2);

    setTestUserId(guideId);
    const roster = await request(app).get(`/api/guide-sessions/${sessionId}/participants`);
    expect(roster.status).toBe(200);
    expect(roster.body.find((person: { userId: string }) => person.userId === firstAttendeeId).tutorialProgress).toBe(2);
    expect(roster.body.find((person: { userId: string }) => person.userId === secondAttendeeId).tutorialProgress).toBe(1);

    setTestUserId(outsiderId);
    const outsiderSave = await request(app).patch(`/api/guide-sessions/${sessionId}/progress`)
      .send({ completedSteps: 3 });
    expect(outsiderSave.status).toBe(403);
  });

  it("serves follower-only tutorial media only to the follower and revokes access on block", async () => {
    expect(tutorialId).toBeTruthy();
    expect(followerSessionId).toBeTruthy();
    setTestUserId(outsiderId);
    const outsiderSession = await request(app).get(`/api/guide-sessions/${followerSessionId}`);
    expect(outsiderSession.status).toBe(200);
    expect(outsiderSession.body.tutorial).toBeNull();
    expect(outsiderSession.body.tutorialId).toBeNull();
    const outsiderJoin = await request(app).post(`/api/guide-sessions/${followerSessionId}/join`);
    expect(outsiderJoin.status).toBe(403);

    setTestUserId(firstAttendeeId);
    const followerSession = await request(app).get(`/api/guide-sessions/${followerSessionId}`);
    expect(followerSession.body.tutorial?.id).toBe(followerTutorialId);
    const followerJoin = await request(app).post(`/api/guide-sessions/${followerSessionId}/join`);
    expect(followerJoin.status).toBe(200);

    expect(await canReadGuideTutorialMedia(mediaPath, firstAttendeeId, guideId)).toBe(true);
    expect(await canReadGuideTutorialMedia(mediaPath, secondAttendeeId, guideId)).toBe(false);

    await db.insert(blocksTable).values({ blockerId: firstAttendeeId, blockedId: guideId });
    expect(await canReadGuideTutorialMedia(mediaPath, firstAttendeeId, guideId)).toBe(false);
    const blockedSession = await request(app).get(`/api/guide-sessions/${followerSessionId}`);
    expect(blockedSession.body.tutorial).toBeNull();
  });

  it("allows host poll preparation before start but keeps participant voting live-only", async () => {
    const originalStart = new Date(Date.now() - 60_000);
    await db.update(guideSessionsTable).set({ startsAt: new Date(Date.now() + 600_000) })
      .where(eq(guideSessionsTable.id, sessionId!));
    let preparedPollId: string | undefined;
    try {
      setTestUserId(guideId);
      const prepared = await request(app).post(`/api/guide-sessions/${sessionId}/polls`)
        .send({ question: "What should we practice?", options: ["Exploring", "Collecting"] });
      expect(prepared.status).toBe(201);
      preparedPollId = prepared.body.id;
      setTestUserId(firstAttendeeId);
      const vote = await request(app).patch(`/api/guide-sessions/${sessionId}/polls/${preparedPollId}/vote`)
        .send({ optionIndex: 0 });
      expect(vote.status).toBe(409);
      const forbidden = await request(app).post(`/api/guide-sessions/${sessionId}/polls`)
        .send({ question: "Participant poll", options: ["Yes", "No"] });
      expect(forbidden.status).toBe(404);
      for (const status of ["cancelled", "completed"]) {
        await db.update(guideSessionsTable).set({ status }).where(eq(guideSessionsTable.id, sessionId!));
        setTestUserId(guideId);
        await request(app).post(`/api/guide-sessions/${sessionId}/polls`)
          .send({ question: "This cannot be created", options: ["Yes", "No"] }).expect(409);
      }
    } finally {
      if (preparedPollId) await db.delete(guideSessionPollsTable).where(eq(guideSessionPollsTable.id, preparedPollId));
      await db.update(guideSessionsTable).set({ status: "scheduled", startsAt: originalStart })
        .where(eq(guideSessionsTable.id, sessionId!));
    }
  });

  it("lets only joined attendees engage, and only the guide manage polls, answers, and recaps", async () => {
    expect(sessionId).toBeTruthy();
    setTestUserId(outsiderId);
    const outsiderRead = await request(app).get(`/api/guide-sessions/${sessionId}/engagement`);
    expect(outsiderRead.status).toBe(404);

    setTestUserId(guideId);
    const createdPoll = await request(app).post(`/api/guide-sessions/${sessionId}/polls`)
      .send({ question: "Which step helped most?", options: ["Planning", "Practice"] });
    expect(createdPoll.status).toBe(201);
    const pollId = createdPoll.body.id as string;

    setTestUserId(firstAttendeeId);
    const vote = await request(app).patch(`/api/guide-sessions/${sessionId}/polls/${pollId}/vote`)
      .send({ optionIndex: 1 });
    expect(vote.status).toBe(200);
    const asked = await request(app).post(`/api/guide-sessions/${sessionId}/questions`)
      .send({ question: "How can I practice this next week?" });
    expect(asked.status).toBe(201);

    setTestUserId(secondAttendeeId);
    const engagement = await request(app).get(`/api/guide-sessions/${sessionId}/engagement`);
    expect(engagement.status).toBe(200);
    expect(engagement.body.polls[0].voteCounts).toEqual([0, 1]);
    expect(engagement.body.polls[0].myVote).toBeNull();
    expect(engagement.body.questions).toHaveLength(1);
    expect(engagement.body.questions[0].question).toBe("How can I practice this next week?");
    expect(typeof engagement.body.activitiesReady).toBe("boolean");
    expect(typeof engagement.body.questionVotingReady).toBe("boolean");
    expect(engagement.body.activities).toEqual([]);
    if (engagement.body.activitiesReady) {
      const vote = await request(app).put(`/api/guide-sessions/${sessionId}/questions/${asked.body.id}/vote`)
        .send({ voted: true });
      expect(vote.status).toBe(200);
      expect(vote.body.upvoteCount).toBe(1);

      setTestUserId(guideId);
      const launched = await request(app).post(`/api/guide-sessions/${sessionId}/activities`)
        .send({ title: "Practice together", prompt: "Share one small way you will practice this week.", kind: "challenge" });
      expect(launched.status).toBe(201);
      const activityId = launched.body.id as string;

      setTestUserId(firstAttendeeId);
      const response = await request(app).post(`/api/guide-sessions/${sessionId}/activities/${activityId}/responses`)
        .send({ response: "I will practice for ten minutes each day." });
      expect(response.status).toBe(200);

      setTestUserId(secondAttendeeId);
      const privateView = await request(app).get(`/api/guide-sessions/${sessionId}/engagement`);
      const privateActivity = privateView.body.activities.find((item: { id: string }) => item.id === activityId);
      expect(privateActivity.responseCount).toBe(1);
      expect(privateActivity.myResponse).toBeNull();
      expect(privateActivity.responses).toEqual([]);

      setTestUserId(guideId);
      const hostView = await request(app).get(`/api/guide-sessions/${sessionId}/engagement`);
      const hostActivity = hostView.body.activities.find((item: { id: string }) => item.id === activityId);
      expect(hostActivity.responses).toHaveLength(1);
      expect(hostActivity.responses[0].response).toBe("I will practice for ten minutes each day.");
      const close = await request(app).patch(`/api/guide-sessions/${sessionId}/activities/${activityId}/close`);
      expect(close.status).toBe(200);
    } else {
      const vote = await request(app).put(`/api/guide-sessions/${sessionId}/questions/${asked.body.id}/vote`)
        .send({ voted: true });
      expect(vote.status).toBe(503);
      setTestUserId(guideId);
      const activity = await request(app).post(`/api/guide-sessions/${sessionId}/activities`)
        .send({ title: "Practice together", prompt: "Share one small way you will practice this week.", kind: "challenge" });
      expect(activity.status).toBe(503);
    }

    setTestUserId(guideId);
    const answered = await request(app).patch(`/api/guide-sessions/${sessionId}/questions/${asked.body.id}`)
      .send({ answer: "Try one short practice round each day." });
    expect(answered.status).toBe(200);
    const closed = await request(app).patch(`/api/guide-sessions/${sessionId}/polls/${pollId}/close`);
    expect(closed.status).toBe(200);
    const prematureRecap = await request(app).put(`/api/guide-sessions/${sessionId}/recap`)
      .send({ summary: "This summary should not be saved before the session ends." });
    expect(prematureRecap.status).toBe(409);

    await request(app).post(`/api/guide-sessions/${sessionId}/end`).expect(200);
    const recap = await request(app).put(`/api/guide-sessions/${sessionId}/recap`)
      .send({ summary: "We practiced small steps and shared ways to keep improving.", highlights: ["Plan one small practice", "Ask for feedback"] });
    expect(recap.status).toBe(200);
    expect(recap.body.highlights).toHaveLength(2);

    setTestUserId(secondAttendeeId);
    const postSession = await request(app).get(`/api/guide-sessions/${sessionId}/engagement`);
    expect(postSession.status).toBe(200);
    expect(postSession.body.recap.summary).toBe(recap.body.summary);
    expect(postSession.body.questions[0].answer).toBe("Try one short practice round each day.");
    expect(postSession.body.polls.every((poll: { closedAt: string | null }) => poll.closedAt)).toBe(true);
    expect(postSession.body.activities.every((activity: { status: string }) => activity.status === "completed")).toBe(true);
  });
});
