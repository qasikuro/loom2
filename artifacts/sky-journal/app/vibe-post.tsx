import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useApp } from '@/context/AppContext';
import {
  FirstPublishOverlay,
  hasCompletedFirstPublish,
  markFirstPublishDone,
} from '@/components/FirstPublishOverlay';
import { CompletionMoment } from '@/components/CompletionMoment';

const { width: W } = Dimensions.get('window');

const MOODS = [
  { id: 'Dreamy',      emoji: '🌙', color: '#9B78E8', desc: 'soft and otherworldly' },
  { id: 'Hopeful',     emoji: '☀️', color: '#C8A84B', desc: 'warm and forward-looking' },
  { id: 'Peaceful',    emoji: '🌊', color: '#78A8C8', desc: 'still and unhurried' },
  { id: 'Soft',        emoji: '🌸', color: '#C87AA8', desc: 'gentle and tender' },
  { id: 'Lonely',      emoji: '🌧️', color: '#6888B8', desc: 'quiet ache' },
  { id: 'Chaotic',     emoji: '⚡',  color: '#D0784A', desc: 'energetic and scattered' },
  { id: 'Romantic',    emoji: '🌹', color: '#C87898', desc: 'longing and warmth' },
  { id: 'Adventurous', emoji: '🌿', color: '#60A878', desc: 'curious and alive' },
] as const;

type MoodId = (typeof MOODS)[number]['id'];

const STEP_MOOD = 0;
const STEP_TEXT = 1;

