import { Router } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gt, inArray, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import {
  blocksTable,
  campfireRoomsTable,
  characterTable,
  db,
  followsTable,
  guideSessionActivitiesTable,
  guideSessionActivityResponsesTable,
  guideSessionAttendeesTable,
  guideSessionPollsTable,
  guideSessionPollVotesTable,
  guideSessionQuestionsTable,
  guideSessionQuestionVotesTable,
  guideSessionRecapsTable,
  guideSessionsTable,
  guideTutorialsTable,
  notificationsTable,
} from "@workspace/db";
import { getUserId, requireAuth } from "../middleware/auth";
import { claimUpload } from "../lib/uploadTracking";
import { sendPushToTokens } from "../services/pushService";
import {
  assertOwnedMediaReferences,
  hasGuideTutorialSchema,
  MediaOwnershipError,
  normalizeManagedMediaPath,
} from "../lib/mediaAccess";
import {
  hasGuideSessionEngagementSchema,
  hasGuideSessionInteractionsSchema,
} from "../lib/guideSessionEngagementSchema";

const router = Router();
const sessionColumns = {
  id: guideSessionsTable.id,
  guideId: guideSessionsTable.guideId,
  roomId: guideSessionsTable.roomId,
  title: guideSessionsTable.title,
  description: guideSessionsTable.description,
  coverImageUri: guideSessionsTable.coverImageUri,
  topic: guideSessionsTable.topic,
  startsAt: guideSessionsTable.startsAt,
  endsAt: guideSessionsTable.endsAt,
  capacity: guideSessionsTable.capacity,
  status: guideSessionsTable.status,
  reminderSentAt: guideSessionsTable.reminderSentAt,
  createdAt: guideSessionsTable.createdAt,
};
const sessionColumnsWithTutorial = { ...sessionColumns, tutorialId: guideSessionsTable.tutorialId };
type SessionRow = Omit<typeof guideSessionsTable.$inferSelect, "tutorialId"> & { tutorialId?: string | null };

async function getSessionById(sessionId: string): Promise<SessionRow | undefined> {
  const columns = await hasGuideTutorialSchema() ? sessionColumnsWithTutorial : sessionColumns;
  const [session] = await db.select(columns).from(guideSessionsTable)
    .where(eq(guideSessionsTable.id, sessionId)).limit(1);
  return session as SessionRow | undefined;
}

const CreateSessionSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(1200),
  coverImageUri: z.string().trim().max(2048).nullish().refine(value =>
    value == null || normalizeManagedMediaPath(value) !== null,
  ),
  topic: z.string().trim().max(80).optional().nullable(),
  startsAt: z.coerce.date(),
  durationMinutes: z.number().int().min(15).max(240),
  capacity: z.number().int().min(2).max(100).default(30),
  tutorialId: z.string().uuid().optional().nullable(),
});
const RescheduleSessionSchema = z.object({
  startsAt: z.coerce.date(),
});

const TutorialProgressSchema = z.object({
  completedSteps: z.number().int().min(0).max(24),
});
const PollInputSchema = z.object({
  question: z.string().trim().min(5).max(180),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(6)
    .refine(options => new Set(options.map(option => option.toLocaleLowerCase())).size === options.length),
});
const PollVoteSchema = z.object({ optionIndex: z.number().int().min(0).max(5) });
const SessionQuestionSchema = z.object({ question: z.string().trim().min(4).max(500) });
const SessionAnswerSchema = z.object({ answer: z.string().trim().min(2).max(1000) });
const SessionRecapSchema = z.object({
  summary: z.string().trim().min(20).max(1200),
  highlights: z.array(z.string().trim().min(2).max(140)).max(6).default([]),
});
const SessionActivitySchema = z.object({
  title: z.string().trim().min(3).max(100),
  prompt: z.string().trim().min(5).max(1000),
  kind: z.enum(["challenge", "reflection", "resource"]),
  resourceUrl: z.string().trim().url().max(2048).optional().nullable(),
}).superRefine((activity, context) => {
  if (activity.kind === "resource" && !activity.resourceUrl) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["resourceUrl"], message: "Add a link for this resource." });
  }
  if (activity.resourceUrl && !/^https?:\/\//i.test(activity.resourceUrl)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["resourceUrl"], message: "Resource links must use http or https." });
  }
});
const SessionActivityResponseSchema = z.object({
  response: z.string().trim().min(2).max(1000),
});
const SessionQuestionVoteSchema = z.object({ voted: z.boolean() });

async function getSessionAccess(sessionId: string, userId: string) {
  const [sessions, attendees] = await Promise.all([
    db.select({
      id: guideSessionsTable.id,
      guideId: guideSessionsTable.guideId,
      status: guideSessionsTable.status,
      startsAt: guideSessionsTable.startsAt,
      endsAt: guideSessionsTable.endsAt,
    }).from(guideSessionsTable).where(eq(guideSessionsTable.id, sessionId)).limit(1),
    db.select({ userId: guideSessionAttendeesTable.userId })
      .from(guideSessionAttendeesTable)
      .where(and(
        eq(guideSessionAttendeesTable.sessionId, sessionId),
        eq(guideSessionAttendeesTable.userId, userId),
      )).limit(1),
  ]);
  return { session: sessions[0], isAttendee: !!attendees[0] };
}

function isLiveSession(session: { status: string; startsAt: Date; endsAt: Date }) {
  const now = Date.now();
  return session.status === "scheduled" && session.startsAt.getTime() <= now && session.endsAt.getTime() > now;
}

