/**
 * Post-video screen — pick a short video from the gallery, auto-extract a
 * thumbnail, add a title + mood, then upload and publish to Discover.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Icon } from '@/components/Icon';
import { apiFetch } from '@/context/AppContext';
import { persistImageUri, persistVideoUri, ImageUploadError } from '@/utils/persistImage';

const MAX_VIDEO_DURATION_S = 10;

const MOODS = [
  { label: 'Hopeful',     color: '#C8A84B' },
  { label: 'Peaceful',    color: '#78A8C8' },
  { label: 'Dreamy',      color: '#8B6BA8' },
  { label: 'Soft',        color: '#9888C0' },
  { label: 'Lonely',      color: '#7090C0' },
  { label: 'Chaotic',     color: '#D0784A' },
  { label: 'Adventurous', color: '#60A878' },
  { label: 'Romantic',    color: '#C870A0' },
];

type Step = 'picking' | 'form' | 'uploading' | 'done';

export default function PostVideoScreen() {
  const insets = useSafeAreaInsets();

  const [step,         setStep]         = useState<Step>('picking');
  const [videoUri,     setVideoUri]      = useState<string | null>(null);
  const [thumbUri,     setThumbUri]      = useState<string | null>(null);
  const [title,        setTitle]         = useState('');
  const [mood,         setMood]          = useState(MOODS[0].label);
  const [progress,     setProgress]      = useState('');
  const [error,        setError]         = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Launch picker once on mount
  useEffect(() => { pickVideo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickVideo = useCallback(async () => {
    setStep('picking');
    setError(null);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to your photo library to post a video.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
      videoMaxDuration: MAX_VIDEO_DURATION_S,
    });

    if (result.canceled || !result.assets?.[0]) {
      router.back();
      return;
    }

    const asset = result.assets[0];

    // Check duration (picker limit is advisory; verify explicitly)
    if (asset.duration && asset.duration > MAX_VIDEO_DURATION_S * 1000) {
      Alert.alert(
        'Video too long',
        `Please pick a video that's ${MAX_VIDEO_DURATION_S} seconds or shorter.`,
        [
          { text: 'Try again', onPress: pickVideo },
          { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
        ],
      );
      return;
    }

    // Extract first frame as thumbnail
    let thumb: string | null = null;
    try {
      // Load this optional native module only when the video flow needs it.
      // Some Expo Go builds do not include ExpoVideoThumbnails; importing it
      // at route startup crashes the entire app before navigation can render.
      const VideoThumbnails = await import('expo-video-thumbnails');
      const tn = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 0, quality: 0.85 });
      thumb = tn.uri;
    } catch {
      // Expo Go doesn't support video thumbnails — fall back to null (no preview)
    }

    setVideoUri(asset.uri);
    setThumbUri(thumb);
    setStep('form');

    Animated.timing(fadeAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePost() {
    if (!videoUri) return;
    if (!title.trim()) {
      setError('Please add a title for your video.');
      return;
    }
    setError(null);
    setStep('uploading');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // 1. Upload video
      setProgress('Uploading video…');
      const uploadedVideoUri = await persistVideoUri(videoUri);

      // 2. Upload thumbnail (if extracted)
      setProgress('Uploading thumbnail…');
      let uploadedThumbUri = uploadedVideoUri; // fallback: reuse video url (won't display but prevents null)
      if (thumbUri) {
        uploadedThumbUri = await persistImageUri(thumbUri);
      }

      // 3. Create the post
      setProgress('Publishing…');
      await apiFetch('/stories', {
        method: 'POST',
        body: JSON.stringify({
          chapterTitle: title.trim(),
          mood,
          date:         new Date().toISOString().slice(0, 10),
          isPublic:     true,
          panels:       [],
          contentType:  'video',
          videoUri:     uploadedVideoUri,
          thumbnailUri: uploadedThumbUri,
        }),
      });

      setStep('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to Discover so the user can see their post
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace('/(tabs)/discover' as any);
      }, 800);

    } catch (err) {
      const msg = err instanceof ImageUploadError
        ? err.userMessage
        : (err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setError(msg);
      setStep('form');
    }
  }

  // ── Picking state ────────────────────────────────────────────────────────
  if (step === 'picking') {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#9B78E8" />
        <Text style={s.pickingLabel}>Opening gallery…</Text>
      </View>
    );
  }

  // ── Done state ───────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={s.doneRing}>
          <Icon name="check" size={32} color="#9B78E8" />
        </View>
        <Text style={s.doneTitle}>Posted!</Text>
        <Text style={s.doneSub}>Your video is live in Discover.</Text>
      </View>
    );
  }

  const selectedMoodDef = MOODS.find(m => m.label === mood) ?? MOODS[0];

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="chevron-left" size={20} color="rgba(200,185,255,0.80)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Post Video</Text>
        <View style={{ width: 36 }} />
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Video preview */}
          <View style={s.previewWrap}>
            {thumbUri ? (
              <Image source={{ uri: thumbUri }} style={s.preview} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={['#1A1040', '#2A1860', '#1C1040']}
                style={s.preview}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <Icon name="video" size={40} color="rgba(155,120,232,0.55)" />
              </LinearGradient>
            )}

            {/* Play overlay to confirm video was picked */}
            <View style={s.playBadge}>
              <Icon name="play" size={13} color="#9B78E8" />
              <Text style={s.playBadgeText}>Video selected</Text>
            </View>
          </View>

          {/* Error */}
          {error && (
            <View style={s.errorRow}>
              <Icon name="alert-circle" size={14} color="#E06070" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* Title input */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Caption</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="What's this moment about?"
              placeholderTextColor="rgba(200,185,255,0.28)"
              maxLength={150}
              returnKeyType="done"
              autoCapitalize="sentences"
            />
          </View>

          {/* Mood picker */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Mood</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.moodRow}>
              {MOODS.map(m => {
                const active = m.label === mood;
                return (
                  <Pressable
                    key={m.label}
                    onPress={() => { setMood(m.label); Haptics.selectionAsync(); }}
                    style={[
                      s.moodPill,
                      active && { backgroundColor: `${m.color}22`, borderColor: `${m.color}70` },
                    ]}
                  >
                    <Text style={[s.moodPillText, { color: active ? m.color : 'rgba(200,185,255,0.45)' }]}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Post button */}
          {step === 'uploading' ? (
            <View style={s.uploadingRow}>
              <ActivityIndicator size="small" color="#9B78E8" />
              <Text style={s.uploadingText}>{progress}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.postBtn, { borderColor: `${selectedMoodDef.color}50` }]}
              onPress={handlePost}
              activeOpacity={0.80}
            >
              <LinearGradient
                colors={[`${selectedMoodDef.color}28`, `${selectedMoodDef.color}14`]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
              <Icon name="video" size={16} color={selectedMoodDef.color} />
              <Text style={[s.postBtnText, { color: selectedMoodDef.color }]}>Post to Discover</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080616',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(200,185,255,0.08)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(200,185,255,0.09)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,236,255,0.95)', letterSpacing: -0.3,
  },

  scroll: { padding: 20, gap: 20 },

  previewWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1A1040',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 0.5, borderColor: 'rgba(155,120,232,0.45)',
  },
  playBadgeText: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#9B78E8' },

  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(224,96,112,0.10)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(224,96,112,0.30)',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  errorText: { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Regular', color: '#E07080' },

  fieldWrap: { gap: 8 },
  fieldLabel: {
    fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 1.2,
    textTransform: 'uppercase', color: 'rgba(200,185,255,0.40)',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(200,185,255,0.12)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: 'Satoshi-Regular',
    color: 'rgba(240,236,255,0.90)',
  },

  moodRow: { gap: 8, paddingRight: 8 },
  moodPill: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(200,185,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  moodPillText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  postBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    height: 52, borderRadius: 18, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    marginTop: 4,
  },
  postBtnText: { fontSize: 15, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },

  uploadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 52,
  },
  uploadingText: { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.65)' },

  pickingLabel: {
    marginTop: 16, fontSize: 13, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.50)',
  },

  doneRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: 'rgba(155,120,232,0.50)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  doneTitle: { fontSize: 22, fontFamily: 'Satoshi-Bold', color: '#F0ECFF', marginBottom: 8 },
  doneSub:   { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.55)' },
});
