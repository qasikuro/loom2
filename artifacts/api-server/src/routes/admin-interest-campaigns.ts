import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  CreateInterestCampaignBody,
  CreateInterestCampaignResponse,
  DispatchInterestCampaignResponse,
  ListInterestCampaignsResponse,
  ListInterestSubscribersResponse,
} from "@workspace/api-zod";
import { pool } from "@workspace/db";
import rateLimit from "express-rate-limit";
import { Router, type IRouter } from "express";
import { getUserId, requireAdmin } from "../middleware/auth";

const router: IRouter = Router();
const dispatchLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

interface CampaignRow {
  id: string;
  audience: string;
  subject: string;
  message: string;
  created_at: Date;
  total: number;
  accepted: number;
  failed: number;
  pending: number;
  uncertain: number;
  skipped: number;
}

const campaignQuery = `
  SELECT c.id, c.audience, c.subject, c.message, c.created_at,
    COUNT(r.email)::int AS total,
    COUNT(r.email) FILTER (WHERE r.status = 'accepted')::int AS accepted,
    COUNT(r.email) FILTER (WHERE r.status = 'failed')::int AS failed,
    COUNT(r.email) FILTER (WHERE r.status = 'pending')::int AS pending,
    COUNT(r.email) FILTER (WHERE r.status IN ('sending', 'uncertain'))::int AS uncertain,
    COUNT(r.email) FILTER (WHERE r.status = 'skipped')::int AS skipped
  FROM storigam_email_campaigns c
  LEFT JOIN storigam_email_recipients r ON r.campaign_id = c.id
`;

function present(row: CampaignRow) {
  return {
    id: row.id,
    audience: row.audience,
    subject: row.subject,
    message: row.message,
    createdAt: row.created_at.toISOString(),
    total: row.total,
    accepted: row.accepted,
    failed: row.failed,
    pending: row.pending,
    uncertain: row.uncertain,
    skipped: row.skipped,
  };
}

async function getCampaign(id: string) {
  const result = await pool.query<CampaignRow>(
    `${campaignQuery} WHERE c.id = $1 GROUP BY c.id`,
    [id],
  );
  return result.rows[0] ? present(result.rows[0]) : null;
}

router.get("/admin/interest/subscribers", requireAdmin, async (req, res): Promise<void> => {
  try {
    const [list, counts] = await Promise.all([
      pool.query<{
        email: string; interests: string[]; consented_at: Date;
        created_at: Date; unsubscribed_at: Date | null;
      }>(`SELECT email, interests, consented_at, created_at, unsubscribed_at
         FROM storigam_interest_signups ORDER BY created_at DESC LIMIT 500`),
      pool.query<{ total: number; active_total: number; beta_total: number; creator_total: number }>(
        `SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE unsubscribed_at IS NULL)::int AS active_total,
           COUNT(*) FILTER (WHERE unsubscribed_at IS NULL AND 'beta_tester' = ANY(interests))::int AS beta_total,
           COUNT(*) FILTER (WHERE unsubscribed_at IS NULL AND 'content_creator' = ANY(interests))::int AS creator_total
         FROM storigam_interest_signups`,
      ),
    ]);
    res.json(ListInterestSubscribersResponse.parse({
      subscribers: list.rows.map(row => ({
        email: row.email,
        interests: row.interests,
        consentedAt: row.consented_at.toISOString(),
        createdAt: row.created_at.toISOString(),
        unsubscribedAt: row.unsubscribed_at?.toISOString() ?? null,
      })),
      total: counts.rows[0]?.total ?? 0,
      activeTotal: counts.rows[0]?.active_total ?? 0,
      audienceCounts: {
        all: counts.rows[0]?.active_total ?? 0,
        beta_tester: counts.rows[0]?.beta_total ?? 0,
        content_creator: counts.rows[0]?.creator_total ?? 0,
      },
    }));
  } catch {
    req.log.error("Could not list landing subscribers");
    res.status(500).json({ error: "Could not load subscribers." });
  }
});

