import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';

export interface BadgeItem {
  id:        string;
  slug:      string;
  name:      string;
  emoji:     string;
  color:     string;
  imageUrl?: string | null;
}

interface Props {
  badges: BadgeItem[];
}

/**
 * Compact badge tray — image-only circles in a horizontal row.
 * Shows the badge image when available, otherwise a single emoji.
 * No name labels — keeps the tray dense so multiple badges fit easily.
 */
export function BadgeTray({ badges }: Props) {
  if (!badges || badges.length === 0) return null;

  return (
    <View style={s.row}>
      {badges.map((badge) => (
        <View
          key={badge.id}
          style={[s.chip, { backgroundColor: badge.color + '22', borderColor: badge.color + '55' }]}
        >
          {badge.imageUrl ? (
            <Image
              source={{ uri: badge.imageUrl }}
              style={s.img}
              resizeMode="contain"
            />
          ) : (
            <Text style={s.emoji}>{badge.emoji}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const CHIP = 32;

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
    marginTop:     4,
  },
  chip: {
    width:          CHIP,
    height:         CHIP,
    borderRadius:   CHIP / 2,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
  },
  img: {
    width:  CHIP,
    height: CHIP,
  },
  emoji: {
    fontSize: 16,
    lineHeight: 20,
  },
});
