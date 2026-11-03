import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

router.get("/admin/api-status", requireAdmin, async (req: Request, res: Response) => {
  const checkedAt = new Date().toISOString();
  const startedAt = performance.now();
  let database: "ok" | "unavailable" = "ok";
  let databaseLatencyMs: number | null = null;

  try {
    await pool.query("SELECT 1");
    databaseLatencyMs = Math.round(performance.now() - startedAt);
  } catch (error) {
    database = "unavailable";
    req.log.error({ err: error }, "Admin API status database probe failed");
  }

  res.set("Cache-Control", "no-store").json({
    api: "ok",
    database,
    databaseLatencyMs,
    checkedAt,
  });
});

export default router;
