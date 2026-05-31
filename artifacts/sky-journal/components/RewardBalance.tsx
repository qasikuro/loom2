import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface RewardBalanceProps {
  stars:        number;
  auraEnergy:   number;
  memoryShards: number;
  size?:        'sm' | 'md';
}

export function RewardBalance({ stars, auraEnergy, memoryShards, size = 'md' }: RewardBalanceProps) {
  const sm = size === 'sm';

  return (
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
    </View>
  );
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
});
