/* eslint-disable @typescript-eslint/no-require-imports -- Metro needs static require paths for bundled PNG artwork. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDecorativeMotion } from '@/components/profile/CharacterAuraHeader';

const TOP = require('@/assets/images/founder-regalia/top.png');
const BOTTOM = require('@/assets/images/founder-regalia/bottom.png');
const SIDES = {
  left: {
    joinTop: require('@/assets/images/founder-regalia/left-join-top.png'),
    gemUpper: require('@/assets/images/founder-regalia/left-gem-upper.png'),
    stemUpper: require('@/assets/images/founder-regalia/left-stem-upper.png'),
    gemCenter: require('@/assets/images/founder-regalia/left-gem-center.png'),
    stemLower: require('@/assets/images/founder-regalia/left-stem-lower.png'),
    gemLower: require('@/assets/images/founder-regalia/left-gem-lower.png'),
    joinBottom: require('@/assets/images/founder-regalia/left-join-bottom.png'),
  },
  right: {
    joinTop: require('@/assets/images/founder-regalia/right-join-top.png'),
    gemUpper: require('@/assets/images/founder-regalia/right-gem-upper.png'),
    stemUpper: require('@/assets/images/founder-regalia/right-stem-upper.png'),
    gemCenter: require('@/assets/images/founder-regalia/right-gem-center.png'),
    stemLower: require('@/assets/images/founder-regalia/right-stem-lower.png'),
    gemLower: require('@/assets/images/founder-regalia/right-gem-lower.png'),
    joinBottom: require('@/assets/images/founder-regalia/right-join-bottom.png'),
  },
};
// Source heights of side sub-slices (140px wide). Only stems stretch.
const H = { joinTop: 50, gemUpper: 65, stemUpper: 100, gemCenter: 95, stemLower: 85, gemLower: 60, joinBottom: 85 };
const EDGE_H = H.joinTop + H.gemUpper + H.gemLower + H.joinBottom;
const STEM_H = H.stemUpper + H.stemLower;
const PREVIEW = require('@/assets/images/founder-regalia/preview.png');

// Source geometry (960 x 1024 original). Rail centres x43 / x917, top rail y90, bottom rail y904.
const SRC_W = 960;
const SRC_H = 1024;
const TOP_RAIL_Y = 90;
const BOTTOM_RAIL_Y = 904;
const TOP_H = 250;
const BOTTOM_H = 234;
const SIDE_W = 140;
const OUTSET = 16;
const SEAM_OVERLAP = 0.75;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Founder Regalia: detailed gold filigree + violet crystal border,
 * image-sliced so it stretches vertically around a profile card of any height.
 * Center remains fully transparent and never intercepts touches.
 */
