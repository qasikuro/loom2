import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import { join } from "path";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkAuth } from "./middleware/auth";

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

// ── Body parsers ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Static uploads ─────────────────────────────────────────────────────────────
app.use("/api/images", express.static(join(process.cwd(), "uploads")));

// ── Auth ───────────────────────────────────────────────────────────────────────
app.use(clerkAuth);

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
