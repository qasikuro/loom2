import { integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const guideSessionsTable = pgTable("guide_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  guideId: text("guide_id").notNull(),
  roomId: uuid("room_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  topic: text("topic"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  capacity: integer("capacity").notNull().default(30),
  status: text("status").notNull().default("scheduled"),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const guideSessionAttendeesTable = pgTable("guide_session_attendees", {
  sessionId: uuid("session_id").notNull(),
  userId: text("user_id").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  pk: primaryKey({ columns: [table.sessionId, table.userId] }),
}));