import { SecureImage as Image } from '@/components/SecureImage';
import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

type Props = {
  scrollY: Animated.Value;
  collapseAt: number;
  compactVisible: boolean;
  topInset: number;
  name: string;
  subtitle?: string | null;
  avatarUri?: string | null;
  backgroundColor: string;
  foregroundColor: string;
  mutedColor: string;
  borderColor: string;
  leftAction?: React.ReactNode;
  rightActions?: React.ReactNode;
  /** When the shared flying avatar lands here, only reserve its slot. */
  avatarSlotOnly?: boolean;
  /** Gold level pill (e.g. "Lv 4"). */
  levelLabel?: string | null;
  goldColor?: string;
};

export function useProfileCollapse(collapseAt: number) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [compactVisible, setCompactVisible] = useState(false);
  const compactVisibleRef = useRef(false);
  // Latest offset for one-off layout measurements; never triggers renders.
  const offsetRef = useRef(0);

  const onScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      {
        useNativeDriver: true,
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          offsetRef.current = event.nativeEvent.contentOffset.y;
          const nextVisible = event.nativeEvent.contentOffset.y >= collapseAt + 20;
          if (nextVisible !== compactVisibleRef.current) {
            compactVisibleRef.current = nextVisible;
            setCompactVisible(nextVisible);
          }
        },
      },
    ),
    [collapseAt, scrollY],
  );

  return { scrollY, compactVisible, onScroll, offsetRef };
}

export function ProfileCollapseBar({
  scrollY,
  collapseAt,
  compactVisible,
  topInset,
  name,
  subtitle,
  avatarUri,
  backgroundColor,
  foregroundColor,
  mutedColor,
  borderColor,
  leftAction,
  rightActions,
  avatarSlotOnly,
  levelLabel,
  goldColor = '#C8A84B',
}: Props) {
  const fadeIn = scrollY.interpolate({
    inputRange: [collapseAt, collapseAt + 38],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const slideIn = scrollY.interpolate({
    inputRange: [collapseAt, collapseAt + 38],
    outputRange: [-8, 0],
    extrapolate: 'clamp',
  });
  const backgroundFade = scrollY.interpolate({
    inputRange: [collapseAt + 4, collapseAt + 46],
    outputRange: [0, 0.98],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      testID="profile-collapse-bar"
      pointerEvents={compactVisible ? 'box-none' : 'none'}
      style={[
        s.root,
        {
          height: topInset + 56,
          transform: [{ translateY: slideIn }],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor, opacity: backgroundFade }]}
      />
      <View
        pointerEvents="box-none"
        style={[s.content, { paddingTop: topInset, height: topInset + 56 }]}
      >
        {leftAction ? <Animated.View style={{ opacity: fadeIn }}>
          {leftAction}
        </Animated.View> : null}
        <Animated.View
          pointerEvents="none"
          style={[s.identity, { opacity: fadeIn }]}
        >
          {avatarSlotOnly ? <View style={s.avatarSlot} /> : (
          <View style={[s.avatar, { borderColor }]}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <Text style={[s.initial, { color: foregroundColor }]}>
                {name.trim().charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          )}
          <View style={s.copy}>
            <Text numberOfLines={1} style={[s.name, { color: foregroundColor }]}>
              {name}
            </Text>
            <View style={s.metaRow}>
              {!!levelLabel && (
                <View style={[s.levelPill, { borderColor: `${goldColor}66`, backgroundColor: `${goldColor}14` }]}>
                  <Text style={[s.levelText, { color: goldColor }]} numberOfLines={1}>{levelLabel}</Text>
                </View>
              )}
              {!!subtitle && (
                <Text numberOfLines={1} style={[s.subtitle, { color: mutedColor }]}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
        <Animated.View style={[s.actions, { opacity: fadeIn }]}>{rightActions}</Animated.View>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[s.divider, { backgroundColor: borderColor, opacity: backgroundFade }]}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    zIndex: 50,
    top: 0,
    left: 0,
    right: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  avatarSlot: { width: 38, height: 38 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  levelPill: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 7, minHeight: 18, justifyContent: 'center' },
  levelText: { fontSize: 10.5, lineHeight: 13, fontFamily: 'Satoshi-Bold', letterSpacing: 0.2 },
  initial: { fontSize: 16, fontFamily: 'Satoshi-Bold' },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontSize: 15, lineHeight: 19, fontFamily: 'Satoshi-Bold' },
  subtitle: { flexShrink: 1, fontSize: 11, lineHeight: 14, fontFamily: 'Satoshi-Medium' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { position: 'absolute', bottom: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
});
