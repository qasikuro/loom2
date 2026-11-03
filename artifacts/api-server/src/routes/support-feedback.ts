import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  SubmitStorigamFeedbackBody,
  SubmitStorigamFeedbackResponse,
} from "@workspace/api-zod";
import rateLimit from "express-rate-limit";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

const feedbackRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== "production",
  message: { error: "Too many feedback submissions. Please try again later." },
});

const categoryLabels = {
  idea: "Product idea",
  bug: "Bug report",
  other: "Other feedback",
} as const;

router.post("/support/feedback", feedbackRateLimit, async (req, res): Promise<void> => {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  const parsed = SubmitStorigamFeedbackBody.safeParse({
    ...body,
    name: typeof body.name === "string" ? body.name.trim() : body.name,
    email: typeof body.email === "string" ? body.email.trim() : body.email,
    message: typeof body.message === "string" ? body.message.trim() : body.message,
    website: typeof body.website === "string" ? body.website.trim() : body.website,
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Choose a feedback type and enter a message of at least 10 characters." });
    return;
  }

  // Quietly accept the hidden honeypot field to avoid encouraging basic bots to retry.
  if (parsed.data.website?.length) {
    res.json(SubmitStorigamFeedbackResponse.parse({ ok: true }));
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Storigam <no-reply@contact.storigam.com>";
  const replyTo = parsed.data.email;
  const text = [
    `Type: ${categoryLabels[parsed.data.category]}`,
    parsed.data.name ? `Name: ${parsed.data.name}` : undefined,
    replyTo ? `Reply email: ${replyTo}` : "Reply email: not provided",
    "",
    parsed.data.message,
  ].filter((line): line is string => line !== undefined).join("\n");

  try {
    const response = await new ReplitConnectors().proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: ["shpport@gmail.com"],
        subject: `[Storigam feedback] ${categoryLabels[parsed.data.category]}`,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!response.ok) {
      req.log.warn({ providerStatus: response.status }, "Resend rejected Storigam feedback");
      res.status(503).json({ error: "Feedback could not be delivered right now. Please email shpport@gmail.com." });
      return;
    }

    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== "string") {
      req.log.error("Resend returned a response without an email ID for Storigam feedback");
      res.status(503).json({ error: "Feedback delivery could not be confirmed. Please email shpport@gmail.com." });
      return;
    }

    req.log.info({ emailId: result.id }, "Storigam feedback accepted by Resend");
    res.json(SubmitStorigamFeedbackResponse.parse({ ok: true }));
  } catch (error) {
    req.log.error(
      { reason: error instanceof Error ? error.name : "unknown" },
      "Storigam feedback provider request failed",
    );
    res.status(503).json({ error: "Feedback could not be delivered right now. Please email shpport@gmail.com." });
  }
});

export default router;
