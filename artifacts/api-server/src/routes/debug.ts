/**
 * Diagnostic endpoint — intentionally has NO auth requirement.
 *
 * Returns the raw Clerk auth state so we can answer the single most
 * important question during APK debugging:
 *   "Does the server see the Authorization header, and does Clerk accept it?"
 *
 * Safe to expose:
 *   - publishableKeyPrefix is already public (baked into every APK build).
 *   - userId is only returned to the caller whose own token was sent; there
 *     is no way to impersonate or look up another user.
 *
 * REMOVE this route once the Google-SSO production data-loading bug is
 * confirmed fixed and no longer needs diagnosis.
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import type { Request, Response } from "express";

const router = Router();

router.get("/debug/auth-state", (req: Request, res: Response) => {
  let authUserId: string | null = null;
  let authSessionId: string | null = null;
  let authError: string | null = null;

  try {
    const auth = getAuth(req);
    authUserId = auth.userId ?? null;
    authSessionId = auth.sessionId ?? null;
  } catch (e) {
    authError = String(e);
  }

  // Clerk sets these response headers when it processes a token.
  // They are read BEFORE the response is sent so they reflect the middleware output.
  const clerkAuthStatus = (res.getHeader("x-clerk-auth-status") as string) ?? null;
  const clerkAuthReason = (res.getHeader("x-clerk-auth-reason") as string) ?? null;

  res.json({
    // Did the request carry a Bearer token at all?
    hasAuthHeader: !!req.headers.authorization,
    // First 40 chars of the raw header — enough to confirm it's a JWT (starts with "Bearer eyJ")
    // and distinguish different tokens, without leaking the full signature.
    tokenPreview: req.headers.authorization?.substring(0, 40) ?? null,
    // What Clerk resolved for this token
    userId: authUserId,
    sessionId: authSessionId,
    // First 24 chars of the server-side publishable key — safe (it's in every APK build).
    // Lets us confirm the server and APK are on the same Clerk instance.
    publishableKeyPrefix: process.env.CLERK_PUBLISHABLE_KEY?.substring(0, 24) ?? null,
    // Runtime environment — useful to confirm production mode is active
    nodeEnv: process.env.NODE_ENV ?? null,
    // Clerk middleware diagnostic headers (null if Clerk didn't set them)
    clerkAuthStatus,
    clerkAuthReason,
    // Capture any auth error from getAuth()
    authError,
  });
});

export default router;
