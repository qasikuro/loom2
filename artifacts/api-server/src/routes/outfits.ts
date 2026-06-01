import { db, outfitsTable, followsTable, characterTable, notificationsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";
import { syncConstellation } from "../services/constellationService";

/** Strip device-local URIs that are invisible to other users. */
function safeImageUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  return null;
}

const router: IRouter = Router();

const OutfitInputSchema = z.object({
  id:          z.string().uuid().optional().nullable(),
  date:        z.string(),
  name:        z.string().min(1).max(200),
  description: z.string().max(500).default(""),
  story:       z.string().max(2000).default(""),
  imageUri:    z.string().nullable().optional(),
  tags:        z.array(z.string()).default([]),
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
    return res.json(rows.map(serializeOutfit));
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

    const insertValues = {
      ...(id ? { id } : {}),
      userId,
      date: new Date(date),
      ...rest,
      imageUri: safeImageUri(rest.imageUri),
    };

    const [created] = await db
      .insert(outfitsTable)
      .values(insertValues)
      .onConflictDoUpdate({
        target: outfitsTable.id,
        set: { userId, date: new Date(date), ...rest, imageUri: safeImageUri(rest.imageUri) },
      })
      .returning();

    // Fan-out notifications to followers (fire & forget, non-blocking)
    if (rest.isPublic) {
      fanOutOutfitNotification(userId, created.id, rest.name, req).catch(() => null);
    }
    // Sync constellation progress — outfit count drives the Seasonal star
    syncConstellation(db as any, userId).catch(() => null);

    return res.status(201).json(serializeOutfit(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create outfit");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function fanOutOutfitNotification(
  userId: string,
  outfitId: string,
  outfitName: string,
  req: any,
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
    if ('imageUri' in parsed.data)             updateSet.imageUri    = safeImageUri(parsed.data.imageUri);
    if (parsed.data.tags        !== undefined) updateSet.tags        = parsed.data.tags;
    if (parsed.data.isPublic    !== undefined) updateSet.isPublic    = parsed.data.isPublic;

    const [updated] = await db
      .update(outfitsTable)
      .set(updateSet as any)
      .where(and(eq(outfitsTable.id, outfitId), eq(outfitsTable.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(serializeOutfit(updated));
  } catch (err) {
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
    createdAt:   row.createdAt.toISOString(),
  };
}

export default router;
