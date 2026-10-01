import { Icon } from '@/components/Icon';
import type { ConstellationState } from '@/components/ConstellationMap';
import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/useColors';
import { PROFILE_TITLE_CATALOG } from './profileTitles';

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
  const availableTitleSet = new Set(availableTitles);

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
          <Text style={[styles.heading, { color: colors.foreground }]}>
            {t('components.titlePicker.heading')}
          </Text>
          <Text style={[styles.intro, { color: colors.mutedForeground }]}>
            Titles unlock as you earn constellation stars. Choose any title you have unlocked.
          </Text>
          {availableTitles.length === 0 && (
            <View style={[styles.emptyHint, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.emptyHintText, { color: colors.foreground }]}>
                {constellation
                  ? 'Unlock your first constellation star to earn your first profile title.'
                  : 'Your constellation has not loaded yet, so titles are not available right now.'}
              </Text>
            </View>
          )}
          {PROFILE_TITLE_CATALOG.map(({ name, meaning, requiredStars }) => {
            const unlocked = availableTitleSet.has(name);
            const active = constellation?.activeTitle === name;
            const status = active ? 'Selected' : unlocked ? 'Unlocked' : 'Locked';

            return (
              <TouchableOpacity
                key={name}
                testID={`profile-title-${name.toLowerCase().replace(/\s+/g, '-')}`}
                accessibilityRole="button"
                accessibilityLabel={`${name}. ${meaning}. ${unlocked ? 'Unlocked' : `Unlock with ${requiredStars} constellation star${requiredStars === 1 ? '' : 's'}`}`}
                accessibilityState={{ disabled: !unlocked || saving, selected: active }}
                onPress={() => onSelect(name)}
                disabled={!unlocked || saving}
                style={[
                  styles.titleRow,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                  active && { backgroundColor: `${colors.gold}18`, borderColor: `${colors.gold}55` },
                  !unlocked && styles.lockedTitleRow,
                ]}
              >
                <View style={styles.titleCopy}>
                  <Text style={[styles.titleText, { color: colors.foreground }]}>{name}</Text>
                  <Text style={[styles.meaningText, { color: colors.mutedForeground }]}>{meaning}</Text>
                  <Text style={[styles.unlockText, { color: unlocked ? colors.primary : colors.mutedForeground }]}>
                    {unlocked
                      ? active ? 'Currently selected' : 'Tap to choose'
                      : `Unlock with ${requiredStars} constellation star${requiredStars === 1 ? '' : 's'}`}
                  </Text>
                </View>
                <View style={[
                  styles.status,
                  {
                    backgroundColor: active ? `${colors.gold}18` : unlocked ? `${colors.primary}18` : colors.card,
                    borderColor: active ? `${colors.gold}55` : colors.border,
                  },
                ]}>
                  {active && <Icon name="check" size={11} color={colors.gold} />}
                  <Text style={[
                    styles.statusText,
                    { color: active ? colors.gold : unlocked ? colors.primary : colors.mutedForeground },
                  ]}>
                    {status}
                  </Text>
                </View>
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
  intro: { fontFamily: 'Satoshi-Regular', fontSize: 13, lineHeight: 18, marginBottom: 2 },
  emptyHint: { borderWidth: 1, borderRadius: 12, padding: 12 },
  emptyHintText: { fontFamily: 'Satoshi-Medium', fontSize: 12, lineHeight: 17 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  lockedTitleRow: { opacity: 0.88 },
  titleCopy: { flex: 1, minWidth: 0, gap: 3 },
  titleText: { fontFamily: 'Satoshi-Bold', fontSize: 14 },
  meaningText: { fontFamily: 'Satoshi-Regular', fontSize: 12, lineHeight: 16 },
  unlockText: { fontFamily: 'Satoshi-Medium', fontSize: 11, marginTop: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusText: { fontFamily: 'Satoshi-Bold', fontSize: 9, textTransform: 'uppercase' },
});
