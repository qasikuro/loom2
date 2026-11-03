import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const fixture = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  updates: [] as SQL[],
}));

vi.mock("../middleware/auth.js", () => ({
  requireAdmin: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers["x-test-admin"] !== "yes") return res.status(403).json({ error: "Admin required" });
    return next();
  },
}));

vi.mock("@workspace/db", async () => {
  const { pgTable, text, jsonb } = await import("drizzle-orm/pg-core");
  return {
    appSettingsTable: pgTable("app_settings", { key: text("key").primaryKey(), value: jsonb("value") }),
    db: {
      select: () => ({
        from: async () => Object.entries(fixture.values).map(([key, value]) => ({ key, value })),
      }),
      insert: () => ({
        values: (row: { key: string; value: unknown }) => ({
          onConflictDoUpdate: (config: { set: { value: SQL } }) => ({
            returning: async () => {
              fixture.updates.push(config.set.value);
              fixture.values[row.key] = row.key === "features"
                ? { ...(fixture.values[row.key] as object ?? {}), ...(row.value as object) }
                : row.value;
              return [{ key: row.key, value: fixture.values[row.key] }];
            },
          }),
        }),
      }),
    },
  };
});

import settingsRouter from "../routes/admin-settings.js";
const app = express().use(express.json()).use("/api", settingsRouter);
const admin = () => request(app);

beforeEach(() => {
  fixture.values = {};
  fixture.updates = [];
});

describe("persistent Home floating-button settings", () => {
  it("keeps legacy feature availability but defaults both floating buttons to hidden", async () => {
    fixture.values.features = { shop: true, season: true };
    const response = await admin().get("/api/admin/settings").set("x-test-admin", "yes");
    expect(response.status).toBe(200);
    expect(response.body.settings.features).toMatchObject({
      shop: true, season: true, shop_button: false, season_button: false,
    });
  });

  it("merges individual toggles without resetting existing hidden flags", async () => {
    fixture.values.features = { shop: false, shop_button: false, music: false };
    const response = await admin().put("/api/admin/settings/features").set("x-test-admin", "yes")
      .send({ value: { season_button: true } });
    expect(response.status).toBe(200);
    expect(response.body.value).toMatchObject({
      shop: false, shop_button: false, music: false, season_button: true,
    });
    // Check the actual generated update expression, not just the fake storage.
    const update = new PgDialect().sqlToQuery(fixture.updates[0]);
    expect(update.sql).toContain('coalesce("app_settings"."value",');
    expect(update.sql).toContain("||");
    expect(update.params).toContain(JSON.stringify({ season_button: true }));
    const reload = await admin().get("/api/admin/settings").set("x-test-admin", "yes");
    expect(reload.body.settings.features.season_button).toBe(true);
  });

  it.each([{ shop_button: "false" }, { unknown: true }, null])("rejects invalid feature values %j", async value => {
    const response = await admin().put("/api/admin/settings/features").set("x-test-admin", "yes").send({ value });
    expect(response.status).toBe(400);
    expect(fixture.updates).toHaveLength(0);
  });

  it("does not allow unauthenticated callers to change visibility", async () => {
    const response = await admin().put("/api/admin/settings/features").send({ value: { shop_button: true } });
    expect(response.status).toBe(403);
    expect(fixture.updates).toHaveLength(0);
  });
});
