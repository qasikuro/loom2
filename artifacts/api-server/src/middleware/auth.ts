import { clerkMiddleware, getAuth } from "@clerk/express";
import type { RequestHandler, Request, Response, NextFunction } from "express";

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
