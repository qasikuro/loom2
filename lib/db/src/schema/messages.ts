import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const messagesTable = pgTable("messages", {
  id:         uuid("id").primaryKey().defaultRandom(),
  fromUserId: text("from_user_id").notNull(),
  toUserId:   text("to_user_id").notNull(),
  content:    text("content"),
  expression: text("expression"),
  isRead:     boolean("is_read").notNull().default(false),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  deletedFor: text("deleted_for"), // 'sender' | 'both'
});

export interface GuideAvailability {
  days:     number[];  // 0 = Sun … 6 = Sat
  timeFrom: string;   // "HH:MM" 24-h
  timeTo:   string;   // "HH:MM" 24-h
}
