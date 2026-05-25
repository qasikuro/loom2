import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

interface BackButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
  iconName?: string;
  size?: number;
}

const HIT_SLOP = { top: 20, bottom: 20, left: 20, right: 20 };

export function BackButton({
  onPress,
  style,
  color = 'rgba(255,255,255,0.85)',
  iconName = 'arrow-left',
  size = 18,
}: BackButtonProps) {
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={HIT_SLOP}
      style={({ pressed }) => [styles.btn, style, pressed && styles.pressed]}
    >
      <Icon name={iconName} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
