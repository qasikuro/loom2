import { db, characterTable } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";

const router: IRouter = Router();

const CharacterInputSchema = z.object({
  name:      z.string().min(1).max(100),
  bio:       z.string().max(500).default(""),
  mood:      z.string().max(100).default("Hopeful"),
  traits:    z.array(z.string()).default([]),
  isPublic:  z.boolean().default(true),
  username:  z.string().regex(/^[a-z0-9_]{3,20}$/).optional().nullable(),
  avatarUri: z.string().nullable().optional(),
});

router.get("/character", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const rows = await db
      .select()
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1);

    if (rows.length === 0) {
      const [created] = await db
        .insert(characterTable)
        .values({ userId, name: "Sky Child", bio: "", mood: "Hopeful", traits: [], isPublic: true })
        .returning();
      return res.json(created);
    }
    return res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to get character");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/character", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const parsed = CharacterInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const [updated] = await db
      .insert(characterTable)
      .values({ userId, ...parsed.data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: characterTable.userId,
        set: { ...parsed.data, updatedAt: new Date() },
      })
      .returning();
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === "23505" && String(err?.constraint ?? "").includes("username")) {
      return res.status(409).json({ error: "Username already taken" });
    }
    req.log.error({ err }, "Failed to update character");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/check-username", requireAuth, async (req, res) => {
  const userId   = getUserId(req);
  const username = String(req.query.username ?? "").trim().toLowerCase();

  if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.json({ available: false, reason: "invalid_format" });
  }

  try {
    const rows = await db
      .select({ userId: characterTable.userId })
      .from(characterTable)
      .where(and(eq(characterTable.username, username), ne(characterTable.userId, userId)))
      .limit(1);

    return res.json({ available: rows.length === 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to check username");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
