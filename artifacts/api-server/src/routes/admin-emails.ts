import { ReplitConnectors } from "@replit/connectors-sdk";
import { SendAdminEmailBody, SendAdminEmailResponse } from "@workspace/api-zod";
import rateLimit from "express-rate-limit";
import { Router, type IRouter } from "express";
import { getUserId, requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

// Limit accidental repeat sends and protect the provider account from bulk abuse.
const emailRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many emails sent. Please wait a minute before trying again." },
});

router.post("/admin/emails", requireAdmin, emailRateLimit, async (req, res): Promise<void> => {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  const parsed = SendAdminEmailBody.safeParse({
    ...body,
    to: typeof body.to === "string" ? body.to.trim() : body.to,
    subject: typeof body.subject === "string" ? body.subject.trim() : body.subject,
    message: typeof body.message === "string" ? body.message.trim() : body.message,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Enter one valid email address, a subject, and a message." });
    return;
  }

  // This verified domain is configured in Resend. Override the address through
  // RESEND_FROM_EMAIL if a different verified sender is configured later.
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Storigam <no-reply@contact.storigam.com>";

  try {
    const response = await new ReplitConnectors().proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [parsed.data.to],
        subject: parsed.data.subject,
        text: parsed.data.message,
      }),
    });

    if (!response.ok) {
      req.log.warn({ providerStatus: response.status }, "Resend rejected admin email");
      res.status(502).json({ error: "Resend could not send this email. Check the sender configuration and try again." });
      return;
    }

    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== "string") {
      req.log.error("Resend returned a response without an email ID");
      res.status(502).json({ error: "The email provider did not confirm the send. Check Resend before retrying." });
      return;
    }

    req.log.info({ adminUserId: getUserId(req), emailId: result.id }, "Admin email accepted by Resend");
    res.json(SendAdminEmailResponse.parse({ ok: true, id: result.id }));
  } catch (err) {
    req.log.error({ reason: err instanceof Error ? err.name : "unknown" }, "Admin email provider request failed");
    res.status(503).json({ error: "Could not confirm the send. Check Resend before trying again." });
  }
});

export default router;