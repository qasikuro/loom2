import { Router, type IRouter } from "express";
import { z } from "zod";
import sharp from "sharp";
import { requireAuth } from "../middleware/auth";
import { objectStorageClient } from "../lib/objectStorage";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
const MAX_DIMENSION = 1200;   // px – longest edge
const JPEG_QUALITY  = 80;     // 0-100

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
    const { data } = parsed.data;
    const raw = data.replace(/^data:[^;]+;base64,/, "");
    const incoming = Buffer.from(raw, "base64");

    // ── Compress & resize with sharp ──────────────────────────────────────────
    // Detect if source is PNG with alpha – keep as PNG, otherwise convert to JPEG
    const meta = await sharp(incoming).metadata();
    const hasAlpha = !!(meta.hasAlpha && meta.channels && meta.channels >= 4);

    let compressed: Buffer;
    let ext: string;
    let contentType: string;

    if (hasAlpha) {
      // PNG: resize only (preserve transparency), quantise palette to reduce size
      compressed = await sharp(incoming)
        .rotate()                          // auto-rotate from EXIF
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 8, palette: true })
        .toBuffer();
      ext         = "png";
      contentType = "image/png";
    } else {
      // Everything else → JPEG for smallest file size
      compressed = await sharp(incoming)
        .rotate()                          // auto-rotate from EXIF (also strips EXIF)
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
      ext         = "jpeg";
      contentType = "image/jpeg";
    }

    const fname = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    req.log.info(
      { original: incoming.byteLength, compressed: compressed.byteLength, fname },
      "Image compressed before upload",
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
