import express from "express";
import { vi } from "vitest";

/**
 * Mutable userId that tests can override before each request.
 * The mocked auth middleware reads from this reference.
 */
export let currentTestUserId = "test-user-alice";

export function setTestUserId(id: string) {
  currentTestUserId = id;
}

/**
 * Mock @clerk/express before the router is imported.
 * clerkMiddleware → no-op, getAuth → returns currentTestUserId.
 */
vi.mock("@clerk/express", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAuth:         (_req: any) => ({ userId: currentTestUserId }),
}));

/**
 * Mock side-effect services so tests don't touch rewards DB,
 * constellation syncing, or push-notification infrastructure.
 */
vi.mock("../../services/rewardService", () => ({
  grantReward: vi.fn().mockResolvedValue({ granted: false, amounts: {} }),
}));

vi.mock("../../services/constellationService", () => ({
  syncConstellation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/pushService", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
  sendPushToTokens: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Mock in-process cache so discover tests always see a fresh response
 * (avoids cached results bleeding between tests).
 */
vi.mock("../../lib/cache", () => {
  const store = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    get:       (key: string) => {
      const entry = store.get(key);
      if (!entry || Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set:       vi.fn((key: string, value: unknown, ttlMs: number) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }),
    invalidate: (prefix: string) => {
      for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
    },
    size: () => store.size,
  };
});

import socialRouter from "../../routes/social";
import storiesRouter from "../../routes/stories";
import outfitsRouter from "../../routes/outfits";

export function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", socialRouter);
  app.use("/api", storiesRouter);
  app.use("/api", outfitsRouter);
  return app;
}
