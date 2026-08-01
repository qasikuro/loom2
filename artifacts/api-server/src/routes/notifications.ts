import { db, notificationsTable, characterTable, followsTable } from "@workspace/db";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";

const router: IRouter = Router();

const PING_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

router.get("/notifications", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    return res.json(rows.map(r => ({
      id:        r.id,
      actorId:   r.actorId,
      actorName: r.actorName,
      type:      r.type,
      refId:     r.refId,
      title:     r.title,
      isRead:    r.isRead,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list notifications");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/notifications/read-all", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, userId));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark notifications read");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/notifications/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await db
      .delete(notificationsTable)
      .where(eq(notificationsTable.id, id as string));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete notification");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── C-1: Per-user 30-minute cooldown on ping-friends ─────────────────────────
// Uses a DB timestamp column (ping_friends_at on character) so the cooldown
// survives server restarts and works correctly across multiple processes.
// Returns 429 with retryAfterSeconds when the cooldown is still active.
router.post("/notify/ping-friends", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    // Atomic conditional UPDATE: only sets ping_friends_at when the cooldown
    // has elapsed (or the column is NULL), and returns the row if it was updated.
    // This prevents a TOCTOU race where two concurrent requests both pass a
    // separate SELECT check before either has written the new timestamp.
    const result = await db.execute(sql`
      UPDATE character
      SET ping_friends_at = NOW()
      WHERE user_id = ${userId}
        AND (ping_friends_at IS NULL
             OR ping_friends_at < NOW() - INTERVAL '30 minutes')
      RETURNING user_id, name
    `) as unknown as { rows: { user_id: string; name: string }[] };

    if (!result.rows.length) {
      // Cooldown still active — read the existing timestamp to calculate retry
      const [row] = await db
        .select({ pingFriendsAt: characterTable.pingFriendsAt })
        .from(characterTable)
        .where(eq(characterTable.userId, userId))
        .limit(1);

      const retryAfterMs = row?.pingFriendsAt
        ? Math.max(0, row.pingFriendsAt.getTime() + PING_COOLDOWN_MS - Date.now())
        : 0;
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "You can only ping friends once every 30 minutes.",
        retryAfterSeconds,
      });
    }

    const senderName = result.rows[0].name ?? 'A Sky friend';

    const followers = await db
      .select({ followerId: followsTable.followerId })
      .from(followsTable)
      .where(eq(followsTable.followingId, userId));

    if (followers.length === 0) return res.json({ sent: 0 });

    const followerIds = followers.map(f => f.followerId);
    const tokenRows = await db
      .select({ pushToken: characterTable.pushToken })
      .from(characterTable)
      .where(inArray(characterTable.userId, followerIds));

    const validTokens = tokenRows
      .map(r => r.pushToken)
      .filter((t): t is string => !!t && t.startsWith('ExponentPushToken'));

    if (validTokens.length === 0) return res.json({ sent: 0 });

    const chunks: string[][] = [];
    for (let i = 0; i < validTokens.length; i += 100) {
      chunks.push(validTokens.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'Accept':          'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk.map(token => ({
          to:    token,
          title: '✨ Sky Journal',
          body:  `${senderName} wants you online right now`,
          data:  { type: 'ping', userId },
          sound: 'default',
        }))),
      });
    }

    return res.json({ sent: validTokens.length });
  } catch (err) {
    req.log.error({ err }, "Failed to send ping notification");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
