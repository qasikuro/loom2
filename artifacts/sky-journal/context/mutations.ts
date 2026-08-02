/**
 * Pure mutation helpers for optimistic-update / rollback patterns.
 *
 * Each helper is extracted from the AppContext useCallback closures so the
 * logic can be exercised in plain Node.js tests without a React runtime.
 *
 * Signature convention
 *  - `currentXxx`  — snapshot of the relevant slice at call-time (from stateRef.current)
 *  - `setXxx`      — functional state setter (prev => next); mirrors React's setState
 *  - `writeCache`  — persists the serialised state to AsyncStorage
 *  - `fetch`       — apiFetch-shaped async function; rejects on HTTP error
 *  - `showToast`   — showToastGlobal-shaped callback(message, type, onRetry)
 */

import type { JournalEntry, Story, Outfit } from './mappers';
import type { ToastLevel } from '@/components/Toast';

// ── Type aliases ──────────────────────────────────────────────────────────────

type Setter<T> = (fn: (prev: T) => T) => void;
export type CacheWriter = (json: string) => void;
export type Fetcher = (path: string, opts: RequestInit) => Promise<unknown>;
export type ToastFn = (msg: string, level: ToastLevel, onRetry: () => void) => void;
type ActiveOutfitSetter = (fn: (prev: string | null) => string | null) => void;

// ── deleteJournalEntry ────────────────────────────────────────────────────────

/**
 * Optimistically removes a journal entry from state.
 * On API failure: restores the entry at its original position and shows a
 * retry toast whose callback re-attempts the DELETE.
 */
export function handleDeleteJournalEntry(
  id: string,
  currentEntries: JournalEntry[],
  setEntries: Setter<JournalEntry[]>,
  writeCache: CacheWriter,
  fetch: Fetcher,
  showToast: ToastFn,
): void {
  const originalEntry = currentEntries.find(e => e.id === id);
  const originalIndex = currentEntries.findIndex(e => e.id === id);

  // Optimistic remove
  setEntries(prev => {
    const updated = prev.filter(e => e.id !== id);
    writeCache(JSON.stringify(updated));
    return updated;
  });

  fetch(`/journal-entries/${id}`, { method: 'DELETE' }).catch(() => {
    if (!originalEntry) return;

    // Rollback: restore entry at its original position
    setEntries(prev => {
      if (prev.some(e => e.id === id)) return prev; // already restored
      const insertAt = Math.min(originalIndex, prev.length);
      const restored = [...prev.slice(0, insertAt), originalEntry, ...prev.slice(insertAt)];
      writeCache(JSON.stringify(restored));
      return restored;
    });

    showToast('Delete failed — tap to retry', 'error', () => {
      // Retry: optimistically remove again, then re-attempt the DELETE
      setEntries(prev => {
        const updated = prev.filter(e => e.id !== id);
        writeCache(JSON.stringify(updated));
        return updated;
      });
      fetch(`/journal-entries/${id}`, { method: 'DELETE' })
        .catch(() => {
          // Retry failed — restore once more
          setEntries(prev => {
            if (prev.some(e => e.id === id)) return prev;
            const insertAt = Math.min(originalIndex, prev.length);
            const restored = [...prev.slice(0, insertAt), originalEntry, ...prev.slice(insertAt)];
            writeCache(JSON.stringify(restored));
            return restored;
          });
        });
    });
  });
}

// ── deleteStory ───────────────────────────────────────────────────────────────

/**
 * Optimistically removes a story from state.
 * On API failure: restores at its original position and shows a retry toast.
 */
export function handleDeleteStory(
  id: string,
  currentStories: Story[],
  setStories: Setter<Story[]>,
  writeCache: CacheWriter,
  fetch: Fetcher,
  showToast: ToastFn,
): void {
  const originalStory = currentStories.find(s => s.id === id);
  const originalIndex = currentStories.findIndex(s => s.id === id);

  // Optimistic remove
  setStories(prev => {
    const updated = prev.filter(s => s.id !== id);
    writeCache(JSON.stringify(updated));
    return updated;
  });

  fetch(`/stories/${id}`, { method: 'DELETE' }).catch(() => {
    if (!originalStory) return;

    // Rollback
    setStories(prev => {
      if (prev.some(s => s.id === id)) return prev;
      const insertAt = Math.min(originalIndex, prev.length);
      const restored = [...prev.slice(0, insertAt), originalStory, ...prev.slice(insertAt)];
      writeCache(JSON.stringify(restored));
      return restored;
    });

    showToast('Delete failed — tap to retry', 'error', () => {
      // Retry: optimistically remove again, then re-attempt the DELETE
      setStories(prev => {
        const updated = prev.filter(s => s.id !== id);
        writeCache(JSON.stringify(updated));
        return updated;
      });
      fetch(`/stories/${id}`, { method: 'DELETE' })
        .catch(() => {
          // Retry failed — restore once more
          setStories(prev => {
            if (prev.some(s => s.id === id)) return prev;
            const insertAt = Math.min(originalIndex, prev.length);
            const restored = [...prev.slice(0, insertAt), originalStory, ...prev.slice(insertAt)];
            writeCache(JSON.stringify(restored));
            return restored;
          });
        });
    });
  });
}

