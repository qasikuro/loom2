/**
 * Pure Lumi helpers (no React / React Native imports) so they can be unit tested.
 */

export const LUMI_MOODS = ['unknown', 'neutral', 'sad', 'lonely', 'stressed', 'tired', 'happy', 'calm', 'excited'] as const;
export const LUMI_PHASES = ['check_in', 'conversation', 'suggest', 'support'] as const;
export const LUMI_EMOTIONS = ['thoughtful', 'affectionate', 'excited', 'calm'] as const;
export const LUMI_INTENTS = ['unspecified', 'company', 'quiet', 'creative', 'focus'] as const;
export type LumiMood = typeof LUMI_MOODS[number];
export type LumiPhase = typeof LUMI_PHASES[number];
export type LumiEmotion = typeof LUMI_EMOTIONS[number];
export type LumiIntent = typeof LUMI_INTENTS[number];

export interface LumiMeta { mood?: LumiMood; phase?: LumiPhase; emotion?: LumiEmotion; intent?: LumiIntent }

function pick<T extends string>(list: readonly T[], v: unknown): T | undefined {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** Optional conversation metadata. Older servers omit it; unknown values are dropped. */
export function sanitizeMeta(raw: unknown): LumiMeta {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: LumiMeta = {};
  const mood = pick(LUMI_MOODS, o.mood);
  const phase = pick(LUMI_PHASES, o.phase);
  const emotion = pick(LUMI_EMOTIONS, o.emotion);
  if (mood) out.mood = mood;
  if (phase) out.phase = phase;
  if (emotion) out.emotion = emotion;
  const intent = pick(LUMI_INTENTS, o.intent);
  if (intent) out.intent = intent;
  return out;
}

/** Latest temporary mood from this session's assistant replies (never persisted). */
export function latestMood(msgs: { role: string; mood?: LumiMood }[]): LumiMood | undefined {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === 'assistant' && m.mood) return m.mood === 'unknown' ? undefined : m.mood;
  }
  return undefined;
}

/** Gentle default music search derived from the current conversational mood. */
export function musicQueryForMood(mood: LumiMood | undefined, fallback: string): string {
  switch (mood) {
    case 'tired': return 'lofi chill';
    case 'stressed': return 'ambient calm';
    case 'sad': case 'lonely': return 'acoustic warm';
    case 'happy': return 'feel good';
    case 'excited': return 'upbeat electronic';
    case 'calm': return 'piano ambient';
    default: return fallback;
  }
}

/** Alternative styles offered when a player wants different taste. */
export const ALT_STYLES = ['lofi', 'ambient', 'synthwave', 'acoustic', 'jazz', 'chiptune', 'piano', 'indie'] as const;

export function alternateStyles(current: string, genres: (string | null | undefined)[], n = 4): string[] {
  const cur = current.trim().toLowerCase();
  const seen = new Set(genres.filter(Boolean).map(g => String(g).toLowerCase()));
  return ALT_STYLES.filter(s => !cur.includes(s) && !seen.has(s)).slice(0, n);
}

// ─── Queue ───────────────────────────────────────────────────────────────────
export interface QueueTrack { id: string; artist?: string }

