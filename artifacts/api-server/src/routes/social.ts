import { db, characterTable, storiesTable, followsTable, outfitsTable, notificationsTable, stickerReactionsTable, constellationProgressTable, userRewardsTable, badgesTable, characterBadgesTable, booksTable, chaptersTable } from "@workspace/db";
import type { BookChapterPage } from "@workspace/db";
import { and, asc, count, desc, eq, ilike, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { grantReward } from "../services/rewardService";
import { syncConstellation } from "../services/constellationService";
import { sendPushNotification } from "../services/pushService";
import * as cache from "../lib/cache";
import { isBlocked } from "./blocks";

const router: IRouter = Router();

function safeDiscoverUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith('file://') || uri.startsWith('data:') || uri.startsWith('blob:')) return null;
  return uri;
}

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
        birthday:  characterTable.birthday,
        country:   characterTable.country,
        links:     characterTable.links,
        isPublic:  characterTable.isPublic,
      })
      .from(characterTable)
      .where(
        and(
          inArray(characterTable.userId, followingIds),
          eq(characterTable.isBanned, false),
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
        avatarUri: safeDiscoverUri(p.avatarUri),
        birthday:  p.birthday ?? null,
        country:   p.country  ?? null,
        links:     Array.isArray(p.links) ? p.links : [],
        isPublic:  p.isPublic,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get friends list");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public user profile ───────────────────────────────────────────────────────

router.get("/users/:userId", requireAuth, async (req, res) => {
  const viewerId = getUserId(req);
  const targetId = String(req.params.userId);

  try {
    // Deny access when a block exists in either direction
    if (viewerId !== targetId && await isBlocked(viewerId, targetId)) {
      return res.status(403).json({ error: "This profile is unavailable." });
    }

    const [charRows, followingRows] = await Promise.all([
      db.select({
        userId:         characterTable.userId,
        name:           characterTable.name,
        username:       characterTable.username,
        bio:            characterTable.bio,
        traits:         characterTable.traits,
        mood:           characterTable.mood,
        isPublic:       characterTable.isPublic,
        avatarUri:      characterTable.avatarUri,
        activeOutfitId: characterTable.activeOutfitId,
        birthday:       characterTable.birthday,
        country:        characterTable.country,
        role:           characterTable.role,
        timezone:       characterTable.timezone,
        links:          characterTable.links,
        intention:      characterTable.intention,
        intentionDate:  characterTable.intentionDate,
        activeTitle:    constellationProgressTable.activeTitle,
        lifetimeStars:  userRewardsTable.lifetimeStars,
        isFounder:      characterTable.isFounder,
        isBetaTester:   characterTable.isBetaTester,
      })
        .from(characterTable)
        .leftJoin(constellationProgressTable, eq(constellationProgressTable.userId, characterTable.userId))
        .leftJoin(userRewardsTable, eq(userRewardsTable.userId, characterTable.userId))
        .where(eq(characterTable.userId, targetId))
        .limit(1),

      db.select({ followingId: followsTable.followingId })
        .from(followsTable)
        .where(eq(followsTable.followerId, viewerId)),
    ]);

    if (!charRows.length || !charRows[0].isPublic) {
      return res.status(404).json({ error: "User not found" });
    }

    const char = charRows[0];
    const followingSet = new Set(followingRows.map(r => r.followingId));

    // Fetch active outfit data if one is set
    let activeOutfit: null | {
      id: string; name: string; description: string; story: string;
      imageUri: string | null; tags: string[];
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
          isPublic:    outfitsTable.isPublic,
        })
        .from(outfitsTable)
        .where(
          and(
            eq(outfitsTable.id, char.activeOutfitId),
            eq(outfitsTable.userId, targetId),
            eq(outfitsTable.isPublic, true),
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

    return res.json({
      userId:        char.userId,
      name:          char.name,
      username:      char.username,
      bio:           char.bio,
      traits:        char.traits,
      mood:          char.mood,
      avatarUri:     safeDiscoverUri(char.avatarUri),
      activeOutfitId: char.activeOutfitId ?? null,
      activeOutfit,
      birthday:      char.birthday  ?? null,
      country:       char.country   ?? null,
      role:          char.role      ?? null,
      timezone:      char.timezone  ?? null,
      links:         Array.isArray(char.links) ? char.links : [],
      isFollowing:   followingSet.has(targetId),
      activeTitle:   char.activeTitle   ?? null,
      intention:     char.intention     ?? null,
      intentionDate: char.intentionDate ?? null,
      stars:         char.lifetimeStars  ?? 0,
      isFounder:     char.isFounder     ?? false,
      isBetaTester:  char.isBetaTester  ?? false,
      badges:        userBadgeRows,
    });
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

    // Verify the target profile is public
    const [charRow] = await db
      .select({ isPublic: characterTable.isPublic })
      .from(characterTable)
      .where(eq(characterTable.userId, targetId))
      .limit(1);

    if (!charRow?.isPublic) {
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
      })
      .from(storiesTable)
      .where(
        and(
          eq(storiesTable.userId, targetId),
          eq(storiesTable.isPublic, true),
          eq(storiesTable.isHidden, false),
        ),
      )
      .orderBy(desc(storiesTable.date))
      .limit(50);

    return res.json(rows.map(r => ({
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
      pages:          r.pages ?? undefined,
      witnessedCount: r.witnessedCount,
      savedCount:     r.savedCount,
      date:           r.date.toISOString(),
    })));
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

    // Verify the target profile is public
    const [charRow] = await db
      .select({ isPublic: characterTable.isPublic })
      .from(characterTable)
      .where(eq(characterTable.userId, targetId))
      .limit(1);

    if (!charRow?.isPublic) {
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
        date:        outfitsTable.date,
      })
      .from(outfitsTable)
      .where(
        and(
          eq(outfitsTable.userId, targetId),
          eq(outfitsTable.isPublic, true),
          eq(outfitsTable.isHidden, false),
        ),
      )
      .orderBy(desc(outfitsTable.date))
      .limit(50);

    function safeImageUri(uri: string | null | undefined): string | null {
      if (!uri) return null;
      if (uri.startsWith('file://') || uri.startsWith('data:')) return null;
      return uri;
    }

    return res.json(rows.map(r => ({
      id:          r.id,
      name:        r.name,
      description: r.description,
      story:       r.story ?? '',
      imageUri:    safeImageUri(r.imageUri),
      tags:        r.tags,
      date:        r.date.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get user outfits");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Follow ────────────────────────────────────────────────────────────────────

router.post("/follows/:targetUserId", requireAuth, async (req, res) => {
  const userId       = getUserId(req);
  const targetUserId = String(req.params.targetUserId);

  if (targetUserId === userId) {
    return res.status(400).json({ error: "Cannot follow yourself" });
  }

  try {
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

// ── Discover feed (ranked, excludes own posts, public profiles only) ──────────

router.get("/discover", requireAuth, async (req, res) => {
  const userId   = getUserId(req);
  const cacheKey = `discover:${userId}`;

  const cached = cache.get<object[]>(cacheKey);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return res.json(cached);
  }

  try {
    const [myCharRows, followingRows, stories, chapters] = await Promise.all([
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
        panels:          storiesTable.panels,
        pageLayoutKey:   storiesTable.pageLayoutKey,
        pages:           storiesTable.pages,
        date:            storiesTable.date,
        contentType:     storiesTable.contentType,
        videoUri:        storiesTable.videoUri,
        thumbnailUri:    storiesTable.thumbnailUri,
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
            eq(characterTable.isPublic, true),
            eq(characterTable.isBanned, false),   // exclude banned users
            ne(storiesTable.userId, userId),       // never show own stories
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
    ]);

    const myMood       = myCharRows[0]?.mood ?? "Hopeful";
    const followingSet = new Set(followingRows.map(r => r.followingId));
    const now          = Date.now();

    // Score stories
    type ScoredEntry = { kind: 'story' | 'chapter'; id: string; userId: string; score: number; isFollowing: boolean; data: typeof stories[0] | typeof chapters[0] };

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

    const allScored = [...scoredStories, ...scoredChapters];
    allScored.sort((a, b) => b.score - a.score);
    const top50 = allScored.slice(0, 50);

    // Fetch sticker counts (stories only) + author badges in bulk for the top 50
    const top50StoryIds = top50.filter(e => e.kind === 'story').map(e => e.id);
    const top50Authors  = [...new Set(top50.map(e => e.userId))];

    const stickerCountMap: Record<string, number> = {};
    const authorBadgesMap: Record<string, { id: string; slug: string; name: string; emoji: string; color: string; imageUrl: string | null; description: string | null }[]> = {};

    await Promise.all([
      top50StoryIds.length > 0
        ? db.select({ storyId: stickerReactionsTable.storyId, cnt: count() })
            .from(stickerReactionsTable)
            .where(inArray(stickerReactionsTable.storyId, top50StoryIds))
            .groupBy(stickerReactionsTable.storyId)
            .then(rows => rows.forEach(r => { stickerCountMap[r.storyId] = Number(r.cnt); }))
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
          imageUri:        panels[0]?.imageUri ?? null,
          mood:            row.mood,
          location:        row.location,
          witnessedCount:  row.witnessedCount,
          savedCount:      row.savedCount,
          stickerCount:    stickerCountMap[row.id] ?? 0,
          date:            row.date.toISOString(),
          panels,
          pageLayoutKey:   row.pageLayoutKey ?? undefined,
          pages:           row.pages ?? undefined,
          contentType:     (row.contentType ?? 'story') as 'story' | 'video',
          videoUri:        row.videoUri ?? null,
          thumbnailUri:    row.thumbnailUri ?? null,
          isFollowing,
        };
      } else {
        // Book chapter
        const row = data as typeof chapters[0];
        const chapterPages = (row.pages ?? []) as BookChapterPage[];
        const firstPanel   = chapterPages[0]?.panels[0];
        const snippet      = firstPanel?.text ?? '';
        const imageUri     = safeDiscoverUri(firstPanel?.imageUri ?? null);
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
          stickerCount:    0,
          date:            row.publishedAt?.toISOString() ?? new Date().toISOString(),
          panels:          cardPanels,
          bookId:          row.bookId,
          bookTitle:       row.bookTitle,
          isFollowing,
        };
      }
    });

    cache.set(cacheKey, result, 2 * 60 * 1000);
    res.setHeader("X-Cache", "MISS");
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get discover feed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
