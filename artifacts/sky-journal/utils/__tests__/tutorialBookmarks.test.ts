import { describe, expect, it } from 'vitest';
import { createTutorialBookmarkStore, tutorialBookmarkKey } from '../tutorialBookmarks';

function fixture(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
  };
  return { values, storage, store: createTutorialBookmarkStore(storage) };
}

describe('device tutorial bookmarks', () => {
  it('isolates accounts and restores references after reloading', async () => {
    const { store, storage } = fixture();
    await store.toggle('alice', 'tutorial-one');
    await store.load('bob');
    expect(store.getSnapshot('bob').ids).toEqual([]);
    const reloaded = createTutorialBookmarkStore(storage);
    await reloaded.load('alice');
    expect(reloaded.getSnapshot('alice').ids).toEqual(['tutorial-one']);
  });

  it('serializes overlapping writes and supports removing bookmarks', async () => {
    const { store } = fixture();
    await Promise.all([store.toggle('alice', 'one'), store.toggle('alice', 'two')]);
    expect(store.getSnapshot('alice').ids).toEqual(['one', 'two']);
    await store.toggle('alice', 'one');
    expect(store.getSnapshot('alice').ids).toEqual(['two']);
  });

  it('does not overwrite an unreadable saved list', async () => {
    const key = tutorialBookmarkKey('alice');
    const { store, values } = fixture({ [key]: '{"not":"a list"}' });
    await expect(store.toggle('alice', 'one')).rejects.toThrow();
    expect(values.get(key)).toBe('{"not":"a list"}');
    expect(store.getSnapshot('alice').isLoading).toBe(false);
    expect(store.getSnapshot('alice').error).toBeTruthy();
  });

  it('keeps the previous list when storage rejects a write', async () => {
    const { storage } = fixture();
    const store = createTutorialBookmarkStore({
      ...storage,
      setItem: async () => { throw new Error('Storage full'); },
    });
    await expect(store.toggle('alice', 'one')).rejects.toThrow('Storage full');
    expect(store.getSnapshot('alice').ids).toEqual([]);
    expect(store.getSnapshot('alice').isSaving).toBe(false);
    expect(store.getSnapshot('alice').error).toBeTruthy();
  });
});
