import { describe, expect, it } from 'vitest';
import {
  buildQueue, cueForReply, differentArtists, formatClock, isNaturalEnd, isResumable, latestMood,
  musicQueryForMood, nextInQueue, prevInQueue, rankCampfires, sanitizeMeta, sessionProgress,
} from '../../features/lumi/logic';

const tr = (id: string, artist = id) => ({ id, artist });

describe('lumi metadata', () => {
  it('keeps only known enums and tolerates old responses', () => {
    expect(sanitizeMeta({ reply: 'hi' })).toEqual({});
    expect(sanitizeMeta(null)).toEqual({});
    expect(sanitizeMeta({ mood: 'tired', phase: 'check_in', emotion: 'calm' })).toEqual({ mood: 'tired', phase: 'check_in', emotion: 'calm' });
    expect(sanitizeMeta({ mood: 'depressed', phase: 'x', emotion: 42 })).toEqual({});
  });
  it('latest mood resets on uncertainty and ignores user/note metadata', () => {
    expect(latestMood([{ role: 'assistant', mood: 'sad' }, { role: 'assistant', mood: 'unknown' }, { role: 'user' }])).toBeUndefined();
    expect(latestMood([{ role: 'note' }])).toBeUndefined();
  });
  it('maps reply emotion to one supported reaction', () => {
    expect(cueForReply({ emotion: 'affectionate' })).toBe('tapAffectionate');
    expect(cueForReply({ mood: 'lonely' })).toBe('tapAffectionate');
    expect(cueForReply({ emotion: 'excited' })).toBe('tapExcited');
    expect(cueForReply({ emotion: 'thoughtful' })).toBeNull();
    expect(cueForReply({})).toBe('returnSameDay');
  });
  it('mood shapes default music search only when known', () => {
    expect(musicQueryForMood('tired', 'cozy')).toBe('lofi chill');
    expect(musicQueryForMood(undefined, 'cozy')).toBe('cozy');
  });
});

describe('music queue', () => {
  const q = buildQueue([tr('a'), tr('b'), tr('a'), tr('c')]);
  it('dedupes and walks next/previous', () => {
    expect(q.map(t => t.id)).toEqual(['a', 'b', 'c']);
    expect(nextInQueue(q, 'a')?.id).toBe('b');
    expect(nextInQueue(q, 'c')).toBeNull();
    expect(prevInQueue(q, 'b')?.id).toBe('a');
    expect(prevInQueue(q, 'a')).toBeNull();
  });
  it('prefers new artists for different picks', () => {
    const pool = [tr('1', 'x'), tr('2', 'x'), tr('3', 'y'), tr('4', 'z'), tr('5', 'y')];
    const picks = differentArtists(pool, [pool[0]], 2).map(t => t.id);
    expect(picks).toEqual(['3', '4']);
    expect(differentArtists(pool, pool, 3)).toEqual([]);
  });
  it('only treats an unforced stop after playing as natural end', () => {
    const base = { prevPlayingId: 'a', playingId: null, pausedId: null, loadingId: null, errorId: null, manual: false };
    expect(isNaturalEnd(base)).toBe(true);
    expect(isNaturalEnd({ ...base, manual: true })).toBe(false);
    expect(isNaturalEnd({ ...base, pausedId: 'a' })).toBe(false);
    expect(isNaturalEnd({ ...base, errorId: 'a' })).toBe(false);
    expect(isNaturalEnd({ ...base, prevPlayingId: null })).toBe(false);
  });
});

describe('campfire ranking', () => {
  it('puts recently active rooms first and keeps quiet alternatives', () => {
    const r = rankCampfires([
      { id: '1', name: 'Quiet Pines', mood: 'calm', soulCount: 0 },
      { id: '2', name: 'Loud Den', mood: 'hype', soulCount: 4 },
      { id: '3', name: 'Cozy Nook', mood: 'cozy', soulCount: 2 },
      { id: '4', name: 'Bad', mood: 'x', soulCount: Number.NaN },
    ]);
    expect(r.active.map(x => x.id)).toEqual(['2', '3']);
    expect(r.quiet.map(x => x.id)).toEqual(['1', '4']);
  });
});

describe('guided session', () => {
  it('computes progress without going negative', () => {
    const s = { start: 1000, duration: 300 };
    expect(sessionProgress(s, 1000 + 60_000)).toMatchObject({ elapsed: 60, remaining: 240, done: false });
    expect(sessionProgress(s, 1000 + 999_000)).toMatchObject({ remaining: 0, ratio: 1, done: true });
    expect(formatClock(65)).toBe('1:05');
  });
  it('resumes only fresh valid saved state', () => {
    const now = 10 * 3600 * 1000;
    expect(isResumable({ start: now - 1000, duration: 900 }, now)).toBe(true);
    expect(isResumable({ start: now - 9 * 3600 * 1000, duration: 900 }, now)).toBe(false);
    expect(isResumable(null, now)).toBe(false);
  });
});

import { readChatContext, sessionIdeas } from '../../features/lumi/logic';

it('uses the latest structured preference across languages without assuming lonely means social', () => {
  expect(sessionIdeas('lonely', readChatContext(['میں اکیلا رہنا چاہتا ہوں'], 'quiet'))).not.toContain('hello');
  expect(sessionIdeas('lonely', readChatContext([], 'unspecified'))).not.toContain('hello');
  expect(sessionIdeas('happy', readChatContext(['I used to want quiet'], 'company'))).toContain('hello');
  expect(sanitizeMeta({ intent: 'quiet' })).toEqual({ intent: 'quiet' });
  expect(sanitizeMeta({ intent: 'auto_join' })).toEqual({});
});
describe('session ideas', () => {
  it('never suggests social ideas when the player wants quiet', () => {
    const ctx = readChatContext(['I just want to be alone and quiet for a bit']);
    expect(ctx.quiet).toBe(true);
    expect(sessionIdeas('lonely', ctx)).not.toContain('hello');
    expect(sessionIdeas('lonely', ctx)).toContain('quietSpot');
  });
  it('offers company when asked, and creative/focus ideas from context', () => {
    expect(sessionIdeas(undefined, readChatContext(['want to play with friends']))).toContain('hello');
    const c = sessionIdeas('sad', readChatContext(['I want to draw and focus on a goal']));
    expect(c).toEqual(expect.arrayContaining(['breathe', 'goal', 'create']));
    expect(c.length).toBeLessThanOrEqual(5);
  });
});
