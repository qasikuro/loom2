import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const contentCommentsTable = pgTable("content_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentType: text("content_type").notNull(),
  contentId: uuid("content_id").notNull(),
  userId: text("user_id").notNull(),
  parentId: uuid("parent_id"),
  content: text("content").notNull(),
  kindnessTag: text("kindness_tag"),
  creatorReaction: text("creator_reaction"),
  likeCount: integer("like_count").notNull().default(0),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("content_comments_content_created_idx").on(table.contentType, table.contentId, table.createdAt),
  index("content_comments_parent_idx").on(table.contentId, table.parentId),
  index("content_comments_user_idx").on(table.userId),
]);

export const contentCommentLikesTable = pgTable("content_comment_likes", {
  commentId: uuid("comment_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.commentId, table.userId] }),
  index("content_comment_likes_user_idx").on(table.userId),
]);

export type ContentComment = typeof contentCommentsTable.$inferSelect;
export type ContentCommentInput = typeof contentCommentsTable.$inferInsert;
export type ContentCommentLike = typeof contentCommentLikesTable.$inferSelect;
