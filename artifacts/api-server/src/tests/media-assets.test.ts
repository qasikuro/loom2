import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { Readable } from "node:stream";

const fixtures = vi.hoisted(() => ({
  query: vi.fn(),
  file: {
    getMetadata: vi.fn(),
    createReadStream: vi.fn(),
  },
  objectAcl: vi.fn(),
  publicStory: null as Record<string, unknown> | null,
  registeredOwners: [] as Record<string, unknown>[],
  legacyRows: {} as Record<string, Record<string, unknown>[]>,
  metadataByPath: {} as Record<string, Record<string, unknown> | null>,
  ownerProfile: { is_banned: false } as { is_banned: boolean } | null,
}));

vi.mock("@workspace/db", () => ({ pool: { query: fixtures.query } }));
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string> }) => ({ userId: req.headers["x-test-user"] ?? null }),
}));
vi.mock("../middleware/auth", () => ({
  requireAuth: (req: { headers: Record<string, string> }, res: express.Response, next: express.NextFunction) => {
    if (!req.headers["x-test-user"]) return res.status(401).json({ error: "Unauthorized" });
    return next();
  },
}));
vi.mock("../lib/objectStorage", () => ({
  objectStorageClient: {
    bucket: () => ({
      file: (path: string) => ({
        ...fixtures.file,
        getMetadata: () => {
          if (Object.hasOwn(fixtures.metadataByPath, path)) {
            const metadata = fixtures.metadataByPath[path];
            return metadata
              ? Promise.resolve([metadata])
              : Promise.reject(Object.assign(new Error("Not found"), { code: 404 }));
          }
          return fixtures.file.getMetadata();
        },
      }),
    }),
  },
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  ObjectStorageService: class {
    async getObjectEntityFile() { return fixtures.file; }
    async canAccessObjectEntity(args: { userId?: string }) { return fixtures.objectAcl(args.userId); }
  },
}));

import mediaAssetsRouter from "../routes/media-assets";
import {
  assertOwnedMediaReferences,
  getMediaOwner,
  normalizeManagedMediaPath,
  normalizeMediaReference,
  signOwnerMediaUrl,
  validateOwnerMediaTicket,
} from "../lib/mediaAccess";
import {
  consumePendingBadgeUpload,
  isPendingBadgeUploadOwner,
  registerPendingBadgeUpload,
} from "../lib/badgeUploadRegistry";
import { canAccessObject, getObjectAclPolicy, ObjectPermission } from "../lib/objectAcl";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api", mediaAssetsRouter);
  return instance;
}

function rowForPublicStory() {
  return fixtures.publicStory ? [fixtures.publicStory] : [];
}

