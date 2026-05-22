/**
 * Beautiful in-app animated splash screen.
 * Shown while fonts load; fades out gracefully into the app.
 * Theme: Sky: Children of the Light — deep navy/lavender, moon, golden glow.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

// ── Deterministic star field (no Math.random — deterministic for RN) ───────
function pseudoRand(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  x:       pseudoRand(i * 3)    * width,
  y:       pseudoRand(i * 7)    * height * 0.72,
  size:    1.4 + pseudoRand(i * 11) * 2.6,
  opacity: 0.2  + pseudoRand(i * 13) * 0.6,
  delay:   Math.floor(pseudoRand(i * 17) * 2400),
}));

function StarField() {
  const anims = useRef(STARS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(STARS[i].delay),
          Animated.timing(anim, { toValue: 1, duration: 1100 + (i % 7) * 190, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 1100 + (i % 5) * 190, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((star, i) => (
        <Animated.View
          key={star.id}
          style={{
            position: 'absolute',
            left: star.x,
            top:  star.y,
            width:  star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: '#E8D8FF',
            opacity: anims[i].interpolate({
              inputRange:  [0, 1],
              outputRange: [star.opacity * 0.35, star.opacity],
            }),
          }}
        />
      ))}
    </View>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  onReady: () => void;
}

// ── Main component ─────────────────────────────────────────────────────────
export function AppSplashScreen({ onReady }: Props) {
  const screenFade  = useRef(new Animated.Value(1)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const titleY      = useRef(new Animated.Value(24)).current;
  const glowPulse   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade content in
    Animated.parallel([
      Animated.timing(contentFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(titleY,      { toValue: 0, tension: 42, friction: 9, useNativeDriver: true }),
    ]).start();

    // Pulsing moon glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1900, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0, duration: 1900, useNativeDriver: true }),
      ])
    ).start();

    // Hold, then fade out entire screen and call onReady
    const t = setTimeout(() => {
      Animated.timing(screenFade, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }).start(() => onReady());
    }, 2400);

    return () => clearTimeout(t);
  }, []);

  const moonScale = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1.06] });

  return (
    <Animated.View style={[styles.root, { opacity: screenFade }]} pointerEvents="none">
      {/* Background gradient */}
      <LinearGradient
        colors={['#0D0B1E', '#141030', '#1C1646', '#231C54']}
        locations={[0, 0.28, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft horizon haze */}
      <View style={styles.haze} />

      {/* Stars */}
      <StarField />

      {/* ── Centre content ─────────────────────────────────────── */}
      <View style={styles.centre}>
        {/* Moon orb */}
        <Animated.View style={[styles.moonWrap, { transform: [{ scale: moonScale }] }]}>
          {/* Outer corona rings */}
          <View style={[styles.corona, { width: MOON + 64, height: MOON + 64, borderRadius: (MOON + 64) / 2 }]} />
          <View style={[styles.corona, styles.corona2, { width: MOON + 36, height: MOON + 36, borderRadius: (MOON + 36) / 2 }]} />
          {/* Moon disc */}
          <View style={styles.moonDisc}>
            <LinearGradient
              colors={['#C8BEE0', '#B8ACDA', '#A898CC']}
              style={StyleSheet.absoluteFill}
            />
            {/* Crater shadow */}
            <View style={styles.craterA} />
            <View style={styles.craterB} />
          </View>
        </Animated.View>

        {/* Text block */}
        <Animated.View style={[styles.textBlock, { opacity: contentFade, transform: [{ translateY: titleY }] }]}>
          {/* Divider label */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>YOUR CELESTIAL DIARY</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* "Sky" in large serif */}
          <Text style={styles.wordSky}>Sky</Text>

          {/* "JOURNAL" spaced gold */}
          <Text style={styles.wordJournal}>JOURNAL</Text>

          {/* Tagline */}
          <Text style={styles.tagline}>where every sky moment lives forever</Text>

          {/* Three dots */}
          <View style={styles.dots}>
            <View style={[styles.dot, { backgroundColor: 'rgba(200,184,232,0.22)' }]} />
            <View style={[styles.dot, { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(200,168,75,0.65)' }]} />
            <View style={[styles.dot, { backgroundColor: 'rgba(200,184,232,0.22)' }]} />
          </View>
        </Animated.View>
      </View>

      {/* ── Bottom branding strip ──────────────────────────────── */}
      <Animated.View style={[styles.bottomStrip, { opacity: contentFade }]}>
        {/* Shimmer line */}
        <View style={styles.shimmerLine}>
          <LinearGradient
            colors={['transparent', 'rgba(200,184,232,0.16)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Constellation dots row */}
        <View style={styles.constellationRow}>
          {[0,1,2,3,4,5,6].map(i => (
            <View
              key={i}
              style={[
                styles.constDot,
                i === 3 && { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(200,168,75,0.45)' },
              ]}
            />
          ))}
        </View>

        {/* Subtle footer tagline */}
        <Text style={styles.footerText}>sky: children of the light</Text>
      </Animated.View>
    </Animated.View>
  );
}

const MOON = 108;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: height * 0.11,
    paddingBottom: height * 0.08,
  },

  // ── Layout zones ────────────────────────────────────────────────────────
  centre: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },

  bottomStrip: {
    alignItems: 'center',
    width: '100%',
    gap: 14,
  },

  constellationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  constDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(200,184,232,0.20)',
  },
  footerText: {
    fontSize: 10,
    color: 'rgba(200,184,232,0.28)',
    letterSpacing: 2.8,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textTransform: 'uppercase',
  },

  haze: {
    position: 'absolute',
    bottom: height * 0.22,
    left: -80,
    right: -80,
    height: 200,
    borderRadius: 130,
    backgroundColor: 'rgba(90,72,160,0.14)',
  },

  // ── Moon ────────────────────────────────────────────────────────────────
  moonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  corona: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(200,184,232,0.10)',
  },
  corona2: {
    borderColor: 'rgba(200,184,232,0.16)',
  },
  moonDisc: {
    width: MOON,
    height: MOON,
    borderRadius: MOON / 2,
    overflow: 'hidden',
    shadowColor: '#C0B0E8',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  craterA: {
    position: 'absolute',
    top: 18,
    right: 22,
    width: MOON * 0.45,
    height: MOON * 0.45,
    borderRadius: MOON * 0.225,
    backgroundColor: 'rgba(20,16,48,0.28)',
  },
  craterB: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    width: MOON * 0.2,
    height: MOON * 0.2,
    borderRadius: MOON * 0.1,
    backgroundColor: 'rgba(20,16,48,0.18)',
  },

  // ── Text ────────────────────────────────────────────────────────────────
  textBlock: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },
  dividerLine: {
    width: 36,
    height: 1,
    backgroundColor: 'rgba(200,184,232,0.18)',
  },
  dividerLabel: {
    fontSize: 9.5,
    color: 'rgba(200,184,232,0.45)',
    letterSpacing: 3.2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  wordSky: {
    fontSize: 70,
    color: '#EDE5FF',
    lineHeight: 74,
    letterSpacing: -2.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textShadowColor: 'rgba(180,160,240,0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  wordJournal: {
    fontSize: 22,
    color: 'rgba(200,168,75,0.90)',
    letterSpacing: 8,
    marginTop: -4,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textShadowColor: 'rgba(200,168,75,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  tagline: {
    fontSize: 11.5,
    color: 'rgba(200,184,232,0.38)',
    letterSpacing: 0.5,
    marginTop: 16,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 22,
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // ── Bottom shimmer ───────────────────────────────────────────────────────
  shimmerLine: {
    width: '80%',
    height: 1,
  },
});
