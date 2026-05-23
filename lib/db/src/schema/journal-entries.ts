import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const journalEntriesTable = pgTable("journal_entries", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     text("user_id").notNull().default("legacy"),
  type:       text("type", { enum: ["diary", "friend", "moment"] }).notNull(),
  text:       text("text").notNull(),
  mood:       text("mood").notNull(),
  imageUri:   text("image_uri"),
  friendName: text("friend_name"),
  date:       timestamp("date", { withTimezone: true }).notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("journal_entries_user_id_idx").on(table.userId),
]);

export type JournalEntry      = typeof journalEntriesTable.$inferSelect;
export type JournalEntryInput = typeof journalEntriesTable.$inferInsert;
