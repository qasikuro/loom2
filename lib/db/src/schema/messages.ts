/**
 * Direct messages between users.
 *
 * The `id` column is a UUID primary key (gen_random_uuid()), matching the
 * deployed database schema.  All other columns are additive DM fields that
 * may be missing on older deployments and are backfilled by the startup
 * migration in db/src/index.ts via ADD COLUMN IF NOT EXISTS.
 */
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id:         uuid("id").primaryKey().defaultRandom(),
  fromUserId: text("from_user_id").notNull(),
  toUserId:   text("to_user_id").notNull(),
  content:    text("content"),
  expression: text("expression"),
  isRead:     boolean("is_read").notNull().default(false),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  deletedFor: text("deleted_for"),   // 'sender' | 'recipient' | 'both'
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Message       = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
