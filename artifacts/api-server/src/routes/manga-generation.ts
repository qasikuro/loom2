import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import sharp from "sharp";
import { editImageBuffers } from "@workspace/integrations-openai-ai-server/image";
import { pool } from "@workspace/db";
import { requireAuth, getUserId } from "../middleware/auth";
import { objectStorageClient } from "../lib/objectStorage";

const CONFIG = {
  model: "gpt-image-1",
  quality: "low",
  outputSize: "1024x1024",
  maxImages: 10,
  maxWidth: 1536,
  maxHeight: 1536,
  jpegQuality: 75,
  maxPerDay: positiveInteger(process.env.MAX_GENERATIONS_PER_USER_PER_DAY, 5),
  estimatedCostMicros: positiveInteger(process.env.MANGA_ESTIMATED_COST_MICROS, 20000),
} as const;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const STYLE_PROMPTS = {
  manga: "black-and-white Japanese manga with expressive ink lines, screentones, and readable panels",
  color: "full-color manga with clean line art, vivid lighting, and readable panels",
  chibi: "cute chibi manga with small bodies, oversized expressive faces, and playful colorful panels",
  cinematic: "cinematic manga with dramatic framing, detailed lighting, strong depth, and film-like panels",
  webtoon: "polished color webtoon with clean digital line art and expressive characters",
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

router.post("/manga/generate", requireAuth, async (req: Request, res: Response) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid manga generation request" });
  }
  const userId = getUserId(req);
  const { requestId, imageUris, prompt, style } = parsed.data;
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
        return res.json({ imageUri: row.image_uri, remainingToday: Math.max(0, CONFIG.maxPerDay - Number(count.rows[0]?.count ?? 0)) });
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
          return res.json({ imageUri, remainingToday: Math.max(0, CONFIG.maxPerDay - 1) });
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
       (request_id, user_id, style, prompt, image_count, model, quality, output_size, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
       RETURNING id`,
      [requestId, userId, style, prompt, imageUris.length, CONFIG.model, CONFIG.quality, CONFIG.outputSize],
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

    const generationPrompt =
      `Create exactly one coherent square manga story page in ${STYLE_PROMPTS[style]}. ` +
      "Use the uploaded images only as visual references for characters, environments, events, poses, and continuity. " +
      "Arrange the result as a clear multi-panel page. Do not include logos, watermarks, or unrelated text. " +
      `Story direction: ${prompt.trim() || "Create a warm, coherent adventure from these moments."}`;
    const generated = await editImageBuffers(references, generationPrompt);
    const creditSvg = Buffer.from(
      `<svg width="1024" height="1024"><rect x="775" y="956" width="225" height="44" rx="10" fill="rgba(8,5,22,.78)"/><text x="887" y="984" text-anchor="middle" font-family="Arial,sans-serif" font-size="19" font-weight="700" fill="white">Made by Gamejo</text></svg>`,
    );
    const finalImage = await sharp(generated).resize(1024, 1024).composite([{ input: creditSvg }]).png().toBuffer();
    const filename = `manga_${generationId}.png`;
    await objectStorageClient.bucket(bucketId).file(`images/${filename}`).save(finalImage, {
      resumable: false,
      metadata: { contentType: "image/png" },
    });
    const imageUri = `/api/images/${filename}`;
    await pool.query(
      `UPDATE manga_generations SET status='success', image_uri=$1, original_sizes=$2,
       compressed_sizes=$3, estimated_cost_micros=$4, completed_at=NOW() WHERE request_id=$5 AND user_id=$6`,
      [imageUri, JSON.stringify(originalSizes), JSON.stringify(compressedSizes), CONFIG.estimatedCostMicros, requestId, userId],
    );
    const count = await pool.query(
      `SELECT COUNT(*)::int AS count FROM manga_generations
       WHERE user_id=$1 AND status IN ('pending','success') AND created_at >= date_trunc('day', NOW())`,
      [userId],
    );
    return res.json({ imageUri, remainingToday: Math.max(0, CONFIG.maxPerDay - Number(count.rows[0]?.count ?? 0)) });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 100) : "GENERATION_FAILED";
    await pool.query(
      "UPDATE manga_generations SET status='failed', error_code=$1, completed_at=NOW() WHERE request_id=$2 AND user_id=$3",
      [errorCode, requestId, userId],
    ).catch(() => undefined);
    req.log.error({ err: error, requestId, userId }, "Manga generation failed");
    return res.status(502).json({ error: "Something went wrong creating your manga. Please try again." });
  }
});

export default router;