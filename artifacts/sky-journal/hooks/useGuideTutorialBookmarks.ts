import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { createTutorialBookmarkStore, type BookmarkSnapshot } from '@/utils/tutorialBookmarks';

const store = createTutorialBookmarkStore(AsyncStorage);
const signedOut: BookmarkSnapshot = { ids: [], isLoading: false, isSaving: false, error: null };

/** Account-isolated bookmarks, explicitly presented as saved on this device. */
export function useGuideTutorialBookmarks() {
  const { userId } = useAuth();
  const subscribe = useCallback((listener: () => void) =>
    userId ? store.subscribe(userId, listener) : () => {}, [userId]);
  const getSnapshot = useCallback(() => userId ? store.getSnapshot(userId) : signedOut, [userId]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (userId) void store.load(userId).catch(() => {});
  }, [userId]);

  const toggle = useCallback(async (tutorialId: string) => {
    if (!userId) throw new Error('Sign in to save a tutorial.');
    await store.toggle(userId, tutorialId);
  }, [userId]);
  const retry = useCallback(async () => {
    if (userId) await store.load(userId);
  }, [userId]);
  return { ...snapshot, toggle, retry };
}
