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
 * Loads friends + requests once per open (and after actions), plus debounced Find search.
 * No polling. Everything is cleared on close or when `scopeKey` (user id) changes, and
 * late responses are dropped via a generation token.
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
  const refreshFriendsRef = useRef(refreshFriends);
  refreshFriendsRef.current = refreshFriends;
  const refreshThreadsRef = useRef(refreshDmThreads);
  refreshThreadsRef.current = refreshDmThreads;

  const reset = useCallback(() => {
    gen.current++; loadSeq.current++; searchSeq.current++; inFlight.current = false;
    setFriends([]); setRequests([]); setResults([]); setLoading(false); setError(false);
    setRestricted(false); setActionError(null); setBusy(null); setSearching(false); setSearchError(false);
  }, []);

  const load = useCallback(async (afterMutation = false) => {
    const g = gen.current;
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const [f, r] = await Promise.all([
        apiFetch<FriendSummary[]>('/friends'),
        apiFetch<Invitation[]>('/friends/requests'),
      ]);
      if (g !== gen.current || seq !== loadSeq.current) return;
      setFriends(f ?? []); setRequests(r ?? []); setError(false); setRestricted(false);
      if (afterMutation) void refreshFriendsRef.current();
    } catch (e) {
      if (g !== gen.current || seq !== loadSeq.current) return;
      setFriends([]); setRequests([]); setResults([]);
      if (isRestricted(e)) { setRestricted(true); setError(false); } else { setError(true); setRestricted(false); }
    } finally {
      if (g === gen.current && seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => () => { gen.current++; loadSeq.current++; searchSeq.current++; }, []);

  useEffect(() => {
    reset();
    if (visible && scopeKey) { void load(); void refreshThreadsRef.current(); }
  }, [visible, scopeKey, load, reset]);

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
    if (g !== gen.current) return; // closed or scope changed: ignore completion
    inFlight.current = false;
    await load(true);
    if (g === gen.current) setBusy(null);
  }, [load]);

  const accept = (id: string) => mutate(id, `/friends/requests/${encodeURIComponent(id)}/accept`, 'POST', 'accept');
  const remove = (id: string) => mutate(id, `/friends/requests/${encodeURIComponent(id)}`, 'DELETE', 'remove');
  const send = (userId: string) => mutate(userId, `/friends/requests/${encodeURIComponent(userId)}`, 'POST', 'send');

  return { friends, requests, loading, error, restricted, actionError, busy, results, searching, searchError, load, accept, remove, send };
}
