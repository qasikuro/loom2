import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CONSTELLATION_STARS,
  STAR_THRESHOLDS,
  countForStar,
  type ConstellationState,
} from './ConstellationMap';

// Currency reward for each star
const STAR_REWARDS: Record<string, string> = {
  social:   '✦ 20 Stars',
  memory:   '◇ 15 Memory Shards',
  quiet:    '◐ 10 Aura Energy',
  creative: '◈ 15 Aura Energy',
  helping:  '✦ 25 Stars',
  seasonal: '✦ 30 Stars',
};

const REWARD_COLORS: Record<string, string> = {
  social:   '#C8A84B',
  memory:   '#78B4DC',
  quiet:    '#9878C8',
  creative: '#9878C8',
  helping:  '#C8A84B',
  seasonal: '#C8A84B',
};

interface Props {
  starKey:       string | null;
  constellation: ConstellationState;
  onClose:       () => void;
}

export function ConstellationStarSheet({ starKey, constellation, onClose }: Props) {
  const visible  = !!starKey;
  const star     = starKey ? CONSTELLATION_STARS.find(s => s.key === starKey) ?? null : null;
  const isUnlocked = starKey ? constellation.unlockedStars.includes(starKey) : false;

  // Animations
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const barAnim   = useRef(new Animated.Value(0)).current;

  // Open / close animations
  useEffect(() => {
    if (visible && star) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      slideAnim.setValue(400);
      fadeAnim.setValue(0);
      barAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
      ]).start();
      // Animate progress bar after sheet lands
      const rawCount  = countForStar(star.key, constellation);
      const threshold = STAR_THRESHOLDS[star.key] ?? 1;
      const pct       = Math.min(1, rawCount / threshold) * 100;
      Animated.timing(barAnim, {
        toValue: pct,
        duration: 560,
        delay: 220,
        useNativeDriver: false,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starKey]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  if (!star) return null;

  const rawCount    = countForStar(star.key, constellation);
  const threshold   = STAR_THRESHOLDS[star.key] ?? 1;
  const rewardColor = REWARD_COLORS[star.key] ?? '#C8A84B';
  const unlockDate  = constellation.starUnlockDates?.[star.key];
  const formattedDate = unlockDate
    ? new Date(unlockDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: `${star.color}18`, borderColor: `${star.color}35` }]}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Icon name={star.icon as any} size={18} color={star.color} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.starName, { color: star.color }]}>{star.label} Star</Text>
              <Text style={styles.description} numberOfLines={2}>{star.description}</Text>
            </View>
            <View style={[
              styles.statusBadge,
              isUnlocked
                ? { backgroundColor: `${star.color}18`, borderColor: `${star.color}40` }
                : { backgroundColor: 'rgba(107,91,149,0.08)', borderColor: 'rgba(107,91,149,0.18)' },
            ]}>
              <Text style={[styles.statusText, { color: isUnlocked ? star.color : 'rgba(200,184,232,0.50)' }]}>
                {isUnlocked ? '✦ Earned' : 'Locked'}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: `${star.color}20` }]} />

          {/* How to unlock / unlock date */}
          {isUnlocked ? (
            <View style={styles.unlockedRow}>
              <View style={[styles.unlockedIconWrap, { backgroundColor: `${star.color}14` }]}>
                <Text style={{ fontSize: 14 }}>✦</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.unlockedLabel, { color: star.color }]}>Constellation achieved</Text>
                {formattedDate ? (
                  <Text style={styles.unlockedDate}>Unlocked on {formattedDate}</Text>
                ) : (
                  <Text style={styles.unlockedDate}>Your light has been recorded</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.requirementRow}>
              <Icon name="lock" size={11} color="rgba(200,184,232,0.35)" />
              <Text style={styles.criterion}>{star.criterion}</Text>
            </View>
          )}

          {/* Reward chip */}
          <View style={styles.rewardRow}>
            <Text style={styles.rewardLabel}>{isUnlocked ? 'EARNED' : 'UNLOCKS'}</Text>
            <View style={[styles.rewardChip, { backgroundColor: `${rewardColor}14`, borderColor: `${rewardColor}30` }]}>
              <Text style={[styles.rewardValue, { color: rewardColor }]}>
                {STAR_REWARDS[star.key]}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Progress</Text>
              <Text style={[styles.progressCount, { color: isUnlocked ? star.color : 'rgba(200,184,232,0.65)' }]}>
                {rawCount} / {threshold} {star.unit}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <Animated.View style={[
                styles.barFill,
                {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  width: barAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) as any,
                  backgroundColor: star.color,
                },
                isUnlocked && { opacity: 0.70 },
              ]} />
            </View>
            {!isUnlocked && rawCount < threshold && (
              <Text style={styles.progressHint}>
                {threshold - rawCount} more {star.unit} to go
              </Text>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(4,2,14,0.70)',
  },
  sheet: {
    backgroundColor: '#0C0920',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(107,91,149,0.28)',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 38,
    gap: 14,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(200,184,232,0.18)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, flexShrink: 0,
  },
  starName: {
    fontSize: 17,
    fontFamily: 'Satoshi-Bold',
    lineHeight: 22,
  },
  description: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.45)',
    lineHeight: 17,
  },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Satoshi-Bold',
  },
  divider: {
    height: 1,
  },
  // Unlocked state
  unlockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  unlockedIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  unlockedLabel: {
    fontSize: 13,
    fontFamily: 'Satoshi-Bold',
  },
  unlockedDate: {
    fontSize: 11,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.40)',
  },
  // Locked state
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  criterion: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.50)',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  // Reward
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rewardLabel: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.8,
    color: 'rgba(200,184,232,0.30)',
  },
  rewardChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1,
  },
  rewardValue: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
  },
  // Progress
  progressSection: {
    gap: 7,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 11,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.5,
    color: 'rgba(200,184,232,0.35)',
    textTransform: 'uppercase',
  },
  progressCount: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressHint: {
    fontSize: 10,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.30)',
  },
});
