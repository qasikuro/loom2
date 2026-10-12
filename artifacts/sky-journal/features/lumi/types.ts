export const LUMI_REC_TYPES = ['music', 'guides', 'friends', 'campfire', 'outfit', 'manga', 'journal', 'session', 'chat'] as const;
export type LumiRecType = typeof LUMI_REC_TYPES[number];

export interface LumiRecommendation {
  type: LumiRecType;
  title: string;
  reason: string;
  query?: string;
  draft?: string;
  duration?: 5 | 15 | 30;
}

export type LumiMessageStatus = 'pending' | 'failed' | 'ok';

export interface LumiMessage {
  id: string;
  role: 'user' | 'assistant' | 'note';
  content: string;
  status?: LumiMessageStatus;
  recommendations?: LumiRecommendation[];
  fallback?: boolean;
  feedback?: 'up' | 'down';
}

export interface LumiPreferences {
  game?: string;
  musicStyle?: string;
  duration?: 5 | 15 | 30;
}

export const MAX_MESSAGE = 800;
export const MAX_HISTORY = 20;
const DURATIONS = [5, 15, 30] as const;

function clip(v: unknown, n: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, n) : undefined;
}

/** AI action results are suggestions only: validate enums, strip anything unknown. Never accept URLs/routes. */
export function sanitizeRecommendations(raw: unknown): LumiRecommendation[] {
  if (!Array.isArray(raw)) return [];
  const out: LumiRecommendation[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.type !== 'string' || !(LUMI_REC_TYPES as readonly string[]).includes(o.type)) continue;
    if (o.type === 'chat') continue;
    const title = clip(o.title, 80);
    if (!title) continue;
    const d = typeof o.duration === 'number' && (DURATIONS as readonly number[]).includes(o.duration)
      ? (o.duration as 5 | 15 | 30) : undefined;
    out.push({
      type: o.type as LumiRecType,
      title,
      reason: clip(o.reason, 240) ?? '',
      query: clip(o.query, 80),
      draft: clip(o.draft, 1000),
      duration: d,
    });
    if (out.length >= 3) break;
  }
  return out;
}

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
