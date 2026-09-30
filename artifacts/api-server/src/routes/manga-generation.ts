import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import sharp from "sharp";
import { editImageBuffers } from "@workspace/integrations-openai-ai-server/image";
import { pool } from "@workspace/db";
import { requireAuth, getUserId } from "../middleware/auth";
import { requireAiAccess } from "../middleware/ai-access";
import { objectStorageClient } from "../lib/objectStorage";
import { mediaOwnerMetadata } from "../lib/mediaAccess";

const CONFIG = {
  model: "gpt-image-1",
  quality: "high",
  outputSize: "1024x1536",
  maxImages: 10,
  maxWidth: 2048,
  maxHeight: 2048,
  jpegQuality: 85,
  maxPerDay: positiveInteger(process.env.MAX_GENERATIONS_PER_USER_PER_DAY, 5),
  estimatedOutputCostMicros: positiveInteger(process.env.MANGA_ESTIMATED_COST_MICROS, 250000),
  estimatedInputCostMicrosPerImage: positiveInteger(process.env.MANGA_ESTIMATED_INPUT_COST_MICROS, 10000),
} as const;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const STYLE_PROMPTS = {
  manga: "black-and-white Japanese manga with expressive ink lines, screentones, dramatic composition, and polished editorial paneling",
  color: "premium full-color manga with clean line art, rich environmental color, expressive lighting, and polished editorial paneling",
  chibi: "faithful cinematic full-color manga that retains the original game's art direction, character design, atmosphere, colors, and visual identity",
  cinematic: "cinematic manga with dramatic framing, detailed lighting, strong depth, environmental storytelling, and film-like panels",
  webtoon: "polished color webtoon with clean digital line art, atmospheric lighting, expressive composition, and strong visual continuity",
} as const;

const BodySchema = z.object({
  requestId: z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  imageUris: z.array(z.string().min(1)).min(1).max(CONFIG.maxImages),
  prompt: z.string().max(500).default(""),
  style: z.enum(["manga", "color", "chibi", "cinematic", "webtoon"]),
});

