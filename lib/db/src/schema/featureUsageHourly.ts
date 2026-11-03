import { bigint, index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** Privacy-minimal hourly aggregates for authenticated feature requests. */
export const featureUsageHourlyTable = pgTable("feature_usage_hourly", {
  userId: text("user_id").notNull(),
  featureKey: text("feature_key").notNull(),
  hourStart: timestamp("hour_start", { withTimezone: true }).notNull(),
  actionCount: integer("action_count").notNull().default(0),
  pricedActionCount: integer("priced_action_count").notNull().default(0),
  unpricedActionCount: integer("unpriced_action_count").notNull().default(0),
  estimatedCostMicros: bigint("estimated_cost_micros", { mode: "number" }).notNull().default(0),
}, table => [
  primaryKey({ columns: [table.userId, table.featureKey, table.hourStart] }),
  index("feature_usage_hourly_feature_time_idx").on(table.featureKey, table.hourStart),
  index("feature_usage_hourly_time_idx").on(table.hourStart),
]);

export type FeatureUsageHourly = typeof featureUsageHourlyTable.$inferSelect;