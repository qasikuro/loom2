import { integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const userRewardsTable = pgTable("user_rewards", {
  userId:       text("user_id").primaryKey(),
  stars:        integer("stars").notNull().default(0),
  auraEnergy:   integer("aura_energy").notNull().default(0),
  memoryShards: integer("memory_shards").notNull().default(0),
  lifetimeStars: integer("lifetime_stars").notNull().default(0),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rewardEventsTable = pgTable("reward_events", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  refId:     text("ref_id").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("reward_events_unique_idx").on(table.userId, table.eventType, table.refId),
]);

export const constellationProgressTable = pgTable("constellation_progress", {
  userId:          text("user_id").primaryKey(),
  socialCount:     integer("social_count").notNull().default(0),
  memoryCount:     integer("memory_count").notNull().default(0),
  quietStreak:     integer("quiet_streak").notNull().default(0),
  lastJournalDate: text("last_journal_date"),
  helpingCount:    integer("helping_count").notNull().default(0),
  creativeCount:   integer("creative_count").notNull().default(0),
  seasonalCount:   integer("seasonal_count").notNull().default(0),
  unlockedStars:   jsonb("unlocked_stars").$type<string[]>().notNull().default([]),
  activeTitle:     text("active_title"),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRewards           = typeof userRewardsTable.$inferSelect;
export type RewardEvent           = typeof rewardEventsTable.$inferSelect;
export type ConstellationProgress = typeof constellationProgressTable.$inferSelect;
