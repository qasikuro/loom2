import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db, characterTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const { proxy } = vi.hoisted(() => ({ proxy: vi.fn() }));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next(),
  getAuth: (req: { headers: Record<string, string | string[] | undefined> }) => ({
    userId: req.headers["x-test-user-id"] ?? null,
  }),
}));

vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class { proxy = proxy; },
}));

import adminEmailsRouter from "../routes/admin-emails";

const ADMIN_ID = "test-admin-emails-admin";
const USER_ID = "test-admin-emails-user";
const fixtureIds = [ADMIN_ID, USER_ID];

const app = express();
app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
app.use(express.json());
app.use("/", adminEmailsRouter);

const email = { to: "member@example.com", subject: "Hello there", message: "Your message goes here." };

describe("POST /admin/emails", () => {
  beforeAll(async () => {
    await db.delete(characterTable).where(inArray(characterTable.userId, fixtureIds));
    await db.insert(characterTable).values([
      { userId: ADMIN_ID, isAdmin: true },
      { userId: USER_ID, isAdmin: false },
    ]);
  });

  afterEach(() => {
    proxy.mockReset();
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await db.delete(characterTable).where(inArray(characterTable.userId, fixtureIds));
  });

  it("blocks unauthenticated and non-admin requests", async () => {
    const unauthenticated = await request(app).post("/admin/emails").send(email);
    const nonAdmin = await request(app).post("/admin/emails").set("x-test-user-id", USER_ID).send(email);
    expect(unauthenticated.status).toBe(401);
    expect(nonAdmin.status).toBe(403);
    expect(proxy).not.toHaveBeenCalled();
  });

  it("validates a single recipient and non-empty message", async () => {
    const result = await request(app).post("/admin/emails").set("x-test-user-id", ADMIN_ID)
      .send({ to: "not-an-email", subject: "  ", message: "  " });
    expect(result.status).toBe(400);
    expect(proxy).not.toHaveBeenCalled();
  });

  it("sends plain text through the server-side Resend connection", async () => {
    vi.stubEnv("RESEND_REPLY_TO_EMAIL", "info@contact.storigam.com");
    proxy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "re_test_123" }) });
    const result = await request(app).post("/admin/emails").set("x-test-user-id", ADMIN_ID).send(email);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, id: "re_test_123" });
    expect(proxy).toHaveBeenCalledWith("resend", "/emails", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(proxy.mock.calls[0][2].body as string);
    expect(body).toEqual({
      from: process.env.RESEND_FROM_EMAIL?.trim() || "Storigam <no-reply@contact.storigam.com>",
      to: ["member@example.com"],
      subject: "Hello there",
      text: "Your message goes here.",
      reply_to: "info@contact.storigam.com",
    });
  });

  it("leaves reply-to unset until the receiving inbox is ready", async () => {
    vi.stubEnv("RESEND_REPLY_TO_EMAIL", "");
    proxy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "re_test_456" }) });
    const result = await request(app).post("/admin/emails").set("x-test-user-id", ADMIN_ID).send(email);
    expect(result.status).toBe(200);
    const body = JSON.parse(proxy.mock.calls[0][2].body as string);
    expect(body).not.toHaveProperty("reply_to");
  });

  it("refuses to send with an invalid configured reply-to address", async () => {
    vi.stubEnv("RESEND_REPLY_TO_EMAIL", "invalid-address");
    const result = await request(app).post("/admin/emails").set("x-test-user-id", ADMIN_ID).send(email);
    expect(result.status).toBe(503);
    expect(proxy).not.toHaveBeenCalled();
  });

  it("does not claim success if Resend rejects the request", async () => {
    proxy.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const result = await request(app).post("/admin/emails").set("x-test-user-id", ADMIN_ID).send(email);
    expect(result.status).toBe(502);
    expect(result.body.error).toMatch(/could not send/i);
  });

  it("does not claim success without a provider ID", async () => {
    proxy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const result = await request(app).post("/admin/emails").set("x-test-user-id", ADMIN_ID).send(email);
    expect(result.status).toBe(502);
  });

  it("reports a connection failure", async () => {
    proxy.mockRejectedValue(new Error("Connection unavailable"));
    const result = await request(app).post("/admin/emails").set("x-test-user-id", ADMIN_ID).send(email);
    expect(result.status).toBe(503);
  });
});