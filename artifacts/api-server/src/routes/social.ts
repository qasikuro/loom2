import { db, characterTable, storiesTable, storyLikesTable, profileLikesTable, chapterLikesTable, followsTable, friendRequestsTable, outfitsTable, notificationsTable, stickerReactionsTable, constellationProgressTable, userRewardsTable, userPurchasesTable, badgesTable, characterBadgesTable, booksTable, chaptersTable } from "@workspace/db";
import type { BookChapterPage } from "@workspace/db";
import { and, asc, count, desc, eq, ilike, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { grantReward } from "../services/rewardService";
import { syncConstellation } from "../services/constellationService";
import { sendPushNotification } from "../services/pushService";
import * as cache from "../lib/cache";
import { isBlocked } from "./blocks";
import { SHOP_CATALOG } from "./rewards";
import { founderCardFrame } from "../services/founderRegalia";
import { normalizePublicMediaFields, publicMediaUri as safeDiscoverUri } from "../lib/publicMediaUri";
import { emitSSEEvent } from "../lib/sseEmitter";
import { areFriends, readableContentSql } from "../lib/contentVisibility";
import { withOwnerMediaUrls } from "../lib/mediaAccess";

const router: IRouter = Router();
const PUBLIC_PROFILE_FRAME_IDS = new Set(
  SHOP_CATALOG.filter(item => item.category === "frame").map(item => item.id),
);
const PUBLIC_PROFILE_EFFECT_IDS = new Set(
  SHOP_CATALOG.filter(item => item.category === "effect").map(item => item.id),
);
const PUBLIC_PROFILE_COSMETIC_IDS = [
  ...PUBLIC_PROFILE_FRAME_IDS,
  ...PUBLIC_PROFILE_EFFECT_IDS,
];

// ── User search ───────────────────────────────────────────────────────────────

router.get("/users/search", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const raw = String(req.query.q ?? "").trim();
  if (raw.length < 1) return res.json([]);
  // Strip leading @ so users can search "@handle" or "handle" interchangeably
  const q = raw.startsWith('@') ? raw.slice(1) : raw;
  if (q.length < 1) return res.json([]);

  // M-2: character_name_trgm_idx and character_username_trgm_idx are GIN
  // trigram indexes (pg_trgm extension) applied via DB migration. Postgres
  // uses them automatically for ILIKE patterns — the %q% contains-search on
  // name is now an index scan instead of a full-table scan.
  try {
    // Collect all user IDs involved in a block with the current user (either direction)
    const blockRows = await db.execute(sql`
      SELECT blocker_id AS id FROM blocks WHERE blocked_id = ${userId}
      UNION
      SELECT blocked_id AS id FROM blocks WHERE blocker_id = ${userId}
    `);
    const blockedIds = blockRows.rows.map((r) => (r as { id: string }).id);

    const rows = await db
      .select({
        userId:    characterTable.userId,
        username:  characterTable.username,
        name:      characterTable.name,
        bio:       characterTable.bio,
        traits:    characterTable.traits,
        avatarUri: characterTable.avatarUri,
      })
      .from(characterTable)
      .where(
        and(
          ne(characterTable.userId, userId),
          eq(characterTable.isBanned, false),
          eq(characterTable.isHidden, false),
          or(
            ilike(characterTable.username, `${q}%`),
            ilike(characterTable.name, `%${q}%`),
          ),
          blockedIds.length > 0 ? notInArray(characterTable.userId, blockedIds) : undefined,
        ),
      )
      .limit(20);

    const followingRows = await db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, userId));

    const followingSet = new Set(followingRows.map(r => r.followingId));

    return res.json(rows.map(r => ({
      userId:      r.userId,
      username:    r.username,
      name:        r.name,
      bio:         r.bio,
      traits:      r.traits,
      avatarUri:   safeDiscoverUri(r.avatarUri),
      isFollowing: followingSet.has(r.userId),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to search users");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Friends list (profiles of people I follow) ───────────────────────────────

router.get("/friends", requireAuth, async (req, res) => {
  res.set({ "Cache-Control": "private, no-store", ETag: `W/"friends-${randomUUID()}"` });
  const userId = getUserId(req);
  try {
    const followingRows = await db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, userId));

    if (followingRows.length === 0) return res.json([]);

    const followingIds = followingRows.map(r => r.followingId);

    const filtered = await db
      .select({
        userId:    characterTable.userId,
        name:      characterTable.name,
        username:  characterTable.username,
        bio:       characterTable.bio,
        mood:      characterTable.mood,
        traits:    characterTable.traits,
        avatarUri: characterTable.avatarUri,
        activeOutfitImageUri: outfitsTable.imageUri,
        birthday:  characterTable.birthday,
        country:   characterTable.country,
        links:     characterTable.links,
        isPublic:  characterTable.isPublic,
        showOnlineStatus: characterTable.showOnlineStatus,
        lastSeenAt: characterTable.lastSeenAt,
      })
      .from(characterTable)
      .leftJoin(outfitsTable, and(
        sql`${outfitsTable.id}::text = ${characterTable.activeOutfitId}`,
        eq(outfitsTable.userId, characterTable.userId),
        eq(outfitsTable.isPublic, true),
      ))
      .where(
        and(
          inArray(characterTable.userId, followingIds),
          eq(characterTable.isBanned, false),
          eq(characterTable.isHidden, false),
          sql`${characterTable.userId} NOT IN (
            SELECT blocked_id FROM blocks WHERE blocker_id = ${userId}
            UNION SELECT blocker_id FROM blocks WHERE blocked_id = ${userId}
          )`,
        ),
      );

    return res.json(
      filtered.map(p => ({
        userId:    p.userId,
        name:      p.name,
        username:  p.username ?? null,
        bio:       p.bio,
        mood:      p.mood,
        traits:    Array.isArray(p.traits) ? p.traits : [],
        avatarUri: safeDiscoverUri(p.avatarUri) ?? safeDiscoverUri(p.activeOutfitImageUri),
        birthday:  p.birthday ?? null,
        country:   p.country  ?? null,
        links:     Array.isArray(p.links) ? p.links : [],
        isPublic:  p.isPublic,
        isOnline: Boolean(p.showOnlineStatus && p.lastSeenAt && Date.now() - p.lastSeenAt.getTime() < 5 * 60_000),
        lastSeenAt: p.showOnlineStatus ? p.lastSeenAt?.toISOString() ?? null : null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get friends list");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Pending invitations are separate from follows. Accepting creates mutual follows;
// legacy one-way follows stay in /friends for backward compatibility.
router.get("/friends/requests", requireAuth, async (req, res) => {
  res.set({ "Cache-Control": "private, no-store", ETag: `W/"friend-requests-${randomUUID()}"` });
  const userId = getUserId(req);
  try {
    const rows = await db.select({
      id: friendRequestsTable.id,
      senderId: friendRequestsTable.senderId,
      recipientId: friendRequestsTable.recipientId,
      createdAt: friendRequestsTable.createdAt,
    }).from(friendRequestsTable)
      .where(or(eq(friendRequestsTable.senderId, userId), eq(friendRequestsTable.recipientId, userId)))
      .orderBy(desc(friendRequestsTable.createdAt));
    const ids = [...new Set(rows.map(r => r.senderId === userId ? r.recipientId : r.senderId))];
    if (ids.length === 0) return res.json([]);
    const profiles = await db.select({
      userId: characterTable.userId,
      name: characterTable.name,
      username: characterTable.username,
      avatarUri: characterTable.avatarUri,
    }).from(characterTable).where(and(
      inArray(characterTable.userId, ids),
      eq(characterTable.isBanned, false),
      eq(characterTable.isHidden, false),
      sql`${characterTable.userId} NOT IN (
        SELECT blocked_id FROM blocks WHERE blocker_id = ${userId}
        UNION SELECT blocker_id FROM blocks WHERE blocked_id = ${userId}
      )`,
    ));
    const byId = new Map(profiles.map(p => [p.userId, p]));
    return res.json(rows.flatMap(r => {
      const person = byId.get(r.senderId === userId ? r.recipientId : r.senderId);
      return person ? [{
        id: r.id, direction: r.recipientId === userId ? "incoming" : "outgoing",
        userId: person.userId, name: person.name, username: person.username,
        avatarUri: safeDiscoverUri(person.avatarUri), createdAt: r.createdAt.toISOString(),
      }] : [];
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to get friend requests");
    return res.status(500).json({ error: "Could not load friend requests" });
  }
});

router.post("/friends/requests/:targetUserId", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const targetId = String(req.params.targetUserId);
  if (targetId === userId) return res.status(400).json({ error: "Cannot add yourself" });
  try {
    if (await isBlocked(userId, targetId)) return res.status(403).json({ error: "This user is unavailable" });
    const [target] = await db.select({ userId: characterTable.userId })
      .from(characterTable).where(and(eq(characterTable.userId, targetId), eq(characterTable.isBanned, false), eq(characterTable.isHidden, false), eq(characterTable.isPublic, true))).limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });
    const existing = await db.select({ id: followsTable.followingId }).from(followsTable)
      .where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetId))).limit(1);
    if (existing.length) return res.status(409).json({ error: "Already in your friends list" });
    const [actor] = await db.select({ name: characterTable.name })
      .from(characterTable).where(eq(characterTable.userId, userId)).limit(1);
    const actorName = actor?.name ?? "A Storigam player";
    const request = await db.transaction(async tx => {
      const [created] = await tx.insert(friendRequestsTable)
        .values({ senderId: userId, recipientId: targetId })
        .onConflictDoNothing().returning({ id: friendRequestsTable.id });
      if (!created) return null;
      await tx.insert(notificationsTable).values({
        userId: targetId,
        actorId: userId,
        actorName,
        type: "friend_request",
        refId: created.id,
        title: "Sent you a friend request",
      });
      return created;
    });
    if (!request) return res.status(409).json({ error: "A friend request already exists" });
    void sendPushNotification(targetId, {
      title: actorName,
      body: "sent you a friend request",
      data: { type: "friend_request", refId: request.id, actorId: userId },
    }).catch(err => req.log.warn({ err }, "Failed to send friend request push"));
    return res.status(201).json({ id: request.id });
  } catch (err) {
    req.log.error({ err }, "Failed to send friend request");
    return res.status(500).json({ error: "Could not send friend request" });
  }
});

router.post("/friends/requests/:id/accept", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.params.id)))
    return res.status(400).json({ error: "Invalid request ID" });
  try {
    const accepted = await db.transaction(async tx => {
      const [request] = await tx.delete(friendRequestsTable)
        .where(and(eq(friendRequestsTable.id, String(req.params.id)), eq(friendRequestsTable.recipientId, userId)))
        .returning({ senderId: friendRequestsTable.senderId });
      if (!request) return null;
      // A block can happen between sending and accepting.
      if (await isBlocked(userId, request.senderId)) throw new Error("BLOCKED");
      await tx.insert(followsTable).values([
        { followerId: userId, followingId: request.senderId },
        { followerId: request.senderId, followingId: userId },
      ]).onConflictDoNothing();
      const [actor] = await tx.select({ name: characterTable.name })
        .from(characterTable).where(eq(characterTable.userId, userId)).limit(1);
      const actorName = actor?.name ?? "A Storigam player";
      await tx.insert(notificationsTable).values({
        userId: request.senderId,
        actorId: userId,
        actorName,
        type: "friend_accepted",
        refId: userId,
        title: "Accepted your friend request",
      });
      return { senderId: request.senderId, actorName };
    });
    if (!accepted) return res.status(404).json({ error: "Request no longer available" });
    cache.invalidate(`discover:${userId}`);
    cache.invalidate(`discover:${accepted.senderId}`);
    void sendPushNotification(accepted.senderId, {
      title: accepted.actorName,
      body: "accepted your friend request",
      data: { type: "friend_accepted", refId: userId, actorId: userId },
    }).catch(err => req.log.warn({ err }, "Failed to send friend acceptance push"));
    return res.json({ accepted: true });
  } catch (err) {
    if (err instanceof Error && err.message === "BLOCKED") return res.status(403).json({ error: "This user is unavailable" });
    req.log.error({ err }, "Failed to accept friend request");
    return res.status(500).json({ error: "Could not accept friend request" });
  }
});

router.delete("/friends/requests/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.params.id)))
    return res.status(400).json({ error: "Invalid request ID" });
  try {
    const [removed] = await db.delete(friendRequestsTable)
      .where(and(eq(friendRequestsTable.id, String(req.params.id)),
        or(eq(friendRequestsTable.senderId, userId), eq(friendRequestsTable.recipientId, userId))))
      .returning({ id: friendRequestsTable.id });
    if (!removed) return res.status(404).json({ error: "Request no longer available" });
    return res.json({ removed: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove friend request");
    return res.status(500).json({ error: "Could not remove friend request" });
  }
});

// ── Public user profile ───────────────────────────────────────────────────────

router.get("/users/:userId", requireAuth, async (req, res) => {
  const viewerId = getUserId(req);
  const targetId = String(req.params.userId);
  res.set({ "Cache-Control": "private, no-store", ETag: `W/"profile-${randomUUID()}"` });

  try {
    // Deny access when a block exists in either direction
    if (viewerId !== targetId && await isBlocked(viewerId, targetId)) {
      return res.status(403).json({ error: "This profile is unavailable." });
    }

    const [charRows, followingRows, profileLikeCounts, viewerProfileLike, ownedCosmeticRows] = await Promise.all([
      db.select({
        userId:           characterTable.userId,
        name:             characterTable.name,
        username:         characterTable.username,
        bio:              characterTable.bio,
        traits:           characterTable.traits,
        mood:             characterTable.mood,
        isPublic:         characterTable.isPublic,
        isBanned:         characterTable.isBanned,
        isHidden:         characterTable.isHidden,
        avatarUri:        characterTable.avatarUri,
        activeOutfitId:   characterTable.activeOutfitId,
        birthday:         characterTable.birthday,
        country:          characterTable.country,
        role:             characterTable.role,
        timezone:         characterTable.timezone,
        links:            characterTable.links,
        intention:        characterTable.intention,
        intentionDate:    characterTable.intentionDate,
        activeTitle:      constellationProgressTable.activeTitle,
        lifetimeStars:    userRewardsTable.lifetimeStars,
        activeCosmetics:  userRewardsTable.activeCosmetics,
        isFounder:        characterTable.isFounder,
        isBetaTester:     characterTable.isBetaTester,
        showOnlineStatus: characterTable.showOnlineStatus,
        lastSeenAt:       characterTable.lastSeenAt,
      })
        .from(characterTable)
        .leftJoin(constellationProgressTable, eq(constellationProgressTable.userId, characterTable.userId))
        .leftJoin(userRewardsTable, eq(userRewardsTable.userId, characterTable.userId))
        .where(eq(characterTable.userId, targetId))
        .limit(1),

      db.select({ followingId: followsTable.followingId })
        .from(followsTable)
        .where(eq(followsTable.followerId, viewerId)),
      db.select({ total: count() })
        .from(profileLikesTable)
        .where(eq(profileLikesTable.profileUserId, targetId)),
      db.select({ likerId: profileLikesTable.likerId })
        .from(profileLikesTable)
        .where(and(
          eq(profileLikesTable.profileUserId, targetId),
          eq(profileLikesTable.likerId, viewerId),
        )),
      db.select({ itemId: userPurchasesTable.itemId })
        .from(userPurchasesTable)
        .where(and(
          eq(userPurchasesTable.userId, targetId),
          inArray(userPurchasesTable.itemId, PUBLIC_PROFILE_COSMETIC_IDS),
        )),
    ]);

    if (!charRows.length || charRows[0].isBanned || (charRows[0].isHidden && viewerId !== targetId)) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!charRows[0].isPublic && viewerId !== targetId && !await areFriends(targetId, viewerId)) {
      return res.status(403).json({ error: "This profile is private. Only friends can view it.", code: "PROFILE_PRIVATE" });
    }

    const char = charRows[0];
    const followingSet = new Set(followingRows.map(r => r.followingId));
    const ownedCosmeticIds = new Set(ownedCosmeticRows.map(row => row.itemId));
    const savedCosmetics = char.activeCosmetics && typeof char.activeCosmetics === "object"
      ? char.activeCosmetics as Record<string, unknown>
      : {};
    const savedFrame = savedCosmetics.frame;
    const activeFrame = typeof savedFrame === "string"
      && PUBLIC_PROFILE_FRAME_IDS.has(savedFrame)
      && ownedCosmeticIds.has(savedFrame)
      ? savedFrame
      : null;
    const savedEffect = savedCosmetics.effect;
    const activeEffect = typeof savedEffect === "string"
      && PUBLIC_PROFILE_EFFECT_IDS.has(savedEffect)
      && (ownedCosmeticIds.has(savedEffect)
        || (char.isFounder && savedEffect === "effect_aurora_clouds"))
      ? savedEffect
      : null;

    // Fetch active outfit data if one is set
    let activeOutfit: null | {
      id: string; name: string; description: string; story: string;
      imageUri: string | null; tags: string[]; music: typeof outfitsTable.$inferSelect.music;
    } = null;

    if (char.activeOutfitId) {
      const [outfitRow] = await db
        .select({
          id:          outfitsTable.id,
          name:        outfitsTable.name,
          description: outfitsTable.description,
          story:       outfitsTable.story,
          imageUri:    outfitsTable.imageUri,
          tags:        outfitsTable.tags,
          music:       outfitsTable.music,
          isPublic:    outfitsTable.isPublic,
        })
        .from(outfitsTable)
        .where(
          and(
            eq(outfitsTable.id, char.activeOutfitId),
            eq(outfitsTable.userId, targetId),
            readableContentSql(outfitsTable.userId, viewerId, outfitsTable.visibility, outfitsTable.isPublic),
            eq(outfitsTable.isHidden, false),
          ),
        )
        .limit(1);

      if (outfitRow) {
        activeOutfit = {
          id:          outfitRow.id,
          name:        outfitRow.name,
          description: outfitRow.description ?? '',
          story:       outfitRow.story ?? '',
          imageUri:    safeDiscoverUri(outfitRow.imageUri),
          tags:        Array.isArray(outfitRow.tags) ? outfitRow.tags : [],
          music:       outfitRow.music ?? null,
        };
      }
    }

    // Fetch dynamic badges for this user
    const userBadgeRows = await db
      .select({
        id:          badgesTable.id,
        slug:        badgesTable.slug,
        name:        badgesTable.name,
        emoji:       badgesTable.emoji,
        color:       badgesTable.color,
        imageUrl:    badgesTable.imageUrl,
        description: badgesTable.description,
      })
      .from(characterBadgesTable)
      .innerJoin(badgesTable, eq(badgesTable.id, characterBadgesTable.badgeId))
      .where(eq(characterBadgesTable.userId, targetId))
      .orderBy(asc(badgesTable.sortOrder));

    return res.json(withOwnerMediaUrls({
      userId:        char.userId,
      name:          char.name,
      username:      char.username,
      bio:           char.bio,
      traits:        char.traits,
      mood:          char.mood,
      avatarUri:     safeDiscoverUri(char.avatarUri),
      activeOutfitId: char.activeOutfitId ?? null,
      activeOutfit,
      activeFrame,
      activeEffect,
      activeCardFrame: founderCardFrame(Boolean(char.isFounder), savedCosmetics.card_frame),
      birthday:      char.birthday  ?? null,
      country:       char.country   ?? null,
      role:          char.role      ?? null,
      timezone:      char.timezone  ?? null,
      links:         Array.isArray(char.links) ? char.links : [],
      isFollowing:   followingSet.has(targetId),
      profileLikeCount: Number(profileLikeCounts[0]?.total ?? 0),
      profileLiked:     viewerProfileLike.length > 0,
      activeTitle:   char.activeTitle   ?? null,
      intention:     char.intention     ?? null,
      intentionDate:    char.intentionDate ?? null,
      stars:            char.lifetimeStars  ?? 0,
      isFounder:        char.isFounder     ?? false,
      isBetaTester:     char.isBetaTester  ?? false,
      badges:           userBadgeRows,
      showOnlineStatus: char.showOnlineStatus ?? true,
      isOnline:         char.showOnlineStatus && char.lastSeenAt
        ? (Date.now() - new Date(char.lastSeenAt).getTime()) < 5 * 60 * 1000
        : false,
    }, viewerId));
  } catch (err) {
    req.log.error({ err }, "Failed to get user profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public user stories (public only) ────────────────────────────────────────

router.get("/users/:userId/stories", requireAuth, async (req, res) => {
  const viewerId = getUserId(req);
  const targetId = String(req.params.userId);

  try {
    // Deny access when a block exists in either direction
    if (viewerId !== targetId && await isBlocked(viewerId, targetId)) {
      return res.status(403).json({ error: "This profile is unavailable." });
    }

    // A private profile is available to its owner and reciprocal friends.
    const [charRow] = await db
      .select({ isPublic: characterTable.isPublic, isHidden: characterTable.isHidden, isBanned: characterTable.isBanned })
      .from(characterTable)
      .where(eq(characterTable.userId, targetId))
      .limit(1);

    if (!charRow || charRow.isBanned || (charRow.isHidden && viewerId !== targetId)
      || (!charRow.isPublic && viewerId !== targetId && !await areFriends(targetId, viewerId))) {
      return res.json([]);
    }

    const rows = await db
      .select({
        id:             storiesTable.id,
        chapterTitle:   storiesTable.chapterTitle,
        description:    storiesTable.description,
        mood:           storiesTable.mood,
        location:       storiesTable.location,
        panels:         storiesTable.panels,
        pageLayoutKey:  storiesTable.pageLayoutKey,
        pages:          storiesTable.pages,
        witnessedCount: storiesTable.witnessedCount,
        savedCount:     storiesTable.savedCount,
        date:           storiesTable.date,
        contentType:    storiesTable.contentType,
        videoUri:       storiesTable.videoUri,
        thumbnailUri:   storiesTable.thumbnailUri,
        music:          storiesTable.music,
      })
      .from(storiesTable)
      .where(
        and(
          eq(storiesTable.userId, targetId),
          req.query.type === "video" ? eq(storiesTable.contentType, "video") : ne(storiesTable.contentType, "video"),
          readableContentSql(storiesTable.userId, viewerId, storiesTable.visibility, storiesTable.isPublic),
          eq(storiesTable.isHidden, false),
        ),
      )
      .orderBy(desc(storiesTable.date))
      .limit(50);

    const storyIds = rows.map(r => r.id);
    const [likeCountRows, viewerLikeRows] = storyIds.length
      ? await Promise.all([
          db.select({ storyId: storyLikesTable.storyId, total: count() })
            .from(storyLikesTable)
            .where(inArray(storyLikesTable.storyId, storyIds))
            .groupBy(storyLikesTable.storyId),
          db.select({ storyId: storyLikesTable.storyId })
            .from(storyLikesTable)
            .where(and(
              eq(storyLikesTable.userId, viewerId),
              inArray(storyLikesTable.storyId, storyIds),
            )),
        ])
      : [[], []];
    const storyLikeCounts = new Map(likeCountRows.map(r => [r.storyId, Number(r.total)]));
    const viewerLikedStoryIds = new Set(viewerLikeRows.map(r => r.storyId));

    const stories = rows.map(r => ({
      id:             r.id,
      chapterTitle:   r.chapterTitle,
      description:    r.description ?? '',
      mood:           r.mood,
      location:       r.location,
      panels:         Array.isArray(r.panels)
        ? (r.panels as Array<Record<string, unknown>>).map(p => ({
            ...p,
            imageUri: safeDiscoverUri(p.imageUri as string | undefined) ?? undefined,
          }))
        : [],
      pageLayoutKey:  r.pageLayoutKey ?? undefined,
      pages:          normalizePublicMediaFields(r.pages) ?? undefined,
      witnessedCount: r.witnessedCount,
      savedCount:     r.savedCount,
      likeCount:      storyLikeCounts.get(r.id) ?? 0,
      liked:          viewerLikedStoryIds.has(r.id),
      date:           r.date.toISOString(),
      contentType:    r.contentType,
      videoUri:       safeDiscoverUri(r.videoUri),
      thumbnailUri:   safeDiscoverUri(r.thumbnailUri),
      music:          r.music,
    }));
    // Public profile media should use canonical paths, which the media route
    // authorizes against live visibility. Only the owner gets owner-bound
    // capabilities for their own profile's private media.
    return res.json(viewerId === targetId ? withOwnerMediaUrls(stories, viewerId) : stories);
  } catch (err) {
    req.log.error({ err }, "Failed to get user stories");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public user outfits (public only) ────────────────────────────────────────

router.get("/users/:userId/outfits", requireAuth, async (req, res) => {
  const viewerId = getUserId(req);
  const targetId = String(req.params.userId);

  try {
    // Deny access when a block exists in either direction
    if (viewerId !== targetId && await isBlocked(viewerId, targetId)) {
      return res.status(403).json({ error: "This profile is unavailable." });
    }

    // Use the same profile privacy boundary as the profile and stories routes.
    const [charRow] = await db
      .select({ isPublic: characterTable.isPublic, isHidden: characterTable.isHidden, isBanned: characterTable.isBanned })
      .from(characterTable)
      .where(eq(characterTable.userId, targetId))
      .limit(1);

    if (!charRow || charRow.isBanned || (charRow.isHidden && viewerId !== targetId)
      || (!charRow.isPublic && viewerId !== targetId && !await areFriends(targetId, viewerId))) {
      return res.json([]);
    }

    const rows = await db
      .select({
        id:          outfitsTable.id,
        name:        outfitsTable.name,
        description: outfitsTable.description,
        story:       outfitsTable.story,
        imageUri:    outfitsTable.imageUri,
        tags:        outfitsTable.tags,
        music:       outfitsTable.music,
        date:        outfitsTable.date,
      })
      .from(outfitsTable)
      .where(
        and(
          eq(outfitsTable.userId, targetId),
          readableContentSql(outfitsTable.userId, viewerId, outfitsTable.visibility, outfitsTable.isPublic),
          eq(outfitsTable.isHidden, false),
        ),
      )
      .orderBy(desc(outfitsTable.date))
      .limit(50);

    return res.json(withOwnerMediaUrls(rows.map(r => ({
      id:          r.id,
      name:        r.name,
      description: r.description,
      story:       r.story ?? '',
      imageUri:    safeDiscoverUri(r.imageUri),
      tags:        r.tags,
      music:       r.music ?? null,
      date:        r.date.toISOString(),
    })), viewerId));
  } catch (err) {
    req.log.error({ err }, "Failed to get user outfits");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Follow ────────────────────────────────────────────────────────────────────

router.post("/users/:userId/like", requireAuth, async (req, res) => {
  const viewerId = getUserId(req);
  const targetId = String(req.params.userId);
  if (targetId === viewerId) return res.status(400).json({ error: "Cannot like your own profile" });

  try {
    if (await isBlocked(viewerId, targetId)) {
      return res.status(403).json({ error: "This profile is unavailable." });
    }
    const [target] = await db.select({ userId: characterTable.userId })
      .from(characterTable)
      .where(and(
        eq(characterTable.userId, targetId),
        eq(characterTable.isPublic, true),
        eq(characterTable.isBanned, false),
        eq(characterTable.isHidden, false),
      ))
      .limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });

    const state = await db.transaction(async tx => {
      await tx.insert(profileLikesTable)
        .values({ likerId: viewerId, profileUserId: targetId })
        .onConflictDoNothing();
      const [row] = await tx.select({ total: count() })
        .from(profileLikesTable)
        .where(eq(profileLikesTable.profileUserId, targetId));
      return Number(row?.total ?? 0);
    });
    return res.json({ profileLiked: true, profileLikeCount: state });
  } catch (err) {
    req.log.error({ err }, "Failed to like profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:userId/like", requireAuth, async (req, res) => {
  const viewerId = getUserId(req);
  const targetId = String(req.params.userId);
  if (targetId === viewerId) return res.status(400).json({ error: "Cannot unlike your own profile" });

  try {
    if (await isBlocked(viewerId, targetId)) {
      return res.status(403).json({ error: "This profile is unavailable." });
    }
    const [target] = await db.select({ userId: characterTable.userId })
      .from(characterTable)
      .where(and(
        eq(characterTable.userId, targetId),
        eq(characterTable.isPublic, true),
        eq(characterTable.isBanned, false),
        eq(characterTable.isHidden, false),
      ))
      .limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });

    const state = await db.transaction(async tx => {
      await tx.delete(profileLikesTable)
        .where(and(
          eq(profileLikesTable.likerId, viewerId),
          eq(profileLikesTable.profileUserId, targetId),
        ));
      const [row] = await tx.select({ total: count() })
        .from(profileLikesTable)
        .where(eq(profileLikesTable.profileUserId, targetId));
      return Number(row?.total ?? 0);
    });
    return res.json({ profileLiked: false, profileLikeCount: state });
  } catch (err) {
    req.log.error({ err }, "Failed to unlike profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/stories/:id/like", requireAuth, async (req, res) => {
  const storyId = String(req.params.id);
  const viewerId = getUserId(req);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storyId)) {
    return res.status(400).json({ error: "Invalid story ID" });
  }

  try {
    const [visibleStory] = await db.select({ id: storiesTable.id, userId: storiesTable.userId })
      .from(storiesTable)
      .innerJoin(characterTable, eq(characterTable.userId, storiesTable.userId))
      .where(and(
        eq(storiesTable.id, storyId),
        eq(storiesTable.isPublic, true),
        eq(storiesTable.isHidden, false),
        eq(characterTable.isPublic, true),
        eq(characterTable.isBanned, false),
        eq(characterTable.isHidden, false),
      ))
      .limit(1);
    if (!visibleStory) return res.status(404).json({ error: "Story not found" });
    if (await isBlocked(viewerId, visibleStory.userId)) {
      return res.status(403).json({ error: "This story is unavailable." });
    }

    const state = await db.transaction(async tx => {
      const [inserted] = await tx.insert(storyLikesTable)
        .values({ userId: viewerId, storyId })
        .onConflictDoNothing()
        .returning({ storyId: storyLikesTable.storyId });
      if (inserted) {
        const [updated] = await tx.update(storiesTable)
          .set({ likeCount: sql`${storiesTable.likeCount} + 1` })
          .where(and(
            eq(storiesTable.id, storyId),
            eq(storiesTable.isPublic, true),
            eq(storiesTable.isHidden, false),
          ))
          .returning({ likeCount: storiesTable.likeCount });
        if (!updated) throw new Error("STORY_NOT_VISIBLE");
        return updated.likeCount;
      }
      const [current] = await tx.select({ likeCount: storiesTable.likeCount })
        .from(storiesTable).where(eq(storiesTable.id, storyId));
      if (!current) throw new Error("STORY_NOT_VISIBLE");
      return current.likeCount;
    });
    cache.invalidate("discover:");
    return res.json({ liked: true, likeCount: state });
  } catch (err) {
    if (err instanceof Error && err.message === "STORY_NOT_VISIBLE") {
      return res.status(404).json({ error: "Story not found" });
    }
    req.log.error({ err }, "Failed to like story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/stories/:id/like", requireAuth, async (req, res) => {
  const storyId = String(req.params.id);
  const viewerId = getUserId(req);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storyId)) {
    return res.status(400).json({ error: "Invalid story ID" });
  }

  try {
    const [visibleStory] = await db.select({ id: storiesTable.id, userId: storiesTable.userId })
      .from(storiesTable)
      .innerJoin(characterTable, eq(characterTable.userId, storiesTable.userId))
      .where(and(
        eq(storiesTable.id, storyId),
        eq(storiesTable.isPublic, true),
        eq(storiesTable.isHidden, false),
        eq(characterTable.isPublic, true),
        eq(characterTable.isBanned, false),
        eq(characterTable.isHidden, false),
      ))
      .limit(1);
    if (!visibleStory) return res.status(404).json({ error: "Story not found" });
    if (await isBlocked(viewerId, visibleStory.userId)) {
      return res.status(403).json({ error: "This story is unavailable." });
    }

    const state = await db.transaction(async tx => {
      const [removed] = await tx.delete(storyLikesTable)
        .where(and(
          eq(storyLikesTable.userId, viewerId),
          eq(storyLikesTable.storyId, storyId),
        ))
        .returning({ storyId: storyLikesTable.storyId });
      if (removed) {
        const [updated] = await tx.update(storiesTable)
          .set({ likeCount: sql`GREATEST(${storiesTable.likeCount} - 1, 0)` })
          .where(eq(storiesTable.id, storyId))
          .returning({ likeCount: storiesTable.likeCount });
        if (!updated) throw new Error("STORY_NOT_VISIBLE");
        return updated.likeCount;
      }
      const [current] = await tx.select({ likeCount: storiesTable.likeCount })
        .from(storiesTable).where(eq(storiesTable.id, storyId));
      if (!current) throw new Error("STORY_NOT_VISIBLE");
      return current.likeCount;
    });
    cache.invalidate("discover:");
    return res.json({ liked: false, likeCount: state });
  } catch (err) {
    if (err instanceof Error && err.message === "STORY_NOT_VISIBLE") {
      return res.status(404).json({ error: "Story not found" });
    }
    req.log.error({ err }, "Failed to unlike story");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chapters/:id/like", requireAuth, async (req, res) => {
  const chapterId = String(req.params.id);
  const viewerId = getUserId(req);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId)) {
    return res.status(400).json({ error: "Invalid chapter ID" });
  }

  try {
    const [visibleChapter] = await db.select({ id: chaptersTable.id, userId: booksTable.userId })
      .from(chaptersTable)
      .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
      .innerJoin(characterTable, eq(characterTable.userId, booksTable.userId))
      .where(and(
        eq(chaptersTable.id, chapterId),
        eq(chaptersTable.status, "published"),
        eq(booksTable.visibility, "public"),
        eq(characterTable.isPublic, true),
        eq(characterTable.isBanned, false),
        eq(characterTable.isHidden, false),
      ))
      .limit(1);
    if (!visibleChapter) return res.status(404).json({ error: "Chapter not found" });
    if (await isBlocked(viewerId, visibleChapter.userId)) {
      return res.status(403).json({ error: "This chapter is unavailable." });
    }

    const likeCount = await db.transaction(async tx => {
      const [inserted] = await tx.insert(chapterLikesTable)
        .values({ userId: viewerId, chapterId })
        .onConflictDoNothing()
        .returning({ chapterId: chapterLikesTable.chapterId });
      if (inserted) {
        const [updated] = await tx.update(chaptersTable)
          .set({ likeCount: sql`${chaptersTable.likeCount} + 1` })
          .where(and(
            eq(chaptersTable.id, chapterId),
            eq(chaptersTable.status, "published"),
          ))
          .returning({ likeCount: chaptersTable.likeCount });
        if (!updated) throw new Error("CHAPTER_NOT_VISIBLE");
        return updated.likeCount;
      }
      const [current] = await tx.select({ likeCount: chaptersTable.likeCount })
        .from(chaptersTable)
        .where(eq(chaptersTable.id, chapterId));
      if (!current) throw new Error("CHAPTER_NOT_VISIBLE");
      return current.likeCount;
    });
    cache.invalidate("discover:");
    return res.json({ liked: true, likeCount });
  } catch (err) {
    if (err instanceof Error && err.message === "CHAPTER_NOT_VISIBLE") {
      return res.status(404).json({ error: "Chapter not found" });
    }
    req.log.error({ err }, "Failed to like chapter");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/chapters/:id/like", requireAuth, async (req, res) => {
  const chapterId = String(req.params.id);
  const viewerId = getUserId(req);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId)) {
    return res.status(400).json({ error: "Invalid chapter ID" });
  }

  try {
    const [visibleChapter] = await db.select({ id: chaptersTable.id, userId: booksTable.userId })
      .from(chaptersTable)
      .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
      .innerJoin(characterTable, eq(characterTable.userId, booksTable.userId))
      .where(and(
        eq(chaptersTable.id, chapterId),
        eq(chaptersTable.status, "published"),
        eq(booksTable.visibility, "public"),
        eq(characterTable.isPublic, true),
        eq(characterTable.isBanned, false),
        eq(characterTable.isHidden, false),
      ))
      .limit(1);
    if (!visibleChapter) return res.status(404).json({ error: "Chapter not found" });
    if (await isBlocked(viewerId, visibleChapter.userId)) {
      return res.status(403).json({ error: "This chapter is unavailable." });
    }

    const likeCount = await db.transaction(async tx => {
      const [removed] = await tx.delete(chapterLikesTable)
        .where(and(
          eq(chapterLikesTable.userId, viewerId),
          eq(chapterLikesTable.chapterId, chapterId),
        ))
        .returning({ chapterId: chapterLikesTable.chapterId });
      if (removed) {
        const [updated] = await tx.update(chaptersTable)
          .set({ likeCount: sql`GREATEST(${chaptersTable.likeCount} - 1, 0)` })
          .where(eq(chaptersTable.id, chapterId))
          .returning({ likeCount: chaptersTable.likeCount });
        if (!updated) throw new Error("CHAPTER_NOT_VISIBLE");
        return updated.likeCount;
      }
      const [current] = await tx.select({ likeCount: chaptersTable.likeCount })
        .from(chaptersTable)
        .where(eq(chaptersTable.id, chapterId));
      if (!current) throw new Error("CHAPTER_NOT_VISIBLE");
      return current.likeCount;
    });
    cache.invalidate("discover:");
    return res.json({ liked: false, likeCount });
  } catch (err) {
    if (err instanceof Error && err.message === "CHAPTER_NOT_VISIBLE") {
      return res.status(404).json({ error: "Chapter not found" });
    }
    req.log.error({ err }, "Failed to unlike chapter");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/follows/:targetUserId", requireAuth, async (req, res) => {
  const userId       = getUserId(req);
  const targetUserId = String(req.params.targetUserId);

  if (targetUserId === userId) {
    return res.status(400).json({ error: "Cannot follow yourself" });
  }

  try {
    if (await isBlocked(userId, targetUserId)) {
      return res.status(403).json({ error: "This social action is unavailable" });
    }
    const [target] = await db.select({ userId: characterTable.userId })
      .from(characterTable)
      .where(eq(characterTable.userId, targetUserId))
      .limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });

    await db
      .insert(followsTable)
      .values({ followerId: userId, followingId: targetUserId })
      .onConflictDoNothing();

    // Invalidate discover cache — following someone changes feed scoring
    cache.invalidate(`discover:${userId}`);

    // Reward follower for their social generosity (once per target) — await for client feedback
    const { granted: rewardGranted, amounts: rewardAmounts } =
      await grantReward(userId, "follow_given", targetUserId);
    syncConstellation(userId).catch(() => null);

    // Fire-and-forget: notify the target that someone followed them
    db.select({ name: characterTable.name })
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1)
      .then(async ([actor]) => {
        if (!actor) return;
        const actorName = actor.name ?? "Someone";
        await db.insert(notificationsTable).values({
          userId:    targetUserId,
          actorId:   userId,
          actorName,
          type:      "follow",
          refId:     userId,
          title:     actorName,
        });
        await sendPushNotification(targetUserId, {
          title: actorName,
          body:  "is now following you ✦",
          data:  { type: "follow", refId: userId },
        });
      })
      .catch(() => null);

    return res.status(201).json({ following: true, rewardGranted, rewardAmounts });
  } catch (err) {
    req.log.error({ err }, "Failed to follow");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Remove friend without blocking ───────────────────────────────────────────
router.delete("/friends/:targetUserId", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const targetUserId = String(req.params.targetUserId);
  if (userId === targetUserId) {
    return res.status(400).json({ error: "Cannot remove yourself" });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existing = await tx.execute(sql`
        SELECT 1 FROM follows
         WHERE (follower_id = ${userId} AND following_id = ${targetUserId})
            OR (follower_id = ${targetUserId} AND following_id = ${userId})
         LIMIT 1
      `);
      await tx.execute(sql`
        DELETE FROM follows
         WHERE (follower_id = ${userId} AND following_id = ${targetUserId})
            OR (follower_id = ${targetUserId} AND following_id = ${userId})
      `);
      await tx.execute(sql`
        DELETE FROM friend_requests
         WHERE (sender_id = ${userId} AND recipient_id = ${targetUserId})
            OR (sender_id = ${targetUserId} AND recipient_id = ${userId})
      `);
      return existing.rows.length > 0;
    });

    cache.invalidate(`discover:${userId}`);
    cache.invalidate(`discover:${targetUserId}`);
    emitSSEEvent(`social:${userId}`, { type: "friend_removed", partnerId: targetUserId });
    emitSSEEvent(`social:${targetUserId}`, { type: "friend_removed", partnerId: userId });
    emitSSEEvent(`messages:${userId}`, { type: "friend_removed", partnerId: targetUserId });
    emitSSEEvent(`messages:${targetUserId}`, { type: "friend_removed", partnerId: userId });
    return res.json({ removed: result });
  } catch (err) {
    req.log.error({ err }, "Failed to remove friend");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Unfollow ──────────────────────────────────────────────────────────────────

router.delete("/follows/:targetUserId", requireAuth, async (req, res) => {
  const userId       = getUserId(req);
  const targetUserId = String(req.params.targetUserId);

  try {
    await db
      .delete(followsTable)
      .where(
        and(
          eq(followsTable.followerId, userId),
          eq(followsTable.followingId, targetUserId),
        ),
      );

    // Invalidate discover cache — unfollowing changes feed scoring
    cache.invalidate(`discover:${userId}`);

    return res.status(200).json({ following: false });
  } catch (err) {
    req.log.error({ err }, "Failed to unfollow");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Who I follow ──────────────────────────────────────────────────────────────

router.get("/follows/following", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, userId));
    return res.json(rows.map(r => r.followingId));
  } catch (err) {
    req.log.error({ err }, "Failed to get following list");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Discover feed (ranked public posts; include the viewer's own posts) ───────

router.get("/discover", requireAuth, async (req, res) => {
  const userId   = getUserId(req);
  const cacheKey = `discover:${userId}`;
  const sendDiscoverResponse = (feed: object[], cacheStatus: "HIT" | "MISS") => {
    res.setHeader("X-Cache", cacheStatus);
    res.setHeader("Cache-Control", "private, no-store");
    // Some native HTTP stacks send If-None-Match without retaining the old
    // response body. A per-response validator prevents Express from turning
    // this JSON feed into an unusable bodyless 304. The server-side cache above
    // still handles repeated database work.
    res.setHeader("ETag", `W/"discover-${randomUUID()}"`);
    return res.json(feed);
  };

  const cached = cache.get<object[]>(cacheKey);
  if (cached) {
    const cachedPosts = cached as Array<{ authorUserId?: unknown; id?: unknown; contentType?: unknown }>;
    const cachedAuthorIds = [...new Set(cachedPosts
      .map(item => (item as { authorUserId?: unknown }).authorUserId)
      .filter((id): id is string => typeof id === "string" && id !== userId))];
    const visibleAuthors = cachedAuthorIds.length
      ? await db.select({ userId: characterTable.userId })
          .from(characterTable)
          .where(and(
            inArray(characterTable.userId, cachedAuthorIds),
            eq(characterTable.isPublic, true),
            eq(characterTable.isBanned, false),
            eq(characterTable.isHidden, false),
          ))
      : [];
    const visibleAuthorIds = new Set([...visibleAuthors.map(author => author.userId), userId]);
    const cachedOutfitIds = [...new Set(cachedPosts
      .filter(item => item.contentType === "outfit")
      .map(item => item.id)
      .filter((id): id is string => typeof id === "string"))];
    const visibleOutfits = cachedOutfitIds.length
      ? await db.select({ id: outfitsTable.id })
          .from(outfitsTable)
          .innerJoin(characterTable, eq(characterTable.userId, outfitsTable.userId))
          .where(and(
            inArray(outfitsTable.id, cachedOutfitIds),
            eq(outfitsTable.isPublic, true),
            eq(outfitsTable.visibility, "public"),
            eq(outfitsTable.isHidden, false),
            eq(characterTable.isPublic, true),
            eq(characterTable.isBanned, false),
            eq(characterTable.isHidden, false),
            sql`${outfitsTable.userId} NOT IN (
              SELECT blocked_id FROM blocks WHERE blocker_id = ${userId}
              UNION
              SELECT blocker_id FROM blocks WHERE blocked_id = ${userId}
            )`,
          ))
      : [];
    const visibleOutfitIds = new Set(visibleOutfits.map(outfit => outfit.id));
    return sendDiscoverResponse(cached.filter(item => {
      const post = item as { authorUserId?: unknown; id?: unknown; contentType?: unknown };
      return typeof post.authorUserId === "string"
        && visibleAuthorIds.has(post.authorUserId)
        && (post.contentType !== "outfit" || (typeof post.id === "string" && visibleOutfitIds.has(post.id)));
    }), "HIT");
  }

  try {
    const [myCharRows, followingRows, stories, chapters, outfitRows] = await Promise.all([
      db.select({ mood: characterTable.mood })
        .from(characterTable)
        .where(eq(characterTable.userId, userId))
        .limit(1),

      db.select({ followingId: followsTable.followingId })
        .from(followsTable)
        .where(eq(followsTable.followerId, userId)),

      db.select({
        id:              storiesTable.id,
        userId:          storiesTable.userId,
        chapterTitle:    storiesTable.chapterTitle,
        description:     storiesTable.description,
        mood:            storiesTable.mood,
        location:        storiesTable.location,
        witnessedCount:  storiesTable.witnessedCount,
        savedCount:      storiesTable.savedCount,
        likeCount:       storiesTable.likeCount,
        panels:          storiesTable.panels,
        pageLayoutKey:   storiesTable.pageLayoutKey,
        pages:           storiesTable.pages,
        date:            storiesTable.date,
        contentType:     storiesTable.contentType,
        videoUri:        storiesTable.videoUri,
        thumbnailUri:    storiesTable.thumbnailUri,
        music:           storiesTable.music,
        authorName:      characterTable.name,
        authorUsername:  characterTable.username,
        authorAvatarUri: characterTable.avatarUri,
        authorTitle:     constellationProgressTable.activeTitle,
        authorIsFounder:    characterTable.isFounder,
        authorIsBetaTester: characterTable.isBetaTester,
      })
        .from(storiesTable)
        .innerJoin(characterTable, eq(characterTable.userId, storiesTable.userId))
        .leftJoin(constellationProgressTable, eq(constellationProgressTable.userId, storiesTable.userId))
        .where(
          and(
            eq(storiesTable.isPublic, true),
            eq(storiesTable.isHidden, false),     // exclude admin-hidden stories
            or(
              eq(characterTable.isPublic, true),
              eq(storiesTable.userId, userId),
            ),                                     // a private-profile owner can still see their own public content
            eq(characterTable.isBanned, false),   // exclude banned users
            or(eq(characterTable.isHidden, false), eq(storiesTable.userId, userId)),
            // Public content is visible to its author in Reels too. Previously
            // this allowed the author's videos but hid their public stories.
            // Exclude stories from users who have blocked the viewer OR been blocked by the viewer
            sql`${storiesTable.userId} NOT IN (
              SELECT blocked_id FROM blocks WHERE blocker_id = ${userId}
              UNION
              SELECT blocker_id FROM blocks WHERE blocked_id = ${userId}
            )`,
          ),
        )
        .orderBy(desc(storiesTable.date))
        .limit(200),

      // Published book chapters from public books — surfaces new books to readers
      db.select({
        id:              chaptersTable.id,
        bookId:          chaptersTable.bookId,
        bookTitle:       booksTable.title,
        userId:          booksTable.userId,
        chapterTitle:    chaptersTable.title,
        orderIndex:      chaptersTable.orderIndex,
        publishedAt:     chaptersTable.publishedAt,
        readCount:       chaptersTable.readCount,
        likeCount:       chaptersTable.likeCount,
        pages:           chaptersTable.pages,
        authorName:      characterTable.name,
        authorUsername:  characterTable.username,
        authorAvatarUri: characterTable.avatarUri,
        authorTitle:     constellationProgressTable.activeTitle,
        authorIsFounder:    characterTable.isFounder,
        authorIsBetaTester: characterTable.isBetaTester,
        authorMood:         characterTable.mood,
      })
        .from(chaptersTable)
        .innerJoin(booksTable, eq(booksTable.id, chaptersTable.bookId))
        .innerJoin(characterTable, eq(characterTable.userId, booksTable.userId))
        .leftJoin(constellationProgressTable, eq(constellationProgressTable.userId, booksTable.userId))
        .where(
          and(
            eq(chaptersTable.status, "published"),
            eq(booksTable.visibility, "public"),
            eq(characterTable.isPublic, true),
            eq(characterTable.isBanned, false),
            eq(characterTable.isHidden, false),
            ne(booksTable.userId, userId),
            sql`${booksTable.userId} NOT IN (
              SELECT blocked_id FROM blocks WHERE blocker_id = ${userId}
              UNION
              SELECT blocker_id FROM blocks WHERE blocked_id = ${userId}
            )`,
          ),
        )
        .orderBy(desc(chaptersTable.publishedAt))
        .limit(100),

      // Public outfits share the Reels discovery feed, but remain a distinct
      // content type so the client can keep them out of Stories and Videos.
      db.select({
        id: outfitsTable.id,
        userId: outfitsTable.userId,
        name: outfitsTable.name,
        description: outfitsTable.description,
        story: outfitsTable.story,
        imageUri: outfitsTable.imageUri,
        tags: outfitsTable.tags,
        date: outfitsTable.date,
        authorName: characterTable.name,
        authorUsername: characterTable.username,
        authorAvatarUri: characterTable.avatarUri,
        authorMood: characterTable.mood,
        authorTitle: constellationProgressTable.activeTitle,
        authorIsFounder: characterTable.isFounder,
        authorIsBetaTester: characterTable.isBetaTester,
      })
        .from(outfitsTable)
        .innerJoin(characterTable, eq(characterTable.userId, outfitsTable.userId))
        .leftJoin(constellationProgressTable, eq(constellationProgressTable.userId, outfitsTable.userId))
        .where(and(
          eq(outfitsTable.isPublic, true),
          eq(outfitsTable.visibility, "public"),
          eq(outfitsTable.isHidden, false),
          eq(characterTable.isPublic, true),
          eq(characterTable.isBanned, false),
          eq(characterTable.isHidden, false),
          sql`${outfitsTable.userId} NOT IN (
            SELECT blocked_id FROM blocks WHERE blocker_id = ${userId}
            UNION
            SELECT blocker_id FROM blocks WHERE blocked_id = ${userId}
          )`,
        ))
        .orderBy(desc(outfitsTable.date))
        .limit(100),
    ]);

    const myMood       = myCharRows[0]?.mood ?? "Hopeful";
    const followingSet = new Set(followingRows.map(r => r.followingId));
    const now          = Date.now();

    // Score stories
    type ScoredEntry = {
      kind: 'story' | 'chapter' | 'outfit';
      id: string;
      userId: string;
      score: number;
      isFollowing: boolean;
      data: typeof stories[0] | typeof chapters[0] | typeof outfitRows[0];
    };

    const scoredStories: ScoredEntry[] = stories.map(row => {
      const isFollowing = followingSet.has(row.userId);
      const moodMatch   = row.mood === myMood;
      const engagement  = Math.min(2, (row.witnessedCount + row.savedCount) / 25);
      const daysOld     = (now - row.date.getTime()) / 86_400_000;
      const recency     = Math.max(0, 1 - daysOld / 30);
      const score = (isFollowing ? 6 : 0) + (moodMatch ? 2 : 0) + engagement + recency;
      return { kind: 'story', id: row.id, userId: row.userId, score, isFollowing, data: row };
    });

    // Score chapters — use readCount as engagement proxy
    const scoredChapters: ScoredEntry[] = chapters.map(row => {
      const isFollowing  = followingSet.has(row.userId);
      const moodMatch    = row.authorMood === myMood;
      const engagement   = Math.min(2, (row.readCount ?? 0) / 25);
      const publishedMs  = row.publishedAt ? row.publishedAt.getTime() : now;
      const daysOld      = (now - publishedMs) / 86_400_000;
      const recency      = Math.max(0, 1 - daysOld / 30);
      const score = (isFollowing ? 6 : 0) + (moodMatch ? 2 : 0) + engagement + recency;
      return { kind: 'chapter', id: row.id, userId: row.userId, score, isFollowing, data: row };
    });

    const scoredOutfits: ScoredEntry[] = outfitRows.map(row => {
      const isFollowing = followingSet.has(row.userId);
      const daysOld = (now - row.date.getTime()) / 86_400_000;
      const recency = Math.max(0, 1 - daysOld / 30);
      const score = (isFollowing ? 6 : 0) + recency;
      return { kind: 'outfit', id: row.id, userId: row.userId, score, isFollowing, data: row };
    });

    const allScored = [...scoredStories, ...scoredChapters, ...scoredOutfits];
    allScored.sort((a, b) => b.score - a.score);
    // Keep each Reels category browsable; popular story/video posts must not
    // crowd every outfit out of the shared response.
    const top50 = [
      ...allScored.filter(entry => entry.kind !== 'outfit').slice(0, 50),
      ...allScored.filter(entry => entry.kind === 'outfit').slice(0, 50),
    ].sort((a, b) => b.score - a.score);

    // Fetch sticker counts (stories only) + author badges in bulk for the top 50
    const top50StoryIds = top50.filter(e => e.kind === 'story').map(e => e.id);
    const top50ChapterIds = top50.filter(e => e.kind === 'chapter').map(e => e.id);
    const top50Authors  = [...new Set(top50.map(e => e.userId))];

    const stickerCountMap: Record<string, number> = {};
    const likedStoryIds = new Set<string>();
    const likedChapterIds = new Set<string>();
    const authorBadgesMap: Record<string, { id: string; slug: string; name: string; emoji: string; color: string; imageUrl: string | null; description: string | null }[]> = {};

    await Promise.all([
      top50StoryIds.length > 0
        ? db.select({ storyId: stickerReactionsTable.storyId, cnt: count() })
            .from(stickerReactionsTable)
            .where(inArray(stickerReactionsTable.storyId, top50StoryIds))
            .groupBy(stickerReactionsTable.storyId)
            .then(rows => rows.forEach(r => { stickerCountMap[r.storyId] = Number(r.cnt); }))
        : Promise.resolve(),

      top50StoryIds.length > 0
        ? db.select({ storyId: storyLikesTable.storyId })
            .from(storyLikesTable)
            .where(and(
              inArray(storyLikesTable.storyId, top50StoryIds),
              eq(storyLikesTable.userId, userId),
            ))
            .then(rows => rows.forEach(r => likedStoryIds.add(r.storyId)))
        : Promise.resolve(),

      top50ChapterIds.length > 0
        ? db.select({ chapterId: chapterLikesTable.chapterId })
            .from(chapterLikesTable)
            .where(and(
              inArray(chapterLikesTable.chapterId, top50ChapterIds),
              eq(chapterLikesTable.userId, userId),
            ))
            .then(rows => rows.forEach(r => likedChapterIds.add(r.chapterId)))
        : Promise.resolve(),

      top50Authors.length > 0
        ? db.select({
              userId:      characterBadgesTable.userId,
              id:          badgesTable.id,
              slug:        badgesTable.slug,
              name:        badgesTable.name,
              emoji:       badgesTable.emoji,
              color:       badgesTable.color,
              imageUrl:    badgesTable.imageUrl,
              description: badgesTable.description,
            })
            .from(characterBadgesTable)
            .innerJoin(badgesTable, eq(badgesTable.id, characterBadgesTable.badgeId))
            .where(inArray(characterBadgesTable.userId, top50Authors))
            .orderBy(asc(badgesTable.sortOrder))
            .then(rows => {
              rows.forEach(r => {
                if (!authorBadgesMap[r.userId]) authorBadgesMap[r.userId] = [];
                authorBadgesMap[r.userId].push({ id: r.id, slug: r.slug, name: r.name, emoji: r.emoji, color: r.color, imageUrl: r.imageUrl, description: r.description ?? null });
              });
            })
        : Promise.resolve(),
    ]);

    const result = top50.map(({ kind, isFollowing, data }) => {
      if (kind === 'story') {
        const row = data as typeof stories[0];
        const rawPanels = row.panels as Array<{ text?: string; imageUri?: string; overlays?: unknown[] }>;
        const panels = rawPanels.map(p => ({
          ...p,
          imageUri: safeDiscoverUri(p.imageUri),
        }));
        const pages = row.pages?.map(page => ({
          ...page,
          panels: page.panels.map(panel => ({
            ...panel,
            imageUri: safeDiscoverUri(panel.imageUri) ?? undefined,
          })),
        }));
        const previewImage = panels.find(panel => panel.imageUri)?.imageUri
          ?? pages?.flatMap(page => page.panels).find(panel => panel.imageUri)?.imageUri
          ?? null;
        return {
          id:              row.id,
          authorUserId:    row.userId,
          authorName:      row.authorName,
          authorUsername:  row.authorUsername ?? null,
          authorTitle:     row.authorTitle ?? null,
          authorAvatarUri: safeDiscoverUri(row.authorAvatarUri),
          authorIsFounder:    row.authorIsFounder    ?? false,
          authorIsBetaTester: row.authorIsBetaTester ?? false,
          authorBadges:       authorBadgesMap[row.userId] ?? [],
          chapterTitle:    row.chapterTitle,
          description:     row.description ?? '',
          storySnippet:    panels[0]?.text ?? "",
          imageUri:        previewImage,
          mood:            row.mood,
          location:        row.location,
          witnessedCount:  row.witnessedCount,
          savedCount:      row.savedCount,
          likeCount:       row.likeCount,
          liked:           likedStoryIds.has(row.id),
          stickerCount:    stickerCountMap[row.id] ?? 0,
          date:            row.date.toISOString(),
          panels,
          pageLayoutKey:   row.pageLayoutKey ?? undefined,
          pages,
          contentType:     (row.contentType ?? 'story') as 'story' | 'video',
          videoUri:        safeDiscoverUri(row.videoUri),
          thumbnailUri:    safeDiscoverUri(row.thumbnailUri),
          music:          row.music ?? null,
          isFollowing,
        };
      } else if (kind === 'chapter') {
        // Book chapter
        const row = data as typeof chapters[0];
        const chapterPages = (row.pages ?? []) as BookChapterPage[];
        const firstPanel   = chapterPages[0]?.panels[0];
        const snippet      = firstPanel?.text ?? '';
        const imageUri = chapterPages.flatMap(page => page.panels)
          .map(panel => safeDiscoverUri(panel.imageUri))
          .find(uri => uri) ?? null;
        // Flatten the first page's panels for card rendering
        const cardPanels = (chapterPages[0]?.panels ?? []).map(p => ({
          text:     p.text     ?? '',
          imageUri: safeDiscoverUri(p.imageUri ?? null),
        }));
        return {
          id:              row.id,
          authorUserId:    row.userId,
          authorName:      row.authorName,
          authorUsername:  row.authorUsername ?? null,
          authorTitle:     row.authorTitle ?? null,
          authorAvatarUri: safeDiscoverUri(row.authorAvatarUri),
          authorIsFounder:    row.authorIsFounder    ?? false,
          authorIsBetaTester: row.authorIsBetaTester ?? false,
          authorBadges:       authorBadgesMap[row.userId] ?? [],
          chapterTitle:    row.chapterTitle,
          chapterNumber:   row.orderIndex + 1,
          description:     '',
          storySnippet:    snippet,
          imageUri,
          mood:            row.authorMood ?? 'Hopeful',
          location:        '',
          witnessedCount:  0,
          savedCount:      0,
          likeCount:       row.likeCount,
          liked:           likedChapterIds.has(row.id),
          stickerCount:    0,
          date:            row.publishedAt?.toISOString() ?? new Date().toISOString(),
          panels:          cardPanels,
          bookId:          row.bookId,
          bookTitle:       row.bookTitle,
          contentType:     'story',
          isFollowing,
        };
      } else {
        const row = data as typeof outfitRows[0];
        const imageUri = safeDiscoverUri(row.imageUri);
        const vibe = row.tags.find(tag => tag.startsWith('vibe:'))?.slice(5) ?? 'Outfit';
        return {
          id: row.id,
          authorUserId: row.userId,
          authorName: row.authorName,
          authorUsername: row.authorUsername ?? null,
          authorTitle: row.authorTitle ?? null,
          authorAvatarUri: safeDiscoverUri(row.authorAvatarUri),
          authorIsFounder: row.authorIsFounder ?? false,
          authorIsBetaTester: row.authorIsBetaTester ?? false,
          authorBadges: authorBadgesMap[row.userId] ?? [],
          chapterTitle: row.name,
          description: row.description ?? '',
          storySnippet: row.story || row.description || '',
          imageUri,
          mood: vibe,
          authorMood: row.authorMood ?? null,
          location: '',
          witnessedCount: 0,
          savedCount: 0,
          likeCount: 0,
          liked: false,
          stickerCount: 0,
          date: row.date.toISOString(),
          panels: [{ text: row.story || row.description || '', imageUri }],
          outfitTags: row.tags,
          contentType: 'outfit',
          isFollowing,
        };
      }
    });

    cache.set(cacheKey, result, 2 * 60 * 1000);
    return sendDiscoverResponse(result, "MISS");
  } catch (err) {
    req.log.error({ err }, "Failed to get discover feed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
