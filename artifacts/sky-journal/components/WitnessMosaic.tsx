import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const ICONS = ['◈', '◇', '✦', '◐', '⬡', '✿', '◉', '△'];

const CLUSTER_POSITIONS: { dx: number; dy: number }[] = [
  { dx:  0,  dy:  0 },
  { dx: 22,  dy: -10 },
  { dx: -18, dy: 14 },
  { dx: 36,  dy: 18 },
  { dx: -6,  dy: -24 },
  { dx: 44,  dy: -4 },
  { dx: 16,  dy: 30 },
  { dx: -30, dy: -6 },
];

interface Props {
  count:     number;
  accent?:   string;
}

function StarOrb({ icon, delay, accent }: { icon: string; delay: number; accent: string }) {
  const opacity  = useRef(new Animated.Value(0)).current;
  const scale    = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scale,  { toValue: 1, tension: 70, friction: 6, useNativeDriver: true }),
      ]),
    ]).start();

    const breathLoop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.55, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1,    duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const t = setTimeout(() => breathLoop.start(), delay + 700);
    return () => { clearTimeout(t); breathLoop.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.Text style={[s.orb, { color: accent, opacity, transform: [{ scale }] }]}>
      {icon}
    </Animated.Text>
  );
}

export function WitnessMosaic({ count, accent = '#9B78E8' }: Props) {
  const visible = Math.min(count, 8);
  if (visible === 0) return null;

  return (
    <View style={s.wrap}>
      <View style={s.cluster}>
        {CLUSTER_POSITIONS.slice(0, visible).map((pos, i) => (
          <View
            key={i}
            style={[s.orbWrap, { transform: [{ translateX: pos.dx }, { translateY: pos.dy }] }]}
          >
            <StarOrb icon={ICONS[i]!} delay={i * 80} accent={accent} />
          </View>
        ))}
      </View>
      <Text style={[s.label, { color: `${accent}88` }]}>
        {count === 1
          ? '1 soul witnessed this'
          : count < 8
            ? `${count} souls witnessed this`
            : `${count}+ souls witnessed this`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 28,
  },
  cluster: {
    width: 90,
    height: 60,
    position: 'relative',
  },
  orbWrap: {
    position: 'absolute',
    top: 20,
    left: 30,
  },
  orb: {
    fontSize: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
});
