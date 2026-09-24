import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const profileLikesTable = pgTable("profile_likes", {
  likerId: text("liker_id").notNull(),
  profileUserId: text("profile_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.likerId, table.profileUserId] }),
  index("profile_likes_profile_user_id_idx").on(table.profileUserId),
]);

export type ProfileLike = typeof profileLikesTable.$inferSelect;
export type ProfileLikeInput = typeof profileLikesTable.$inferInsert;