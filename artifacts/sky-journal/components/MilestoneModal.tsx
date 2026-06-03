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
  threshold:   number;
  titleName:   string;
  flavour:     string;
  accent:      string;
  rewardType:  'aura_boost' | 'storyteller' | 'featured_eligible' | 'legend';
  rewardLabel: string;
  emoji:       string;
  aura:        number;
  stars:       number;
}

interface MilestoneDef {
  titleName:   string;
  flavour:     string;
  accent:      string;
  rewardType:  MilestoneInfo['rewardType'];
  rewardLabel: string;
  emoji:       string;
  aura:        number;
  stars:       number;
}

const MILESTONE_MAP: Record<number, MilestoneDef> = {
  10: {
    titleName:   'Resonant',
    flavour:     'Your words resonated. Ten souls heard you.',
    accent:      '#9B78E8',
    rewardType:  'aura_boost',
    rewardLabel: 'Aura Boost',
    emoji:       '◐',
    aura:        20,
    stars:       10,
  },
  50: {
    titleName:   'Storyteller',
    flavour:     'Fifty hearts carried your story into the sky.',
    accent:      '#C8A84B',
    rewardType:  'storyteller',
    rewardLabel: 'Stars & Aura',
    emoji:       '◈',
    aura:        50,
    stars:       20,
  },
  100: {
    titleName:   'Illuminated',
    flavour:     'A hundred witnesses. Your story lives in the collective.',
    accent:      '#78C8A8',
    rewardType:  'featured_eligible',
    rewardLabel: 'Featured Eligible',
    emoji:       '⬡',
    aura:        80,
    stars:       30,
  },
  500: {
    titleName:   'Legend',
    flavour:     'Five hundred souls. You are legend.',
    accent:      '#E878B0',
    rewardType:  'legend',
    rewardLabel: 'Profile Shimmer',
    emoji:       '✦',
    aura:        150,
    stars:       60,
  },
};

export function buildMilestoneInfo(threshold: number, titleName: string): MilestoneInfo {
  const def = MILESTONE_MAP[threshold] ?? MILESTONE_MAP[10]!;
  return {
    threshold,
    titleName:   def.titleName ?? titleName,
    flavour:     def.flavour,
    accent:      def.accent,
    rewardType:  def.rewardType,
    rewardLabel: def.rewardLabel,
    emoji:       def.emoji,
    aura:        def.aura,
    stars:       def.stars,
  };
}

const NUM_PARTICLES = 18;

interface BurstParticle {
  dist:    Animated.Value;
  opacity: Animated.Value;
  scale:   Animated.Value;
  icon:    string;
}

const PARTICLE_ICONS = ['✦', '◈', '◇', '◐', '⬡', '✿', '△', '◉', '★', '◆'];

function useBurstParticles(): BurstParticle[] {
  return useRef<BurstParticle[]>(
    Array.from({ length: NUM_PARTICLES }, (_, i) => ({
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

export function MilestoneModal({ visible, milestone, onDismiss }: Props) {
  const particles  = useBurstParticles();
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.7)).current;
  const shineAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    fadeAnim.setValue(0);
    scaleAnim.setValue(0.7);
    shineAnim.setValue(0);
    particles.forEach(p => { p.dist.setValue(0); p.opacity.setValue(0); p.scale.setValue(0); });

    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start();

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

    Animated.sequence([
      Animated.delay(400),
      Animated.loop(
        Animated.timing(shineAnim, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        { iterations: 4 },
      ),
    ]).start();
  }, [visible, milestone]);

  if (!visible || !milestone) return null;

  const { accent, emoji, threshold, titleName, flavour, rewardType, rewardLabel, aura, stars } = milestone;

  const rewardBadgeLabel = rewardType === 'aura_boost'       ? `+${aura} Aura`
                         : rewardType === 'featured_eligible' ? 'Featured Eligible'
                         : rewardType === 'legend'            ? 'Profile Shimmer Unlocked'
                         : `+${stars} Stars, +${aura} Aura`;

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
          <Animated.View
            pointerEvents="none"
            style={[s.shineSweep, {
              opacity: shineAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.18, 0] }),
              transform: [{ translateX: shineAnim.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.5, W * 0.5] }) }],
            }]}
          />

          <Text style={[s.bigIcon, { color: accent }]}>{emoji}</Text>
          <Text style={[s.threshold, { color: accent }]}>{threshold}</Text>
          <Text style={s.thresholdLabel}>witnesses</Text>

          {/* Title unlock */}
          <View style={[s.titleBadge, { borderColor: `${accent}45`, backgroundColor: `${accent}12` }]}>
            <Text style={s.titleBadgeLabel}>Title unlocked</Text>
            <Text style={[s.titleName, { color: accent }]}>"{titleName}"</Text>
          </View>

          {/* Reward pill */}
          <View style={[s.rewardPill, { borderColor: `${accent}30`, backgroundColor: `${accent}09` }]}>
            <Text style={[s.rewardPillTxt, { color: `${accent}BB` }]}>{rewardBadgeLabel}</Text>
          </View>

          {/* Flavour */}
          <Text style={s.flavour}>{flavour}</Text>

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
  shineSweep: {
    position: 'absolute', top: 0, bottom: 0, width: 60,
    backgroundColor: 'rgba(255,255,255,1)',
    transform: [{ skewX: '-20deg' }],
  },
  bigIcon: { fontSize: 52, marginBottom: 4 },
  threshold: { fontSize: 56, fontFamily: 'Satoshi-Bold', letterSpacing: -2, lineHeight: 60 },
  thresholdLabel: {
    fontSize: 14, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.45)', letterSpacing: 2, textTransform: 'uppercase',
    marginTop: -4, marginBottom: 12,
  },
  titleBadge: {
    borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 10,
    alignItems: 'center', gap: 4,
  },
  titleBadgeLabel: {
    fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 2, textTransform: 'uppercase',
    color: 'rgba(200,185,255,0.40)',
  },
  titleName: { fontSize: 20, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4 },
  rewardPill: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  rewardPillTxt: { fontSize: 12, fontFamily: 'Satoshi-Medium', letterSpacing: 0.3 },
  flavour: {
    fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(200,185,255,0.60)', textAlign: 'center', lineHeight: 21,
    paddingHorizontal: 8, marginBottom: 12,
  },
  primaryBtn: {
    width: '100%', borderRadius: 18,
    paddingVertical: 18, alignItems: 'center',
  },
  primaryBtnTxt: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: -0.2 },
  laterBtn: { paddingVertical: 8 },
  laterBtnTxt: { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.32)' },
});
