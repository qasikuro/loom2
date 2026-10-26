import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { AudiusTrack, useAudiusPreview } from '@/features/story-studio/components/AudiusMusicPicker';
import { buildQueue, isNaturalEnd, nextInQueue, prevInQueue } from '../logic';

/** Routes where the Lumi soundtrack may keep playing. Anything else stops it. */
const SUPPORTED = [/^\/drift(\/|$)/, /^\/create-journal-entry(\/|$)/, /^\/create-outfit(\/|$)/, /^\/chapter-editor(\/|$)/];
export const isLumiMusicPath = (p: string | null | undefined) => !!p && SUPPORTED.some(r => r.test(p));

const favKey = (uid: string) => `lumi_fav_tracks_v1:${uid}`;
const MAX_FAVS = 30;

type Ctx = {
  track: AudiusTrack | null;
  playingId: string | null;
  pausedId: string | null;
  loadingId: string | null;
  errorId: string | null;
  /** Explicit play/pause. Passing `queue` makes next/previous walk that list. */
  toggle: (track: AudiusTrack, queue?: AudiusTrack[]) => Promise<void>;
  queue: AudiusTrack[];
  hasNext: boolean;
  hasPrev: boolean;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  /** Increments whenever the player skips; lets cards offer a different-taste follow-up. */
  skips: number;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  favorites: AudiusTrack[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (track: AudiusTrack) => void;
  clearFavorites: () => void;
};

const LumiMusicContext = createContext<Ctx | null>(null);

export function useLumiMusic(): Ctx {
  const ctx = useContext(LumiMusicContext);
  if (!ctx) throw new Error('useLumiMusic must be used inside LumiMusicProvider');
  return ctx;
}

/** Owns exactly one Lumi soundtrack, shared by every music card and the mini player. */
export function LumiMusicProvider({ children }: { children: React.ReactNode }) {
  const { userId, isSignedIn } = useAuth();
  const pathname = usePathname();
  const preview = useAudiusPreview({ retainOnPause: true });
  const [track, setTrack] = useState<AudiusTrack | null>(null);
  const [favorites, setFavorites] = useState<AudiusTrack[]>([]);
  const [queue, setQueue] = useState<AudiusTrack[]>([]);
  const [skips, setSkips] = useState(0);
  const manualRef = useRef(false);
  const prevPlayingRef = useRef<string | null>(null);
  const stopRef = useRef(preview.stop);
  const favoritesEpoch = useRef(0);
  const favoritesWrites = useRef(Promise.resolve());
  stopRef.current = preview.stop;

  const stop = useCallback(async () => {
    manualRef.current = true;
    setTrack(null);
    setQueue([]);
    await stopRef.current();
  }, []);

  // Stop on sign-out / account switch, and reload per-user favorites.
  useEffect(() => {
    void stop();
    const epoch = ++favoritesEpoch.current;
    setFavorites([]);
    if (!isSignedIn || !userId) return;
    let alive = true;
    AsyncStorage.getItem(favKey(userId)).then(raw => {
      if (!alive || epoch !== favoritesEpoch.current || !raw) return;
      try {
        const list = JSON.parse(raw) as AudiusTrack[];
        if (Array.isArray(list)) setFavorites(list.filter(t => t && typeof t.id === 'string' && typeof t.streamUrl === 'string').slice(0, MAX_FAVS));
      } catch { /* ignore */ }
    }).catch(() => null);
    return () => { alive = false; };
  }, [isSignedIn, userId, stop]);

  // Stop when leaving supported routes (reels, stories, profiles...). No auto restart.
  useEffect(() => {
    if (!isLumiMusicPath(pathname)) void stop();
  }, [pathname, stop]);

  // Stop when the app goes to background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st !== 'active') void stop(); });
    return () => sub.remove();
  }, [stop]);

  // Only show the track while the hook confirms it is loading/playing/paused or just failed.
  const active = preview.playingId ?? preview.pausedId ?? preview.loadingId;
  const shownTrack = track && (active === track.id || preview.errorId === track.id) ? track : null;

  const toggle = useCallback(async (tr: AudiusTrack, list?: AudiusTrack[]) => {
    if (!isLumiMusicPath(pathname)) return;
    manualRef.current = true;
    if (list?.length) setQueue(buildQueue(list.some(x => x.id === tr.id) ? list : [tr, ...list]));
    setTrack(tr);
    await preview.toggle(tr);
  }, [pathname, preview]);

  const pause = useCallback(async () => { manualRef.current = true; await preview.pause(); }, [preview]);

  const trackRef = useRef(track);
  trackRef.current = track;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const jump = useCallback(async (target: AudiusTrack | null, skip: boolean) => {
    if (!target || !isLumiMusicPath(pathname)) return;
    manualRef.current = true;
    if (skip) setSkips(n => n + 1);
    setTrack(target);
    // preview.toggle on a different id stops the current sound first and is generation-guarded.
    await preview.toggle(target);
  }, [pathname, preview]);
  const next = useCallback(() => jump(nextInQueue(queueRef.current, trackRef.current?.id), true), [jump]);
  const previous = useCallback(() => jump(prevInQueue(queueRef.current, trackRef.current?.id), false), [jump]);

  // Safe end-of-track advance: only after the player already pressed play, only within the queue.
  useEffect(() => {
    const prev = prevPlayingRef.current;
    if (preview.playingId) { manualRef.current = false; prevPlayingRef.current = preview.playingId; return; }
    if (preview.pausedId || preview.loadingId) return;
    prevPlayingRef.current = null;
    if (isNaturalEnd({ prevPlayingId: prev, playingId: preview.playingId, pausedId: preview.pausedId, loadingId: preview.loadingId, errorId: preview.errorId, manual: manualRef.current })
      && trackRef.current?.id === prev) {
      const target = nextInQueue(queueRef.current, prev);
      if (target) void jump(target, false);
    }
  }, [preview.playingId, preview.pausedId, preview.loadingId, preview.errorId, jump]);

  const persistFavs = useCallback((next: AudiusTrack[]) => {
    favoritesEpoch.current++;
    setFavorites(next);
    if (userId) {
      // Ordered writes ensure Clear cannot be undone by an older pending save.
      const key = favKey(userId);
      favoritesWrites.current = favoritesWrites.current.then(async () => {
        if (next.length) await AsyncStorage.setItem(key, JSON.stringify(next));
        else await AsyncStorage.removeItem(key);
      }).catch(() => {});
    }
  }, [userId]);

  const toggleFavorite = useCallback((tr: AudiusTrack) => {
    if (!userId) return;
    const exists = favorites.some(f => f.id === tr.id);
    persistFavs(exists ? favorites.filter(f => f.id !== tr.id) : [tr, ...favorites].slice(0, MAX_FAVS));
  }, [favorites, persistFavs, userId]);

  const clearFavorites = useCallback(() => persistFavs([]), [persistFavs]);

  const value = useMemo<Ctx>(() => ({
    track: shownTrack,
    playingId: preview.playingId,
    pausedId: preview.pausedId,
    loadingId: preview.loadingId,
    errorId: preview.errorId,
    toggle,
    queue,
    hasNext: !!nextInQueue(queue, shownTrack?.id) && !!shownTrack && queue.some(q => q.id === shownTrack.id),
    hasPrev: !!prevInQueue(queue, shownTrack?.id),
    next,
    previous,
    skips,
    pause,
    resume: preview.resume,
    stop,
    favorites,
    isFavorite: (id: string) => favorites.some(f => f.id === id),
    toggleFavorite,
    clearFavorites,
  }), [shownTrack, preview.playingId, preview.pausedId, preview.loadingId, preview.errorId, pause, preview.resume, toggle, queue, next, previous, skips, stop, favorites, toggleFavorite, clearFavorites]);

  return (
    <LumiMusicContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {isLumiMusicPath(pathname) && shownTrack && <LumiMiniPlayer />}
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </LumiMusicContext.Provider>
  );
}