async function serializeSessions(rows: SessionRow[], viewerId: string) {
  if (!rows.length) return [];
  const guideIds = [...new Set(rows.map(row => row.guideId))];
  const visibleGuides = await db.select({ userId: characterTable.userId })
    .from(characterTable)
    .where(and(
      inArray(characterTable.userId, guideIds),
      or(eq(characterTable.isHidden, false), eq(characterTable.userId, viewerId)),
    ));
  const visibleGuideIds = new Set(visibleGuides.map(row => row.userId));
  const visibleRows = rows.filter(row => visibleGuideIds.has(row.guideId));
  if (!visibleRows.length) return [];

  const ids = visibleRows.map(row => row.id);
  const schemaReady = await hasGuideTutorialSchema();
  const [counts, baseMine] = await Promise.all([
    db.select({ sessionId: guideSessionAttendeesTable.sessionId, attendeeCount: count() })
      .from(guideSessionAttendeesTable)
      .innerJoin(characterTable, eq(guideSessionAttendeesTable.userId, characterTable.userId))
      .where(and(
        inArray(guideSessionAttendeesTable.sessionId, ids),
        eq(characterTable.isHidden, false),
      ))
      .groupBy(guideSessionAttendeesTable.sessionId),
    db.select({ sessionId: guideSessionAttendeesTable.sessionId })
      .from(guideSessionAttendeesTable)
      .where(and(
        inArray(guideSessionAttendeesTable.sessionId, ids),
        eq(guideSessionAttendeesTable.userId, viewerId),
      )),
  ]);
  const mine = schemaReady
    ? await db.select({
      sessionId: guideSessionAttendeesTable.sessionId,
      tutorialProgress: guideSessionAttendeesTable.tutorialProgress,
      tutorialCompletedAt: guideSessionAttendeesTable.tutorialCompletedAt,
    }).from(guideSessionAttendeesTable).where(and(
      inArray(guideSessionAttendeesTable.sessionId, ids),
      eq(guideSessionAttendeesTable.userId, viewerId),
    ))
    : baseMine.map(row => ({ ...row, tutorialProgress: 0, tutorialCompletedAt: null }));
  const tutorialIds = schemaReady
    ? [...new Set(visibleRows.flatMap(row => row.tutorialId ? [row.tutorialId] : []))]
    : [];
  const tutorialRows = schemaReady && tutorialIds.length
    ? await db.select().from(guideTutorialsTable).where(inArray(guideTutorialsTable.id, tutorialIds))
    : [];
  const countById = new Map(counts.map(row => [row.sessionId, Number(row.attendeeCount)]));
  const mineById = new Map(mine.map(row => [row.sessionId, row]));
  const tutorialsById = new Map(tutorialRows.map(row => [row.id, row]));
  const followerOnlyGuideIds = [...new Set(visibleRows.flatMap(row => {
    const tutorial = row.tutorialId ? tutorialsById.get(row.tutorialId) : null;
    return tutorial?.visibility === "followers" && row.guideId !== viewerId ? [row.guideId] : [];
  }))];
  const viewerFollows = followerOnlyGuideIds.length
    ? await db.select({ followingId: followsTable.followingId }).from(followsTable).where(and(
      eq(followsTable.followerId, viewerId),
      inArray(followsTable.followingId, followerOnlyGuideIds),
    ))
    : [];
  const viewerBlocks = followerOnlyGuideIds.length
    ? await db.select({ blockerId: blocksTable.blockerId, blockedId: blocksTable.blockedId })
      .from(blocksTable).where(or(
        and(eq(blocksTable.blockerId, viewerId), inArray(blocksTable.blockedId, followerOnlyGuideIds)),
        and(eq(blocksTable.blockedId, viewerId), inArray(blocksTable.blockerId, followerOnlyGuideIds)),
      ))
    : [];
  const blockedGuideIds = new Set(viewerBlocks.map(row =>
    row.blockerId === viewerId ? row.blockedId : row.blockerId,
  ));
  const followedGuideIds = new Set(viewerFollows
    .map(row => row.followingId)
    .filter(guideId => !blockedGuideIds.has(guideId)));
  return visibleRows.map(row => {
    const tutorial = row.tutorialId ? tutorialsById.get(row.tutorialId) ?? null : null;
    const isJoined = mineById.has(row.id) || row.guideId === viewerId;
    const canSeeTutorial = !!tutorial && tutorial.status === "published" && (
      row.guideId === viewerId ||
      tutorial.visibility === "public" ||
      (tutorial.visibility === "followers" && followedGuideIds.has(row.guideId)) ||
      (tutorial.visibility === "unlisted" && isJoined)
    );
    return {
      ...row,
      tutorialId: canSeeTutorial ? row.tutorialId ?? null : null,
      attendeeCount: countById.get(row.id) ?? 0,
      isJoined,
      tutorial: canSeeTutorial ? tutorial : null,
      tutorialProgress: mineById.get(row.id)?.tutorialProgress ?? 0,
      tutorialCompletedAt: mineById.get(row.id)?.tutorialCompletedAt ?? null,
    };
  });
}

router.get("/guide-sessions", requireAuth, async (req, res) => {
  res.set({
    "Cache-Control": "private, no-store",
    ETag: `W/"guide-sessions-${randomUUID()}"`,
  });
  const viewerId = getUserId(req);
  const guideId = typeof req.query.guideId === "string" ? req.query.guideId : null;
  const now = new Date();
  const columns = await hasGuideTutorialSchema() ? sessionColumnsWithTutorial : sessionColumns;
  const rows = await db.select(columns).from(guideSessionsTable)
    .where(and(
      eq(guideSessionsTable.status, "scheduled"),
      gt(guideSessionsTable.endsAt, now),
      ...(guideId ? [eq(guideSessionsTable.guideId, guideId)] : []),
    ))
    .orderBy(asc(guideSessionsTable.startsAt))
    .limit(100);
  return res.json(await serializeSessions(rows, viewerId));
});

