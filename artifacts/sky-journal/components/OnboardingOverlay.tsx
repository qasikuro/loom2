import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSound } from '@/context/SoundContext';

const STORAGE_KEY = 'onboarding_v1';
const { width: W, height: H } = Dimensions.get('window');

interface Step {
  id:          string;
  emoji:       string;
  title:       string;
  subtitle:    string;
  description: string;
  gradient:    readonly [string, string, ...string[]];
  accent:      string;
  hint:        string;
}

const STEPS: Step[] = [
  {
    id:          'welcome',
    emoji:       '✦',
    title:       'Welcome to Sky Journal',
    subtitle:    'your sky companion',
    description: 'A dreamy space for your memories, stories, and soul — guided by Lumi, your sky companion.',
    gradient:    ['#0E0B20', '#2A1560', '#1A0E38'],
    accent:      '#C8A84B',
    hint:        '',
  },
  {
    id:          'journal',
    emoji:       '📖',
    title:       'Your Private Sky',
    subtitle:    'journal',
    description: 'Write diary entries, capture moments, and log time with friends — always private, just for you.',
    gradient:    ['#120C30', '#2E1B6A', '#1A0E40'],
    accent:      '#A88EF8',
    hint:        'Find it in the Journal tab →',
  },
  {
    id:          'create',
    emoji:       '✨',
    title:       'Tell Your Story',
    subtitle:    'create',
    description: 'Build manga-style chapters with photos and captions. Tap ✦ to start — share with the world or keep it private.',
    gradient:    ['#14083A', '#3C1870', '#220E48'],
    accent:      '#D0B4FF',
    hint:        'Tap the ✦ button →',
  },
  {
    id:          'discover',
    emoji:       '🪄',
    title:       'Find Your Kind',
    subtitle:    'discover',
    description: 'Explore chapters from other sky children. Follow creators, witness their stories, and find your vibes.',
    gradient:    ['#0A1530', '#142A5E', '#0E1A40'],
    accent:      '#80C4FF',
    hint:        'Find it in the Discover tab →',
  },
  {
    id:          'drift',
    emoji:       '🌙',
    title:       'Enter the Drift',
    subtitle:    'drift mode',
    description: 'When the world feels heavy, drift with Lumi. Focus sessions, breathing exercises, and guided calm.',
    gradient:    ['#060510', '#14103A', '#0A0820'],
    accent:      '#98B8F0',
    hint:        'Drift card on the Home screen →',
  },
  {
    id:          'profile',
    emoji:       '🦋',
    title:       'Your Sky Identity',
    subtitle:    'profile',
    description: 'Shape your character, log your outfits, and choose what the world sees. This space is entirely yours.',
    gradient:    ['#160824', '#3A1250', '#200C38'],
    accent:      '#E8B0F8',
    hint:        'Find it in the Profile tab →',
  },
];

interface OnboardingOverlayProps {
  visible:    boolean;
  onComplete: () => void;
}

