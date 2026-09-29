import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db, pool, characterTable, storigamInterestSignupTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const { proxy } = vi.hoisted(() => ({ proxy: vi.fn() }));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next(),
  getAuth: (req: { headers: Record<string, string | string[] | undefined> }) => ({
    userId: req.headers["x-test-user-id"] ?? null,
  }),
}));

// All campaign dispatches are intercepted here: these tests never contact Resend.
vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class { proxy = proxy; },
}));

import adminInterestCampaignsRouter from "../routes/admin-interest-campaigns";
import storigamInterestRouter from "../routes/storigam-interest";

const ADMIN_ID = "test-storigam-campaigns-admin";
const USER_ID = "test-storigam-campaigns-user";
const fixturePrefix = `storigam-campaign-test-${crypto.randomUUID()}`;
const fixtureEmails = Array.from({ length: 10 }, (_, index) =>
  `${fixturePrefix}-${String(index).padStart(2, "0")}@example.invalid`,
);
const consentEmail = `${fixturePrefix}-consent@example.invalid`;
const fixtureIds = [ADMIN_ID, USER_ID];
const campaignIds: string[] = [];

const app = express();
app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
app.use(express.json());
app.use("/", storigamInterestRouter);
app.use("/", adminInterestCampaignsRouter);

async function createCampaign(audience: "all" | "beta_tester" | "content_creator") {
  const response = await request(app)
    .post("/admin/interest/campaigns")
    .set("x-test-user-id", ADMIN_ID)
    .send({ audience, subject: `Fixture ${audience}`, message: "A campaign test message." });
  if (response.body.id) campaignIds.push(response.body.id);
  return response;
}

