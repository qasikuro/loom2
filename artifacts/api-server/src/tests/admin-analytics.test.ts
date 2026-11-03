import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, characterTable } from "@workspace/db";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next(),
  getAuth: (req: { headers: Record<string, string | string[] | undefined> }) => ({
    userId: req.headers["x-test-user-id"] ?? null,
  }),
  clerkClient: { users: { getUser: async () => null } },
}));

import adminAnalyticsRouter from "../routes/admin-analytics";

const ADMIN_ID = `test-admin-analytics-${randomUUID()}`;
const app = express();
app.use(express.json());
app.use("/", adminAnalyticsRouter);

describe("GET /admin/analytics", () => {
  beforeAll(async () => {
    await db.insert(characterTable).values({ userId: ADMIN_ID, isAdmin: true });
  });

  afterAll(async () => {
    await db.delete(characterTable).where(eq(characterTable.userId, ADMIN_ID));
  });

  it("requires admin access", async () => {
    const response = await request(app).get("/admin/analytics?days=7");
    expect(response.status).toBe(401);
  });

  it("rejects ranges outside the supported period", async () => {
    const response = await request(app)
      .get("/admin/analytics?days=91")
      .set("x-test-user-id", ADMIN_ID);
    expect(response.status).toBe(400);
  });

  it("returns real aggregates and explicitly unavailable metrics", async () => {
    const response = await request(app)
      .get("/admin/analytics?days=1")
      .set("x-test-user-id", ADMIN_ID);

    expect(response.status).toBe(200);
    expect(response.body.periodDays).toBe(1);
    expect(response.body.daily).toHaveLength(1);
    expect(response.body.metrics.totalUsers).toBeGreaterThanOrEqual(1);
    expect(response.body.metrics.newUsers).toBeNull();
    expect(response.body.metrics.shares).toBeNull();
    expect(response.body.metrics.videoUploads).toBeNull();
    expect(response.body.features.friends).toBeNull();
    expect(response.body.features.search).toBeNull();
    expect(response.body.topContent.length).toBeLessThanOrEqual(10);
  });
});
