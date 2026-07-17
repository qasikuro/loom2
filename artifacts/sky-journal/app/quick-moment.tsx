import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useApp } from '@/context/AppContext';
import { persistImageUri } from '@/utils/persistImage';
import {
  FirstPublishOverlay,
  hasCompletedFirstPublish,
  markFirstPublishDone,
} from '@/components/FirstPublishOverlay';
import { CompletionMoment } from '@/components/CompletionMoment';

const { width: W } = Dimensions.get('window');

const MOODS = [
  { id: 'Dreamy',      emoji: '🌙', color: '#9B78E8' },
  { id: 'Hopeful',     emoji: '☀️', color: '#C8A84B' },
  { id: 'Peaceful',    emoji: '🌊', color: '#78A8C8' },
  { id: 'Soft',        emoji: '🌸', color: '#C87AA8' },
  { id: 'Lonely',      emoji: '🌧️', color: '#6888B8' },
  { id: 'Chaotic',     emoji: '⚡',  color: '#D0784A' },
  { id: 'Romantic',    emoji: '🌹', color: '#C87898' },
  { id: 'Adventurous', emoji: '🌿', color: '#60A878' },
] as const;

type MoodId = (typeof MOODS)[number]['id'];

const STEP_IMAGE   = 0;
const STEP_CAPTION = 1;
const STEP_PREVIEW = 2;

