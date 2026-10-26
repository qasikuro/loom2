import { describe, expect, it } from 'vitest';
import { mergeChatMessages } from '../chatMessageHistory';
import type { ChatMessage } from '@workspace/api-client-react';

function message(id: string, createdAt: string, content = id): ChatMessage {
  return {
    id,
    fromUserId: 'alice',
    toUserId: 'bob',
    content,
    imageUri: null,
    expression: null,
    isRead: true,
    createdAt,
    isOwn: true,
  };
}

describe('chat message history merging', () => {
  it('deduplicates pages and keeps stable references for unchanged rows', () => {
    const first = message('1', '2026-10-10T10:00:00.000Z');
    const second = message('2', '2026-10-10T10:01:00.000Z');
    const result = mergeChatMessages([first, second], [message('1', first.createdAt), message('3', '2026-10-10T10:02:00.000Z')]);
    expect(result.map(item => item.id)).toEqual(['1', '3']);
    expect(result[0]).toBe(first);
  });

  it('keeps previously loaded older history when refreshing the latest page', () => {
    const older = message('older', '2026-10-10T09:00:00.000Z');
    const latest = message('latest', '2026-10-10T10:00:00.000Z');
    const result = mergeChatMessages([older, latest], [message('latest', latest.createdAt)], true);
    expect(result.map(item => item.id)).toEqual(['older', 'latest']);
    expect(result[0]).toBe(older);
  });

  it('uses UUID as a deterministic tie-breaker for equal timestamps', () => {
    const second = message('00000000-0000-4000-8000-000000000002', '2026-10-10T10:00:00.000Z');
    const first = message('00000000-0000-4000-8000-000000000001', '2026-10-10T10:00:00.000Z');
    expect(mergeChatMessages([], [second, first]).map(item => item.id)).toEqual([first.id, second.id]);
  });

  it('prepends an older page without removing messages already on screen', () => {
    const recent = message('recent', '2026-10-10T10:00:00.000Z');
    const older = message('older', '2026-10-10T09:00:00.000Z');
    const result = mergeChatMessages([recent], [older, recent]);
    expect(result.map(item => item.id)).toEqual(['older', 'recent']);
    expect(result[1]).toBe(recent);
  });
});
