import { apiFetch } from '@/context/AppContext';
import { Icon } from '@/components/Icon';
import { registerNativeSound, unregisterNativeSound } from '@/utils/soundRegistry';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type AudiusTrack = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  duration: number;
  genre: string | null;
  mood: string | null;
  streamUrl: string;
};

const MAX_MUSIC_DURATION_SECONDS = 3600;

type PlayerSound = {
  stopAsync: () => Promise<void>;
  unloadAsync: () => Promise<void>;
  setOnPlaybackStatusUpdate: (callback: (status: { isLoaded?: boolean; didJustFinish?: boolean }) => void) => void;
  playAsync: () => Promise<void>;
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;
}

function useAudiusPreview() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const nativeSoundRef = useRef<PlayerSound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackGenerationRef = useRef(0);
  const mountedRef = useRef(true);

  const stop = useCallback(async () => {
    playbackGenerationRef.current += 1;
    const native = nativeSoundRef.current;
    nativeSoundRef.current = null;
    if (native) {
      unregisterNativeSound(native);
      await native.stopAsync().catch(() => null);
      await native.unloadAsync().catch(() => null);
    }
    const web = webAudioRef.current;
    webAudioRef.current = null;
    if (web) {
      web.onended = null;
      web.pause();
      web.currentTime = 0;
    }
    activeIdRef.current = null;
    setPlayingId(null);
  }, []);

  const toggle = useCallback(async (track: AudiusTrack) => {
    if (activeIdRef.current === track.id) {
      await stop();
      return;
    }
    await stop();
    const generation = playbackGenerationRef.current;
    const isCurrent = () =>
      mountedRef.current && playbackGenerationRef.current === generation;

    if (typeof window !== 'undefined' && typeof window.Audio === 'function') {
      const audio = new window.Audio(track.streamUrl);
      audio.volume = 0.45;
      audio.onended = () => {
        activeIdRef.current = null;
        webAudioRef.current = null;
        setPlayingId(null);
      };
      webAudioRef.current = audio;
      activeIdRef.current = track.id;
      try {
        await audio.play();
        if (!isCurrent()) {
          audio.onended = null;
          audio.pause();
          audio.currentTime = 0;
          if (webAudioRef.current === audio) webAudioRef.current = null;
          if (activeIdRef.current === track.id) activeIdRef.current = null;
          return;
        }
        setPlayingId(track.id);
      } catch {
        if (isCurrent()) await stop();
        else {
          audio.onended = null;
          audio.pause();
          audio.currentTime = 0;
          if (webAudioRef.current === audio) webAudioRef.current = null;
          if (activeIdRef.current === track.id) activeIdRef.current = null;
        }
      }
      return;
    }

    try {
      const { Audio } = await import('expo-av');
      const result = await Audio.Sound.createAsync(
        { uri: track.streamUrl },
        { shouldPlay: true, volume: 0.45 },
      );
      const sound = result.sound as unknown as PlayerSound;
      // Register before checking cancellation so every created native sound
      // remains visible to coordinated ExoPlayer cleanup.
      registerNativeSound(sound);
      if (!isCurrent()) {
        unregisterNativeSound(sound);
        await sound.stopAsync().catch(() => null);
        await sound.unloadAsync().catch(() => null);
        return;
      }
      nativeSoundRef.current = sound;
      activeIdRef.current = track.id;
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          void stop();
        }
      });
      setPlayingId(track.id);
    } catch {
      if (isCurrent()) await stop();
    }
  }, [stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void stop();
    };
  }, [stop]);

  return { playingId, toggle, stop };
}

type PreviewController = {
  playingId: string | null;
  toggle: (track: AudiusTrack) => Promise<void>;
};

export function AudiusTrackPlayer({
  track,
  compact = false,
  preview,
  autoPlay = false,
}: {
  track: AudiusTrack;
  compact?: boolean;
  preview?: PreviewController;
  autoPlay?: boolean;
}) {
  const localPreview = useAudiusPreview();
  const { playingId, toggle } = preview ?? localPreview;
  const isPlaying = playingId === track.id;
  const autoPlayedTrackRef = useRef<string | null>(null);

  useEffect(() => {
    // Story readers pass autoPlay without a shared preview controller. Picker
    // rows pass `preview`, so opening the picker never starts a track by itself.
    if (!autoPlay || preview || autoPlayedTrackRef.current === track.id) return;
    autoPlayedTrackRef.current = track.id;
    void toggle(track);
  }, [autoPlay, preview, toggle, track]);

  return (
    <TouchableOpacity
      onPress={() => { void toggle(track); }}
      style={[styles.playButton, compact && styles.playButtonCompact, isPlaying && styles.playButtonActive]}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? `Pause ${track.title}` : `Preview ${track.title}`}
      activeOpacity={0.78}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Icon name={isPlaying ? 'pause' : 'play'} size={compact ? 13 : 15} color="#FFF" />
    </TouchableOpacity>
  );
}

