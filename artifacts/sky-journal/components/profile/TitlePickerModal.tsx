import { Icon } from '@/components/Icon';
import type { ConstellationState } from '@/components/ConstellationMap';
import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/useColors';

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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={e => e.stopPropagation()}
          style={[styles.sheet, {
            backgroundColor: colors.card,
            borderColor: colors.border,
            maxHeight: Math.max(260, height - (Platform.OS === 'web' ? 67 : insets.top) - 12),
            paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 16,
          }]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
          <Text style={[styles.heading, { color: colors.foreground }]}>{t('components.titlePicker.heading')}</Text>
          {availableTitles.map(title => {
            const active = constellation?.activeTitle === title;
            return (
              <TouchableOpacity key={title} onPress={() => onSelect(title)} disabled={saving}
                style={[
                  styles.titleRow,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                  active && { backgroundColor: `${colors.gold}18`, borderColor: `${colors.gold}55` },
                ]}
              >
                <Text style={[styles.titleText, { color: colors.foreground }]} numberOfLines={2}>✦ {title}</Text>
                {active && <Icon name="check" size={14} color={colors.gold} />}
              </TouchableOpacity>
            );
          })}
          {saving && <ActivityIndicator color={colors.gold} style={{ marginTop: 4 }} />}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 },
  content: { gap: 10 },
  heading: { fontFamily: 'Satoshi-Bold', fontSize: 16, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 12, borderWidth: 1 },
  titleText: { flex: 1, minWidth: 0, fontFamily: 'Satoshi-Medium', fontSize: 14 },
});
