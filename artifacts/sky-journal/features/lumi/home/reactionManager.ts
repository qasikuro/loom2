/**
 * Layer B — pure, deterministic reaction rules for the home Lumi.
 * No React, no timers, no storage: every function takes `now` explicitly so
 * the policy can be unit tested.
 */
import type { LumiCreationKind } from './events';

export type TapReaction = 'tapShy' | 'tapDramatic' | 'tapExcited' | 'tapAffectionate';
export type GreetingReaction = 'welcomeNew' | 'returnSameDay' | 'returnSleepy';
export type LumiReaction = TapReaction | GreetingReaction | 'celebrate' | 'suggestCreate';

export const PRIORITY: Record<LumiReaction, number> = {
  tapShy: 4, tapDramatic: 4, tapExcited: 4, tapAffectionate: 4,
  celebrate: 3,
  welcomeNew: 2, returnSameDay: 2, returnSleepy: 2,
  suggestCreate: 1,
};

export const TAP_CYCLE: readonly TapReaction[] = ['tapShy', 'tapDramatic', 'tapExcited', 'tapAffectionate'];
export const TAP_COOLDOWN_MS = 1800;
export const SAME_REACTION_COOLDOWN_MS = 4000;
export const DAY_MS = 24 * 60 * 60 * 1000;
/** A Clerk account created this recently, with no local visit record, is a fresh sign-up. */
export const NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
export const SESSION_GAP_MS = 30 * 60 * 1000;

export type Candidate = {
  key: string;
  reaction: LumiReaction;
  creationKind?: LumiCreationKind;
  contentId?: string;
};

export type Playing = Candidate & { startedAt: number };

export type ManagerState = {
  current: Playing | null;
  queue: Candidate[];
  handled: string[];          // dedup keys already played/consumed
  lastTapAt: number;
  tapIndex: number;
  lastPlayedAt: Partial<Record<LumiReaction, number>>;
};

export const initialManagerState = (): ManagerState => ({
  current: null, queue: [], handled: [], lastTapAt: -Infinity, tapIndex: 0, lastPlayedAt: {},
});

const HANDLED_CAP = 64;
const remember = (handled: string[], key: string) => [...handled.filter(k => k !== key), key].slice(-HANDLED_CAP);

/** Greeting decision from reliable data only — never infers mood or loneliness. */
export function decideGreeting(input: {
  lastVisitAt: number | null;
  accountCreatedAt: number | null;
  now: number;
}): GreetingReaction {
  const { lastVisitAt, accountCreatedAt, now } = input;
  if (lastVisitAt != null) return now - lastVisitAt >= DAY_MS ? 'returnSleepy' : 'returnSameDay';
  // No local record: only a verifiably fresh account is "new". An older
  // account on a new device / cleared storage is a returning user.
  if (accountCreatedAt != null) {
    const age = now - accountCreatedAt;
    if (age >= -2 * 60 * 1000 && age <= NEW_ACCOUNT_WINDOW_MS) return 'welcomeNew';
  }
  return 'returnSameDay';
}

/** The gentle "make something" offer: only with confirmed-complete, empty data. */
export function shouldSuggestCreate(input: {
  dataReady: boolean;
  storyCount: number;
  journalCount: number;
  outfitCount: number;
  offeredThisSession: boolean;
  dismissedThisSession: boolean;
}): boolean {
  if (!input.dataReady || input.offeredThisSession || input.dismissedThisSession) return false;
  return input.storyCount === 0 && input.journalCount === 0 && input.outfitCount === 0;
}

/** Queue a non-tap candidate. Rejects duplicates by key. */
export function enqueue(state: ManagerState, cand: Candidate): { state: ManagerState; accepted: boolean } {
  if (state.handled.includes(cand.key) || state.current?.key === cand.key || state.queue.some(c => c.key === cand.key)) {
    return { state, accepted: false };
  }
  // Only one pending suggestion; newer celebrations supersede older pending ones.
  let queue = state.queue;
  if (cand.reaction === 'celebrate') queue = queue.filter(c => c.reaction !== 'celebrate');
  if (cand.reaction === 'suggestCreate' && queue.some(c => c.reaction === 'suggestCreate')) return { state, accepted: false };
  return { state: { ...state, queue: [...queue, cand] }, accepted: true };
}

/**
 * Explicit tap. Respects a cooldown and cycles a curated set (never random).
 * Interrupts lower-priority playback; an interrupted celebration is re-queued
 * so a confirmed creation is never lost. Greetings/suggestions are consumed.
 */
export function requestTap(state: ManagerState, now: number): { state: ManagerState; started: Playing | null; interrupted: Playing | null } {
  if (now - state.lastTapAt < TAP_COOLDOWN_MS) return { state, started: null, interrupted: null };
  if (state.current && PRIORITY[state.current.reaction] >= PRIORITY.tapShy) return { state, started: null, interrupted: null };
  const reaction = TAP_CYCLE[state.tapIndex % TAP_CYCLE.length];
  const started: Playing = { key: `tap:${now}`, reaction, startedAt: now };
  const interrupted = state.current;
  let queue = state.queue;
  let handled = state.handled;
  if (interrupted) {
    if (interrupted.reaction === 'celebrate') queue = [{ key: interrupted.key, reaction: 'celebrate', creationKind: interrupted.creationKind, contentId: interrupted.contentId }, ...queue];
    else handled = remember(handled, interrupted.key);
  }
  return {
    state: {
      ...state, current: started, queue, handled, lastTapAt: now, tapIndex: state.tapIndex + 1,
      lastPlayedAt: { ...state.lastPlayedAt, [reaction]: now },
    },
    started,
    interrupted,
  };
}

/** Start the highest-priority queued candidate when nothing is playing. */
export function startNext(state: ManagerState, now: number): { state: ManagerState; started: Playing | null } {
  if (state.queue.length === 0) return { state, started: null };
  let best = -1;
  state.queue.forEach((c, i) => {
    const cool = state.lastPlayedAt[c.reaction];
    if (c.reaction !== 'celebrate' && cool != null && now - cool < SAME_REACTION_COOLDOWN_MS) return;
    if (best < 0 || PRIORITY[c.reaction] > PRIORITY[state.queue[best].reaction]) best = i;
  });
  if (best < 0) return { state, started: null };
  const cand = state.queue[best];
  if (state.current && PRIORITY[cand.reaction] <= PRIORITY[state.current.reaction]) {
    return { state, started: null };
  }
  const started: Playing = { ...cand, startedAt: now };
  let queue = state.queue.filter((_, i) => i !== best);
  let handled = state.handled;
  if (state.current) {
    if (state.current.reaction === 'celebrate') queue = [state.current, ...queue];
    else handled = remember(handled, state.current.key);
  }
  return {
    state: {
      ...state,
      current: started,
      queue, handled,
      lastPlayedAt: { ...state.lastPlayedAt, [cand.reaction]: now },
    },
    started,
  };
}

/** Mark the given playback finished. Stale keys (already replaced) are ignored. */
export function complete(state: ManagerState, key: string): ManagerState {
  if (!state.current || state.current.key !== key) return state;
  return { ...state, current: null, handled: remember(state.handled, key) };
}

/** Drop a pending candidate (e.g. the suggestion after the user dismisses it). */
export function drop(state: ManagerState, reaction: LumiReaction): ManagerState {
  return { ...state, queue: state.queue.filter(c => c.reaction !== reaction) };
}

export const isTap = (r: LumiReaction): r is TapReaction => (TAP_CYCLE as readonly string[]).includes(r);
