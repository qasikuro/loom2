import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const notificationBroadcastsTable = pgTable("notification_broadcasts", {
  id:          text("id").primaryKey().default(sql`gen_random_uuid()`),
  title:       text("title").notNull(),
  body:        text("body").notNull(),
  /** "all" | "beta" */
  audience:    text("audience").notNull().default("all"),
  sentAt:      timestamp("sent_at", { withTimezone: true }),
  sentCount:   integer("sent_count").notNull().default(0),
  createdBy:   text("created_by").notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationBroadcast      = typeof notificationBroadcastsTable.$inferSelect;
export type NotificationBroadcastInput = typeof notificationBroadcastsTable.$inferInsert;
