import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useColors } from "../../hooks/use-colors";
import type { NativeThemeMode } from "../../lib/native-theme";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  mode?: NativeThemeMode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "small" | "medium";
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export function Button({
  label,
  onPress,
  mode,
  variant = "primary",
  size = "medium",
  disabled = false,
  accessibilityLabel,
  style,
  labelStyle,
}: ButtonProps) {
  const colors = useColors(mode);
  const backgroundColor = variant === "primary"
    ? colors.primary
    : variant === "secondary"
      ? colors.secondary
      : "transparent";
  const foregroundColor = variant === "primary"
    ? colors.primaryForeground
    : variant === "secondary"
      ? colors.secondaryForeground
      : colors.primary;
  const borderColor = variant === "outline" ? colors.border : "transparent";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === "small" ? styles.small : styles.medium,
        { backgroundColor, borderColor, opacity: disabled ? 0.48 : pressed ? 0.82 : 1 },
        style,
      ]}
    >
      <Text style={[styles.label, { color: foregroundColor, fontFamily: colors.fontFamily.bold }, labelStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 16,
  },
  small: {
    minHeight: 36,
    paddingHorizontal: 14,
  },
  medium: {
    minHeight: 46,
    paddingHorizontal: 18,
  },
  label: {
    fontSize: 14,
    letterSpacing: 0.1,
  },
});
