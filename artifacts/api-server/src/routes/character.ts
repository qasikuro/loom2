import { db, characterTable } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";

/** Strip device-local URIs that are invisible to other users. */
function safeImageUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  return null;
}

const router: IRouter = Router();

const ProfileLinkSchema = z.object({
  label: z.string().max(50),
  url:   z.string().max(300),
});

const CharacterInputSchema = z.object({
  name:           z.string().min(1).max(100),
  bio:            z.string().max(500).default(""),
  mood:           z.string().max(100).default("Hopeful"),
  traits:         z.array(z.string()).default([]),
  isPublic:       z.boolean().default(true),
  username:       z.string().regex(/^[a-z0-9_]{3,20}$/).optional().nullable(),
  avatarUri:      z.string().nullable().optional(),
  activeOutfitId: z.string().nullable().optional(),
  birthday:       z.string().max(20).nullable().optional(),
  country:        z.string().max(80).nullable().optional(),
  links:          z.array(ProfileLinkSchema).max(6).optional().nullable(),
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
    // Username is permanent once set — reject attempts to change it
    const [existing] = await db
      .select({ username: characterTable.username })
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1);

    if (existing?.username && parsed.data.username !== existing.username) {
      return res.status(409).json({ error: "Username cannot be changed once set" });
    }

    const safeData = {
      ...parsed.data,
      // If username already locked, always keep the existing one regardless of what was sent
      username: existing?.username ?? parsed.data.username,
      avatarUri: safeImageUri(parsed.data.avatarUri),
      activeOutfitId: parsed.data.activeOutfitId ?? null,
    };
    const [updated] = await db
      .insert(characterTable)
      .values({ userId, ...safeData, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: characterTable.userId,
        set: { ...safeData, updatedAt: new Date() },
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

router.patch("/character/active-outfit", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { activeOutfitId } = req.body as { activeOutfitId: string | null };
  try {
    await db
      .insert(characterTable)
      .values({ userId, name: "Sky Child", activeOutfitId: activeOutfitId ?? null, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: characterTable.userId,
        set: { activeOutfitId: activeOutfitId ?? null, updatedAt: new Date() },
      });
    return res.json({ activeOutfitId: activeOutfitId ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to update active outfit");
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
