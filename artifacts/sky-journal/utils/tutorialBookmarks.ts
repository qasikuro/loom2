export interface BookmarkStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface BookmarkSnapshot {
  ids: string[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export const tutorialBookmarkKey = (userId: string) =>
  `storigam:guide-tutorial-bookmarks:${encodeURIComponent(userId)}`;

/** Stores references only. Tutorial content and visibility remain server-owned. */
export function createTutorialBookmarkStore(storage: BookmarkStorage) {
  const entries = new Map<string, {
    snapshot: BookmarkSnapshot;
    listeners: Set<() => void>;
    loaded: boolean;
    hydration?: Promise<void>;
    queue: Promise<void>;
  }>();
  function entryFor(userId: string) {
    let entry = entries.get(userId);
    if (!entry) {
      entry = {
        snapshot: { ids: [], isLoading: true, isSaving: false, error: null },
        listeners: new Set(),
        loaded: false,
        queue: Promise.resolve(),
      };
      entries.set(userId, entry);
    }
    return entry;
  }
  function update(userId: string, patch: Partial<BookmarkSnapshot>) {
    const entry = entryFor(userId);
    entry.snapshot = { ...entry.snapshot, ...patch };
    entry.listeners.forEach(listener => listener());
  }
  async function load(userId: string) {
    const entry = entryFor(userId);
    if (entry.loaded) return;
    if (entry.hydration) return entry.hydration;
    update(userId, { isLoading: true, error: null });
    entry.hydration = (async () => {
      try {
        const raw = await storage.getItem(tutorialBookmarkKey(userId));
        const value: unknown = raw === null ? [] : JSON.parse(raw);
        if (!Array.isArray(value) || !value.every(id => typeof id === 'string' && id.length > 0)) {
          throw new Error('Saved tutorials could not be read. Your saved list has not been overwritten.');
        }
        entry.loaded = true;
        update(userId, { ids: [...new Set(value)], isLoading: false });
      } catch (error) {
        update(userId, { isLoading: false, error: error instanceof Error ? error.message : 'Could not read saved tutorials.' });
        throw error;
      } finally {
        entry.hydration = undefined;
      }
    })();
    return entry.hydration;
  }
  return {
    getSnapshot: (userId: string) => entryFor(userId).snapshot,
    subscribe(userId: string, listener: () => void) {
      const entry = entryFor(userId);
      entry.listeners.add(listener);
      return () => { entry.listeners.delete(listener); };
    },
    load,
    toggle(userId: string, tutorialId: string) {
      const entry = entryFor(userId);
      const operation = entry.queue.then(async () => {
        await load(userId);
        update(userId, { isSaving: true, error: null });
        try {
          const ids = entry.snapshot.ids.includes(tutorialId)
            ? entry.snapshot.ids.filter(id => id !== tutorialId)
            : [...entry.snapshot.ids, tutorialId];
          await storage.setItem(tutorialBookmarkKey(userId), JSON.stringify(ids));
          update(userId, { ids, isSaving: false });
        } catch (error) {
          update(userId, { isSaving: false, error: 'Could not save on this device. Please try again.' });
          throw error;
        }
      });
      entry.queue = operation.catch(() => undefined);
      return operation;
    },
  };
}