export default function VibePostScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const botPad = Platform.OS === 'web' ? 24 : insets.bottom + 16;

  const { addStory } = useApp();

  const [step,          setStep]           = useState(STEP_MOOD);
  const [mood,          setMood]           = useState<MoodId | null>(null);
  const [text,          setText]           = useState('');
  const [isPublic,      setIsPublic]       = useState(true);
  const [posting,       setPosting]        = useState(false);
  const [error,         setError]          = useState<string | null>(null);
  const [showFirst,     setShowFirst]      = useState(false);
  const [showCompletion,setShowCompletion] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const selectedMood = MOODS.find(m => m.id === mood);
  const accentColor  = selectedMood?.color ?? '#9B7FE8';

  function goToText() {
    if (!mood) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(slideAnim, { toValue: -W, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setStep(STEP_TEXT);
      slideAnim.setValue(W);
      Animated.spring(slideAnim, { toValue: 0, tension: 52, friction: 9, useNativeDriver: true }).start();
    });
  }

  async function handlePublish() {
    if (!text.trim()) { setError('Write something first'); return; }
    const isFirstPublish = !(await hasCompletedFirstPublish());
    if (isFirstPublish) {
      setShowFirst(true);
      return;
    }
    doPublish(mood ?? 'Dreamy', '');
  }

  async function doPublish(finalMood: string, openingLine: string) {
    setPosting(true);
    setError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const title    = openingLine.trim() || text.trim().slice(0, 60) || 'A vibe';
    const panelId  = crypto.randomUUID();
    const pageId   = crypto.randomUUID();
    const panel    = { id: panelId, text: text.trim(), bubbleText: '' };

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

      {/* Mood ambient */}
      <LinearGradient
        colors={[`${accentColor}14`, 'transparent']}
        style={[StyleSheet.absoluteFill, { height: 320 }]}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.76)" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Icon name="feather" size={14} color={accentColor} />
          <Text style={[s.headerTitle, { color: accentColor }]}>Vibe Post</Text>
        </View>
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
        {[0, 1].map(i => (
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

        {/* ── Step 0: Mood picker ──────────────────────────────── */}
        {step === STEP_MOOD && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.stepContainer, { paddingBottom: botPad }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.stepTitle}>What's the vibe?</Text>
            <Text style={s.stepSub}>Choose the feeling that fits this moment.</Text>

            <View style={s.moodGrid}>
              {MOODS.map(m => {
                const active = mood === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[s.moodCard, {
                      borderColor:     active ? m.color : 'rgba(255,255,255,0.07)',
                      backgroundColor: active ? `${m.color}1E` : 'rgba(255,255,255,0.03)',
                    }]}
                    onPress={() => { setMood(m.id); Haptics.selectionAsync(); }}
                    activeOpacity={0.8}
                  >
                    <Text style={s.moodCardEmoji}>{m.emoji}</Text>
                    <Text style={[s.moodCardName, { color: active ? m.color : 'rgba(200,185,255,0.72)' }]}>{m.id}</Text>
                    <Text style={s.moodCardDesc} numberOfLines={1}>{m.desc}</Text>
                    {active && (
                      <View style={[s.moodCheckDot, { backgroundColor: m.color }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: accentColor, opacity: mood ? 1 : 0.4 }]}
              onPress={goToText}
              disabled={!mood}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnTxt}>Write your vibe →</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Step 1: Text ─────────────────────────────────────── */}
        {step === STEP_TEXT && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={topPad + 80}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[s.stepContainer, { paddingBottom: botPad }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Mood badge */}
              {selectedMood && (
                <View style={s.moodBadgeRow}>
                  <View style={[s.moodBadge, { backgroundColor: `${selectedMood.color}1E`, borderColor: `${selectedMood.color}40` }]}>
                    <Text style={s.moodBadgeEmoji}>{selectedMood.emoji}</Text>
                    <Text style={[s.moodBadgeTxt, { color: selectedMood.color }]}>{mood}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setStep(STEP_MOOD)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={s.changeMoodTxt}>Change</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={s.stepTitle}>Write your vibe</Text>
              <Text style={s.stepSub}>No image needed — just words.</Text>

              <TextInput
                style={[s.textArea, { borderColor: `${accentColor}30` }]}
                placeholder={`Something ${selectedMood?.desc ?? 'on your mind'}…`}
                placeholderTextColor="rgba(200,185,255,0.22)"
                value={text}
                onChangeText={t => { setText(t.slice(0, 500)); setError(null); }}
                multiline
                maxLength={500}
                autoFocus={Platform.OS !== 'web'}
                textAlignVertical="top"
              />
              <Text style={s.charCount}>{text.length}/500</Text>

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
                <Text style={s.publishBtnTxt}>{posting ? 'Publishing…' : 'Send to the sky ✦'}</Text>
              </TouchableOpacity>

              <Text style={s.publishHint}>{isPublic ? '✦ Visible in Discover' : '✦ Only visible to you'}</Text>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Animated.View>

      <FirstPublishOverlay
        visible={showFirst}
        initialMood={mood ?? 'Dreamy'}
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
    paddingHorizontal: 18, marginBottom: 26,
  },
  stepDot: { height: 6, borderRadius: 3 },

  stepContainer: { paddingHorizontal: 22, paddingTop: 4 },
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

  moodGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginBottom: 28,
  },
  moodCard: {
    width: (W - 44 - 10) / 2,
    borderRadius: 18, borderWidth: 1,
    padding: 16, gap: 5,
    position: 'relative',
  },
  moodCardEmoji: { fontSize: 26, marginBottom: 4 },
  moodCardName:  { fontSize: 15, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  moodCardDesc:  { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.38)', lineHeight: 15 },
  moodCheckDot:  {
    position: 'absolute', top: 12, right: 12,
    width: 10, height: 10, borderRadius: 5,
  },

  primaryBtn: {
    borderRadius: 20, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnTxt: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: -0.2 },

  moodBadgeRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  moodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1,
  },
  moodBadgeEmoji: { fontSize: 16 },
  moodBadgeTxt:   { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  changeMoodTxt:  { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(200,185,255,0.38)', textDecorationLine: 'underline' },

  textArea: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderRadius: 18,
    paddingHorizontal: 18, paddingVertical: 16,
    fontSize: 17, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(248,244,255,0.96)', lineHeight: 27,
    minHeight: 180, textAlignVertical: 'top',
    marginBottom: 6,
  },
  charCount: {
    alignSelf: 'flex-end', fontSize: 10, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.28)', marginBottom: 22,
  },

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
