import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, storiesTable, outfitsTable, booksTable, guideTutorialsTable } from "@workspace/db";
import { requireAuth, getUserId } from "../middleware/auth";
import { emitSSEEvent } from "../lib/sseEmitter";
import * as cache from "../lib/cache";

const router = Router();
const params = z.object({ kind: z.enum(["story", "outfit", "book", "tutorial"]), id: z.string().uuid() });
const input = z.object({ visibility: z.enum(["public", "friends", "private"]) });

router.get("/my-posts/visibility", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  res.set("Cache-Control", "private, no-store");
  try {
    const [stories, outfits, books, tutorials] = await Promise.all([
      db.select({ id: storiesTable.id, title: storiesTable.chapterTitle, visibility: storiesTable.visibility,
        isPublic: storiesTable.isPublic, type: storiesTable.contentType })
        .from(storiesTable).where(and(eq(storiesTable.userId, userId), eq(storiesTable.isHidden, false))).orderBy(desc(storiesTable.date)),
      db.select({ id: outfitsTable.id, title: outfitsTable.name, visibility: outfitsTable.visibility, isPublic: outfitsTable.isPublic })
        .from(outfitsTable).where(and(eq(outfitsTable.userId, userId), eq(outfitsTable.isHidden, false))).orderBy(desc(outfitsTable.date)),
      db.select({ id: booksTable.id, title: booksTable.title, visibility: booksTable.visibility })
        .from(booksTable).where(eq(booksTable.userId, userId)).orderBy(desc(booksTable.updatedAt)),
      db.select({ id: guideTutorialsTable.id, title: guideTutorialsTable.title, visibility: guideTutorialsTable.visibility })
        .from(guideTutorialsTable).where(eq(guideTutorialsTable.guideId, userId)).orderBy(desc(guideTutorialsTable.updatedAt)),
    ]);
    return res.json([
      ...stories.map(row => ({ id: row.id, title: row.title, kind: "story", label: row.type === "video" ? "Video" : "Story / post",
        visibility: row.isPublic ? "public" : row.visibility === "friends" ? "friends" : "private" })),
      ...outfits.map(row => ({ id: row.id, title: row.title, kind: "outfit", label: "Outfit",
        visibility: row.isPublic ? "public" : row.visibility === "friends" ? "friends" : "private" })),
      ...books.map(row => ({ ...row, kind: "book", label: "Book" })),
      ...tutorials.map(row => ({ ...row, kind: "tutorial", label: "Tutorial" })),
    ]);
  } catch (err) {
    req.log.error({ err }, "Failed to list post visibility");
    return res.status(500).json({ error: "Couldn't load post visibility. Please try again." });
  }
});

router.patch("/my-posts/:kind/:id/visibility", requireAuth, async (req, res) => {
  const parsed = params.safeParse(req.params);
  const body = input.safeParse(req.body);
  if (!parsed.success || !body.success) return res.status(400).json({ error: "Invalid visibility setting" });
  const userId = getUserId(req);
  const { kind, id } = parsed.data;
  const { visibility } = body.data;
  try {
    let changed: { id: string }[];
    switch (kind) {
      case "story":
        changed = await db.update(storiesTable).set({ visibility, isPublic: visibility === "public" })
          .where(and(eq(storiesTable.id, id), eq(storiesTable.userId, userId), eq(storiesTable.isHidden, false))).returning({ id: storiesTable.id });
        break;
      case "outfit":
        changed = await db.update(outfitsTable).set({ visibility, isPublic: visibility === "public" })
          .where(and(eq(outfitsTable.id, id), eq(outfitsTable.userId, userId), eq(outfitsTable.isHidden, false))).returning({ id: outfitsTable.id });
        break;
      case "book":
        changed = await db.update(booksTable).set({ visibility, updatedAt: new Date() })
          .where(and(eq(booksTable.id, id), eq(booksTable.userId, userId))).returning({ id: booksTable.id });
        break;
      case "tutorial":
        changed = await db.update(guideTutorialsTable).set({ visibility, updatedAt: new Date() })
          .where(and(eq(guideTutorialsTable.id, id), eq(guideTutorialsTable.guideId, userId))).returning({ id: guideTutorialsTable.id });
    }
    if (!changed.length) return res.status(404).json({ error: "Post not found" });
    cache.invalidate("discover:");
    emitSSEEvent(`messages:${userId}`, { type: "content_visibility_changed", kind, id, visibility });
    return res.json({ id, kind, visibility });
  } catch (err) {
    req.log.error({ err }, "Failed to change post visibility");
    return res.status(500).json({ error: "Visibility wasn't changed. Please try again." });
  }
});

export default router;