export default function FounderAuroraCardFrame({ compact = false }: { compact?: boolean }) {
  const { animate } = useDecorativeMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const glow = useRef(new Animated.Value(0)).current;
  const glint = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate || compact) {
      glow.stopAnimation();
      glint.stopAnimation();
      glow.setValue(0.4);
      glint.setValue(0);
      return;
    }
    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false }),
      Animated.timing(glow, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false }),
    ]));
    const glintLoop = Animated.loop(Animated.sequence([
      Animated.timing(glint, { toValue: 1, duration: 3400, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false }),
      Animated.delay(4200),
      Animated.timing(glint, { toValue: 0, duration: 0, useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false }),
    ]));
    glowLoop.start();
    glintLoop.start();
    return () => { glowLoop.stop(); glintLoop.stop(); };
  }, [animate, compact, glow, glint]);

  if (compact) {
    return (
      <View pointerEvents="none" accessible={false} style={styles.compact}>
        <Image source={PREVIEW} style={styles.compactImg} resizeMode="contain" />
      </View>
    );
  }

  const { w, h } = size;
  const ready = w > 0 && h > 0;
  const overlayW = w + OUTSET * 2;
  const s = overlayW / SRC_W;
  const sideTop = (TOP_H - TOP_RAIL_Y) * s - SEAM_OVERLAP;
  const sideBottom = (BOTTOM_H - (SRC_H - BOTTOM_RAIL_Y)) * s - SEAM_OVERLAP;
  const sideH = Math.max(0, h - sideTop - sideBottom);
  // Repeat complete ornament units instead of elongating a single pair of rails
  // across a tall profile. Gems keep their native proportions at every height.
  const middleH = Math.max(0, sideH - EDGE_H * s);
  const repeatCount = Math.max(1, Math.min(8, Math.round(middleH / Math.max(1, (STEM_H + H.gemCenter) * s))));
  const unitH = middleH / repeatCount;
  const stemUpperH = Math.max(0, unitH - H.gemCenter * s) * (H.stemUpper / STEM_H);
  const centerGemYs = Array.from({ length: repeatCount }, (_, index) =>
    sideTop + (H.joinTop + H.gemUpper) * s + index * unitH + stemUpperH + (H.gemCenter / 2) * s);
  const sideW = SIDE_W * s;

  const jewelOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.7] });
  const glintOpacity = glint.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] });
  const travelX = glint.interpolate({ inputRange: [0, 1], outputRange: [-40, Math.max(0, w)] });
  const travelY = glint.interpolate({ inputRange: [0, 1], outputRange: [Math.max(0, h), -40] });
  const railX = 43 * s - OUTSET;

  const jewel = (style: object, key: string, d = 22) => (
    <Animated.View key={key} style={[styles.jewel, { width: d, height: d, borderRadius: d / 2, marginLeft: -d / 2, marginTop: -d / 2, opacity: jewelOpacity }, style]} />
  );

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setSize(c => (c.w === width && c.h === height ? c : { w: width, h: height }));
      }}
    >
      {ready && (
        <>
          {(['left', 'right'] as const).map(side => {
            const src = SIDES[side];
            const fixed = (k: keyof typeof H) => (
              <Image key={k} source={src[k]} resizeMode="stretch" style={{ width: sideW, height: H[k] * s }} />
            );
            const stem = (k: 'stemUpper' | 'stemLower') => (
              <Image key={k} source={src[k]} resizeMode="stretch" style={{ width: sideW, flexGrow: H[k], flexBasis: 0, flexShrink: 1 }} />
            );
            return (
              <View key={side} style={[styles.sideCol, { top: sideTop, bottom: sideBottom, width: sideW }, side === 'left' ? { left: -OUTSET } : { right: -OUTSET }]}>
                {fixed('joinTop')}
                {fixed('gemUpper')}
                {Array.from({ length: repeatCount }, (_, index) => (
                  <View key={`ornament-${index}`} style={{ flexGrow: 1, flexBasis: 0, minHeight: H.gemCenter * s }}>
                    {stem('stemUpper')}
                    {fixed('gemCenter')}
                    {stem('stemLower')}
                  </View>
                ))}
                {fixed('gemLower')}
                {fixed('joinBottom')}
              </View>
            );
          })}
          <Image source={TOP} resizeMode="stretch" style={{ position: 'absolute', left: -OUTSET, top: -TOP_RAIL_Y * s, width: overlayW, height: TOP_H * s }} />
          <Image source={BOTTOM} resizeMode="stretch" style={{ position: 'absolute', left: -OUTSET, bottom: -(SRC_H - BOTTOM_RAIL_Y) * s, width: overlayW, height: BOTTOM_H * s }} />

          {/* Jewel glows: crest, pendant, side crystals */}
          {jewel({ left: w / 2, top: (60 - TOP_RAIL_Y) * s }, 'crest', 30 * s * 2)}
          {jewel({ left: w / 2, top: h + (938 - BOTTOM_RAIL_Y) * s }, 'pendant', 26 * s * 2)}
          {centerGemYs.map((top, index) => jewel({ left: railX, top }, `l-${index}`, 18 * s * 2))}
          {centerGemYs.map((top, index) => jewel({ left: w - railX, top }, `r-${index}`, 18 * s * 2))}

          {/* Traveling glints along top and right rails */}
          <Animated.View style={[styles.glintH, { top: -1, opacity: glintOpacity, transform: [{ translateX: travelX }] }]}>
            <LinearGradient colors={['transparent', 'rgba(255,241,197,0.95)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={[styles.glintV, { right: railX - 1, opacity: glintOpacity, transform: [{ translateY: travelY }] }]}>
            <LinearGradient colors={['transparent', 'rgba(214,190,255,0.9)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  compact: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  compactImg: { width: '100%', height: '100%' },
  jewel: {
    position: 'absolute',
    backgroundColor: 'rgba(196,160,255,0.28)',
    shadowColor: '#C9A8FF',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  sideCol: { position: 'absolute', flexDirection: 'column', overflow: 'hidden' },
  glintH: { position: 'absolute', left: 0, width: 40, height: 3 },
  glintV: { position: 'absolute', top: 0, width: 3, height: 40 },
});
