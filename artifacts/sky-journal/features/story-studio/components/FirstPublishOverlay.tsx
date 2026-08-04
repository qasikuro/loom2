import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSound } from '@/context/SoundContext';

const { width: W, height: H } = Dimensions.get('window');

const DONE_KEY = 'first_publish_done';

export async function hasCompletedFirstPublish(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(DONE_KEY);
    return v === 'done';
  } catch { return false; }
}

/** Call this ONLY after addStory / the publish API call succeeds. */
export async function markFirstPublishDone(): Promise<void> {
  try { await AsyncStorage.setItem(DONE_KEY, 'done'); } catch { /* ignore */ }
}

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

const STEP_MOOD    = 0;
const STEP_LINE    = 1;
const STEP_CONFIRM = 2;

interface FirstPublishOverlayProps {
  visible:      boolean;
  initialMood?: string;
  /** Called when user taps the final "Publish" button — the parent does the actual addStory call and must call markFirstPublishDone() on success. */
  onPublish:    (mood: string, openingLine: string) => void;
}

export function FirstPublishOverlay({ visible, initialMood, onPublish }: FirstPublishOverlayProps) {
  const { playSound } = useSound();

  const [step, setStep]   = useState(STEP_MOOD);
  const [mood, setMood]   = useState<MoodId | null>(
    (initialMood as MoodId | undefined) ?? null,
  );
  const [line, setLine]   = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const emojiAnim = useRef(new Animated.Value(0)).current;

  const selectedMood = MOODS.find(m => m.id === mood) ?? MOODS[0];

  useEffect(() => {
    if (!visible) return;
    setStep(STEP_MOOD);
    setMood((initialMood as MoodId | undefined) ?? null);
    setLine('');
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    emojiAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
      Animated.spring(emojiAnim, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const goNext = useCallback(() => {
    playSound('navigate');
    Animated.timing(slideAnim, { toValue: -W, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setStep(prev => prev + 1);
      slideAnim.setValue(W);
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }).start();
      emojiAnim.setValue(0);
      Animated.spring(emojiAnim, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }).start();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playSound]);

  const handleConfirm = useCallback(() => {
    Keyboard.dismiss();
    playSound('chime');
    // Animate out, then hand control back to the parent for the actual publish + markFirstPublishDone
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      onPublish(mood ?? 'Dreamy', line.trim());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, line, onPublish, playSound]);

  if (!visible) return null;

  const accentColor = selectedMood.color;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['rgba(4,3,18,0.96)', 'rgba(8,5,28,0.98)']}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View style={[s.card, { transform: [{ translateX: slideAnim }] }]}>
          {/* Step indicator */}
          <View style={s.stepRow}>
            {[0, 1, 2].map(i => (
              <View
                key={i}
                style={[s.stepDot, {
                  backgroundColor: i === step ? accentColor : 'rgba(255,255,255,0.12)',
                  width:           i === step ? 20 : 6,
                }]}
              />
            ))}
          </View>

          {/* ── Step 0: Mood ───────────────────────────────────────────────── */}
          {step === STEP_MOOD && (
            <>
              <Animated.Text style={[s.emoji, { transform: [{ scale: emojiAnim }] }]}>
                ✦
              </Animated.Text>
              <Text style={s.title}>Your first story</Text>
              <Text style={s.sub}>What's the feeling behind this moment?</Text>

              <View style={s.moodGrid}>
                {MOODS.map(m => {
                  const active = mood === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.moodChip, {
                        borderColor:     active ? m.color : 'rgba(255,255,255,0.08)',
                        backgroundColor: active ? `${m.color}22` : 'rgba(255,255,255,0.03)',
                      }]}
                      onPress={() => { setMood(m.id); playSound('tap'); }}
                      activeOpacity={0.8}
                    >
                      <Text style={s.moodEmoji}>{m.emoji}</Text>
                      <Text style={[s.moodLabel, { color: active ? m.color : 'rgba(200,185,255,0.50)' }]}>
                        {m.id}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[s.nextBtn, { opacity: mood ? 1 : 0.4, backgroundColor: accentColor }]}
                onPress={goNext}
                disabled={!mood}
                activeOpacity={0.85}
              >
                <Text style={s.nextBtnTxt}>Next →</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step 1: Opening line ───────────────────────────────────────── */}
          {step === STEP_LINE && (
            <>
              <Animated.Text style={[s.emoji, { transform: [{ scale: emojiAnim }] }]}>
                {selectedMood.emoji}
              </Animated.Text>
              <Text style={s.title}>Write one line</Text>
              <Text style={s.sub}>A wish, a memory, or a feeling. Just one sentence.</Text>

              <TextInput
                style={s.lineInput}
                placeholder="The sky was full of quiet wonder…"
                placeholderTextColor="rgba(200,185,255,0.25)"
                value={line}
                onChangeText={t => setLine(t.slice(0, 120))}
                multiline
                maxLength={120}
                autoFocus={Platform.OS !== 'web'}
                returnKeyType="done"
                onSubmitEditing={() => line.trim() && goNext()}
              />
              <Text style={s.charCount}>{line.length}/120</Text>

              <TouchableOpacity
                style={[s.nextBtn, { opacity: line.trim() ? 1 : 0.42, backgroundColor: accentColor }]}
                onPress={goNext}
                disabled={!line.trim()}
                activeOpacity={0.85}
              >
                <Text style={s.nextBtnTxt}>Next →</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step 2: Confirm ────────────────────────────────────────────── */}
          {step === STEP_CONFIRM && (
            <>
              <Animated.Text style={[s.emoji, { transform: [{ scale: emojiAnim }] }]}>
                {selectedMood.emoji}
              </Animated.Text>
              <Text style={s.title}>Ready to share?</Text>
              <Text style={s.sub}>Your story will appear in Discover for others to witness.</Text>

              {line.trim() ? (
                <View style={[s.preview, { borderColor: `${accentColor}30`, backgroundColor: `${accentColor}0A` }]}>
                  <Text style={[s.previewMood, { color: accentColor }]}>{selectedMood.emoji} {mood}</Text>
                  <Text style={s.previewLine} numberOfLines={4}>{line.trim()}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[s.publishBtn, { backgroundColor: accentColor }]}
                onPress={handleConfirm}
                activeOpacity={0.88}
              >
                <Text style={s.publishBtnTxt}>Publish to the sky ✦</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end',
  },
  card: {
    width: W, paddingHorizontal: 28, paddingTop: 36, paddingBottom: 52,
    backgroundColor: 'rgba(8,5,28,0.98)',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderTopWidth: 1, borderColor: 'rgba(200,185,255,0.10)',
    minHeight: H * 0.62,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 32,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 28,
  },
  stepDot: {
    height: 6, borderRadius: 3,
  },
  emoji: {
    fontSize: 48, marginBottom: 12,
  },
  title: {
    fontSize: 24, fontFamily: 'Satoshi-Bold', color: 'rgba(248,244,255,0.97)',
    letterSpacing: -0.6, marginBottom: 8, textAlign: 'center',
  },
  sub: {
    fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.55)',
    textAlign: 'center', lineHeight: 21, marginBottom: 28, paddingHorizontal: 8,
  },
  moodGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
    marginBottom: 28, width: '100%',
  },
  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 9,
    borderRadius: 18, borderWidth: 1,
  },
  moodEmoji: { fontSize: 16 },
  moodLabel: { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  lineInput: {
    width: '100%', minHeight: 90, maxHeight: 150,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(200,185,255,0.14)',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(248,244,255,0.94)', lineHeight: 24,
    marginBottom: 6, textAlignVertical: 'top',
  },
  charCount: {
    alignSelf: 'flex-end', fontSize: 10, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.30)', marginBottom: 22,
  },
  nextBtn: {
    width: '100%', borderRadius: 18,
    paddingVertical: 18, alignItems: 'center', justifyContent: 'center',
  },
  nextBtnTxt: {
    fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: -0.2,
  },
  preview: {
    width: '100%', borderRadius: 16, borderWidth: 1,
    padding: 16, marginBottom: 24,
  },
  previewMood: { fontSize: 13, fontFamily: 'Satoshi-Bold', marginBottom: 8 },
  previewLine: {
    fontSize: 15, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(220,210,255,0.80)', lineHeight: 22,
  },
  publishBtn: {
    width: '100%', borderRadius: 20,
    paddingVertical: 20, alignItems: 'center', justifyContent: 'center',
  },
  publishBtnTxt: {
    fontSize: 17, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: -0.3,
  },
});
