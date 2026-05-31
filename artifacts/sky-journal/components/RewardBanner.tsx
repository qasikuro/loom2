import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import type { Reward } from '@/context/AppContext';
import { STAR_META } from '@/context/AppContext';

interface RewardBannerProps {
  reward:     Reward;
  onDismiss?: () => void;
  isExiting?: boolean;
}

// ── Particle specs: 8 directions, mix of sizes and travel distances ───────────
const PARTICLES = [
  { angle: 0,   dist: 34, size: 7,  delay: 0   },
  { angle: 45,  dist: 28, size: 5,  delay: 60  },
  { angle: 90,  dist: 38, size: 8,  delay: 20  },
  { angle: 135, dist: 26, size: 5,  delay: 80  },
  { angle: 180, dist: 32, size: 7,  delay: 10  },
  { angle: 225, dist: 30, size: 6,  delay: 50  },
  { angle: 270, dist: 36, size: 8,  delay: 30  },
  { angle: 315, dist: 24, size: 5,  delay: 70  },
];

interface StarParticlesProps {
  color: string;
}

function StarParticles({ color }: StarParticlesProps) {
  const anims = useRef(PARTICLES.map(() => ({
    opacity:   new Animated.Value(0),
    translateX: new Animated.Value(0),
    translateY: new Animated.Value(0),
    scale:     new Animated.Value(0),
  }))).current;

  useEffect(() => {
    const animations = PARTICLES.map((p, i) => {
      const rad = (p.angle * Math.PI) / 180;
      const toX  = Math.cos(rad) * p.dist;
      const toY  = Math.sin(rad) * p.dist;
      const a    = anims[i];

      return Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          // Burst outward
          Animated.spring(a.translateX, { toValue: toX, tension: 80, friction: 7, useNativeDriver: true }),
          Animated.spring(a.translateY, { toValue: toY, tension: 80, friction: 7, useNativeDriver: true }),
          // Pop in then hold
          Animated.sequence([
            Animated.timing(a.scale, { toValue: 1, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.back(2)) }),
          ]),
          // Fade in then fade out slowly
          Animated.sequence([
            Animated.timing(a.opacity, { toValue: 0.85, duration: 150, useNativeDriver: true }),
            Animated.delay(900),
            Animated.timing(a.opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
          ]),
        ]),
      ]);
    });

    Animated.parallel(animations).start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PARTICLES.map((p, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.particle,
            {
              fontSize:  p.size,
              color,
              opacity:   anims[i].opacity,
              transform: [
                { translateX: anims[i].translateX },
                { translateY: anims[i].translateY },
                { scale:     anims[i].scale },
              ],
            },
          ]}
        >
          ✦
        </Animated.Text>
      ))}
    </View>
  );
}

