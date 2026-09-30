import { db, outfitsTable, followsTable, characterTable, notificationsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";
import { syncConstellation } from "../services/constellationService";
import { assertOwnedMediaReferences, MediaOwnershipError, normalizeManagedMediaPath, normalizeMediaReference, withOwnerMediaUrls } from "../lib/mediaAccess";

/** Strip device-local URIs that are invisible to other users. */
function safeImageUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (normalizeManagedMediaPath(uri)) return normalizeMediaReference(uri);
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  return null;
}

function isExternalMusicStream(uri: string): boolean {
  if (normalizeManagedMediaPath(uri)) return false;
  try {
    normalizeMediaReference(uri);
    return true;
  } catch {
    return false;
  }
}

const router: IRouter = Router();

const MusicSchema = z.object({
  id:         z.string().min(1).max(100),
  title:      z.string().min(1).max(300),
  artist:     z.string().min(1).max(300),
  artworkUrl: z.string().url().max(2000).nullable(),
  duration:   z.number().int().min(1).max(75),
  genre:      z.string().max(100).nullable(),
  mood:       z.string().max(100).nullable(),
  streamUrl:  z.string().url().max(2000).refine(isExternalMusicStream, {
    message: "Managed media cannot be used as a music stream URL",
  }),
}).nullable().optional();

const OutfitInputSchema = z.object({
  id:          z.string().uuid().optional().nullable(),
  date:        z.string(),
  name:        z.string().min(1).max(200),
  description: z.string().max(500).default(""),
  story:       z.string().max(2000).default(""),
  imageUri:    z.string().nullable().optional(),
  tags:        z.array(z.string()).default([]),
  music:       MusicSchema,
  isPublic:    z.boolean().default(false),
});

router.get("/outfits", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select()
      .from(outfitsTable)
      .where(and(eq(outfitsTable.userId, userId), eq(outfitsTable.isHidden, false)))
      .orderBy(desc(outfitsTable.date));
    return res.json(rows.map(row => withOwnerMediaUrls(serializeOutfit(row), userId)));
  } catch (err) {
    req.log.error({ err }, "Failed to list outfits");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/outfits", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const parsed = OutfitInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const { id, date, ...rest } = parsed.data;
    const normalizedImageUri = rest.imageUri == null ? rest.imageUri : normalizeMediaReference(rest.imageUri);
    const music = rest.music
      ? { ...rest.music, artworkUrl: rest.music.artworkUrl ? normalizeMediaReference(rest.music.artworkUrl) : null }
      : rest.music;
    await assertOwnedMediaReferences(userId, [normalizedImageUri]);
    await assertOwnedMediaReferences(userId, [music?.artworkUrl]);

    const insertValues = {
      ...(id ? { id } : {}),
      userId,
      date: new Date(date),
      ...rest,
      music,
      imageUri: safeImageUri(normalizedImageUri),
    };

    const [created] = await db
      .insert(outfitsTable)
      .values(insertValues)
      .onConflictDoUpdate({
        target: outfitsTable.id,
        set: { date: new Date(date), ...rest, music, imageUri: safeImageUri(normalizedImageUri) },
        setWhere: eq(outfitsTable.userId, userId),
      })
      .returning();
    if (!created) return res.status(404).json({ error: "Not found" });

    // Fan-out notifications to followers (fire & forget, non-blocking)
    if (rest.isPublic) {
      fanOutOutfitNotification(userId, created.id, rest.name, req).catch(() => null);
    }
    // Sync constellation progress — outfit count drives the Seasonal star
    syncConstellation(userId).catch(() => null);

    return res.status(201).json(withOwnerMediaUrls(serializeOutfit(created), userId));
  } catch (err) {
    if (err instanceof MediaOwnershipError) return res.status(403).json({ error: err.message });
    req.log.error({ err }, "Failed to create outfit");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function fanOutOutfitNotification(
  userId: string,
  outfitId: string,
  outfitName: string,
  req: Request,
) {
  try {
    const [followers, actorRows] = await Promise.all([
      db.select({ followerId: followsTable.followerId })
        .from(followsTable)
        .where(eq(followsTable.followingId, userId)),
      db.select({ name: characterTable.name })
        .from(characterTable)
        .where(eq(characterTable.userId, userId))
        .limit(1),
    ]);

    if (followers.length === 0) return;

    const actorName = actorRows[0]?.name ?? "A sky child";

    await db.insert(notificationsTable).values(
      followers.map(f => ({
        userId:    f.followerId,
        actorId:   userId,
        actorName,
        type:      "new_outfit",
        refId:     outfitId,
        title:     outfitName,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fan-out outfit notification");
  }
}

router.patch("/outfits/:id", requireAuth, async (req, res) => {
  const userId  = getUserId(req);
  const outfitId = String(req.params.id);
  const parsed = OutfitInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  try {
    const rawBody = req.body as Record<string, unknown>;
    const updateSet: Record<string, unknown> = {};
    if (parsed.data.name        !== undefined) updateSet.name        = parsed.data.name;
    if (parsed.data.description !== undefined) updateSet.description = parsed.data.description;
    if ('story' in rawBody && rawBody.story  !== undefined) updateSet.story = String(rawBody.story ?? '');
    if ('imageUri' in parsed.data) {
      const imageUri = parsed.data.imageUri == null ? parsed.data.imageUri : normalizeMediaReference(parsed.data.imageUri);
      await assertOwnedMediaReferences(userId, [imageUri]);
      updateSet.imageUri = safeImageUri(imageUri);
    }
    if (parsed.data.tags        !== undefined) updateSet.tags        = parsed.data.tags;
    if ('music' in rawBody) {
      const music = parsed.data.music
        ? { ...parsed.data.music, artworkUrl: parsed.data.music.artworkUrl ? normalizeMediaReference(parsed.data.music.artworkUrl) : null }
        : null;
      await assertOwnedMediaReferences(userId, [music?.artworkUrl]);
      updateSet.music = music;
    }
    if (parsed.data.isPublic    !== undefined) updateSet.isPublic    = parsed.data.isPublic;

    const [updated] = await db
      .update(outfitsTable)
      .set(updateSet as Partial<typeof outfitsTable.$inferInsert>)
      .where(and(eq(outfitsTable.id, outfitId), eq(outfitsTable.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(withOwnerMediaUrls(serializeOutfit(updated), userId));
  } catch (err) {
    if (err instanceof MediaOwnershipError) return res.status(403).json({ error: err.message });
    req.log.error({ err }, "Failed to update outfit");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/outfits/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const outfitId = String(req.params.id);
  try {
    await db
      .delete(outfitsTable)
      .where(and(eq(outfitsTable.id, outfitId), eq(outfitsTable.userId, userId)));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete outfit");
    return res.status(500).json({ error: "Internal server error" });
  }
});

function serializeOutfit(row: typeof outfitsTable.$inferSelect) {
  return {
    id:          row.id,
    date:        row.date.toISOString(),
    name:        row.name,
    description: row.description,
    story:       row.story ?? '',
    imageUri:    row.imageUri ?? undefined,
    tags:        row.tags,
    isPublic:    row.isPublic,
    music:       row.music ?? null,
    createdAt:   row.createdAt.toISOString(),
  };
}

export default router;