export function OnboardingOverlay({ visible, onComplete }: OnboardingOverlayProps) {
  const [step, setStep]         = useState(0);
  const slideAnim               = useRef(new Animated.Value(0)).current;
  const fadeAnim                = useRef(new Animated.Value(0)).current;
  const emojiScale              = useRef(new Animated.Value(0)).current;
  const emojiGlow               = useRef(new Animated.Value(0)).current;
  const particleAnims           = useRef(
    Array.from({ length: 8 }, () => ({
      x:   new Animated.Value(0),
      y:   new Animated.Value(0),
      op:  new Animated.Value(0),
    }))
  ).current;
  const { playSound } = useSound();

  // Fade in overlay
  useEffect(() => {
    if (visible) {
      setStep(0);
      slideAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue:        1,
        duration:       500,
        easing:         Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      animateEmoji();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  // Emoji entrance + breathing animation
  function animateEmoji() {
    emojiScale.setValue(0);
    emojiGlow.setValue(0);
    Animated.parallel([
      Animated.spring(emojiScale, {
        toValue:         1,
        tension:         60,
        friction:        6,
        useNativeDriver: true,
      }),
      Animated.timing(emojiGlow, {
        toValue:         1,
        duration:        600,
        easing:          Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(emojiScale, {
          toValue:         1.08,
          duration:        2000,
          easing:          Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(emojiScale, {
          toValue:         1,
          duration:        2000,
          easing:          Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])).start();
    });
  }

  function fireParticles() {
    particleAnims.forEach((p, i) => {
      p.x.setValue(0); p.y.setValue(0); p.op.setValue(0);
      const angle = (i / particleAnims.length) * Math.PI * 2;
      const dist  = 50 + Math.random() * 30;
      Animated.sequence([
        Animated.parallel([
          Animated.timing(p.op, { toValue: 1, duration: 60, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(p.x,  { toValue: Math.cos(angle) * dist, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(p.y,  { toValue: Math.sin(angle) * dist, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(p.op, { toValue: 0, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]).start();
    });
  }

  const goNext = useCallback(() => {
    if (step >= STEPS.length - 1) {
      playSound('chime');
      Animated.timing(fadeAnim, {
        toValue:         0,
        duration:        350,
        useNativeDriver: true,
      }).start(onComplete);
      return;
    }

    playSound('navigate');
    fireParticles();

    // Slide out current, slide in next
    Animated.timing(slideAnim, {
      toValue:         -W,
      duration:        260,
      easing:          Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setStep(s => s + 1);
      slideAnim.setValue(W);
      animateEmoji();
      Animated.timing(slideAnim, {
        toValue:         0,
        duration:        300,
        easing:          Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [step, playSound]);

  const handleSkip = useCallback(() => {
    playSound('tap');
    Animated.timing(fadeAnim, {
      toValue:         0,
      duration:        300,
      useNativeDriver: true,
    }).start(onComplete);
  }, [playSound]);

  const current = STEPS[step];
  if (!current) return null;

  const isLast  = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
        {/* Dark overlay */}
        <View style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={['rgba(6,4,18,0.92)', 'rgba(10,6,28,0.96)']}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Stars background */}
        <View style={styles.starsWrap} pointerEvents="none">
          {STAR_POSITIONS.map((s, i) => (
            <View
              key={i}
              style={[styles.star, { left: s.x, top: s.y, opacity: s.op, width: s.sz, height: s.sz, borderRadius: s.sz / 2 }]}
            />
          ))}
        </View>

        {/* Step card */}
        <Animated.View
          style={[styles.card, { transform: [{ translateX: slideAnim }] }]}
        >
          <LinearGradient
            colors={current.gradient}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
          />

          {/* Emoji orb */}
          <View style={styles.orbWrap}>
            <Animated.View
              style={[styles.orbGlow, {
                backgroundColor: current.accent + '30',
                transform: [{ scale: emojiScale }],
                opacity: emojiGlow,
              }]}
            />
            <Animated.View style={[styles.orb, { borderColor: current.accent + '55', transform: [{ scale: emojiScale }] }]}>
              <Text style={styles.emoji}>{current.emoji}</Text>
            </Animated.View>
            {/* Particles */}
            {particleAnims.map((p, i) => (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={[
                  styles.particle,
                  { backgroundColor: current.accent, transform: [{ translateX: p.x }, { translateY: p.y }], opacity: p.op },
                ]}
              />
            ))}
          </View>

          {/* Text */}
          <Text style={[styles.subtitle, { color: current.accent }]}>{current.subtitle.toUpperCase()}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.description}>{current.description}</Text>

          {current.hint ? (
            <View style={[styles.hintPill, { borderColor: current.accent + '40', backgroundColor: current.accent + '12' }]}>
              <Text style={[styles.hintText, { color: current.accent }]}>{current.hint}</Text>
            </View>
          ) : null}

          {/* Progress dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step
                    ? [styles.dotActive, { backgroundColor: current.accent }]
                    : { backgroundColor: 'rgba(255,255,255,0.18)' },
                ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.btnRow}>
            {!isFirst && (
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: current.accent, flex: isFirst ? 1 : 0 }]}
              onPress={goNext}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>
                {isLast ? 'Begin your journey ✦' : isFirst ? 'Begin tour →' : 'Next →'}
              </Text>
            </TouchableOpacity>
          </View>

        </Animated.View>

        {/* Skip from welcome screen (top-right) */}
        {isFirst && (
          <Pressable style={styles.earlySkip} onPress={handleSkip} hitSlop={16}>
            <Text style={styles.earlySkipText}>Skip tour</Text>
          </Pressable>
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Async helpers ──────────────────────────────────────────────────────────────

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    return v === 'done';
  } catch { return false; }
}

export async function markOnboardingDone(): Promise<void> {
  try { await AsyncStorage.setItem(STORAGE_KEY, 'done'); } catch { /* ignore */ }
}

// ── Static star field ──────────────────────────────────────────────────────────

const STAR_POSITIONS = Array.from({ length: 40 }, (_, i) => ({
  x:  (i * 137.508) % W,
  y:  (i * 97.301)  % H,
  op: 0.08 + (i % 5) * 0.06,
  sz: 1 + (i % 3),
}));

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         9999,
  },

  starsWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position:        'absolute',
    backgroundColor: '#FFFFFF',
  },

  card: {
    width:          Math.min(W - 32, 380),
    maxHeight:      H * 0.82,
    borderRadius:   28,
    paddingTop:     40,
    paddingBottom:  36,
    paddingHorizontal: 28,
    alignItems:     'center',
    overflow:       'hidden',
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.06)',
    elevation:      30,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 16 },
    shadowOpacity:  0.7,
    shadowRadius:   32,
  },

  orbWrap: {
    width:          120,
    height:         120,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   28,
  },
  orbGlow: {
    position:     'absolute',
    width:        140,
    height:       140,
    borderRadius: 70,
  },
  orb: {
    width:          96,
    height:         96,
    borderRadius:   48,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emoji: {
    fontSize: 40,
  },
  particle: {
    position:     'absolute',
    width:        5,
    height:       5,
    borderRadius: 3,
  },

  subtitle: {
    fontSize:      11,
    fontFamily:    'Satoshi-Bold',
    letterSpacing: 2.5,
    marginBottom:  10,
    opacity:       0.85,
  },
  title: {
    fontSize:      26,
    fontFamily:    'Satoshi-Black',
    color:         '#F0EAF8',
    textAlign:     'center',
    marginBottom:  14,
    lineHeight:    32,
  },
  description: {
    fontSize:      15,
    fontFamily:    'Satoshi-Regular',
    color:         'rgba(220,210,240,0.80)',
    textAlign:     'center',
    lineHeight:    23,
    marginBottom:  20,
  },

  hintPill: {
    paddingHorizontal: 14,
    paddingVertical:    7,
    borderRadius:      20,
    borderWidth:       1,
    marginBottom:      20,
  },
  hintText: {
    fontSize:    12,
    fontFamily:  'Satoshi-Medium',
    letterSpacing: 0.3,
  },

  dots: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  28,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  dotActive: {
    width: 20,
  },

  btnRow: {
    flexDirection: 'row',
    gap:           10,
    width:         '100%',
  },
  skipBtn: {
    flex:           1,
    height:         50,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.12)',
  },
  skipBtnText: {
    fontSize:    15,
    fontFamily:  'Satoshi-Medium',
    color:       'rgba(220,210,240,0.60)',
  },
  nextBtn: {
    height:         50,
    borderRadius:   14,
    paddingHorizontal: 22,
    alignItems:     'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize:    15,
    fontFamily:  'Satoshi-Bold',
    color:       '#0E0B20',
  },

  earlySkip: {
    position: 'absolute',
    top:      56,
    right:    24,
  },
  earlySkipText: {
    fontSize:    13,
    fontFamily:  'Satoshi-Medium',
    color:       'rgba(200,184,232,0.50)',
  },
});
