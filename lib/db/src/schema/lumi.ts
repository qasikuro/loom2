import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Private, explicitly opted-in companion history. Never reused for social discovery.
export const lumiStateTable = pgTable("lumi_state", {
  userId: text("user_id").primaryKey(),
  remember: boolean("remember").notNull().default(false),
  revision: integer("revision").notNull().default(0),
  messages: jsonb("messages").notNull().default([]),
  preferences: jsonb("preferences").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
