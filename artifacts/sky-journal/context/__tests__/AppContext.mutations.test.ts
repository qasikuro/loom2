/**
 * Unit tests for AppContext mutation helpers.
 *
 * Strategy: exercise the four pure helper functions (handleDeleteJournalEntry,
 * handleDeleteStory, handleDeleteOutfit, handleUpdateStory) entirely in Node.js
 * without a React runtime.  Each test wires up:
 *   - a simple mutable state array (simulates React's useState setter)
 *   - a typed vi.fn() cache writer          (simulates writeJournalCache / etc.)
 *   - a typed vi.fn() fetch                 (resolves = success, rejects = failure)
 *   - a typed vi.fn() showToast             (captures the retry callback)
 *
 * Coverage targets per mutation:
 *   (a) Successful delete/update removes/updates item from state + writes cache
 *   (b) Failed API call restores snapshot + writes cache
 *   (c) Retry toast re-attempts the mutation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleDeleteJournalEntry,
  handleDeleteStory,
  handleDeleteOutfit,
  handleUpdateStory,
} from '../mutations';
import type { CacheWriter, Fetcher, ToastFn } from '../mutations';
import type { JournalEntry, Story, Outfit } from '../mappers';

// ── Typed mock helpers ─────────────────────────────────────────────────────────
// vi.fn() needs an explicit implementation so TypeScript can infer the signature
// rather than defaulting to the opaque Mock<Procedure | Constructable> type.

function mockCacheWriter() {
  return vi.fn((_json: string): void => { /* captured */ });
}
function mockFetch(impl: (_path: string, _opts: RequestInit) => Promise<unknown> = () => Promise.resolve(undefined)) {
  return vi.fn(impl);
}
function mockShowToast() {
  return vi.fn((_msg: string, _level: Parameters<ToastFn>[1], _retry: () => void): void => { /* captured */ });
}

// ── Shared test fixtures ──────────────────────────────────────────────────────

function makeEntry(id: string): JournalEntry {
  return { id, date: '2024-01-01T00:00:00.000Z', type: 'diary', text: `Entry ${id}`, mood: 'Hopeful' };
}
function makeStory(id: string): Story {
  return {
    id, date: '2024-01-01T00:00:00.000Z', chapterTitle: `Story ${id}`,
    description: '', panels: [], mood: 'Peaceful', location: '',
    isPublic: false, witnessedCount: 0, savedCount: 0, stickerCount: 0,
  };
}
function makeOutfit(id: string): Outfit {
  return { id, date: '2024-01-01T00:00:00.000Z', name: `Outfit ${id}`, description: '', story: '', tags: [], isPublic: false };
}

/** Simulates React's functional setState. */
function makeStatePair<T>(initial: T[]): {
  readonly state: T[];
  setter: (fn: (prev: T[]) => T[]) => void;
} {
  const box = { state: [...initial] };
  return {
    get state() { return box.state; },
    setter: (fn) => { box.state = fn(box.state); },
  };
}
function makeNullablePair(initial: string | null) {
  const box = { value: initial };
  return {
    get value() { return box.value; },
    setter: (fn: (prev: string | null) => string | null) => { box.value = fn(box.value); },
  };
}

// ── handleDeleteJournalEntry ──────────────────────────────────────────────────

