import { Router, type IRouter, type Request, type Response } from "express";
import { db, characterTable, notificationBroadcastsTable } from "@workspace/db";
import { eq, desc, isNotNull, sql } from "drizzle-orm";
import { requireAdmin, getUserId } from "../middleware/auth";
import { sendPushToTokens } from "../services/pushService";
import { z } from "zod";

const router: IRouter = Router();

// ── GET /admin/notifications ──────────────────────────────────────────────────

router.get("/admin/notifications", requireAdmin, async (req: Request, res: Response) => {
  try {
    const broadcasts = await db
      .select()
      .from(notificationBroadcastsTable)
      .orderBy(desc(notificationBroadcastsTable.createdAt))
      .limit(100);
    return res.json({ broadcasts });
  } catch (err) {
    req.log.error({ err }, "admin/notifications GET failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /admin/notifications/broadcast ───────────────────────────────────────

const BroadcastSchema = z.object({
  title:    z.string().min(1).max(100),
  body:     z.string().min(1).max(500),
  /** "all" | "beta" */
  audience: z.enum(["all", "beta"]).default("all"),
});

router.post("/admin/notifications/broadcast", requireAdmin, async (req: Request, res: Response) => {
  const parsed = BroadcastSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { title, body, audience } = parsed.data;
  const adminId = getUserId(req);

  try {
    // Fetch tokens based on audience
    let rows: { pushToken: string | null }[];

    if (audience === "beta") {
      // Use raw SQL since isBetaTester may not be in the TS schema yet
      const result = await db.execute(
        sql`SELECT push_token FROM character WHERE push_token IS NOT NULL AND is_beta_tester = TRUE`
      );
      rows = (result.rows as { push_token: string | null }[]).map(r => ({ pushToken: r.push_token }));
    } else {
      rows = await db
        .select({ pushToken: characterTable.pushToken })
        .from(characterTable)
        .where(isNotNull(characterTable.pushToken));
    }

    const messages = rows
      .filter(r => r.pushToken?.startsWith("ExponentPushToken["))
      .map(r => ({ token: r.pushToken!, title, body }));

    await sendPushToTokens(messages);

    // Log the broadcast
    const [record] = await db
      .insert(notificationBroadcastsTable)
      .values({
        title,
        body,
        audience,
        sentAt:    new Date(),
        sentCount: messages.length,
        createdBy: adminId,
      })
      .returning();

    req.log.info({ title, audience, sentCount: messages.length }, "Notification broadcast sent");
    return res.json({ ok: true, sentCount: messages.length, broadcast: record });
  } catch (err) {
    req.log.error({ err }, "admin/notifications broadcast failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /admin/notifications/:id ──────────────────────────────────────────

router.delete("/admin/notifications/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    await db.delete(notificationBroadcastsTable).where(eq(notificationBroadcastsTable.id, id));
    return res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "admin/notifications DELETE failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