router.get("/admin/interest/campaigns", requireAdmin, async (req, res): Promise<void> => {
  try {
    const result = await pool.query<CampaignRow>(
      `${campaignQuery} GROUP BY c.id ORDER BY c.created_at DESC LIMIT 50`,
    );
    res.json(ListInterestCampaignsResponse.parse({ campaigns: result.rows.map(present) }));
  } catch {
    req.log.error("Could not list email campaigns");
    res.status(500).json({ error: "Could not load campaigns." });
  }
});

router.post("/admin/interest/campaigns", requireAdmin, dispatchLimit, async (req, res): Promise<void> => {
  const input = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown> : {};
  const parsed = CreateInterestCampaignBody.safeParse({
    ...input,
    subject: typeof input.subject === "string" ? input.subject.trim() : input.subject,
    message: typeof input.message === "string" ? input.message.trim() : input.message,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Choose an audience and enter a subject and message." });
    return;
  }
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO storigam_email_campaigns (id, audience, subject, message, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, parsed.data.audience, parsed.data.subject, parsed.data.message, getUserId(req)],
    );
    const inserted = await client.query(
      `INSERT INTO storigam_email_recipients (campaign_id, email)
       SELECT $1, email FROM storigam_interest_signups
       WHERE unsubscribed_at IS NULL
         AND ($2 = 'all' OR $2 = ANY(interests))`,
      [id, parsed.data.audience],
    );
    if (!inserted.rowCount) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "There are no subscribed people in that audience yet." });
      return;
    }
    await client.query("COMMIT");
    req.log.info({ campaignId: id, recipientCount: inserted.rowCount }, "Email campaign prepared");
    res.json(CreateInterestCampaignResponse.parse(await getCampaign(id)));
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    req.log.error("Could not prepare email campaign");
    res.status(500).json({ error: "Could not prepare this campaign. Nothing was sent." });
  } finally {
    client.release();
  }
});

