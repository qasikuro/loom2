import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const stickerReactionsTable = pgTable("sticker_reactions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  fromUserId:  text("from_user_id").notNull(),
  toUserId:    text("to_user_id").notNull(),
  storyId:     uuid("story_id").notNull(),
  stickerType: text("sticker_type").notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("sticker_reactions_story_id_idx").on(table.storyId),
  index("sticker_reactions_to_user_id_idx").on(table.toUserId),
  unique("sticker_reactions_unique").on(table.fromUserId, table.storyId, table.stickerType),
]);

export type StickerReaction      = typeof stickerReactionsTable.$inferSelect;
export type StickerReactionInput = typeof stickerReactionsTable.$inferInsert;
