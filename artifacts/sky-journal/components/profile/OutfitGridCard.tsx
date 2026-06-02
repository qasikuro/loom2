import { Icon } from '@/components/Icon';
import { SHADOW } from '@/constants/colors';
import type { Outfit } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function OutfitGridCard({
  outfit, isActive, cardW, onPress,
}: {
  outfit:   Outfit;
  isActive: boolean;
  cardW:    number;
  onPress:  () => void;
}) {
  const colors = useColors();
  const scale  = useRef(new Animated.Value(1)).current;
  const cardH  = Math.round(cardW * 1.25);

  return (
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, tension: 200, friction: 8 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 8 }).start()}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          s.card,
          { width: cardW, height: cardH, borderColor: isActive ? colors.primary : colors.border },
          isActive && { borderWidth: 2 },
          { transform: [{ scale }] },
          SHADOW.xs,
        ]}
      >
        {outfit.imageUri ? (
          <Image source={{ uri: outfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.primary}14`, alignItems: 'center', justifyContent: 'center', gap: 4 }]}>
            <Icon name="camera" size={20} color={`${colors.primary}55`} />
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Medium', color: `${colors.primary}55` }}>Add photo</Text>
          </View>
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={s.grad} />
        {isActive && (
          <View style={[s.activeBadge, { backgroundColor: colors.primary }]}>
            <Text style={s.activeBadgeText}>✦</Text>
          </View>
        )}
        <Text style={s.name} numberOfLines={1}>{outfit.name}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card:           { borderRadius: 14, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  grad:           { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' },
  activeBadge:    { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  activeBadgeText:{ fontSize: 12, color: '#fff' },
  name:           { position: 'absolute', bottom: 8, left: 8, right: 8, fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.95)' },
});
