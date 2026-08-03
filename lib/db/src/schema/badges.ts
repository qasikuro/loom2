import { pgTable, text, integer, timestamp, primaryKey, uuid } from "drizzle-orm/pg-core";
import { characterTable } from "./character";

export const badgesTable = pgTable("badges", {
  id:          uuid("id").primaryKey().defaultRandom(),
  slug:        text("slug").notNull().unique(),
  name:        text("name").notNull(),
  emoji:       text("emoji").notNull().default("🏅"),
  color:       text("color").notNull().default("#6366f1"), // hex, used to tint pill
  imageUrl:    text("image_url"),                           // optional uploaded image path
  description: text("description").notNull().default(""),
  sortOrder:   integer("sort_order").notNull().default(0),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const characterBadgesTable = pgTable("character_badges", {
  userId:    text("user_id").notNull().references(() => characterTable.userId, { onDelete: "cascade" }),
  badgeId:   uuid("badge_id").notNull().references(() => badgesTable.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.badgeId] }),
}));

export type Badge           = typeof badgesTable.$inferSelect;
export type CharacterBadge  = typeof characterBadgesTable.$inferSelect;
