/**
 * POST /api/upload
 *
 * Accepts a base64-encoded image, compresses it with WhatsApp-style adaptive
 * quality targeting ≤ 200 KB, then stores it in GCS.
 *
 * Compression strategy (mirrors WhatsApp's published approach):
 *   1. Auto-rotate and strip EXIF metadata.
 *   2. Resize to max 1600 px on the longest edge (no upscaling).
 *   3. Start at JPEG quality 82 (mozjpeg encoder).
 *   4. If the result is still > 200 KB, retry at quality 68.
 *   5. If still > 200 KB, retry at quality 52.
 *   6. Never go below quality 40 — visible artefacts below that threshold.
 *   7. PNG images that have true alpha are kept as PNG (palette-quantised).
 *      Everything else becomes JPEG regardless of input format.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import sharp from "sharp";
import { requireAuth } from "../middleware/auth";
import { objectStorageClient } from "../lib/objectStorage";

const BUCKET_ID   = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
const MAX_DIM     = 1600;           // px – longest edge (WhatsApp standard)
const SIZE_TARGET = 200 * 1024;     // 200 KB target
const QUALITY_STEPS = [82, 68, 52]; // quality ladder – stop as soon as ≤ 200 KB

const UploadSchema = z.object({
  data: z.string().min(1),
  ext:  z.string().regex(/^[a-z0-9]+$/).default("jpg"),
});

const router: IRouter = Router();

router.post("/upload", requireAuth, async (req, res) => {
  if (!BUCKET_ID) {
    req.log.error("DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
    return res.status(503).json({ error: "Storage not configured" });
  }

  const parsed = UploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const raw      = parsed.data.data.replace(/^data:[^;]+;base64,/, "");
    const incoming = Buffer.from(raw, "base64");

    const meta     = await sharp(incoming).metadata();
    const hasAlpha = !!(meta.hasAlpha && meta.channels && meta.channels >= 4);

    let compressed: Buffer;
    let ext: string;
    let contentType: string;

    if (hasAlpha) {
      // True-transparency PNG: resize + palette quantise (no quality ladder needed)
      compressed = await sharp(incoming)
        .rotate()
        .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true, colors: 256 })
        .toBuffer();
      ext         = "png";
      contentType = "image/png";
    } else {
      // Adaptive-quality JPEG — step down quality until under SIZE_TARGET
      compressed = Buffer.alloc(0); // satisfies TS; overwritten in loop
      for (const quality of QUALITY_STEPS) {
        compressed = await sharp(incoming)
          .rotate()                // auto-rotate (strips EXIF as a side-effect)
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
      "Image compressed (WhatsApp-style adaptive quality)",
    );

    const file = objectStorageClient.bucket(BUCKET_ID).file(`images/${fname}`);
    await file.save(compressed, { metadata: { contentType }, resumable: false });

    return res.status(201).json({ path: `/api/images/${fname}` });
  } catch (err) {
    req.log.error({ err }, "Failed to process / save uploaded image");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
