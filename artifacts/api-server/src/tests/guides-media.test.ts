import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { db, characterTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { createTestApp, setTestUserId } from "./helpers/testApp";
import guidesRouter from "../routes/guides";

const app = createTestApp();
app.use("/api", guidesRouter);

const prefix = `test-guide-media-${randomUUID()}`;
const legacyId = `${prefix}-legacy`;
const externalId = `${prefix}-external`;
const externalAvatar = "https://cdn.example.com/api/images/external-avatar.jpg";
type Guide = { userId: string; avatarUri: string | null };

beforeAll(async () => {
  await db.insert(characterTable).values([
    {
      userId: legacyId, name: "Legacy guide", mood: "Hopeful",
      isGuide: true, isPublic: true, isBanned: false,
      avatarUri: "https://old-guide-workspace.pike.replit.dev/api/images/legacy-guide.jpg?ticket=expired",
    },
    {
      userId: externalId, name: "External guide", mood: "Hopeful",
      isGuide: true, isPublic: true, isBanned: false,
      avatarUri: externalAvatar,
    },
  ]);
});

afterAll(async () => {
  await db.delete(characterTable).where(inArray(characterTable.userId, [legacyId, externalId]));
});

describe("guide avatar responses", () => {
  it("canonicalizes historical managed avatars without changing external images", async () => {
    setTestUserId("test-guide-media-viewer");
    const response = await request(app).get("/api/guides");
    expect(response.status).toBe(200);
    const guides = response.body as Guide[];
    expect(guides.find(guide => guide.userId === legacyId)?.avatarUri).toBe("/api/images/legacy-guide.jpg");
    expect(guides.find(guide => guide.userId === externalId)?.avatarUri).toBe(externalAvatar);
  });

  it("returns a full guide list even when the client sends its previous ETag", async () => {
    setTestUserId("test-guide-media-viewer");
    const first = await request(app).get("/api/guides");
    expect(first.status).toBe(200);
    const second = await request(app).get("/api/guides").set("If-None-Match", first.headers.etag);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(second.headers["cache-control"]).toContain("no-store");
  });

  it("also canonicalizes the guide profile and returns JSON for conditional requests", async () => {
    setTestUserId("test-guide-media-viewer");
    const first = await request(app).get(`/api/guides/${legacyId}`);
    expect(first.status).toBe(200);
    expect(first.body.avatarUri).toBe("/api/images/legacy-guide.jpg");
    const second = await request(app).get(`/api/guides/${legacyId}`).set("If-None-Match", first.headers.etag);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });
});