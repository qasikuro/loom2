import { db, badgesTable, characterBadgesTable, notificationsTable, characterTable } from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, count, eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { sendPushNotification } from "../services/pushService";
import { ObjectStorageService } from "../lib/objectStorage";

const objectStorage = new ObjectStorageService();
import { z } from "zod";

const router: IRouter = Router();

// ── Helper: resolve a stored object path to a full serving URL ────────────────
function resolveImageUrl(req: Request, imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http")) return imageUrl;
  // Stored as /objects/<uuid> — prepend API origin
  const proto = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
  const host  = req.get("host") ?? "localhost";
  return `${proto}://${host}/api/storage${imageUrl}`;
}

// ── Badge list ─────────────────────────────────────────────────────────────────

router.get("/admin/badges", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id:          badgesTable.id,
        slug:        badgesTable.slug,
        name:        badgesTable.name,
        emoji:       badgesTable.emoji,
        color:       badgesTable.color,
        imageUrl:    badgesTable.imageUrl,
        description: badgesTable.description,
        sortOrder:   badgesTable.sortOrder,
        createdAt:   badgesTable.createdAt,
      })
      .from(badgesTable)
      .orderBy(asc(badgesTable.sortOrder), asc(badgesTable.createdAt));

    // Include holder count per badge
    const counts = await db
      .select({ badgeId: characterBadgesTable.badgeId, total: count() })
      .from(characterBadgesTable)
      .groupBy(characterBadgesTable.badgeId);
    const countMap = new Map(counts.map(r => [r.badgeId, r.total]));

    return res.json({
      badges: rows.map(b => ({
        ...b,
        imageUrl:   resolveImageUrl(req, b.imageUrl),
        holderCount: countMap.get(b.id) ?? 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Admin list badges failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Create badge ───────────────────────────────────────────────────────────────

const BadgeBody = z.object({
  slug:        z.string().min(1).max(60).regex(/^[a-z0-9_]+$/),
  name:        z.string().min(1).max(80),
  emoji:       z.string().min(1).max(8).default("🏅"),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  description: z.string().max(500).default(""),
  imageUrl:    z.string().max(500).nullable().optional(),
  sortOrder:   z.number().int().default(0),
});

router.post("/admin/badges", requireAdmin, async (req: Request, res: Response) => {
  const parsed = BadgeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const { slug, name, emoji, color, description, imageUrl, sortOrder } = parsed.data;
  try {
    const [badge] = await db
      .insert(badgesTable)
      .values({ slug, name, emoji, color, description, imageUrl: imageUrl ?? null, sortOrder })
      .returning();

    return res.status(201).json({ badge: { ...badge, imageUrl: resolveImageUrl(req, badge.imageUrl) } });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "A badge with this slug already exists." });
    }
    req.log.error({ err }, "Admin create badge failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Update badge ───────────────────────────────────────────────────────────────

router.put("/admin/badges/:id", requireAdmin, async (req: Request, res: Response) => {
  const id     = String(req.params.id);
  const parsed = BadgeBody.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const [badge] = await db
      .update(badgesTable)
      .set({ ...parsed.data, imageUrl: parsed.data.imageUrl ?? undefined })
      .where(eq(badgesTable.id, id))
      .returning();

    if (!badge) return res.status(404).json({ error: "Badge not found" });
    return res.json({ badge: { ...badge, imageUrl: resolveImageUrl(req, badge.imageUrl) } });
  } catch (err) {
    req.log.error({ err }, "Admin update badge failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Delete badge ───────────────────────────────────────────────────────────────

router.delete("/admin/badges/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(badgesTable).where(eq(badgesTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete badge failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Upload URL for badge image ─────────────────────────────────────────────────

router.post("/admin/badges/upload-url", requireAdmin, async (req: Request, res: Response) => {
  try {
    const uploadUrl  = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadUrl);
    const servingUrl = resolveImageUrl(req, objectPath);
    return res.json({ uploadUrl, objectPath, servingUrl });
  } catch (err) {
    req.log.error({ err }, "Admin badge upload-url failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Grant badge to user ────────────────────────────────────────────────────────

router.post("/admin/users/:id/badges/:badgeId", requireAdmin, async (req: Request, res: Response) => {
  const targetId = String(req.params.id);
  const badgeId  = String(req.params.badgeId);
  try {
    // Verify badge exists
    const [badge] = await db.select().from(badgesTable).where(eq(badgesTable.id, badgeId)).limit(1);
    if (!badge) return res.status(404).json({ error: "Badge not found" });

    // Verify user exists
    const [user] = await db
      .select({ name: characterTable.name })
      .from(characterTable)
      .where(eq(characterTable.userId, targetId))
      .limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Insert (ignore if already granted)
    await db
      .insert(characterBadgesTable)
      .values({ userId: targetId, badgeId })
      .onConflictDoNothing();

    // Also sync boolean flags for built-in badges (backward compat)
    if (badge.slug === "founder")     await db.update(characterTable).set({ isFounder:    true }).where(eq(characterTable.userId, targetId));
    if (badge.slug === "beta_tester") await db.update(characterTable).set({ isBetaTester: true }).where(eq(characterTable.userId, targetId));

    // In-app notification
    await db.insert(notificationsTable).values({
      userId:    targetId,
      actorId:   "system",
      actorName: "Sky Journal",
      type:      "badge_granted",
      refId:     badge.slug,
      title:     `${badge.emoji} You've been granted the ${badge.name} badge!`,
      isRead:    false,
    });

    // Push notification (fire-and-forget)
    sendPushNotification(targetId, {
      title: `${badge.emoji} ${badge.name} Badge Granted!`,
      body:  `You've been awarded the ${badge.name} badge on Sky Journal!`,
    }).catch(() => {});

    req.log.info({ targetId, badgeId, slug: badge.slug }, "Admin granted badge");
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin grant badge failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Revoke badge from user ─────────────────────────────────────────────────────

router.delete("/admin/users/:id/badges/:badgeId", requireAdmin, async (req: Request, res: Response) => {
  const targetId = String(req.params.id);
  const badgeId  = String(req.params.badgeId);
  try {
    const [badge] = await db.select().from(badgesTable).where(eq(badgesTable.id, badgeId)).limit(1);
    if (!badge) return res.status(404).json({ error: "Badge not found" });

    await db
      .delete(characterBadgesTable)
      .where(and(eq(characterBadgesTable.userId, targetId), eq(characterBadgesTable.badgeId, badgeId)));

    // Sync boolean flags for built-in badges (backward compat)
    if (badge.slug === "founder")     await db.update(characterTable).set({ isFounder:    false }).where(eq(characterTable.userId, targetId));
    if (badge.slug === "beta_tester") await db.update(characterTable).set({ isBetaTester: false }).where(eq(characterTable.userId, targetId));

    // In-app notification
    await db.insert(notificationsTable).values({
      userId:    targetId,
      actorId:   "system",
      actorName: "Sky Journal",
      type:      "badge_removed",
      refId:     badge.slug,
      title:     `Your ${badge.name} badge has been removed.`,
      isRead:    false,
    });

    // Push notification (fire-and-forget)
    sendPushNotification(targetId, {
      title: `${badge.name} Badge Removed`,
      body:  `Your ${badge.name} badge has been removed by an admin.`,
    }).catch(() => {});

    req.log.info({ targetId, badgeId, slug: badge.slug }, "Admin revoked badge");
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin revoke badge failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Get user's current badges ─────────────────────────────────────────────────

router.get("/admin/users/:id/badges", requireAdmin, async (req: Request, res: Response) => {
  const targetId = String(req.params.id);
  try {
    const rows = await db
      .select({
        id:       badgesTable.id,
        slug:     badgesTable.slug,
        name:     badgesTable.name,
        emoji:    badgesTable.emoji,
        color:    badgesTable.color,
        imageUrl: badgesTable.imageUrl,
        grantedAt: characterBadgesTable.grantedAt,
      })
      .from(characterBadgesTable)
      .innerJoin(badgesTable, eq(badgesTable.id, characterBadgesTable.badgeId))
      .where(eq(characterBadgesTable.userId, targetId))
      .orderBy(asc(badgesTable.sortOrder));

    return res.json({
      badges: rows.map(b => ({ ...b, imageUrl: resolveImageUrl(req, b.imageUrl) })),
    });
  } catch (err) {
    req.log.error({ err }, "Admin get user badges failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
