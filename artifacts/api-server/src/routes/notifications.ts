import { db, notificationsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
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

export default router;
