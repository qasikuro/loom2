import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const uploadedImagesTable = pgTable("uploaded_images", {
  path: text("path").primaryKey(),
  userId: text("user_id").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("uploaded_images_user_id_idx").on(table.userId),
]);