router.get("/guide-sessions/:sessionId", requireAuth, async (req, res) => {
  const viewerId = getUserId(req);
  const row = await getSessionById(req.params.sessionId as string);
  if (!row) return res.status(404).json({ error: "Session not found" });
  const [session] = await serializeSessions([row], viewerId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  return res.json(session);
});

router.post("/guide-sessions", requireAuth, async (req, res) => {
  const guideId = getUserId(req);
  const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid session" });
  const [guide] = await db.select({ isGuide: characterTable.isGuide }).from(characterTable)
    .where(eq(characterTable.userId, guideId)).limit(1);
  if (!guide?.isGuide) return res.status(403).json({ error: "Only guides can create sessions" });
  const { title, description, topic, startsAt, durationMinutes, capacity, tutorialId } = parsed.data;
  if (tutorialId) {
    if (!(await hasGuideTutorialSchema())) {
      return res.status(503).json({ error: "Guide tutorials require the database migration before they can be used." });
    }
    const [tutorial] = await db.select({ id: guideTutorialsTable.id })
      .from(guideTutorialsTable)
      .where(and(
        eq(guideTutorialsTable.id, tutorialId),
        eq(guideTutorialsTable.guideId, guideId),
        eq(guideTutorialsTable.status, "published"),
      )).limit(1);
    if (!tutorial) return res.status(400).json({ error: "Choose one of your published tutorials" });
  }
  const coverImageUri = parsed.data.coverImageUri
    ? normalizeManagedMediaPath(parsed.data.coverImageUri)
    : null;
  if (parsed.data.coverImageUri && !coverImageUri) {
    return res.status(400).json({ error: "Invalid session cover image" });
  }
  try {
    await assertOwnedMediaReferences(guideId, [coverImageUri]);
  } catch (error) {
    if (error instanceof MediaOwnershipError) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
  if (startsAt.getTime() < Date.now() + 5 * 60_000) {
    return res.status(400).json({ error: "Session must start at least 5 minutes from now" });
  }
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const result = await db.transaction(async tx => {
    const [room] = await tx.insert(campfireRoomsTable)
      .values({ name: title, mood: "Peaceful", createdBy: guideId, isPreset: false }).returning();
    const columns = await hasGuideTutorialSchema() ? sessionColumnsWithTutorial : sessionColumns;
    const [session] = await tx.insert(guideSessionsTable).values({
      guideId,
      roomId: room.id,
      title,
      description,
      coverImageUri,
      topic: topic || null,
      startsAt,
      endsAt,
      capacity,
      ...(tutorialId ? { tutorialId } : {}),
    }).returning(columns);
    await tx.insert(guideSessionAttendeesTable).values({ sessionId: session.id, userId: guideId });
    return session;
  });
  claimUpload(coverImageUri);
  return res.status(201).json({ ...(await serializeSessions([result], guideId))[0] });
});

router.post("/guide-sessions/:sessionId/join", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const sessionId = req.params.sessionId as string;
  const session = await getSessionById(sessionId);
  if (!session || session.status !== "scheduled" || session.endsAt <= new Date()) {
    return res.status(404).json({ error: "Session is no longer available" });
  }
  if (session.tutorialId && await hasGuideTutorialSchema()) {
    const [tutorial] = await db.select({
      guideId: guideTutorialsTable.guideId,
      visibility: guideTutorialsTable.visibility,
      status: guideTutorialsTable.status,
    }).from(guideTutorialsTable).where(eq(guideTutorialsTable.id, session.tutorialId)).limit(1);
    if (!tutorial || tutorial.status !== "published") {
      return res.status(409).json({ error: "This session’s tutorial is no longer available." });
    }
    if (tutorial.visibility === "followers" && userId !== tutorial.guideId) {
      const [follow] = await db.select({ followingId: followsTable.followingId }).from(followsTable).where(and(
        eq(followsTable.followerId, userId),
        eq(followsTable.followingId, tutorial.guideId),
      )).limit(1);
      if (!follow) return res.status(403).json({ error: "Follow the guide to join this tutorial session." });
      const [block] = await db.select({ id: blocksTable.id }).from(blocksTable).where(or(
        and(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, tutorial.guideId)),
        and(eq(blocksTable.blockerId, tutorial.guideId), eq(blocksTable.blockedId, userId)),
      )).limit(1);
      if (block) return res.status(403).json({ error: "This session is unavailable between blocked accounts." });
    }
  }
  const [existing] = await db.select({ userId: guideSessionAttendeesTable.userId })
    .from(guideSessionAttendeesTable)
    .where(and(
      eq(guideSessionAttendeesTable.sessionId, sessionId),
      eq(guideSessionAttendeesTable.userId, userId),
    ))
    .limit(1);
  if (existing) return res.json({ ...(await serializeSessions([session], userId))[0] });
  const [capacity] = await db.select({ value: count() }).from(guideSessionAttendeesTable)
    .where(eq(guideSessionAttendeesTable.sessionId, sessionId));
  if (Number(capacity?.value ?? 0) >= session.capacity) return res.status(409).json({ error: "Session is full" });
  await db.insert(guideSessionAttendeesTable).values({ sessionId, userId }).onConflictDoNothing();
  return res.json({ ...(await serializeSessions([session], userId))[0] });
});

router.get("/guide-sessions/:sessionId/participants", requireAuth, async (req, res) => {
  const guideId = getUserId(req);
  const sessionId = req.params.sessionId as string;
  const [session] = await db.select({ id: guideSessionsTable.id, guideId: guideSessionsTable.guideId })
    .from(guideSessionsTable).where(eq(guideSessionsTable.id, sessionId)).limit(1);
  if (!session || session.guideId !== guideId) return res.status(404).json({ error: "Session not found" });
  const participants = await db.select({
    userId: guideSessionAttendeesTable.userId,
    name: characterTable.name,
    username: characterTable.username,
    avatarUri: characterTable.avatarUri,
    joinedAt: guideSessionAttendeesTable.joinedAt,
  }).from(guideSessionAttendeesTable)
    .innerJoin(characterTable, eq(guideSessionAttendeesTable.userId, characterTable.userId))
    .where(and(
      eq(guideSessionAttendeesTable.sessionId, sessionId),
      eq(characterTable.isHidden, false),
      eq(characterTable.isBanned, false),
    ))
    .orderBy(asc(guideSessionAttendeesTable.joinedAt));
  const schemaReady = await hasGuideTutorialSchema();
  const progress = schemaReady
    ? await db.select({
      userId: guideSessionAttendeesTable.userId,
      tutorialProgress: guideSessionAttendeesTable.tutorialProgress,
      tutorialCompletedAt: guideSessionAttendeesTable.tutorialCompletedAt,
    }).from(guideSessionAttendeesTable).where(eq(guideSessionAttendeesTable.sessionId, sessionId))
    : [];
  const progressByUser = new Map(progress.map(row => [row.userId, row]));
  return res.json(participants.map(participant => ({
    ...participant,
    tutorialProgress: progressByUser.get(participant.userId)?.tutorialProgress ?? 0,
    tutorialCompletedAt: progressByUser.get(participant.userId)?.tutorialCompletedAt ?? null,
  })));
});