function TrackArtwork({ track, size = 52 }: { track: AudiusTrack; size?: number }) {
  return track.artworkUrl ? (
    <Image source={{ uri: track.artworkUrl }} style={{ width: size, height: size, borderRadius: 10 }} />
  ) : (
    <View style={[styles.artworkFallback, { width: size, height: size, borderRadius: 10 }]}>
      <Icon name="volume-2" size={size * 0.38} color="#F4C95D" />
    </View>
  );
}

export function AudiusMusicPicker({
  value,
  mood,
  onChange,
}: {
  value: AudiusTrack | null;
  mood?: string;
  onChange: (track: AudiusTrack | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<FlatList<AudiusTrack>>(null);
  const { playingId, toggle, stop } = useAudiusPreview();

  const searchTracks = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ tracks: AudiusTrack[] }>(`/music/search?q=${encodeURIComponent(trimmed)}`);
      const shortTracks = (result.tracks ?? []).filter(
        track => track.duration > 0 && track.duration <= MAX_MUSIC_DURATION_SECONDS,
      );
      setTracks(shortTracks);
      requestAnimationFrame(() => {
        resultsRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    } catch {
      setError('Music search is unavailable right now. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && tracks.length === 0) {
      const initialQuery = mood || 'peaceful';
      setQuery(initialQuery);
      void searchTracks(initialQuery);
    }
  }, [visible, tracks.length, mood, searchTracks]);

  function close() {
    void stop();
    setVisible(false);
  }

  function choose(track: AudiusTrack) {
    void stop();
    onChange(track);
    setVisible(false);
  }

  return (
    <>
      {value ? (
        <View style={styles.selectedCard}>
          <TrackArtwork track={value} size={58} />
          <View style={styles.selectedInfo}>
            <Text style={styles.eyebrow}>STORY MUSIC · AUDIUS</Text>
            <Text style={styles.selectedTitle} numberOfLines={1}>{value.title}</Text>
            <Text style={styles.selectedArtist} numberOfLines={1}>{value.artist} · {formatDuration(value.duration)}</Text>
            <Text style={styles.selectedHint}>This music will play across the story</Text>
          </View>
          <View style={styles.selectedActions}>
            <AudiusTrackPlayer track={value} compact preview={{ playingId, toggle }} />
            <TouchableOpacity onPress={() => setVisible(true)} style={styles.actionPill} activeOpacity={0.78} accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="refresh-cw" size={12} color="#EAC55E" />
              <Text style={styles.actionText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { void stop(); onChange(null); }} style={[styles.actionPill, styles.removePill]} activeOpacity={0.78} accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="trash-2" size={12} color="#D88B9A" />
              <Text style={[styles.actionText, { color: '#D88B9A' }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addCard} onPress={() => setVisible(true)} activeOpacity={0.82} accessibilityRole="button" accessibilityLabel="Add story music">
          <View style={styles.musicIcon}>
            <Icon name="volume-2" size={24} color="#C89BFF" />
          </View>
          <View style={styles.addCopy}>
            <Text style={styles.addTitle}>Story Music</Text>
            <Text style={styles.addSubtitle}>Give this story a soundtrack</Text>
            <Text style={styles.addHint}>Music will play across all pages</Text>
          </View>
          <View style={styles.addButton}>
            <Text style={styles.addButtonText}>Add music</Text>
            <Icon name="chevron-right" size={15} color="#F5D368" />
          </View>
        </TouchableOpacity>
      )}

      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { paddingTop: Math.max(insets.top, 18) }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={close} style={styles.backButton} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel="Close music picker" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="arrow-left" size={18} color="#E8E0FF" />
              </TouchableOpacity>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>Choose your soundtrack</Text>
                <Text style={styles.modalSubtitle}>Music sets the mood · Tracks up to 60:00</Text>
              </View>
              <Icon name="volume-2" size={22} color="#F0C95D" />
            </View>

            <View style={styles.searchBox}>
              <Icon name="search" size={16} color="rgba(215,201,255,0.5)" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => void searchTracks(query)}
                placeholder="Search songs, artists, or moods…"
                placeholderTextColor="rgba(215,201,255,0.42)"
                style={styles.searchInput}
                returnKeyType="search"
                accessibilityLabel="Search music"
              />
            </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
              {['For You', 'Cozy', 'Dreamy', 'Epic', 'Nostalgic', 'Chill', 'Adventure', 'Emotional'].map(chip => (
                <TouchableOpacity
                  key={chip}
                  onPress={() => { setQuery(chip); void searchTracks(chip); }}
                  style={[styles.chip, query.toLowerCase() === chip.toLowerCase() && styles.chipActive]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: query.toLowerCase() === chip.toLowerCase() }}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Text style={[styles.chipText, query.toLowerCase() === chip.toLowerCase() && styles.chipTextActive]}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loading ? (
              <View style={styles.loadingState}><ActivityIndicator color="#F0C95D" /><Text style={styles.loadingText}>Finding music on Audius…</Text></View>
            ) : error ? (
              <View style={styles.emptyState}>
                <Icon name="alert-circle" size={22} color="#D88B9A" />
                <Text style={styles.emptyTitle}>{error}</Text>
                <TouchableOpacity onPress={() => void searchTracks(query)} style={styles.retryButton} accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
              </View>
            ) : tracks.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="search" size={22} color="rgba(215,201,255,0.5)" />
                <Text style={styles.emptyTitle}>No tracks found</Text>
                <Text style={styles.emptyText}>Try another mood, artist, or song title.</Text>
              </View>
            ) : (
              <FlatList
                ref={resultsRef}
                key={tracks.map(track => track.id).join('-')}
                style={styles.results}
                data={tracks}
                keyExtractor={track => track.id}
                contentContainerStyle={[styles.resultsContent, { paddingBottom: insets.bottom + 58 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
                scrollEnabled={tracks.length > 0}
                renderItem={({ item: track }) => (
                  <View key={track.id} style={styles.trackRow}>
                    <TrackArtwork track={track} />
                    <AudiusTrackPlayer track={track} compact preview={{ playingId, toggle }} />
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                      <View style={styles.trackTags}>
                        {!!track.mood && <Text style={styles.tag}>{track.mood}</Text>}
                        {!!track.genre && <Text style={styles.tag}>{track.genre}</Text>}
                      </View>
                    </View>
                    <View style={styles.trackRight}>
                      <Text style={styles.duration}>{formatDuration(track.duration)}</Text>
                      <TouchableOpacity onPress={() => choose(track)} style={styles.useButton} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Use track ${track.title}`} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={styles.useButtonText}>Use this track</Text>
                      </TouchableOpacity>
                    </View>
                    {playingId === track.id && <View style={styles.playingDot} />}
                  </View>
                )}
                ListFooterComponent={
                  <Text style={styles.attribution}>
                    Music from Audius · Only tracks available for use in Sky Journal are shown.
                  </Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selectedCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(155,127,232,0.42)', backgroundColor: 'rgba(53,34,108,0.48)', padding: 11, marginBottom: 18 },
  selectedInfo: { flex: 1, minWidth: 0, marginLeft: 11 },
  eyebrow: { color: '#C8A9FF', fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.1, marginBottom: 4 },
  selectedTitle: { color: '#F8F4FF', fontSize: 14, fontFamily: 'Satoshi-Bold' },
  selectedArtist: { color: 'rgba(232,224,255,0.62)', fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 2 },
  selectedHint: { color: 'rgba(232,224,255,0.42)', fontSize: 10, fontFamily: 'Satoshi-Regular', marginTop: 5 },
  selectedActions: { alignItems: 'flex-end', gap: 6, marginLeft: 8 },
  actionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(234,197,94,0.36)', backgroundColor: 'rgba(234,197,94,0.10)', paddingVertical: 5, paddingHorizontal: 7 },
  removePill: { borderColor: 'rgba(216,139,154,0.25)', backgroundColor: 'rgba(216,139,154,0.07)' },
  actionText: { color: '#EAC55E', fontSize: 10, fontFamily: 'Satoshi-Bold' },
  addCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(155,127,232,0.38)', backgroundColor: 'rgba(53,34,108,0.40)', padding: 13, marginBottom: 18 },
  musicIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(155,127,232,0.24)', borderWidth: 1, borderColor: 'rgba(205,179,255,0.25)' },
  addCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  addTitle: { color: '#F8F4FF', fontSize: 14, fontFamily: 'Satoshi-Bold' },
  addSubtitle: { color: 'rgba(232,224,255,0.72)', fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 2 },
  addHint: { color: 'rgba(232,224,255,0.42)', fontSize: 10, fontFamily: 'Satoshi-Regular', marginTop: 6 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(240,201,93,0.44)', backgroundColor: 'rgba(240,201,93,0.10)', paddingVertical: 8, paddingHorizontal: 9 },
  addButtonText: { color: '#F5D368', fontSize: 10, fontFamily: 'Satoshi-Bold' },
  artworkFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#27204D' },
  playButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(113,76,191,0.8)', borderWidth: 1, borderColor: 'rgba(228,209,255,0.28)' },
  playButtonCompact: { width: 28, height: 28, borderRadius: 14 },
  playButtonActive: { backgroundColor: '#B779E8' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(3,2,12,0.78)', justifyContent: 'flex-end' },
  modal: { height: '94%', backgroundColor: '#0D0A1F', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 15 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  modalTitleWrap: { flex: 1, marginLeft: 12 },
  modalTitle: { color: '#FAF7FF', fontSize: 16, fontFamily: 'Satoshi-Bold' },
  modalSubtitle: { color: 'rgba(215,201,255,0.48)', fontSize: 10, fontFamily: 'Satoshi-Regular', marginTop: 3 },
  searchBox: { height: 43, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(184,157,255,0.22)', backgroundColor: 'rgba(91,64,157,0.21)', paddingHorizontal: 14 },
  searchInput: { flex: 1, color: '#F8F4FF', fontSize: 13, fontFamily: 'Satoshi-Regular', paddingVertical: 0 },
  chips: { alignItems: 'flex-start', gap: 7, paddingTop: 13, paddingBottom: 11, paddingRight: 16 },
  chip: { height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(210,194,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 11 },
  chipActive: { borderColor: 'rgba(240,201,93,0.60)', backgroundColor: 'rgba(240,201,93,0.18)' },
  chipText: { color: 'rgba(215,201,255,0.62)', fontSize: 10, fontFamily: 'Satoshi-Medium' },
  chipTextActive: { color: '#F5D368' },
  results: { flex: 1, minHeight: 0, alignSelf: 'stretch' },
  resultsContent: { flexGrow: 0, justifyContent: 'flex-start', paddingTop: 0 },
  trackRow: { flexDirection: 'row', alignItems: 'center', minHeight: 75, borderBottomWidth: 1, borderBottomColor: 'rgba(215,201,255,0.08)', paddingVertical: 9, position: 'relative' },
  trackInfo: { flex: 1, minWidth: 0, marginHorizontal: 9 },
  trackTitle: { color: '#F8F4FF', fontSize: 12, fontFamily: 'Satoshi-Bold' },
  trackArtist: { color: 'rgba(215,201,255,0.58)', fontSize: 10, fontFamily: 'Satoshi-Regular', marginTop: 2 },
  trackTags: { flexDirection: 'row', gap: 5, marginTop: 5 },
  tag: { color: '#BFA6EE', backgroundColor: 'rgba(155,127,232,0.14)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, fontSize: 8, fontFamily: 'Satoshi-Medium' },
  trackRight: { alignItems: 'flex-end', gap: 6 },
  duration: { color: 'rgba(215,201,255,0.48)', fontSize: 10, fontFamily: 'Satoshi-Regular' },
  useButton: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(240,201,93,0.55)', backgroundColor: 'rgba(240,201,93,0.10)', paddingHorizontal: 8, paddingVertical: 6 },
  useButtonText: { color: '#F5D368', fontSize: 9, fontFamily: 'Satoshi-Bold' },
  playingDot: { position: 'absolute', left: -1, top: 12, bottom: 12, width: 2, backgroundColor: '#F0C95D', borderRadius: 1 },
  attribution: { color: 'rgba(215,201,255,0.35)', fontSize: 10, lineHeight: 16, textAlign: 'center', paddingHorizontal: 20, paddingTop: 16 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: 'rgba(215,201,255,0.55)', fontSize: 12, fontFamily: 'Satoshi-Regular' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 9 },
  emptyTitle: { color: '#F4EEFF', fontSize: 13, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  emptyText: { color: 'rgba(215,201,255,0.48)', fontSize: 11, fontFamily: 'Satoshi-Regular', textAlign: 'center' },
  retryButton: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(240,201,93,0.48)', paddingHorizontal: 12, paddingVertical: 7, marginTop: 4 },
  retryText: { color: '#F5D368', fontSize: 11, fontFamily: 'Satoshi-Bold' },
});