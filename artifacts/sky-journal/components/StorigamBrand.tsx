import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { STORIGAM_BRAND } from '@/constants/brand';
import { useColors } from '@/hooks/useColors';

/* eslint-disable @typescript-eslint/no-require-imports */
const MARK = require('../assets/images/storigam-mark.png');
const MARK_MONO = require('../assets/images/storigam-mark-mono.png');
const WORDMARK_LIGHT = require('../assets/images/storigam-wordmark-light.png');
const WORDMARK_DARK = require('../assets/images/storigam-wordmark-dark.png');
const FLUID_UPPER = require('../assets/images/storigam-fluid-upper.png');
const FLUID_LOWER = require('../assets/images/storigam-fluid-lower.png');
/* eslint-enable @typescript-eslint/no-require-imports */

const WORDMARK_RATIO = 1308 / 365;

export function useBrandReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => { if (mounted) setReduced(v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; sub.remove(); };
  }, []);
  return reduced;
}

function useLoop(enabled: boolean, duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) { v.setValue(0.5); return; }
    v.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => { loop.stop(); v.stopAnimation(); };
  }, [enabled, duration, delay, v]);
  return v;
}

interface LogoProps {
  size?: number;
  variant?: 'mark' | 'lockup';
  dark?: boolean;
  color?: string;
  animated?: boolean;
  accessible?: boolean;
  onLoad?: () => void;
}

export function StorigamLogo({
  size = 160, variant = 'mark', dark = false, color, animated = true, accessible = true, onLoad,
}: LogoProps) {
  const reduced = useBrandReducedMotion();
  const run = animated && !reduced;
  const t = useLoop(run, 2800);
  const markW = variant === 'lockup' ? size * 0.5 : size;
  const wordH = size / WORDMARK_RATIO;
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [3, -3] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1.025] });
  const loaded = useRef(0);
  const need = variant === 'lockup' ? 2 : 1;
  const handleLoad = () => {
    loaded.current += 1;
    if (loaded.current === need) onLoad?.();
  };

  return (
    <Animated.View
      accessible={accessible}
      accessibilityRole="image"
      accessibilityLabel={accessible ? 'Storigam' : undefined}
      importantForAccessibility={accessible ? 'auto' : 'no-hide-descendants'}
      style={{ zIndex: 1, width: size, alignItems: 'center', transform: [{ translateY }, { scale }] }}
    >
      {color ? (
        <Image source={MARK_MONO} style={{ width: markW, height: markW, tintColor: color }} resizeMode="contain" onLoad={handleLoad} fadeDuration={0} />
      ) : (
        <Image source={MARK} style={{ width: markW, height: markW }} resizeMode="contain" onLoad={handleLoad} fadeDuration={0} />
      )}
      {variant === 'lockup' && (
        <Image
          source={dark ? WORDMARK_DARK : WORDMARK_LIGHT}
          style={{ width: size, height: wordH, marginTop: size * 0.03 }}
          resizeMode="contain"
          onLoad={handleLoad}
          fadeDuration={0}
        />
      )}
    </Animated.View>
  );
}

export function StorigamFluidBackdrop({ dark = false }: { dark?: boolean }) {
  const colors = useColors();
  const { width: w, height: h } = useWindowDimensions();
  const overscan = Math.max(24, w * 0.06, h * 0.025);
  const reduced = useBrandReducedMotion();
  const run = !reduced;
  const a = useLoop(run, 6500);
  const b = useLoop(run, 7500, 600);
  const ul = {
    transform: [
      { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.03, w * 0.04] }) },
      { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [h * 0.01, -h * 0.015] }) },
      { scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
    ],
  };
  const lr = {
    transform: [
      { translateX: b.interpolate({ inputRange: [0, 1], outputRange: [w * 0.04, -w * 0.03] }) },
      { translateY: b.interpolate({ inputRange: [0, 1], outputRange: [-h * 0.01, h * 0.015] }) },
      { scale: b.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1]}) },
    ],
  };
  const bg = dark ? STORIGAM_BRAND.background : colors.background;
  const o = dark ? 1 : 0.55;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 0, backgroundColor: bg, overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, ul, { opacity: o }]}>
        {dark ? (
          <Image
            source={FLUID_UPPER}
            resizeMode="stretch"
            fadeDuration={0}
            style={{ position: 'absolute', top: -overscan, left: -overscan, width: w + overscan * 2, height: (h + overscan * 2) * (550 / 1774) }}
          />
        ) : (
        <Svg width={w} height={h} viewBox="0 0 100 200" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="ul" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0" stopColor={STORIGAM_BRAND.blue} />
              <Stop offset="0.6" stopColor={STORIGAM_BRAND.violet} />
              <Stop offset="1" stopColor={STORIGAM_BRAND.violetLight} />
            </LinearGradient>
            <RadialGradient id="ulg" cx="0" cy="0" rx="70" ry="70" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={STORIGAM_BRAND.blueGlow} stopOpacity="0.55" />
              <Stop offset="1" stopColor={STORIGAM_BRAND.blueGlow} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path d="M-10 -10 L60 -10 C 60 14 40 22 22 32 C 12 38 4 42 -10 48 Z" fill="url(#ul)" />
          <Path d="M-10 48 C 4 42 12 38 22 32 C 40 22 60 14 60 -10" stroke={STORIGAM_BRAND.violetEdge} strokeOpacity="0.7" strokeWidth="0.5" fill="none" />
          <Path d="M-10 -10 H110 V210 H-10 Z" fill="url(#ulg)" />
        </Svg>
        )}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, lr, { opacity: o }]}>
        {dark ? (
          <Image
            source={FLUID_LOWER}
            resizeMode="stretch"
            fadeDuration={0}
            style={{ position: 'absolute', bottom: -overscan, left: -overscan, width: w + overscan * 2, height: (h + overscan * 2) * (694 / 1774) }}
          />
        ) : (
        <Svg width={w} height={h} viewBox="0 0 100 200" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="lr" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0" stopColor={STORIGAM_BRAND.lowerBlue} />
              <Stop offset="0.45" stopColor={STORIGAM_BRAND.lowerViolet} />
              <Stop offset="0.8" stopColor={STORIGAM_BRAND.pink} />
              <Stop offset="1" stopColor={STORIGAM_BRAND.orange} />
            </LinearGradient>
            <RadialGradient id="lrg" cx="100" cy="200" rx="80" ry="60" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={STORIGAM_BRAND.pinkGlow} stopOpacity="0.5" />
              <Stop offset="1" stopColor={STORIGAM_BRAND.pinkGlow} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path d="M-10 210 L-10 196 C 14 176 34 168 56 160 C 76 152 88 142 96 128 C 99 123 104 120 110 118 L110 210 Z" fill="url(#lr)" />
          <Path d="M-10 196 C 14 176 34 168 56 160 C 76 152 88 142 96 128 C 99 123 104 120 110 118" stroke={STORIGAM_BRAND.pinkEdge} strokeOpacity="0.55" strokeWidth="0.4" fill="none" />
          <Path d="M-10 -10 H110 V210 H-10 Z" fill="url(#lrg)" />
        </Svg>
        )}
      </Animated.View>
    </View>
  );
}