export function RewardBanner({ reward, onDismiss, isExiting = false }: RewardBannerProps) {
  const colors    = useColors();
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 62,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start(() => {
      // After entering, pulse the glow for star_unlock banners
      if (reward.starUnlock) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
          ]),
        ).start();
      }
    });
  }, []);

  // Exit animation — slides up and fades out when parent signals dismissal
  useEffect(() => {
    if (!isExiting) return;
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -90,
        duration: 280,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isExiting]);

  const animStyle = {
    transform: [{ translateY: slideAnim }],
    opacity: fadeAnim,
  };

  // ── Star unlock variant ────────────────────────────────────────────────────
  if (reward.starUnlock) {
    const meta        = STAR_META[reward.starUnlock] ?? { name: reward.message, color: '#C8A84B', icon: '✦' };
    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });

    return (
      <Animated.View
        style={[
          animStyle,
          styles.starCard,
          { borderColor: `${meta.color}55` },
          SHADOW.lg,
        ]}
      >
        {/* Particle burst */}
        <StarParticles color={meta.color} />

        {/* Animated background glow */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.starGlowBg,
            { backgroundColor: meta.color, opacity: glowOpacity },
          ]}
          pointerEvents="none"
        />

        {/* Icon circle */}
        <View style={[styles.starIconCircle, { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}44` }]}>
          <Text style={[styles.starIconEmoji, { color: meta.color }]}>{meta.icon}</Text>
        </View>

        {/* Text content */}
        <View style={styles.starBody}>
          <Text style={[styles.starLabel, { color: `${meta.color}AA` }]}>CONSTELLATION STAR UNLOCKED</Text>
          <Text style={[styles.starName, { color: '#F0EAF8' }]}>{meta.name}</Text>
          <Text style={[styles.starSub, { color: 'rgba(200,184,232,0.55)' }]}>Added to your sky</Text>
        </View>

        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={[styles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.07)' }]}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon name="x" size={13} color="rgba(200,184,232,0.45)" />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  }

  // ── Rising variant ─────────────────────────────────────────────────────────
  if (reward.isRising) {
    return (
      <Animated.View
        style={[
          animStyle,
          styles.risingCard,
          { backgroundColor: colors.night, borderColor: 'rgba(200,168,75,0.25)' },
          SHADOW.md,
        ]}
      >
        <View style={[styles.risingIconWrap, { backgroundColor: 'rgba(200,168,75,0.18)' }]}>
          <Icon name="trending-up" size={18} color={colors.gold} />
        </View>
        <View style={styles.risingBody}>
          <Text style={[styles.risingLabel, { color: 'rgba(200,168,75,0.65)' }]}>RISING</Text>
          <Text style={[styles.risingTitle, { color: 'rgba(240,234,248,0.92)' }]}>{reward.message}</Text>
          {reward.subMessage && (
            <Text style={[styles.risingSubtitle, { color: 'rgba(200,184,232,0.5)' }]}>{reward.subMessage}</Text>
          )}
        </View>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={[styles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.07)' }]}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon name="x" size={13} color="rgba(200,184,232,0.45)" />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  }

  // ── Currency reward variant (stars / aura / shards) ───────────────────────
  const hasCurrency = reward.stars != null || reward.aura != null || reward.shards != null;
  if (hasCurrency) {
    return (
      <Animated.View
        style={[
          animStyle,
          styles.currencyCard,
          { backgroundColor: '#0C0920', borderColor: 'rgba(107,91,149,0.30)' },
          SHADOW.md,
        ]}
      >
        <View style={[styles.currIconWrap, { backgroundColor: 'rgba(200,168,75,0.14)' }]}>
          <Text style={styles.currIconEmoji}>✦</Text>
        </View>
        <View style={styles.body}>
          <Text style={[styles.currLabel, { color: 'rgba(200,184,232,0.65)' }]}>{reward.message}</Text>
          <View style={styles.currChipsRow}>
            {reward.stars != null && reward.stars > 0 && (
              <View style={[styles.currChip, { backgroundColor: 'rgba(200,168,75,0.12)', borderColor: 'rgba(200,168,75,0.28)' }]}>
                <Text style={styles.currChipEmoji}>✦</Text>
                <Text style={[styles.currChipNum, { color: '#C8A84B' }]}>+{reward.stars}</Text>
              </View>
            )}
            {reward.aura != null && reward.aura > 0 && (
              <View style={[styles.currChip, { backgroundColor: 'rgba(107,91,149,0.12)', borderColor: 'rgba(107,91,149,0.28)' }]}>
                <Text style={styles.currChipEmoji}>◈</Text>
                <Text style={[styles.currChipNum, { color: '#9878D8' }]}>+{reward.aura}</Text>
              </View>
            )}
            {reward.shards != null && reward.shards > 0 && (
              <View style={[styles.currChip, { backgroundColor: 'rgba(120,180,220,0.12)', borderColor: 'rgba(120,180,220,0.28)' }]}>
                <Text style={styles.currChipEmoji}>◇</Text>
                <Text style={[styles.currChipNum, { color: '#78B4DC' }]}>+{reward.shards}</Text>
              </View>
            )}
          </View>
        </View>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={[styles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon name="x" size={12} color="rgba(200,184,232,0.35)" />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  }

  // ── Default variant ────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        animStyle,
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        SHADOW.sm,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}12` }]}>
        <Icon name={reward.icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <View style={styles.bodyTop}>
          {reward.count !== undefined && (
            <Text style={[styles.countText, { color: colors.foreground }]}>{reward.count}</Text>
          )}
          <Text style={[styles.message, { color: colors.mutedForeground }]}>{reward.message}</Text>
        </View>
      </View>
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          style={[styles.closeBtn, { backgroundColor: colors.muted }]}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Icon name="x" size={12} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ── Default ───────────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 0,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  body:    { flex: 1 },
  bodyTop: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  countText: { fontSize: 22, fontFamily: 'Satoshi-Bold', letterSpacing: -0.5 },
  message:   { fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 18, flex: 1 },
  closeBtn:  {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // ── Rising ────────────────────────────────────────────────────────────────
  risingCard: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, borderRadius: 16, borderWidth: 1, padding: 14,
  },
  risingIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  risingBody:     { flex: 1, gap: 1 },
  risingLabel:    { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.2, textTransform: 'uppercase' },
  risingTitle:    { fontSize: 14, fontFamily: 'Satoshi-Bold', lineHeight: 20 },
  risingSubtitle: { fontSize: 11, fontFamily: 'Satoshi-Regular' },

  // ── Currency ──────────────────────────────────────────────────────────────
  currencyCard: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, borderRadius: 16, borderWidth: 1, padding: 14,
  },
  currIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  currIconEmoji:  { fontSize: 16 },
  currLabel:      { fontSize: 11, fontFamily: 'Satoshi-Medium', letterSpacing: 0.1, marginBottom: 5 },
  currChipsRow:   { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  currChip:       {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1,
  },
  currChipEmoji:  { fontSize: 11 },
  currChipNum:    { fontSize: 13, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },

  // ── Star Unlock ───────────────────────────────────────────────────────────
  starCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    backgroundColor: '#07061A',
    overflow: 'hidden',
    minHeight: 76,
  },
  starGlowBg: {
    borderRadius: 20,
  },
  starIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, borderWidth: 1,
  },
  starIconEmoji: {
    fontSize: 22, lineHeight: 28,
  },
  starBody: { flex: 1, gap: 2 },
  starLabel: {
    fontSize: 8, fontFamily: 'Satoshi-Bold',
    letterSpacing: 1.4, textTransform: 'uppercase',
  },
  starName: {
    fontSize: 17, fontFamily: 'Satoshi-Bold',
    lineHeight: 22, letterSpacing: -0.3,
  },
  starSub: {
    fontSize: 11, fontFamily: 'Satoshi-Regular',
  },

  // ── Particle dot ──────────────────────────────────────────────────────────
  particle: {
    position: 'absolute',
    // Centred inside the icon circle (left ~16 padding + half of 48px circle = 40px)
    left: 38,
    top: 26,
    textAlign: 'center',
  },
});
