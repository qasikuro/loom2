import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1, duration: 1500,
        useNativeDriver: true, easing: Easing.linear,
      })
    );
    loop.start();
    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return anim;
}

interface SkeletonBoxProps {
  width?:        number | '100%' | `${number}%`;
  height?:       number;
  borderRadius?: number;
  style?:        ViewStyle;
}

export function SkeletonBox({
  width = '100%', height = 16, borderRadius = 8, style,
}: SkeletonBoxProps) {
  const colors  = useColors();
  const shimmer = useShimmer();
  const tx = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-300, 300] });

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <View style={[{ width: width as any, height, borderRadius, overflow: 'hidden', backgroundColor: colors.muted }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: tx }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.13)', 'rgba(255,255,255,0.07)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  const colors = useColors();
  return (
    <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <View style={sk.topRow}>
        <SkeletonBox width={44} height={44} borderRadius={14} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox width="58%" height={13} />
          <SkeletonBox width="38%" height={11} />
        </View>
        <SkeletonBox width={16} height={16} borderRadius={8} />
      </View>
      <View style={{ gap: 8 }}>
        <SkeletonBox height={12} />
        <SkeletonBox height={12} width="82%" />
        <SkeletonBox height={12} width="62%" />
      </View>
      <View style={sk.footerRow}>
        <SkeletonBox width={66} height={22} borderRadius={11} />
        <SkeletonBox width={28} height={22} borderRadius={9} />
      </View>
    </View>
  );
}

export function SkeletonDiscoverCard({ style }: { style?: ViewStyle }) {
  const colors = useColors();
  return (
    <View style={[sk.discoverCard, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <SkeletonBox height={200} borderRadius={0} />
      <View style={sk.discoverFooter}>
        <View style={{ flex: 1, gap: 7 }}>
          <SkeletonBox width="62%" height={14} />
          <SkeletonBox width="42%" height={11} />
        </View>
        <SkeletonBox width={56} height={28} borderRadius={9} />
      </View>
    </View>
  );
}

export function SkeletonProfileCard() {
  const colors = useColors();
  return (
    <View style={[sk.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={sk.profileAvatarRow}>
        <SkeletonBox width={68} height={68} borderRadius={34} />
        <View style={{ flex: 1, gap: 10 }}>
          <SkeletonBox width="55%" height={17} />
          <SkeletonBox width="36%" height={12} />
        </View>
      </View>
      <View style={sk.profileMetaRow}>
        <SkeletonBox width={86} height={28} borderRadius={14} />
        <SkeletonBox width={116} height={28} borderRadius={14} />
      </View>
      <View style={{ gap: 7, marginTop: 2 }}>
        <SkeletonBox height={12} />
        <SkeletonBox height={12} width="76%" />
      </View>
      <View style={sk.profileTraitsRow}>
        <SkeletonBox width={62} height={26} borderRadius={13} />
        <SkeletonBox width={78} height={26} borderRadius={13} />
        <SkeletonBox width={52} height={26} borderRadius={13} />
        <SkeletonBox width={70} height={26} borderRadius={13} />
      </View>
      <View style={[sk.profileStats, { borderTopColor: colors.border }]}>
        <View style={{ alignItems: 'center', gap: 5 }}>
          <SkeletonBox width={36} height={18} borderRadius={6} />
          <SkeletonBox width={50} height={10} borderRadius={5} />
        </View>
        <View style={{ alignItems: 'center', gap: 5 }}>
          <SkeletonBox width={36} height={18} borderRadius={6} />
          <SkeletonBox width={50} height={10} borderRadius={5} />
        </View>
        <View style={{ alignItems: 'center', gap: 5 }}>
          <SkeletonBox width={36} height={18} borderRadius={6} />
          <SkeletonBox width={50} height={10} borderRadius={5} />
        </View>
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1, padding: 15,
    gap: 12, marginBottom: 10,
  },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discoverCard: {
    borderRadius: 20, overflow: 'hidden', marginBottom: 14, borderWidth: 0.75,
  },
  discoverFooter: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, gap: 12,
  },
  profileCard: {
    borderRadius: 22, borderWidth: 1, padding: 18,
    gap: 14, marginBottom: 14,
  },
  profileAvatarRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileMetaRow:    { flexDirection: 'row', gap: 8 },
  profileTraitsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileStats: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingTop: 14, borderTopWidth: 1,
  },
});
