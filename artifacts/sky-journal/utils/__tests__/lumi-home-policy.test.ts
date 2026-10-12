import { describe, expect, it } from 'vitest';
import {
  DAY_MS, SESSION_GAP_MS, TAP_COOLDOWN_MS, complete, decideGreeting, enqueue, initialManagerState,
  requestTap, shouldSuggestCreate, startNext,
} from '../../features/lumi/home/reactionManager';
import { ensureMarker, parseVisitRecord, shouldGreet, touchMarker } from '../../features/lumi/home/visitPolicy';

const NOW = 1_800_000_000_000;

describe('real session boundaries', () => {
  it('does not greet again after long active navigation', () => {
    const marker = { ...touchMarker(undefined, NOW), greeted: true };
    expect(ensureMarker(marker, NOW + SESSION_GAP_MS * 4)).toBe(marker);
    expect(shouldGreet(ensureMarker(marker, NOW + SESSION_GAP_MS * 4))).toBe(false);
  });
  it('measures a foreground return from departure, not from first opening Home', () => {
    const marker = { ...touchMarker(undefined, NOW), greeted: true, lastActiveAt: NOW + SESSION_GAP_MS * 4 };
    expect(shouldGreet(touchMarker(marker, marker.lastActiveAt + 1_000))).toBe(false);
    expect(shouldGreet(touchMarker(marker, marker.lastActiveAt + SESSION_GAP_MS))).toBe(true);
  });
  it('interrupts a greeting for a confirmed creation and ignores its late completion', () => {
    let state = enqueue(initialManagerState(), { key: 'welcome', reaction: 'welcomeNew' }).state;
    state = startNext(state, NOW).state;
    state = enqueue(state, { key: 'saved', reaction: 'celebrate' }).state;
    state = startNext(state, NOW + 100).state;
    expect(state.current?.key).toBe('saved');
    expect(complete(state, 'welcome').current?.key).toBe('saved');
    expect(state.handled).toContain('welcome');
  });
});

describe('greeting policy', () => {
  it('24h+ is sleepy, otherwise same-day', () => {
    expect(decideGreeting({ lastVisitAt: NOW - DAY_MS, accountCreatedAt: null, now: NOW })).toBe('returnSleepy');
    expect(decideGreeting({ lastVisitAt: NOW - 3_600_000, accountCreatedAt: null, now: NOW })).toBe('returnSameDay');
  });
  it('fresh registration without a record is new', () => {
    expect(decideGreeting({ lastVisitAt: null, accountCreatedAt: NOW - 60_000, now: NOW })).toBe('welcomeNew');
  });
  it('old account with missing local cache is returning, never fabricated new', () => {
    expect(decideGreeting({ lastVisitAt: null, accountCreatedAt: NOW - 40 * DAY_MS, now: NOW })).toBe('returnSameDay');
    expect(decideGreeting({ lastVisitAt: null, accountCreatedAt: null, now: NOW })).toBe('returnSameDay');
  });
  it('a stored visit wins over account age (welcome only once)', () => {
    expect(decideGreeting({ lastVisitAt: NOW - 1000, accountCreatedAt: NOW - 60_000, now: NOW })).toBe('returnSameDay');
  });
  it('rejects corrupt visit records', () => {
    expect(parseVisitRecord('nope')).toBeNull();
    expect(parseVisitRecord('{"lastVisitAt":"x"}')).toBeNull();
    expect(parseVisitRecord('{"lastVisitAt":5}')).toEqual({ lastVisitAt: 5, welcomedAt: null });
  });
});

