import React, { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '@/context/AppContext';

interface ResonateButtonProps {
  storyId: string;
}

export function ResonateButton({ storyId }: ResonateButtonProps) {
  const [resonated, setResonated] = useState(false);

  const scale   = useRef(new Animated.Value(1)).current;
  const ring1   = useRef(new Animated.Value(0)).current;
  const ring2   = useRef(new Animated.Value(0)).current;
  const ring1Op = useRef(new Animated.Value(0)).current;
  const ring2Op = useRef(new Animated.Value(0)).current;

  function playRipple() {
    ring1.setValue(0);
    ring2.setValue(0);
    ring1Op.setValue(0.7);
    ring2Op.setValue(0.55);

    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.22, tension: 260, friction: 7, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1,    tension: 180, friction: 9, useNativeDriver: true }),
      ]),
      Animated.timing(ring1, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(ring1Op, { toValue: 0, duration: 480, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(ring2, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.timing(ring2Op, { toValue: 0, duration: 480, useNativeDriver: true }),
      ]),
    ]).start();
  }

  function handlePress() {
    if (resonated) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResonated(true);
    playRipple();
    apiFetch(`/stories/${storyId}/resonate`, { method: 'POST' }).catch(() => null);
  }

  const ring1Scale = ring1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const ring2Scale = ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.0] });

  return (
    <TouchableOpacity
      onPress={handlePress}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      activeOpacity={0.75}
    >
      <View style={styles.wrap}>
        <Animated.View style={[styles.ring, { transform: [{ scale: ring1Scale }], opacity: ring1Op, borderColor: resonated ? '#C8B0FF' : 'rgba(200,184,232,0.5)' }]} />
        <Animated.View style={[styles.ring, { transform: [{ scale: ring2Scale }], opacity: ring2Op, borderColor: resonated ? '#C8B0FF' : 'rgba(200,184,232,0.35)' }]} />
        <Animated.View style={[
          styles.btn,
          resonated && styles.btnActive,
          { transform: [{ scale }] },
        ]}>
          <Text style={[styles.icon, resonated && styles.iconActive]}>◎</Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1.5,
  },
  btn: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.75, borderColor: 'rgba(107,91,149,0.25)',
  },
  btnActive: {
    backgroundColor: 'rgba(107,91,149,0.22)',
    borderColor:     'rgba(200,176,255,0.60)',
  },
  icon: {
    fontSize: 13,
    color: 'rgba(200,184,232,0.55)',
    lineHeight: 15,
  },
  iconActive: {
    color: '#C8B0FF',
  },
});
