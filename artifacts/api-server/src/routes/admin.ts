import {
  db,
  characterTable,
  storiesTable,
  outfitsTable,
  reportsTable,
  journalEntriesTable,
  followsTable,
  stickerReactionsTable,
  notificationsTable,
  badgesTable,
  characterBadgesTable,
  campfireMessagesTable,
  campfireRoomsTable,
} from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, count, desc, eq, gte, ilike, inArray, lte, ne, or, sql } from "drizzle-orm";
import { requireAdmin, requireAuth, getUserId } from "../middleware/auth";
import { clerkClient } from "@clerk/express";
import { connectedClientCount } from "../lib/sseEmitter";
import { sendPushNotification } from "../services/pushService";

const router: IRouter = Router();

// ── Public config (no auth) ───────────────────────────────────────────────────
router.get("/admin/config", (_req: Request, res: Response) => {
  res.json({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? "" });
});

// ── Bootstrap: claim first-admin (requires auth + out-of-band setup secret)
router.post("/admin/setup", requireAuth, async (req: Request, res: Response) => {
  const setupSecret = process.env.ADMIN_SETUP_SECRET;

  if (!setupSecret) {
    return res.status(403).json({ error: "Admin setup is disabled. Set ADMIN_SETUP_SECRET to enable it." });
  }

  const { secret } = req.body as { secret?: string };
  if (!secret || secret !== setupSecret) {
    return res.status(403).json({ error: "Invalid or missing setup secret." });
  }

  const userId = getUserId(req);
  try {
    const [{ adminCount }] = await db
      .select({ adminCount: count() })
      .from(characterTable)
      .where(eq(characterTable.isAdmin, true));

    if (adminCount > 0) {
      return res.status(403).json({ error: "An admin already exists. Contact them to grant access." });
    }

    await db
      .update(characterTable)
      .set({ isAdmin: true })
      .where(eq(characterTable.userId, userId));

    return res.json({ ok: true, message: "You are now an admin." });
  } catch (err) {
    req.log.error({ err }, "Admin setup failed");
    return res.status(500).json({ error: "Internal server error" });
  }
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
      [{ totalJournals }],
      [{ totalStickers }],
    ] = await Promise.all([
      db.select({ totalUsers: count() }).from(characterTable),
      db.select({ bannedUsers: count() }).from(characterTable).where(eq(characterTable.isBanned, true)),
      db.select({ adminUsers: count() }).from(characterTable).where(eq(characterTable.isAdmin, true)),
      db.select({ totalStories: count() }).from(storiesTable),
      db.select({ totalOutfits: count() }).from(outfitsTable),
      db.select({ pendingReports: count() }).from(reportsTable).where(eq(reportsTable.status, "pending")),
      db.select({ recentSignups: count() }).from(characterTable).where(gte(characterTable.updatedAt, thirtyDaysAgo)),
      db.select({ totalJournals: count() }).from(journalEntriesTable),
      db.select({ totalStickers: count() }).from(stickerReactionsTable),
    ]);

    return res.json({
      totalUsers,
      bannedUsers,
      adminUsers,
      totalStories,
      totalOutfits,
      pendingReports,
      recentSignups,
      totalJournals,
      totalStickers,
      onlineUsers: connectedClientCount(),
    });
  } catch (err) {
    req.log.error({ err }, "Admin stats failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── User detail (with Clerk email + content counts) ──────────────────────────

router.get("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  const targetId = String(req.params.id);
  try {
    const [row] = await db
      .select({
        userId:       characterTable.userId,
        username:     characterTable.username,
        name:         characterTable.name,
        bio:          characterTable.bio,
        mood:         characterTable.mood,
        traits:       characterTable.traits,
        isPublic:     characterTable.isPublic,
        isAdmin:      characterTable.isAdmin,
        isBanned:     characterTable.isBanned,
        galleryLimit:  characterTable.galleryLimit,
        updatedAt:     characterTable.updatedAt,
        isFounder:     characterTable.isFounder,
        isBetaTester:  characterTable.isBetaTester,
      })
      .from(characterTable)
      .where(eq(characterTable.userId, targetId))
      .limit(1);

    if (!row) return res.status(404).json({ error: "User not found" });

    // Fetch email from Clerk (non-fatal if it fails)
    let email: string | null = null;
    let clerkCreatedAt: number | null = null;
    try {
      const clerkUser = await clerkClient.users.getUser(targetId);
      email          = clerkUser.emailAddresses[0]?.emailAddress ?? null;
      clerkCreatedAt = clerkUser.createdAt;
    } catch { /* user may not exist in Clerk yet */ }

    // Content counts
    const [
      [{ storyCount }],
      [{ outfitCount }],
      [{ journalCount }],
      [{ followingCount }],
      [{ followersCount }],
    ] = await Promise.all([
      db.select({ storyCount:    count() }).from(storiesTable)       .where(eq(storiesTable.userId,       targetId)),
      db.select({ outfitCount:   count() }).from(outfitsTable)       .where(eq(outfitsTable.userId,       targetId)),
      db.select({ journalCount:  count() }).from(journalEntriesTable).where(eq(journalEntriesTable.userId, targetId)),
      db.select({ followingCount: count() }).from(followsTable)      .where(eq(followsTable.followerId,   targetId)),
      db.select({ followersCount: count() }).from(followsTable)      .where(eq(followsTable.followingId,  targetId)),
    ]);

    return res.json({
      ...row,
      email,
      clerkCreatedAt,
      storyCount,
      outfitCount,
      journalCount,
      followingCount,
      followersCount,
    });
  } catch (err) {
    req.log.error({ err }, "Admin get user detail failed");
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
        userId:       characterTable.userId,
        username:     characterTable.username,
        name:         characterTable.name,
        bio:          characterTable.bio,
        mood:         characterTable.mood,
        isPublic:      characterTable.isPublic,
        isAdmin:       characterTable.isAdmin,
        isBanned:      characterTable.isBanned,
        galleryLimit:  characterTable.galleryLimit,
        updatedAt:     characterTable.updatedAt,
        isFounder:     characterTable.isFounder,
        isBetaTester:  characterTable.isBetaTester,
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

    // Merge Clerk sign-in data (non-fatal)
    const clerkMap = new Map<string, { email?: string; lastSignInAt?: number | null }>();
    try {
      if (rows.length > 0) {
        const clerkUsers = await clerkClient.users.getUserList({
          userId: rows.map(r => r.userId),
          limit: rows.length,
        });
        for (const cu of clerkUsers.data) {
          clerkMap.set(cu.id, {
            email: cu.emailAddresses[0]?.emailAddress,
            lastSignInAt: cu.lastSignInAt ?? null,
          });
        }
      }
    } catch { /* non-fatal */ }

    const merged = rows.map(r => ({ ...r, ...clerkMap.get(r.userId) }));
    return res.json({ users: merged, total });
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
  const type     = String(req.query.type ?? "stories");
  const limit    = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
  const offset   = Math.max(0, Number(req.query.offset ?? 0));
  const q        = String(req.query.q ?? "").trim();
  const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
  const dateTo   = req.query.dateTo   ? (() => { const d = new Date(String(req.query.dateTo)); d.setDate(d.getDate() + 1); return d; })() : null;

  try {
    if (type === "outfits") {
      const conditions = [];
      if (q) conditions.push(or(ilike(characterTable.name, `%${q}%`), ilike(characterTable.username, `%${q}%`)));
      if (dateFrom && !isNaN(dateFrom.getTime())) conditions.push(gte(outfitsTable.createdAt, dateFrom));
      if (dateTo   && !isNaN(dateTo.getTime()))   conditions.push(lte(outfitsTable.createdAt, dateTo));
      const where = conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined;

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
        .where(where)
        .orderBy(desc(outfitsTable.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ total }] = await db
        .select({ total: count() })
        .from(outfitsTable)
        .leftJoin(characterTable, eq(characterTable.userId, outfitsTable.userId))
        .where(where);
      return res.json({ items: rows, total });
    }

    // Default: stories
    const conditions = [];
    if (q) conditions.push(or(ilike(characterTable.name, `%${q}%`), ilike(characterTable.username, `%${q}%`)));
    if (dateFrom && !isNaN(dateFrom.getTime())) conditions.push(gte(storiesTable.createdAt, dateFrom));
    if (dateTo   && !isNaN(dateTo.getTime()))   conditions.push(lte(storiesTable.createdAt, dateTo));
    const where = conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined;

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
        panels:         storiesTable.panels,
        date:           storiesTable.date,
        authorName:     characterTable.name,
        username:       characterTable.username,
      })
      .from(storiesTable)
      .leftJoin(characterTable, eq(characterTable.userId, storiesTable.userId))
      .where(where)
      .orderBy(desc(storiesTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(storiesTable)
      .leftJoin(characterTable, eq(characterTable.userId, storiesTable.userId))
      .where(where);
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

// ── Campfire message moderation ───────────────────────────────────────────────

router.delete("/admin/campfire-messages/:id", requireAdmin, async (req: Request, res: Response) => {
  const adminId   = getUserId(req);
  const messageId = String(req.params.id);

  try {
    let authorId: string | null = null;

    await db.transaction(async (tx) => {
      // Verify the message exists before deleting
      const [msg] = await tx
        .select({ id: campfireMessagesTable.id, userId: campfireMessagesTable.userId })
        .from(campfireMessagesTable)
        .where(eq(campfireMessagesTable.id, messageId))
        .limit(1);

      if (!msg) throw Object.assign(new Error("Message not found"), { status: 404 });

      authorId = msg.userId;

      // Delete the message
      await tx.delete(campfireMessagesTable).where(eq(campfireMessagesTable.id, messageId));

      // Auto-resolve any pending reports that targeted this message
      await tx
        .update(reportsTable)
        .set({ status: "resolved", resolvedById: adminId, resolvedAt: new Date() })
        .where(
          and(
            eq(reportsTable.targetType, "campfire_message"),
            eq(reportsTable.targetId, messageId),
            eq(reportsTable.status, "pending"),
          ),
        );
    });

    // Notify the message author
    if (authorId) {
      await db.insert(notificationsTable).values({
        userId:    authorId,
        actorId:   "system",
        actorName: "Sky Journal",
        type:      "content_removed",
        refId:     messageId,
        title:     "Your campfire message was removed by a moderator",
        isRead:    false,
      });

      // Push notification (fire-and-forget)
      sendPushNotification(authorId, {
        title: "Message Removed",
        body:  "Your campfire message was removed by a moderator.",
      }).catch(() => {});
    }

    req.log.info({ messageId, authorId }, "Admin deleted campfire message");
    return res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e?.status === 404) return res.status(404).json({ error: e.message ?? "Message not found" });
    req.log.error({ err }, "Admin delete campfire message failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Reports ───────────────────────────────────────────────────────────────────

router.get("/admin/reports", requireAdmin, async (req: Request, res: Response) => {
  const status     = String(req.query.status ?? "pending");
  const targetType = req.query.targetType ? String(req.query.targetType) : null;
  const limit      = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
  const offset     = Math.max(0, Number(req.query.offset ?? 0));

  try {
    const conditions = [];
    if (status !== "all") conditions.push(eq(reportsTable.status, status));
    if (targetType)       conditions.push(eq(reportsTable.targetType, targetType));
    const where = conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined;

    // Always join campfire tables so enrichment is available regardless of type filter.
    // The conditional join clause ensures non-campfire rows get null for all campfire fields.
    const rows = await db
      .select({
        id:           reportsTable.id,
        reporterId:   reportsTable.reporterId,
        targetType:   reportsTable.targetType,
        targetId:     reportsTable.targetId,
        reason:       reportsTable.reason,
        details:      reportsTable.details,
        status:       reportsTable.status,
        resolvedById: reportsTable.resolvedById,
        resolvedAt:   reportsTable.resolvedAt,
        createdAt:    reportsTable.createdAt,
        // campfire enrichment (null for non-campfire rows)
        messageContent:   campfireMessagesTable.content,
        messageExpiresAt: campfireMessagesTable.expiresAt,
        authorName:       campfireMessagesTable.authorName,
        roomName:         campfireRoomsTable.name,
        reporterName:     sql<string | null>`reporter_char.name`,
      })
      .from(reportsTable)
      .leftJoin(
        campfireMessagesTable,
        and(
          sql`${campfireMessagesTable.id}::text = ${reportsTable.targetId}`,
          eq(reportsTable.targetType, "campfire_message"),
        ),
      )
      .leftJoin(campfireRoomsTable, eq(campfireRoomsTable.id, campfireMessagesTable.roomId))
      .leftJoin(
        sql`${characterTable} AS reporter_char`,
        sql`reporter_char.user_id = ${reportsTable.reporterId}`,
      )
      .where(where)
      .orderBy(desc(reportsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(reportsTable).where(where);
    return res.json({
      reports: rows.map(r => ({
        ...r,
        createdAt:        r.createdAt.toISOString(),
        resolvedAt:       r.resolvedAt?.toISOString() ?? null,
        messageExpiresAt: r.messageExpiresAt?.toISOString() ?? null,
      })),
      total,
    });
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
    // Fetch the report to get the reporter's userId
    const [report] = await db
      .select({ reporterId: reportsTable.reporterId })
      .from(reportsTable)
      .where(eq(reportsTable.id, reportId))
      .limit(1);

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    await db
      .update(reportsTable)
      .set({ status, resolvedById: adminId, resolvedAt: new Date() })
      .where(eq(reportsTable.id, reportId));

    // Notify the reporter of the outcome
    const notificationTitle = status === "resolved"
      ? "Your report has been reviewed and action was taken"
      : "Your report was reviewed and dismissed";

    await db.insert(notificationsTable).values({
      userId:    report.reporterId,
      actorId:   "system",
      actorName: "Sky Journal",
      type:      status === "resolved" ? "report_resolved" : "report_dismissed",
      refId:     reportId,
      title:     notificationTitle,
      isRead:    false,
    });

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

// ── Gallery limit ─────────────────────────────────────────────────────────────

// ── Toggle Founder badge ──────────────────────────────────────────────────────
router.put("/admin/users/:id/toggle-founder", requireAdmin, async (req: Request, res: Response) => {
  const targetId = String(req.params.id);
  try {
    const [row] = await db
      .select({ isFounder: characterTable.isFounder, name: characterTable.name, pushToken: characterTable.pushToken })
      .from(characterTable)
      .where(eq(characterTable.userId, targetId))
      .limit(1);

    if (!row) return res.status(404).json({ error: "User not found" });

    const newValue = !row.isFounder;
    await db.update(characterTable).set({ isFounder: newValue }).where(eq(characterTable.userId, targetId));

    // Sync to dynamic badge system
    const [founderBadge] = await db.select({ id: badgesTable.id }).from(badgesTable).where(eq(badgesTable.slug, "founder")).limit(1);
    if (founderBadge) {
      if (newValue) {
        await db.insert(characterBadgesTable).values({ userId: targetId, badgeId: founderBadge.id }).onConflictDoNothing();
      } else {
        await db.delete(characterBadgesTable).where(and(eq(characterBadgesTable.userId, targetId), eq(characterBadgesTable.badgeId, founderBadge.id)));
      }
    }

    // In-app notification
    await db.insert(notificationsTable).values({
      userId:    targetId,
      actorId:   "system",
      actorName: "Sky Journal",
      type:      newValue ? "badge_granted" : "badge_removed",
      refId:     "founder",
      title:     newValue
        ? "🏆 You've been granted the Founder badge!"
        : "Your Founder badge has been removed.",
      isRead:    false,
    });

    // Push notification (fire-and-forget)
    sendPushNotification(targetId, {
      title: newValue ? "🏆 Founder Badge Granted!" : "Founder Badge Removed",
      body:  newValue
        ? "You've been recognized as a Founder of Sky Journal!"
        : "Your Founder badge has been removed by an admin.",
    }).catch(() => {});

    req.log.info({ targetId, isFounder: newValue }, "Admin toggled founder badge");
    return res.json({ ok: true, isFounder: newValue });
  } catch (err) {
    req.log.error({ err }, "Admin toggle-founder failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Toggle Beta Tester badge ──────────────────────────────────────────────────
router.put("/admin/users/:id/toggle-beta", requireAdmin, async (req: Request, res: Response) => {
  const targetId = String(req.params.id);
  try {
    const [row] = await db
      .select({ isBetaTester: characterTable.isBetaTester, name: characterTable.name, pushToken: characterTable.pushToken })
      .from(characterTable)
      .where(eq(characterTable.userId, targetId))
      .limit(1);

    if (!row) return res.status(404).json({ error: "User not found" });

    const newValue = !row.isBetaTester;
    await db.update(characterTable).set({ isBetaTester: newValue }).where(eq(characterTable.userId, targetId));

    // Sync to dynamic badge system
    const [betaBadge] = await db.select({ id: badgesTable.id }).from(badgesTable).where(eq(badgesTable.slug, "beta_tester")).limit(1);
    if (betaBadge) {
      if (newValue) {
        await db.insert(characterBadgesTable).values({ userId: targetId, badgeId: betaBadge.id }).onConflictDoNothing();
      } else {
        await db.delete(characterBadgesTable).where(and(eq(characterBadgesTable.userId, targetId), eq(characterBadgesTable.badgeId, betaBadge.id)));
      }
    }

    // In-app notification
    await db.insert(notificationsTable).values({
      userId:    targetId,
      actorId:   "system",
      actorName: "Sky Journal",
      type:      newValue ? "badge_granted" : "badge_removed",
      refId:     "beta_tester",
      title:     newValue
        ? "🧪 You've been granted the Beta Tester badge!"
        : "Your Beta Tester badge has been removed.",
      isRead:    false,
    });

    // Push notification (fire-and-forget)
    sendPushNotification(targetId, {
      title: newValue ? "🧪 Beta Tester Badge!" : "Beta Tester Badge Removed",
      body:  newValue
        ? "Welcome to the inner circle — you're now a Sky Journal Beta Tester!"
        : "Your Beta Tester badge has been removed by an admin.",
    }).catch(() => {});

    req.log.info({ targetId, isBetaTester: newValue }, "Admin toggled beta tester badge");
    return res.json({ ok: true, isBetaTester: newValue });
  } catch (err) {
    req.log.error({ err }, "Admin toggle-beta failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/users/:id/gallery-limit", requireAdmin, async (req: Request, res: Response) => {
  const userId = String(req.params.id);
  const { limit } = req.body;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 50000) {
    return res.status(400).json({ error: "Limit must be an integer between 1 and 50000" });
  }
  try {
    await db
      .update(characterTable)
      .set({ galleryLimit: limit })
      .where(eq(characterTable.userId, userId));
    return res.json({ ok: true, limit });
  } catch (err) {
    req.log.error({ err }, "Admin set gallery limit failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Sticker activity ──────────────────────────────────────────────────────────
router.get("/admin/stickers", requireAdmin, async (req: Request, res: Response) => {
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0")));
  const limit  = 50;
  try {
    const rows = await db
      .select()
      .from(stickerReactionsTable)
      .orderBy(desc(stickerReactionsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [[{ total }]] = await Promise.all([
      db.select({ total: count() }).from(stickerReactionsTable),
    ]);

    const userIds = [...new Set([...rows.map(r => r.fromUserId), ...rows.map(r => r.toUserId)])];
    const chars = userIds.length > 0
      ? await db
          .select({ userId: characterTable.userId, name: characterTable.name, username: characterTable.username })
          .from(characterTable)
          .where(inArray(characterTable.userId, userIds))
      : [];
    const charMap = Object.fromEntries(chars.map(c => [c.userId, c]));

    return res.json({
      stickers: rows.map(r => ({
        id:           r.id,
        fromUserId:   r.fromUserId,
        fromName:     charMap[r.fromUserId]?.name     ?? "Unknown",
        fromUsername: charMap[r.fromUserId]?.username ?? null,
        toUserId:     r.toUserId,
        toName:       charMap[r.toUserId]?.name     ?? "Unknown",
        toUsername:   charMap[r.toUserId]?.username ?? null,
        storyId:      r.storyId,
        stickerType:  r.stickerType,
        createdAt:    r.createdAt.toISOString(),
      })),
      total,
    });
  } catch (err) {
    req.log.error({ err }, "Admin stickers failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
