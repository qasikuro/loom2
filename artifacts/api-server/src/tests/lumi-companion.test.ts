import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db, lumiStateTable } from "@workspace/db";
import { isImmediateCrisis, lumiInputSchema, lumiOutputSchema } from "../lib/lumiCompanion";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create }; },
}));
vi.mock("@clerk/express", () => ({
  getAuth: (req: { headers: Record<string, string> }) => ({ userId: req.headers["x-test-user-id"] ?? null }),
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  clerkClient: { users: { getUser: async () => null } },
}));
// Feature policy is tested separately; keep this test independent of admin AI switches.
vi.mock("../middleware/ai-access", () => ({
  requireAiAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import lumiRouter from "../routes/lumi";
const ids = [`lumi-test-${randomUUID()}`, `lumi-test-${randomUUID()}`];
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() } as unknown as typeof req.log;
  next();
});
app.use(lumiRouter);
const modelReply = {
  content: [{ type: "text", text: JSON.stringify({
    reply: "Want to find something relaxing?",
    recommendations: [{ type: "music", title: "Find calm music", reason: "You asked for a quiet activity.", query: "calm" }],
  }) }],
};

describe("Lumi companion contracts", () => {
  it("rejects arbitrary actions and extra execution fields", () => {
    expect(lumiOutputSchema.safeParse({ reply: "Hi", recommendations: [{ type: "raw_sql", title: "Run it", reason: "x" }] }).success).toBe(false);
    expect(lumiOutputSchema.safeParse({ reply: "Hi", recommendations: [{ type: "music", title: "Play", reason: "x", url: "https://example.com" }] }).success).toBe(false);
  });
  it("bounds messages, history and model output", () => {
    expect(lumiInputSchema.safeParse({ message: "a".repeat(801) }).success).toBe(false);
    expect(lumiInputSchema.safeParse({ message: "Hi", history: Array.from({ length: 21 }, () => ({ role: "user", content: "Hi" })) }).success).toBe(false);
    expect(lumiOutputSchema.safeParse({ reply: "a".repeat(1601), recommendations: [] }).success).toBe(false);
  });
  it("flags explicit immediate-danger language", () => {
    expect(isImmediateCrisis("I want to kill myself")).toBe(true);
    expect(isImmediateCrisis("I want to make an outfit")).toBe(false);
  });
});

describe("private Lumi API", () => {
  beforeAll(async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS lumi_state (
      user_id TEXT PRIMARY KEY, remember BOOLEAN NOT NULL DEFAULT FALSE,
      revision INTEGER NOT NULL DEFAULT 0, messages JSONB NOT NULL DEFAULT '[]',
      preferences JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await db.execute(sql`ALTER TABLE lumi_state ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0`);
  });
  beforeEach(async () => {
    create.mockReset();
    create.mockResolvedValue(modelReply);
    await db.delete(lumiStateTable).where(inArray(lumiStateTable.userId, ids));
  });
  afterAll(async () => {
    await db.delete(lumiStateTable).where(inArray(lumiStateTable.userId, ids));
  });
  it("requires authentication and starts with remembering disabled", async () => {
    expect((await request(app).get("/drift/companion-state")).status).toBe(401);
    const response = await request(app).get("/drift/companion-state").set("x-test-user-id", ids[0]);
    expect(response.body).toEqual({ remember: false, messages: [], preferences: {} });
  });
  it("saves only opted-in history and never exposes it to another account", async () => {
    await request(app).put("/drift/companion-state").set("x-test-user-id", ids[0])
      .send({ remember: true, preferences: { game: "Sky", musicStyle: "Calm" } }).expect(200);
    const reply = await request(app).post("/drift/companion").set("x-test-user-id", ids[0])
      .send({ message: "I'd like calm music", locale: "ur" }).expect(200);
    expect(reply.body.fallback).toBe(false);
    expect(create.mock.calls[0][0].messages[0].content).toContain('"locale":"ur"');
    const own = await request(app).get("/drift/companion-state").set("x-test-user-id", ids[0]);
    expect(own.body.messages).toHaveLength(2);
    const other = await request(app).get("/drift/companion-state").set("x-test-user-id", ids[1]);
    expect(other.body.messages).toEqual([]);
  });
  it("does not save conversations by default", async () => {
    await request(app).post("/drift/companion").set("x-test-user-id", ids[0]).send({ message: "Hi" }).expect(200);
    const [state] = await db.select().from(lumiStateTable).where(eq(lumiStateTable.userId, ids[0]));
    expect(state).toBeUndefined();
  });
  it("returns a marked fallback without leaking provider errors", async () => {
    create.mockRejectedValue(new Error("SECRET provider internals"));
    const response = await request(app).post("/drift/companion").set("x-test-user-id", ids[0])
      .send({ message: "Hi", locale: "es" }).expect(200);
    expect(response.body.fallback).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("SECRET");
    expect(response.body.reply).toContain("IA");
  });
  it("rejects invalid model actions with a fallback", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: '{"reply":"Hi","recommendations":[{"type":"delete_account","title":"Remove","reason":"x"}]}' }] });
    const response = await request(app).post("/drift/companion").set("x-test-user-id", ids[0]).send({ message: "Hi" });
    expect(response.body).toMatchObject({ fallback: true, recommendations: [] });
  });
  it("opt-out deletes history; deleting also resets preferences", async () => {
    await request(app).put("/drift/companion-state").set("x-test-user-id", ids[0])
      .send({ remember: true, preferences: { game: "Sky" } });
    await request(app).post("/drift/companion").set("x-test-user-id", ids[0]).send({ message: "Hi" });
    const optOut = await request(app).put("/drift/companion-state").set("x-test-user-id", ids[0]).send({ remember: false });
    expect(optOut.body.messages).toEqual([]);
    await request(app).delete("/drift/companion-state").set("x-test-user-id", ids[0]).expect(200);
    const state = await request(app).get("/drift/companion-state").set("x-test-user-id", ids[0]);
    expect(state.body).toEqual({ remember: false, messages: [], preferences: {} });
  });
  it("an in-flight response cannot recreate data after deletion and re-opt-in", async () => {
    await request(app).put("/drift/companion-state").set("x-test-user-id", ids[0]).send({ remember: true });
    let finish!: (reply: typeof modelReply) => void;
    create.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = request(app).post("/drift/companion").set("x-test-user-id", ids[0])
      .send({ message: "This is private" }).then(result => result);
    for (let i = 0; i < 100 && !finish; i++) await new Promise(resolve => setTimeout(resolve, 10));
    expect(finish).toBeTypeOf("function");
    await request(app).delete("/drift/companion-state").set("x-test-user-id", ids[0]);
    await request(app).put("/drift/companion-state").set("x-test-user-id", ids[0]).send({ remember: true });
    finish(modelReply);
    await pending;
    const state = await request(app).get("/drift/companion-state").set("x-test-user-id", ids[0]);
    expect(state.body.messages).toEqual([]);
  });
});
