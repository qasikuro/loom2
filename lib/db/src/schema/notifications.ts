import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    text("user_id").notNull(),
  actorId:   text("actor_id").notNull(),
  actorName: text("actor_name").notNull().default(""),
  type:      text("type").notNull(),   // 'new_story' | 'new_outfit'
  refId:     text("ref_id").notNull(),
  title:     text("title").notNull().default(""),
  isRead:    boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification      = typeof notificationsTable.$inferSelect;
export type NotificationInput = typeof notificationsTable.$inferInsert;
