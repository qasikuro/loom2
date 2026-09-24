import { Icon } from '@/components/Icon';
import type { ConstellationState } from '@/components/ConstellationMap';
import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  constellation: ConstellationState | null;
  availableTitles: string[];
  saving: boolean;
  onSelect: (title: string) => void;
  onClose: () => void;
}

export function TitlePickerModal({ visible, constellation, availableTitles, saving, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={e => e.stopPropagation()}
          style={[styles.sheet, {
            maxHeight: Math.max(260, height - (Platform.OS === 'web' ? 67 : insets.top) - 12),
            paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 16,
          }]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
          <Text style={styles.heading}>{t('components.titlePicker.heading')}</Text>
          {availableTitles.map(title => {
            const active = constellation?.activeTitle === title;
            return (
              <TouchableOpacity key={title} onPress={() => onSelect(title)} disabled={saving}
                style={[styles.titleRow, active && styles.titleRowActive]}
              >
                <Text style={[styles.titleText, active && styles.titleTextActive]} numberOfLines={2}>✦ {title}</Text>
                {active && <Icon name="check" size={14} color="#C8A84B" />}
              </TouchableOpacity>
            );
          })}
          {saving && <ActivityIndicator color="#C8A84B" style={{ marginTop: 4 }} />}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0E0B1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  content: { gap: 10 },
  heading: { color: '#C8B8E8', fontFamily: 'Satoshi-Bold', fontSize: 16, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  titleRowActive: { backgroundColor: 'rgba(200,168,75,0.12)', borderColor: 'rgba(200,168,75,0.30)' },
  titleText: { flex: 1, minWidth: 0, fontFamily: 'Satoshi-Medium', fontSize: 14, color: 'rgba(200,184,232,0.75)' },
  titleTextActive: { color: '#C8A84B' },
});
