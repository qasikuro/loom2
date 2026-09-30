import { db, galleryTable, characterTable } from "@workspace/db";
import { and, count, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";
import { assertOwnedMediaReferences, MediaOwnershipError, normalizeMediaReference, withOwnerMediaUrls } from "../lib/mediaAccess";

const router: IRouter = Router();

router.use("/gallery", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.vary("Authorization");
  res.vary("Cookie");
  next();
});

const DEFAULT_LIMIT = 200;

router.get("/gallery/usage", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const [countRow] = await db
      .select({ n: count() })
      .from(galleryTable)
      .where(eq(galleryTable.userId, userId));
    const [charRow] = await db
      .select({ galleryLimit: characterTable.galleryLimit })
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1);
    return res.json({
      count: Number(countRow?.n ?? 0),
      limit: charRow?.galleryLimit ?? DEFAULT_LIMIT,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get gallery usage");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/gallery", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select()
      .from(galleryTable)
      .where(eq(galleryTable.userId, userId))
      .orderBy(desc(galleryTable.createdAt));
    return res.json(
      rows.map(r => withOwnerMediaUrls({
        id:        r.id,
        imageUri:  r.imageUri,
        caption:   r.caption,
        createdAt: r.createdAt.toISOString(),
      }, userId)),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list gallery");
    return res.status(500).json({ error: "Internal server error" });
  }
});

const GalleryInputSchema = z.object({
  imageUri: z.string().min(1),
  caption:  z.string().max(300).default(""),
});

router.post("/gallery", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const parsed = GalleryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const imageUri = normalizeMediaReference(parsed.data.imageUri);
    await assertOwnedMediaReferences(userId, [imageUri]);
    const [countRow] = await db
      .select({ n: count() })
      .from(galleryTable)
      .where(eq(galleryTable.userId, userId));
    const [charRow] = await db
      .select({ galleryLimit: characterTable.galleryLimit })
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1);

    const limit   = charRow?.galleryLimit ?? DEFAULT_LIMIT;
    const current = Number(countRow?.n ?? 0);

    if (current >= limit) {
      return res.status(429).json({ error: "Gallery limit reached", limit, current });
    }

    const [created] = await db
      .insert(galleryTable)
      .values({ userId, imageUri, caption: parsed.data.caption })
      .returning();

    return res.status(201).json(withOwnerMediaUrls({
      id:        created.id,
      imageUri:  created.imageUri,
      caption:   created.caption,
      createdAt: created.createdAt.toISOString(),
    }, userId));
  } catch (err) {
    if (err instanceof MediaOwnershipError) return res.status(403).json({ error: err.message });
    req.log.error({ err }, "Failed to add gallery photo");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/gallery/:id", requireAuth, async (req, res) => {
  const userId  = getUserId(req);
  const photoId = String(req.params.id);
  try {
    await db
      .delete(galleryTable)
      .where(and(eq(galleryTable.id, photoId), eq(galleryTable.userId, userId)));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete gallery photo");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
