import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { ConstellationState } from '@/components/ConstellationMap';

interface ProgressRowDef {
  label: string;
  count: number;
  threshold: number;
  color: string;
  icon: string;
  unit: string;
}

export function ConstellationProgressCard({ constellation, triggerAnim = 0 }: {
  constellation: ConstellationState;
  triggerAnim?: number;
}) {
  const rows: ProgressRowDef[] = [
    { label: 'Social',   count: constellation.socialCount,   threshold: 5,  color: '#78C8A8', icon: '⬡', unit: 'follows'  },
    { label: 'Memory',   count: constellation.memoryCount,   threshold: 10, color: '#9878C8', icon: '◇', unit: 'entries'  },
    { label: 'Quiet',    count: constellation.quietStreak,   threshold: 7,  color: '#7890C8', icon: '◐', unit: 'days'     },
    { label: 'Creative', count: constellation.creativeCount, threshold: 5,  color: '#C87AA8', icon: '◈', unit: 'stories'  },
    { label: 'Helping',  count: constellation.helpingCount,  threshold: 20, color: '#C8A84B', icon: '✦', unit: 'stickers' },
    { label: 'Seasonal', count: constellation.seasonalCount, threshold: 6,  color: '#68B8B0', icon: '✿', unit: 'outfits' },
  ];

  const totalPct = Math.round(
    rows.reduce((sum, r) => sum + Math.min(1, r.count / r.threshold), 0) / rows.length * 100,
  );

  const overallAnim = useRef(new Animated.Value(0)).current;
  const rowAnims    = useRef(rows.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    overallAnim.setValue(0);
    rowAnims.forEach(a => a.setValue(0));
    Animated.parallel([
      Animated.timing(overallAnim, {
        toValue: totalPct, duration: 460,
        easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }),
      ...rows.map((r, i) => Animated.timing(rowAnims[i], {
        toValue: Math.round(Math.min(1, r.count / r.threshold) * 100),
        duration: 420, delay: 60 + i * 45,
        easing: Easing.out(Easing.cubic), useNativeDriver: false,
      })),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerAnim]);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.headerLabel}>STAR PROGRESS</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={s.totalPct}>{totalPct}%</Text>
          <Text style={s.overallLabel}>overall</Text>
        </View>
      </View>
      <View style={s.overallBarBg}>
        <Animated.View style={[s.overallBarFill, {
          width: overallAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) as any,
        }]} />
      </View>
      <View style={s.rows}>
        {rows.map((r, i) => {
          const done = constellation.unlockedStars.includes(r.label.toLowerCase());
          const pctN = Math.round(Math.min(1, r.count / r.threshold) * 100);
          return (
            <View key={r.label}>
              <View style={s.rowHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 10, color: done ? r.color : 'rgba(200,184,232,0.30)' }}>{r.icon}</Text>
                  <Text style={[s.rowLabel, { color: done ? r.color : 'rgba(200,184,232,0.55)' }]}>{r.label}</Text>
                  {done && (
                    <View style={[s.doneBadge, { backgroundColor: `${r.color}22` }]}>
                      <Text style={[s.doneBadgeText, { color: r.color }]}>✓ done</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[s.rowCount, { color: done ? r.color : 'rgba(200,184,232,0.50)' }]}>
                    {r.count} / {r.threshold} {r.unit}
                  </Text>
                  <Text style={[s.rowPct, { color: done ? `${r.color}BB` : 'rgba(200,184,232,0.35)' }]}>
                    {pctN}%
                  </Text>
                </View>
              </View>
              <View style={s.barBg}>
                <Animated.View style={[s.barFill, {
                  backgroundColor: r.color, opacity: done ? 0.55 : 0.80,
                  width: rowAnims[i].interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) as any,
                }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:         { marginHorizontal: 16, marginTop: 8, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(107,91,149,0.18)', backgroundColor: 'rgba(8,6,20,0.55)' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerLabel:  { fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.55)', letterSpacing: 0.8 },
  totalPct:     { fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.80)' },
  overallLabel: { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.40)' },
  overallBarBg: { marginHorizontal: 14, marginTop: 8, marginBottom: 4, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  overallBarFill: { height: '100%', borderRadius: 2, backgroundColor: '#9B78E8', opacity: 0.7 },
  rows:         { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 10 },
  rowHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  rowLabel:     { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  doneBadge:    { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  doneBadgeText:{ fontSize: 9, fontFamily: 'Satoshi-Bold' },
  rowCount:     { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  rowPct:       { fontSize: 10, fontFamily: 'Satoshi-Bold', minWidth: 32, textAlign: 'right' },
  barBg:        { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 3 },
});
