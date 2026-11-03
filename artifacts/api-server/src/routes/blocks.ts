import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { db, characterTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import * as cache from "../lib/cache";
import { emitSSEEvent } from "../lib/sseEmitter";

const router: IRouter = Router();

// ── POST /api/users/:userId/block ─────────────────────────────────────────────
router.post("/users/:userId/block", requireAuth, async (req, res) => {
  const blockerId = getUserId(req);
  const blockedId = String(req.params.userId);

  if (blockerId === blockedId)
    return res.status(400).json({ error: "Cannot block yourself" });

  try {
    const [target] = await db.select({ userId: characterTable.userId })
      .from(characterTable)
      .where(sql`${characterTable.userId} = ${blockedId}`)
      .limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });

    await db.transaction(async (tx) => {
      await tx.execute(sql`
        INSERT INTO blocks (blocker_id, blocked_id)
        VALUES (${blockerId}, ${blockedId})
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      `);

      // Blocking ends the social relationship and removes pending requests,
      // without touching either user's messages or account data.
      await tx.execute(sql`
        DELETE FROM follows
         WHERE (follower_id = ${blockerId} AND following_id = ${blockedId})
            OR (follower_id = ${blockedId} AND following_id = ${blockerId})
      `);
      await tx.execute(sql`
        DELETE FROM friend_requests
         WHERE (sender_id = ${blockerId} AND recipient_id = ${blockedId})
            OR (sender_id = ${blockedId} AND recipient_id = ${blockerId})
      `);
    });

    // Invalidate discover cache for both parties — block changes feed visibility
    cache.invalidate(`discover:${blockerId}`);
    cache.invalidate(`discover:${blockedId}`);

    // Only the blocker receives this state event; the blocked user is not
    // notified that the relationship changed.
    emitSSEEvent(`messages:${blockerId}`, {
      type: "block_relationship_changed",
      partnerId: blockedId,
      blocked: true,
    });
    return res.json({ blocked: true });
  } catch (err) {
    req.log.error({ err }, "Failed to block user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/users/:userId/block ───────────────────────────────────────────
router.delete("/users/:userId/block", requireAuth, async (req, res) => {
  const blockerId = getUserId(req);
  const blockedId = String(req.params.userId);

  try {
    await db.execute(sql`
      DELETE FROM blocks
       WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}
    `);

    // Invalidate discover cache for both parties — unblocking changes feed visibility
    cache.invalidate(`discover:${blockerId}`);
    cache.invalidate(`discover:${blockedId}`);
    emitSSEEvent(`messages:${blockerId}`, {
      type: "block_relationship_changed",
      partnerId: blockedId,
      blocked: false,
    });

    return res.json({ blocked: false });
  } catch (err) {
    req.log.error({ err }, "Failed to unblock user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/users/blocked — list users the caller has blocked ────────────────
router.get("/users/blocked", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db.execute(sql`
      SELECT b.blocked_id   AS "blockedId",
             COALESCE(c.name, 'Deleted account') AS name,
             c.username     AS username,
             c.avatar_uri   AS "avatarUri"
        FROM blocks b
        LEFT JOIN character c ON c.user_id = b.blocked_id
       WHERE b.blocker_id = ${userId}
       ORDER BY b.created_at DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list blocks");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Helper exported for other routes ─────────────────────────────────────────
export async function isBlocked(userA: string, userB: string): Promise<boolean> {
  const rows = await db.execute(sql`
    SELECT 1 FROM blocks
     WHERE (blocker_id = ${userA} AND blocked_id = ${userB})
        OR (blocker_id = ${userB} AND blocked_id = ${userA})
     LIMIT 1
  `);
  return rows.rows.length > 0;
}

export default router;