router.get("/guide-sessions/:sessionId/engagement", requireAuth, async (req, res) => {
  if (!(await hasGuideSessionEngagementSchema())) {
    return res.status(503).json({ error: "Session polls, questions, and recaps require the engagement migration." });
  }
  const userId = getUserId(req);
  const { session, isAttendee } = await getSessionAccess(req.params.sessionId as string, userId);
  if (!session || (!isAttendee && session.guideId !== userId)) {
    return res.status(404).json({ error: "Join this session to view its activities." });
  }
  const interactionsReady = await hasGuideSessionInteractionsSchema();
  const [polls, votes, questions, recap] = await Promise.all([
    db.select().from(guideSessionPollsTable)
      .where(eq(guideSessionPollsTable.sessionId, session.id))
      .orderBy(asc(guideSessionPollsTable.createdAt))
      .limit(20),
    db.select({
      pollId: guideSessionPollVotesTable.pollId,
      optionIndex: guideSessionPollVotesTable.optionIndex,
      userId: guideSessionPollVotesTable.userId,
    }).from(guideSessionPollVotesTable)
      .innerJoin(guideSessionPollsTable, eq(guideSessionPollVotesTable.pollId, guideSessionPollsTable.id))
      .where(eq(guideSessionPollsTable.sessionId, session.id)),
    db.select({
      id: guideSessionQuestionsTable.id,
      question: guideSessionQuestionsTable.question,
      answer: guideSessionQuestionsTable.answer,
      createdAt: guideSessionQuestionsTable.createdAt,
      answeredAt: guideSessionQuestionsTable.answeredAt,
      userId: guideSessionQuestionsTable.userId,
      askerName: characterTable.name,
      askerHidden: characterTable.isHidden,
      askerBanned: characterTable.isBanned,
    }).from(guideSessionQuestionsTable)
      .innerJoin(characterTable, eq(guideSessionQuestionsTable.userId, characterTable.userId))
      .where(eq(guideSessionQuestionsTable.sessionId, session.id))
      .orderBy(asc(guideSessionQuestionsTable.createdAt))
      .limit(100),
    db.select().from(guideSessionRecapsTable)
      .where(eq(guideSessionRecapsTable.sessionId, session.id)).limit(1),
  ]);
  let questionVotes: Array<{ questionId: string; userId: string }> = [];
  let activities: Array<typeof guideSessionActivitiesTable.$inferSelect> = [];
  let activityResponses: Array<{
    activityId: string;
    userId: string;
    response: string;
    submittedAt: Date;
    name: string | null;
    username: string | null;
    isHidden: boolean;
    isBanned: boolean;
  }> = [];
  if (interactionsReady) {
    [questionVotes, activities, activityResponses] = await Promise.all([
      db.select({
        questionId: guideSessionQuestionVotesTable.questionId,
        userId: guideSessionQuestionVotesTable.userId,
      }).from(guideSessionQuestionVotesTable)
        .innerJoin(guideSessionQuestionsTable, eq(
          guideSessionQuestionVotesTable.questionId,
          guideSessionQuestionsTable.id,
        ))
        .where(eq(guideSessionQuestionsTable.sessionId, session.id)),
      db.select().from(guideSessionActivitiesTable)
        .where(eq(guideSessionActivitiesTable.sessionId, session.id))
        .orderBy(asc(guideSessionActivitiesTable.createdAt))
        .limit(50),
      db.select({
        activityId: guideSessionActivityResponsesTable.activityId,
        userId: guideSessionActivityResponsesTable.userId,
        response: guideSessionActivityResponsesTable.response,
        submittedAt: guideSessionActivityResponsesTable.submittedAt,
        name: characterTable.name,
        username: characterTable.username,
        isHidden: characterTable.isHidden,
        isBanned: characterTable.isBanned,
      }).from(guideSessionActivityResponsesTable)
        .innerJoin(characterTable, eq(
          guideSessionActivityResponsesTable.userId,
          characterTable.userId,
        ))
        .innerJoin(guideSessionActivitiesTable, eq(
          guideSessionActivityResponsesTable.activityId,
          guideSessionActivitiesTable.id,
        ))
        .where(eq(guideSessionActivitiesTable.sessionId, session.id))
        .orderBy(asc(guideSessionActivityResponsesTable.submittedAt))
        .limit(200),
    ]);
  }
  const questionVoteCounts = new Map<string, number>();
  const myQuestionVotes = new Set<string>();
  for (const vote of questionVotes) {
    questionVoteCounts.set(vote.questionId, (questionVoteCounts.get(vote.questionId) ?? 0) + 1);
    if (vote.userId === userId) myQuestionVotes.add(vote.questionId);
  }
  const visibleQuestions = questions
    .filter(question => !question.askerHidden && !question.askerBanned)
    .map(question => ({
      ...question,
      upvoteCount: questionVoteCounts.get(question.id) ?? 0,
      myUpvoted: myQuestionVotes.has(question.id),
      isMine: question.userId === userId,
    }))
    .sort((first, second) =>
      second.upvoteCount - first.upvoteCount
      || first.createdAt.getTime() - second.createdAt.getTime(),
    );
  return res.json({
    polls: polls.map(poll => {
      const pollVotes = votes.filter(vote => vote.pollId === poll.id);
      return {
        ...poll,
        voteCounts: poll.options.map((_, index) =>
          pollVotes.filter(vote => vote.optionIndex === index).length,
        ),
        myVote: pollVotes.find(vote => vote.userId === userId)?.optionIndex ?? null,
      };
    }),
    questions: visibleQuestions.map(question => ({
      id: question.id,
      question: question.question,
      answer: question.answer,
      createdAt: question.createdAt,
      answeredAt: question.answeredAt,
      askerName: question.askerName,
      upvoteCount: question.upvoteCount,
      myUpvoted: question.myUpvoted,
      isMine: question.isMine,
    })),
    activitiesReady: interactionsReady,
    questionVotingReady: interactionsReady,
    activities: activities.map(activity => {
      const visibleResponses = activityResponses.filter(response =>
        response.activityId === activity.id && !response.isHidden && !response.isBanned,
      );
      return {
        ...activity,
        responseCount: visibleResponses.length,
        myResponse: visibleResponses.find(response => response.userId === userId)?.response ?? null,
        responses: session.guideId === userId
          ? visibleResponses.map(response => ({
            userId: response.userId,
            displayName: response.name ?? response.username,
            response: response.response,
            submittedAt: response.submittedAt,
          }))
          : [],
      };
    }),
    recap: recap[0] ?? null,
  });
});

