import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import type { Reward } from '@/context/AppContext';

interface RewardBannerProps {
  reward: Reward;
  onDismiss?: () => void;
}

export function RewardBanner({ reward, onDismiss }: RewardBannerProps) {
  const colors    = useColors();
  const slideAnim = useRef(new Animated.Value(-72)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in from above with a spring, fade in simultaneously
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
    ]).start();
  }, []);

  const animStyle = {
    transform: [{ translateY: slideAnim }],
    opacity: fadeAnim,
  };

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
});
