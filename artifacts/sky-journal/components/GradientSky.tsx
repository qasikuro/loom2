import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';

export type SkyVariant = 'dawn' | 'day' | 'dusk' | 'night' | 'card' | 'overlay';

interface GradientSkyProps {
  style?: ViewStyle | ViewStyle[];
  variant?: SkyVariant;
  children?: React.ReactNode;
}

const GRADIENTS: Record<SkyVariant, string[]> = {
  dawn: ['#F8E0D8', '#EDD0F0', '#C8B8E8', '#B8C8E8'],
  day: ['#F0EAF8', '#E4DCED', '#D8E8F4', '#EDE8F8'],
  dusk: ['#F0D8C8', '#D8B8D8', '#B0A0CC', '#9080B8'],
  night: ['#1A1630', '#2A1E50', '#1E2E4A', '#0C0A20'],
  card: ['rgba(255,255,255,0.95)', 'rgba(245,240,252,0.95)'],
  overlay: ['rgba(42,32,64,0.0)', 'rgba(42,32,64,0.7)'],
};

export function getTimeVariant(): SkyVariant {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

export function GradientSky({ style, variant, children }: GradientSkyProps) {
  const v = variant ?? getTimeVariant();
  const gradColors = GRADIENTS[v];
  const isOverlay = v === 'overlay';
  return (
    <LinearGradient
      colors={gradColors as [string, string, ...string[]]}
      style={[StyleSheet.absoluteFill, style as ViewStyle]}
      start={{ x: isOverlay ? 0.5 : 0, y: isOverlay ? 0 : 0 }}
      end={{ x: isOverlay ? 0.5 : 1, y: 1 }}
    >
      {children}
    </LinearGradient>
  );
}
