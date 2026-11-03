import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { GetAppConfigResponse } from "@workspace/api-zod";
import router from "./routes";
import { logger } from "./lib/logger";
import { getFeatureUsagePolicy } from "./lib/featureUsage";
import { featureUsageMiddleware } from "./middleware/feature-usage";
import supportFeedbackRouter from "./routes/support-feedback";
import storigamInterestRouter from "./routes/storigam-interest";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

const isDev = process.env.NODE_ENV !== "production";

// Replit forwards the originating client address in X-Forwarded-For. Trust the
// single deployment ingress hop so IP-based limits apply per client instead of
// grouping every visitor behind the same proxy address.
app.set("trust proxy", 1);

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
// Global limit: 1 MB. The upload route handles its own 10 MB JSON body parser
// (to accommodate base64 image payloads) via route-level middleware, so we skip
// the global parsers for that path to avoid a 413 before the route runs.
const skipForUpload = (fn: express.RequestHandler): express.RequestHandler =>
  (req, res, next) => (
    req.path === '/api/upload' || req.path === '/api/upload-video'
      ? next()
      : fn(req, res, next)
  );
app.use(skipForUpload(express.json({ limit: "1mb" })));
app.use(skipForUpload(express.urlencoded({ extended: true, limit: "1mb" })));

// Feedback is intentionally public so visitors can contact support without an account.
app.use("/api", supportFeedbackRouter);
// The beta-interest form is also a public website flow; mount it before Clerk
// so anonymous visitors can submit without an account or session.
app.use("/api", storigamInterestRouter);

// ── Auth ───────────────────────────────────────────────────────────────────────
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
// Never decode or log bearer tokens, token claims, or session identifiers.
app.use(clerkMw);

// ── Public app config (feature flags, maintenance mode, min version) ──────────
// The mobile app calls this on startup to receive server-controlled settings.
const DEFAULT_APP_FEATURES: Record<string, boolean> = {
  ai: true,
  stories: true,
  music: true,
  shop: true,
  season: true,
  shop_button: false,
  season_button: false,
  campfire: true,
  guides: true,
  notifications: true,
  image_generation: true,
};

function normalizeAppFeatures(value: unknown): Record<string, boolean> {
  const saved = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_APP_FEATURES).map(([key, fallback]) => [
      key,
      typeof saved[key] === "boolean" ? saved[key] : fallback,
    ]),
  );
}

app.get("/api/config", async (_req: Request, res: Response) => {
  try {
    const { db, appSettingsTable } = await import("@workspace/db");
    const [rows, imageGenerationPolicy] = await Promise.all([
      db.select().from(appSettingsTable),
      getFeatureUsagePolicy("image-generation"),
    ]);
    const cfg: Record<string, unknown> = {};
    for (const row of rows) cfg[row.key] = row.value;
    // safe defaults if table is empty / row missing
    if (!("maintenance_mode" in cfg)) cfg.maintenance_mode = false;
    if (!("min_app_version"  in cfg)) cfg.min_app_version  = "1.0.0";
    const features = normalizeAppFeatures(cfg.features);
    // The image-generation usage policy is the creator's own availability switch.
    // Keep it separate from the global AI Access flag in Admin Settings.
    features.image_generation = imageGenerationPolicy.enabled;
    cfg.features = features;
    res.setHeader("Cache-Control", "no-store");
    return res.json(GetAppConfigResponse.parse(cfg));
  } catch (err) {
    logger.error({ err }, "GET /api/config failed");
    // Reject failed reads: clients retain their last good config instead of
    // replacing hidden/disabled flags with fabricated success defaults.
    return res.status(503).json({ error: "App configuration is temporarily unavailable." });
  }
});

