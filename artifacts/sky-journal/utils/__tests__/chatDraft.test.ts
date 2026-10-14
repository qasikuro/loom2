import { describe, expect, it } from 'vitest';
import { restoreFailedChatDraft } from '../chatDraft';

describe('failed chat send draft recovery', () => {
  it('restores a failed message into an empty composer', () => {
    expect(restoreFailedChatDraft('', 'Hello')).toBe('Hello');
  });
  it('preserves text typed during the send as well as the failed message', () => {
    expect(restoreFailedChatDraft('How are you?', 'Hello')).toBe('Hello\nHow are you?');
  });
  it('keeps a newer draft after a photo-only send fails', () => {
    expect(restoreFailedChatDraft('A caption for later', '')).toBe('A caption for later');
  });
  it('treats a whitespace-only composer as empty', () => {
    expect(restoreFailedChatDraft('   ', 'Hello')).toBe('Hello');
  });
});
