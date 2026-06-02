/**
 * GET /api/stream
 *
 * Server-Sent Events endpoint. Keeps the connection open and pushes events to
 * subscribed channels.
 *
 * Query params:
 *   channels  — comma-separated list of channel ids, e.g.
 *               "messages:userId123,campfire:roomId456"
 *
 * Channel security:
 *   messages:<id>  — only the authenticated user may subscribe to their own id
 *   campfire:<id>  — any authenticated user may subscribe (room is public)
 *
 * Event wire format (each SSE event):
 *   data: {"channel":"<channel>","data":<payload>}
 */

import { Router, type Request, type Response } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import {
  addSSEClient,
  removeSSEClient,
  connectedClientCount,
} from "../lib/sseEmitter";
import { logger } from "../lib/logger";

const router = Router();

router.get("/stream", requireAuth, (req: Request, res: Response) => {
  const userId = getUserId(req);

  const rawChannels = String(req.query.channels ?? "");
  const channels = rawChannels
    .split(",")
    .map((c) => c.trim())
    .filter((c) => {
      if (!c) return false;
      const [type, id] = c.split(":");
      if (type === "messages") return id === userId;
      if (type === "campfire") return typeof id === "string" && id.length > 0;
      return false;
    });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`:connected\n\n`);

  const clientId = addSSEClient(res, channels, userId);
  logger.info({ userId, channels, clientId, total: connectedClientCount() }, "SSE client connected");

  const heartbeat = setInterval(() => {
    try {
      res.write(`:ping\n\n`);
    } catch {
      clearInterval(heartbeat);
      removeSSEClient(clientId);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSSEClient(clientId);
    logger.info({ clientId, total: connectedClientCount() }, "SSE client disconnected");
  });
});

export default router;
