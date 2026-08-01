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
          // Log auth header presence so we can diagnose token issues in APK builds
          hasAuth: !!req.headers?.authorization,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
          // Clerk sets these on every rejected token — log them so the exact
          // reason (expired, wrong-issuer, etc.) is visible in prod logs.
          clerkAuthStatus: res.getHeader?.("x-clerk-auth-status") ?? undefined,
          clerkAuthReason: res.getHeader?.("x-clerk-auth-reason") ?? undefined,
        };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // GCS returns 404 when the object doesn't exist
    if (err?.code === 404 || err?.code === "404") return res.status(404).end();
    return res.status(404).end();
  }
});

// ── Auth ───────────────────────────────────────────────────────────────────────
// Wrap clerkMiddleware() so we can trace every step of the auth pipeline.
// This answers the exact question: "where does Clerk lose the token?"
//
// Step 1 — log the raw Authorization header before Clerk sees it.
// Step 2 — run clerkMiddleware(), then log what it placed on req.auth.
// Step 3 — logged inside requireAuth (auth.ts) after getAuth() is called.
// Step 4 — logged inside requireAuth when userId is null → 401.
//
// Field names deliberately differ from req.headers.authorization so pino's
// redact list does not strip them.
//
// REMOVE these wrappers once the token-rejection root cause is confirmed.
// Resolve the publishable key from the incoming request host so the same
// server binary can serve both dev (pk_test) and prod (pk_live) — Replit
// automatically swaps the key at publish time, and publishableKeyFromHost
// maps the incoming Host header to the correct Clerk instance.
const clerkMw = clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(
    getClerkProxyHost(req) ?? "",
    process.env.CLERK_PUBLISHABLE_KEY,
  ),
}));
app.use((req: Request, res: Response, next: NextFunction) => {
  // Step 1 — request received, before Clerk.
  const authHeader = req.headers.authorization as string | undefined;
  logger.info({
    path: req.path,
    hasAuthHeader: !!authHeader,
    // First 50 chars — enough to confirm "Bearer eyJ..." JWT format without leaking the full token.
    authPreview: authHeader?.substring(0, 50) ?? null,
  }, '[CLERK-TRACE-1] request received — pre-clerkMiddleware');

  clerkMw(req, res, (err?: unknown) => {
    if (err) {
      logger.error({ err }, '[CLERK-TRACE-2] clerkMiddleware() called next(err) — middleware threw');
      return next(err);
    }

    // Step 2 — read what clerkMiddleware() placed on req.auth.
    let clerkUserId: string | null = null;
    let clerkSessionId: string | null = null;
    let clerkStateErr: string | null = null;
    try {
      // In @clerk/express v2, req.auth is a function that returns the auth object.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authState = (req as any).auth?.();
      clerkUserId    = authState?.userId    ?? null;
      clerkSessionId = authState?.sessionId ?? null;
    } catch (e) {
      clerkStateErr = String(e);
    }

    logger.info({
      clerkUserId,
      clerkSessionId,
      clerkStateErr,
      hasAuthHeader: !!(req.headers.authorization),
    }, '[CLERK-TRACE-2] clerkMiddleware() completed — post-middleware auth state');

    next();
  });
});

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).log?.error({ err }, "Unhandled error");
  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    error: "Internal server error",
    ...(isDev && { message: err.message }),
  });
});

export default app;
