import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export interface BadgeItem {
  id:        string;
  slug:      string;
  name:      string;
  emoji:     string;
  color:     string;
  imageUrl?: string | null;
}

interface Props {
  badges:  BadgeItem[];
  size?:   'sm' | 'md';
}

/**
 * Fully data-driven badge tray.
 * Renders whatever badges the API returns — no hardcoded knowledge of specific
 * badge slugs or images.  If a badge has an imageUrl, renders it; otherwise
 * falls back to an emoji + name pill.
 */
export function BadgeTray({ badges, size = 'md' }: Props) {
  if (!badges || badges.length === 0) return null;

  const imgSize  = size === 'sm' ? 28 : 38;
  const fontSize = size === 'sm' ? 10 : 11;

  return (
    <View style={s.row}>
      {badges.map((badge) => (
        <View key={badge.id} style={[s.pill, { backgroundColor: badge.color + '22', borderColor: badge.color + '55' }]}>
          {badge.imageUrl ? (
            <Image
              source={{ uri: badge.imageUrl }}
              style={{ width: imgSize, height: imgSize, borderRadius: 4 }}
              resizeMode="contain"
            />
          ) : (
            <Text style={{ fontSize: imgSize * 0.6 }}>{badge.emoji}</Text>
          )}
          <Text style={[s.label, { color: badge.color, fontSize }]}>{badge.name}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            6,
    marginTop:      4,
  },
  pill: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    paddingVertical:  4,
    paddingHorizontal: 8,
    borderRadius:   10,
    borderWidth:    1,
  },
  label: {
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.2,
  },
});
