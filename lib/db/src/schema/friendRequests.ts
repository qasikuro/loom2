import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const friendRequestsTable = pgTable("friend_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});