import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import Constants from 'expo-constants';
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { AudiusMusicPicker, AudiusTrackPlayer, type AudiusTrack } from '@/features/story-studio/components/AudiusMusicPicker';
import type { StoryMusic } from '@/context/mappers';
import {
  calculateMusicSegment,
  formatVideoRange,
  formatVideoTime,
  normalizeVideoTrim,
  selectedVideoDuration,
  type VideoTrim,
} from '@/utils/videoEditing';

export type VideoEditorMetadata = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  durationSeconds: number;
  width?: number | null;
  height?: number | null;
};

export type VideoEditorValue = {
  trim: VideoTrim;
  music: StoryMusic | null;
  musicStartSeconds: number;
  originalVolume: number;
  musicVolume: number;
};

type Props = {
  metadata: VideoEditorMetadata;
  value: VideoEditorValue;
  onChange: (value: VideoEditorValue) => void;
  onPublish: () => void;
  onCancel: () => void;
  onMetadata: (metadata: Partial<VideoEditorMetadata>) => void;
  publishing?: boolean;
  progress?: string;
  error?: string | null;
};

function bytesLabel(bytes?: number | null): string {
  if (!bytes) return 'Unavailable';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function aspectLabel(width?: number | null, height?: number | null): string {
  if (!width || !height) return 'Unavailable';
  if (Math.abs(width - height) < 8) return 'Square';
  return width > height ? 'Landscape' : 'Portrait';
}

function useAudioPreview(
  track: AudiusTrack | null,
  startSeconds: number,
  durationSeconds: number,
  playing: boolean,
  musicVolume: number,
  onDone: () => void,
) {
  const webRef = useRef<HTMLAudioElement | null>(null);
  const nativeRef = useRef<any>(null);
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    const cleanup = async () => {
      const web = webRef.current;
      webRef.current = null;
      if (web) {
        web.pause();
        web.onended = null;
        web.currentTime = 0;
      }
      const native = nativeRef.current;
      nativeRef.current = null;
      if (native) {
        await native.stopAsync().catch(() => null);
        await native.unloadAsync().catch(() => null);
      }
    };
    if (!track || !playing || durationSeconds <= 0) {
      void cleanup();
      return () => { void cleanup(); };
    }

    const start = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const audio = new window.Audio(track.streamUrl);
        audio.currentTime = startSeconds;
        audio.volume = Math.max(0, Math.min(1, musicVolume));
        audio.onended = onDone;
        webRef.current = audio;
        try {
          await audio.play();
          if (current !== generation.current) audio.pause();
        } catch {
          onDone();
        }
        return;
      }
      try {
        const { Audio } = await import('expo-av');
        const result = await Audio.Sound.createAsync(
          { uri: track.streamUrl },
          { shouldPlay: false, isLooping: false, positionMillis: startSeconds * 1000 },
        );
        if (current !== generation.current) {
          await result.sound.unloadAsync().catch(() => null);
          return;
        }
        nativeRef.current = result.sound;
        await result.sound.setVolumeAsync?.(Math.max(0, Math.min(1, musicVolume)));
        await result.sound.playAsync();
        setTimeout(() => {
          if (current === generation.current) onDone();
        }, durationSeconds * 1000);
      } catch {
        onDone();
      }
    };
    void start();
    return () => { void cleanup(); };
  }, [track, startSeconds, durationSeconds, playing, onDone]);

  useEffect(() => {
    const volume = Math.max(0, Math.min(1, musicVolume));
    if (webRef.current) webRef.current.volume = volume;
    if (nativeRef.current?.setVolumeAsync) {
      void nativeRef.current.setVolumeAsync(volume).catch(() => null);
    }
  }, [musicVolume]);
}