export function queueIndex(queue: QueueTrack[], id: string | null | undefined): number {
  return id ? queue.findIndex(t => t.id === id) : -1;
}
export function nextInQueue<T extends QueueTrack>(queue: T[], id: string | null | undefined): T | null {
  const i = queueIndex(queue, id);
  if (i < 0) return queue[0] ?? null;
  return queue[i + 1] ?? null;
}
export function prevInQueue<T extends QueueTrack>(queue: T[], id: string | null | undefined): T | null {
  const i = queueIndex(queue, id);
  return i > 0 ? queue[i - 1] : null;
}
/** De-duplicated queue, at most `max` tracks. */
export function buildQueue<T extends QueueTrack>(tracks: T[], max = 30): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const t of tracks) {
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
/** Next page of picks, preferring artists not shown yet. */
export function differentArtists<T extends QueueTrack>(pool: T[], shown: T[], n = 3): T[] {
  const shownIds = new Set(shown.map(t => t.id));
  const shownArtists = new Set(shown.map(t => (t.artist ?? '').toLowerCase()));
  const rest = pool.filter(t => !shownIds.has(t.id));
  const fresh = rest.filter(t => !shownArtists.has((t.artist ?? '').toLowerCase()));
  const picked: T[] = [];
  const artists = new Set<string>();
  for (const t of fresh) {
    const a = (t.artist ?? '').toLowerCase();
    if (artists.has(a)) continue;
    artists.add(a); picked.push(t);
    if (picked.length >= n) return picked;
  }
  for (const t of rest) {
    if (picked.length >= n) break;
    if (!picked.includes(t)) picked.push(t);
  }
  return picked;
}

/** Natural end of track: was playing, now idle, without a manual action or error. */
export function isNaturalEnd(p: {
  prevPlayingId: string | null; playingId: string | null; pausedId: string | null;
  loadingId: string | null; errorId: string | null; manual: boolean;
}): boolean {
  return !!p.prevPlayingId && !p.manual && p.playingId === null && p.pausedId === null
    && p.loadingId === null && p.errorId !== p.prevPlayingId;
}

// ─── Campfire ────────────────────────────────────────────────────────────────
export interface RankableRoom { id: string; name: string; mood: string; soulCount: number }

/** Active rooms (recent chatters) first, then quiet rooms; query match breaks ties. */
export function rankCampfires<T extends RankableRoom>(rooms: T[], query?: string): { active: T[]; quiet: T[] } {
  const words = (query ?? '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const score = (r: T) => words.reduce((n, w) => n + (`${r.name} ${r.mood}`.toLowerCase().includes(w) ? 1 : 0), 0);
  const valid = rooms.filter(r => r && typeof r.id === 'string' && typeof r.name === 'string');
  const n = (r: T) => (Number.isFinite(r.soulCount) && r.soulCount > 0 ? Math.floor(r.soulCount) : 0);
  const active = valid.filter(r => n(r) > 0).sort((a, b) => n(b) - n(a) || score(b) - score(a));
  const quiet = valid.filter(r => n(r) === 0).sort((a, b) => score(b) - score(a));
  return { active, quiet };
}

// ─── Guided session ──────────────────────────────────────────────────────────
export const SESSION_MINUTES = [5, 15, 30] as const;
export type SessionMinutes = typeof SESSION_MINUTES[number];
export interface ActiveSession { start: number; duration: number }

export function sessionProgress(s: ActiveSession, now: number) {
  const elapsed = Math.max(0, Math.floor((now - s.start) / 1000));
  const remaining = Math.max(0, s.duration - elapsed);
  const ratio = s.duration > 0 ? Math.min(1, elapsed / s.duration) : 1;
  return { elapsed: Math.min(elapsed, s.duration), remaining, ratio, done: remaining === 0 };
}
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
/** Valid saved state (same 8h freshness rule as the drift loader). */
export function isResumable(s: Partial<ActiveSession> | null | undefined, now: number): s is ActiveSession {
  return !!s && typeof s.start === 'number' && typeof s.duration === 'number' && s.duration > 0
    && now - s.start >= 0 && now - s.start < 8 * 3600 * 1000;
}

// ─── Chat character cue ──────────────────────────────────────────────────────
export type ChatCue = 'tapAffectionate' | 'tapExcited' | 'returnSameDay' | 'tapShy' | 'celebrate' | null;
export function cueForReply(meta: LumiMeta): ChatCue {
  if (meta.emotion === 'affectionate' || meta.mood === 'sad' || meta.mood === 'lonely') return 'tapAffectionate';
  if (meta.emotion === 'excited' || meta.mood === 'excited') return 'tapExcited';
  if (meta.emotion === 'thoughtful' || meta.emotion === 'calm') return null;
  return 'returnSameDay';
}

// ─── Session ideas (transient, from this conversation only) ──────────────────
export type SessionIdea = 'pick' | 'water' | 'stretch' | 'hello' | 'enjoy' | 'breathe' | 'quietSpot' | 'create' | 'goal' | 'music';
export interface ChatContext { company?: boolean; quiet?: boolean; creative?: boolean; focus?: boolean }

/** Reads recent user lines only for this session; nothing is stored. */
export function readChatContext(texts: string[], intent?: LumiIntent): ChatContext {
  // Structured preference is language-independent and takes precedence over older text.
  if (intent) return {
    quiet: intent === 'quiet', company: intent === 'company',
    creative: intent === 'creative', focus: intent === 'focus',
  };
  const t = texts.slice(-6).join(' ').toLowerCase();
  const has = (re: RegExp) => re.test(t);
  const quiet = has(/\b(alone|quiet|by myself|solo|no one|nobody|space|peace)\b/);
  return {
    quiet,
    company: !quiet && has(/\b(friends?|company|people|someone|talk to|together|lonely)\b/),
    creative: has(/\b(draw|create|write|outfit|manga|art|make something|journal)\b/),
    focus: has(/\b(focus|goal|grind|level|rank|practice|progress)\b/),
  };
}

/** Optional, gentle ideas. Social ideas only when the player wants company. */
export function sessionIdeas(mood: LumiMood | undefined, ctx: ChatContext): SessionIdea[] {
  const out: SessionIdea[] = [];
  const add = (i: SessionIdea) => { if (!out.includes(i)) out.push(i); };
  const wantsCompany = !ctx.quiet && !!ctx.company;
  // Lead with the player's request, not a generic checklist.
  if (wantsCompany) add('hello');
  if (ctx.quiet) add('quietSpot');
  if (ctx.creative) add('create');
  if (ctx.focus) add('goal');
  if (mood === 'stressed' || mood === 'tired' || mood === 'sad') { add('breathe'); add('water'); }
  if (!out.length) add('pick');
  if (mood === 'calm' || mood === 'sad' || mood === 'stressed') add('music');
  add('stretch'); add('water'); add('enjoy');
  return out.slice(0, 3);
}
