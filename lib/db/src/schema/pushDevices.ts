import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const pushDevicesTable = pgTable("push_devices", {
  token:      text("token").primaryKey(),
  userId:     text("user_id").notNull(),
  platform:   text("platform").notNull().default("unknown"),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("push_devices_user_seen_idx").on(table.userId, table.lastSeenAt),
]);

export type PushDevice = typeof pushDevicesTable.$inferSelect;
export type PushDeviceInput = typeof pushDevicesTable.$inferInsert;
