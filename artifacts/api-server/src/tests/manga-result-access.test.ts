import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const fixtures = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  generate: vi.fn(),
  exists: vi.fn(),
  download: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  pool: {
    query: fixtures.query,
    connect: async () => ({ query: fixtures.clientQuery, release: fixtures.release }),
  },
}));
vi.mock("../middleware/auth", () => ({
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.headers["x-test-user"] ? next() : res.status(401).end(),
  getUserId: (req: express.Request) => req.headers["x-test-user"],
}));
vi.mock("../middleware/ai-access", () => ({
  requireAiAccess: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
vi.mock("../lib/featureUsage", () => ({
  getFeatureUsagePolicy: async () => ({
    enabled: true, dailyLimit: null, hourlyLimit: null, dailyBudgetMicros: null,
  }),
}));
vi.mock("@workspace/integrations-openai-ai-server/image", () => ({
  editImageBuffers: fixtures.generate,
}));
vi.mock("../lib/objectStorage", () => ({
  objectStorageClient: {
    bucket: () => ({
      file: () => ({
        exists: fixtures.exists,
        download: fixtures.download,
        save: fixtures.save,
      }),
    }),
  },
}));
vi.mock("sharp", () => ({
  default: () => {
    const pipeline = {
      rotate: () => pipeline,
      resize: () => pipeline,
      flatten: () => pipeline,
      jpeg: () => pipeline,
      composite: () => pipeline,
      png: () => pipeline,
      toBuffer: async () => Buffer.from("test-image"),
    };
    return pipeline;
  },
}));

import router from "../routes/manga-generation";
import { normalizeMediaReference, validateOwnerMediaTicket } from "../lib/mediaAccess";

const generationId = "00000000-0000-4000-8000-000000000001";
const path = `/api/images/manga_${generationId}.png`;
const body = {
  requestId: "saved-request",
  imageUris: ["/api/images/reference.png"],
  prompt: "Test story",
  style: "manga",
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    req.log = { error: vi.fn() } as unknown as typeof req.log;
    next();
  });
  instance.use("/api", router);
  return instance;
}

function assertNativeDownloadUrl(uri: string) {
  // The installed app only appends a cache-buster; it sends no Bearer header.
  const url = new URL(`${uri}&generation=${generationId}`, "https://test.invalid");
  expect(url.pathname).toBe(path);
  expect(validateOwnerMediaTicket(url.searchParams.get("ticket"), path)).toBe("owner");
  expect(validateOwnerMediaTicket(url.searchParams.get("ticket"), "/api/images/other.png")).toBeNull();
  expect(normalizeMediaReference(uri)).toBe(path);
}

describe("manga result read URLs for installed clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SESSION_SECRET", "manga-result-test-secret");
    vi.stubEnv("DEFAULT_OBJECT_STORAGE_BUCKET_ID", "test-bucket");
    fixtures.generate.mockResolvedValue({
      buffer: Buffer.from("generated"),
      usage: { inputTokens: 3, inputImageTokens: 1, inputTextTokens: 2, outputTokens: 5 },
    });
    fixtures.exists.mockResolvedValue([true]);
    fixtures.download.mockResolvedValue([Buffer.from("reference")]);
    fixtures.save.mockResolvedValue(undefined);
    fixtures.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT byte_size")) return { rowCount: 1, rows: [{ byte_size: 9 }] };
      if (sql.includes("COUNT")) return { rowCount: 1, rows: [{ count: 1 }] };
      return { rowCount: 1, rows: [] };
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["success", "pending"])("returns a signed URL when recovering a %s request without calling AI", async status => {
    fixtures.clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("WHERE request_id")) {
        expect(params).toEqual([body.requestId, "owner"]);
        return { rowCount: 1, rows: [{ id: generationId, status, image_uri: status === "success" ? path : null }] };
      }
      return { rowCount: 0, rows: [] };
    });
    const response = await request(app()).post("/api/manga/generate").set("x-test-user", "owner").send(body);
    expect(response.status).toBe(200);
    expect(response.body.generationId).toBe(generationId);
    assertNativeDownloadUrl(response.body.imageUri);
    expect(fixtures.generate).not.toHaveBeenCalled();
    expect(fixtures.save).not.toHaveBeenCalled();
    expect(fixtures.release).toHaveBeenCalledOnce();
    if (status === "pending") {
      expect(fixtures.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE manga_generations"),
        [path, generationId],
      );
    }
  });

  it("signs a new result while persisting only its canonical path", async () => {
    fixtures.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO manga_generations")) return { rowCount: 1, rows: [{ id: generationId }] };
      if (sql.includes("daily_count")) return { rowCount: 1, rows: [{ daily_count: 0, hourly_count: 0 }] };
      return { rowCount: 0, rows: [] };
    });
    const response = await request(app()).post("/api/manga/generate").set("x-test-user", "owner").send(body);
    expect(response.status).toBe(200);
    assertNativeDownloadUrl(response.body.imageUri);
    expect(fixtures.generate).toHaveBeenCalledOnce();
    expect(fixtures.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE manga_generations"),
      [
        path,
        expect.any(String),
        expect.any(String),
        JSON.stringify({ inputTokens: 3, inputImageTokens: 1, inputTextTokens: 2, outputTokens: 5 }),
        220,
        body.requestId,
        "owner",
      ],
    );
    expect(fixtures.save).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ metadata: { contentType: "image/png", metadata: { ownerUserId: "owner" } } }),
    );
  });
});