import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useColors } from '@/hooks/useColors';

interface TraitTagProps {
  label: string;
  onPress?: () => void;
  variant?: 'default' | 'vibe' | 'mood';
}

export function TraitTag({ label, onPress, variant = 'default' }: TraitTagProps) {
  const colors = useColors();

  const bgColor =
    variant === 'vibe'
      ? colors.secondary
      : variant === 'mood'
        ? `${colors.accent}22`
        : `${colors.primary}18`;

  const textColor =
    variant === 'mood' ? colors.accent : colors.primary;

  return (
    <TouchableOpacity
      style={[styles.tag, { backgroundColor: bgColor, borderColor: `${textColor}30` }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
    letterSpacing: 0.2,
  },
});
