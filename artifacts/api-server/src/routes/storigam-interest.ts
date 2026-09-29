import {
  SubmitStorigamInterestBody,
  SubmitStorigamInterestResponse,
} from "@workspace/api-zod";
import { db, storigamInterestSignupTable } from "@workspace/db";
import rateLimit from "express-rate-limit";
import { Router, type IRouter } from "express";

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
      .values({ email, interests, consentedAt: now, updatedAt: now })
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

export default router;