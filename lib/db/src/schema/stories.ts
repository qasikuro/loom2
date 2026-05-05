import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type StoryPanel = { id: string; text: string; imageUri?: string };

export const storiesTable = pgTable("stories", {
  id:             uuid("id").primaryKey().defaultRandom(),
  userId:         text("user_id").notNull().default("legacy"),
  chapterTitle:   text("chapter_title").notNull(),
  mood:           text("mood").notNull(),
  location:       text("location").notNull().default(""),
  isPublic:       boolean("is_public").notNull().default(false),
  witnessedCount: integer("witnessed_count").notNull().default(0),
  savedCount:     integer("saved_count").notNull().default(0),
  panels:          jsonb("panels").$type<StoryPanel[]>().notNull().default([]),
  pageLayoutKey:   text("page_layout_key"),
  date:            timestamp("date", { withTimezone: true }).notNull(),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Story      = typeof storiesTable.$inferSelect;
export type StoryInput = typeof storiesTable.$inferInsert;
