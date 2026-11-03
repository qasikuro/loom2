import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db, pool, characterTable, storigamInterestSignupTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { buildStorigamBetaBadgeEmail } from "../routes/storigam-beta-badge-email";
import { storigamInterestLanguages } from "../routes/storigam-interest-welcome-email";

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
const welcomeEmail = `${fixturePrefix}-welcome@example.invalid`;
const retryEmail = `${fixturePrefix}-retry@example.invalid`;
const badgeRetryEmail = `${fixturePrefix}-badge-retry@example.invalid`;
const raceEmail = `${fixturePrefix}-race@example.invalid`;
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
    proxy.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: `re_fixture_welcome_${proxy.mock.calls.length}` }),
    }));
    await db.delete(characterTable).where(inArray(characterTable.userId, fixtureIds));
    await db.delete(storigamInterestSignupTable)
      .where(inArray(storigamInterestSignupTable.email, [...fixtureEmails, consentEmail, welcomeEmail, retryEmail, badgeRetryEmail, raceEmail]));
    await db.insert(characterTable).values([
      { userId: ADMIN_ID, isAdmin: true },
      { userId: USER_ID, isAdmin: false },
    ]);

    for (let index = 0; index < fixtureEmails.length; index++) {
      const response = await request(app).post("/storigam-interest").send({
        email: fixtureEmails[index],
        name: `Fixture User ${index}`,
        language: "en",
        interests: index < 2 ? ["beta_tester"] : ["content_creator"],
        consent: true,
      });
      if (response.status !== 200) throw new Error(`Could not seed campaign test signup ${index}`);
    }
    const raceSignup = await request(app).post("/storigam-interest").send({
      email: raceEmail,
      name: "Race Fixture",
      language: "en",
      interests: ["beta_tester"],
      consent: true,
    });
    if (raceSignup.status !== 200) throw new Error("Could not seed campaign race test signup");
  });

  afterAll(async () => {
    proxy.mockReset();
    vi.unstubAllEnvs();
    if (campaignIds.length) {
      await pool.query("DELETE FROM storigam_email_campaigns WHERE id = ANY($1::uuid[])", [campaignIds]);
    }
    await db.delete(storigamInterestSignupTable)
      .where(inArray(storigamInterestSignupTable.email, [...fixtureEmails, consentEmail, welcomeEmail, retryEmail, badgeRetryEmail, raceEmail]));
    await db.delete(characterTable).where(inArray(characterTable.userId, fixtureIds));
  });

  afterEach(() => {
    proxy.mockReset();
  });

  it("has complete badge invitations for every supported website language", () => {
    for (const language of storigamInterestLanguages) {
      const email = buildStorigamBetaBadgeEmail(
        language,
        "https://storigam.com/unsubscribe-test",
      );
      expect(email.subject.length).toBeGreaterThan(10);
      expect(email.text).toContain("support@storigam.com");
      expect(email.text).toContain("https://storigam.com/unsubscribe-test");
      expect(email.text).not.toContain("{{unsubscribeUrl}}");
      expect(email.text.length).toBeGreaterThan(700);
    }
  });

  it("requires explicit consent and stores a normalized signup with its unsubscribe token", async () => {
    proxy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "re_consent_welcome" }),
    });
    const declined = await request(app).post("/storigam-interest").send({
      email: consentEmail,
      name: "Consent User",
      interests: ["beta_tester"],
      consent: false,
    });
    expect(declined.status).toBe(400);

    const accepted = await request(app).post("/storigam-interest").send({
      email: `  ${consentEmail.toUpperCase()}  `,
      name: "  Consent   User  ",
      language: "en-GB",
      interests: ["content_creator", "content_creator"],
      consent: true,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({
      ok: true,
      welcomeEmailStatus: "accepted",
      badgeInvitationEmailStatus: "not_applicable",
    });

    const [signup] = await db.select().from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.email, consentEmail));
    expect(signup).toBeDefined();
    expect(signup?.interests).toEqual(["content_creator"]);
    expect(signup?.name).toBe("Consent User");
    expect(signup?.preferredLanguage).toBe("en");
    expect(signup?.welcomeEmailStatus).toBe("accepted");
    expect(signup?.consentedAt).toBeInstanceOf(Date);
    expect(signup?.unsubscribeToken).toMatch(/^[a-f0-9]{64}$/);
    expect(signup?.unsubscribedAt).toBeNull();
  });

  it("sends the localized beta emails once in the selected website language", async () => {
    proxy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "re_localized_welcome" }),
    });

    const signup = {
      email: welcomeEmail,
      name: "Ayesha Khan",
      language: "es-MX",
      interests: ["beta_tester"],
      consent: true,
    };
    const acceptedResponse = await request(app).post("/storigam-interest").send(signup);
    expect(acceptedResponse.status).toBe(200);
    expect(acceptedResponse.body).toEqual({
      ok: true,
      welcomeEmailStatus: "accepted",
      badgeInvitationEmailStatus: "accepted",
    });
    expect(proxy).toHaveBeenCalledTimes(2);

    const [connection, path, options] = proxy.mock.calls[0] as [
      string,
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(connection).toBe("resend");
    expect(path).toBe("/emails");
    expect(options.headers["Idempotency-Key"]).toMatch(/^storigam-beta-welcome-v1-/);
    const payload = JSON.parse(options.body) as { to: string[]; subject: string; text: string };
    expect(payload.to).toEqual([welcomeEmail]);
    expect(payload.subject).toContain("bienvenida");
    expect(payload.text).toContain("Hola Ayesha Khan");
    expect(payload.text).toContain("support@storigam.com");
    expect(payload.text).toContain("https://storigam.com/api/storigam-interest/unsubscribe?token=");

    const [badgeConnection, badgePath, badgeOptions] = proxy.mock.calls[1] as [
      string,
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(badgeConnection).toBe("resend");
    expect(badgePath).toBe("/emails");
    expect(badgeOptions.headers["Idempotency-Key"]).toMatch(/^storigam-beta-badge-v1-/);
    const badgePayload = JSON.parse(badgeOptions.body) as {
      to: string[];
      subject: string;
      text: string;
      reply_to: string;
    };
    expect(badgePayload.to).toEqual([welcomeEmail]);
    expect(badgePayload.subject).toContain("insignia");
    expect(badgePayload.text).toContain("Tu idea, tu insignia");
    expect(badgePayload.text).toContain("Responde a este correo");
    expect(badgePayload.text).toContain("support@storigam.com");
    expect(badgePayload.reply_to).toBe("support@storigam.com");
    expect(badgePayload.text).toContain("https://storigam.com/api/storigam-interest/unsubscribe?token=");

    const [saved] = await db.select().from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.email, welcomeEmail));
    expect(saved?.name).toBe("Ayesha Khan");
    expect(saved?.preferredLanguage).toBe("es");
    expect(saved?.welcomeEmailStatus).toBe("accepted");
    expect(saved?.welcomeEmailId).toBe("re_localized_welcome");
    expect(saved?.welcomeEmailSentAt).toBeInstanceOf(Date);
    expect(saved?.betaBadgeEmailStatus).toBe("accepted");
    expect(saved?.betaBadgeEmailSentAt).toBeInstanceOf(Date);

    await request(app).post("/storigam-interest").send(signup);
    expect(proxy).toHaveBeenCalledTimes(2);
  });

  it("keeps the signup when Resend rejects the welcome email and retries on a later submission", async () => {
    proxy.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: `re_welcome_retry_${proxy.mock.calls.length}` }),
    }));
    proxy.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    const signup = {
      email: retryEmail,
      name: "Retry Player",
      language: "en",
      interests: ["beta_tester"],
      consent: true,
    };

    const failedResponse = await request(app).post("/storigam-interest").send(signup);
    expect(failedResponse.status).toBe(200);
    expect(failedResponse.body).toEqual({
      ok: true,
      welcomeEmailStatus: "failed",
      badgeInvitationEmailStatus: "pending",
    });
    const [afterFailure] = await db.select().from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.email, retryEmail));
    expect(afterFailure?.name).toBe("Retry Player");
    expect(afterFailure?.welcomeEmailStatus).toBe("failed");

    proxy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "re_retry_welcome" }),
    });
    const retried = await request(app).post("/storigam-interest").send(signup);
    expect(retried.status).toBe(200);
    expect(retried.body).toEqual({
      ok: true,
      welcomeEmailStatus: "accepted",
      badgeInvitationEmailStatus: "accepted",
    });
    expect(proxy).toHaveBeenCalledTimes(3);
    const [afterRetry] = await db.select().from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.email, retryEmail));
    expect(afterRetry?.welcomeEmailStatus).toBe("accepted");
    expect(afterRetry?.betaBadgeEmailStatus).toBe("accepted");
  });

  it("retries a rejected badge invitation without resending the welcome email", async () => {
    proxy.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: `re_badge_retry_${proxy.mock.calls.length}` }),
    }));
    proxy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "re_first_welcome" }),
    });
    proxy.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

    const signup = {
      email: badgeRetryEmail,
      name: "Retry Player",
      language: "en",
      interests: ["beta_tester"],
      consent: true,
    };
    const failed = await request(app).post("/storigam-interest").send(signup);
    expect(failed.body).toEqual({
      ok: true,
      welcomeEmailStatus: "accepted",
      badgeInvitationEmailStatus: "failed",
    });
    expect(proxy).toHaveBeenCalledTimes(2);

    const retried = await request(app).post("/storigam-interest").send(signup);
    expect(retried.body).toEqual({
      ok: true,
      welcomeEmailStatus: "accepted",
      badgeInvitationEmailStatus: "accepted",
    });
    expect(proxy).toHaveBeenCalledTimes(3);
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
    expect(creators.status).toBe(200);
    expect(all.status).toBe(200);

    const fixtureAudienceChecks = [
      { campaign: beta, expectedFixtures: fixtureEmails.slice(0, 2) },
      { campaign: creators, expectedFixtures: fixtureEmails.slice(2) },
      { campaign: all, expectedFixtures: fixtureEmails },
    ];
    for (const { campaign, expectedFixtures } of fixtureAudienceChecks) {
      const recipients = await pool.query<{ email: string }>(
        "SELECT email FROM storigam_email_recipients WHERE campaign_id = $1",
        [campaign.body.id],
      );
      const campaignEmails = recipients.rows.map(row => row.email);
      expect(campaign.body.total).toBe(campaignEmails.length);
      expect(campaign.body.pending).toBe(campaignEmails.length);
      for (const email of expectedFixtures) expect(campaignEmails).toContain(email);
      const ineligible = await pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM storigam_email_recipients r
         LEFT JOIN storigam_interest_signups s ON s.email = r.email
         WHERE r.campaign_id = $1
           AND (s.email IS NULL OR s.unsubscribed_at IS NOT NULL
             OR ($2 <> 'all' AND NOT ($2 = ANY(s.interests))))`,
        [campaign.body.id, campaign.body.audience],
      );
      expect(ineligible.rows[0]?.total).toBe(0);
    }

    const listed = await request(app).get("/admin/interest/campaigns")
      .set("x-test-user-id", ADMIN_ID);
    expect(listed.status).toBe(200);
    expect(listed.body.campaigns.some((campaign: { id: string }) => campaign.id === beta.body.id)).toBe(true);
  });

  it("dispatches selected recipients with individual unsubscribe links and records provider acceptance", async () => {
    const campaign = await createCampaign("beta_tester");
    const recipients = await pool.query<{ email: string }>(
      "SELECT email FROM storigam_email_recipients WHERE campaign_id = $1 ORDER BY email",
      [campaign.body.id],
    );
    const fixtureRecipientEmails = new Set(fixtureEmails);
    const expectedRecipients = recipients.rows
      .map(row => row.email)
      .filter(email => fixtureRecipientEmails.has(email));
    await pool.query(
      `UPDATE storigam_email_recipients SET status = 'accepted'
       WHERE campaign_id = $1 AND NOT (email = ANY($2::text[]))`,
      [campaign.body.id, expectedRecipients],
    );
    expect(campaign.status).toBe(200);
    expect(campaign.body.total).toBe(recipients.rows.length);

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
    expect(dispatch.body.accepted).toBe(campaign.body.total);
    expect(dispatch.body.failed).toBe(0);
    expect(proxy).toHaveBeenCalledTimes(expectedRecipients.length);

    const payloads = proxy.mock.calls.map((call: [string, string, { headers: Record<string, string>; body: string }]) => {
      expect(call[0]).toBe("resend");
      expect(call[1]).toBe("/emails");
      const body = JSON.parse(call[2].body);
      expect(call[2].headers["Idempotency-Key"]).toMatch(/^storigam-/);
      return body as { to: string[]; text: string };
    });
    const sentAddresses = payloads.map(payload => payload.to[0]);
    expect(new Set(sentAddresses)).toEqual(new Set(expectedRecipients));

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
    expect(new Set(sentTokens).size).toBe(expectedRecipients.length);

    // Re-dispatching an already completed campaign must not send the same emails twice.
    const duplicateDispatch = await request(app)
      .post(`/admin/interest/campaigns/${campaign.body.id}/dispatch`)
      .set("x-test-user-id", ADMIN_ID);
    expect(duplicateDispatch.status).toBe(200);
    expect(duplicateDispatch.body.accepted).toBe(campaign.body.total);
    expect(proxy).toHaveBeenCalledTimes(expectedRecipients.length);
  });

  it("GET unsubscribe is read-only, POST opts out, and later campaigns exclude that signup", async () => {
    const optedOutEmail = fixtureEmails[0];
    const campaign = await createCampaign("beta_tester");
    const [signup] = await db.select().from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.email, optedOutEmail));
    const token = signup!.unsubscribeToken!;
    const campaignRecipients = await pool.query<{ email: string }>(
      "SELECT email FROM storigam_email_recipients WHERE campaign_id = $1",
      [campaign.body.id],
    );
    expect(campaignRecipients.rows.map(row => row.email)).toContain(optedOutEmail);
    const subscribersBefore = await request(app).get("/admin/interest/subscribers")
      .set("x-test-user-id", ADMIN_ID);
    const originalTotal = campaign.body.total;

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

    const subscribersAfter = await request(app).get("/admin/interest/subscribers")
      .set("x-test-user-id", ADMIN_ID);
    expect(subscribersAfter.body.audienceCounts.beta_tester)
      .toBe(subscribersBefore.body.audienceCounts.beta_tester - 1);
    expect(subscribersAfter.body.activeTotal).toBe(subscribersBefore.body.activeTotal - 1);
    const optedOutRecipients = await pool.query<{ status: string }>(
      "SELECT status FROM storigam_email_recipients WHERE campaign_id = $1 AND email = $2",
      [campaign.body.id, optedOutEmail],
    );
    expect(optedOutRecipients.rows[0]?.status).toBe("skipped");

    const updatedCampaigns = await request(app).get("/admin/interest/campaigns")
      .set("x-test-user-id", ADMIN_ID);
    const updatedCampaign = updatedCampaigns.body.campaigns
      .find((item: { id: string }) => item.id === campaign.body.id);
    expect(updatedCampaign.total).toBe(originalTotal - 1);
    expect(updatedCampaign.pending).toBe(campaign.body.pending - 1);

    await pool.query(
      `UPDATE storigam_email_recipients SET status = 'accepted'
       WHERE campaign_id = $1 AND email <> $2`,
      [campaign.body.id, optedOutEmail],
    );
    proxy.mockClear();
    const dispatch = await request(app).post(`/admin/interest/campaigns/${campaign.body.id}/dispatch`)
      .set("x-test-user-id", ADMIN_ID);
    expect(dispatch.status).toBe(200);
    expect(dispatch.body.total).toBe(originalTotal - 1);
    expect(dispatch.body.skipped).toBe(1);
    expect(proxy).not.toHaveBeenCalled();

    const laterCampaign = await createCampaign("beta_tester");
    const laterRecipients = await pool.query<{ email: string }>(
      "SELECT email FROM storigam_email_recipients WHERE campaign_id = $1",
      [laterCampaign.body.id],
    );
    expect(laterCampaign.status).toBe(200);
    expect(laterRecipients.rows.map(row => row.email)).not.toContain(optedOutEmail);
    expect(laterCampaign.body.total).toBe(laterRecipients.rows.length);
  });

  it("serializes unsubscribe confirmation behind a campaign send already in progress", async () => {
    const campaign = await createCampaign("beta_tester");
    await pool.query(
      `UPDATE storigam_email_recipients SET status = 'accepted'
       WHERE campaign_id = $1 AND email <> $2`,
      [campaign.body.id, raceEmail],
    );
    const [signup] = await db.select().from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.email, raceEmail));
    const token = signup!.unsubscribeToken!;

    let beginProviderCall!: () => void;
    const providerStarted = new Promise<void>(resolve => { beginProviderCall = resolve; });
    let acceptProviderCall!: (response: { ok: boolean; status: number; json: () => Promise<{ id: string }> }) => void;
    const pendingProviderResponse = new Promise<{ ok: boolean; status: number; json: () => Promise<{ id: string }> }>(
      resolve => { acceptProviderCall = resolve; },
    );
    proxy.mockImplementation(async () => {
      beginProviderCall();
      return pendingProviderResponse;
    });

    const dispatchPromise = request(app)
      .post(`/admin/interest/campaigns/${campaign.body.id}/dispatch`)
      .set("x-test-user-id", ADMIN_ID)
      .then(response => response);
    await providerStarted;

    let unsubscribeFinished = false;
    const unsubscribePromise = request(app)
      .post(`/storigam-interest/unsubscribe?token=${token}`)
      .then(response => {
        unsubscribeFinished = true;
        return response;
      });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(unsubscribeFinished).toBe(false);

    acceptProviderCall({ ok: true, status: 200, json: async () => ({ id: "re_fixture_race" }) });
    const [dispatch, confirmation] = await Promise.all([dispatchPromise, unsubscribePromise]);
    expect(dispatch.status).toBe(200);
    expect(confirmation.status).toBe(200);
    expect(unsubscribeFinished).toBe(true);
    expect(proxy).toHaveBeenCalledTimes(1);

    const [afterConfirmation] = await db.select().from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.email, raceEmail));
    expect(afterConfirmation?.unsubscribedAt).toBeInstanceOf(Date);
    const laterCampaign = await createCampaign("beta_tester");
    const laterRecipients = await pool.query<{ email: string }>(
      "SELECT email FROM storigam_email_recipients WHERE campaign_id = $1",
      [laterCampaign.body.id],
    );
    expect(laterRecipients.rows.map(row => row.email)).not.toContain(raceEmail);
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