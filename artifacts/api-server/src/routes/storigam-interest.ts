import { createHash, randomBytes } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  SubmitStorigamInterestBody,
  SubmitStorigamInterestResponse,
} from "@workspace/api-zod";
import { db, storigamInterestSignupTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { Router, type IRouter } from "express";
import {
  buildStorigamInterestWelcomeEmail,
  normalizeStorigamInterestLanguage,
} from "./storigam-interest-welcome-email";
import { buildStorigamBetaBadgeEmail } from "./storigam-beta-badge-email";

const router: IRouter = Router();

const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== "production",
  message: { error: "Too many signup attempts. Please try again later." },
});

router.post("/storigam-interest", signupRateLimit, async (req, res): Promise<void> => {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
  const normalizedBody = {
    ...body,
    email: typeof body.email === "string" ? body.email.trim() : body.email,
    name: typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : body.name,
    language: normalizeStorigamInterestLanguage(body.language),
  };
  const parsed = SubmitStorigamInterestBody.safeParse(normalizedBody);

  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email, choose an option, and agree to be contacted." });
    return;
  }

  // Quietly accept honeypot submissions so basic bots do not retry the form.
  if (parsed.data.website?.trim()) {
    res.status(200).json(SubmitStorigamInterestResponse.parse({
      ok: true,
      welcomeEmailStatus: "pending",
      badgeInvitationEmailStatus: "not_applicable",
    }));
    return;
  }

  if (!parsed.data.consent) {
    res.status(400).json({ error: "Consent is required to submit your interest." });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const interests = [...new Set(parsed.data.interests)];
  const now = new Date();
  const unsubscribeToken = randomBytes(32).toString("hex");

  try {
    await db
      .insert(storigamInterestSignupTable)
      .values({
        email,
        name: parsed.data.name,
        preferredLanguage: parsed.data.language ?? "en",
        interests,
        consentedAt: now,
        updatedAt: now,
        unsubscribeToken,
        welcomeEmailStatus: "pending",
        betaBadgeEmailStatus: interests.includes("beta_tester") ? "pending" : "not_applicable",
      })
      .onConflictDoUpdate({
        target: storigamInterestSignupTable.email,
        set: {
          name: parsed.data.name,
          preferredLanguage: parsed.data.language ?? "en",
          interests,
          consentedAt: now,
          updatedAt: now,
          unsubscribedAt: null,
          unsubscribeToken: sql`COALESCE(${storigamInterestSignupTable.unsubscribeToken}, ${unsubscribeToken})`,
          welcomeEmailStatus: sql`
            CASE
              WHEN ${storigamInterestSignupTable.welcomeEmailStatus} = 'legacy'
                OR ${storigamInterestSignupTable.unsubscribedAt} IS NOT NULL
              THEN 'pending'
              ELSE ${storigamInterestSignupTable.welcomeEmailStatus}
            END
          `,
          betaBadgeEmailStatus: interests.includes("beta_tester")
            ? sql`
                CASE
                  WHEN ${storigamInterestSignupTable.betaBadgeEmailStatus} IN ('accepted', 'sending', 'uncertain')
                    THEN ${storigamInterestSignupTable.betaBadgeEmailStatus}
                  ELSE 'pending'
                END
              `
            : sql`
                CASE
                  WHEN ${storigamInterestSignupTable.betaBadgeEmailStatus} IN ('accepted', 'sending', 'uncertain')
                    THEN ${storigamInterestSignupTable.betaBadgeEmailStatus}
                  ELSE 'not_applicable'
                END
              `,
        },
      });

    // Claim one welcome-email attempt at a time. A duplicate form submission
    // cannot send a second copy while the first request is in flight.
    let welcomeEmailStatus: "accepted" | "failed" | "pending" = "pending";
    const [claimedSignup] = await db
      .update(storigamInterestSignupTable)
      .set({ welcomeEmailStatus: "sending", updatedAt: new Date() })
      .where(and(
        eq(storigamInterestSignupTable.email, email),
        inArray(storigamInterestSignupTable.welcomeEmailStatus, ["pending", "failed"]),
      ))
      .returning({
        name: storigamInterestSignupTable.name,
        preferredLanguage: storigamInterestSignupTable.preferredLanguage,
        unsubscribeToken: storigamInterestSignupTable.unsubscribeToken,
      });

    if (claimedSignup) {
      try {
        if (!claimedSignup.unsubscribeToken) {
          throw new Error("Missing unsubscribe token");
        }
        const publicOrigin = process.env.STORIGAM_PUBLIC_ORIGIN?.trim() || "https://storigam.com";
        const unsubscribeUrl = new URL("/api/storigam-interest/unsubscribe", publicOrigin);
        unsubscribeUrl.searchParams.set("token", claimedSignup.unsubscribeToken);
        const { subject, text } = buildStorigamInterestWelcomeEmail(
          claimedSignup.name,
          claimedSignup.preferredLanguage,
          unsubscribeUrl.toString(),
        );
        const idempotencyKey = `storigam-beta-welcome-v1-${createHash("sha256")
          .update(email)
          .digest("hex")
          .slice(0, 32)}`;
        const from = process.env.RESEND_FROM_EMAIL?.trim()
          || "Storigam <no-reply@contact.storigam.com>";
        const response = await new ReplitConnectors().proxy("resend", "/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ from, to: [email], subject, text }),
        });

        if (!response.ok) {
          await db.update(storigamInterestSignupTable)
            .set({ welcomeEmailStatus: "failed", updatedAt: new Date() })
            .where(and(
              eq(storigamInterestSignupTable.email, email),
              eq(storigamInterestSignupTable.welcomeEmailStatus, "sending"),
            ));
          welcomeEmailStatus = "failed";
          req.log.warn({ providerStatus: response.status }, "Resend rejected beta welcome email");
        } else {
          const result = await response.json() as { id?: unknown };
          if (typeof result.id !== "string") {
            throw new Error("Resend returned no email ID");
          }
          await db.update(storigamInterestSignupTable)
            .set({
              welcomeEmailStatus: "accepted",
              welcomeEmailId: result.id,
              welcomeEmailSentAt: new Date(),
              updatedAt: new Date(),
            })
            .where(and(
              eq(storigamInterestSignupTable.email, email),
              eq(storigamInterestSignupTable.welcomeEmailStatus, "sending"),
            ));
          welcomeEmailStatus = "accepted";
          req.log.info({ emailId: result.id }, "Beta welcome email accepted by Resend");
        }
      } catch (error) {
        await db.update(storigamInterestSignupTable)
          .set({ welcomeEmailStatus: "uncertain", updatedAt: new Date() })
          .where(and(
            eq(storigamInterestSignupTable.email, email),
            eq(storigamInterestSignupTable.welcomeEmailStatus, "sending"),
          ))
          .catch(() => undefined);
        welcomeEmailStatus = "pending";
        req.log.error(
          { reason: error instanceof Error ? error.name : "unknown" },
          "Beta welcome email outcome is uncertain",
        );
      }
    } else {
      try {
        const [savedSignup] = await db
          .select({ status: storigamInterestSignupTable.welcomeEmailStatus })
          .from(storigamInterestSignupTable)
          .where(eq(storigamInterestSignupTable.email, email))
          .limit(1);
        if (savedSignup?.status === "accepted" || savedSignup?.status === "failed") {
          welcomeEmailStatus = savedSignup.status;
        }
      } catch {
        // The interest is already saved; don't turn a status-read hiccup into a signup failure.
      }
    }

    let badgeInvitationEmailStatus: "accepted" | "failed" | "pending" | "not_applicable" =
      interests.includes("beta_tester") ? "pending" : "not_applicable";

    // The badge invitation follows the welcome email and is sent only to
    // consented beta testers. Its own claim/status prevents duplicate mail
    // and allows a later form retry after a definite provider rejection.
    if (interests.includes("beta_tester") && welcomeEmailStatus === "accepted") {
      const [claimedBadgeEmail] = await db
        .update(storigamInterestSignupTable)
        .set({ betaBadgeEmailStatus: "sending", updatedAt: new Date() })
        .where(and(
          eq(storigamInterestSignupTable.email, email),
          inArray(storigamInterestSignupTable.betaBadgeEmailStatus, ["pending", "failed"]),
        ))
        .returning({
          preferredLanguage: storigamInterestSignupTable.preferredLanguage,
          unsubscribeToken: storigamInterestSignupTable.unsubscribeToken,
        });

      if (claimedBadgeEmail) {
        try {
          if (!claimedBadgeEmail.unsubscribeToken) {
            throw new Error("Missing unsubscribe token");
          }
          const publicOrigin = process.env.STORIGAM_PUBLIC_ORIGIN?.trim() || "https://storigam.com";
          const unsubscribeUrl = new URL("/api/storigam-interest/unsubscribe", publicOrigin);
          unsubscribeUrl.searchParams.set("token", claimedBadgeEmail.unsubscribeToken);
          const { subject, text } = buildStorigamBetaBadgeEmail(
            claimedBadgeEmail.preferredLanguage,
            unsubscribeUrl.toString(),
          );
          const idempotencyKey = `storigam-beta-badge-v1-${createHash("sha256")
            .update(email)
            .digest("hex")
            .slice(0, 32)}`;
          const from = process.env.RESEND_FROM_EMAIL?.trim()
            || "Storigam <no-reply@contact.storigam.com>";
          const response = await new ReplitConnectors().proxy("resend", "/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
              from,
              to: [email],
              reply_to: "support@storigam.com",
              subject,
              text,
            }),
          });

          if (!response.ok) {
            await db.update(storigamInterestSignupTable)
              .set({ betaBadgeEmailStatus: "failed", updatedAt: new Date() })
              .where(and(
                eq(storigamInterestSignupTable.email, email),
                eq(storigamInterestSignupTable.betaBadgeEmailStatus, "sending"),
              ));
            badgeInvitationEmailStatus = "failed";
            req.log.warn({ providerStatus: response.status }, "Resend rejected beta badge invitation");
          } else {
            const result = await response.json() as { id?: unknown };
            if (typeof result.id !== "string") {
              throw new Error("Resend returned no email ID");
            }
            await db.update(storigamInterestSignupTable)
              .set({
                betaBadgeEmailStatus: "accepted",
                betaBadgeEmailId: result.id,
                betaBadgeEmailSentAt: new Date(),
                updatedAt: new Date(),
              })
              .where(and(
                eq(storigamInterestSignupTable.email, email),
                eq(storigamInterestSignupTable.betaBadgeEmailStatus, "sending"),
              ));
            badgeInvitationEmailStatus = "accepted";
            req.log.info({ emailId: result.id }, "Beta badge invitation accepted by Resend");
          }
        } catch (error) {
          await db.update(storigamInterestSignupTable)
            .set({ betaBadgeEmailStatus: "uncertain", updatedAt: new Date() })
            .where(and(
              eq(storigamInterestSignupTable.email, email),
              eq(storigamInterestSignupTable.betaBadgeEmailStatus, "sending"),
            ))
            .catch(() => undefined);
          badgeInvitationEmailStatus = "pending";
          req.log.error(
            { reason: error instanceof Error ? error.name : "unknown" },
            "Beta badge invitation outcome is uncertain",
          );
        }
      } else {
        try {
          const [savedSignup] = await db
            .select({ status: storigamInterestSignupTable.betaBadgeEmailStatus })
            .from(storigamInterestSignupTable)
            .where(eq(storigamInterestSignupTable.email, email))
            .limit(1);
          if (savedSignup?.status === "accepted" || savedSignup?.status === "failed") {
            badgeInvitationEmailStatus = savedSignup.status;
          }
        } catch {
          // The signup is saved; a status-read hiccup should not undo it.
        }
      }
    } else if (interests.includes("beta_tester")) {
      try {
        const [savedSignup] = await db
          .select({ status: storigamInterestSignupTable.betaBadgeEmailStatus })
          .from(storigamInterestSignupTable)
          .where(eq(storigamInterestSignupTable.email, email))
          .limit(1);
        if (savedSignup?.status === "accepted" || savedSignup?.status === "failed") {
          badgeInvitationEmailStatus = savedSignup.status;
        }
      } catch {
        // The signup is saved; a status-read hiccup should not undo it.
      }
    }

    res.status(200).json(SubmitStorigamInterestResponse.parse({
      ok: true,
      welcomeEmailStatus,
      badgeInvitationEmailStatus,
    }));
  } catch {
    req.log.error("Failed to save Storigam beta interest");
    res.status(500).json({ error: "We couldn't save your interest. Please try again." });
  }
});

