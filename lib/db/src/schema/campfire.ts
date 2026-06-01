import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const campfireRoomsTable = pgTable("campfire_rooms", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  mood:      text("mood").notNull().default("Dreamy"),
  createdBy: text("created_by").notNull(),
  isPreset:  boolean("is_preset").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campfireMessagesTable = pgTable("campfire_messages", {
  id:         uuid("id").primaryKey().defaultRandom(),
  roomId:     uuid("room_id").notNull(),
  userId:     text("user_id").notNull(),
  authorName: text("author_name").notNull(),
  content:    text("content"),
  expression: text("expression"),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt:  timestamp("expires_at", { withTimezone: true }).notNull(),
});
