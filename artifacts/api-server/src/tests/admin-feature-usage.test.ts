import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, characterTable, mangaGenerationsTable } from "@workspace/db";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next(),
  getAuth: (req: { headers: Record<string, string | string[] | undefined> }) => ({
    userId: req.headers["x-test-user-id"] ?? null,
  }),
  clerkClient: { users: { getUser: async () => null } },
}));

import { normalizeFeatureUsageControls } from "../lib/featureUsage";
import adminFeatureUsageRouter from "../routes/admin-feature-usage";

const ADMIN_ID = `test-admin-feature-usage-${randomUUID()}`;
const MANGA_USER_ID = `test-manga-usage-${randomUUID()}`;
const app = express();
app.use(express.json());
app.use("/", adminFeatureUsageRouter);

describe("admin feature usage", () => {
  beforeAll(async () => {
    await db.insert(characterTable).values([
      { userId: ADMIN_ID, isAdmin: true },
      { userId: MANGA_USER_ID, username: "manga-cost-test", name: "Manga Cost Test" },
    ]);
    await db.insert(mangaGenerationsTable).values([
      {
        requestId: `success-${randomUUID()}`,
        userId: MANGA_USER_ID,
        style: "manga",
        prompt: "",
        imageCount: 1,
        model: "test-model",
        quality: "high",
        outputSize: "1024x1536",
        status: "success",
        estimatedCostMicros: 260_000,
        providerUsage: {
          inputTokens: 3,
          inputImageTokens: 1,
          inputTextTokens: 2,
          outputTokens: 5,
        },
        providerCostMicros: 220,
      },
      {
        requestId: `failed-${randomUUID()}`,
        userId: MANGA_USER_ID,
        style: "manga",
        prompt: "",
        imageCount: 1,
        model: "test-model",
        quality: "high",
        outputSize: "1024x1536",
        status: "failed",
        estimatedCostMicros: 260_000,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(mangaGenerationsTable).where(eq(mangaGenerationsTable.userId, MANGA_USER_ID));
    await db.delete(characterTable).where(eq(characterTable.userId, ADMIN_ID));
    await db.delete(characterTable).where(eq(characterTable.userId, MANGA_USER_ID));
  });

  it("keeps configurable estimates unset until an admin supplies them", () => {
    const defaults = normalizeFeatureUsageControls(null);
    expect(defaults.stories.costPerActionMicros).toBeNull();
    expect(defaults.stories.dailyBudgetMicros).toBeNull();
  });

  it("requires admin access and returns a real usage overview", async () => {
    const denied = await request(app).get("/admin/feature-usage?days=7");
    expect(denied.status).toBe(401);

    const response = await request(app)
      .get("/admin/feature-usage?days=7")
      .set("x-test-user-id", ADMIN_ID);

    expect(response.status).toBe(200);
    expect(response.body.periodDays).toBe(7);
    expect(response.body.features.some((feature: { featureKey: string }) => feature.featureKey === "stories")).toBe(true);
    expect(Array.isArray(response.body.daily)).toBe(true);
    expect(Array.isArray(response.body.topUsers)).toBe(true);
    expect(Array.isArray(response.body.mangaGenerationUsers)).toBe(true);
    expect(response.body.mangaGenerationUsers).toContainEqual(expect.objectContaining({
      userId: MANGA_USER_ID,
      name: "manga-cost-test",
      attempts: 2,
      successful: 1,
      failed: 1,
      pending: 0,
      estimatedCostMicros: 520_000,
      usagePricedAttempts: 1,
      usageUnpricedSuccesses: 0,
      providerUsageCostMicros: 220,
    }));
  });

  it("does not allow an admin to replace the recorded image-generation estimate", async () => {
    const response = await request(app)
      .put("/admin/feature-usage/image-generation")
      .set("x-test-user-id", ADMIN_ID)
      .send({
        enabled: true,
        hourlyLimit: null,
        dailyLimit: null,
        dailyBudgetMicros: null,
        costPerActionMicros: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/recorded by the server/i);
  });
});