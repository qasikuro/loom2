import { Icon } from '@/components/Icon';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { persistImageUri } from '@/utils/persistImage';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import type { StoryPanel } from '@/context/AppContext';

interface MangaPanelEditorProps {
  panel: StoryPanel;
  index: number;
  total: number;
  onChange: (updated: StoryPanel) => void;
  onDelete: () => void;
}

export function MangaPanelEditor({ panel, index, total, onChange, onDelete }: MangaPanelEditorProps) {
  const colors = useColors();

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const persisted = await persistImageUri(result.assets[0].uri);
      onChange({ ...panel, imageUri: persisted });
    }
  }

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }, SHADOW.xs]}>
      {/* Panel header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.panelNumRow}>
          <View style={[styles.panelNum, { backgroundColor: `${colors.primary}12` }]}>
            <Text style={[styles.panelNumText, { color: colors.primary }]}>{index + 1}</Text>
          </View>
          <Text style={[styles.panelLabel, { color: colors.mutedForeground }]}>Panel {index + 1}</Text>
        </View>
        {total > 1 && (
          <TouchableOpacity
            onPress={onDelete}
            style={[styles.deleteBtn, { backgroundColor: `${colors.destructive}0F` }]}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon name="trash-2" size={13} color={colors.destructive} />
          </TouchableOpacity>
        )}
      </View>

      {/* Image area */}
      <TouchableOpacity
        style={[
          styles.imageArea,
          {
            backgroundColor: panel.imageUri ? 'transparent' : colors.muted,
            borderColor: panel.imageUri ? 'transparent' : colors.border,
            borderStyle: panel.imageUri ? 'solid' : 'dashed',
          },
        ]}
        onPress={pickImage}
        activeOpacity={0.8}
      >
        {panel.imageUri ? (
          <>
            <Image source={{ uri: panel.imageUri }} style={styles.panelImage} resizeMode="cover" />
            <View style={styles.imageEditOverlay}>
              <View style={[styles.editChip, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
                <Icon name="camera" size={12} color="#1E1830" />
                <Text style={[styles.editChipText, { color: '#1E1830' }]}>Change photo</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.imagePlaceholder}>
            <View style={[styles.cameraIconBg, { backgroundColor: `${colors.primary}12` }]}>
              <Icon name="image" size={28} color={`${colors.primary}90`} />
            </View>
            <Text style={[styles.placeholderTitle, { color: colors.mutedForeground }]}>Add panel image</Text>
            <Text style={[styles.placeholderSub, { color: `${colors.mutedForeground}80` }]}>Tap to choose from gallery</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Narration text */}
      <View style={[styles.textSection, { borderTopColor: colors.border }]}>
        <Text style={[styles.textLabel, { color: colors.mutedForeground }]}>NARRATION</Text>
        <TextInput
          style={[
            styles.textInput,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
          ]}
          placeholder="Write what happens in this panel..."
          placeholderTextColor={`${colors.mutedForeground}70`}
          value={panel.text}
          onChangeText={t => onChange({ ...panel, text: t })}
          multiline
          textAlignVertical="top"
          returnKeyType="default"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  panelNumRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelNum: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  panelNumText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  panelLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  deleteBtn: { padding: 7, borderRadius: 9 },
  imageArea: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderTopWidth: 0,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  panelImage: { width: '100%', height: '100%' },
  imageEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 14,
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  editChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cameraIconBg: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  placeholderTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  placeholderSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  textSection: {
    padding: 14,
    gap: 9,
    borderTopWidth: 1,
  },
  textLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, textTransform: 'uppercase' },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    minHeight: 90,
    fontStyle: 'italic',
  },
});