export function VideoEditor({ metadata, value, onChange, onPublish, onCancel, onMetadata, publishing = false, progress, error }: Props) {
  const videoRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [timelineWidth, setTimelineWidth] = useState(1);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const musicDragStart = useRef(0);
  const trimDragStart = useRef({ startSeconds: 0, endSeconds: 0, handle: 'start' as 'start' | 'end' });
  const latestRef = useRef({
    value,
    safeTrim: normalizeVideoTrim(metadata.durationSeconds, value.trim.startSeconds, value.trim.endSeconds),
    timelineWidth: 1,
    sourceDuration: metadata.durationSeconds,
  });
  const musicSegment = useMemo(
    () => value.music
      ? calculateMusicSegment(selectedVideoDuration(value.trim), value.music.duration, value.musicStartSeconds)
      : null,
    [value.music, value.musicStartSeconds, value.trim],
  );

  const safeTrim = useMemo(
    () => normalizeVideoTrim(metadata.durationSeconds, value.trim.startSeconds, value.trim.endSeconds),
    [metadata.durationSeconds, value.trim],
  );
  const duration = selectedVideoDuration(safeTrim);
  latestRef.current = {
    value,
    safeTrim,
    timelineWidth,
    sourceDuration: metadata.durationSeconds,
  };

  useEffect(() => {
    let cancelled = false;
    const loadThumbs = async () => {
      const result: string[] = [];
      if (Platform.OS === 'web' || Constants.appOwnership === 'expo') {
        if (!cancelled) setThumbs(Array.from({ length: 7 }, () => ''));
        return;
      }
      try {
        const module = await import('expo-video-thumbnails');
        for (let index = 0; index < 7; index += 1) {
          try {
            const frame = await module.getThumbnailAsync(metadata.uri, {
              time: Math.max(0, (metadata.durationSeconds * index) / 6) * 1000,
              quality: 0.45,
            });
            result.push(frame.uri);
          } catch {
            result.push('');
          }
        }
      } catch {
        result.push(...Array.from({ length: 7 }, () => ''));
      }
      if (!cancelled) setThumbs(result);
    };
    void loadThumbs();
    return () => { cancelled = true; };
  }, [metadata.uri, metadata.durationSeconds]);

  const stopPreview = useCallback(async () => {
    setPlaying(false);
    setCurrentSeconds(0);
    await videoRef.current?.pauseAsync?.().catch(() => null);
    await videoRef.current?.setPositionAsync?.(safeTrim.startSeconds * 1000).catch(() => null);
  }, [safeTrim.startSeconds]);

  const finishPreview = useCallback(() => { void stopPreview(); }, [stopPreview]);
  // A shorter song ends naturally; the video continues with its original audio
  // or silence until the selected video endpoint.
  const onMusicDone = useCallback(() => {}, []);
  useAudioPreview(
    value.music as AudiusTrack | null,
    value.musicStartSeconds ?? 0,
    musicSegment?.durationSeconds ?? 0,
    playing,
    value.musicVolume,
    onMusicDone,
  );

  const togglePreview = async () => {
    if (playing) {
      await stopPreview();
      return;
    }
    setCurrentSeconds(0);
    setPlaying(true);
    await videoRef.current?.setPositionAsync?.(safeTrim.startSeconds * 1000).catch(() => null);
    await videoRef.current?.playAsync?.().catch(() => null);
  };

  const setTrim = useCallback((next: VideoTrim) => {
    const latest = latestRef.current;
    const trim = normalizeVideoTrim(latest.sourceDuration, next.startSeconds, next.endSeconds);
    onChange({ ...latest.value, trim });
    setCurrentSeconds(0);
    if (playing) {
      setPlaying(false);
      void videoRef.current?.pauseAsync?.().catch(() => null);
      void videoRef.current?.setPositionAsync?.(trim.startSeconds * 1000).catch(() => null);
    }
  }, [onChange, playing]);

  const moveHandle = useCallback((handle: 'start' | 'end', x: number) => {
    const latest = latestRef.current;
    const ratio = Math.max(0, Math.min(1, x / Math.max(1, latest.timelineWidth)));
    const seconds = ratio * latest.sourceDuration;
    if (handle === 'start') {
      setTrim({ startSeconds: Math.min(seconds, latest.safeTrim.endSeconds), endSeconds: latest.safeTrim.endSeconds });
    } else {
      setTrim({ startSeconds: latest.safeTrim.startSeconds, endSeconds: Math.max(seconds, latest.safeTrim.startSeconds) });
    }
  }, [setTrim]);

  const startResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      const latest = latestRef.current;
      trimDragStart.current = { handle: 'start', startSeconds: latest.safeTrim.startSeconds, endSeconds: latest.safeTrim.endSeconds };
    },
    onPanResponderMove: (_event, gesture) => {
      const latest = latestRef.current;
      const base = trimDragStart.current.startSeconds / Math.max(1, latest.sourceDuration) * latest.timelineWidth;
      moveHandle('start', base + gesture.dx);
    },
  }), [moveHandle]);
  const endResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      const latest = latestRef.current;
      trimDragStart.current = { handle: 'end', startSeconds: latest.safeTrim.startSeconds, endSeconds: latest.safeTrim.endSeconds };
    },
    onPanResponderMove: (_event, gesture) => {
      const latest = latestRef.current;
      const base = trimDragStart.current.endSeconds / Math.max(1, latest.sourceDuration) * latest.timelineWidth;
      moveHandle('end', base + gesture.dx);
    },
  }), [moveHandle]);

  const setMusicStart = useCallback((x: number) => {
    const latest = latestRef.current;
    if (!latest.value.music) return;
    const maxStart = Math.max(0, latest.value.music.duration - selectedVideoDuration(latest.safeTrim));
    const next = Math.min(maxStart, Math.max(0, (x / Math.max(1, latest.timelineWidth)) * latest.value.music.duration));
    onChange({ ...latest.value, musicStartSeconds: next });
  }, [onChange]);
  const musicResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      const latest = latestRef.current;
      if (latest.value.music) {
        musicDragStart.current = (latest.value.musicStartSeconds / Math.max(1, latest.value.music.duration)) * latest.timelineWidth;
      }
    },
    onPanResponderMove: (_event, gesture) => setMusicStart(musicDragStart.current + gesture.dx),
  }), [setMusicStart]);

  const width = metadata.width && metadata.height ? metadata.width / metadata.height : 16 / 9;
  const videoLabel = `${metadata.width && metadata.height ? `${metadata.width} × ${metadata.height}` : 'Resolution unavailable'} · ${aspectLabel(metadata.width, metadata.height)} · ${bytesLabel(metadata.fileSize)}`;

  return (
    <View style={styles.root}>
      <View style={[styles.previewWrap, { aspectRatio: width }]}>
        <Video
          ref={videoRef}
          source={{ uri: metadata.uri }}
          shouldPlay={false}
          isLooping={false}
          isMuted={value.originalVolume === 0}
          volume={value.originalVolume}
          resizeMode={ResizeMode.CONTAIN}
          style={StyleSheet.absoluteFill}
          onPlaybackStatusUpdate={status => {
            if (!status.isLoaded) return;
            if (metadata.durationSeconds <= 0 && status.durationMillis && status.durationMillis > 0) {
              onMetadata({ durationSeconds: status.durationMillis / 1000 });
            }
            const elapsed = Math.max(0, status.positionMillis / 1000 - safeTrim.startSeconds);
            setCurrentSeconds(Math.min(duration, elapsed));
            if (metadata.durationSeconds > 0 && status.positionMillis / 1000 >= safeTrim.endSeconds - 0.05) finishPreview();
          }}
          onReadyForDisplay={event => {
            const naturalSize = event.naturalSize;
            if (naturalSize?.width && naturalSize?.height) {
              onMetadata({ width: naturalSize.width, height: naturalSize.height });
            }
          }}
        />
        <TouchableOpacity
          style={styles.playButton}
          onPress={() => void togglePreview()}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause preview' : 'Play preview'}
        >
          <Icon name={playing ? 'pause' : 'play'} size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.timeBadge}>
          <Text style={styles.timeText}>{formatVideoTime(currentSeconds)} / {formatVideoTime(duration)}</Text>
        </View>
      </View>

      <View style={styles.metadataRow}>
        <Icon name="info" size={14} color="#C5A5FF" />
        <Text style={styles.metadataText}>{formatVideoTime(metadata.durationSeconds)} source · {videoLabel}</Text>
      </View>

      <Text style={styles.eyebrow}>1 · TRIM YOUR MOMENT</Text>
      {metadata.durationSeconds <= 0 && (
        <View style={styles.metadataError}>
          <Icon name="alert-circle" size={15} color="#ED8996" />
          <Text style={styles.metadataErrorText}>We’re still reading this video. Press play once to load its duration before publishing.</Text>
        </View>
      )}
      <Text style={styles.rangeText}>{formatVideoRange(safeTrim)} <Text style={styles.rangeSub}>({formatVideoTime(duration)})</Text></Text>
      <View
        style={styles.timeline}
        onLayout={event => setTimelineWidth(event.nativeEvent.layout.width)}
      >
        <View style={styles.thumbRow}>
          {thumbs.map((uri, index) => uri
            ? <Image key={`${uri}-${index}`} source={{ uri }} style={styles.thumb} contentFit="cover" />
            : <View key={index} style={[styles.thumb, styles.thumbPlaceholder]}><Icon name="film" size={14} color="rgba(210,190,255,0.35)" /></View>)}
        </View>
        <View style={[styles.selection, {
          left: `${(safeTrim.startSeconds / Math.max(1, metadata.durationSeconds)) * 100}%`,
          right: `${100 - (safeTrim.endSeconds / Math.max(1, metadata.durationSeconds)) * 100}%`,
        }]} />
        <View {...startResponder.panHandlers} style={[styles.handle, { left: `${(safeTrim.startSeconds / Math.max(1, metadata.durationSeconds)) * 100}%` }]} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} />
        <View {...endResponder.panHandlers} style={[styles.handle, { left: `${(safeTrim.endSeconds / Math.max(1, metadata.durationSeconds)) * 100}%` }]} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} />
      </View>
      <Text style={styles.helper}>Drag either edge · maximum 1:00</Text>

      <Text style={styles.eyebrow}>2 · ADD MUSIC <Text style={styles.optional}>OPTIONAL</Text></Text>
      <AudiusMusicPicker
        value={value.music as AudiusTrack | null}
        mood="Creative"
        onChange={track => onChange({ ...value, music: track as StoryMusic | null, musicStartSeconds: 0 })}
      />
      {value.music && musicSegment && (
        <View style={styles.musicEditor}>
          <View style={styles.musicHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.musicTitle} numberOfLines={1}>{value.music.title}</Text>
              <Text style={styles.musicArtist}>{value.music.artist} · {formatVideoTime(value.music.duration)}</Text>
            </View>
            <AudiusTrackPlayer track={value.music as AudiusTrack} compact />
          </View>
          <Text style={styles.musicRange}>Music segment {formatVideoTime(musicSegment.startSeconds)} – {formatVideoTime(musicSegment.endsAtSeconds)} · {formatVideoTime(musicSegment.durationSeconds)}</Text>
          <View style={styles.musicTimeline} {...musicResponder.panHandlers}>
            <View style={styles.musicTrack} />
            <View style={[styles.musicSegment, {
              left: `${(musicSegment.startSeconds / Math.max(1, value.music.duration)) * 100}%`,
              width: `${(musicSegment.durationSeconds / Math.max(1, value.music.duration)) * 100}%`,
            }]} />
            <View style={[styles.musicHandle, { left: `${(musicSegment.startSeconds / Math.max(1, value.music.duration)) * 100}%` }]} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} />
          </View>
          <Text style={styles.helper}>
            {musicSegment.durationSeconds < duration
              ? 'The remaining video uses its original audio or stays silent.'
              : 'Drag the music timeline to choose any section.'}
          </Text>
        </View>
      )}

      <View style={styles.volumeRow}>
        {([
          ['Original audio', 'originalVolume'],
          ['Music volume', 'musicVolume'],
        ] as const).map(([label, key]) => (
          <View key={key} style={styles.volumeControl}>
            <Text style={styles.volumeLabel}>{label}</Text>
            <View style={styles.volumeButtons}>
              <Pressable
                onPress={() => onChange({ ...value, [key]: Math.max(0, value[key] - 0.1) })}
                style={styles.volumeButton}
                accessibilityRole="button"
                accessibilityLabel={`Decrease ${label}`}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <Text style={styles.volumeButtonText}>−</Text>
              </Pressable>
              <Text style={styles.volumeValue} accessibilityLabel={`${Math.round(value[key] * 100)}%`}>
                {Math.round(value[key] * 100)}%
              </Text>
              <Pressable
                onPress={() => onChange({ ...value, [key]: Math.min(1, value[key] + 0.1) })}
                style={styles.volumeButton}
                accessibilityRole="button"
                accessibilityLabel={`Increase ${label}`}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <Text style={styles.volumeButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {publishing ? (
        <View style={styles.publishRow}>
          <Text style={styles.publishText}>{progress ?? 'Preparing your video…'}</Text>
          <TouchableOpacity onPress={onCancel} accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.publishButton, metadata.durationSeconds <= 0 && styles.publishButtonDisabled]}
          onPress={onPublish}
          disabled={metadata.durationSeconds <= 0}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityState={{ disabled: metadata.durationSeconds <= 0 }}
        >
          <Icon name="send" size={16} color="#0B0719" />
          <Text style={styles.publishButtonText}>Preview & publish</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={onCancel}
        disabled={publishing}
        style={styles.backButton}
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.backText}>Choose a different video</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  previewWrap: { width: '100%', maxHeight: 430, borderRadius: 20, overflow: 'hidden', backgroundColor: '#15102D', alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(33,20,70,0.84)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(224,204,255,0.25)' },
  timeBadge: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(4,2,12,0.68)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  timeText: { color: '#FFF', fontSize: 11, fontFamily: 'Satoshi-Bold' },
  metadataRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  metadataText: { flex: 1, color: 'rgba(220,208,255,0.62)', fontSize: 11, fontFamily: 'Satoshi-Regular' },
  eyebrow: { color: 'rgba(200,185,255,0.48)', fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.2, marginTop: 8 },
  optional: { color: 'rgba(200,185,255,0.28)', letterSpacing: 0 },
  rangeText: { color: '#F6F1FF', fontSize: 21, fontFamily: 'Satoshi-Bold' },
  rangeSub: { color: '#C89BFF', fontSize: 14 },
  timeline: { height: 58, borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: '#1A1234' },
  thumbRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  thumb: { flex: 1, height: '100%', opacity: 0.72 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#261A4A', borderRightWidth: 1, borderRightColor: 'rgba(230,215,255,0.08)' },
  selection: { position: 'absolute', top: 0, bottom: 0, borderTopWidth: 3, borderBottomWidth: 3, borderColor: '#E3C55A' },
  handle: { position: 'absolute', top: -2, bottom: -2, width: 14, marginLeft: -7, borderRadius: 7, backgroundColor: '#F3D565', borderWidth: 2, borderColor: '#FFF', zIndex: 3 },
  helper: { color: 'rgba(220,208,255,0.42)', fontSize: 10, fontFamily: 'Satoshi-Regular' },
  musicEditor: { borderRadius: 15, padding: 12, backgroundColor: 'rgba(70,44,130,0.28)', borderWidth: 1, borderColor: 'rgba(200,165,255,0.18)', gap: 8 },
  musicHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  musicTitle: { color: '#F7F0FF', fontSize: 13, fontFamily: 'Satoshi-Bold' },
  musicArtist: { color: 'rgba(225,213,255,0.55)', fontSize: 10, fontFamily: 'Satoshi-Regular', marginTop: 2 },
  musicRange: { color: '#E6C85D', fontSize: 11, fontFamily: 'Satoshi-Bold' },
  musicTimeline: { height: 28, justifyContent: 'center', position: 'relative' },
  musicTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(220,205,255,0.18)' },
  musicSegment: { position: 'absolute', height: 8, borderRadius: 4, backgroundColor: 'rgba(230,200,91,0.75)' },
  musicHandle: { position: 'absolute', width: 12, height: 20, marginLeft: -6, borderRadius: 6, backgroundColor: '#F3D565' },
  volumeRow: { flexDirection: 'row', gap: 10 },
  volumeControl: { flex: 1, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.04)', padding: 10, gap: 6 },
  volumeLabel: { color: 'rgba(220,208,255,0.55)', fontSize: 10, fontFamily: 'Satoshi-Bold' },
  volumeButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  volumeButton: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(200,165,255,0.14)' },
  volumeButtonText: { color: '#F0D366', fontSize: 18, lineHeight: 20 },
  volumeValue: { color: '#FFF', fontSize: 12, fontFamily: 'Satoshi-Bold' },
  error: { color: '#ED8996', fontSize: 12, fontFamily: 'Satoshi-Regular', backgroundColor: 'rgba(220,80,110,0.1)', borderRadius: 10, padding: 10 },
  publishRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  publishText: { color: '#E9DFFF', fontSize: 13, fontFamily: 'Satoshi-Bold' },
  cancelText: { color: '#E5C35B', fontSize: 12, fontFamily: 'Satoshi-Bold' },
  publishButton: { minHeight: 52, borderRadius: 17, backgroundColor: '#E8C85E', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  publishButtonDisabled: { opacity: 0.38 },
  publishButtonText: { color: '#0B0719', fontSize: 14, fontFamily: 'Satoshi-Bold' },
  backButton: { alignItems: 'center', paddingVertical: 8 },
  backText: { color: 'rgba(210,195,255,0.48)', fontSize: 11, fontFamily: 'Satoshi-Regular' },
  metadataError: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(220,80,110,0.10)', borderRadius: 10, padding: 10 },
  metadataErrorText: { flex: 1, color: '#ED8996', fontSize: 11, fontFamily: 'Satoshi-Regular' },
});
