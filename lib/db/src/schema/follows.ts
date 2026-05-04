import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const followsTable = pgTable("follows", {
  followerId:  text("follower_id").notNull(),
  followingId: text("following_id").notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.followerId, table.followingId] }),
]);

export type Follow      = typeof followsTable.$inferSelect;
export type FollowInput = typeof followsTable.$inferInsert;