router.post("/admin/interest/campaigns/:id/dispatch", requireAdmin, dispatchLimit, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ error: "Invalid campaign." });
    return;
  }
  try {
    const campaign = await getCampaign(id);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found." });
      return;
    }

    const configuredOrigin = process.env.STORIGAM_PUBLIC_ORIGIN?.trim();
    let publicOrigin: URL | null = null;
    try {
      if (configuredOrigin) publicOrigin = new URL(configuredOrigin);
    } catch {
      // An invalid configuration must never produce a token-bearing email link.
    }
    if (!publicOrigin || publicOrigin.protocol !== "https:" || publicOrigin.username ||
      publicOrigin.password || publicOrigin.pathname !== "/" || publicOrigin.search || publicOrigin.hash) {
      res.status(503).json({ error: "A public HTTPS Storigam URL is required before sending. Publish the unsubscribe page and configure STORIGAM_PUBLIC_ORIGIN." });
      return;
    }
    const baseUrl = new URL("/api/storigam-interest/unsubscribe", publicOrigin);

    // Claim a small batch atomically so two admin tabs cannot send the same address.
    const claimed = await pool.query<{ email: string }>(
      `WITH next AS (
         SELECT campaign_id, email FROM storigam_email_recipients
         WHERE campaign_id = $1 AND status = 'pending'
         ORDER BY email LIMIT 10 FOR UPDATE SKIP LOCKED
       )
       UPDATE storigam_email_recipients r SET status = 'sending'
       FROM next WHERE r.campaign_id = next.campaign_id AND r.email = next.email
       RETURNING r.email`,
      [id],
    );
    let processed = 0;
    let rateLimited = false;
    for (const { email } of claimed.rows) {
      processed++;
      try {
        const signup = await pool.query<{ unsubscribe_token: string | null; unsubscribed_at: Date | null }>(
          `SELECT unsubscribe_token, unsubscribed_at FROM storigam_interest_signups WHERE email = $1`,
          [email],
        );
        if (!signup.rows[0] || signup.rows[0].unsubscribed_at) {
          await pool.query(
            `UPDATE storigam_email_recipients SET status = 'skipped'
             WHERE campaign_id = $1 AND email = $2`,
            [id, email],
          );
          continue;
        }
        let token = signup.rows[0].unsubscribe_token;
        if (!token) {
          const newToken = randomBytes(32).toString("hex");
          const saved = await pool.query<{ unsubscribe_token: string }>(
            `UPDATE storigam_interest_signups SET unsubscribe_token = $1
             WHERE email = $2 AND unsubscribe_token IS NULL
             RETURNING unsubscribe_token`,
            [newToken, email],
          );
          token = saved.rows[0]?.unsubscribe_token
            ?? (await pool.query<{ unsubscribe_token: string }>(
              `SELECT unsubscribe_token FROM storigam_interest_signups WHERE email = $1`,
              [email],
            )).rows[0]?.unsubscribe_token;
        }
        if (!token) throw new Error("Missing unsubscribe token");
        const latest = await pool.query<{ unsubscribed_at: Date | null }>(
          `SELECT unsubscribed_at FROM storigam_interest_signups WHERE email = $1`,
          [email],
        );
        if (!latest.rows[0] || latest.rows[0].unsubscribed_at) {
          await pool.query(
            `UPDATE storigam_email_recipients SET status = 'skipped'
             WHERE campaign_id = $1 AND email = $2`,
            [id, email],
          );
          continue;
        }
        const unsubscribeUrl = new URL(baseUrl);
        unsubscribeUrl.searchParams.set("token", token);
        const body = `${campaign.message}\n\n—\nYou received this because you signed up for Storigam updates.\nStop these emails: ${unsubscribeUrl.toString()}`;
        const replyTo = process.env.RESEND_REPLY_TO_EMAIL?.trim();
        const from = process.env.RESEND_FROM_EMAIL?.trim() || "Storigam <no-reply@contact.storigam.com>";
        const key = `storigam-${id}-${createHash("sha256").update(email).digest("hex").slice(0, 20)}`;
        const response = await new ReplitConnectors().proxy("resend", "/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": key },
          body: JSON.stringify({
            from, to: [email], subject: campaign.subject, text: body,
            ...(replyTo ? { reply_to: replyTo } : {}),
          }),
        });
        if (!response.ok) {
          req.log.warn({ campaignId: id, providerStatus: response.status }, "Campaign message rejected");
          if (response.status === 429 || response.status >= 500) {
            // Retryable provider rejection: do not consume this recipient or continue this batch.
            await pool.query(
              `UPDATE storigam_email_recipients SET status = 'pending'
               WHERE campaign_id = $1 AND email = $2`,
              [id, email],
            );
            rateLimited = true;
            break;
          }
          await pool.query(
            `UPDATE storigam_email_recipients SET status = 'failed'
             WHERE campaign_id = $1 AND email = $2`,
            [id, email],
          );
          break; // A provider outage should not reject the whole audience.
        }
        const result = await response.json() as { id?: unknown };
        if (typeof result.id !== "string") throw new Error("Provider returned no email ID");
        await pool.query(
          `UPDATE storigam_email_recipients
           SET status = 'accepted', provider_id = $3, sent_at = NOW()
           WHERE campaign_id = $1 AND email = $2`,
          [id, email, result.id],
        );
        // Resend's standard API limit is low; do not flood it with a campaign.
        if (processed < claimed.rows.length) await new Promise(resolve => setTimeout(resolve, 600));
      } catch {
        req.log.error({ campaignId: id }, "Campaign send outcome uncertain; manual review required");
        await pool.query(
          `UPDATE storigam_email_recipients SET status = 'uncertain'
           WHERE campaign_id = $1 AND email = $2`,
          [id, email],
        );
        break; // Do not auto-retry: the provider may have accepted the request.
      }
    }
    // Rows claimed but not attempted remain safe to resume.
    for (const { email } of claimed.rows.slice(processed)) {
      await pool.query(
        `UPDATE storigam_email_recipients SET status = 'pending'
         WHERE campaign_id = $1 AND email = $2 AND status = 'sending'`,
        [id, email],
      );
    }
    if (rateLimited) {
      res.set("Retry-After", "60");
      res.status(429).json({ error: "The email provider is temporarily unavailable or rate-limiting. No more recipients were attempted. Wait and refresh campaign history before resuming." });
      return;
    }
    res.json(DispatchInterestCampaignResponse.parse(await getCampaign(id)));
  } catch {
    req.log.error({ campaignId: id }, "Campaign dispatch failed");
    res.status(503).json({ error: "Could not confirm campaign progress. Check the campaign before retrying." });
  }
});

export default router;