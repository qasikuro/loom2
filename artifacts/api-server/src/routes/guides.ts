import { db, characterTable, followsTable } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";

const router: IRouter = Router();

// ── Response shape validation ─────────────────────────────────────────────────
const GuideAvailabilitySchema = z.object({
  days:      z.array(z.number()),
  timeFrom:  z.string(),
  timeTo:    z.string(),
  timezone:  z.string().optional(),
});

const GuideResponseSchema = z.object({
  userId:            z.string(),
  name:              z.string().nullable(),
  username:          z.string().nullable(),
  bio:               z.string().nullable(),
  guideBio:          z.string().nullable(),
  guideTopics:       z.array(z.string()),
  guideAvailability: GuideAvailabilitySchema.nullable(),
  peaceRating:       z.number(),
  dreamersGuided:    z.number(),
  followerCount:     z.number(),
  avatarUri:         z.string().nullable(),
  mood:              z.string().nullable(),
  traits:            z.array(z.string()),
  role:              z.string().nullable(),
  country:           z.string().nullable(),
  isFollowing:       z.boolean(),
  isAvailableNow:    z.boolean(),
});

type GuideResponse = z.infer<typeof GuideResponseSchema>;

export interface GuideAvailability {
  days:      number[];
  timeFrom:  string;
  timeTo:    string;
  timezone?: string; // IANA timezone e.g. "Asia/Singapore"
}

function isAvailableNow(avail: GuideAvailability | null | undefined): boolean {
  if (!avail) return false;
  const tz  = avail.timezone ?? "UTC";
  // Convert server time to guide's local timezone
  let nowLocal: Date;
  try {
    nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  } catch {
    nowLocal = new Date(); // fallback to server time if tz is invalid
  }
  const day = nowLocal.getDay();
  if (!avail.days.includes(day)) return false;
  const cur  = nowLocal.getHours() * 60 + nowLocal.getMinutes();
  const [fH, fM] = avail.timeFrom.split(":").map(Number);
  const [tH, tM] = avail.timeTo.split(":").map(Number);
  const from = fH * 60 + fM;
  const to   = tH * 60 + tM;
  if (to < from) return cur >= from || cur <= to; // overnight range
  return cur >= from && cur <= to;
}

function safeDiscoverUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith("file://") || uri.startsWith("data:")) return null;
  return uri;
}

function serializeGuide(
  row: typeof characterTable.$inferSelect,
  followerCount: number,
  isFollowing:   boolean,
) {
  const avail = row.guideAvailability as GuideAvailability | null;
  return {
    userId:            row.userId,
    name:              row.name,
    username:          row.username ?? null,
    bio:               row.bio,
    guideBio:          row.guideBio,
    guideTopics:       Array.isArray(row.guideTopics) ? row.guideTopics : [],
    guideAvailability: avail ?? null,
    peaceRating:       row.peaceRating ?? 5.0,
    dreamersGuided:    row.dreamersGuided ?? 0,
    followerCount,
    avatarUri:         safeDiscoverUri(row.avatarUri),
    mood:              row.mood,
    traits:            Array.isArray(row.traits) ? row.traits as string[] : [],
    role:              row.role   ?? null,
    country:           row.country ?? null,
    isFollowing,
    isAvailableNow:    isAvailableNow(avail),
  };
}

// ── GET /api/guides — browse all guides ───────────────────────────────────────
router.get("/guides", requireAuth, async (req, res) => {
  const userId  = getUserId(req);
  const topic   = req.query.topic   ? String(req.query.topic)   : null;
  const availNow = req.query.available_now === "true";
  const following = req.query.following === "true";

  try {
    // Fetch current user's following list
    const myFollows = await db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, userId));
    const followingSet = new Set(myFollows.map(r => r.followingId));

    // Base query: active guides with public profiles
    let guideRows = await db
      .select()
      .from(characterTable)
      .where(
        and(
          eq(characterTable.isGuide,  true),
          eq(characterTable.isPublic, true),
          eq(characterTable.isBanned, false),
        ),
      )
      .orderBy(desc(characterTable.updatedAt))
      .limit(100);

    // Filter by following
    if (following) {
      guideRows = guideRows.filter(g => followingSet.has(g.userId));
    }

    // Filter by topic
    if (topic) {
      guideRows = guideRows.filter(g =>
        Array.isArray(g.guideTopics) && (g.guideTopics as string[]).includes(topic),
      );
    }

    // Filter by available now
    if (availNow) {
      guideRows = guideRows.filter(g =>
        isAvailableNow(g.guideAvailability as GuideAvailability | null),
      );
    }

    // Fetch follower counts for each guide
    const guideUserIds = guideRows.map(g => g.userId);
    const followerRows = guideUserIds.length > 0
      ? await db
          .select({ followingId: followsTable.followingId })
          .from(followsTable)
          .where(inArray(followsTable.followingId, guideUserIds))
      : [];

    const followerCount: Record<string, number> = {};
    for (const r of followerRows) {
      followerCount[r.followingId] = (followerCount[r.followingId] ?? 0) + 1;
    }

    const serialized: GuideResponse[] = [];
    for (const g of guideRows) {
      const raw    = serializeGuide(g, followerCount[g.userId] ?? 0, followingSet.has(g.userId));
      const parsed = GuideResponseSchema.safeParse(raw);
      if (parsed.success) {
        serialized.push(parsed.data);
      } else {
        req.log.warn({ userId: g.userId, issues: parsed.error.issues }, "Guide row failed validation — skipped");
      }
    }
    return res.json(serialized);
  } catch (err) {
    req.log.error({ err }, "Failed to list guides");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/guides/:userId — single guide profile ────────────────────────────
router.get("/guides/:userId", requireAuth, async (req, res) => {
  const viewerId = getUserId(req);
  const targetId = String(req.params.userId);
  const isOwnProfile = viewerId === targetId;

  try {
    // Own profile: fetch without guide/public restrictions so user can always see it
    // Other profiles: must be a public guide
    const [guideRow] = await db
      .select()
      .from(characterTable)
      .where(
        isOwnProfile
          ? eq(characterTable.userId, targetId)
          : and(
              eq(characterTable.userId,   targetId),
              eq(characterTable.isGuide,  true),
              eq(characterTable.isPublic, true),
            ),
      )
      .limit(1);

    if (!guideRow) {
      return res.status(404).json({ error: "Guide not found" });
    }

    const [followers, isFollowingRows] = await Promise.all([
      db.select({ followingId: followsTable.followingId })
        .from(followsTable)
        .where(eq(followsTable.followingId, targetId)),
      db.select({ followingId: followsTable.followingId })
        .from(followsTable)
        .where(and(eq(followsTable.followerId, viewerId), eq(followsTable.followingId, targetId))),
    ]);

    const raw    = serializeGuide(guideRow, followers.length, isFollowingRows.length > 0);
    const parsed = GuideResponseSchema.safeParse(raw);
    if (!parsed.success) {
      req.log.warn({ userId: targetId, issues: parsed.error.issues }, "Guide row failed validation");
      return res.status(500).json({ error: "Guide data is malformed" });
    }
    return res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Failed to get guide");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
