import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch, useApp, type FriendSummary } from '@/context/AppContext';

export type Invitation = {
  id: string; direction: 'incoming' | 'outgoing'; userId: string; name: string;
  username: string | null; avatarUri: string | null; createdAt: string;
};
export type SearchResult = { userId: string; name: string; username: string | null; avatarUri: string | null; bio: string };
export type ActionError = 'accept' | 'remove' | 'send' | 'pending' | null;

const isRestricted = (e: unknown) => e instanceof ApiError && (e.status === 401 || e.status === 403);

/**
 * Warms friends + requests on sign-in, revalidates on open, and keeps same-account
 * data during refreshes/close. Account changes and unmount invalidate late responses.
 * Find searches are only active while the drawer is visible.
 */
export function useFriendsDrawerData(visible: boolean, scopeKey: string | null, query: string, findActive: boolean) {
  const { refreshFriends, refreshDmThreads } = useApp();
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [requests, setRequests] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [actionError, setActionError] = useState<ActionError>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const gen = useRef(0);               // bumps on close / scope change / unmount
  const loadSeq = useRef(0);
  const searchSeq = useRef(0);
  const inFlight = useRef(false);
  const loadPromise = useRef<Promise<void> | null>(null);
  const loadedScope = useRef<string | null>(null);
  const refreshFriendsRef = useRef(refreshFriends);
  refreshFriendsRef.current = refreshFriends;
  const refreshThreadsRef = useRef(refreshDmThreads);
  refreshThreadsRef.current = refreshDmThreads;

  const reset = useCallback(() => {
    gen.current++; loadSeq.current++; searchSeq.current++; inFlight.current = false;
    loadPromise.current = null;
    setFriends([]); setRequests([]); setResults([]); setLoading(false); setError(false);
    setRestricted(false); setActionError(null); setBusy(null); setSearching(false); setSearchError(false);
  }, []);

  const load = useCallback((afterMutation = false): Promise<void> => {
    if (loadPromise.current && !afterMutation) return loadPromise.current;
    const g = gen.current;
    const seq = ++loadSeq.current;
    const current = () => g === gen.current && seq === loadSeq.current;
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const request = (async () => {
      try {
        const responses = await Promise.allSettled([
          apiFetch<FriendSummary[]>('/friends', { signal: controller.signal }).then(f => { if (current()) setFriends(f ?? []); }),
          apiFetch<Invitation[]>('/friends/requests', { signal: controller.signal }).then(r => { if (current()) setRequests(r ?? []); }),
        ]);
        if (!current()) return;
        const failures = responses.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        const denied = failures.some(r => isRestricted(r.reason));
        setRestricted(denied);
        setError(!denied && failures.length > 0);
        if (denied) { setFriends([]); setRequests([]); setResults([]); }
        if (afterMutation) void refreshFriendsRef.current();
      } finally {
        clearTimeout(timeout);
        if (current()) {
          setLoading(false);
          loadPromise.current = null;
        }
      }
    })();
    loadPromise.current = request;
    return request;
  }, []);

  useEffect(() => () => { gen.current++; loadSeq.current++; searchSeq.current++; }, []);

  useEffect(() => {
    reset();
    loadedScope.current = scopeKey;
    if (scopeKey) { void load(); void refreshThreadsRef.current(); }
  }, [scopeKey, load, reset]);

  useEffect(() => {
    if (visible && scopeKey) {
      setActionError(null);
      void load();
      void refreshThreadsRef.current();
    }
  }, [visible, scopeKey, load]);

  useEffect(() => {
    const q = query.trim();
    const g = gen.current;
    const seq = ++searchSeq.current;
    if (!visible || !findActive || q.length < 2) { setResults([]); setSearching(false); setSearchError(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const people = await apiFetch<SearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`);
        if (g === gen.current && seq === searchSeq.current) { setResults(people ?? []); setSearchError(false); }
      } catch (e) {
        if (g === gen.current && seq === searchSeq.current) {
          setResults([]);
          if (isRestricted(e)) { setFriends([]); setRequests([]); setRestricted(true); } else setSearchError(true);
        }
      } finally {
        if (g === gen.current && seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, visible, findActive]);

  const mutate = useCallback(async (key: string, path: string, method: 'POST' | 'DELETE', fail: ActionError) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const g = gen.current;
    setBusy(key); setActionError(null);
    try {
      await apiFetch(path, { method });
    } catch (e) {
      if (g === gen.current) {
        if (isRestricted(e)) { setRestricted(true); setFriends([]); setRequests([]); setResults([]); }
        else setActionError(e instanceof ApiError && e.status === 409 ? 'pending' : fail);
      }
    }
    if (g !== gen.current) return; // account changed or unmounted: ignore completion
    inFlight.current = false;
    await load(true);
    if (g === gen.current) setBusy(null);
  }, [load]);

  const accept = (id: string) => mutate(id, `/friends/requests/${encodeURIComponent(id)}/accept`, 'POST', 'accept');
  const remove = (id: string) => mutate(id, `/friends/requests/${encodeURIComponent(id)}`, 'DELETE', 'remove');
  const send = (userId: string) => mutate(userId, `/friends/requests/${encodeURIComponent(userId)}`, 'POST', 'send');

  const scopeMatches = loadedScope.current === scopeKey;
  return {
    friends: scopeMatches ? friends : [],
    requests: scopeMatches ? requests : [],
    loading, error, restricted, actionError, busy,
    results: scopeMatches ? results : [], searching, searchError,
    load, accept, remove, send,
  };
}
