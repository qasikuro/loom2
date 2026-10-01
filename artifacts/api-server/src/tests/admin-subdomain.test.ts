import request from "supertest";
import { fileURLToPath } from "node:url";
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

  it("redirects the apex domain to the canonical www root", async () => {
    const response = await request(app).get("/").set("Host", "storigam.com");
    expect(response.status).toBe(301);
    expect(response.headers.location).toBe("https://www.storigam.com/");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("serves the Storigam landing page at the canonical www root", async () => {
    const fixturePath = fileURLToPath(
      new URL("./fixtures/storigam-root-index.html", import.meta.url),
    );
    vi.stubEnv("STORIGAM_ROOT_LANDING_INDEX", fixturePath);

    try {
      const response = await request(app)
        .get("/")
        .set("Host", "www.storigam.com");
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.text).toContain("Storigam landing page fixture");
    } finally {
      vi.unstubAllEnvs();
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