describe('handleDeleteJournalEntry', () => {
  const A = makeEntry('entry-a');
  const B = makeEntry('entry-b');
  const C = makeEntry('entry-c');
  let entries: ReturnType<typeof makeStatePair<JournalEntry>>;
  let writeCache: ReturnType<typeof mockCacheWriter>;
  let showToast: ReturnType<typeof mockShowToast>;

  beforeEach(() => {
    entries    = makeStatePair([A, B, C]);
    writeCache = mockCacheWriter();
    showToast  = mockShowToast();
  });

  // (a) Successful delete ──────────────────────────────────────────────────────

  it('(a) removes the entry from state on a successful DELETE', async () => {
    const fetch = mockFetch();
    handleDeleteJournalEntry('entry-b', [A, B, C], entries.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    expect(entries.state.map(e => e.id)).toEqual(['entry-a', 'entry-c']);
  });

  it('(a) writes the cache without the deleted entry on success', async () => {
    const fetch = mockFetch();
    handleDeleteJournalEntry('entry-b', [A, B, C], entries.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    expect(writeCache).toHaveBeenCalled();
    const written = JSON.parse(writeCache.mock.calls[0][0]) as JournalEntry[];
    expect(written.find(e => e.id === 'entry-b')).toBeUndefined();
  });

  it('(a) does NOT show a toast on success', async () => {
    const fetch = mockFetch();
    handleDeleteJournalEntry('entry-b', [A, B, C], entries.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    expect(showToast).not.toHaveBeenCalled();
  });

  // (b) Failed delete — rollback ───────────────────────────────────────────────

  it('(b) restores the entry at its original index after a failed DELETE', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteJournalEntry('entry-b', [A, B, C], entries.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    expect(entries.state.map(e => e.id)).toEqual(['entry-a', 'entry-b', 'entry-c']);
  });

  it('(b) writes the restored cache after rollback', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteJournalEntry('entry-b', [A, B, C], entries.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    const lastCall = writeCache.mock.calls[writeCache.mock.calls.length - 1][0];
    const restored = JSON.parse(lastCall) as JournalEntry[];
    expect(restored.map(e => e.id)).toEqual(['entry-a', 'entry-b', 'entry-c']);
  });

  it('(b) shows a retry toast after a failed DELETE', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteJournalEntry('entry-b', [A, B, C], entries.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0][0]).toBe('Delete failed — tap to retry');
  });

  it('(b) does not duplicate entry when rollback fires and item already present', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    const pair  = makeStatePair([A, B, C]);
    handleDeleteJournalEntry('entry-b', [A, B, C], pair.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    // Concurrently restore entry-b before the rejection settles
    pair.setter(prev => (prev.some(e => e.id === 'entry-b') ? prev : [...prev, B]));
    await Promise.resolve();
    await Promise.resolve();
    expect(pair.state.filter(e => e.id === 'entry-b')).toHaveLength(1);
  });

  // (c) Retry ──────────────────────────────────────────────────────────────────

  it('(c) retry calls DELETE again with the same entry id', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteJournalEntry('entry-b', [A, B, C], entries.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain('/journal-entries/entry-b');
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
  });

  it('(c) retry removes the entry from state before calling the API', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteJournalEntry('entry-b', [A, B, C], entries.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn(); // optimistic remove fires synchronously

    expect(entries.state.map(e => e.id)).not.toContain('entry-b');
  });

  it('(c) successful retry leaves the entry permanently removed', async () => {
    let firstCall = true;
    const fetch = mockFetch(() => {
      if (firstCall) { firstCall = false; return Promise.reject(new Error('net')); }
      return Promise.resolve(undefined);
    });
    handleDeleteJournalEntry('entry-b', [A, B, C], entries.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn();
    await Promise.resolve();
    await Promise.resolve();

    expect(entries.state.map(e => e.id)).not.toContain('entry-b');
  });
});

// ── handleDeleteStory ─────────────────────────────────────────────────────────

describe('handleDeleteStory', () => {
  const S1 = makeStory('story-1');
  const S2 = makeStory('story-2');
  const S3 = makeStory('story-3');
  let stories: ReturnType<typeof makeStatePair<Story>>;
  let writeCache: ReturnType<typeof mockCacheWriter>;
  let showToast: ReturnType<typeof mockShowToast>;

  beforeEach(() => {
    stories    = makeStatePair([S1, S2, S3]);
    writeCache = mockCacheWriter();
    showToast  = mockShowToast();
  });

  // (a) Successful delete ──────────────────────────────────────────────────────

  it('(a) removes the story from state on a successful DELETE', async () => {
    const fetch = mockFetch();
    handleDeleteStory('story-2', [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    expect(stories.state.map(s => s.id)).toEqual(['story-1', 'story-3']);
  });

  it('(a) writes the cache without the deleted story on success', async () => {
    const fetch = mockFetch();
    handleDeleteStory('story-2', [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    expect(writeCache).toHaveBeenCalled();
    const written = JSON.parse(writeCache.mock.calls[0][0]) as Story[];
    expect(written.find(s => s.id === 'story-2')).toBeUndefined();
  });

  it('(a) does NOT show a toast on success', async () => {
    const fetch = mockFetch();
    handleDeleteStory('story-2', [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    expect(showToast).not.toHaveBeenCalled();
  });

  // (b) Failed delete — rollback ───────────────────────────────────────────────

  it('(b) restores the story at its original index after a failed DELETE', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteStory('story-2', [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    expect(stories.state.map(s => s.id)).toEqual(['story-1', 'story-2', 'story-3']);
  });

  it('(b) writes the restored cache with the story back', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteStory('story-2', [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    const lastWritten = JSON.parse(writeCache.mock.calls[writeCache.mock.calls.length - 1][0]) as Story[];
    expect(lastWritten.map(s => s.id)).toEqual(['story-1', 'story-2', 'story-3']);
  });

  it('(b) shows a retry toast after a failed DELETE', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteStory('story-2', [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0][0]).toBe('Delete failed — tap to retry');
  });

  it('(b) does not duplicate story when rollback fires and item already present', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    const pair  = makeStatePair([S1, S2, S3]);
    handleDeleteStory('story-2', [S1, S2, S3], pair.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    pair.setter(prev => (prev.some(s => s.id === 'story-2') ? prev : [...prev, S2]));
    await Promise.resolve();
    await Promise.resolve();
    expect(pair.state.filter(s => s.id === 'story-2')).toHaveLength(1);
  });

  // (c) Retry ──────────────────────────────────────────────────────────────────

  it('(c) retry calls DELETE again with the same story id', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteStory('story-2', [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain('/stories/story-2');
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
  });

  it('(c) successful retry leaves the story permanently removed', async () => {
    let firstCall = true;
    const fetch = mockFetch(() => {
      if (firstCall) { firstCall = false; return Promise.reject(new Error('net')); }
      return Promise.resolve(undefined);
    });
    handleDeleteStory('story-2', [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn();
    await Promise.resolve();
    await Promise.resolve();

    expect(stories.state.map(s => s.id)).not.toContain('story-2');
  });
});

// ── handleDeleteOutfit ────────────────────────────────────────────────────────

describe('handleDeleteOutfit', () => {
  const O1 = makeOutfit('outfit-1');
  const O2 = makeOutfit('outfit-2');
  const O3 = makeOutfit('outfit-3');
  let outfits: ReturnType<typeof makeStatePair<Outfit>>;
  let activeOutfit: ReturnType<typeof makeNullablePair>;
  let writeCache: ReturnType<typeof mockCacheWriter>;
  let showToast: ReturnType<typeof mockShowToast>;

  beforeEach(() => {
    outfits      = makeStatePair([O1, O2, O3]);
    activeOutfit = makeNullablePair(null);
    writeCache   = mockCacheWriter();
    showToast    = mockShowToast();
  });

  // (a) Successful delete ──────────────────────────────────────────────────────

  it('(a) removes the outfit from state on a successful DELETE', async () => {
    const fetch = mockFetch();
    handleDeleteOutfit('outfit-2', [O1, O2, O3], null, outfits.setter, activeOutfit.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    expect(outfits.state.map(o => o.id)).toEqual(['outfit-1', 'outfit-3']);
  });

  it('(a) writes cache without the deleted outfit', async () => {
    const fetch = mockFetch();
    handleDeleteOutfit('outfit-2', [O1, O2, O3], null, outfits.setter, activeOutfit.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    const written = JSON.parse(writeCache.mock.calls[0][0]) as Outfit[];
    expect(written.find(o => o.id === 'outfit-2')).toBeUndefined();
  });

  it('(a) clears activeOutfitId when the active outfit is deleted', async () => {
    const fetch = mockFetch();
    const active = makeNullablePair('outfit-2');
    handleDeleteOutfit('outfit-2', [O1, O2, O3], 'outfit-2', outfits.setter, active.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    expect(active.value).toBeNull();
    await Promise.resolve();
    expect(active.value).toBeNull();
  });

  it('(a) does NOT clear activeOutfitId when a different outfit is deleted', async () => {
    const fetch = mockFetch();
    const active = makeNullablePair('outfit-1');
    handleDeleteOutfit('outfit-2', [O1, O2, O3], 'outfit-1', outfits.setter, active.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    expect(active.value).toBe('outfit-1');
  });

  it('(a) does NOT show a toast on success', async () => {
    const fetch = mockFetch();
    handleDeleteOutfit('outfit-2', [O1, O2, O3], null, outfits.setter, activeOutfit.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    expect(showToast).not.toHaveBeenCalled();
  });

  // (b) Failed delete — rollback ───────────────────────────────────────────────

  it('(b) restores the outfit at its original index after a failed DELETE', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteOutfit('outfit-2', [O1, O2, O3], null, outfits.setter, activeOutfit.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    expect(outfits.state.map(o => o.id)).toEqual(['outfit-1', 'outfit-2', 'outfit-3']);
  });

  it('(b) restores activeOutfitId when the formerly-active outfit rollback fires', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    const active = makeNullablePair('outfit-2');
    handleDeleteOutfit('outfit-2', [O1, O2, O3], 'outfit-2', outfits.setter, active.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    expect(active.value).toBe('outfit-2');
  });

  it('(b) does NOT overwrite a concurrent active selection during rollback', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    const active = makeNullablePair('outfit-2');
    handleDeleteOutfit('outfit-2', [O1, O2, O3], 'outfit-2', outfits.setter, active.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    // User switches to outfit-1 before the API response arrives
    active.setter(() => 'outfit-1');
    await Promise.resolve();
    await Promise.resolve();
    // Rollback should NOT override the user's new selection with outfit-2
    expect(active.value).toBe('outfit-1');
  });

  it('(b) does NOT alter activeOutfitId when a non-active outfit was rolled back', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    const active = makeNullablePair('outfit-1');
    handleDeleteOutfit('outfit-2', [O1, O2, O3], 'outfit-1', outfits.setter, active.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    expect(active.value).toBe('outfit-1');
  });

  it('(b) shows a retry toast after a failed DELETE', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteOutfit('outfit-2', [O1, O2, O3], null, outfits.setter, activeOutfit.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0][0]).toBe('Delete failed — tap to retry');
  });

  it('(b) writes the restored cache after rollback', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteOutfit('outfit-2', [O1, O2, O3], null, outfits.setter, activeOutfit.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    const lastWritten = JSON.parse(writeCache.mock.calls[writeCache.mock.calls.length - 1][0]) as Outfit[];
    expect(lastWritten.map(o => o.id)).toEqual(['outfit-1', 'outfit-2', 'outfit-3']);
  });

  // (c) Retry ──────────────────────────────────────────────────────────────────

  it('(c) retry calls DELETE again with the same outfit id', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteOutfit('outfit-2', [O1, O2, O3], null, outfits.setter, activeOutfit.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain('/outfits/outfit-2');
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
  });

  it('(c) retry removes outfit from state before calling the API', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleDeleteOutfit('outfit-2', [O1, O2, O3], null, outfits.setter, activeOutfit.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn();

    expect(outfits.state.map(o => o.id)).not.toContain('outfit-2');
  });

  it('(c) successful retry leaves outfit permanently removed', async () => {
    let firstCall = true;
    const fetch = mockFetch(() => {
      if (firstCall) { firstCall = false; return Promise.reject(new Error('net')); }
      return Promise.resolve(undefined);
    });
    handleDeleteOutfit('outfit-2', [O1, O2, O3], null, outfits.setter, activeOutfit.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn();
    await Promise.resolve();
    await Promise.resolve();

    expect(outfits.state.map(o => o.id)).not.toContain('outfit-2');
  });

  it('(c) retry also clears activeOutfitId when the active outfit is retried successfully', async () => {
    let firstCall = true;
    const fetch = mockFetch(() => {
      if (firstCall) { firstCall = false; return Promise.reject(new Error('net')); }
      return Promise.resolve(undefined);
    });
    const active = makeNullablePair('outfit-2');
    handleDeleteOutfit('outfit-2', [O1, O2, O3], 'outfit-2', outfits.setter, active.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn);
    await Promise.resolve();
    await Promise.resolve();
    // active is outfit-2 after rollback

    const retryFn = showToast.mock.calls[0][2];
    retryFn();
    await Promise.resolve();
    await Promise.resolve();

    expect(active.value).toBeNull();
  });
});

// ── handleUpdateStory ─────────────────────────────────────────────────────────

describe('handleUpdateStory', () => {
  const S1 = makeStory('story-1');
  const S2 = makeStory('story-2');
  const S3 = makeStory('story-3');

  const UPDATES: Partial<Omit<Story, 'id'>> = { chapterTitle: 'Updated Title', mood: 'Joyful' };
  const PATCH_BODY = JSON.stringify(UPDATES);

  let stories: ReturnType<typeof makeStatePair<Story>>;
  let writeCache: ReturnType<typeof mockCacheWriter>;
  let showToast: ReturnType<typeof mockShowToast>;

  beforeEach(() => {
    stories    = makeStatePair([S1, S2, S3]);
    writeCache = mockCacheWriter();
    showToast  = mockShowToast();
  });

  // (a) Successful update ──────────────────────────────────────────────────────

  it('(a) applies the update to state on a successful PATCH', async () => {
    const fetch = mockFetch();
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    const updated = stories.state.find(s => s.id === 'story-2')!;
    expect(updated.chapterTitle).toBe('Updated Title');
    expect(updated.mood).toBe('Joyful');
  });

  it('(a) leaves other stories unchanged', async () => {
    const fetch = mockFetch();
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    expect(stories.state.find(s => s.id === 'story-1')?.chapterTitle).toBe('Story story-1');
    expect(stories.state.find(s => s.id === 'story-3')?.chapterTitle).toBe('Story story-3');
  });

  it('(a) writes the cache with the updated story on success', async () => {
    const fetch = mockFetch();
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    expect(writeCache).toHaveBeenCalled();
    const written = JSON.parse(writeCache.mock.calls[0][0]) as Story[];
    expect(written.find(s => s.id === 'story-2')?.chapterTitle).toBe('Updated Title');
  });

  it('(a) strips panels imageUri from the cache write but keeps it in memory', async () => {
    const storyWithImage: Story = {
      ...S2,
      panels: [{ id: 'p1', text: 'Hello', imageUri: 'https://cdn.example.com/image.jpg' }],
    };
    // Use a local state pair initialised with storyWithImage so in-memory state has the URI
    const localStories = makeStatePair([S1, storyWithImage, S3]);
    const fetch = mockFetch();
    handleUpdateStory(
      'story-2', { chapterTitle: 'New' }, [S1, storyWithImage, S3],
      localStories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY,
    );
    await Promise.resolve();
    const written = JSON.parse(writeCache.mock.calls[0][0]) as Story[];
    const panel = written.find(s => s.id === 'story-2')?.panels[0];
    // imageUri is stripped for the cache write
    expect(panel?.imageUri).toBeUndefined();
    // but the in-memory state retains it
    expect(localStories.state.find(s => s.id === 'story-2')?.panels[0]?.imageUri).toBe('https://cdn.example.com/image.jpg');
  });

  it('(a) does NOT show a toast on success', async () => {
    const fetch = mockFetch();
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('(a) calls PATCH on the correct story endpoint with the patch body', async () => {
    const fetch = mockFetch();
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledWith('/stories/story-2', expect.objectContaining({ method: 'PATCH', body: PATCH_BODY }));
  });

  // (b) Failed update — rollback ───────────────────────────────────────────────

  it('(b) reverts the story to its original value after a failed PATCH', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    await Promise.resolve();
    const reverted = stories.state.find(s => s.id === 'story-2')!;
    expect(reverted.chapterTitle).toBe('Story story-2');
    expect(reverted.mood).toBe('Peaceful');
  });

  it('(b) writes the reverted cache', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    await Promise.resolve();
    const lastWritten = JSON.parse(writeCache.mock.calls[writeCache.mock.calls.length - 1][0]) as Story[];
    expect(lastWritten.find(s => s.id === 'story-2')?.chapterTitle).toBe('Story story-2');
  });

  it('(b) does NOT alter other stories during rollback', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    await Promise.resolve();
    expect(stories.state.find(s => s.id === 'story-1')?.chapterTitle).toBe('Story story-1');
    expect(stories.state.find(s => s.id === 'story-3')?.chapterTitle).toBe('Story story-3');
  });

  it('(b) shows a retry toast after a failed PATCH', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    await Promise.resolve();
    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0][0]).toBe("Couldn't save story changes — tap to retry");
  });

  it('(b) does not revert when the story id is not in the current snapshot', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    // Empty snapshot — originalStory will be undefined, so rollback should be a no-op
    handleUpdateStory('story-2', UPDATES, [], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    await Promise.resolve();
    expect(showToast).not.toHaveBeenCalled();
  });

  // (c) Retry ──────────────────────────────────────────────────────────────────

  it('(c) retry re-applies the update and calls PATCH again', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain('/stories/story-2');
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'PATCH' });
  });

  it('(c) retry re-applies the update to state synchronously', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn();

    expect(stories.state.find(s => s.id === 'story-2')?.chapterTitle).toBe('Updated Title');
  });

  it('(c) successful retry leaves the update applied permanently', async () => {
    let firstCall = true;
    const fetch = mockFetch(() => {
      if (firstCall) { firstCall = false; return Promise.reject(new Error('net')); }
      return Promise.resolve(undefined);
    });
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn();
    await Promise.resolve();
    await Promise.resolve();

    expect(stories.state.find(s => s.id === 'story-2')?.chapterTitle).toBe('Updated Title');
  });

  it('(c) failed retry reverts the story again', async () => {
    const fetch = mockFetch(() => Promise.reject(new Error('network error')));
    handleUpdateStory('story-2', UPDATES, [S1, S2, S3], stories.setter, writeCache as CacheWriter, fetch as Fetcher, showToast as ToastFn, PATCH_BODY);
    await Promise.resolve();
    await Promise.resolve();

    const retryFn = showToast.mock.calls[0][2];
    retryFn();
    await Promise.resolve();
    await Promise.resolve();

    expect(stories.state.find(s => s.id === 'story-2')?.chapterTitle).toBe('Story story-2');
  });
});
