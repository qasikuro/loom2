import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { mergeSessionDiscussion, reconcileSessionDiscussion, reuseSessionDiscussionMessages, type SessionDiscussionMessage } from '../sessionDiscussion';

const message = (id: string, patch: Partial<SessionDiscussionMessage> = {}): SessionDiscussionMessage => ({
  id, userId: 'participant', authorName: 'Participant', content: `Message ${id}`,
  expression: null, createdAt: '2026-10-17T10:00:00.000Z', ...patch,
});

describe('session workspace navigation contracts', () => {
  const screen = readFileSync(new URL('../../app/guide-session/[sessionId].tsx', import.meta.url), 'utf8');
  it('keeps the primary chat action in the session workspace', () => {
    expect(screen).toContain("switchTab('chat')");
    expect(screen).not.toContain('router.push(`/campfire/');
    expect(screen).not.toContain('Campfire chat');
  });
  it('retains visited form panels and the discussion instead of unmounting drafts', () => {
    expect(screen).toContain('roomPanels.filter(panel => visitedTabs.has(panel.key)).map');
    expect(screen).toContain("pointerEvents={inChat ? 'auto' : 'none'}");
    expect(screen).toContain('enabled={inChat && showRoom}');
  });
});

describe('session discussion synchronization', () => {
  it('keeps an unchanged snapshot and row identities for memoized rendering', () => {
    const previous = [message('1'), message('2')];
    const snapshot = previous.map(row => ({ ...row }));
    expect(reuseSessionDiscussionMessages(previous, snapshot)).toBe(previous);
  });
  it('only replaces a row when its visible fields change', () => {
    const previous = [message('1'), message('2')];
    const result = reuseSessionDiscussionMessages(previous, [message('1'), message('2', { content: 'Updated' })]);
    expect(result[0]).toBe(previous[0]);
    expect(result[1]).not.toBe(previous[1]);
    expect(result[1].content).toBe('Updated');
  });
  it('does not redraw history when a live message is acknowledged twice', () => {
    const previous = [message('1')];
    expect(mergeSessionDiscussion(previous, [message('1')], [])).toBe(previous);
  });
  it('does not preserve an old row removed by an authoritative snapshot', () => {
    const previous = [message('1'), message('2')];
    expect(reuseSessionDiscussionMessages(previous, [message('2')])).toEqual([message('2')]);
  });
  it('deduplicates live delivery and send acknowledgements', () => {
    expect(mergeSessionDiscussion([message('1')], [message('1')], [])).toHaveLength(1);
  });
  it('orders messages and limits rendered history', () => {
    const rows = Array.from({ length: 130 }, (_, index) => message(String(index).padStart(3, '0'), {
      createdAt: new Date(Date.UTC(2026, 9, 17, 10, 0, index)).toISOString(),
    }));
    const result = mergeSessionDiscussion([], rows.reverse(), []);
    expect(result).toHaveLength(100);
    expect(result[0].id).toBe('030');
    expect(result.at(-1)?.id).toBe('129');
  });
  it('filters blocked users from snapshots and live messages', () => {
    expect(mergeSessionDiscussion([message('1')], [message('2', { userId: 'guide' })], ['participant']))
      .toEqual([message('2', { userId: 'guide' })]);
  });
  it('preserves a message arriving while a snapshot is fetching', () => {
    expect(reconcileSessionDiscussion([message('1')], [{ messageId: '2', message: message('2') }], []))
      .toEqual([message('1'), message('2')]);
  });
  it('preserves deletions arriving while a snapshot is fetching', () => {
    expect(reconcileSessionDiscussion([message('1'), message('2')], [{ messageId: '1', message: null }], []))
      .toEqual([message('2')]);
  });
  it('does not retain messages absent from a fresh authoritative snapshot', () => {
    expect(reconcileSessionDiscussion([message('2')], [], [])).toEqual([message('2')]);
  });
});
