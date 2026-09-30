import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  badges: [] as Array<Record<string, unknown>>,
  aclPolicies: new Map<string, { owner: string; visibility: "public" | "private" } | null>(),
  setAcl: vi.fn(),
  uploadCount: 0,
  lastUpdate: null as Record<string, unknown> | null,
}));

vi.mock("@workspace/db", async () => {
  const actual = await vi.importActual<typeof import("@workspace/db")>("@workspace/db");
  const makeQuery = (result: unknown[]) => {
    const query: Record<string, unknown> = {};
    for (const method of ["from", "where", "limit", "orderBy", "groupBy"]) {
      query[method] = () => query;
    }
    query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return query;
  };
  return {
    ...actual,
    db: {
      select: () => makeQuery(fixtures.badges),
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          returning: async () => {
            const badge = { id: "badge-test-id", ...values };
            fixtures.badges.push(badge);
            return [badge];
          },
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          fixtures.lastUpdate = values;
          return {
            where: () => ({
              returning: async () => [{ id: "badge-test-id", ...values }],
            }),
          };
        },
      }),
    },
  };
});

vi.mock("../middleware/auth", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  getUserId: (req: { headers: Record<string, string> }) => req.headers["x-test-user"] ?? "admin-user",
}));

vi.mock("../services/pushService", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  ObjectStorageService: class {
    async getObjectEntityUploadURL() {
      fixtures.uploadCount += 1;
      const id = `00000000-0000-4000-8000-${String(fixtures.uploadCount).padStart(12, "0")}`;
      return `https://storage.googleapis.com/test-bucket/private/uploads/${id}`;
    }
    normalizeObjectEntityPath(rawPath: string) {
      if (rawPath.startsWith("/objects/")) return rawPath;
      try {
        const pathname = new URL(rawPath).pathname;
        const marker = "/private/uploads/";
        const offset = pathname.indexOf(marker);
        if (offset >= 0) return `/objects/uploads/${pathname.slice(offset + marker.length)}`;
      } catch {
        return rawPath;
      }
      return rawPath;
    }
    async getObjectEntityFile(objectPath: string) {
      if (!objectPath.startsWith("/objects/uploads/")) throw new Error("missing");
      return { objectPath };
    }
    async trySetObjectEntityAclPolicy(
      objectPath: string,
      policy: { owner: string; visibility: "public" | "private" },
    ) {
      fixtures.setAcl(objectPath, policy);
      fixtures.aclPolicies.set(objectPath, policy);
      return objectPath;
    }
  },
}));

vi.mock("../lib/objectAcl", () => ({
  getObjectAclPolicy: async (file: { objectPath: string }) => fixtures.aclPolicies.get(file.objectPath) ?? null,
}));

import adminBadgesRouter from "../routes/admin-badges";
import { isPendingBadgeUploadOwner } from "../lib/badgeUploadRegistry";

const app = express();
app.use(express.json());
app.use("/api", adminBadgesRouter);

beforeEach(() => {
  fixtures.badges.length = 0;
  fixtures.aclPolicies.clear();
  fixtures.setAcl.mockReset();
  fixtures.lastUpdate = null;
});

afterEach(() => vi.useRealTimers());

describe("admin badge image assignment", () => {
  it("rejects an unknown private object without making it public", async () => {
    const path = "/objects/uploads/00000000-0000-4000-8000-000000000301";
    fixtures.aclPolicies.set(path, { owner: "another-user", visibility: "private" });

    const response = await request(app).post("/api/admin/badges").send({
      slug: "unknown_asset",
      name: "Unknown asset",
      imageUrl: path,
    });

    expect(response.status).toBe(403);
    expect(fixtures.setAcl).not.toHaveBeenCalled();
    expect(fixtures.badges).toHaveLength(0);
  });

  it("does not republish an existing badge object with a private foreign ACL", async () => {
    const path = "/objects/uploads/00000000-0000-4000-8000-000000000304";
    fixtures.badges.push({ id: "legacy-badge", imageUrl: path });
    fixtures.aclPolicies.set(path, { owner: "another-user", visibility: "private" });

    const response = await request(app).put("/api/admin/badges/legacy-badge").send({ imageUrl: path });

    expect(response.status).toBe(403);
    expect(fixtures.setAcl).not.toHaveBeenCalled();
  });

  it("makes a pending upload public for its owner when assigned to a badge", async () => {
    const upload = await request(app).post("/api/admin/badges/upload-url");
    expect(upload.status).toBe(200);
    const { objectPath } = upload.body as { objectPath: string };
    expect(isPendingBadgeUploadOwner(objectPath, "admin-user")).toBe(true);

    const response = await request(app).post("/api/admin/badges").send({
      slug: "pending_asset",
      name: "Pending asset",
      imageUrl: `https://api.example.test/api/storage${objectPath}`,
    });

    expect(response.status).toBe(201);
    expect(fixtures.setAcl).toHaveBeenCalledWith(objectPath, {
      owner: "admin-user",
      visibility: "public",
    });
    expect(isPendingBadgeUploadOwner(objectPath, "admin-user")).toBe(false);
  });

  it("rejects a pending upload after its 15-minute authorization expires", async () => {
    const upload = await request(app).post("/api/admin/badges/upload-url");
    expect(upload.status).toBe(200);
    const { objectPath } = upload.body as { objectPath: string };

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 15 * 60_000 + 1);
    const response = await request(app).post("/api/admin/badges").send({
      slug: "expired_asset",
      name: "Expired asset",
      imageUrl: objectPath,
    });

    expect(response.status).toBe(403);
    expect(fixtures.setAcl).not.toHaveBeenCalled();
    expect(fixtures.badges).toHaveLength(0);
  });

  it("clears a badge image when imageUrl is explicitly null", async () => {
    const response = await request(app).put("/api/admin/badges/badge-test-id").send({ imageUrl: null });
    expect(response.status).toBe(200);
    expect(fixtures.lastUpdate).toMatchObject({ imageUrl: null });
  });

  it("rejects query strings and traversal in managed object references", async () => {
    for (const imageUrl of [
      "/objects/uploads/00000000-0000-4000-8000-000000000302?signature=bad",
      "https://example.test/api/storage/objects/../uploads/00000000-0000-4000-8000-000000000303",
    ]) {
      const response = await request(app).post("/api/admin/badges").send({
        slug: `bad_path_${fixtures.badges.length}`,
        name: "Bad path",
        imageUrl,
      });
      expect(response.status).toBe(403);
    }
    expect(fixtures.setAcl).not.toHaveBeenCalled();
  });
});