import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: null }),
}));

import app from "../app";

describe("custom domain root routing", () => {
  it("opens the existing Admin app from the short subdomain address", async () => {
    const response = await request(app).get("/").set("Host", "myadmin.storigam.com");
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("routes both website domains to the landing page", async () => {
    for (const host of ["storigam.com", "www.storigam.com"]) {
      const response = await request(app).get("/").set("Host", host);
      expect(response.status).toBe(301);
      expect(response.headers.location).toBe("/storigam/");
      expect(response.headers["cache-control"]).toBe("no-store");
    }
  });

  it("leaves lookalike hosts unchanged", async () => {
    for (const host of ["notmyadmin.storigam.com", "www2.storigam.com"]) {
      const response = await request(app).get("/").set("Host", host);
      expect(response.status).toBe(200);
      expect(response.text).toContain("GameJo");
    }
  });

  it("always returns fresh Admin bootstrap config instead of 304", async () => {
    const first = await request(app).get("/api/admin/config");
    expect(first.status).toBe(200);
    expect(first.headers["cache-control"]).toBe("no-store");
    expect(first.body.publishableKey).toEqual(expect.any(String));
    expect(first.body._ts).toEqual(expect.any(Number));

    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await request(app)
      .get("/api/admin/config")
      .set("If-None-Match", first.headers.etag);

    expect(second.status).toBe(200);
    expect(second.body.publishableKey).toBe(first.body.publishableKey);
    expect(second.body._ts).not.toBe(first.body._ts);
  });
});