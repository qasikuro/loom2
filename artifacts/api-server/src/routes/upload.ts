import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { objectStorageClient } from "../lib/objectStorage";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";

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
    const { data, ext } = parsed.data;
    const raw   = data.replace(/^data:[^;]+;base64,/, "");
    const buf   = Buffer.from(raw, "base64");
    const fname = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const contentType = ext === "png" ? "image/png"
      : ext === "gif"                 ? "image/gif"
      : ext === "webp"                ? "image/webp"
      : "image/jpeg";

    const file = objectStorageClient.bucket(BUCKET_ID).file(`images/${fname}`);
    await file.save(buf, {
      metadata:  { contentType },
      resumable: false,
    });

    return res.status(201).json({ path: `/api/images/${fname}` });
  } catch (err) {
    req.log.error({ err }, "Failed to save uploaded image to object storage");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