function storageFilename(uri: string): string | null {
  try {
    const pathname = uri.startsWith("http") ? new URL(uri).pathname : uri;
    const match = pathname.match(/^\/api\/images\/([\w.-]+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

const router: IRouter = Router();

router.delete("/manga/:generationId", requireAuth, async (req: Request, res: Response) => {
  const generationId = z.string().uuid().safeParse(req.params.generationId);
  if (!generationId.success) {
    return res.status(400).json({ error: "Invalid manga generation id" });
  }

  const userId = getUserId(req);
  try {
    const existing = await pool.query(
      "SELECT image_uri FROM manga_generations WHERE id=$1 AND user_id=$2",
      [generationId.data, userId],
    );
    if (!existing.rowCount) {
      return res.status(404).json({ error: "Manga generation not found" });
    }

    const imageUri = existing.rows[0]?.image_uri as string | null | undefined;
    const filename = imageUri ? storageFilename(imageUri) : null;
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (filename && bucketId) {
      await objectStorageClient
        .bucket(bucketId)
        .file(`images/${filename}`)
        .delete({ ignoreNotFound: true });
    }

    await pool.query(
      "DELETE FROM manga_generations WHERE id=$1 AND user_id=$2",
      [generationId.data, userId],
    );
    return res.status(204).end();
  } catch (error) {
    req.log.error({ err: error, generationId: generationId.data, userId }, "Failed to delete manga generation");
    return res.status(500).json({ error: "Could not delete manga generation" });
  }
});

router.post("/manga/generate", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid manga generation request" });
  }
  const userId = getUserId(req);
  const { requestId, imageUris, prompt, style } = parsed.data;
  const estimatedCostMicros =
    CONFIG.estimatedOutputCostMicros +
    imageUris.length * CONFIG.estimatedInputCostMicrosPerImage;
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) return res.status(503).json({ error: "Image storage is not configured." });

  const client = await pool.connect();
  let generationId: string;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    const existing = await client.query(
      "SELECT id, status, image_uri, created_at FROM manga_generations WHERE request_id = $1 AND user_id = $2",
      [requestId, userId],
    );
    if (existing.rowCount) {
      await client.query("COMMIT");
      const row = existing.rows[0] as { id: string; status: string; image_uri: string | null; created_at: Date };
      if (row.status === "success" && row.image_uri) {
        const count = await pool.query(
          `SELECT COUNT(*)::int AS count FROM manga_generations
           WHERE user_id=$1 AND status IN ('pending','success') AND created_at >= date_trunc('day', NOW())`,
          [userId],
        );
        return res.json({ generationId: row.id, imageUri: row.image_uri, remainingToday: Math.max(0, CONFIG.maxPerDay - Number(count.rows[0]?.count ?? 0)) });
      }
      if (row.status === "pending") {
        const deterministicFile = objectStorageClient.bucket(bucketId).file(`images/manga_${row.id}.png`);
        const [exists] = await deterministicFile.exists();
        if (exists) {
          const imageUri = `/api/images/manga_${row.id}.png`;
          await pool.query(
            "UPDATE manga_generations SET status='success', image_uri=$1, completed_at=NOW() WHERE id=$2",
            [imageUri, row.id],
          );
          return res.json({ generationId: row.id, imageUri, remainingToday: Math.max(0, CONFIG.maxPerDay - 1) });
        }
        const ageMs = Date.now() - new Date(row.created_at).getTime();
        if (ageMs < 15 * 60_000) {
          return res.status(409).json({ error: "This manga is still being created. Please wait before trying again." });
        }
        await pool.query(
          "UPDATE manga_generations SET status='failed', error_code='STALE_PENDING', completed_at=NOW() WHERE id=$1",
          [row.id],
        );
      }
      return res.status(409).json({ error: "The previous attempt did not finish. Please start a new generation." });
    }
    const usage = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM manga_generations
        WHERE user_id = $1
          AND status IN ('pending', 'success')
          AND created_at >= date_trunc('day', NOW())`,
      [userId],
    );
    const used = Number(usage.rows[0]?.count ?? 0);
    if (used >= CONFIG.maxPerDay) {
      await client.query("ROLLBACK");
      return res.status(429).json({ error: `Daily manga limit reached. You can create ${CONFIG.maxPerDay} pages per day.` });
    }
    const reservation = await client.query(
      `INSERT INTO manga_generations
       (request_id, user_id, style, prompt, image_count, model, quality, output_size, status, estimated_cost_micros)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9)
       RETURNING id`,
      [requestId, userId, style, prompt, imageUris.length, CONFIG.model, CONFIG.quality, CONFIG.outputSize, estimatedCostMicros],
    );
    generationId = String(reservation.rows[0]?.id ?? "");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "Failed to reserve manga generation");
    return res.status(500).json({ error: "Could not start manga generation." });
  } finally {
    client.release();
  }

  try {
    const references: Array<{ buffer: Buffer; filename: string }> = [];
    const originalSizes: number[] = [];
    const compressedSizes: number[] = [];
    for (const uri of imageUris) {
      const filename = storageFilename(uri);
      if (!filename) throw new Error("INVALID_IMAGE_URI");
      const canonicalPath = `/api/images/${filename}`;
      const ownership = await pool.query(
        "SELECT byte_size FROM uploaded_images WHERE path=$1 AND user_id=$2",
        [canonicalPath, userId],
      );
      if (!ownership.rowCount) throw new Error("IMAGE_NOT_OWNED");
      const [source] = await objectStorageClient.bucket(bucketId).file(`images/${filename}`).download();
      originalSizes.push(Number(ownership.rows[0]?.byte_size ?? source.byteLength));
      const compressed = await sharp(source)
        .rotate()
        .resize(CONFIG.maxWidth, CONFIG.maxHeight, { fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: CONFIG.jpegQuality, mozjpeg: true })
        .toBuffer();
      compressedSizes.push(compressed.byteLength);
      references.push({ buffer: compressed, filename: `reference-${references.length + 1}.jpg` });
    }

    const panelCount = Math.min(6, Math.max(3, imageUris.length));
    const generationPrompt =
      `Create one publication-quality portrait manga page in ${STYLE_PROMPTS[style]}. ` +
      "First study all uploaded images together as canonical visual source frames. Infer which character appears repeatedly, the shared world, the chronological order, the mood, and the important visual motifs before composing the page. " +
      "These references may be stylized video-game screenshots rather than photographs. Preserve the game's visual language instead of converting it into ordinary real-world people. Lock the main character's identity across every panel: retain the exact silhouette, body proportions, skin or mask treatment, hairstyle or headpiece, cape or wings, costume layers, colors, glowing marks, accessories, and other recognizable design features. " +
      "If a face is hidden, masked, shadowed, featureless, or turned away in the references, keep it that way. Never invent a visible human face, ethnicity, hairstyle, or generic anime identity that is not shown. Do not replace a non-human or stylized game avatar with a generic boy or girl. " +
      `Use ${panelCount} clearly separated panels. Give the page a professional manga rhythm: begin with a wide establishing panel, use varied medium and close compositions for emotional progression, and finish with a visually strong resolving panel. Use clean gutters, intentional panel shapes, and an easy top-to-bottom reading order rather than a repetitive equal-sized grid. ` +
      "Map the uploaded images into one continuous scene. Preserve their locations, lighting, weather, poses, events, and order, while using cinematic reframing and subtle in-between moments to create continuity. Do not invent unrelated locations, costumes, characters, or events. " +
      "Create a concise emotional story with a hook, progression, turning point, and satisfying final beat. Let the imagery carry most of the story. Favor specific, evocative narration over generic exposition. " +
      "Add only short manga captions or speech bubbles directly inside the panels. Use clear, correctly spelled English, large readable lettering, strong contrast, and roughly three to nine words per text box. Keep text away from characters and important details. " +
      "Use detailed foregrounds and backgrounds, crisp character edges, natural hands and anatomy appropriate to the source design, coherent lighting, and strong depth. Avoid muddy shadows, accidental silhouettes, duplicate characters, cropped heads, blurry details, logos, watermarks, random symbols, or decorative nonsense text. " +
      `Follow this user direction when shaping the story: <story_direction>${prompt.trim() || "Create an emotionally engaging manga sequence from the uploaded pictures."}</story_direction>. ` +
      "The final page must feel like the uploaded game moments were intentionally storyboarded into a manga—not loosely reimagined from them.";
    const generated = await editImageBuffers(references, generationPrompt, {
      quality: CONFIG.quality,
      size: CONFIG.outputSize,
      inputFidelity: "high",
    });
    const creditSvg = Buffer.from(
      `<svg width="1024" height="1536"><rect x="775" y="1480" width="225" height="44" rx="10" fill="rgba(8,5,22,.78)"/><text x="887" y="1508" text-anchor="middle" font-family="Arial,sans-serif" font-size="19" font-weight="700" fill="white">Made by Gamejo</text></svg>`,
    );
    const finalImage = await sharp(generated)
      .resize(1024, 1536, { fit: "cover" })
      .composite([{ input: creditSvg }])
      .png()
      .toBuffer();
    const filename = `manga_${generationId}.png`;
    await objectStorageClient.bucket(bucketId).file(`images/${filename}`).save(finalImage, {
      resumable: false,
      metadata: { contentType: "image/png", metadata: mediaOwnerMetadata(userId) },
    });
    const imageUri = `/api/images/${filename}`;
    await pool.query(
      `UPDATE manga_generations SET status='success', image_uri=$1, original_sizes=$2,
       compressed_sizes=$3, completed_at=NOW() WHERE request_id=$4 AND user_id=$5`,
      [imageUri, JSON.stringify(originalSizes), JSON.stringify(compressedSizes), requestId, userId],
    );
    const count = await pool.query(
      `SELECT COUNT(*)::int AS count FROM manga_generations
       WHERE user_id=$1 AND status IN ('pending','success') AND created_at >= date_trunc('day', NOW())`,
      [userId],
    );
    return res.json({ generationId, imageUri, remainingToday: Math.max(0, CONFIG.maxPerDay - Number(count.rows[0]?.count ?? 0)) });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 100) : "GENERATION_FAILED";
    await pool.query(
      "UPDATE manga_generations SET status='failed', error_code=$1, completed_at=NOW() WHERE request_id=$2 AND user_id=$3",
      [errorCode, requestId, userId],
    ).catch(() => undefined);
    req.log.error({ err: error, requestId, userId }, "Manga generation failed");
    if (error && typeof error === "object" && "status" in error && (error as { status?: unknown }).status === 401) {
      return res.status(503).json({
        error: "The AI image service is temporarily unavailable. Please try again later.",
        code: "AI_PROVIDER_UNAVAILABLE",
      });
    }
    return res.status(502).json({ error: "Something went wrong creating your manga. Please try again." });
  }
});

export default router;