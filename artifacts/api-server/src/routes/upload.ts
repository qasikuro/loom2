/**
 * POST /api/upload
 *
 * Accepts images via two transports:
 *   • multipart/form-data  — field name "file" (native Expo FileSystem.uploadAsync)
 *   • application/json     — { data: base64string, ext: string } (web fallback)
 *
 * Compresses with WhatsApp-style adaptive quality targeting ≤ 200 KB:
 *   1. Auto-rotate + strip EXIF.
 *   2. Resize to max 1600 px on the longest edge (no upscaling).
 *   3. JPEG quality ladder: 82 → 68 → 52 (stop as soon as ≤ 200 KB).
 *   4. PNG with true alpha: palette-quantise instead of JPEG.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import sharp from "sharp";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { objectStorageClient } from "../lib/objectStorage";

const BUCKET_ID     = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
const MAX_DIM       = 1600;
const SIZE_TARGET   = 200 * 1024;
const QUALITY_STEPS = [82, 68, 52];

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },
});

const JsonUploadSchema = z.object({
  data: z.string().min(1),
  ext:  z.string().regex(/^[a-z0-9]+$/).default("jpg"),
});

const router: IRouter = Router();

async function processAndSave(
  req: Request,
  res: Response,
  incoming: Buffer,
): Promise<Response> {
  if (!BUCKET_ID) {
    req.log.error("DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
    return res.status(503).json({ error: "Storage not configured" });
  }

  try {
    const meta     = await sharp(incoming).metadata();
    const hasAlpha = !!(meta.hasAlpha && meta.channels && meta.channels >= 4);

    let compressed: Buffer;
    let ext: string;
    let contentType: string;

    if (hasAlpha) {
      compressed = await sharp(incoming)
        .rotate()
        .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true, colors: 256 })
        .toBuffer();
      ext         = "png";
      contentType = "image/png";
    } else {
      compressed = Buffer.alloc(0);
      for (const quality of QUALITY_STEPS) {
        compressed = await sharp(incoming)
          .rotate()
          .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
        if (compressed.byteLength <= SIZE_TARGET) break;
      }
      ext         = "jpeg";
      contentType = "image/jpeg";
    }

    const fname = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

    req.log.info(
      {
        fname,
        originalKb:   Math.round(incoming.byteLength   / 1024),
        compressedKb: Math.round(compressed.byteLength / 1024),
        ratio:        `${Math.round(compressed.byteLength / incoming.byteLength * 100)}%`,
      },
      "Image compressed and saved",
    );

    const file = objectStorageClient.bucket(BUCKET_ID).file(`images/${fname}`);
    await file.save(compressed, { metadata: { contentType }, resumable: false });

    return res.status(201).json({ path: `/api/images/${fname}` });
  } catch (err) {
    req.log.error({ err }, "Failed to process / save uploaded image");
    return res.status(500).json({ error: "Internal server error" });
  }
}

router.post(
  "/upload",
  requireAuth,
  (req, res, next) => {
    const ct = req.headers["content-type"] ?? "";
    if (ct.startsWith("multipart/")) {
      upload.single("file")(req as any, res as any, next);
    } else {
      next();
    }
  },
  async (req: Request, res: Response) => {
    if (!BUCKET_ID) {
      req.log.error("DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
      return res.status(503).json({ error: "Storage not configured" });
    }

    const multipartFile = (req as any).file as { buffer: Buffer } | undefined;

    if (multipartFile) {
      return processAndSave(req, res, multipartFile.buffer);
    }

    const parsed = JsonUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const raw      = parsed.data.data.replace(/^data:[^;]+;base64,/, "");
    const incoming = Buffer.from(raw, "base64");
    return processAndSave(req, res, incoming);
  },
);

export default router;