describe("managed media privacy boundary", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret";
    fixtures.publicStory = null;
    fixtures.registeredOwners = [];
    fixtures.legacyRows = {};
    fixtures.metadataByPath = {};
    fixtures.ownerProfile = { is_banned: false };
    fixtures.objectAcl.mockReset().mockResolvedValue(false);
    fixtures.query.mockClear().mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT user_id AS owner")) {
        const rows = fixtures.registeredOwners.filter(row =>
          !row.path || row.path === params?.[0]
        );
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("FROM journal_entries")) {
        const rows = fixtures.legacyRows.journal_entries ?? [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("FROM gallery")) {
        const rows = fixtures.legacyRows.gallery ?? [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("FROM stories s") && sql.includes("s.video_uri LIKE")) {
        const rows = fixtures.legacyRows.stories ?? [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("FROM outfits") && sql.includes("LIKE")) {
        const rows = fixtures.legacyRows.outfits ?? [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("FROM character") && sql.includes("avatar_uri LIKE")) {
        const rows = fixtures.legacyRows.avatars ?? [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("FROM books b") && sql.includes("LIKE")) {
        const rows = fixtures.legacyRows.books ?? [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("SELECT user_id, panels") || sql.includes("SELECT s.user_id, s.panels")) {
        const rows = fixtures.ownerProfile ? rowForPublicStory() : [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("SELECT is_banned")) {
        const rows = fixtures.ownerProfile ? [fixtures.ownerProfile] : [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("FROM outfits")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM character WHERE avatar_uri")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM books b")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM badges")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });
    fixtures.file.getMetadata.mockClear().mockResolvedValue([{
      size: "3",
      contentType: "video/mp4",
      metadata: { ownerUserId: "alice" },
    }]);
    fixtures.file.createReadStream.mockClear().mockImplementation((options?: { start?: number; end?: number }) => {
      const bytes = Buffer.from("abc");
      return Readable.from([options ? bytes.subarray(options.start ?? 0, (options.end ?? 2) + 1) : bytes]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SESSION_SECRET;
    delete process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  });

  it("denies anonymous access to private originals before opening a byte stream", async () => {
    const response = await request(app()).get("/api/videos/private.mp4");
    expect(response.status).toBe(404);
    expect(fixtures.file.createReadStream).not.toHaveBeenCalled();
  });

  it("canonicalizes Express-equivalent managed media aliases", () => {
    expect(normalizeManagedMediaPath("/api/images/%70rivate.jpg?ticket=secret"))
      .toBe("/api/images/private.jpg");
    expect(normalizeManagedMediaPath("/api/images/private.jpg/"))
      .toBe("/api/images/private.jpg");
    expect(normalizeManagedMediaPath("/API/IMAGES/private.jpg"))
      .toBe("/api/images/private.jpg");
    expect(normalizeManagedMediaPath("/api/images/../images/private.jpg"))
      .toBe("/api/images/private.jpg");
    expect(normalizeManagedMediaPath("https://cdn.example/API/IMAGES/%70rivate.jpg/"))
      .toBe("/api/images/private.jpg");
    expect(normalizeManagedMediaPath("/api/images/private%2fother.jpg")).toBeNull();
    expect(() => normalizeMediaReference("/API/IMAGES/private%2fother.jpg?ticket=secret")).toThrow();
  });

  it("rejects unsafe internal media references during ownership validation", async () => {
    await expect(assertOwnedMediaReferences("alice", [
      "/api/images/private%2fother.jpg?ticket=foreign",
    ])).rejects.toThrow();
  });

  it("does not accept a foreign owner ticket through encoded, trailing, or case aliases", async () => {
    fixtures.registeredOwners = [{ owner: "alice", path: "/api/images/private.jpg" }];
    const foreignTicket = new URL(
      signOwnerMediaUrl("/api/images/private.jpg", "mallory"),
      "http://test",
    ).searchParams.get("ticket")!;
    for (const alias of [
      "/API/IMAGES/%70rivate.jpg",
      "/api/images/private.jpg/",
      "/API/IMAGES/private.jpg",
    ]) {
      const response = await request(app())
        .get(`${alias}?ticket=${encodeURIComponent(foreignTicket)}`);
      expect(response.status).toBe(404);
    }
    expect(fixtures.file.createReadStream).not.toHaveBeenCalled();
  });

  it("returns canonical public URLs without a supplied foreign ticket", async () => {
    const path = "/api/images/public.jpg";
    fixtures.registeredOwners = [{ owner: "alice", path }];
    fixtures.publicStory = {
      user_id: "alice",
      panels: [{ imageUri: path }],
      pages: [],
    };
    const foreignTicket = new URL(
      signOwnerMediaUrl(path, "mallory"),
      "http://test",
    ).searchParams.get("ticket")!;
    const response = await request(app())
      .post("/api/media/read-urls")
      .set("x-test-user", "mallory")
      .send({ paths: [
        `/api/images/%70ublic.jpg?ticket=${foreignTicket}`,
        "/api/images/public.jpg/",
        "/API/IMAGES/public.jpg",
      ] });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ urls: { [path]: path } });
  });

  it("allows an owner ticket when the owner has no character row", async () => {
    fixtures.registeredOwners = [{ owner: "alice", path: "/api/videos/private.mp4" }];
    fixtures.ownerProfile = null;
    const ticket = new URL(
      signOwnerMediaUrl("/api/videos/private.mp4", "alice"),
      "http://test",
    ).searchParams.get("ticket")!;
    const response = await request(app())
      .get(`/api/videos/private.mp4?ticket=${encodeURIComponent(ticket)}`);
    expect(response.status).toBe(200);
    expect(fixtures.file.createReadStream).toHaveBeenCalled();
  });

  it("denies an owner ticket when the owner is explicitly banned", async () => {
    fixtures.registeredOwners = [{ owner: "alice", path: "/api/videos/private.mp4" }];
    fixtures.ownerProfile = { is_banned: true };
    const ticket = new URL(
      signOwnerMediaUrl("/api/videos/private.mp4", "alice"),
      "http://test",
    ).searchParams.get("ticket")!;
    const response = await request(app())
      .get(`/api/videos/private.mp4?ticket=${encodeURIComponent(ticket)}`);
    expect(response.status).toBe(404);
    expect(fixtures.file.createReadStream).not.toHaveBeenCalled();
  });

  it("does not allow an anonymous public read when the owner profile is absent", async () => {
    const path = "/api/videos/public.mp4";
    fixtures.registeredOwners = [{ owner: "alice", path }];
    fixtures.publicStory = { user_id: "alice", video_uri: path, panels: [], pages: [] };
    fixtures.ownerProfile = null;
    const response = await request(app()).get(path);
    expect(response.status).toBe(404);
    expect(fixtures.file.createReadStream).not.toHaveBeenCalled();
  });

  it("returns authorized read URLs while omitting missing and foreign paths", async () => {
    fixtures.registeredOwners = [
      { owner: "alice", path: "/api/images/owned.jpg" },
      { owner: "bob", path: "/api/images/foreign.jpg" },
    ];
    fixtures.metadataByPath = {
      "images/owned.jpg": { metadata: { ownerUserId: "alice" } },
      "images/foreign.jpg": { metadata: { ownerUserId: "bob" } },
      "images/deleted.jpg": null,
    };
    const response = await request(app())
      .post("/api/media/read-urls")
      .set("x-test-user", "alice")
      .send({ paths: [
        "/api/images/owned.jpg",
        "/api/images/foreign.jpg",
        "/api/images/deleted.jpg",
      ] });
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.urls)).toEqual(["/api/images/owned.jpg"]);
    expect(response.body.urls["/api/images/owned.jpg"]).toContain("?ticket=");
  });

  it("returns an empty URL map when every read path is denied", async () => {
    fixtures.registeredOwners = [{ owner: "bob", path: "/api/images/foreign.jpg" }];
    fixtures.metadataByPath = {
      "images/foreign.jpg": { metadata: { ownerUserId: "bob" } },
      "images/deleted.jpg": null,
    };
    const response = await request(app())
      .post("/api/media/read-urls")
      .set("x-test-user", "alice")
      .send({ paths: ["/api/images/foreign.jpg", "/api/images/deleted.jpg"] });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ urls: {} });
  });

  it("still rejects malformed read URL requests", async () => {
    const response = await request(app())
      .post("/api/media/read-urls")
      .set("x-test-user", "alice")
      .send({ paths: ["not-managed-media"] });
    expect(response.status).toBe(400);
  });

  it("accepts a short-lived owner ticket and honors video byte ranges", async () => {
    const signedUrl = signOwnerMediaUrl("/api/videos/private.mp4", "alice");
    const ticket = new URL(signedUrl, "http://test").searchParams.get("ticket");
    const response = await request(app())
      .get(`/api/videos/private.mp4?ticket=${encodeURIComponent(ticket!)}`)
      .set("Range", "bytes=1-2");
    expect(response.status).toBe(206);
    expect(response.headers["content-range"]).toBe("bytes 1-2/3");
    expect(Buffer.from(response.body).toString()).toBe("bc");
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("revokes anonymous publicity as soon as the live public story reference disappears", async () => {
    fixtures.publicStory = {
      user_id: "alice",
      panels: [{ imageUri: "/api/videos/public.mp4" }],
      pages: [],
      video_uri: null,
      thumbnail_uri: null,
    };
    const publicResponse = await request(app()).get("/api/videos/public.mp4");
    expect(publicResponse.status).toBe(200);

    fixtures.publicStory = null;
    const revokedResponse = await request(app()).get("/api/videos/public.mp4");
    expect(revokedResponse.status).toBe(404);
  });

  it("does not let a foreign public reference launder an owner's media path", async () => {
    fixtures.publicStory = {
      user_id: "mallory",
      panels: [{ imageUri: "/api/videos/private.mp4" }],
      pages: [],
    };
    const response = await request(app()).get("/api/videos/private.mp4");
    expect(response.status).toBe(404);
    expect(fixtures.file.createReadStream).not.toHaveBeenCalled();
  });

  it("uses GCS ownership metadata to validate direct video references", async () => {
    process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID = "media-bucket";
    fixtures.file.getMetadata.mockClear();
    fixtures.file.getMetadata.mockResolvedValue([{ metadata: { ownerUserId: "alice" } }]);
    await expect(assertOwnedMediaReferences("alice", [
      "/api/videos/direct-upload.mp4",
      "/api/videos/direct-upload.mp4",
    ])).resolves.toBeUndefined();
    expect(fixtures.file.getMetadata).toHaveBeenCalledTimes(1);
    expect(fixtures.query.mock.calls.some(([sql]) =>
      String(sql).includes("FROM journal_entries"),
    )).toBe(false);
  });

  it.each([
    ["journal_entries", "/api/images/journal-legacy.jpg"],
    ["gallery", "/api/images/gallery-legacy.jpg"],
  ])("resolves private legacy ownership from %s references", async (table, path) => {
    fixtures.legacyRows[table] = [{ user_id: "alice", image_uri: path }];
    await expect(getMediaOwner(path, null)).resolves.toBe("alice");
  });

  it("does not let foreign legacy references change an authoritative owner", async () => {
    const path = "/api/images/registered.jpg";
    fixtures.registeredOwners = [{ owner: "alice" }];
    fixtures.legacyRows.gallery = [{ user_id: "mallory", image_uri: path }];
    await expect(getMediaOwner(path, null)).resolves.toBe("alice");
    expect(fixtures.query.mock.calls.some(([sql]) =>
      String(sql).includes("FROM gallery"),
    )).toBe(false);
  });

  it("denies conflicting authoritative ownership records", async () => {
    fixtures.registeredOwners = [{ owner: "alice" }, { owner: "bob" }];
    await expect(getMediaOwner("/api/images/conflicted.jpg", null)).resolves.toBeNull();
    expect(fixtures.query.mock.calls.some(([sql]) =>
      String(sql).includes("FROM gallery"),
    )).toBe(false);
  });

  it("denies generic object URLs when no valid ACL or exact public badge reference exists", async () => {
    const response = await request(app()).get("/api/storage/objects/uploads/00000000-0000-4000-8000-000000000001");
    expect(response.status).toBe(404);
    expect(fixtures.objectAcl).toHaveBeenCalled();
    expect(fixtures.file.createReadStream).not.toHaveBeenCalled();
  });

  it("does not let the legacy badge exception override an explicit private ACL", async () => {
    const objectPath = "/objects/uploads/00000000-0000-4000-8000-000000000001";
    registerPendingBadgeUpload(objectPath, "alice");
    fixtures.file.getMetadata.mockResolvedValue([{
      size: "3",
      contentType: "image/png",
      metadata: {
        "custom:aclPolicy": JSON.stringify({ owner: "alice", visibility: "private" }),
      },
    }]);
    fixtures.objectAcl.mockResolvedValue(false);
    fixtures.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM badges")) return { rows: [{ "?column?": 1 }], rowCount: 1 };
      if (sql.includes("SELECT user_id AS owner")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT user_id, panels")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM outfits")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM character WHERE avatar_uri")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM books b")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });
    const response = await request(app())
      .get("/api/storage/objects/uploads/00000000-0000-4000-8000-000000000001")
      .set("x-test-user", "alice");
    expect(response.status).toBe(404);
    expect(fixtures.query.mock.calls.some(([sql]) => String(sql).includes("FROM badges"))).toBe(false);
    expect(fixtures.file.createReadStream).not.toHaveBeenCalled();
  });

  it("allows the pending upload owner to preview a badge without ACL metadata", async () => {
    const objectPath = "/objects/uploads/00000000-0000-4000-8000-000000000002";
    registerPendingBadgeUpload(objectPath, "alice");
    const response = await request(app())
      .get("/api/storage/objects/uploads/00000000-0000-4000-8000-000000000002")
      .set("x-test-user", "alice");
    expect(response.status).toBe(200);
    expect(fixtures.query.mock.calls.some(([sql]) => String(sql).includes("FROM badges"))).toBe(false);
    expect(fixtures.file.createReadStream).toHaveBeenCalled();
  });

  it("does not allow a different user to preview a pending badge upload", async () => {
    registerPendingBadgeUpload("/objects/uploads/00000000-0000-4000-8000-000000000003", "alice");
    const response = await request(app())
      .get("/api/storage/objects/uploads/00000000-0000-4000-8000-000000000003")
      .set("x-test-user", "mallory");
    expect(response.status).toBe(404);
    expect(fixtures.file.createReadStream).not.toHaveBeenCalled();
  });

  it("fails closed on malformed object ACL metadata without badge fallback", async () => {
    fixtures.file.getMetadata.mockResolvedValue([{
      size: "3",
      contentType: "image/png",
      metadata: { "custom:aclPolicy": "{not-json" },
    }]);
    fixtures.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM badges")) return { rows: [{ "?column?": 1 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const response = await request(app())
      .get("/api/storage/objects/uploads/00000000-0000-4000-8000-000000000001");
    expect(response.status).toBe(404);
    expect(fixtures.query.mock.calls.some(([sql]) => String(sql).includes("FROM badges"))).toBe(false);
    expect(fixtures.file.createReadStream).not.toHaveBeenCalled();
  });

  it("rejects parsed public ACL policies with malformed owners or rules", async () => {
    const malformedPolicies = [
      { visibility: "public" },
      { owner: "", visibility: "public" },
      { owner: "alice", visibility: "public", aclRules: "not-an-array" },
      {
        owner: "alice",
        visibility: "public",
        aclRules: [{ group: { type: "UNSUPPORTED", id: "group" }, permission: "read" }],
      },
    ];
    for (const policy of malformedPolicies) {
      fixtures.file.getMetadata.mockResolvedValue([{
        size: "3",
        contentType: "image/png",
        metadata: { "custom:aclPolicy": JSON.stringify(policy) },
      }]);
      await expect(getObjectAclPolicy(fixtures.file as never)).rejects.toThrow();
      await expect(canAccessObject({
        objectFile: fixtures.file as never,
        requestedPermission: ObjectPermission.READ,
      })).rejects.toThrow();
      const response = await request(app())
        .get("/api/storage/objects/uploads/00000000-0000-4000-8000-000000000005");
      expect(response.status).toBe(404);
      expect(fixtures.query.mock.calls.some(([sql]) => String(sql).includes("FROM badges"))).toBe(false);
    }
    expect(fixtures.file.createReadStream).not.toHaveBeenCalled();
  });

  it("keeps only exact database-registered legacy badge paths public when ACL metadata is absent", async () => {
    fixtures.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM badges")) return { rows: [{ "?column?": 1 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const response = await request(app())
      .get("/api/storage/objects/uploads/00000000-0000-4000-8000-000000000001");
    expect(response.status).toBe(200);
    expect(fixtures.file.createReadStream).toHaveBeenCalled();
  });

  it("binds signatures to an exact canonical asset, expires tickets, and fails closed without a secret", () => {
    expect(normalizeManagedMediaPath("https://cdn.example/api/images/one.png?x=1"))
      .toBe("/api/images/one.png");
    const signed = signOwnerMediaUrl("/api/images/one.png", "alice");
    const ticket = new URL(signed, "http://test").searchParams.get("ticket")!;
    expect(validateOwnerMediaTicket(ticket, "/api/images/other.png")).toBeNull();
    expect(validateOwnerMediaTicket(`${ticket.slice(0, -1)}x`, "/api/images/one.png")).toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const expiringTicket = new URL(signOwnerMediaUrl("/api/images/one.png", "alice"), "http://test")
      .searchParams.get("ticket")!;
    vi.advanceTimersByTime(15 * 60_000 + 1);
    expect(validateOwnerMediaTicket(expiringTicket, "/api/images/one.png")).toBeNull();
    vi.useRealTimers();

    delete process.env.SESSION_SECRET;
    expect(() => signOwnerMediaUrl("/api/images/one.png", "alice")).toThrow();
  });

  it("enforces pending badge upload owner, single-use consumption and expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const path = "/objects/uploads/00000000-0000-4000-8000-000000000004";
    registerPendingBadgeUpload(path, "alice");
    expect(isPendingBadgeUploadOwner(path, "alice")).toBe(true);
    expect(isPendingBadgeUploadOwner(path, "mallory")).toBe(false);
    expect(consumePendingBadgeUpload(path, "mallory")).toBe(false);
    expect(consumePendingBadgeUpload(path, "alice")).toBe(true);
    expect(isPendingBadgeUploadOwner(path, "alice")).toBe(false);

    registerPendingBadgeUpload(path, "alice");
    vi.advanceTimersByTime(15 * 60_000 + 1);
    expect(isPendingBadgeUploadOwner(path, "alice")).toBe(false);
    vi.useRealTimers();
  });
});