// ── deleteOutfit ──────────────────────────────────────────────────────────────

/**
 * Optimistically removes an outfit from state.
 * If the outfit was active its active-outfit selection is also cleared.
 * On API failure: restores the outfit (and active selection) and shows a retry toast.
 */
export function handleDeleteOutfit(
  id: string,
  currentOutfits: Outfit[],
  activeOutfitId: string | null,
  setOutfits: Setter<Outfit[]>,
  setActiveOutfitId: ActiveOutfitSetter,
  writeCache: CacheWriter,
  fetch: Fetcher,
  showToast: ToastFn,
): void {
  const originalOutfit = currentOutfits.find(o => o.id === id);
  const originalIndex  = currentOutfits.findIndex(o => o.id === id);
  const wasActive      = activeOutfitId === id;

  // Optimistic remove
  setOutfits(prev => {
    const updated = prev.filter(o => o.id !== id);
    writeCache(JSON.stringify(updated));
    return updated;
  });
  if (wasActive) {
    // Only clear when the current active matches — conditional on prev
    setActiveOutfitId(prev => (prev === id ? null : prev));
  }

  fetch(`/outfits/${id}`, { method: 'DELETE' }).catch(() => {
    if (!originalOutfit) return;

    // Rollback
    setOutfits(prev => {
      if (prev.some(o => o.id === id)) return prev;
      const insertAt = Math.min(originalIndex, prev.length);
      const restored = [...prev.slice(0, insertAt), originalOutfit, ...prev.slice(insertAt)];
      writeCache(JSON.stringify(restored));
      return restored;
    });
    if (wasActive) {
      // Restore only when the current active is still null (not overwritten by another selection)
      setActiveOutfitId(prev => (prev === null ? id : prev));
    }

    showToast('Delete failed — tap to retry', 'error', () => {
      // Retry: optimistically remove again, then re-attempt the DELETE
      setOutfits(prev => {
        const updated = prev.filter(o => o.id !== id);
        writeCache(JSON.stringify(updated));
        return updated;
      });
      if (wasActive) {
        setActiveOutfitId(prev => (prev === id ? null : prev));
      }
      fetch(`/outfits/${id}`, { method: 'DELETE' })
        .catch(() => {
          // Retry failed — restore once more
          setOutfits(prev => {
            if (prev.some(o => o.id === id)) return prev;
            const insertAt = Math.min(originalIndex, prev.length);
            const restored = [...prev.slice(0, insertAt), originalOutfit, ...prev.slice(insertAt)];
            writeCache(JSON.stringify(restored));
            return restored;
          });
          if (wasActive) {
            setActiveOutfitId(prev => (prev === null ? id : prev));
          }
        });
    });
  });
}

// ── updateStory ───────────────────────────────────────────────────────────────

/**
 * Optimistically applies partial updates to a story.
 * On API failure: reverts to the original story and shows a retry toast.
 * Retry re-applies the update and re-attempts the PATCH; if the retry also
 * fails the story is reverted again.
 */
/** Strips device-local file:// URIs from story panels before cache writes. */
function slimStories(stories: Story[]): Story[] {
  return stories.map(s => ({
    ...s,
    panels: s.panels.map(p => ({ ...p, imageUri: undefined })),
  }));
}

export function handleUpdateStory(
  id: string,
  updates: Partial<Omit<Story, 'id'>>,
  currentStories: Story[],
  setStories: Setter<Story[]>,
  writeCache: CacheWriter,
  fetch: Fetcher,
  showToast: ToastFn,
  patchBody: string,
): void {
  const originalStory = currentStories.find(s => s.id === id);

  // Optimistic apply
  setStories(prev => {
    const updated = prev.map(s => s.id === id ? { ...s, ...updates } : s);
    writeCache(JSON.stringify(slimStories(updated)));
    return updated;
  });

  fetch(`/stories/${id}`, { method: 'PATCH', body: patchBody }).catch(() => {
    if (!originalStory) return;

    // Rollback
    setStories(prev => {
      const reverted = prev.map(s => s.id === id ? originalStory : s);
      writeCache(JSON.stringify(slimStories(reverted)));
      return reverted;
    });

    showToast("Couldn't save story changes — tap to retry", 'error', () => {
      // Retry: re-apply updates and re-attempt PATCH
      setStories(prev => {
        const reapplied = prev.map(s => s.id === id ? { ...s, ...updates } : s);
        writeCache(JSON.stringify(slimStories(reapplied)));
        return reapplied;
      });
      fetch(`/stories/${id}`, { method: 'PATCH', body: patchBody })
        .catch(() => {
          // Retry also failed — revert again
          setStories(prev => {
            const rereverted = prev.map(s => s.id === id ? originalStory : s);
            writeCache(JSON.stringify(slimStories(rereverted)));
            return rereverted;
          });
        });
    });
  });
}
