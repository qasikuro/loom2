import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { SkyLoadingMark } from '@/components/SkyLoading';
import { apiFetch } from '@/context/AppContext';
import type { StoryMusic } from '@/context/mappers';
import { composeVideo, type ComposeVideoController } from '@/utils/composeVideo';
import { calculateMusicSegment, normalizeVideoTrim } from '@/utils/videoEditing';
import { VideoEditor, type VideoEditorMetadata, type VideoEditorValue } from '@/components/video/VideoEditor';
import { useTranslation } from 'react-i18next';

const TEMP_SOURCE_CAP_BYTES = 500 * 1024 * 1024;
const MOODS = [
  { label: 'Hopeful', color: '#C8A84B' },
  { label: 'Peaceful', color: '#78A8C8' },
  { label: 'Dreamy', color: '#8B6BA8' },
  { label: 'Soft', color: '#9888C0' },
  { label: 'Lonely', color: '#7090C0' },
  { label: 'Chaotic', color: '#D0784A' },
  { label: 'Adventurous', color: '#60A878' },
  { label: 'Romantic', color: '#C870A0' },
];

type Step = 'picking' | 'editing' | 'publishing' | 'done';

function inferMime(uri: string, mimeType?: string | null): string {
  if (mimeType) return mimeType;
  if (/\.mov($|\?)/i.test(uri)) return 'video/quicktime';
  if (/\.m4v($|\?)/i.test(uri)) return 'video/x-m4v';
  return 'video/mp4';
}

