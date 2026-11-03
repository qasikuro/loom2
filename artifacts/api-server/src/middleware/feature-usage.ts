import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import {
  admitAndRecordFeatureRequest,
  type FeatureUsageKey,
} from "../lib/featureUsage";

const FEATURE_PATHS: Array<{ prefix: string; key: FeatureUsageKey }> = [
  { prefix: "/ai/story-assist", key: "ai-assist" },
  { prefix: "/drift", key: "drift-ai" },
  { prefix: "/stories", key: "stories" },
  { prefix: "/journal", key: "journals" },
  { prefix: "/messages", key: "messaging" },
  { prefix: "/campfire", key: "campfire" },
  { prefix: "/books", key: "books" },
  { prefix: "/book-reader", key: "books" },
  { prefix: "/chapters", key: "books" },
  { prefix: "/discover", key: "discovery" },
  { prefix: "/outfits", key: "outfits" },
  { prefix: "/gallery", key: "gallery" },
  { prefix: "/upload", key: "uploads" },
  { prefix: "/uploads", key: "uploads" },
  { prefix: "/friends", key: "community" },
  { prefix: "/friend-requests", key: "community" },
  { prefix: "/follows", key: "community" },
  { prefix: "/users", key: "community" },
];

function featureForPath(path: string): FeatureUsageKey | undefined {
  const normalized = path.startsWith("/api/") ? path.slice(4) : path;
  return FEATURE_PATHS.find(({ prefix }) =>
    normalized === prefix || normalized.startsWith(`${prefix}/`),
  )?.key;
}

export async function featureUsageMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method === "OPTIONS" || req.method === "HEAD") return next();
  // Privacy controls and hydration must not consume AI quota.
  if (req.path === "/drift/companion-state" || req.path === "/api/drift/companion-state") return next();
  const featureKey = featureForPath(req.path);
  // Image generation has an idempotent reservation ledger of its own. It is
  // enforced and reported from manga_generations rather than double-counted.
  if (!featureKey) return next();

  let userId: string | null;
  try {
    userId = getAuth(req).userId ?? null;
  } catch {
    return next();
  }
  if (!userId) return next();

  // Presence and room polling are not feature actions; count them neither
  // against a user's cap nor in admin usage totals.
  if (featureKey === "campfire" && req.method === "GET" && /\/(presence|members)(\/|$)/.test(req.path)) {
    return next();
  }

  try {
    const decision = await admitAndRecordFeatureRequest(userId, featureKey);
    if (!decision.allowed) {
      if (decision.retryAfterSeconds) {
        res.setHeader("Retry-After", String(decision.retryAfterSeconds));
      }
      return res.status(decision.status).json({ error: decision.message });
    }
    return next();
  } catch (error) {
    req.log.error({ err: error, featureKey }, "Feature usage admission failed");
    return res.status(503).json({ error: "Usage controls are temporarily unavailable." });
  }
}