/** Compact global controls; rendered only on supported Lumi/creation routes. */
function LumiMiniPlayer() {
  const m = useLumiMusic();
  const c = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  if (!m.track) return null;
  const tr = m.track;
  const loading = m.loadingId === tr.id;
  const playing = m.playingId === tr.id;
  const paused = m.pausedId === tr.id;
  const failed = m.errorId === tr.id && !playing && !paused && !loading;
  const status = failed
    ? t('lumi.music.failed', 'Could not play this track')
    : loading ? t('lumi.music.loading', 'Loading...')
      : playing ? t('lumi.music.playing', 'Playing')
        : paused ? t('lumi.music.paused', 'Paused') : '';

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.background }}>
      <View style={[s.bar, { backgroundColor: c.card, borderColor: c.border }]}>
        <Icon name="volume-2" size={14} color={c.tint} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.title, { color: c.foreground }]} numberOfLines={1}>{tr.title}</Text>
          <Text style={[s.sub, { color: failed ? c.destructive : c.mutedForeground }]} numberOfLines={1}>
            {status ? `${status} · ` : ''}{tr.artist}
          </Text>
        </View>
        {m.hasPrev && (
          <TouchableOpacity onPress={() => { void m.previous(); }} style={s.btn} disabled={loading}
            accessibilityLabel={t('lumi.music.prev', 'Previous track')}>
            <Icon name="chevron-left" size={17} color={loading ? c.mutedForeground : c.text} />
          </TouchableOpacity>
        )}
        {loading ? (
          <ActivityIndicator size="small" color={c.tint} />
        ) : failed ? (
          <TouchableOpacity onPress={() => { void m.toggle(tr); }} style={s.btn} accessibilityLabel={t('lumi.retry', 'Try again')}>
            <Icon name="refresh-cw" size={15} color={c.tint} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => { void (playing ? m.pause() : m.resume()); }} style={s.btn}
            accessibilityLabel={playing ? t('lumi.music.pause', 'Pause') : t('lumi.music.resume', 'Resume')}>
            <Icon name={playing ? 'pause' : 'play'} size={15} color={c.tint} />
          </TouchableOpacity>
        )}
        {m.hasNext && (
          <TouchableOpacity onPress={() => { void m.next(); }} style={s.btn} disabled={loading}
            accessibilityLabel={t('lumi.music.next', 'Next track')} testID="lumi-mini-next">
            <Icon name="chevron-right" size={17} color={loading ? c.mutedForeground : c.tint} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => m.toggleFavorite(tr)} style={s.btn}
          accessibilityLabel={m.isFavorite(tr.id) ? t('lumi.music.unfav', 'Remove from saved tracks') : t('lumi.music.fav', 'Save track')}>
          <Icon name="heart" size={15} color={m.isFavorite(tr.id) ? c.gold : c.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { void m.stop(); }} style={s.btn} accessibilityLabel={t('lumi.music.stop', 'Stop music')}>
          <Icon name="x" size={15} color={c.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    marginHorizontal: 14, marginVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 999, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, zIndex: 60,
  },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 12.5 },
  sub: { fontFamily: 'Satoshi-Regular', fontSize: 11 },
  btn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
