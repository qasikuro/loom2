import { db, characterTable, storiesTable, followsTable, outfitsTable } from "@workspace/db";
import { and, desc, eq, ilike, ne, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";

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

  try {
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

    const profiles = await db
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
      .where(eq(characterTable.isBanned, false));

    const filtered = profiles.filter(p => followingIds.includes(p.userId));

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
        links:          characterTable.links,
      })
        .from(characterTable)
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
      birthday:      (char as any).birthday  ?? null,
      country:       (char as any).country   ?? null,
      role:          char.role               ?? null,
      links:         Array.isArray((char as any).links) ? (char as any).links : [],
      isFollowing:   followingSet.has(targetId),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public user stories (public only) ────────────────────────────────────────

router.get("/users/:userId/stories", requireAuth, async (req, res) => {
  const targetId = String(req.params.userId);

  try {
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
        ? r.panels.map((p: any) => ({
            ...p,
            imageUri: safeDiscoverUri(p.imageUri) ?? undefined,
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
  const targetId = String(req.params.userId);

  try {
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
    return res.status(201).json({ following: true });
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
  const userId = getUserId(req);
  try {
    const [myCharRows, followingRows, stories] = await Promise.all([
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
        authorName:      characterTable.name,
        authorUsername:  characterTable.username,
        authorAvatarUri: characterTable.avatarUri,
      })
        .from(storiesTable)
        .innerJoin(characterTable, eq(characterTable.userId, storiesTable.userId))
        .where(
          and(
            eq(storiesTable.isPublic, true),
            eq(storiesTable.isHidden, false),     // exclude admin-hidden stories
            eq(characterTable.isPublic, true),
            eq(characterTable.isBanned, false),   // exclude banned users
            ne(storiesTable.userId, userId),       // never show own stories
          ),
        )
        .orderBy(desc(storiesTable.date))
        .limit(200),
    ]);

    const myMood       = myCharRows[0]?.mood ?? "Hopeful";
    const followingSet = new Set(followingRows.map(r => r.followingId));
    const now          = Date.now();

    const scored = stories.map(row => {
      const isFollowing = followingSet.has(row.userId);
      const moodMatch   = row.mood === myMood;
      const engagement  = Math.min(2, (row.witnessedCount + row.savedCount) / 25);
      const daysOld     = (now - row.date.getTime()) / 86_400_000;
      const recency     = Math.max(0, 1 - daysOld / 30);
      // Followed users get highest priority
      const score = (isFollowing ? 6 : 0) + (moodMatch ? 2 : 0) + engagement + recency;
      return { row, score, isFollowing };
    });

    scored.sort((a, b) => b.score - a.score);

    return res.json(
      scored.slice(0, 50).map(({ row, isFollowing }) => {
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
          authorAvatarUri: safeDiscoverUri(row.authorAvatarUri),
          chapterTitle:    row.chapterTitle,
          description:     row.description ?? '',
          storySnippet:    panels[0]?.text ?? "",
          imageUri:        panels[0]?.imageUri ?? null,
          mood:            row.mood,
          location:        row.location,
          witnessedCount:  row.witnessedCount,
          savedCount:      row.savedCount,
          date:            row.date.toISOString(),
          panels,
          pageLayoutKey:   row.pageLayoutKey ?? undefined,
          pages:           row.pages ?? undefined,
          isFollowing,
        };
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get discover feed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
