import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const mangaGenerationsTable = pgTable("manga_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: text("request_id").notNull(),
  userId: text("user_id").notNull(),
  style: text("style").notNull(),
  prompt: text("prompt").notNull(),
  imageUri: text("image_uri"),
  imageCount: integer("image_count").notNull(),
  originalSizes: jsonb("original_sizes").$type<number[]>().notNull().default([]),
  compressedSizes: jsonb("compressed_sizes").$type<number[]>().notNull().default([]),
  model: text("model").notNull(),
  quality: text("quality").notNull(),
  outputSize: text("output_size").notNull(),
  status: text("status").notNull().default("pending"),
  estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, table => [
  index("manga_generations_user_created_idx").on(table.userId, table.createdAt),
  uniqueIndex("manga_generations_user_request_idx").on(table.userId, table.requestId),
]);

export type MangaGeneration = typeof mangaGenerationsTable.$inferSelect;