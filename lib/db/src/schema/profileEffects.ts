import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export interface EffectParticleConfig {
  particles:   string[];
  count:       number;
  mode:        "rise" | "fall" | "drift" | "glow";
  fontSize:    number;
  colors?:     string[];
  speedMs:     [number, number];
  xSwingPct:   number;
  yTravelPct:  number;
  corners?:    { pos: "tl" | "tr" | "bl" | "br"; emoji: string; size: number }[];
  overlayTint?: string;
}

export const profileEffectsTable = pgTable("profile_effects", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  description:   text("description").notNull().default(""),
  icon:          text("icon").notNull().default("✨"),
  theme:         text("theme").notNull().default("special"),
  rarity:        text("rarity").notNull().default("common"),
  config:        jsonb("config").$type<EffectParticleConfig>().notNull(),
  isActive:      boolean("is_active").notNull().default(true),
  shopCost:      jsonb("shop_cost").$type<{ stars?: number; aura?: number; shards?: number }>().notNull().default({}),
  previewColors: jsonb("preview_colors").$type<string[]>().notNull().default([]),
  createdBy:     text("created_by").notNull(),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProfileEffectRow       = typeof profileEffectsTable.$inferSelect;
export type ProfileEffectRowInput  = typeof profileEffectsTable.$inferInsert;