describe("Storigam landing subscribers and admin email campaigns", () => {
  beforeAll(async () => {
    vi.stubEnv("STORIGAM_PUBLIC_ORIGIN", "https://storigam.com");
    await db.delete(characterTable).where(inArray(characterTable.userId, fixtureIds));
    await db.delete(storigamInterestSignupTable)
      .where(inArray(storigamInterestSignupTable.email, [...fixtureEmails, consentEmail]));
    await db.insert(characterTable).values([
      { userId: ADMIN_ID, isAdmin: true },
      { userId: USER_ID, isAdmin: false },
    ]);

    for (let index = 0; index < fixtureEmails.length; index++) {
      const response = await request(app).post("/storigam-interest").send({
        email: fixtureEmails[index],
        interests: index < 2 ? ["beta_tester"] : ["content_creator"],
        consent: true,
      });
      if (response.status !== 200) throw new Error(`Could not seed campaign test signup ${index}`);
    }
  });

  afterAll(async () => {
    proxy.mockReset();
    vi.unstubAllEnvs();
    if (campaignIds.length) {
      await pool.query("DELETE FROM storigam_email_campaigns WHERE id = ANY($1::uuid[])", [campaignIds]);
    }
    await db.delete(storigamInterestSignupTable)
      .where(inArray(storigamInterestSignupTable.email, [...fixtureEmails, consentEmail]));
    await db.delete(characterTable).where(inArray(characterTable.userId, fixtureIds));
  });

  afterEach(() => {
    proxy.mockReset();
  });

  it("requires explicit consent and stores a normalized signup with its unsubscribe token", async () => {
    const declined = await request(app).post("/storigam-interest").send({
      email: consentEmail,
      interests: ["beta_tester"],
      consent: false,
    });
    expect(declined.status).toBe(400);

    const accepted = await request(app).post("/storigam-interest").send({
      email: `  ${consentEmail.toUpperCase()}  `,
      interests: ["content_creator", "content_creator"],
      consent: true,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({ ok: true });

    const [signup] = await db.select().from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.email, consentEmail));
    expect(signup).toBeDefined();
    expect(signup?.interests).toEqual(["content_creator"]);
    expect(signup?.consentedAt).toBeInstanceOf(Date);
    expect(signup?.unsubscribeToken).toMatch(/^[a-f0-9]{64}$/);
    expect(signup?.unsubscribedAt).toBeNull();
  });

  it("restricts subscriber and campaign administration to admins", async () => {
    for (const path of ["/admin/interest/subscribers", "/admin/interest/campaigns"]) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await request(app).get(path).set("x-test-user-id", USER_ID)).status).toBe(403);
    }
    expect((await request(app).post("/admin/interest/campaigns")
      .set("x-test-user-id", USER_ID)
      .send({ audience: "all", subject: "No", message: "No" })).status).toBe(403);

    const subscribers = await request(app).get("/admin/interest/subscribers")
      .set("x-test-user-id", ADMIN_ID);
    expect(subscribers.status).toBe(200);
    expect(subscribers.body.subscribers.some((row: { email: string }) => row.email === fixtureEmails[0])).toBe(true);
  });

  it("prepares audiences from only active matching signups", async () => {
    const beta = await createCampaign("beta_tester");
    const creators = await createCampaign("content_creator");
    const all = await createCampaign("all");

    expect(beta.status).toBe(200);
    expect(beta.body.total).toBe(2);
    expect(beta.body.pending).toBe(2);
    expect(creators.status).toBe(200);
    expect(creators.body.total).toBe(9);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(11);

    const listed = await request(app).get("/admin/interest/campaigns")
      .set("x-test-user-id", ADMIN_ID);
    expect(listed.status).toBe(200);
    expect(listed.body.campaigns.some((campaign: { id: string }) => campaign.id === beta.body.id)).toBe(true);
  });

  it("dispatches selected recipients with individual unsubscribe links and records provider acceptance", async () => {
    const campaign = await createCampaign("beta_tester");
    expect(campaign.status).toBe(200);
    expect(campaign.body.total).toBe(2);

    proxy.mockImplementation(async (_connection: string, _path: string, options: { body: string }) => ({
      ok: true,
      status: 200,
      json: async () => ({ id: `re_fixture_${proxy.mock.calls.length}` }),
      options,
    }));
    const dispatch = await request(app).post(`/admin/interest/campaigns/${campaign.body.id}/dispatch`)
      .set("x-test-user-id", ADMIN_ID)
      .set("x-forwarded-host", "attacker.example")
      .set("host", "attacker.example");

    expect(dispatch.status).toBe(200);
    expect(dispatch.body.accepted).toBe(2);
    expect(dispatch.body.failed).toBe(0);
    expect(proxy).toHaveBeenCalledTimes(2);

    const payloads = proxy.mock.calls.map((call: [string, string, { headers: Record<string, string>; body: string }]) => {
      expect(call[0]).toBe("resend");
      expect(call[1]).toBe("/emails");
      const body = JSON.parse(call[2].body);
      expect(call[2].headers["Idempotency-Key"]).toMatch(/^storigam-/);
      return body as { to: string[]; text: string };
    });
    const sentAddresses = payloads.map(payload => payload.to[0]);
    expect(new Set(sentAddresses).size).toBe(2);
    expect(sentAddresses.every(email => fixtureEmails.slice(0, 2).includes(email))).toBe(true);

    const sentTokens: string[] = [];
    for (const payload of payloads) {
      const match = payload.text.match(/https?:\/\/[^\s]+\/api\/storigam-interest\/unsubscribe\?token=([a-f0-9]{64})/);
      expect(match).not.toBeNull();
      expect(match?.[0]).toContain("https://storigam.com/api/storigam-interest/unsubscribe");
      const [signup] = await db.select().from(storigamInterestSignupTable)
        .where(eq(storigamInterestSignupTable.email, payload.to[0]));
      expect(match?.[1]).toBe(signup?.unsubscribeToken);
      sentTokens.push(match![1]);
    }
    expect(new Set(sentTokens).size).toBe(2);

    // Re-dispatching an already completed campaign must not send the same emails twice.
    const duplicateDispatch = await request(app)
      .post(`/admin/interest/campaigns/${campaign.body.id}/dispatch`)
      .set("x-test-user-id", ADMIN_ID);
    expect(duplicateDispatch.status).toBe(200);
    expect(duplicateDispatch.body.accepted).toBe(2);
    expect(proxy).toHaveBeenCalledTimes(2);
  });

  it("GET unsubscribe is read-only, POST opts out, and later campaigns exclude that signup", async () => {
    const optedOutEmail = fixtureEmails[0];
    const [signup] = await db.select().from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.email, optedOutEmail));
    const token = signup!.unsubscribeToken!;

    const preview = await request(app).get(`/storigam-interest/unsubscribe?token=${token}`);
    expect(preview.status).toBe(200);
    const [afterGet] = await db.select().from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.email, optedOutEmail));
    expect(afterGet?.unsubscribedAt).toBeNull();

    const confirmation = await request(app).post(`/storigam-interest/unsubscribe?token=${token}`);
    expect(confirmation.status).toBe(200);
    const [afterPost] = await db.select().from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.email, optedOutEmail));
    expect(afterPost?.unsubscribedAt).toBeInstanceOf(Date);

    const laterCampaign = await createCampaign("beta_tester");
    expect(laterCampaign.status).toBe(200);
    expect(laterCampaign.body.total).toBe(1);
  });

  it("leaves rate-limited recipients pending rather than losing them", async () => {
    const campaign = await createCampaign("content_creator");
    proxy.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });

    const response = await request(app).post(`/admin/interest/campaigns/${campaign.body.id}/dispatch`)
      .set("x-test-user-id", ADMIN_ID);
    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("60");
    const progress = await request(app).get("/admin/interest/campaigns")
      .set("x-test-user-id", ADMIN_ID);
    const updated = progress.body.campaigns.find((item: { id: string }) => item.id === campaign.body.id);
    expect(updated.accepted).toBe(0);
    expect(updated.failed).toBe(0);
    expect(updated.pending).toBe(campaign.body.total);
    expect(proxy).toHaveBeenCalledTimes(1);
  });
});