import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';

interface MoodBadgeProps {
  mood: string;
  size?: 'sm' | 'md';
}

const MOOD_ICONS: Record<string, { icon: string; color: string }> = {
  Hopeful:     { icon: 'sun',     color: '#C8A84B' },
  Lonely:      { icon: 'moon',    color: '#7090C0' },
  Peaceful:    { icon: 'cloud',   color: '#78A8C8' },
  Romantic:    { icon: 'heart',   color: '#C870A0' },
  Chaotic:     { icon: 'zap',     color: '#D0784A' },
  Dreamy:      { icon: 'star',    color: '#8B6BA8' },
  Soft:        { icon: 'feather', color: '#9888C0' },
  Adventurous: { icon: 'wind',    color: '#60A878' },
  Sad:         { icon: 'droplet', color: '#7890B8' },
  Joyful:      { icon: 'smile',   color: '#C8B040' },
};

function getMoodConfig(mood: string) {
  return MOOD_ICONS[mood] ?? { icon: 'circle', color: '#9888C0' };
}

export function MoodBadge({ mood, size = 'md' }: MoodBadgeProps) {
  const colors = useColors();
  const config = getMoodConfig(mood);
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${config.color}18`,
          borderColor: `${config.color}35`,
          paddingHorizontal: isSmall ? 8 : 12,
          paddingVertical: isSmall ? 3 : 5,
          gap: isSmall ? 3 : 5,
        },
      ]}
    >
      <Icon name={config.icon} size={isSmall ? 10 : 12} color={config.color} />
      <Text
        style={[
          styles.label,
          {
            color: config.color,
            fontSize: isSmall ? 10 : 12,
          },
        ]}
      >
        {mood}
      </Text>
    </View>
  );
}

export { getMoodConfig };

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.2,
  },
});
