/**
 * Direct messages between users.
 *
 * The `id` column is a UUID primary key (gen_random_uuid()), matching the
 * deployed database schema.  All other columns are additive DM fields that
 * may be missing on older deployments and are backfilled by the startup
 * migration in db/src/index.ts via ADD COLUMN IF NOT EXISTS.
 */
import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const messages = pgTable("messages", {
  id:         uuid("id").primaryKey().defaultRandom(),
  fromUserId: text("from_user_id").notNull(),
  toUserId:   text("to_user_id").notNull(),
  content:    text("content"),
  imageUri:   text("image_uri"),
  videoUri:   text("video_uri"),
  thumbnailUri: text("thumbnail_uri"),
  expression: text("expression"),
  isRead:     boolean("is_read").notNull().default(false),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
  deletedFor: text("deleted_for"),   // 'sender' | 'recipient' | 'both'
  hiddenForUserIds: text("hidden_for_user_ids").array().notNull().default(sql`'{}'::text[]`),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("messages_hidden_for_user_ids_idx").using("gin", table.hiddenForUserIds),
  index("messages_sender_recipient_recent_idx").on(table.fromUserId, table.toUserId, table.createdAt, table.id),
  index("messages_recipient_sender_recent_idx").on(table.toUserId, table.fromUserId, table.createdAt, table.id),
]);

export type Message       = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
