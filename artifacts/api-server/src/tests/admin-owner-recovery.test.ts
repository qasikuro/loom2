import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const fixture = vi.hoisted(() => ({
  userId: "owner-fixture",
  row: { isAdmin: false, isBanned: false, suspendedUntil: null as Date | null },
  rowExists: true,
  updated: false,
  guard: null as SQL | null,
  getUser: vi.fn(),
}));
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: fixture.userId || null }),
  clerkClient: { users: { getUser: fixture.getUser } },
}));
vi.mock("@workspace/db", async () => {
  const { pgTable, text, boolean, timestamp } = await import("drizzle-orm/pg-core");
  return {
    characterTable: pgTable("character", {
      userId: text("user_id"),
      isAdmin: boolean("is_admin"),
      isBanned: boolean("is_banned"),
      suspendedUntil: timestamp("suspended_until"),
    }),
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => fixture.rowExists ? [{ ...fixture.row }] : [] }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: (guard: SQL) => {
            fixture.guard = guard;
            return {
              returning: async () => {
                if (fixture.row.isBanned || (fixture.row.suspendedUntil && fixture.row.suspendedUntil > new Date())) return [];
                fixture.updated = true;
                fixture.row.isAdmin = true;
                return [{ userId: fixture.userId }];
              },
            };
          },
        }),
      }),
    },
  };
});
import { requireAdmin } from "../middleware/auth.js";
const app = express().get("/admin-check", requireAdmin, (_req, res) => { res.json({ ok: true }); });
const verifiedOwner = () => ({
  id: "owner-fixture",
  primaryEmailAddressId: "primary",
  emailAddresses: [{
    id: "primary", emailAddress: "owner@example.com", verification: { status: "verified" },
  }],
});

beforeEach(() => {
  fixture.userId = "owner-fixture";
  fixture.row = { isAdmin: false, isBanned: false, suspendedUntil: null };
  fixture.rowExists = true;
  fixture.updated = false;
  fixture.guard = null;
  fixture.getUser.mockReset().mockResolvedValue(verifiedOwner());
  vi.stubEnv("ADMIN_OWNER_USER_ID", "owner-fixture");
  vi.stubEnv("ADMIN_OWNER_EMAIL", "owner@example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("server-configured admin owner recovery", () => {
  it("restores only the configured identity with its verified primary email", async () => {
    expect((await request(app).get("/admin-check")).status).toBe(200);
    expect(fixture.updated).toBe(true);
    const query = new PgDialect().sqlToQuery(fixture.guard!);
    expect(query.sql).toContain('"character"."is_banned"');
    expect(query.sql).toContain('"character"."suspended_until"');
    expect(query.params).toContain("owner-fixture");
    expect(query.params).toContain(false);
  });

  it.each(["", "another-user"])("rejects an absent or different signed-in identity %j", async userId => {
    fixture.userId = userId;
    expect((await request(app).get("/admin-check")).status).toBe(userId ? 403 : 401);
    expect(fixture.getUser).not.toHaveBeenCalled();
    expect(fixture.updated).toBe(false);
  });

  it.each(["ADMIN_OWNER_USER_ID", "ADMIN_OWNER_EMAIL"])("is disabled without %s", async key => {
    vi.stubEnv(key, "");
    expect((await request(app).get("/admin-check")).status).toBe(403);
    expect(fixture.getUser).not.toHaveBeenCalled();
  });

  it("rejects an unverified address", async () => {
    const owner = verifiedOwner();
    owner.emailAddresses[0].verification.status = "unverified";
    fixture.getUser.mockResolvedValue(owner);
    expect((await request(app).get("/admin-check")).status).toBe(403);
    expect(fixture.updated).toBe(false);
  });

  it("rejects a different primary address even when a matching secondary address exists", async () => {
    const owner = verifiedOwner();
    owner.primaryEmailAddressId = "other";
    owner.emailAddresses.push({ id: "other", emailAddress: "other@example.com", verification: { status: "verified" } });
    fixture.getUser.mockResolvedValue(owner);
    expect((await request(app).get("/admin-check")).status).toBe(403);
    expect(fixture.updated).toBe(false);
  });

  it.each(["banned", "suspended"])("does not bypass a %s account restriction", async restriction => {
    if (restriction === "banned") fixture.row.isBanned = true;
    else fixture.row.suspendedUntil = new Date(Date.now() + 60000);
    expect((await request(app).get("/admin-check")).status).toBe(403);
    expect(fixture.getUser).not.toHaveBeenCalled();
    expect(fixture.updated).toBe(false);
  });

  it("fails closed when Clerk verification is unavailable", async () => {
    fixture.getUser.mockRejectedValue(new Error("Provider unavailable"));
    expect((await request(app).get("/admin-check")).status).toBe(500);
    expect(fixture.updated).toBe(false);
  });

  it("re-checks a suspension imposed during verification", async () => {
    fixture.getUser.mockImplementation(async () => {
      fixture.row.isBanned = true;
      return verifiedOwner();
    });
    expect((await request(app).get("/admin-check")).status).toBe(403);
    expect(fixture.updated).toBe(false);
  });

  it("does not recreate missing profiles or change existing admins", async () => {
    fixture.rowExists = false;
    expect((await request(app).get("/admin-check")).status).toBe(403);
    expect(fixture.getUser).not.toHaveBeenCalled();
    fixture.rowExists = true;
    fixture.row.isAdmin = true;
    expect((await request(app).get("/admin-check")).status).toBe(200);
    expect(fixture.getUser).not.toHaveBeenCalled();
    expect(fixture.updated).toBe(false);
  });
});
