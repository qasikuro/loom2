import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Temporary, non-reversible denylist for already-issued auth tokens after
 * account deletion. Entries expire after the auth-token safety window.
 */
export const deletedAccountHashesTable = pgTable("deleted_account_hashes", {
  userIdHash: text("user_id_hash").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [
  index("deleted_account_hashes_expires_at_idx").on(table.expiresAt),
]);

/**
 * Durable retry queue for Clerk account deletion and owner-upload cleanup.
 * The original auth ID is retained only until both provider and media cleanup
 * finish; the table is then removed.
 */
export const accountDeletionJobsTable = pgTable("account_deletion_jobs", {
  userId: text("user_id").primaryKey(),
  objectPaths: text("object_paths").array().notNull().default(sql`'{}'::text[]`),
  clerkDeleted: boolean("clerk_deleted").notNull().default(false),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