export default function PostVideoScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('picking');
  const [metadata, setMetadata] = useState<VideoEditorMetadata | null>(null);
  const [editorValue, setEditorValue] = useState<VideoEditorValue | null>(null);
  const [title, setTitle] = useState('');
  const [mood, setMood] = useState(MOODS[0].label);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const composeRef = useRef<ComposeVideoController | null>(null);

  const updatePlaybackMetadata = useCallback((patch: Partial<VideoEditorMetadata>) => {
    setMetadata(previous => {
      if (!previous) return previous;
      return {
        ...previous,
        durationSeconds: previous.durationSeconds > 0
          ? previous.durationSeconds
          : (patch.durationSeconds && patch.durationSeconds > 0 ? patch.durationSeconds : previous.durationSeconds),
        width: previous.width && previous.width > 0 ? previous.width : patch.width ?? previous.width,
        height: previous.height && previous.height > 0 ? previous.height : patch.height ?? previous.height,
      };
    });
    if (patch.durationSeconds && patch.durationSeconds > 0) {
      const durationSeconds = patch.durationSeconds;
      setEditorValue(previous => {
        if (!previous || previous.trim.endSeconds > 0) return previous;
        return {
          ...previous,
          trim: normalizeVideoTrim(durationSeconds, 0, Math.min(60, durationSeconds)),
        };
      });
    }
  }, []);

  const pickVideo = useCallback(async () => {
    setStep('picking');
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(t('feature.video.permissionTitle'), t('feature.video.permissionBody'), [
        { text: t('feature.video.ok'), onPress: () => router.back() },
      ]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) {
      router.back();
      return;
    }
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > TEMP_SOURCE_CAP_BYTES) {
      Alert.alert(t('feature.video.tooLargeTitle'), t('feature.video.tooLargeBody'), [
        { text: t('feature.video.tryAgain'), onPress: () => void pickVideo() },
        { text: t('feature.video.cancel'), style: 'cancel', onPress: () => router.back() },
      ]);
      return;
    }
    const durationSeconds = Math.max(0, (asset.duration ?? 0) / 1000);
    const nextMetadata: VideoEditorMetadata = {
      uri: asset.uri,
      mimeType: inferMime(asset.uri, asset.mimeType),
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      durationSeconds,
      width: asset.width,
      height: asset.height,
    };
    setMetadata(nextMetadata);
    setEditorValue({
      trim: normalizeVideoTrim(durationSeconds, 0, Math.min(60, durationSeconds)),
      music: null,
      musicStartSeconds: 0,
      originalVolume: 1,
      musicVolume: 1,
    });
    setStep('editing');
  }, [t]);

  useEffect(() => {
    void pickVideo();
  }, [pickVideo]);

  const handlePublish = async () => {
    if (!metadata || !editorValue) return;
    if (!title.trim()) {
      setError(t('feature.video.captionRequired'));
      return;
    }
    const finalDuration = editorValue.trim.endSeconds - editorValue.trim.startSeconds;
    if (finalDuration <= 0 || finalDuration > 60) {
      setError(t('feature.video.segmentRequired'));
      return;
    }
    setError(null);
    setStep('publishing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const segment = editorValue.music
      ? calculateMusicSegment(finalDuration, editorValue.music.duration, editorValue.musicStartSeconds)
      : null;
    const controller = composeVideo({
      videoUri: metadata.uri,
      mimeType: metadata.mimeType ?? undefined,
      fileName: metadata.fileName,
      videoStartSeconds: editorValue.trim.startSeconds,
      videoDurationSeconds: finalDuration,
      music: editorValue.music,
      musicStartSeconds: segment?.startSeconds ?? 0,
      originalVolume: editorValue.originalVolume,
      musicVolume: editorValue.musicVolume,
      onProgress: value => setProgress(
        value >= 1
          ? t('feature.video.processing')
          : t('feature.video.uploading', { percent: Math.round(value * 100) }),
      ),
    });
    composeRef.current = controller;
    try {
      setProgress(t('feature.video.preparing'));
      const output = await controller.promise;
      setProgress(t('feature.video.publishing'));
      const embeddedMusic: StoryMusic | null = editorValue.music && segment
        ? {
            ...editorValue.music,
            embedded: true,
            segmentStartSeconds: segment.startSeconds,
            segmentDurationSeconds: segment.durationSeconds,
            originalVolume: editorValue.originalVolume,
            musicVolume: editorValue.musicVolume,
          }
        : null;
      await apiFetch('/stories', {
        method: 'POST',
        body: JSON.stringify({
          chapterTitle: title.trim(),
          mood,
          date: new Date().toISOString().slice(0, 10),
          isPublic: true,
          panels: [],
          contentType: 'video',
          compositionId: output.compositionId,
          music: embeddedMusic,
        }),
      });
      setStep('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.replace('/(tabs)/discover' as never), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('feature.video.publishFailed'));
      setStep('editing');
    } finally {
      composeRef.current = null;
    }
  };

  const cancelPublishing = () => {
    composeRef.current?.cancel();
    composeRef.current = null;
    setProgress('');
    setStep('editing');
  };

  if (step === 'picking') {
    return (
      <View style={[styles.root, styles.center]}>
        <SkyLoadingMark size={44} color="#9B78E8" />
        <Text style={styles.loadingText}>{t('feature.video.opening')}</Text>
      </View>
    );
  }
  if (step === 'done') {
    return (
      <View style={[styles.root, styles.center]}>
        <View style={styles.doneRing}><Icon name="check" size={32} color="#9B78E8" /></View>
        <Text style={styles.doneTitle}>{t('feature.video.posted')}</Text>
        <Text style={styles.doneSub}>{t('feature.video.postedBody')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 10 }]}>
        <TouchableOpacity
          onPress={() => step === 'publishing' ? cancelPublishing() : router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={step === 'publishing' ? t('feature.video.cancelPublishing') : t('feature.video.goBack')}
        >
          <Icon name="chevron-left" size={20} color="rgba(220,205,255,0.84)" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{t('feature.video.title')}</Text>
          <Text style={styles.headerSub}>{t('feature.video.subtitle')}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 28 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>{t('feature.video.caption')}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            placeholder={t('feature.video.captionPlaceholder')}
            placeholderTextColor="rgba(200,185,255,0.30)"
            maxLength={150}
            accessibilityLabel="Video caption"
          />
        </View>
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>{t('feature.video.mood')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRow}>
            {MOODS.map(item => (
              <TouchableOpacity
                key={item.label}
                onPress={() => { setMood(item.label); Haptics.selectionAsync(); }}
                style={[styles.moodPill, mood === item.label && { borderColor: `${item.color}90`, backgroundColor: `${item.color}22` }]}
                accessibilityRole="button"
                accessibilityState={{ selected: mood === item.label }}
                accessibilityLabel={`${t('feature.video.mood')}: ${item.label}`}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.moodText, { color: mood === item.label ? item.color : 'rgba(200,185,255,0.48)' }]}>{t(`moods.${item.label}`)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {metadata && editorValue && (
          <VideoEditor
            metadata={metadata}
            value={editorValue}
            onChange={setEditorValue}
            onMetadata={updatePlaybackMetadata}
            onPublish={() => void handlePublish()}
            onCancel={step === 'publishing' ? cancelPublishing : () => void pickVideo()}
            publishing={step === 'publishing'}
            progress={progress}
            error={error}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080616' },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, color: 'rgba(210,195,255,0.60)', fontSize: 13, fontFamily: 'Satoshi-Regular' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 13, borderBottomWidth: 0.5, borderBottomColor: 'rgba(200,185,255,0.08)' },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  headerCopy: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  headerTitle: { color: '#F1ECFF', fontSize: 16, fontFamily: 'Satoshi-Bold' },
  headerSub: { marginTop: 3, color: 'rgba(210,195,255,0.48)', fontSize: 10, fontFamily: 'Satoshi-Regular' },
  scroll: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 18, gap: 17 },
  fieldWrap: { gap: 8 },
  fieldLabel: { color: 'rgba(205,190,255,0.48)', fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.2, textTransform: 'uppercase' },
  input: { color: '#F5F0FF', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(200,185,255,0.12)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Satoshi-Regular' },
  moodRow: { gap: 8, paddingRight: 10 },
  moodPill: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(200,185,255,0.14)', backgroundColor: 'rgba(255,255,255,0.035)', paddingHorizontal: 12, paddingVertical: 7 },
  moodText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  doneRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(155,120,232,0.50)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  doneTitle: { color: '#F0ECFF', fontSize: 22, fontFamily: 'Satoshi-Bold' },
  doneSub: { color: 'rgba(200,185,255,0.55)', fontSize: 13, fontFamily: 'Satoshi-Regular', marginTop: 8 },
});
