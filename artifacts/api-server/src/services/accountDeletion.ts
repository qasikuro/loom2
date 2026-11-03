import { clerkClient } from "@clerk/express";
import {
  db,
  accountDeletionJobsTable,
  characterTable,
  deletedAccountHashesTable,
  pushDevicesTable,
} from "@workspace/db";
import { eq, lte, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const AUTH_DENYLIST_DAYS = 30;
const RETRY_INTERVAL_MS = 60_000;
const MAX_RETRY_DELAY_MS = 60 * 60_000;

let workerTimer: ReturnType<typeof setInterval> | null = null;
let workerRunning = false;

export function hashAuthUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex");
}

function storagePathFromUri(uri: string): string | null {
  const match = /^\/api\/(images|videos)\/([\w.-]+)$/.exec(uri);
  return match ? `${match[1]}/${match[2]}` : null;
}

/**
 * Remove the account's private data in one transaction. Delivered message text
 * is retained for the other participant, while the sender's uploaded photo is
 * removed and all shared-chat attribution becomes "Deleted account".
 */
export async function deleteAccountData(userId: string): Promise<string[]> {
  const deletedAlias = `deleted-account:${randomUUID()}`;
  const expiresAt = new Date(Date.now() + AUTH_DENYLIST_DAYS * 24 * 60 * 60_000);

  return db.transaction(async (tx) => {
    // Serialize account deletion with direct-message sends, which hold a
    // key-share lock on this row until their message transaction commits.
    await tx.select({ userId: characterTable.userId })
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1)
      .for("update");

    const partnerRows = await tx.execute(sql`
      SELECT DISTINCT CASE WHEN from_user_id = ${userId}
                           THEN to_user_id ELSE from_user_id END AS partner_id
        FROM messages
       WHERE from_user_id = ${userId} OR to_user_id = ${userId}
    `);
    const uploaded = await tx.execute(sql`SELECT path AS uri FROM uploaded_images WHERE user_id = ${userId}`);
    const compositions = await tx.execute(sql`
      SELECT video_path AS uri FROM media_compositions WHERE user_id = ${userId}
      UNION SELECT thumbnail_path AS uri FROM media_compositions WHERE user_id = ${userId}
    `);
    const manga = await tx.execute(sql`SELECT image_uri AS uri FROM manga_generations WHERE user_id = ${userId}`);
    const objectPaths = Array.from(new Set(
      [...uploaded.rows, ...compositions.rows, ...manga.rows]
        .map((row) => (row as { uri?: string | null }).uri)
        .filter((uri): uri is string => typeof uri === "string")
        .map(storagePathFromUri)
        .filter((path): path is string => path !== null),
    ));

    await tx.insert(deletedAccountHashesTable).values({
      userIdHash: hashAuthUserId(userId),
      expiresAt,
    }).onConflictDoUpdate({
      target: deletedAccountHashesTable.userIdHash,
      set: { expiresAt },
    });

    await tx.insert(accountDeletionJobsTable).values({
      userId,
      objectPaths,
    }).onConflictDoNothing();

    // Keep delivered direct-message text for each recipient, but remove media
    // owned by the account being deleted.
    await tx.execute(sql`
      UPDATE messages
         SET image_uri = NULL, video_uri = NULL, thumbnail_uri = NULL
       WHERE from_user_id = ${userId}
    `);

    // Preserve shared conversation history while replacing the deleted
    // participant's public identity with an opaque non-login alias.
    await tx.execute(sql`
      UPDATE campfire_messages
         SET user_id = ${deletedAlias}, author_name = 'Deleted account'
       WHERE user_id = ${userId}
    `);
    await tx.execute(sql`
      UPDATE campfire_rooms SET created_by = ${deletedAlias}
       WHERE created_by = ${userId}
    `);

    // End hosted sessions without deleting the attendees' own records.
    await tx.execute(sql`
      UPDATE guide_sessions
         SET guide_id = ${deletedAlias},
             title = CASE WHEN status IN ('scheduled', 'live', 'active', 'in_progress')
                          THEN 'Session canceled' ELSE title END,
             description = CASE WHEN status IN ('scheduled', 'live', 'active', 'in_progress')
                                THEN 'This session is no longer available.' ELSE description END,
             cover_image_uri = NULL,
             topic = NULL,
             status = CASE WHEN status IN ('scheduled', 'live', 'active', 'in_progress')
                           THEN 'cancelled' ELSE status END,
             tutorial_id = NULL
       WHERE guide_id = ${userId}
    `);
    await tx.execute(sql`
      UPDATE guide_session_polls SET created_by = ${deletedAlias}
       WHERE created_by = ${userId}
    `);
    await tx.execute(sql`
      UPDATE guide_session_questions
         SET user_id = CASE WHEN user_id = ${userId} THEN ${deletedAlias} ELSE user_id END,
             answered_by = CASE WHEN answered_by = ${userId} THEN ${deletedAlias} ELSE answered_by END
       WHERE user_id = ${userId} OR answered_by = ${userId}
    `);
    await tx.execute(sql`
      UPDATE guide_session_activities SET guide_id = ${deletedAlias}
       WHERE guide_id = ${userId}
    `);
    await tx.execute(sql`
      UPDATE guide_session_recaps SET guide_id = ${deletedAlias}
       WHERE guide_id = ${userId}
    `);

    // Remove user-authored interactions, relationships, and account-owned
    // content. Records belonging to other accounts are not deleted.
    await tx.execute(sql`DELETE FROM friend_requests WHERE sender_id = ${userId} OR recipient_id = ${userId}`);
    await tx.execute(sql`DELETE FROM follows WHERE follower_id = ${userId} OR following_id = ${userId}`);
    await tx.execute(sql`DELETE FROM blocks WHERE blocker_id = ${userId} OR blocked_id = ${userId}`);
    await tx.execute(sql`DELETE FROM profile_likes WHERE liker_id = ${userId} OR profile_user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM sticker_reactions WHERE from_user_id = ${userId} OR to_user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM notifications WHERE user_id = ${userId} OR actor_id = ${userId}`);
    await tx.delete(pushDevicesTable).where(eq(pushDevicesTable.userId, userId));

    await tx.execute(sql`DELETE FROM story_likes WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM story_saves WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM story_witnesses WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM stories WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM outfits WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM gallery WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM journal_entries WHERE user_id = ${userId}`);

    await tx.execute(sql`DELETE FROM guide_session_attendees WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM guide_session_poll_votes WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM guide_session_question_votes WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM guide_session_activity_responses WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM guide_tutorials WHERE guide_id = ${userId}`);

    await tx.execute(sql`DELETE FROM chapter_likes WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM book_follows WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM comment_likes WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM book_comments WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM books WHERE user_id = ${userId}`);

    await tx.execute(sql`DELETE FROM manga_generations WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM media_compositions WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM uploaded_images WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM feature_usage_hourly WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM lumi_state WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM reward_events WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM user_rewards WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM constellation_progress WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM user_purchases WHERE user_id = ${userId}`);

    // Reports remain available for safety review but are no longer attributed
    // to the deleted login. The identity alias cannot authenticate.
    await tx.execute(sql`
      UPDATE reports SET reporter_id = CASE WHEN reporter_id = ${userId} THEN ${deletedAlias} ELSE reporter_id END, resolved_by_id =
        CASE WHEN resolved_by_id = ${userId} THEN ${deletedAlias} ELSE resolved_by_id END
       WHERE reporter_id = ${userId} OR resolved_by_id = ${userId}
    `);
    await tx.execute(sql`UPDATE events SET created_by = ${deletedAlias} WHERE created_by = ${userId}`);
    await tx.execute(sql`UPDATE notification_broadcasts SET created_by = ${deletedAlias} WHERE created_by = ${userId}`);
    await tx.execute(sql`UPDATE profile_effects SET created_by = ${deletedAlias} WHERE created_by = ${userId}`);
    await tx.execute(sql`UPDATE storigam_email_campaigns SET created_by = ${deletedAlias} WHERE created_by = ${userId}`);

    await tx.delete(characterTable).where(eq(characterTable.userId, userId));
    return partnerRows.rows
      .map((row) => (row as { partner_id?: string }).partner_id)
      .filter((partnerId): partnerId is string => !!partnerId && partnerId !== userId);
  });
}

function isClerkUserMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: number; statusCode?: number; clerkError?: { status?: number } };
  return value.status === 404 || value.statusCode === 404 || value.clerkError?.status === 404;
}

async function processAccountDeletion(userId: string): Promise<void> {
  const [job] = await db.select().from(accountDeletionJobsTable)
    .where(eq(accountDeletionJobsTable.userId, userId)).limit(1);
  if (!job) return;

  let clerkDeleted = job.clerkDeleted;
  let retryNeeded = false;

  if (!clerkDeleted) {
    try {
      await clerkClient.users.deleteUser(userId);
      clerkDeleted = true;
    } catch (error) {
      if (isClerkUserMissing(error)) {
        clerkDeleted = true;
      } else {
        retryNeeded = true;
      }
    }
  }

  if (clerkDeleted) {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (job.objectPaths.length > 0 && !bucketId) {
      retryNeeded = true;
    } else if (bucketId) {
      for (const objectPath of job.objectPaths) {
        try {
          await objectStorageClient.bucket(bucketId).file(objectPath).delete({ ignoreNotFound: true });
        } catch {
          retryNeeded = true;
        }
      }
    }
  }

  if (clerkDeleted && !retryNeeded) {
    await db.delete(accountDeletionJobsTable).where(eq(accountDeletionJobsTable.userId, userId));
    return;
  }

  const attempts = job.attempts + 1;
  const delay = Math.min(MAX_RETRY_DELAY_MS, RETRY_INTERVAL_MS * (2 ** Math.min(attempts, 6)));
  await db.update(accountDeletionJobsTable).set({
    clerkDeleted,
    attempts,
    nextAttemptAt: new Date(Date.now() + delay),
  }).where(eq(accountDeletionJobsTable.userId, userId));
}

export async function processDueAccountDeletions(): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;
  try {
    const due = await db.select({ userId: accountDeletionJobsTable.userId })
      .from(accountDeletionJobsTable)
      .where(lte(accountDeletionJobsTable.nextAttemptAt, new Date()))
      .limit(10);
    for (const job of due) {
      try {
        await processAccountDeletion(job.userId);
      } catch {
        logger.warn("Account-deletion cleanup will be retried");
      }
    }
    await db.delete(deletedAccountHashesTable)
      .where(lte(deletedAccountHashesTable.expiresAt, new Date()));
  } catch {
    logger.warn("Account-deletion cleanup check failed");
  } finally {
    workerRunning = false;
  }
}

export function startAccountDeletionProcessor(): void {
  if (workerTimer) return;
  void processDueAccountDeletions();
  workerTimer = setInterval(() => void processDueAccountDeletions(), RETRY_INTERVAL_MS);
  workerTimer.unref?.();
}

export function queueAccountDeletionCleanup(userId: string): void {
  void processAccountDeletion(userId).catch(() => {
    logger.warn("Account-deletion cleanup will be retried");
  });
}