export default function QuickMomentScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === 'web' ? 48 : insets.top;
  const botPad  = Platform.OS === 'web' ? 24 : insets.bottom + 16;

  const { addStory } = useApp();
  const { eventPrompt, eventMood } = useLocalSearchParams<{ eventPrompt?: string; eventMood?: string }>();

  const [step,          setStep]          = useState(STEP_IMAGE);
  const [imageUri,      setImageUri]      = useState<string | null>(null);
  const [caption,       setCaption]       = useState('');
  const [mood,          setMood]          = useState<MoodId>('Dreamy');

  // Pre-fill from event params
  useEffect(() => {
    if (eventPrompt) setCaption(String(eventPrompt));
    if (eventMood) {
      const m = MOODS.find(x => x.id === eventMood);
      if (m) setMood(m.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [isPublic,      setIsPublic]      = useState(true);
  const [uploading,     setUploading]     = useState(false);
  const [posting,       setPosting]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [showFirst,     setShowFirst]     = useState(false);
  const [showCompletion,setShowCompletion]= useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const pendingMoodRef    = useRef<string | null>(null);
  const pendingLineRef    = useRef<string>('');

  const currentMood = MOODS.find(m => m.id === mood)!;
  const accentColor = currentMood.color;

  function goToStep(next: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(slideAnim, { toValue: -W, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setStep(next);
      slideAnim.setValue(W);
      Animated.spring(slideAnim, { toValue: 0, tension: 52, friction: 9, useNativeDriver: true }).start();
    });
  }

  async function pickImage() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ['images'],
      allowsEditing: true,
      quality:       1,
    });
    if (res.canceled || !res.assets[0]) return;
    const localUri = res.assets[0].uri;
    setImageUri(localUri);
    setUploading(true);
    try {
      const serverUri = await persistImageUri(localUri);
      setImageUri(serverUri);
    } catch { /* keep local uri */ }
    finally { setUploading(false); }
    goToStep(STEP_CAPTION);
  }

  async function handlePublish() {
    const isFirstPublish = !(await hasCompletedFirstPublish());
    if (isFirstPublish) {
      pendingMoodRef.current = null;
      pendingLineRef.current = '';
      setShowFirst(true);
      return;
    }
    doPublish(mood, '');
  }

  async function doPublish(finalMood: string, openingLine: string) {
    setPosting(true);
    setError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const title = openingLine.trim() || caption.trim() || 'A quiet moment';
    const panelText = caption.trim();
    const panelId   = crypto.randomUUID();
    const pageId    = crypto.randomUUID();
    const panel     = { id: panelId, text: panelText, bubbleText: '', imageUri: imageUri ?? undefined };

    const ok = await addStory({
      id:             crypto.randomUUID(),
      date:           new Date().toISOString(),
      chapterTitle:   title,
      description:    '',
      panels:         [panel],
      mood:           finalMood,
      location:       'Isle of Dawn',
      isPublic,
      witnessedCount: 0,
      savedCount:     0,
      stickerCount:   0,
      pageLayoutKey:  '1',
      pages:          [{ id: pageId, layoutKey: '1', panels: [panel] }],
    });

    setPosting(false);
    if (!ok) {
      setError("Couldn't publish — check your connection and try again");
      return;
    }
    await markFirstPublishDone();
    setShowCompletion(true);
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={['#070418', '#0C0920', '#060412']} style={StyleSheet.absoluteFill} />

      {/* Mood glow */}
      <LinearGradient
        colors={[`${accentColor}18`, 'transparent']}
        style={[StyleSheet.absoluteFill, { height: 300 }]}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.76)" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Icon name="zap" size={14} color={accentColor} />
          <Text style={[s.headerTitle, { color: accentColor }]}>Quick Moment</Text>
        </View>
        {/* Visibility toggle */}
        <TouchableOpacity
          style={[s.visBtn, { borderColor: isPublic ? '#78C8A055' : '#9B7FE855', backgroundColor: isPublic ? '#78C8A012' : '#9B7FE812' }]}
          onPress={() => { setIsPublic(v => !v); Haptics.selectionAsync(); }}
        >
          <Icon name={isPublic ? 'globe' : 'lock'} size={13} color={isPublic ? '#78C8A0' : '#9B7FE8'} />
          <Text style={[s.visBtnTxt, { color: isPublic ? '#78C8A0' : '#9B7FE8' }]}>{isPublic ? 'Public' : 'Private'}</Text>
        </TouchableOpacity>
      </View>

      {/* Step indicator */}
      <View style={s.stepRow}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={[s.stepDot, {
              backgroundColor: i <= step ? accentColor : 'rgba(255,255,255,0.10)',
              width:           i === step ? 24 : 8,
            }]}
          />
        ))}
      </View>

      <Animated.View style={[{ flex: 1, transform: [{ translateX: slideAnim }] }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={topPad + 80}
        >
          {/* ── Step 0: Image ─────────────────────────────────────── */}
          {step === STEP_IMAGE && (
            <View style={[s.stepContainer, { paddingBottom: botPad }]}>
              <Text style={s.stepTitle}>Pick your moment</Text>
              <Text style={s.stepSub}>Choose a photo to share — or skip for a text-only post.</Text>

              <TouchableOpacity style={s.imagePicker} onPress={pickImage} activeOpacity={0.85}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={s.imagePickerInner}>
                    <View style={[s.imagePickerIcon, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}40` }]}>
                      <Icon name="camera" size={28} color={accentColor} />
                    </View>
                    <Text style={[s.imagePickerTxt, { color: accentColor }]}>Tap to choose a photo</Text>
                    <Text style={s.imagePickerSub}>From your camera roll</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: accentColor, opacity: uploading ? 0.6 : 1 }]}
                onPress={imageUri ? () => goToStep(STEP_CAPTION) : pickImage}
                activeOpacity={0.85}
                disabled={uploading}
              >
                <Text style={s.primaryBtnTxt}>{uploading ? 'Uploading…' : imageUri ? 'Looks good →' : 'Choose photo'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.skipBtn} onPress={() => goToStep(STEP_CAPTION)}>
                <Text style={s.skipBtnTxt}>Skip image</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 1: Caption + Mood ────────────────────────────── */}
          {step === STEP_CAPTION && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[s.stepContainer, { paddingBottom: botPad }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.stepTitle}>Add a caption</Text>
              <Text style={s.stepSub}>What's the feeling behind this moment?</Text>

              {/* Caption input */}
              <TextInput
                style={[s.captionInput, { borderColor: `${accentColor}30` }]}
                placeholder="A thought, a feeling, a wish…"
                placeholderTextColor="rgba(200,185,255,0.22)"
                value={caption}
                onChangeText={t => setCaption(t.slice(0, 200))}
                multiline
                maxLength={200}
                autoFocus={Platform.OS !== 'web'}
                textAlignVertical="top"
              />
              <Text style={s.charCount}>{caption.length}/200</Text>

              {/* Mood row */}
              <Text style={s.moodLabel}>MOOD</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.moodRow}>
                {MOODS.map(m => {
                  const active = mood === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.moodChip, {
                        borderColor:     active ? m.color : 'rgba(255,255,255,0.07)',
                        backgroundColor: active ? `${m.color}20` : 'rgba(255,255,255,0.03)',
                      }]}
                      onPress={() => { setMood(m.id); Haptics.selectionAsync(); }}
                      activeOpacity={0.8}
                    >
                      <Text style={s.moodEmoji}>{m.emoji}</Text>
                      <Text style={[s.moodChipTxt, { color: active ? m.color : 'rgba(200,185,255,0.45)' }]}>{m.id}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: accentColor, marginTop: 24 }]}
                onPress={() => goToStep(STEP_PREVIEW)}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnTxt}>Preview →</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── Step 2: Preview + Publish ─────────────────────────── */}
          {step === STEP_PREVIEW && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[s.stepContainer, { paddingBottom: botPad }]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.stepTitle}>Ready to share?</Text>

              {/* Preview card */}
              <View style={[s.previewCard, { borderColor: `${accentColor}22` }]}>
                {imageUri && (
                  <Image
                    source={{ uri: imageUri }}
                    style={s.previewImage}
                    contentFit="cover"
                    transition={200}
                  />
                )}
                <View style={s.previewBody}>
                  <View style={[s.previewMoodRow, { backgroundColor: `${accentColor}18` }]}>
                    <Text style={s.previewMoodEmoji}>{currentMood.emoji}</Text>
                    <Text style={[s.previewMoodTxt, { color: accentColor }]}>{mood}</Text>
                  </View>
                  {caption.trim() ? (
                    <Text style={s.previewCaption} numberOfLines={5}>{caption.trim()}</Text>
                  ) : (
                    <Text style={s.previewCaptionEmpty}>No caption</Text>
                  )}
                </View>
              </View>

              {error && (
                <View style={s.errorRow}>
                  <Icon name="alert-circle" size={14} color="#E05C5C" />
                  <Text style={s.errorTxt}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.publishBtn, { backgroundColor: accentColor, opacity: posting ? 0.65 : 1 }]}
                onPress={handlePublish}
                disabled={posting}
                activeOpacity={0.88}
              >
                <Icon name="send" size={17} color="#fff" />
                <Text style={s.publishBtnTxt}>{posting ? 'Publishing…' : 'Publish moment ✦'}</Text>
              </TouchableOpacity>

              <Text style={s.publishHint}>{isPublic ? '✦ Visible in Discover' : '✦ Only visible to you'}</Text>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Animated.View>

      <FirstPublishOverlay
        visible={showFirst}
        initialMood={mood}
        onPublish={(overlayMood, openingLine) => {
          setShowFirst(false);
          doPublish(overlayMood, openingLine);
        }}
      />

      <CompletionMoment
        visible={showCompletion}
        variant="story"
        onFinish={() => router.push('/(tabs)' as any)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07041A' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingBottom: 12,
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(200,185,255,0.09)',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerTitle:  { fontSize: 16, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  visBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1,
  },
  visBtnTxt: { fontSize: 12, fontFamily: 'Satoshi-Medium' },

  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, marginBottom: 28,
  },
  stepDot: { height: 6, borderRadius: 3 },

  stepContainer: {
    paddingHorizontal: 22, paddingTop: 4, alignItems: 'stretch',
  },
  stepTitle: {
    fontSize: 26, fontFamily: 'Satoshi-Bold',
    color: 'rgba(248,244,255,0.97)', letterSpacing: -0.7,
    marginBottom: 8,
  },
  stepSub: {
    fontSize: 14, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.50)', lineHeight: 21,
    marginBottom: 26,
  },

  imagePicker: {
    width: '100%', height: 240, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(200,185,255,0.10)',
    overflow: 'hidden', marginBottom: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  imagePickerInner: { alignItems: 'center', gap: 12 },
  imagePickerIcon:  {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  imagePickerTxt: { fontSize: 15, fontFamily: 'Satoshi-Bold' },
  imagePickerSub: { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.35)' },

  primaryBtn: {
    borderRadius: 20, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  primaryBtnTxt: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: -0.2 },

  skipBtn:    { alignItems: 'center', paddingVertical: 10 },
  skipBtnTxt: { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.32)', textDecorationLine: 'underline' },

  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(248,244,255,0.94)', lineHeight: 24,
    minHeight: 110, textAlignVertical: 'top',
    marginBottom: 6,
  },
  charCount: {
    alignSelf: 'flex-end', fontSize: 10, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.28)', marginBottom: 20,
  },
  moodLabel: {
    fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 2,
    color: 'rgba(200,185,255,0.35)', marginBottom: 10,
  },
  moodRow:    { gap: 8, paddingRight: 12, marginBottom: 4 },
  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 18, borderWidth: 1,
  },
  moodEmoji:   { fontSize: 15 },
  moodChipTxt: { fontSize: 13, fontFamily: 'Satoshi-Medium' },

  previewCard: {
    borderRadius: 20, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden', marginBottom: 22,
  },
  previewImage: { width: '100%', height: 200 },
  previewBody:  { padding: 16, gap: 10 },
  previewMoodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  previewMoodEmoji: { fontSize: 15 },
  previewMoodTxt:   { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  previewCaption:   { fontSize: 15, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(220,210,255,0.78)', lineHeight: 22 },
  previewCaptionEmpty: { fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.30)', fontStyle: 'italic' },

  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(224,92,92,0.10)', borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.25)', borderRadius: 14,
    padding: 12, marginBottom: 14,
  },
  errorTxt: { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Medium', color: '#E05C5C' },

  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    borderRadius: 22, paddingVertical: 20, marginBottom: 12,
  },
  publishBtnTxt: { fontSize: 17, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: -0.2 },
  publishHint: {
    fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(200,185,255,0.22)', textAlign: 'center',
  },
});
