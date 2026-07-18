import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface StarDef {
  left:  string;
  top:   string;
  size:  number;
  minOp: number;
  maxOp: number;
  dur:   number;
  delay: number;
  color: string;
}

function h(n: number): number {
  let v = (n * 2654435761) >>> 0;
  v ^= v >>> 16;
  v = (v * 2246822519) >>> 0;
  v ^= v >>> 13;
  return (v >>> 0) / 4294967296;
}

function mkStar(i: number): StarDef {
  return {
    left:  `${(h(i * 7  + 1) * 96 + 2).toFixed(2)}%`,
    top:   `${(h(i * 13 + 5) * 96 + 2).toFixed(2)}%`,
    size:  h(i * 17 + 3) < 0.58 ? 1 : h(i * 23 + 7) < 0.82 ? 1.5 : 2.5,
    minOp: 0.04 + h(i * 29 + 2) * 0.10,
    maxOp: 0.28 + h(i * 37 + 4) * 0.52,
    dur:   2000 + h(i * 43 + 6) * 5200,
    delay: h(i * 53 + 8) * 7000,
    color: h(i * 61 + 9) < 0.07 ? '#B8D8FF'
         : h(i * 67 + 11) < 0.05 ? '#FFE8B0'
         : '#FFFFFF',
  };
}

const STAR_DATA: StarDef[] = Array.from({ length: 54 }, (_, i) => mkStar(i));

function Twinkle({ s }: { s: StarDef }) {
  const op = useRef(new Animated.Value(s.minOp)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(s.delay * 0.4),
        Animated.timing(op, {
          toValue:  s.maxOp,
          duration: s.dur * 0.5,
          easing:   Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue:  s.minOp,
          duration: s.dur * 0.5,
          easing:   Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:        'absolute',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        left:            s.left as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        top:             s.top as any,
        width:           s.size,
        height:          s.size,
        borderRadius:    s.size / 2,
        backgroundColor: s.color,
        opacity:         op,
      }}
    />
  );
}

interface StarFieldProps {
  density?: 'low' | 'medium' | 'high';
  style?: object;
}

export function StarField({ density = 'medium', style }: StarFieldProps) {
  const count = density === 'low' ? 22 : density === 'high' ? 54 : 38;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, style]}>
      {STAR_DATA.slice(0, count).map((s, i) => <Twinkle key={i} s={s} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 0 },
});
