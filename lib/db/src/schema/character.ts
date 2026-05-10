import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const characterTable = pgTable("character", {
  userId:    text("user_id").primaryKey(),
  username:  text("username").unique(),
  name:      text("name").notNull().default("Sky Child"),
  bio:       text("bio").notNull().default(""),
  mood:      text("mood").notNull().default("Hopeful"),
  traits:    jsonb("traits").$type<string[]>().notNull().default([]),
  isPublic:  boolean("is_public").notNull().default(true),
  avatarUri: text("avatar_uri"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Character      = typeof characterTable.$inferSelect;
export type CharacterInput = typeof characterTable.$inferInsert;
