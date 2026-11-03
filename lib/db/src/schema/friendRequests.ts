import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const friendRequestsTable = pgTable("friend_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  pairIdx: uniqueIndex("friend_requests_pair_idx").on(
    sql`LEAST(${table.senderId}, ${table.recipientId})`,
    sql`GREATEST(${table.senderId}, ${table.recipientId})`,
  ),
  recipientIdx: index("friend_requests_recipient_idx").on(table.recipientId),
}));