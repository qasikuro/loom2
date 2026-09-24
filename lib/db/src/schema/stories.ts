import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type StoryPanel = {
  id: string;
  text: string;
  imageUri?: string;
  bgPreset?: string;
  bubbleText?: string;
  overlays?: unknown[];
  imageAspectRatio?: number;
  contentFit?: "cover" | "contain";
};

export type StoryPageDB = {
  id: string;
  layoutKey: string;
  panels: StoryPanel[];
};

export type StoryMusic = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  duration: number;
  genre: string | null;
  mood: string | null;
  streamUrl: string;
  embedded?: boolean;
  baked?: boolean;
  segmentStartSeconds?: number;
  segmentDurationSeconds?: number;
  originalVolume?: number;
  musicVolume?: number;
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
  witnessMilestones: jsonb("witness_milestones").$type<number[]>().notNull().default([]),
  resonatedCount:  integer("resonated_count").notNull().default(0),
  likeCount:      integer("like_count").notNull().default(0),
  date:            timestamp("date", { withTimezone: true }).notNull(),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Video post support — contentType distinguishes post kinds cleanly
  contentType:  text("content_type").notNull().default("story"),
  videoUri:     text("video_uri"),
  thumbnailUri: text("thumbnail_uri"),
  music:        jsonb("music").$type<StoryMusic | null>(),
}, (table) => [
  index("stories_user_id_idx").on(table.userId),
  index("stories_is_public_is_hidden_idx").on(table.isPublic, table.isHidden),
]);

export type Story      = typeof storiesTable.$inferSelect;
export type StoryInput = typeof storiesTable.$inferInsert;

export const storySavesTable = pgTable("story_saves", {
  userId:  text("user_id").notNull(),
  storyId: uuid("story_id").notNull(),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.storyId] }),
  index("story_saves_user_id_idx").on(table.userId),
]);

// H-2: Per-user witness deduplication table.
// The composite primary key (user_id, story_id) guarantees at most one row
// per (user, story) pair. The witness route inserts here ON CONFLICT DO NOTHING
// before incrementing witnessed_count, so rapid double-taps, network retries,
// and re-entries to the story reader cannot inflate the count.
export const storyWitnessesTable = pgTable("story_witnesses", {
  userId:      text("user_id").notNull(),
  storyId:     uuid("story_id").notNull(),
  witnessedAt: timestamp("witnessed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.storyId] }),
  index("story_witnesses_story_id_idx").on(table.storyId),
]);

export const storyLikesTable = pgTable("story_likes", {
  userId: text("user_id").notNull(),
  storyId: uuid("story_id").notNull(),
  likedAt: timestamp("liked_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.storyId] }),
  index("story_likes_story_id_idx").on(table.storyId),
]);