router.post("/guide-sessions/:sessionId/polls", requireAuth, async (req, res) => {
  if (!(await hasGuideSessionEngagementSchema())) {
    return res.status(503).json({ error: "Session polls require the engagement migration." });
  }
  const userId = getUserId(req);
  const parsed = PollInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid poll" });
  const { session } = await getSessionAccess(req.params.sessionId as string, userId);
  if (!session || session.guideId !== userId) return res.status(404).json({ error: "Session not found" });
  // Let guides prepare real polls before their scheduled start. Voting remains
  // live-only, so preparation cannot collect responses before a session opens.
  if (session.status !== "scheduled" || session.endsAt.getTime() <= Date.now()) {
    return res.status(409).json({ error: "Polls can be prepared for upcoming or live sessions only." });
  }
  const [existingPolls] = await db.select({ total: count() }).from(guideSessionPollsTable)
    .where(eq(guideSessionPollsTable.sessionId, session.id));
  if (Number(existingPolls?.total ?? 0) >= 20) {
    return res.status(409).json({ error: "This session has reached its poll limit." });
  }
  const [poll] = await db.insert(guideSessionPollsTable).values({
    sessionId: session.id,
    createdBy: userId,
    question: parsed.data.question,
    options: parsed.data.options,
  }).returning();
  return res.status(201).json({ ...poll, voteCounts: parsed.data.options.map(() => 0), myVote: null });
});

router.patch("/guide-sessions/:sessionId/polls/:pollId/vote", requireAuth, async (req, res) => {
  if (!(await hasGuideSessionEngagementSchema())) {
    return res.status(503).json({ error: "Session polls require the engagement migration." });
  }
  const userId = getUserId(req);
  const parsed = PollVoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose a valid poll option." });
  const { session, isAttendee } = await getSessionAccess(req.params.sessionId as string, userId);
  if (!session || (!isAttendee && session.guideId !== userId)) {
    return res.status(404).json({ error: "Join this session to vote." });
  }
  if (!isLiveSession(session)) return res.status(409).json({ error: "Voting is available while the session is live." });
  const [poll] = await db.select().from(guideSessionPollsTable).where(and(
    eq(guideSessionPollsTable.id, req.params.pollId as string),
    eq(guideSessionPollsTable.sessionId, session.id),
  )).limit(1);
  if (!poll || poll.closedAt) return res.status(409).json({ error: "This poll is closed." });
  if (parsed.data.optionIndex >= poll.options.length) return res.status(400).json({ error: "Choose a valid poll option." });
  await db.insert(guideSessionPollVotesTable).values({
    pollId: poll.id,
    userId,
    optionIndex: parsed.data.optionIndex,
  }).onConflictDoUpdate({
    target: [guideSessionPollVotesTable.pollId, guideSessionPollVotesTable.userId],
    set: { optionIndex: parsed.data.optionIndex, createdAt: new Date() },
  });
  return res.json({ ok: true });
});

router.patch("/guide-sessions/:sessionId/polls/:pollId/close", requireAuth, async (req, res) => {
  if (!(await hasGuideSessionEngagementSchema())) {
    return res.status(503).json({ error: "Session polls require the engagement migration." });
  }
  const userId = getUserId(req);
  const [session] = await db.select({ id: guideSessionsTable.id, guideId: guideSessionsTable.guideId })
    .from(guideSessionsTable).where(eq(guideSessionsTable.id, req.params.sessionId as string)).limit(1);
  if (!session || session.guideId !== userId) return res.status(404).json({ error: "Session not found" });
  const [poll] = await db.update(guideSessionPollsTable).set({ closedAt: new Date() })
    .where(and(
      eq(guideSessionPollsTable.id, req.params.pollId as string),
      eq(guideSessionPollsTable.sessionId, session.id),
    )).returning({ id: guideSessionPollsTable.id });
  if (!poll) return res.status(404).json({ error: "Poll not found" });
  return res.json({ ok: true });
});

