import type { Character as _Character } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MOOD_COLORS } from './profileConstants';

interface Props {
  visible: boolean;
  currentMood: string;
  onSelect: (mood: string) => void;
  onClose: () => void;
}

export function MoodPickerModal({ visible, currentMood, onSelect, onClose }: Props) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[s.sheet, { backgroundColor: colors.card }]}>
          <View style={s.handle} />
          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text style={[s.title, { color: colors.foreground }]}>Choose your mood</Text>
            <Text style={[s.sub, { color: colors.mutedForeground }]}>How are you feeling in the sky today?</Text>
            <View style={s.grid}>
              {Object.keys(MOOD_COLORS).map(mood => {
                const isSelected = currentMood === mood;
                const mc = MOOD_COLORS[mood];
                return (
                  <TouchableOpacity
                    key={mood}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? mc : `${mc}45`, backgroundColor: isSelected ? `${mc}20` : `${mc}0A` }}
                    onPress={() => { Haptics.selectionAsync(); onSelect(mood); onClose(); }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mc }} />
                    <Text style={{ fontSize: 14, fontFamily: isSelected ? 'Satoshi-Bold' : 'Satoshi-Regular', color: mc }}>{mood}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', overflow: 'hidden' },
  handle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(120,86,255,0.25)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  title:   { fontSize: 15, fontFamily: 'Satoshi-Bold', marginBottom: 4 },
  sub:     { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', marginBottom: 16 },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 24 },
});
