import { db, outfitsTable, followsTable, characterTable, notificationsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";

const router: IRouter = Router();

const OutfitInputSchema = z.object({
  id:          z.string().uuid().optional().nullable(),
  date:        z.string(),
  name:        z.string().min(1).max(200),
  description: z.string().max(500).default(""),
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
    };

    const [created] = await db
      .insert(outfitsTable)
      .values(insertValues)
      .onConflictDoUpdate({
        target: outfitsTable.id,
        set: { userId, date: new Date(date), ...rest },
      })
      .returning();

    // Fan-out notifications to followers (fire & forget, non-blocking)
    if (rest.isPublic) {
      fanOutOutfitNotification(userId, created.id, rest.name, req).catch(() => null);
    }

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
    imageUri:    row.imageUri ?? undefined,
    tags:        row.tags,
    isPublic:    row.isPublic,
    createdAt:   row.createdAt.toISOString(),
  };
}

export default router;