router.post("/guide-sessions/:sessionId/questions", requireAuth, async (req, res) => {
  if (!(await hasGuideSessionEngagementSchema())) {
    return res.status(503).json({ error: "Session questions require the engagement migration." });
  }
  const userId = getUserId(req);
  const parsed = SessionQuestionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid question" });
  const { session, isAttendee } = await getSessionAccess(req.params.sessionId as string, userId);
  if (!session || !isAttendee || userId === session.guideId) {
    return res.status(403).json({ error: "Join the session as a participant to ask a question." });
  }
  if (!isLiveSession(session)) return res.status(409).json({ error: "Questions are open while the session is live." });
  const [existingQuestions] = await db.select({ total: count() }).from(guideSessionQuestionsTable)
    .where(and(
      eq(guideSessionQuestionsTable.sessionId, session.id),
      eq(guideSessionQuestionsTable.userId, userId),
    ));
  if (Number(existingQuestions?.total ?? 0) >= 10) {
    return res.status(409).json({ error: "You’ve reached the question limit for this session." });
  }
  const [question] = await db.insert(guideSessionQuestionsTable).values({
    sessionId: session.id,
    userId,
    question: parsed.data.question,
  }).returning();
  return res.status(201).json(question);
});

router.patch("/guide-sessions/:sessionId/questions/:questionId", requireAuth, async (req, res) => {
  if (!(await hasGuideSessionEngagementSchema())) {
    return res.status(503).json({ error: "Session questions require the engagement migration." });
  }
  const userId = getUserId(req);
  const parsed = SessionAnswerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid answer" });
  const [session] = await db.select({ id: guideSessionsTable.id, guideId: guideSessionsTable.guideId })
    .from(guideSessionsTable).where(eq(guideSessionsTable.id, req.params.sessionId as string)).limit(1);
  if (!session || session.guideId !== userId) return res.status(404).json({ error: "Session not found" });
  const [question] = await db.update(guideSessionQuestionsTable).set({
    answer: parsed.data.answer,
    answeredBy: userId,
    answeredAt: new Date(),
  }).where(and(
    eq(guideSessionQuestionsTable.id, req.params.questionId as string),
    eq(guideSessionQuestionsTable.sessionId, session.id),
  )).returning();
  if (!question) return res.status(404).json({ error: "Question not found" });
  return res.json(question);
});

router.put("/guide-sessions/:sessionId/questions/:questionId/vote", requireAuth, async (req, res) => {
  if (!(await hasGuideSessionInteractionsSchema())) {
    return res.status(503).json({ error: "Question voting requires the session interactions migration." });
  }
  const userId = getUserId(req);
  const parsed = SessionQuestionVoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose whether to upvote this question." });
  const { session, isAttendee } = await getSessionAccess(req.params.sessionId as string, userId);
  if (!session || !isAttendee || userId === session.guideId) {
    return res.status(403).json({ error: "Join the session as a participant to vote." });
  }
  if (!isLiveSession(session)) return res.status(409).json({ error: "Question voting is available while the session is live." });
  const [question] = await db.select({
    id: guideSessionQuestionsTable.id,
    userId: guideSessionQuestionsTable.userId,
  }).from(guideSessionQuestionsTable).where(and(
    eq(guideSessionQuestionsTable.id, req.params.questionId as string),
    eq(guideSessionQuestionsTable.sessionId, session.id),
  )).limit(1);
  if (!question) return res.status(404).json({ error: "Question not found." });
  if (question.userId === userId) return res.status(403).json({ error: "You can’t upvote your own question." });
  if (parsed.data.voted) {
    await db.insert(guideSessionQuestionVotesTable).values({
      questionId: question.id,
      userId,
    }).onConflictDoNothing();
  } else {
    await db.delete(guideSessionQuestionVotesTable).where(and(
      eq(guideSessionQuestionVotesTable.questionId, question.id),
      eq(guideSessionQuestionVotesTable.userId, userId),
    ));
  }
  const [votes] = await db.select({ total: count() }).from(guideSessionQuestionVotesTable)
    .where(eq(guideSessionQuestionVotesTable.questionId, question.id));
  return res.json({ ok: true, upvoteCount: Number(votes?.total ?? 0) });
});

router.post("/guide-sessions/:sessionId/activities", requireAuth, async (req, res) => {
  if (!(await hasGuideSessionInteractionsSchema())) {
    return res.status(503).json({ error: "Live activities require the session interactions migration." });
  }
  const userId = getUserId(req);
  const parsed = SessionActivitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid activity." });
  const { session } = await getSessionAccess(req.params.sessionId as string, userId);
  if (!session || session.guideId !== userId) return res.status(404).json({ error: "Session not found." });
  if (!isLiveSession(session)) return res.status(409).json({ error: "Activities can be launched while the session is live." });
  const now = new Date();
  const [activity] = await db.transaction(async tx => {
    await tx.update(guideSessionActivitiesTable).set({
      status: "completed",
      closedAt: now,
    }).where(and(
      eq(guideSessionActivitiesTable.sessionId, session.id),
      eq(guideSessionActivitiesTable.status, "active"),
    ));
    return tx.insert(guideSessionActivitiesTable).values({
      sessionId: session.id,
      guideId: userId,
      title: parsed.data.title,
      prompt: parsed.data.prompt,
      kind: parsed.data.kind,
      resourceUrl: parsed.data.resourceUrl ?? null,
      status: "active",
    }).returning();
  });
  return res.status(201).json({
    ...activity,
    responseCount: 0,
    myResponse: null,
    responses: [],
  });
});

router.post("/guide-sessions/:sessionId/activities/:activityId/responses", requireAuth, async (req, res) => {
  if (!(await hasGuideSessionInteractionsSchema())) {
    return res.status(503).json({ error: "Activity responses require the session interactions migration." });
  }
  const userId = getUserId(req);
  const parsed = SessionActivityResponseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid response." });
  const { session, isAttendee } = await getSessionAccess(req.params.sessionId as string, userId);
  if (!session || !isAttendee || userId === session.guideId) {
    return res.status(403).json({ error: "Join the session as a participant to respond." });
  }
  if (!isLiveSession(session)) return res.status(409).json({ error: "Activity responses are open while the session is live." });
  const [activity] = await db.select({ id: guideSessionActivitiesTable.id })
    .from(guideSessionActivitiesTable).where(and(
      eq(guideSessionActivitiesTable.id, req.params.activityId as string),
      eq(guideSessionActivitiesTable.sessionId, session.id),
      eq(guideSessionActivitiesTable.status, "active"),
    )).limit(1);
  if (!activity) return res.status(409).json({ error: "This activity is closed." });
  await db.insert(guideSessionActivityResponsesTable).values({
    activityId: activity.id,
    userId,
    response: parsed.data.response,
  }).onConflictDoUpdate({
    target: [guideSessionActivityResponsesTable.activityId, guideSessionActivityResponsesTable.userId],
    set: { response: parsed.data.response, submittedAt: new Date() },
  });
  return res.json({ ok: true });
});

