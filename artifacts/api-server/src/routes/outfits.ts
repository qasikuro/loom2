import { db, outfitsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";

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

router.get("/outfits", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(outfitsTable)
      .orderBy(desc(outfitsTable.date));
    return res.json(rows.map(serializeOutfit));
  } catch (err) {
    req.log.error({ err }, "Failed to list outfits");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/outfits", async (req, res) => {
  const parsed = OutfitInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const { id, date, ...rest } = parsed.data;

    const insertValues = {
      ...(id ? { id } : {}),
      date: new Date(date),
      ...rest,
    };

    const [created] = await db
      .insert(outfitsTable)
      .values(insertValues)
      .onConflictDoUpdate({
        target: outfitsTable.id,
        set: { date: new Date(date), ...rest },
      })
      .returning();

    return res.status(201).json(serializeOutfit(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create outfit");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/outfits/:id", async (req, res) => {
  try {
    await db.delete(outfitsTable).where(eq(outfitsTable.id, req.params.id));
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
