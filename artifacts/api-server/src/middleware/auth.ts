import { clerkMiddleware, clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler, Request, Response, NextFunction } from "express";
import { db, characterTable, deletedAccountHashesTable, accountDeletionJobsTable } from "@workspace/db";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { hashAuthUserId } from "../services/accountDeletion";

// ── Presence heartbeat ────────────────────────────────────────────────────────
// Update last_seen_at at most once per 2 minutes per user (in-process throttle).
const _lastSeenFlush = new Map<string, number>();

function touchLastSeen(userId: string) {
  const now = Date.now();
  const prev = _lastSeenFlush.get(userId) ?? 0;
  if (now - prev < 2 * 60 * 1000) return; // throttle: 2-min window
  _lastSeenFlush.set(userId, now);
  // Fire-and-forget — never block the request
  db.execute(
    sql`UPDATE character SET last_seen_at = NOW() WHERE user_id = ${userId} AND show_online_status = true`
  ).catch(() => { /* silent — presence is best-effort */ });
}

export const clerkAuth = clerkMiddleware() as RequestHandler;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  let userId: string | null = null;
  try {
    const auth = getAuth(req);
    userId    = auth.userId    ?? null;
  } catch {
    logger.warn({ hasAuthHeader: !!req.headers.authorization }, "Authentication state unavailable");
  }

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [row] = await db
      .select({
        isBanned: characterTable.isBanned,
        suspendedUntil: characterTable.suspendedUntil,
      })
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1);

    if (!row) {
      const [deleted] = await db.select({ userIdHash: deletedAccountHashesTable.userIdHash })
        .from(deletedAccountHashesTable)
        .where(and(
          eq(deletedAccountHashesTable.userIdHash, hashAuthUserId(userId)),
          gt(deletedAccountHashesTable.expiresAt, new Date()),
        ))
        .limit(1);
      const [pendingDeletion] = await db.select({ userId: accountDeletionJobsTable.userId })
        .from(accountDeletionJobsTable).where(eq(accountDeletionJobsTable.userId, userId)).limit(1);
      if (deleted || pendingDeletion) {
        res.status(403).json({ error: "This account has been deleted" });
        return;
      }
    }

    if (row?.isBanned || (row?.suspendedUntil && row.suspendedUntil > new Date())) {
      res.status(403).json({ error: "Account suspended" });
      return;
    }
  } catch {
    res.status(500).json({ error: "Internal server error" });
    return;
  }
  // Best-effort presence heartbeat — does not block the request
  touchLastSeen(userId);
  next();
}

export function getUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw new Error("No userId on authenticated request");
  return userId;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [row] = await db
      .select({
        isAdmin: characterTable.isAdmin,
        isBanned: characterTable.isBanned,
        suspendedUntil: characterTable.suspendedUntil,
      })
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1);

    if (row?.isBanned || (row?.suspendedUntil && row.suspendedUntil > new Date())) {
      res.status(403).json({ error: "Account suspended" });
      return;
    }
    if (!row?.isAdmin) {
      // Optional owner recovery, configured out-of-band by the project owner.
      // Never trust an email/role supplied by the browser or grant by email alone.
      const ownerId = process.env.ADMIN_OWNER_USER_ID?.trim();
      const ownerEmail = process.env.ADMIN_OWNER_EMAIL?.trim().toLowerCase();
      if (!row || !ownerId || ownerId !== userId || !ownerEmail) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const owner = await clerkClient.users.getUser(userId);
      const primary = owner.emailAddresses.find(email => email.id === owner.primaryEmailAddressId);
      if (owner.id !== userId || primary?.verification?.status !== "verified" ||
          primary.emailAddress.trim().toLowerCase() !== ownerEmail) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      // Re-check restrictions in the write itself so a concurrent suspension
      // cannot be bypassed between the initial read and identity verification.
      const [recovered] = await db.update(characterTable).set({ isAdmin: true })
        .where(and(
          eq(characterTable.userId, userId),
          eq(characterTable.isBanned, false),
          or(isNull(characterTable.suspendedUntil), lte(characterTable.suspendedUntil, new Date())),
        ))
        .returning({ userId: characterTable.userId });
      if (!recovered) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
