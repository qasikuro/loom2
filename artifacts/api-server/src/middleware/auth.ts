import { clerkMiddleware, getAuth } from "@clerk/express";
import type { RequestHandler, Request, Response, NextFunction } from "express";
import { db, characterTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const clerkAuth = clerkMiddleware() as RequestHandler;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
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
      .select({ isAdmin: characterTable.isAdmin })
      .from(characterTable)
      .where(eq(characterTable.userId, userId))
      .limit(1);

    if (!row?.isAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
}
