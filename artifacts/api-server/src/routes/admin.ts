import {
  db,
  characterTable,
  storiesTable,
  outfitsTable,
  reportsTable,
  journalEntriesTable,
  followsTable,
} from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, count, desc, eq, gte, ilike, ne, or, sql } from "drizzle-orm";
import { requireAdmin, getUserId } from "../middleware/auth";

const router: IRouter = Router();

// ── Public config (no auth) ───────────────────────────────────────────────────
router.get("/admin/config", (_req: Request, res: Response) => {
  res.json({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? "" });
});

// ── Me / role check ──────────────────────────────────────────────────────────
router.get("/admin/me", requireAdmin, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const [row] = await db
    .select({ userId: characterTable.userId, name: characterTable.name, isAdmin: characterTable.isAdmin })
    .from(characterTable)
    .where(eq(characterTable.userId, userId))
    .limit(1);
  return res.json(row ?? { userId, isAdmin: true });
});

// ── Dashboard stats ───────────────────────────────────────────────────────────
router.get("/admin/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      [{ totalUsers }],
      [{ bannedUsers }],
      [{ adminUsers }],
      [{ totalStories }],
      [{ totalOutfits }],
      [{ pendingReports }],
      [{ recentSignups }],
    ] = await Promise.all([
      db.select({ totalUsers: count() }).from(characterTable),
      db.select({ bannedUsers: count() }).from(characterTable).where(eq(characterTable.isBanned, true)),
      db.select({ adminUsers: count() }).from(characterTable).where(eq(characterTable.isAdmin, true)),
      db.select({ totalStories: count() }).from(storiesTable),
      db.select({ totalOutfits: count() }).from(outfitsTable),
      db.select({ pendingReports: count() }).from(reportsTable).where(eq(reportsTable.status, "pending")),
      db.select({ recentSignups: count() }).from(characterTable).where(gte(characterTable.updatedAt, thirtyDaysAgo)),
    ]);

    return res.json({
      totalUsers,
      bannedUsers,
      adminUsers,
      totalStories,
      totalOutfits,
      pendingReports,
      recentSignups,
    });
  } catch (err) {
    req.log.error({ err }, "Admin stats failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── User management ───────────────────────────────────────────────────────────

router.get("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  const q      = String(req.query.q ?? "").trim();
  const limit  = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
  const offset = Math.max(0, Number(req.query.offset ?? 0));

  try {
    const where = q
      ? or(
          ilike(characterTable.name, `%${q}%`),
          ilike(characterTable.username, `%${q}%`),
        )
      : undefined;

    const rows = await db
      .select({
        userId:    characterTable.userId,
        username:  characterTable.username,
        name:      characterTable.name,
        bio:       characterTable.bio,
        mood:      characterTable.mood,
        isPublic:  characterTable.isPublic,
        isAdmin:   characterTable.isAdmin,
        isBanned:  characterTable.isBanned,
        updatedAt: characterTable.updatedAt,
      })
      .from(characterTable)
      .where(where)
      .orderBy(desc(characterTable.updatedAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(characterTable)
      .where(where);

    return res.json({ users: rows, total });
  } catch (err) {
    req.log.error({ err }, "Admin list users failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/users/:id/ban", requireAdmin, async (req: Request, res: Response) => {
  const adminId = getUserId(req);
  const targetId = String(req.params.id);

  if (targetId === adminId) {
    return res.status(400).json({ error: "Cannot ban yourself" });
  }

  try {
    await db
      .update(characterTable)
      .set({ isBanned: true })
      .where(and(eq(characterTable.userId, targetId), ne(characterTable.isAdmin, true)));

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin ban user failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/users/:id/unban", requireAdmin, async (req: Request, res: Response) => {
  const targetId = String(req.params.id);

  try {
    await db
      .update(characterTable)
      .set({ isBanned: false })
      .where(eq(characterTable.userId, targetId));

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin unban user failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/users/:id/toggle-admin", requireAdmin, async (req: Request, res: Response) => {
  const adminId  = getUserId(req);
  const targetId = String(req.params.id);

  if (targetId === adminId) {
    return res.status(400).json({ error: "Cannot change your own admin status" });
  }

  try {
    const [row] = await db
      .select({ isAdmin: characterTable.isAdmin })
      .from(characterTable)
      .where(eq(characterTable.userId, targetId))
      .limit(1);

    if (!row) return res.status(404).json({ error: "User not found" });

    await db
      .update(characterTable)
      .set({ isAdmin: !row.isAdmin })
      .where(eq(characterTable.userId, targetId));

    return res.json({ isAdmin: !row.isAdmin });
  } catch (err) {
    req.log.error({ err }, "Admin toggle admin failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  const adminId  = getUserId(req);
  const targetId = String(req.params.id);

  if (targetId === adminId) {
    return res.status(400).json({ error: "Cannot delete yourself" });
  }

  try {
    // Cascade delete all user content
    await db.delete(storiesTable).where(eq(storiesTable.userId, targetId));
    await db.delete(outfitsTable).where(eq(outfitsTable.userId, targetId));
    await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, targetId));
    await db.delete(followsTable).where(
      or(eq(followsTable.followerId, targetId), eq(followsTable.followingId, targetId))
    );
    await db.delete(characterTable).where(eq(characterTable.userId, targetId));

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete user failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Content moderation ────────────────────────────────────────────────────────

router.get("/admin/content", requireAdmin, async (req: Request, res: Response) => {
  const type   = String(req.query.type ?? "stories");
  const limit  = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
  const offset = Math.max(0, Number(req.query.offset ?? 0));

  try {
    if (type === "outfits") {
      const rows = await db
        .select({
          id:          outfitsTable.id,
          userId:      outfitsTable.userId,
          name:        outfitsTable.name,
          description: outfitsTable.description,
          imageUri:    outfitsTable.imageUri,
          tags:        outfitsTable.tags,
          isPublic:    outfitsTable.isPublic,
          isHidden:    outfitsTable.isHidden,
          date:        outfitsTable.date,
          authorName:  characterTable.name,
          username:    characterTable.username,
        })
        .from(outfitsTable)
        .leftJoin(characterTable, eq(characterTable.userId, outfitsTable.userId))
        .orderBy(desc(outfitsTable.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ total }] = await db.select({ total: count() }).from(outfitsTable);
      return res.json({ items: rows, total });
    }

    // Default: stories
    const rows = await db
      .select({
        id:             storiesTable.id,
        userId:         storiesTable.userId,
        chapterTitle:   storiesTable.chapterTitle,
        mood:           storiesTable.mood,
        isPublic:       storiesTable.isPublic,
        isHidden:       storiesTable.isHidden,
        witnessedCount: storiesTable.witnessedCount,
        savedCount:     storiesTable.savedCount,
        date:           storiesTable.date,
        authorName:     characterTable.name,
        username:       characterTable.username,
      })
      .from(storiesTable)
      .leftJoin(characterTable, eq(characterTable.userId, storiesTable.userId))
      .orderBy(desc(storiesTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(storiesTable);
    return res.json({ items: rows, total });
  } catch (err) {
    req.log.error({ err }, "Admin list content failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/content/stories/:id/hide", requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.update(storiesTable).set({ isHidden: true }).where(eq(storiesTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin hide story failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/content/stories/:id/unhide", requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.update(storiesTable).set({ isHidden: false }).where(eq(storiesTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin unhide story failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/content/stories/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(storiesTable).where(eq(storiesTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete story failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/content/outfits/:id/hide", requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.update(outfitsTable).set({ isHidden: true }).where(eq(outfitsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin hide outfit failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/content/outfits/:id/unhide", requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.update(outfitsTable).set({ isHidden: false }).where(eq(outfitsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin unhide outfit failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/content/outfits/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(outfitsTable).where(eq(outfitsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete outfit failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Reports ───────────────────────────────────────────────────────────────────

router.get("/admin/reports", requireAdmin, async (req: Request, res: Response) => {
  const status = String(req.query.status ?? "pending");
  const limit  = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
  const offset = Math.max(0, Number(req.query.offset ?? 0));

  try {
    const where = status === "all" ? undefined : eq(reportsTable.status, status);

    const rows = await db
      .select()
      .from(reportsTable)
      .where(where)
      .orderBy(desc(reportsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(reportsTable).where(where);
    return res.json({ reports: rows, total });
  } catch (err) {
    req.log.error({ err }, "Admin list reports failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/reports/:id/resolve", requireAdmin, async (req: Request, res: Response) => {
  const adminId  = getUserId(req);
  const reportId = String(req.params.id);
  const status   = String((req.body as { status?: string }).status ?? "resolved");

  if (!["resolved", "dismissed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    await db
      .update(reportsTable)
      .set({ status, resolvedById: adminId, resolvedAt: new Date() })
      .where(eq(reportsTable.id, reportId));

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin resolve report failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/reports/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(reportsTable).where(eq(reportsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete report failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