function unsubscribePage(content: string, action?: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Storigam email preferences</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#faf7f1;color:#171b26;margin:0;min-height:100vh;display:grid;place-items:center;padding:20px}main{max-width:460px;background:white;border:1px solid #ddd;border-radius:16px;padding:32px}h1{line-height:1.2}button{background:#343fc1;color:white;border:0;border-radius:8px;padding:12px 20px;cursor:pointer}</style></head><body><main><h1>Storigam email preferences</h1><p>${content}</p>${action ? `<form method="post" action="${action}"><button type="submit">Unsubscribe</button></form>` : ""}</main></body></html>`;
}

router.get("/storigam-interest/unsubscribe", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store").set("Referrer-Policy", "no-referrer");
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    res.status(404).type("html").send(unsubscribePage("This unsubscribe link is unavailable."));
    return;
  }
  const [signup] = await db.select({ email: storigamInterestSignupTable.email, unsubscribedAt: storigamInterestSignupTable.unsubscribedAt })
    .from(storigamInterestSignupTable).where(eq(storigamInterestSignupTable.unsubscribeToken, token)).limit(1);
  if (!signup) {
    res.status(404).type("html").send(unsubscribePage("This unsubscribe link is unavailable."));
    return;
  }
  if (signup.unsubscribedAt) {
    res.type("html").send(unsubscribePage("You are already unsubscribed from Storigam updates."));
    return;
  }
  res.type("html").send(unsubscribePage(
    "If you no longer want updates about the programs you selected, confirm below. You will not receive future campaign emails.",
    `/api/storigam-interest/unsubscribe?token=${token}`,
  ));
});

