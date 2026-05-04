import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useColors } from '@/hooks/useColors';
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
      onChange({ ...panel, imageUri: result.assets[0].uri });
    }
  }

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      {/* Panel header */}
      <View style={styles.header}>
        <View style={[styles.panelNumBadge, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
          <Text style={[styles.panelNumText, { color: colors.primary }]}>Panel {index + 1}</Text>
        </View>
        {total > 1 && (
          <TouchableOpacity
            onPress={onDelete}
            style={[styles.deleteBtn, { backgroundColor: `${colors.destructive}12` }]}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Feather name="trash-2" size={13} color={colors.destructive} />
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
              <View style={[styles.editChip, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                <Feather name="camera" size={12} color={colors.foreground} />
                <Text style={[styles.editChipText, { color: colors.foreground }]}>Change</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.imagePlaceholder}>
            <View style={[styles.cameraIconBg, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="image" size={26} color={colors.primary} />
            </View>
            <Text style={[styles.placeholderTitle, { color: colors.mutedForeground }]}>Add a panel image</Text>
            <Text style={[styles.placeholderSub, { color: `${colors.mutedForeground}70` }]}>Tap to choose from gallery</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Narration text */}
      <View style={styles.textSection}>
        <View style={styles.textLabelRow}>
          <Feather name="edit-3" size={12} color={colors.mutedForeground} />
          <Text style={[styles.textLabel, { color: colors.mutedForeground }]}>Narration</Text>
        </View>
        <TextInput
          style={[
            styles.textInput,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
          ]}
          placeholder="Write what happens in this panel..."
          placeholderTextColor={`${colors.mutedForeground}80`}
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
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  panelNumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  panelNumText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
  deleteBtn: {
    padding: 7,
    borderRadius: 10,
  },
  imageArea: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  panelImage: {
    width: '100%',
    height: '100%',
  },
  imageEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  editChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cameraIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  placeholderSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  textSection: {
    padding: 14,
    gap: 8,
  },
  textLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  textLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    minHeight: 90,
    fontStyle: 'italic',
  },
});
