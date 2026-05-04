import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useColors } from '@/hooks/useColors';
import type { Reward } from '@/context/AppContext';

interface RewardBannerProps {
  reward: Reward;
  onDismiss?: () => void;
}

export function RewardBanner({ reward, onDismiss }: RewardBannerProps) {
  const colors = useColors();

  if (reward.isRising) {
    return (
      <View style={[styles.risingCard, { backgroundColor: colors.night }]}>
        <View style={[styles.starIcon, { backgroundColor: `${colors.gold}25` }]}>
          <Feather name="star" size={20} color={colors.gold} />
        </View>
        <View style={styles.risingText}>
          <Text style={[styles.risingTitle, { color: colors.gold }]}>{reward.message}</Text>
          {reward.subMessage ? (
            <Text style={[styles.risingSubtitle, { color: `${colors.gold}99` }]}>{reward.subMessage}</Text>
          ) : null}
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Feather name="x" size={14} color={`${colors.gold}80`} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
        <Feather name={reward.icon as keyof typeof Feather.glyphMap} size={16} color={colors.primary} />
      </View>
      <View style={styles.textContent}>
        {reward.count !== undefined ? (
          <Text style={[styles.countText, { color: colors.foreground }]}>{reward.count}</Text>
        ) : null}
        <Text style={[styles.message, { color: colors.mutedForeground }]}>{reward.message}</Text>
      </View>
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.close}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Feather name="x" size={12} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginRight: 10,
    gap: 8,
    position: 'relative',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    gap: 2,
  },
  countText: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  message: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  risingCard: {
    width: 160,
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  starIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  risingText: {
    flex: 1,
    gap: 2,
  },
  risingTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  risingSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },
});
