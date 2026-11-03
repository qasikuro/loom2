import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { characterTable, db, storiesTable } from "@workspace/db";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next(),
  getAuth: (req: { headers: Record<string, string | string[] | undefined> }) => ({
    userId: req.headers["x-test-user-id"] ?? null,
  }),
  clerkClient: { users: { getUser: async () => null } },
}));

import adminRouter from "../routes/admin";
import adminApiStatusRouter from "../routes/admin-api-status";

const ADMIN_ID = `test-admin-api-status-${randomUUID()}`;
const STORY_ID = randomUUID();
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  Object.assign(req, { log: { error: vi.fn() } });
  next();
});
app.use("/", adminRouter);
app.use("/", adminApiStatusRouter);

describe("admin content preview and API status", () => {
  beforeAll(async () => {
    await db.insert(characterTable).values({ userId: ADMIN_ID, name: "API Status Admin", isAdmin: true });
    await db.insert(storiesTable).values({
      id: STORY_ID,
      userId: ADMIN_ID,
      chapterTitle: "Page based test story",
      description: "Page preview test",
      mood: "Calm",
      isPublic: true,
      date: new Date(),
      panels: [],
      pages: [{
        id: "page-1",
        layoutKey: "single",
        panels: [{
          id: "panel-1",
          text: "Page content",
          imageUri: "https://old-workspace.replit.dev/api/images/page-panel.jpg",
        }],
      }],
    });
  });

  afterAll(async () => {
    await db.delete(storiesTable).where(eq(storiesTable.id, STORY_ID));
    await db.delete(characterTable).where(eq(characterTable.userId, ADMIN_ID));
  });

  it("returns page-based panels and canonicalizes historical managed-media URLs", async () => {
    const response = await request(app)
      .get("/admin/content?type=stories")
      .set("x-test-user-id", ADMIN_ID);

    expect(response.status).toBe(200);
    const story = response.body.items.find((item: { id: string }) => item.id === STORY_ID);
    expect(story.pages[0].panels[0]).toMatchObject({
      text: "Page content",
      imageUri: "/api/images/page-panel.jpg",
    });
  });

  it("protects the API status check and returns a live database probe", async () => {
    expect((await request(app).get("/admin/api-status")).status).toBe(401);

    const response = await request(app)
      .get("/admin/api-status")
      .set("x-test-user-id", ADMIN_ID);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ api: "ok", database: "ok" });
    expect(response.body.databaseLatencyMs).toEqual(expect.any(Number));
    expect(new Date(response.body.checkedAt).toString()).not.toBe("Invalid Date");
  });
});
