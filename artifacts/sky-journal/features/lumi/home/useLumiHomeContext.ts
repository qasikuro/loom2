/**
 * Layer A — account-scoped user context for the home Lumi.
 * Emits candidates (greeting / celebration / suggestion) to the manager only
 * while the companion is actually visible (screen focused + app active + card
 * on screen). Confirmed creation events stay pending in events.ts until then.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLumiActivity } from './useLumiActivity';
import { subscribeLumiCreations, takeLumiCreations } from './events';
import { decideGreeting, shouldSuggestCreate, type Candidate } from './reactionManager';
import { ensureMarker, parseVisitRecord, shouldGreet, touchMarker, visitStorageKey, type SessionMarker } from './visitPolicy';

// Session markers survive Fast Refresh and tab navigation (process lifetime).
const registry = globalThis as typeof globalThis & { __storigamLumiHomeSession?: Record<string, SessionMarker> };
const markers = (registry.__storigamLumiHomeSession ??= {});

function marker(userId: string, now = Date.now()): SessionMarker {
  const next = ensureMarker(markers[userId], now);
  markers[userId] = next;
  return next;
}

const visitWrites = new Map<string, Promise<void>>();
function writeVisit(userId: string, now: number, welcomed: boolean): Promise<void> {
  const pending = (visitWrites.get(userId) ?? Promise.resolve()).then(async () => {
    try {
      const prev = parseVisitRecord(await AsyncStorage.getItem(visitStorageKey(userId)));
      await AsyncStorage.setItem(visitStorageKey(userId), JSON.stringify({
        lastVisitAt: Math.max(now, prev?.lastVisitAt ?? 0),
        welcomedAt: welcomed ? now : prev?.welcomedAt ?? null,
      }));
    } catch { /* storage failure only affects next greeting choice */ }
  });
  visitWrites.set(userId, pending);
  void pending.finally(() => { if (visitWrites.get(userId) === pending) visitWrites.delete(userId); });
  return pending;
}

export function useLumiHomeContext(input: {
  userId: string | null | undefined;
  accountReady: boolean;
  accountCreatedAt: number | null;
  dataReady: boolean;
  storyCount: number;
  journalCount: number;
  outfitCount: number;
  inView: boolean;
  onCandidate: (c: Candidate) => void;
}) {
  const { userId, accountReady, accountCreatedAt, dataReady, storyCount, journalCount, outfitCount, inView } = input;
  const activity = useLumiActivity();
  const visible = !!userId && activity.active && inView;

  const emitRef = useRef(input.onCandidate);
  emitRef.current = input.onCandidate;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const createdRef = useRef(accountCreatedAt);
  createdRef.current = accountCreatedAt;

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (!userId) return;
      const now = Date.now();
      if (state === 'active') markers[userId] = touchMarker(markers[userId], now);
      else {
        marker(userId).lastActiveAt = now;
        if (state === 'background') void writeVisit(userId, now, false);
      }
    });
    return () => sub.remove();
  }, [userId]);

  // Greeting: once per account session, marked synchronously before any await.
  useEffect(() => {
    if (!visible || !userId || !accountReady) return;
    const m = marker(userId);
    if (!shouldGreet(m)) return;
    m.greeted = true;
    let cancelled = false;
    let delivered = false;
    void (async () => {
      let record = null;
      try { record = parseVisitRecord(await AsyncStorage.getItem(visitStorageKey(userId))); } catch { record = null; }
      if (cancelled) return;
      const now = Date.now();
      const reaction = decideGreeting({ lastVisitAt: record?.lastVisitAt ?? null, accountCreatedAt: createdRef.current, now });
      delivered = true;
      emitRef.current({ key: `greet:${userId}:${m.sessionId}`, reaction });
      void writeVisit(userId, now, reaction === 'welcomeNew');
    })();
    return () => {
      cancelled = true;
      if (!delivered && markers[userId]?.sessionId === m.sessionId) markers[userId].greeted = false;
    };
  }, [visible, userId, accountReady]);

  // Confirmed creations: claim only while visible; otherwise they wait.
  const claim = useCallback(() => {
    if (!userId || !visibleRef.current) return;
    const events = takeLumiCreations(userId);
    const latest = events[events.length - 1];
    if (latest) emitRef.current({ key: `create:${latest.key}`, reaction: 'celebrate', creationKind: latest.kind, contentId: latest.contentId });
  }, [userId]);

  useEffect(() => { if (visible) claim(); }, [visible, claim]);
  useEffect(() => {
    let alive = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const stop = subscribeLumiCreations(event => {
      if (event.userId !== userId) return;
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (alive) { try { claim(); } catch { /* never affect saves */ } }
      }, 0);
      timers.add(timer);
    });
    return () => { alive = false; stop(); timers.forEach(clearTimeout); };
  }, [claim, userId]);

  // Gentle suggestion: only when data is confirmed complete and empty.
  useEffect(() => {
    if (!visible || !userId) return;
    const m = marker(userId);
    if (!shouldSuggestCreate({
      dataReady, storyCount, journalCount, outfitCount,
      offeredThisSession: m.suggestOffered, dismissedThisSession: m.suggestDismissed,
    })) return;
    m.suggestOffered = true;
    emitRef.current({ key: `suggest:${userId}:${m.sessionId}`, reaction: 'suggestCreate' });
  }, [visible, userId, dataReady, storyCount, journalCount, outfitCount]);

  const dismissSuggestion = useCallback(() => {
    if (userId) marker(userId).suggestDismissed = true;
  }, [userId]);

  return { visible, reducedMotion: activity.reducedMotion, dismissSuggestion };
}