router.post("/storigam-interest/unsubscribe", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store").set("Referrer-Policy", "no-referrer");
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    res.status(404).type("html").send(unsubscribePage("This unsubscribe link is unavailable."));
    return;
  }
  const updated = await db.transaction(async tx => {
    const [signupToUnsubscribe] = await tx.select({ email: storigamInterestSignupTable.email })
      .from(storigamInterestSignupTable)
      .where(eq(storigamInterestSignupTable.unsubscribeToken, token))
      .limit(1);
    if (!signupToUnsubscribe) return [];
    // Serialize opt-out confirmation with any campaign send for this address.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(
      hashtext('storigam-campaign-email'), hashtext(${signupToUnsubscribe.email})
    )`);
    const signup = await tx.update(storigamInterestSignupTable)
      .set({ unsubscribedAt: new Date() })
      .where(eq(storigamInterestSignupTable.unsubscribeToken, token))
      .returning({ email: storigamInterestSignupTable.email });
    if (signup[0]) {
      await tx.execute(sql`UPDATE storigam_email_recipients
        SET status = 'skipped'
        WHERE email = ${signup[0].email} AND status = 'pending'`);
    }
    return signup;
  });
  if (!updated.length) {
    res.status(404).type("html").send(unsubscribePage("This unsubscribe link is unavailable."));
    return;
  }
  res.type("html").send(unsubscribePage("You have been unsubscribed. No more Storigam campaign emails will be sent to this address."));
});

export default router;