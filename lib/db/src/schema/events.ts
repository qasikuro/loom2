import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export interface EventInventoryItem {
  type:      "stars" | "aura" | "shards" | "item";
  amount?:   number;
  itemId?:   string;
  itemName?: string;
  label:     string;
}

export const eventsTable = pgTable("events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  title:       text("title").notNull(),
  description: text("description").notNull().default(""),
  theme:       text("theme").notNull().default("special"),
  status:      text("status").notNull().default("draft"),
  startsAt:    timestamp("starts_at", { withTimezone: true }),
  endsAt:      timestamp("ends_at", { withTimezone: true }),
  inventory:   jsonb("inventory").$type<EventInventoryItem[]>().notNull().default([]),
  aiPrompt:    text("ai_prompt").notNull().default(""),
  createdBy:   text("created_by").notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GameEvent    = typeof eventsTable.$inferSelect;
export type NewGameEvent = typeof eventsTable.$inferInsert;
