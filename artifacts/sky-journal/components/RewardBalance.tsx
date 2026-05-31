import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RewardBalanceProps {
  stars:        number;
  auraEnergy:   number;
  memoryShards: number;
  size?:        'sm' | 'md';
  onPress?:     () => void;
}

export function RewardBalance({ stars, auraEnergy, memoryShards, size = 'md', onPress }: RewardBalanceProps) {
  const sm = size === 'sm';

  const inner = (
    <View style={styles.row}>
      <View style={[styles.chip, { backgroundColor: 'rgba(200,168,75,0.14)', borderColor: 'rgba(200,168,75,0.30)' }]}>
        <Text style={[styles.chipIcon, sm && styles.chipIconSm]}>✦</Text>
        <Text style={[styles.chipNum, sm && styles.chipNumSm, { color: '#C8A84B' }]}>{stars}</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: 'rgba(107,91,149,0.14)', borderColor: 'rgba(107,91,149,0.30)' }]}>
        <Text style={[styles.chipIcon, sm && styles.chipIconSm]}>◈</Text>
        <Text style={[styles.chipNum, sm && styles.chipNumSm, { color: '#9878D8' }]}>{auraEnergy}</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: 'rgba(120,180,220,0.14)', borderColor: 'rgba(120,180,220,0.30)' }]}>
        <Text style={[styles.chipIcon, sm && styles.chipIconSm]}>◇</Text>
        <Text style={[styles.chipNum, sm && styles.chipNumSm, { color: '#78B4DC' }]}>{memoryShards}</Text>
      </View>
      {onPress && (
        <View style={styles.shopHint}>
          <Text style={styles.shopHintText}>Shop ›</Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.72}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipIcon:    { fontSize: 13 },
  chipIconSm:  { fontSize: 11 },
  chipNum:     { fontSize: 13, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  chipNumSm:   { fontSize: 11 },
  shopHint: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(107,91,149,0.12)',
  },
  shopHintText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(152,120,216,0.80)',
    letterSpacing: 0.3,
  },
});
