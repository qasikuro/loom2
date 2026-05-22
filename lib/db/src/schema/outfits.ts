import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const outfitsTable = pgTable("outfits", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      text("user_id").notNull().default("legacy"),
  name:        text("name").notNull(),
  description: text("description").notNull().default(""),
  imageUri:    text("image_uri"),
  tags:        jsonb("tags").$type<string[]>().notNull().default([]),
  isPublic:    boolean("is_public").notNull().default(false),
  isHidden:    boolean("is_hidden").notNull().default(false),
  date:        timestamp("date", { withTimezone: true }).notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Outfit      = typeof outfitsTable.$inferSelect;
export type OutfitInput = typeof outfitsTable.$inferInsert;
