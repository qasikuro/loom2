import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import { join } from "path";
import { access } from "fs/promises";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { objectStorageClient } from "./lib/objectStorage";

const app: Express = express();

const isDev = process.env.NODE_ENV !== "production";

// ── Security headers ───────────────────────────────────────────────────────────
// Disable CSP + COEP so the API can be called from Expo web previews.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// ── Request logging ────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS ───────────────────────────────────────────────────────────────────────
// Native Expo requests have no Origin header — they always pass through.
// Expo web in dev preview and published prod both come from REPLIT_DOMAINS.
const allowedOrigins = (process.env.REPLIT_DOMAINS ?? "")
  .split(",")
  .filter(Boolean)
  .map((d) => `https://${d.trim()}`);

app.use(
  cors({
    origin: isDev
      ? true
      : (origin, cb) => {
          if (!origin) return cb(null, true);
          if (allowedOrigins.some((o) => origin.startsWith(o))) return cb(null, true);
          cb(new Error("CORS: origin not allowed"));
        },
    credentials: true,
  }),
);

// ── Rate limiting ──────────────────────────────────────────────────────────────
// Skip rate limiting in development. In production, 500 req / 15 min per IP.
app.use(
  rateLimit({
    windowMs:        15 * 60 * 1000,
    limit:           500,
    standardHeaders: "draft-7",
    legacyHeaders:   false,
    message: { error: "Too many requests, please try again later." },
    skip: () => isDev,
  }),
);

// ── Clerk proxy (must be before body parsers — streams raw bytes) ──────────────
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ── Body parsers ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Image serving: local disk fallback → GCS ──────────────────────────────────
// New uploads go to GCS. Old local files are served from disk as a fallback
// so existing database URLs keep working without a forced re-upload.
const UPLOAD_DIR    = join(process.cwd(), "uploads");
const GCS_BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";

app.get("/api/images/:filename", async (req: Request, res: Response) => {
  const fname = String(req.params.filename ?? "");
  if (!/^[\w.-]+$/.test(fname)) return res.status(400).end();

  // 1. Try local disk (legacy uploads that predate GCS migration)
  const localPath = join(UPLOAD_DIR, fname);
  try {
    await access(localPath);
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    return res.sendFile(localPath);
  } catch { /* not on disk — fall through to GCS */ }

  // 2. Try GCS — stream directly (one roundtrip instead of exists + getMetadata + read)
  if (!GCS_BUCKET_ID) return res.status(404).end();
  try {
    const file   = objectStorageClient.bucket(GCS_BUCKET_ID).file(`images/${fname}`);
    const [meta] = await file.getMetadata();
    res.setHeader("Content-Type", (meta.contentType as string) || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    file.createReadStream().pipe(res);
  } catch (err: any) {
    // GCS returns 404 when the object doesn't exist
    if (err?.code === 404 || err?.code === "404") return res.status(404).end();
    return res.status(404).end();
  }
});

// ── Auth ───────────────────────────────────────────────────────────────────────
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// ── API routes ─────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 404 handler ────────────────────────────────────────────────────────────────
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ────────────────────────────────────────────────────────
// Must have 4 parameters for Express to recognise it as an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  (req as any).log?.error({ err }, "Unhandled error");
  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    error: "Internal server error",
    ...(isDev && { message: err.message }),
  });
});

export default app;