// ── Landing page ───────────────────────────────────────────────────────────────
const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Storigam — The friendships were real.</title>
<meta name="description" content="Storigam is the social home for people who found their people inside a game. Keep what mattered. Tell it well."/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    background:#0b0d1a;
    color:#e8e0d5;
    font-family:'Inter',sans-serif;
    min-height:100vh;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    position:relative;
  }
  canvas#stars{position:fixed;inset:0;z-index:0;pointer-events:none}
  nav{
    position:fixed;top:0;left:0;right:0;
    display:flex;align-items:center;justify-content:space-between;
    padding:24px 40px;z-index:10;
  }
  .logo{font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:700;color:#e8e0d5;letter-spacing:-0.5px}
  .logo span{color:#c87941}
  .badge{
    font-size:0.7rem;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;
    color:#c87941;display:flex;align-items:center;gap:6px;
  }
  .badge::before{content:'✦';font-size:0.6rem}
  main{
    position:relative;z-index:5;
    display:flex;flex-direction:column;align-items:center;
    text-align:center;padding:0 24px;max-width:680px;
  }
  h1{
    font-family:'Playfair Display',serif;
    font-size:clamp(2.4rem,7vw,4.2rem);
    font-weight:400;line-height:1.12;
    color:#e8e0d5;margin-bottom:0.1em;
  }
  h1 em{
    display:block;font-style:italic;color:#c87941;
    font-size:clamp(2.6rem,7.5vw,4.4rem);
  }
  p.sub{
    margin-top:28px;
    font-size:1rem;font-weight:300;line-height:1.7;
    color:#b0a898;max-width:480px;
  }
  .cta-area{margin-top:44px;display:flex;flex-direction:column;align-items:center;gap:12px}
  a.download-btn{
    display:inline-flex;align-items:center;gap:10px;
    background:#c87941;color:#fff;
    font-family:'Inter',sans-serif;font-size:1rem;font-weight:500;
    padding:16px 36px;border-radius:50px;
    text-decoration:none;letter-spacing:0.01em;
    box-shadow:0 4px 32px rgba(200,121,65,0.35);
    transition:transform 0.18s ease,box-shadow 0.18s ease;
  }
  a.download-btn:hover{transform:translateY(-2px);box-shadow:0 8px 40px rgba(200,121,65,0.5)}
  a.download-btn svg{width:18px;height:18px;fill:currentColor}
  .platform-note{font-size:0.78rem;color:#6b6358;letter-spacing:0.04em;text-transform:uppercase}
  .orb{
    position:fixed;width:320px;height:320px;border-radius:50%;
    background:radial-gradient(circle,rgba(200,121,65,0.18) 0%,transparent 70%);
    left:-80px;bottom:-80px;z-index:0;pointer-events:none;
    animation:pulse 6s ease-in-out infinite;
  }
  @keyframes pulse{0%,100%{transform:scale(1);opacity:0.7}50%{transform:scale(1.15);opacity:1}}
</style>
</head>
<body>
<canvas id="stars"></canvas>
<div class="orb"></div>
<nav>
  <div class="logo">stori<span>gam</span></div>
  <div class="badge">Now Available</div>
</nav>
<main>
  <h1>The friendships were real.<em>So are the memories.</em></h1>
  <p class="sub">Storigam is the social home for people who found their people inside a game. Keep what mattered. Tell it well. Read the stories of everyone still out there flying.</p>
  <div class="cta-area">
    <a class="download-btn" href="https://drive.google.com/file/d/1SfVduWZ-0PtBksrkYe-R2WQ4Y-Z6lS44/view?usp=drivesdk" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm-1 14.17l-3.59-3.58 1.42-1.42L11 13.34V7h2v6.34l2.17-2.17 1.42 1.42L13 16.17l-1 1z"/></svg>
      Download Now
    </a>
    <span class="platform-note">Android only</span>
  </div>
</main>
<script>
  const c=document.getElementById('stars'),ctx=c.getContext('2d');
  let W,H,stars=[];
  function resize(){W=c.width=window.innerWidth;H=c.height=window.innerHeight;init()}
  function init(){stars=[];for(let i=0;i<180;i++)stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.2+0.2,o:Math.random(),s:Math.random()*0.005+0.001,d:Math.random()>0.5?1:-1})}
  function draw(){
    ctx.clearRect(0,0,W,H);
    for(const s of stars){
      s.o+=s.s*s.d;
      if(s.o>1||s.o<0)s.d*=-1;
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle=\`rgba(232,224,213,\${s.o})\`;ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize',resize);resize();draw();
</script>
</body>
</html>`;

app.get("/", (req: Request, res: Response) => {
  // Custom domains attach to the whole published project, not a single artifact.
  // Serve the Storigam landing page at its canonical www root without moving the
  // landing artifact or taking the root path away from the Expo artifact.
  const host = req.get("host")?.split(":")[0]?.toLowerCase();
  if (host === "storigam.com") {
    res.setHeader("Cache-Control", "no-store");
    res.redirect(301, "https://www.storigam.com/");
    return;
  }
  if (host === "www.storigam.com") {
    res.setHeader("Cache-Control", "no-store");
    const landingIndexPath = process.env.STORIGAM_ROOT_LANDING_INDEX
      ? path.resolve(process.env.STORIGAM_ROOT_LANDING_INDEX)
      : fileURLToPath(new URL("./storigam-landing-index.html", import.meta.url));
    res.type("html").send(readFileSync(landingIndexPath, "utf8"));
    return;
  }
  if (host === "myadmin.storigam.com") {
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, "/admin/");
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(LANDING_HTML);
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use("/api", featureUsageMiddleware);
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
