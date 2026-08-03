import { Router, type IRouter, type Request, type Response } from "express";
import { db, characterTable, notificationBroadcastsTable } from "@workspace/db";
import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { requireAdmin, getUserId } from "../middleware/auth";
import { sendPushToTokens } from "../services/pushService";
import { z } from "zod";

const router: IRouter = Router();

// ── Audience → DB query ───────────────────────────────────────────────────────

const AUDIENCE_VALUES = ["all", "beta", "founders", "banned", "admins", "guides", "recent"] as const;
type Audience = typeof AUDIENCE_VALUES[number];

async function getTokensForAudience(audience: Audience): Promise<string[]> {
  let rows: { pushToken: string | null }[];

  switch (audience) {
    case "beta":
      rows = await db
        .select({ pushToken: characterTable.pushToken })
        .from(characterTable)
        .where(and(isNotNull(characterTable.pushToken), eq(characterTable.isBetaTester, true)));
      break;

    case "founders":
      rows = await db
        .select({ pushToken: characterTable.pushToken })
        .from(characterTable)
        .where(and(isNotNull(characterTable.pushToken), eq(characterTable.isFounder, true)));
      break;

    case "banned":
      rows = await db
        .select({ pushToken: characterTable.pushToken })
        .from(characterTable)
        .where(and(isNotNull(characterTable.pushToken), eq(characterTable.isBanned, true)));
      break;

    case "admins":
      rows = await db
        .select({ pushToken: characterTable.pushToken })
        .from(characterTable)
        .where(and(isNotNull(characterTable.pushToken), eq(characterTable.isAdmin, true)));
      break;

    case "guides":
      rows = await db
        .select({ pushToken: characterTable.pushToken })
        .from(characterTable)
        .where(and(isNotNull(characterTable.pushToken), eq(characterTable.isGuide, true)));
      break;

    case "recent": {
      // "Recently active" = updatedAt within the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      rows = await db
        .select({ pushToken: characterTable.pushToken })
        .from(characterTable)
        .where(and(isNotNull(characterTable.pushToken), gt(characterTable.updatedAt, sevenDaysAgo)));
      break;
    }

    case "all":
    default:
      rows = await db
        .select({ pushToken: characterTable.pushToken })
        .from(characterTable)
        .where(isNotNull(characterTable.pushToken));
      break;
  }

  return rows
    .map(r => r.pushToken!)
    .filter(t => t.startsWith("ExponentPushToken["));
}

// ── GET /admin/notifications/audience-count ───────────────────────────────────

router.get("/admin/notifications/audience-count", requireAdmin, async (req: Request, res: Response) => {
  const audienceParam = req.query.audience as string | undefined;
  const parsed = z.enum(AUDIENCE_VALUES).safeParse(audienceParam ?? "all");
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid audience value" });
  }
  try {
    const tokens = await getTokensForAudience(parsed.data);
    return res.json({ audience: parsed.data, count: tokens.length });
  } catch (err) {
    req.log.error({ err }, "admin/notifications audience-count failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

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
  audience: z.enum(AUDIENCE_VALUES).default("all"),
  deepLink: z.string().max(500).optional(),
});

router.post("/admin/notifications/broadcast", requireAdmin, async (req: Request, res: Response) => {
  const parsed = BroadcastSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { title, body, audience, deepLink } = parsed.data;
  const adminId = getUserId(req);

  try {
    const tokens  = await getTokensForAudience(audience);
    const data: Record<string, unknown> = {};
    if (deepLink) data.url = deepLink;
    const messages = tokens.map(token => ({ token, title, body, data }));

    await sendPushToTokens(messages);

    const [record] = await db
      .insert(notificationBroadcastsTable)
      .values({
        title,
        body,
        audience,
        sentAt:    new Date(),
        sentCount: messages.length,
        createdBy: adminId,
        ...(deepLink ? { deepLink } : {}),
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
