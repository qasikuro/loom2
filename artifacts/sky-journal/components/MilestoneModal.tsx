import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

const { width: W, height: H } = Dimensions.get('window');

export interface MilestoneInfo {
  threshold:  number;
  titleName:  string;
  flavour:    string;
  accent:     string;
  rewardType: string;
}

const MILESTONE_COPY: Record<number, { flavour: string; accent: string; emoji: string }> = {
  10:  { flavour: 'Your words resonated. Ten souls heard you.',              accent: '#9B78E8', emoji: '◐' },
  50:  { flavour: 'Fifty hearts carried your story into the sky.',           accent: '#C8A84B', emoji: '◈' },
  100: { flavour: 'A hundred witnesses. Your story lives in the collective.', accent: '#78C8A8', emoji: '⬡' },
  500: { flavour: 'Five hundred souls. You are legend.',                     accent: '#E878B0', emoji: '✦' },
};

const NUM_PARTICLES = 18;

interface BurstParticle {
  angle:  Animated.Value;
  dist:   Animated.Value;
  opacity: Animated.Value;
  scale:  Animated.Value;
  icon:   string;
}

const PARTICLE_ICONS = ['✦', '◈', '◇', '◐', '⬡', '✿', '△', '◉', '★', '◆'];

function useBurstParticles(): BurstParticle[] {
  return useRef<BurstParticle[]>(
    Array.from({ length: NUM_PARTICLES }, (_, i) => ({
      angle:   new Animated.Value((i / NUM_PARTICLES) * Math.PI * 2),
      dist:    new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale:   new Animated.Value(0),
      icon:    PARTICLE_ICONS[i % PARTICLE_ICONS.length]!,
    })),
  ).current;
}

interface Props {
  visible:   boolean;
  milestone: MilestoneInfo | null;
  onDismiss: () => void;
}

export function buildMilestoneInfo(threshold: number, titleName: string): MilestoneInfo {
  const copy = MILESTONE_COPY[threshold] ?? { flavour: 'A new milestone reached.', accent: '#9B78E8', emoji: '✦' };
  return { threshold, titleName, flavour: copy.flavour, accent: copy.accent, rewardType: 'title' };
}

export function MilestoneModal({ visible, milestone, onDismiss }: Props) {
  const particles  = useBurstParticles();
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.7)).current;
  const shineAnim  = useRef(new Animated.Value(0)).current;
  const numAnim    = useRef(new Animated.Value(0)).current;

  const copy = milestone ? (MILESTONE_COPY[milestone.threshold] ?? MILESTONE_COPY[10]!) : MILESTONE_COPY[10]!;

  useEffect(() => {
    if (!visible) return;

    // Reset
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.7);
    shineAnim.setValue(0);
    numAnim.setValue(0);
    particles.forEach(p => { p.dist.setValue(0); p.opacity.setValue(0); p.scale.setValue(0); });

    // Fade in backdrop + card
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start();

    // Burst particles
    particles.forEach((p, i) => {
      Animated.sequence([
        Animated.delay(i * 25),
        Animated.parallel([
          Animated.timing(p.dist,    { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(p.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(p.scale,   { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
        ]),
        Animated.timing(p.opacity, { toValue: 0, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    });

    // Shine sweep
    Animated.sequence([
      Animated.delay(400),
      Animated.loop(
        Animated.timing(shineAnim, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        { iterations: 4 },
      ),
    ]).start();

    // Number count-up
    Animated.timing(numAnim, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [visible, milestone]);

  if (!visible || !milestone) return null;

  const accent = milestone.accent;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['rgba(4,2,14,0.97)', 'rgba(8,4,24,0.98)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Burst particles */}
        {particles.map((p, i) => {
          const angleDeg = (i / NUM_PARTICLES) * 360;
          const maxDist  = W * 0.42;
          return (
            <Animated.Text
              key={i}
              pointerEvents="none"
              style={[s.particle, {
                color:   `${accent}CC`,
                opacity: p.opacity,
                transform: [
                  { translateX: p.dist.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos((angleDeg * Math.PI) / 180) * maxDist] }) },
                  { translateY: p.dist.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin((angleDeg * Math.PI) / 180) * maxDist] }) },
                  { scale: p.scale },
                ],
              }]}
            >
              {p.icon}
            </Animated.Text>
          );
        })}

        {/* Card */}
        <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Card glow border */}
          <LinearGradient
            colors={[`${accent}40`, `${accent}10`, 'transparent', `${accent}10`]}
            style={s.cardBorder}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />

          {/* Shine sweep */}
          <Animated.View
            pointerEvents="none"
            style={[s.shineSweep, {
              opacity: shineAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.18, 0] }),
              transform: [{ translateX: shineAnim.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.5, W * 0.5] }) }],
            }]}
          />

          {/* Big emoji */}
          <Text style={[s.bigIcon, { color: accent }]}>{copy.emoji}</Text>

          {/* Threshold */}
          <Text style={[s.threshold, { color: accent }]}>{milestone.threshold}</Text>
          <Text style={s.thresholdLabel}>witnesses</Text>

          {/* Title unlock */}
          <View style={[s.titleBadge, { borderColor: `${accent}45`, backgroundColor: `${accent}12` }]}>
            <Text style={s.titleBadgeLabel}>Title unlocked</Text>
            <Text style={[s.titleName, { color: accent }]}>"{milestone.titleName}"</Text>
          </View>

          {/* Flavour */}
          <Text style={s.flavour}>{milestone.flavour}</Text>

          {/* CTAs */}
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: accent }]}
            onPress={() => { onDismiss(); router.push('/(tabs)/profile' as any); }}
            activeOpacity={0.88}
          >
            <Text style={s.primaryBtnTxt}>View your profile ✦</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.laterBtn} onPress={onDismiss} activeOpacity={0.70}>
            <Text style={s.laterBtnTxt}>Later</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    fontSize: 14,
    top: H / 2,
    left: W / 2,
  },
  card: {
    width: W - 48, maxWidth: 380,
    backgroundColor: 'rgba(10,7,28,0.98)',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.7, shadowRadius: 40, elevation: 40,
  },
  cardBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28,
    borderWidth: 1, borderColor: 'transparent',
  },
  shineSweep: {
    position: 'absolute', top: 0, bottom: 0, width: 60,
    backgroundColor: 'rgba(255,255,255,1)',
    transform: [{ skewX: '-20deg' }],
  },
  bigIcon: {
    fontSize: 52, marginBottom: 4,
  },
  threshold: {
    fontSize: 56, fontFamily: 'Satoshi-Bold', letterSpacing: -2, lineHeight: 60,
  },
  thresholdLabel: {
    fontSize: 14, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.45)', letterSpacing: 2, textTransform: 'uppercase',
    marginTop: -4, marginBottom: 12,
  },
  titleBadge: {
    borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 10,
    alignItems: 'center', gap: 4, marginBottom: 8,
  },
  titleBadgeLabel: {
    fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(200,185,255,0.40)',
  },
  titleName: {
    fontSize: 20, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4,
  },
  flavour: {
    fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(200,185,255,0.60)', textAlign: 'center', lineHeight: 21,
    paddingHorizontal: 8, marginBottom: 16,
  },
  primaryBtn: {
    width: '100%', borderRadius: 18,
    paddingVertical: 18, alignItems: 'center',
  },
  primaryBtnTxt: {
    fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: -0.2,
  },
  laterBtn: { paddingVertical: 8 },
  laterBtnTxt: {
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.32)',
  },
});