router.patch("/guide-sessions/:sessionId/activities/:activityId/close", requireAuth, async (req, res) => {
  if (!(await hasGuideSessionInteractionsSchema())) {
    return res.status(503).json({ error: "Live activities require the session interactions migration." });
  }
  const userId = getUserId(req);
  const [session] = await db.select({
    id: guideSessionsTable.id,
    guideId: guideSessionsTable.guideId,
  }).from(guideSessionsTable).where(eq(guideSessionsTable.id, req.params.sessionId as string)).limit(1);
  if (!session || session.guideId !== userId) return res.status(404).json({ error: "Session not found." });
  const [activity] = await db.update(guideSessionActivitiesTable).set({
    status: "completed",
    closedAt: new Date(),
  }).where(and(
    eq(guideSessionActivitiesTable.id, req.params.activityId as string),
    eq(guideSessionActivitiesTable.sessionId, session.id),
    eq(guideSessionActivitiesTable.status, "active"),
  )).returning({ id: guideSessionActivitiesTable.id });
  if (!activity) return res.status(404).json({ error: "Active activity not found." });
  return res.json({ ok: true });
});

router.put("/guide-sessions/:sessionId/recap", requireAuth, async (req, res) => {
  if (!(await hasGuideSessionEngagementSchema())) {
    return res.status(503).json({ error: "Session recaps require the engagement migration." });
  }
  const userId = getUserId(req);
  const parsed = SessionRecapSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid recap" });
  const [session] = await db.select({
    id: guideSessionsTable.id,
    guideId: guideSessionsTable.guideId,
    status: guideSessionsTable.status,
    endsAt: guideSessionsTable.endsAt,
  }).from(guideSessionsTable).where(eq(guideSessionsTable.id, req.params.sessionId as string)).limit(1);
  if (!session || session.guideId !== userId) return res.status(404).json({ error: "Session not found" });
  if (session.status !== "completed" && session.endsAt.getTime() > Date.now()) {
    return res.status(409).json({ error: "A recap can be shared after the session ends." });
  }
  const [recap] = await db.insert(guideSessionRecapsTable).values({
    sessionId: session.id,
    guideId: userId,
    summary: parsed.data.summary,
    highlights: parsed.data.highlights,
  }).onConflictDoUpdate({
    target: guideSessionRecapsTable.sessionId,
    set: { summary: parsed.data.summary, highlights: parsed.data.highlights, updatedAt: new Date() },
  }).returning();
  return res.json(recap);
});

router.patch("/guide-sessions/:sessionId/progress", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const sessionId = req.params.sessionId as string;
  const parsed = TutorialProgressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid tutorial progress" });
  if (!(await hasGuideTutorialSchema())) {
    return res.status(503).json({ error: "Tutorial progress requires the database migration before it can be saved." });
  }
  const [session] = await db.select().from(guideSessionsTable)
    .where(eq(guideSessionsTable.id, sessionId)).limit(1);
  if (!session || !session.tutorialId) return res.status(404).json({ error: "Session tutorial not found" });
  const [tutorial] = await db.select({ stepCount: guideTutorialsTable.steps })
    .from(guideTutorialsTable).where(eq(guideTutorialsTable.id, session.tutorialId)).limit(1);
  if (!tutorial) return res.status(404).json({ error: "Session tutorial not found" });
  const [attendee] = await db.select({
    tutorialProgress: guideSessionAttendeesTable.tutorialProgress,
  }).from(guideSessionAttendeesTable).where(and(
    eq(guideSessionAttendeesTable.sessionId, sessionId),
    eq(guideSessionAttendeesTable.userId, userId),
  )).limit(1);
  if (!attendee) return res.status(403).json({ error: "Join the session before saving tutorial progress" });
  const completedSteps = Math.max(
    attendee.tutorialProgress,
    Math.min(parsed.data.completedSteps, tutorial.stepCount.length),
  );
  await db.update(guideSessionAttendeesTable).set({
    tutorialProgress: completedSteps,
    tutorialCompletedAt: completedSteps >= tutorial.stepCount.length ? new Date() : null,
  }).where(and(
    eq(guideSessionAttendeesTable.sessionId, sessionId),
    eq(guideSessionAttendeesTable.userId, userId),
  ));
  const [updated] = await serializeSessions([session], userId);
  return res.json(updated);
});

router.post("/guide-sessions/:sessionId/end", requireAuth, async (req, res) => {
  const guideId = getUserId(req);
  const [session] = await db.update(guideSessionsTable).set({ status: "completed" })
    .where(and(
      eq(guideSessionsTable.id, req.params.sessionId as string),
      eq(guideSessionsTable.guideId, guideId),
      eq(guideSessionsTable.status, "scheduled"),
    )).returning({ id: guideSessionsTable.id });
  if (!session) return res.status(404).json({ error: "Session not found or already ended" });
  if (await hasGuideSessionEngagementSchema()) {
    await db.update(guideSessionPollsTable).set({ closedAt: new Date() }).where(and(
      eq(guideSessionPollsTable.sessionId, session.id),
      isNull(guideSessionPollsTable.closedAt),
    ));
  }
  if (await hasGuideSessionInteractionsSchema()) {
    await db.update(guideSessionActivitiesTable).set({ status: "completed", closedAt: new Date() }).where(and(
      eq(guideSessionActivitiesTable.sessionId, session.id),
      eq(guideSessionActivitiesTable.status, "active"),
    ));
  }
  return res.json({ ok: true });
});

