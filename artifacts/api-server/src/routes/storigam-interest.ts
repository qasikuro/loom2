import { randomBytes } from "node:crypto";
import {
  SubmitStorigamInterestBody,
  SubmitStorigamInterestResponse,
} from "@workspace/api-zod";
import { db, storigamInterestSignupTable } from "@workspace/db";
import rateLimit from "express-rate-limit";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";

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
  };
  const parsed = SubmitStorigamInterestBody.safeParse(normalizedBody);

  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email, choose an option, and agree to be contacted." });
    return;
  }

  // Quietly accept honeypot submissions so basic bots do not retry the form.
  if (parsed.data.website?.trim()) {
    res.status(200).json(SubmitStorigamInterestResponse.parse({ ok: true }));
    return;
  }

  if (!parsed.data.consent) {
    res.status(400).json({ error: "Consent is required to submit your interest." });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const interests = [...new Set(parsed.data.interests)];
  const now = new Date();

  try {
    await db
      .insert(storigamInterestSignupTable)
      .values({
        email, interests, consentedAt: now, updatedAt: now,
        unsubscribeToken: randomBytes(32).toString("hex"),
      })
      .onConflictDoUpdate({
        target: storigamInterestSignupTable.email,
        set: { interests, consentedAt: now, updatedAt: now },
      });

    res.status(200).json(SubmitStorigamInterestResponse.parse({ ok: true }));
  } catch (err) {
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
  const updated = await db.update(storigamInterestSignupTable)
    .set({ unsubscribedAt: new Date() })
    .where(eq(storigamInterestSignupTable.unsubscribeToken, token))
    .returning({ email: storigamInterestSignupTable.email });
  if (!updated.length) {
    res.status(404).type("html").send(unsubscribePage("This unsubscribe link is unavailable."));
    return;
  }
  res.type("html").send(unsubscribePage("You have been unsubscribed. No more Storigam campaign emails will be sent to this address."));
});

export default router;