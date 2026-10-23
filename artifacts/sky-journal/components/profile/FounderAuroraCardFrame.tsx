import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDecorativeMotion } from '@/components/profile/CharacterAuraHeader';

const FRAME_GOLD = '#F0D28B';
const FRAME_GOLD_HIGHLIGHT = '#FFF1C5';
const FRAME_VIOLET = '#B69AFF';

/**
 * Founder-only profile-card ornament inspired by the celestial reference:
 * a double gold/violet rail, small crystal details, and a slow traveling glint.
 * It is purely decorative and never intercepts profile interactions.
 */
export default function FounderAuroraCardFrame() {
  const { animate } = useDecorativeMotion();
  const [width, setWidth] = useState(0);
  const shimmer = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      shimmer.stopAnimation();
      breathe.stopAnimation();
      shimmer.setValue(0.5);
      breathe.setValue(0.5);
      return;
    }

    const shimmerLoop = Animated.loop(Animated.timing(shimmer, {
      toValue: 1,
      duration: 7600,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    const breatheLoop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, {
        toValue: 1,
        duration: 3600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(breathe, {
        toValue: 0,
        duration: 3600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]));

    shimmerLoop.start();
    breatheLoop.start();
    return () => {
      shimmerLoop.stop();
      breatheLoop.stop();
    };
  }, [animate, breathe, shimmer]);

  const sweepOpacity = shimmer.interpolate({
    inputRange: [0, 0.12, 0.50, 0.88, 1],
    outputRange: [0, 0.76, 0.38, 0.76, 0],
  });
  const sweepX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-82, Math.max(-82, width - 18)],
  });
  const reverseSweepX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(0, width - 82), 0],
  });
  const railOpacity = breathe.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.76, 1, 0.76],
  });

  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const nextWidth = event.nativeEvent.layout.width;
        setWidth(current => current === nextWidth ? current : nextWidth);
      }}
    >
      <Animated.View style={[styles.outerRail, { opacity: railOpacity }]} />
      <View style={styles.innerRail} />

      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(182,154,255,0.92)', FRAME_GOLD_HIGHLIGHT, 'rgba(182,154,255,0.92)', 'transparent']}
        locations={[0, 0.24, 0.5, 0.76, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.topRail}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(182,154,255,0.78)', FRAME_GOLD, 'rgba(182,154,255,0.78)', 'transparent']}
        locations={[0, 0.24, 0.5, 0.76, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.bottomRail}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(240,210,139,0.78)', 'rgba(182,154,255,0.72)', 'transparent']}
        locations={[0, 0.48, 0.78, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.leftRail}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(240,210,139,0.78)', 'rgba(182,154,255,0.72)', 'transparent']}
        locations={[0, 0.48, 0.78, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.rightRail}
      />

      <Animated.View
        style={[
          styles.topSweep,
          { opacity: sweepOpacity, transform: [{ translateX: sweepX }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', FRAME_GOLD_HIGHLIGHT, 'rgba(182,154,255,0.72)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.bottomSweep,
          { opacity: sweepOpacity, transform: [{ translateX: reverseSweepX }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(182,154,255,0.7)', FRAME_GOLD_HIGHLIGHT, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map(corner => (
        <View key={corner} style={[styles.corner, styles[corner]]}>
          <View style={styles.cornerLongStroke} />
          <View style={styles.cornerShortStroke} />
          <Text style={styles.cornerStar}>✧</Text>
        </View>
      ))}

      {[22, 50, 78].map(position => (
        <React.Fragment key={position}>
          <Text style={[styles.sideCrystal, styles.leftCrystal, { top: `${position}%` }]}>◇</Text>
          <Text style={[styles.sideCrystal, styles.rightCrystal, { top: `${position}%` }]}>◇</Text>
        </React.Fragment>
      ))}

      <View style={styles.topCrest}>
        <View style={styles.crestOuterDiamond} />
        <View style={styles.crestInnerDiamond} />
        <Text style={styles.crestStar}>✦</Text>
      </View>
      <View style={styles.bottomPendant}>
        <View style={styles.pendantDiamond} />
        <Text style={styles.pendantStar}>✧</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerRail: {
    ...StyleSheet.absoluteFillObject,
    margin: 3,
    borderRadius: 20,
    borderWidth: 1.3,
    borderColor: 'rgba(240,210,139,0.82)',
    shadowColor: FRAME_GOLD,
    shadowOpacity: 0.42,
    shadowRadius: 8,
    elevation: 3,
  },
  innerRail: {
    ...StyleSheet.absoluteFillObject,
    margin: 7,
    borderRadius: 16,
    borderWidth: 0.7,
    borderColor: 'rgba(182,154,255,0.36)',
  },
  topRail: {
    position: 'absolute',
    top: 2,
    left: 28,
    right: 28,
    height: 1.4,
  },
  bottomRail: {
    position: 'absolute',
    bottom: 2,
    left: 28,
    right: 28,
    height: 1.4,
  },
  leftRail: { position: 'absolute', top: 28, bottom: 28, left: 2, width: 1.4 },
  rightRail: { position: 'absolute', top: 28, bottom: 28, right: 2, width: 1.4 },
  topSweep: {
    position: 'absolute',
    top: 1,
    left: 0,
    width: 82,
    height: 2,
    overflow: 'hidden',
  },
  bottomSweep: {
    position: 'absolute',
    bottom: 1,
    left: 0,
    width: 82,
    height: 2,
    overflow: 'hidden',
  },
  corner: { position: 'absolute', width: 28, height: 28 },
  topLeft: { top: 3, left: 3 },
  topRight: { top: 3, right: 3, transform: [{ scaleX: -1 }] },
  bottomLeft: { bottom: 3, left: 3, transform: [{ scaleY: -1 }] },
  bottomRight: { bottom: 3, right: 3, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
  cornerLongStroke: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 17,
    height: 17,
    borderTopWidth: 1.2,
    borderLeftWidth: 1.2,
    borderColor: FRAME_GOLD,
    borderTopLeftRadius: 10,
  },
  cornerShortStroke: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 9,
    height: 9,
    borderTopWidth: 0.8,
    borderLeftWidth: 0.8,
    borderColor: 'rgba(182,154,255,0.9)',
    borderTopLeftRadius: 6,
  },
  cornerStar: {
    position: 'absolute',
    top: 0,
    left: 1,
    color: FRAME_GOLD_HIGHLIGHT,
    fontSize: 13,
    textShadowColor: 'rgba(240,210,139,0.82)',
    textShadowRadius: 6,
  },
  sideCrystal: {
    position: 'absolute',
    color: FRAME_GOLD_HIGHLIGHT,
    fontSize: 15,
    lineHeight: 18,
    textShadowColor: 'rgba(182,154,255,0.95)',
    textShadowRadius: 8,
  },
  leftCrystal: { left: -2 },
  rightCrystal: { right: -2 },
  topCrest: {
    position: 'absolute',
    top: -8,
    left: '50%',
    width: 28,
    height: 28,
    marginLeft: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestOuterDiamond: {
    position: 'absolute',
    width: 22,
    height: 22,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.2,
    borderColor: FRAME_GOLD_HIGHLIGHT,
    backgroundColor: 'rgba(42,28,68,0.98)',
    shadowColor: FRAME_GOLD,
    shadowOpacity: 0.72,
    shadowRadius: 7,
    elevation: 5,
  },
  crestInnerDiamond: {
    position: 'absolute',
    width: 13,
    height: 13,
    transform: [{ rotate: '45deg' }],
    borderWidth: 0.8,
    borderColor: FRAME_VIOLET,
    backgroundColor: 'rgba(133,91,194,0.62)',
  },
  crestStar: {
    color: FRAME_GOLD_HIGHLIGHT,
    fontSize: 13,
    textShadowColor: FRAME_GOLD,
    textShadowRadius: 7,
  },
  bottomPendant: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    width: 24,
    height: 24,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendantDiamond: {
    position: 'absolute',
    width: 17,
    height: 17,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
    borderColor: FRAME_GOLD,
    borderRadius: 2,
    backgroundColor: 'rgba(40,26,66,0.98)',
  },
  pendantStar: {
    color: FRAME_VIOLET,
    fontSize: 12,
    textShadowColor: FRAME_GOLD_HIGHLIGHT,
    textShadowRadius: 5,
  },
});