describe('session marker prevents duplicate greetings', () => {
  it('same session never greets twice across navigation/rerender', () => {
    let m = touchMarker(undefined, NOW);
    expect(shouldGreet(m)).toBe(true);
    m = { ...m, greeted: true };
    m = touchMarker(m, NOW + 60_000);
    expect(shouldGreet(m)).toBe(false);
  });
  it('a long background gap starts a new session', () => {
    const m = touchMarker({ ...touchMarker(undefined, NOW), greeted: true, suggestDismissed: true }, NOW + SESSION_GAP_MS + 1);
    expect(shouldGreet(m)).toBe(true);
    expect(m.suggestDismissed).toBe(false);
  });
  it('dedups a repeated greeting key in the queue', () => {
    let s = initialManagerState();
    s = enqueue(s, { key: 'greet:u:1', reaction: 'returnSameDay' }).state;
    expect(enqueue(s, { key: 'greet:u:1', reaction: 'returnSameDay' }).accepted).toBe(false);
    const r = startNext(s, NOW);
    s = complete(r.state, 'greet:u:1');
    expect(enqueue(s, { key: 'greet:u:1', reaction: 'returnSameDay' }).accepted).toBe(false);
  });
});

describe('create suggestion', () => {
  const base = { dataReady: true, storyCount: 0, journalCount: 0, outfitCount: 0, offeredThisSession: false, dismissedThisSession: false };
  it('only with ready AND empty data', () => {
    expect(shouldSuggestCreate(base)).toBe(true);
    expect(shouldSuggestCreate({ ...base, dataReady: false })).toBe(false); // failed/loading content
    expect(shouldSuggestCreate({ ...base, storyCount: 2 })).toBe(false);    // not empty
    expect(shouldSuggestCreate({ ...base, journalCount: 1 })).toBe(false);
    expect(shouldSuggestCreate({ ...base, outfitCount: 1 })).toBe(false);
    expect(shouldSuggestCreate({ ...base, offeredThisSession: true })).toBe(false);
    expect(shouldSuggestCreate({ ...base, dismissedThisSession: true })).toBe(false);
  });
});

describe('priorities, cooldown, interruption, return to idle', () => {
  it('celebrate > greeting > suggestion, then idle (no current)', () => {
    let s = initialManagerState();
    s = enqueue(s, { key: 'sug', reaction: 'suggestCreate' }).state;
    s = enqueue(s, { key: 'greet', reaction: 'returnSameDay' }).state;
    s = enqueue(s, { key: 'c1', reaction: 'celebrate' }).state;
    const order: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = startNext(s, NOW + i * 10_000);
      order.push(r.started!.reaction);
      s = complete(r.state, r.started!.key);
    }
    expect(order).toEqual(['celebrate', 'returnSameDay', 'suggestCreate']);
    expect(s.current).toBeNull();
    expect(startNext(s, NOW + 40_000).started).toBeNull();
  });
  it('taps cycle curated reactions and respect cooldown', () => {
    let s = initialManagerState();
    const seen: string[] = [];
    let t = NOW;
    for (let i = 0; i < 5; i++) {
      const r = requestTap(s, t);
      seen.push(r.started!.reaction);
      s = complete(r.state, r.started!.key);
      t += TAP_COOLDOWN_MS;
    }
    expect(seen).toEqual(['tapShy', 'tapDramatic', 'tapExcited', 'tapAffectionate', 'tapShy']);
    expect(requestTap(s, t - TAP_COOLDOWN_MS + 50).started).toBeNull();
  });
  it('rapid taps never stack over a playing tap', () => {
    const s = requestTap(initialManagerState(), NOW).state;
    expect(requestTap(s, NOW + TAP_COOLDOWN_MS * 3).started).toBeNull();
  });
  it('tap interrupts celebration, which is re-queued not lost', () => {
    let s = initialManagerState();
    s = enqueue(s, { key: 'c1', reaction: 'celebrate', creationKind: 'story', contentId: '9' }).state;
    s = startNext(s, NOW).state;
    const r = requestTap(s, NOW + 100);
    expect(r.interrupted?.key).toBe('c1');
    s = complete(r.state, r.started!.key);
    expect(startNext(s, NOW + 5000).started?.key).toBe('c1');
  });
  it('tap consumes an interrupted greeting; stale completions ignored', () => {
    let s = initialManagerState();
    s = enqueue(s, { key: 'g', reaction: 'returnSleepy' }).state;
    s = startNext(s, NOW).state;
    const r = requestTap(s, NOW + 100);
    expect(r.state.handled).toContain('g');
    expect(complete(r.state, 'g').current?.key).toBe(r.started!.key);
  });
});
