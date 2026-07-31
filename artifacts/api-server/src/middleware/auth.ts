import { clerkMiddleware, getAuth } from "@clerk/express";
import type { RequestHandler, Request, Response, NextFunction } from "express";
import { db, characterTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export const clerkAuth = clerkMiddleware() as RequestHandler;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Step 3 — trace what getAuth() returns after clerkMiddleware() has run.
  // REMOVE once the token-rejection root cause is confirmed.
  let userId: string | null = null;
  let sessionId: string | null = null;
  let getAuthErr: string | null = null;
  try {
    const auth = getAuth(req);
    userId    = auth.userId    ?? null;
    sessionId = auth.sessionId ?? null;
  } catch (e) {
    getAuthErr = String(e);
    logger.error({ getAuthErr }, '[CLERK-TRACE-3] getAuth() threw exception in requireAuth');
  }

  logger.info({
    userId,
    sessionId,
    getAuthErr,
    hasAuthHeader: !!req.headers.authorization,
    path: req.path,
  }, '[CLERK-TRACE-3] requireAuth — getAuth() result');

  if (!userId) {
    // Step 4 — userId is null: log why before returning 401.
    logger.warn({
      hasAuthHeader: !!req.headers.authorization,
      getAuthErr,
      path: req.path,
    }, '[CLERK-TRACE-4] userId is null — returning 401');
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [row] = await db
      .select({ isBanned: characterTable.isBanned })
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1);

    if (row?.isBanned) {
      res.status(403).json({ error: "Account suspended" });
      return;
    }
  } catch {
    res.status(500).json({ error: "Internal server error" });
    return;
  }
  next();
}

export function getUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw new Error("No userId on authenticated request");
  return userId;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [row] = await db
      .select({ isAdmin: characterTable.isAdmin, isBanned: characterTable.isBanned })
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1);

    if (row?.isBanned) {
      res.status(403).json({ error: "Account suspended" });
      return;
    }
    if (!row?.isAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
