import { db, notificationsTable, characterTable, followsTable } from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";

const router: IRouter = Router();

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

router.post("/notify/ping-friends", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const [sender] = await db
      .select({ name: characterTable.name })
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1);

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

    const senderName = sender?.name ?? 'A Sky friend';
    const chunks: string[][] = [];
    for (let i = 0; i < validTokens.length; i += 100) {
      chunks.push(validTokens.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Accept':        'application/json',
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
