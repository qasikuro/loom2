import React, { useState } from 'react';
import {
  View, Image, Text, StyleSheet,
  TouchableOpacity, Modal, Pressable,
} from 'react-native';

export interface BadgeItem {
  id:          string;
  slug:        string;
  name:        string;
  emoji:       string;
  color:       string;
  imageUrl?:   string | null;
  description?: string | null;
}

interface Props {
  badges: BadgeItem[];
}

/**
 * Compact badge tray — tappable image-only circles in a horizontal row.
 * Tapping a badge shows a small tooltip sheet with the badge name and description.
 */
export function BadgeTray({ badges }: Props) {
  const [selected, setSelected] = useState<BadgeItem | null>(null);

  if (!badges || badges.length === 0) return null;

  return (
    <>
      <View style={s.row}>
        {badges.map((badge) => (
          <TouchableOpacity
            key={badge.id}
            style={[s.chip, { backgroundColor: badge.color + '22', borderColor: badge.color + '55' }]}
            onPress={() => setSelected(badge)}
            activeOpacity={0.72}
            hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
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
          </TouchableOpacity>
        ))}
      </View>

      {/* Badge tooltip modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={s.overlay} onPress={() => setSelected(null)}>
          {!!selected && (
            <Pressable style={s.sheet} onPress={() => { /* prevent overlay dismiss */ }}>
              {/* Badge circle */}
              <View
                style={[
                  s.sheetChip,
                  { backgroundColor: selected.color + '33', borderColor: selected.color + '77' },
                ]}
              >
                {selected.imageUrl ? (
                  <Image
                    source={{ uri: selected.imageUrl }}
                    style={s.sheetImg}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={s.sheetEmoji}>{selected.emoji}</Text>
                )}
              </View>

              {/* Badge name */}
              <Text style={s.sheetName}>{selected.name}</Text>

              {/* Description */}
              {!!selected.description && (
                <Text style={s.sheetDesc}>{selected.description}</Text>
              )}

              {/* Dismiss button */}
              <TouchableOpacity
                style={[s.dismissBtn, { borderColor: selected.color + '55' }]}
                onPress={() => setSelected(null)}
                activeOpacity={0.75}
              >
                <Text style={[s.dismissText, { color: selected.color }]}>Got it</Text>
              </TouchableOpacity>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const CHIP = 32;
const SHEET_CHIP = 56;

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
    fontSize:   16,
    lineHeight: 20,
  },

  // ── Overlay + sheet ──────────────────────────────────────────────────────
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         32,
  },
  sheet: {
    width:           '100%',
    maxWidth:        320,
    backgroundColor: '#1A1530',
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     'rgba(107,91,149,0.35)',
    padding:         24,
    alignItems:      'center',
    gap:             10,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.45,
    shadowRadius:    24,
    elevation:       16,
  },
  sheetChip: {
    width:          SHEET_CHIP,
    height:         SHEET_CHIP,
    borderRadius:   SHEET_CHIP / 2,
    borderWidth:    2,
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
    marginBottom:   4,
  },
  sheetImg: {
    width:  SHEET_CHIP,
    height: SHEET_CHIP,
  },
  sheetEmoji: {
    fontSize:   26,
    lineHeight: 32,
  },
  sheetName: {
    fontSize:    18,
    fontFamily:  'Satoshi-Bold',
    color:       '#F0EAFF',
    textAlign:   'center',
    letterSpacing: -0.3,
  },
  sheetDesc: {
    fontSize:   13,
    fontFamily: 'Satoshi-Regular',
    color:      'rgba(200,184,232,0.72)',
    textAlign:  'center',
    lineHeight: 19,
  },
  dismissBtn: {
    marginTop:       6,
    paddingHorizontal: 20,
    paddingVertical:   9,
    borderRadius:    12,
    borderWidth:     1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dismissText: {
    fontSize:   13,
    fontFamily: 'Satoshi-Bold',
  },
});
