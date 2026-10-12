/**
 * Pure session/visit policy. The hook stores one marker per account on
 * globalThis (survives HMR and tab navigation) plus a persisted lastVisit.
 */
import { SESSION_GAP_MS } from './reactionManager';

export type SessionMarker = {
  sessionId: number;
  greeted: boolean;
  lastActiveAt: number;
  suggestOffered: boolean;
  suggestDismissed: boolean;
};

export type VisitRecord = { lastVisitAt: number; welcomedAt: number | null };

export function freshMarker(now: number): SessionMarker {
  return { sessionId: now, greeted: false, lastActiveAt: now, suggestOffered: false, suggestDismissed: false };
}

/** Navigation alone never starts another session or greeting. */
export function ensureMarker(marker: SessionMarker | undefined, now: number): SessionMarker {
  return marker ?? freshMarker(now);
}

/** Called on foreground return, using the actual background departure time. */
export function touchMarker(marker: SessionMarker | undefined, now: number): SessionMarker {
  if (!marker || now - marker.lastActiveAt >= SESSION_GAP_MS) return freshMarker(now);
  return { ...marker, lastActiveAt: now };
}

export const shouldGreet = (marker: SessionMarker): boolean => !marker.greeted;

export function parseVisitRecord(raw: string | null): VisitRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<VisitRecord>;
    if (typeof v.lastVisitAt !== 'number' || !Number.isFinite(v.lastVisitAt)) return null;
    return { lastVisitAt: v.lastVisitAt, welcomedAt: typeof v.welcomedAt === 'number' ? v.welcomedAt : null };
  } catch {
    return null;
  }
}

export const visitStorageKey = (userId: string) => `storigam.lumiHome.visit.${userId}`;
