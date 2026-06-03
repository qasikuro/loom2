/**
 * XPFlash — lightweight bottom-of-screen pop that appears for 1.6 s
 * whenever the user earns constellation XP. Triggered via fireXPFlash()
 * from utils/xpFlash (module-level bus, no React context needed).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { subscribeXPFlash } from '@/utils/xpFlash';
export { fireXPFlash } from '@/utils/xpFlash';

const DISPLAY_MS = 1600;

export function XPFlash() {
  const insets     = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = subscribeXPFlash((message) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setMsg(message);
      opacity.stopAnimation();
      translateY.stopAnimation();
      opacity.setValue(0);
      translateY.setValue(16);

      Animated.parallel([
        Animated.timing(opacity,     { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(translateY,  { toValue: 0, duration: 220, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 12, duration: 300, useNativeDriver: true }),
        ]).start(() => setMsg(null));
      }, DISPLAY_MS);
    });
    return () => { unsub(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!msg) return null;

  return (
    <Animated.View
      style={[
        styles.pill,
        { bottom: insets.bottom + 96, opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.icon}>✦</Text>
      <Text style={styles.text}>{msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position:          'absolute',
    alignSelf:         'center',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               7,
    backgroundColor:   'rgba(30,20,60,0.88)',
    borderRadius:      20,
    paddingHorizontal: 18,
    paddingVertical:   9,
    borderWidth:       1,
    borderColor:       'rgba(200,184,232,0.28)',
    zIndex:            990,
  },
  icon: { fontSize: 12, color: '#C8B8E8' },
  text: { fontSize: 13, fontFamily: 'Satoshi-Medium', color: '#EEE8FF', letterSpacing: 0.2 },
});
