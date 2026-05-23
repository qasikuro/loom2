import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type StoryPanel = { id: string; text: string; imageUri?: string };

export type StoryPageDB = {
  id: string;
  layoutKey: string;
  panels: StoryPanel[];
};

export const storiesTable = pgTable("stories", {
  id:             uuid("id").primaryKey().defaultRandom(),
  userId:         text("user_id").notNull().default("legacy"),
  chapterTitle:   text("chapter_title").notNull(),
  description:    text("description").notNull().default(""),
  mood:           text("mood").notNull(),
  location:       text("location").notNull().default(""),
  isPublic:       boolean("is_public").notNull().default(false),
  isHidden:       boolean("is_hidden").notNull().default(false),
  witnessedCount: integer("witnessed_count").notNull().default(0),
  savedCount:     integer("saved_count").notNull().default(0),
  panels:          jsonb("panels").$type<StoryPanel[]>().notNull().default([]),
  pageLayoutKey:   text("page_layout_key"),
  pages:           jsonb("pages").$type<StoryPageDB[]>(),
  date:            timestamp("date", { withTimezone: true }).notNull(),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("stories_user_id_idx").on(table.userId),
  index("stories_is_public_is_hidden_idx").on(table.isPublic, table.isHidden),
]);

export type Story      = typeof storiesTable.$inferSelect;
export type StoryInput = typeof storiesTable.$inferInsert;
