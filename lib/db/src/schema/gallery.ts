import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const galleryTable = pgTable("gallery", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    text("user_id").notNull(),
  imageUri:  text("image_uri").notNull(),
  caption:   text("caption").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GalleryPhoto      = typeof galleryTable.$inferSelect;
export type GalleryPhotoInput = typeof galleryTable.$inferInsert;
