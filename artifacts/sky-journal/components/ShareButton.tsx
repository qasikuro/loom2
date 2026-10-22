import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

type ShareButtonProps = {
  testID?: string;
  onPress: () => void;
  accessibilityLabel: string;
  iconColor?: string;
  iconSize?: number;
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  iconContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

/** A single accessible share control that can be styled for each existing action row. */
export function ShareButton({
  testID,
  onPress,
  accessibilityLabel,
  iconColor,
  iconSize = 16,
  label,
  labelStyle,
  iconContainerStyle,
  style,
  disabled = false,
}: ShareButtonProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      activeOpacity={0.78}
      onPress={onPress}
      style={[
        styles.defaultButton,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: disabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      {iconContainerStyle ? (
        <TextOrIconContainer style={iconContainerStyle} color={iconColor ?? colors.primary} size={iconSize} />
      ) : (
        <Icon name="share-2" size={iconSize} color={iconColor ?? colors.primary} />
      )}
      {label ? <Text style={[styles.label, { color: colors.foreground }, labelStyle]}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

function TextOrIconContainer({
  style,
  color,
  size,
}: {
  style: StyleProp<ViewStyle>;
  color: string;
  size: number;
}) {
  return (
    <View pointerEvents="none" style={style}>
      <Icon name="share-2" size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  defaultButton: {
    minWidth: 40,
    minHeight: 40,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
