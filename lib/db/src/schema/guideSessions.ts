import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { guideSessionAttendeesTutorialColumns } from "./guideTutorials";

export const guideSessionsTable = pgTable("guide_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  guideId: text("guide_id").notNull(),
  roomId: uuid("room_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  coverImageUri: text("cover_image_uri"),
  topic: text("topic"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  capacity: integer("capacity").notNull().default(30),
  status: text("status").notNull().default("scheduled"),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  tutorialId: uuid("tutorial_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  dueIdx: index("guide_sessions_due_idx").on(table.status, table.startsAt),
  guideStartIdx: index("guide_sessions_guide_start_idx").on(table.guideId, table.startsAt),
}));

export const guideSessionAttendeesTable = pgTable("guide_session_attendees", {
  sessionId: uuid("session_id").notNull(),
  userId: text("user_id").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  ...guideSessionAttendeesTutorialColumns,
}, table => ({
  pk: primaryKey({ columns: [table.sessionId, table.userId] }),
  userIdx: index("guide_session_attendees_user_idx").on(table.userId),
}));

export const guideSessionPollsTable = pgTable("guide_session_polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  createdBy: text("created_by").notNull(),
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, table => ({
  sessionCreatedIdx: index("guide_session_polls_session_created_idx").on(table.sessionId, table.createdAt),
}));

export const guideSessionPollVotesTable = pgTable("guide_session_poll_votes", {
  pollId: uuid("poll_id").notNull(),
  userId: text("user_id").notNull(),
  optionIndex: integer("option_index").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  pk: primaryKey({ name: "guide_session_poll_votes_pkey", columns: [table.pollId, table.userId] }),
}));

export const guideSessionQuestionsTable = pgTable("guide_session_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  userId: text("user_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer"),
  answeredBy: text("answered_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
}, table => ({
  sessionCreatedIdx: index("guide_session_questions_session_created_idx").on(table.sessionId, table.createdAt),
}));

export const guideSessionRecapsTable = pgTable("guide_session_recaps", {
  sessionId: uuid("session_id").primaryKey(),
  guideId: text("guide_id").notNull(),
  summary: text("summary").notNull(),
  highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const guideSessionActivitiesTable = pgTable("guide_session_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  guideId: text("guide_id").notNull(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  kind: text("kind").notNull(),
  resourceUrl: text("resource_url"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, table => ({
  sessionCreatedIdx: index("guide_session_activities_session_created_idx").on(table.sessionId, table.createdAt),
}));

export const guideSessionActivityResponsesTable = pgTable("guide_session_activity_responses", {
  activityId: uuid("activity_id").notNull(),
  userId: text("user_id").notNull(),
  response: text("response").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  pk: primaryKey({ columns: [table.activityId, table.userId] }),
}));

export const guideSessionQuestionVotesTable = pgTable("guide_session_question_votes", {
  questionId: uuid("question_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  pk: primaryKey({ columns: [table.questionId, table.userId] }),
}));