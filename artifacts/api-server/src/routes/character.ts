import { db, characterTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";

const router: IRouter = Router();

const CharacterInputSchema = z.object({
  name:     z.string().min(1).max(100),
  bio:      z.string().max(500).default(""),
  mood:     z.string().max(100).default("Hopeful"),
  traits:   z.array(z.string()).default([]),
  isPublic: z.boolean().default(true),
});

router.get("/character", async (req, res) => {
  try {
    const rows = await db.select().from(characterTable).where(eq(characterTable.id, 1)).limit(1);
    if (rows.length === 0) {
      const [created] = await db
        .insert(characterTable)
        .values({ id: 1, name: "Sky Child", bio: "", mood: "Hopeful", traits: [], isPublic: true })
        .returning();
      return res.json(created);
    }
    return res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to get character");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/character", async (req, res) => {
  const parsed = CharacterInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const [updated] = await db
      .insert(characterTable)
      .values({ id: 1, ...parsed.data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: characterTable.id,
        set: { ...parsed.data, updatedAt: new Date() },
      })
      .returning();
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update character");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
