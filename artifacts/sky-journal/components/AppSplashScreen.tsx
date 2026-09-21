/**
 * GameJo animated splash screen.
 * Uses the splash image as background with twinkling stars + animated loading bar.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SPLASH_IMG = require('../assets/images/gamejo_splash.png');

function pseudoRand(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

// Stars — scattered across top 68% of screen, mix of gold + white
function buildStars(width: number, height: number) {
  return Array.from({ length: 48 }, (_, i) => ({
    id:      i,
    x:       pseudoRand(i * 3)  * width,
    y:       pseudoRand(i * 7)  * height * 0.68,
    size:    1.2 + pseudoRand(i * 11) * 3.2,
    opacity: 0.25 + pseudoRand(i * 13) * 0.75,
    delay:   Math.floor(pseudoRand(i * 17) * 2200),
    color:   pseudoRand(i * 23) > 0.55 ? '#FFD700' : '#FFFFFF',
  }));
}

function StarField() {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => buildStars(width, height), [width, height]);
  const anims = useMemo(() => stars.map(() => new Animated.Value(0)), [stars]);

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(stars[i].delay),
          Animated.timing(anim, { toValue: 1, duration: 700 + (i % 7) * 210, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 700 + (i % 5) * 210, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [anims, stars]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((star, i) => (
        <Animated.View
          key={star.id}
          style={{
            position:        'absolute',
            left:            star.x,
            top:             star.y,
            width:           star.size,
            height:          star.size,
            borderRadius:    star.size / 2,
            backgroundColor: star.color,
            opacity: anims[i].interpolate({
              inputRange:  [0, 1],
              outputRange: [0, star.opacity],
            }),
          }}
        />
      ))}
    </View>
  );
}

// ── Loading bar with shimmer + pulsing dots ───────────────────────────────────

function LoadingBar() {
  const { width } = useWindowDimensions();
  const barWidth = width * 0.62;
  const shimmerX = useRef(new Animated.Value(-100)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const dot1     = useRef(new Animated.Value(0.3)).current;
  const dot2     = useRef(new Animated.Value(0.3)).current;
  const dot3     = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    barProgress.setValue(0);
    shimmerX.setValue(-100);

    // Fill bar to ~82%
    Animated.timing(barProgress, {
      toValue:  barWidth * 0.82,
      duration: 2300,
      easing:   Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Shimmer sweep loop
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: barWidth + 100, duration: 950, useNativeDriver: true }),
        Animated.timing(shimmerX, { toValue: -100, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
      ])
    );
    shimmerLoop.start();

    // Dot cascade
    let cancelled = false;
    const pulseDots = () => {
      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.delay(260),
        Animated.parallel([
          Animated.timing(dot1, { toValue: 0.3, duration: 200, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0.3, duration: 200, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0.3, duration: 200, useNativeDriver: true }),
        ]),
        Animated.delay(180),
      ]).start(({ finished }) => {
        if (finished && !cancelled) pulseDots();
      });
    };
    pulseDots();
    return () => {
      cancelled = true;
      shimmerLoop.stop();
      barProgress.stopAnimation();
      shimmerX.stopAnimation();
      dot1.stopAnimation();
      dot2.stopAnimation();
      dot3.stopAnimation();
    };
  }, [barWidth, barProgress, shimmerX, dot1, dot2, dot3]);

  return (
    <View style={styles.loadingWrap}>
      {/* Track */}
      <View style={[styles.barTrack, { width: barWidth }]}>
        {/* Animated fill */}
        <Animated.View style={[styles.barFill, { width: barProgress }]}>
          <LinearGradient
            colors={['#7C3AED', '#C026D3', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Shimmer sweep */}
          <Animated.View
            style={[styles.shimmer, { transform: [{ translateX: shimmerX }] }]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.50)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: 90, height: '100%' }}
            />
          </Animated.View>
        </Animated.View>
      </View>

      {/* LOADING... text */}
      <View style={styles.loadingRow}>
        <Text style={styles.loadingLabel}>LOADING</Text>
        <Animated.Text style={[styles.loadingDot, { opacity: dot1 }]}>.</Animated.Text>
        <Animated.Text style={[styles.loadingDot, { opacity: dot2 }]}>.</Animated.Text>
        <Animated.Text style={[styles.loadingDot, { opacity: dot3 }]}>.</Animated.Text>
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onReady: () => void;
  /** Root content may still be hydrating; keep the branded reveal until it is ready. */
  ready?: boolean;
}

export function AppSplashScreen({ onReady, ready = true }: Props) {
  const { width, height } = useWindowDimensions();
  const screenFade  = useRef(new Animated.Value(1)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const [blocksTouches, setBlocksTouches] = useState(true);

  useEffect(() => {
    // Fade overlay elements in
    Animated.timing(contentFade, {
      toValue:  1,
      duration: 550,
      useNativeDriver: true,
    }).start();

    // Dismiss after a short branded minimum once the root is ready. A hard
    // maximum prevents a blank/blocked screen if a provider never resolves.
    let dismissed = false;
    const startedAt = Date.now();
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      // Release the app underneath immediately. In a native development build
      // the animation completion callback can be delayed; keeping this overlay
      // touchable would leave the visible Home screen completely inert.
      setBlocksTouches(false);
      Animated.timing(screenFade, {
        toValue:  0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => onReady());
    };
    const minimumTimer = setTimeout(() => {
      if (ready) dismiss();
    }, Math.max(0, 1200 - (Date.now() - startedAt)));
    const maximumTimer = setTimeout(dismiss, 6000);

    return () => {
      clearTimeout(minimumTimer);
      clearTimeout(maximumTimer);
      contentFade.stopAnimation();
      screenFade.stopAnimation();
    };
  }, [onReady, ready, contentFade, screenFade]);

  return (
    <Animated.View
      style={[styles.root, { opacity: screenFade }]}
      pointerEvents={blocksTouches ? 'auto' : 'none'}
      accessible
      accessibilityViewIsModal
      accessibilityLabel="Loading Sky Journal"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      {/* Background — react-native Image for synchronous bundled asset loading */}
      <Image
        source={SPLASH_IMG}
        style={[styles.bg, { width, height }]}
        resizeMode="cover"
        fadeDuration={0}
      />

      {/* Twinkling stars */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: contentFade }]}>
        <StarField />
      </Animated.View>

      {/* Loading bar pinned to bottom */}
      <Animated.View style={[styles.bottom, { opacity: contentFade, paddingBottom: height * 0.09 }]}>
        <LoadingBar />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex:         9999,
    alignItems:     'center',
    justifyContent: 'flex-end',
  },
  bg: {
    position: 'absolute',
    top:      0,
    left:     0,
  },
  bottom: {
    width:         '100%',
    alignItems:    'center',
  },

  // Loading bar
  loadingWrap: {
    alignItems: 'center',
    gap:        10,
  },
  barTrack: {
    height:          6,
    borderRadius:    3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow:        'hidden',
  },
  barFill: {
    height:       '100%',
    borderRadius: 3,
    overflow:     'hidden',
  },
  shimmer: {
    position: 'absolute',
    top:      0,
    bottom:   0,
    width:    90,
  },

  // LOADING... text
  loadingRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
  },
  loadingLabel: {
    fontSize:     11,
    color:        'rgba(255,255,255,0.72)',
    letterSpacing: 3.8,
    fontFamily:   Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  loadingDot: {
    fontSize:   14,
    color:      'rgba(255,255,255,0.72)',
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
});