router.patch("/guide-sessions/:sessionId", requireAuth, async (req, res) => {
  const guideId = getUserId(req);
  const sessionId = req.params.sessionId as string;
  const parsed = RescheduleSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid start time" });
  }

  const startsAt = parsed.data.startsAt;
  const now = new Date();
  if (startsAt.getTime() < now.getTime() + 5 * 60_000) {
    return res.status(400).json({ error: "Choose a start time at least 5 minutes from now" });
  }

  const result = await db.transaction(async tx => {
    const [current] = await tx.select({
      id: guideSessionsTable.id,
      guideId: guideSessionsTable.guideId,
      title: guideSessionsTable.title,
      startsAt: guideSessionsTable.startsAt,
      endsAt: guideSessionsTable.endsAt,
    }).from(guideSessionsTable).where(and(
      eq(guideSessionsTable.id, sessionId),
      eq(guideSessionsTable.guideId, guideId),
      eq(guideSessionsTable.status, "scheduled"),
      gt(guideSessionsTable.startsAt, now),
    )).limit(1);
    if (!current) return { kind: "not-found" as const };

    const durationMs = current.endsAt.getTime() - current.startsAt.getTime();
    const endsAt = new Date(startsAt.getTime() + durationMs);
    const [updated] = await tx.update(guideSessionsTable).set({ startsAt, endsAt })
      .where(and(
        eq(guideSessionsTable.id, sessionId),
        eq(guideSessionsTable.guideId, guideId),
        eq(guideSessionsTable.status, "scheduled"),
        eq(guideSessionsTable.startsAt, current.startsAt),
        gt(guideSessionsTable.startsAt, now),
      )).returning({
        id: guideSessionsTable.id,
        title: guideSessionsTable.title,
      });
    if (!updated) return { kind: "conflict" as const };

    const recipients = await tx.select({
      userId: guideSessionAttendeesTable.userId,
      pushToken: characterTable.pushToken,
    }).from(guideSessionAttendeesTable)
      .innerJoin(characterTable, eq(characterTable.userId, guideSessionAttendeesTable.userId))
      .where(and(
        eq(guideSessionAttendeesTable.sessionId, sessionId),
        ne(guideSessionAttendeesTable.userId, guideId),
        eq(characterTable.isHidden, false),
        eq(characterTable.isBanned, false),
      ));
    const [guide] = await tx.select({ name: characterTable.name }).from(characterTable)
      .where(eq(characterTable.userId, guideId)).limit(1);
    if (recipients.length) {
      await tx.insert(notificationsTable).values(recipients.map(({ userId }) => ({
        userId,
        actorId: guideId,
        actorName: guide?.name ?? "Guide",
        type: "guide_session_rescheduled",
        refId: sessionId,
        title: `Session rescheduled: ${updated.title}`,
      })));
    }
    return { kind: "ok" as const, recipients };
  });

  if (result.kind === "not-found") return res.status(404).json({ error: "Session not found or no longer upcoming" });
  if (result.kind === "conflict") return res.status(409).json({ error: "This session changed. Refresh and try again." });

  void sendPushToTokens(result.recipients.flatMap(({ pushToken }) => pushToken ? [{
    token: pushToken,
    title: "Session rescheduled",
    body: "Your guide changed the time. Open the session to see the updated details.",
    data: { type: "guide_session_rescheduled", refId: sessionId, url: `/guide-session/${sessionId}` },
  }] : [])).catch(err => req.log.warn({ err, sessionId }, "Could not send guide-session reschedule push"));

  const row = await getSessionById(sessionId);
  if (!row) return res.status(404).json({ error: "Session not found" });
  const [session] = await serializeSessions([row], guideId);
  return res.json(session);
});

router.delete("/guide-sessions/:sessionId", requireAuth, async (req, res) => {
  const guideId = getUserId(req);
  const sessionId = req.params.sessionId as string;
  const now = new Date();
  const result = await db.transaction(async tx => {
    const [session] = await tx.update(guideSessionsTable).set({ status: "cancelled" })
      .where(and(
        eq(guideSessionsTable.id, sessionId),
        eq(guideSessionsTable.guideId, guideId),
        eq(guideSessionsTable.status, "scheduled"),
        gt(guideSessionsTable.startsAt, now),
      )).returning({ id: guideSessionsTable.id, title: guideSessionsTable.title });
    if (!session) return null;

    const recipients = await tx.select({
      userId: guideSessionAttendeesTable.userId,
      pushToken: characterTable.pushToken,
    }).from(guideSessionAttendeesTable)
      .innerJoin(characterTable, eq(characterTable.userId, guideSessionAttendeesTable.userId))
      .where(and(
        eq(guideSessionAttendeesTable.sessionId, sessionId),
        ne(guideSessionAttendeesTable.userId, guideId),
        eq(characterTable.isHidden, false),
        eq(characterTable.isBanned, false),
      ));
    const [guide] = await tx.select({ name: characterTable.name }).from(characterTable)
      .where(eq(characterTable.userId, guideId)).limit(1);
    if (recipients.length) {
      await tx.insert(notificationsTable).values(recipients.map(({ userId }) => ({
        userId,
        actorId: guideId,
        actorName: guide?.name ?? "Guide",
        type: "guide_session_cancelled",
        refId: sessionId,
        title: `Session cancelled: ${session.title}`,
      })));
    }
    return { session, recipients };
  });
  if (!result) return res.status(404).json({ error: "Session not found or no longer upcoming" });

  void sendPushToTokens(result.recipients.flatMap(({ pushToken }) => pushToken ? [{
    token: pushToken,
    title: "Session cancelled",
    body: "Your guide cancelled this upcoming session.",
    data: { type: "guide_session_cancelled", refId: guideId, url: `/guide/${guideId}` },
  }] : [])).catch(err => req.log.warn({ err, sessionId }, "Could not send guide-session cancellation push"));
  return res.json({ ok: true, notified: result.recipients.length });
});

export default router;