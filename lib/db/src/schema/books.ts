import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ── Page shape (matches StoryPageDB from stories.ts) ─────────────────────────

export type BookChapterPage = {
  id:        string;
  layoutKey: string;
  panels: Array<{
    id:          string;
    text:        string;
    imageUri?:   string;
    bgPreset?:   string;
    bubbleText?: string;
    overlays?:   unknown[];
  }>;
};

// ── Books ─────────────────────────────────────────────────────────────────────

export const booksTable = pgTable("books", {
  id:            uuid("id").primaryKey().defaultRandom(),
  userId:        text("user_id").notNull(),
  title:         text("title").notNull(),
  subtitle:      text("subtitle").notNull().default(""),
  seriesType:    text("series_type").notNull().default("standalone"),
  genre:         jsonb("genre").$type<string[]>().notNull().default([]),
  language:      text("language").notNull().default("English"),
  ageRating:     text("age_rating").notNull().default("All Ages"),
  visibility:    text("visibility").notNull().default("public"),
  coverImageUri: text("cover_image_uri"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("books_user_id_idx").on(table.userId),
]);

export type Book      = typeof booksTable.$inferSelect;
export type BookInput = typeof booksTable.$inferInsert;

// ── Chapters ──────────────────────────────────────────────────────────────────

export const chaptersTable = pgTable("chapters", {
  id:          uuid("id").primaryKey().defaultRandom(),
  bookId:      uuid("book_id").notNull(),
  title:       text("title").notNull(),
  orderIndex:  integer("order_index").notNull().default(0),
  status:      text("status").notNull().default("draft"),   // 'draft' | 'published'
  publishedAt: timestamp("published_at", { withTimezone: true }),
  pageCount:   integer("page_count").notNull().default(0),
  pages:       jsonb("pages").$type<BookChapterPage[]>().notNull().default([]),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("chapters_book_id_idx").on(table.bookId),
  index("chapters_book_id_order_idx").on(table.bookId, table.orderIndex),
]);

export type Chapter      = typeof chaptersTable.$inferSelect;
export type ChapterInput = typeof chaptersTable.$inferInsert;
