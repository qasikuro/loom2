import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { Router, type IRouter } from "express";
import { z } from "zod";

const UPLOAD_DIR = join(process.cwd(), "uploads");

const UploadSchema = z.object({
  data: z.string().min(1),
  ext:  z.string().regex(/^[a-z0-9]+$/).default("jpg"),
});

const router: IRouter = Router();

router.post("/upload", async (req, res) => {
  const parsed = UploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const { data, ext } = parsed.data;
    const raw     = data.replace(/^data:[^;]+;base64,/, "");
    const buf     = Buffer.from(raw, "base64");
    const fname   = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

    await writeFile(join(UPLOAD_DIR, fname), buf);

    return res.status(201).json({ path: `/api/images/${fname}` });
  } catch (err) {
    req.log.error({ err }, "Failed to save uploaded image");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
