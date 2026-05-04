import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const VIBE_TAGS = [
  { label: 'Casual', color: '#78A8C8' },
  { label: 'Formal', color: '#6B5B95' },
  { label: 'Dreamy', color: '#9888C0' },
  { label: 'Adventure', color: '#60A878' },
  { label: 'Cozy', color: '#C8A84B' },
  { label: 'Dark', color: '#504070' },
  { label: 'Soft', color: '#C870A0' },
  { label: 'Ethereal', color: '#78C8C8' },
];

export default function CreateOutfitScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addOutfit } = useApp();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  }

  function toggleTag(tag: string) {
    Haptics.selectionAsync();
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function handleSave() {
    if (!name.trim()) { Alert.alert('Give your outfit a name.'); return; }
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addOutfit({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      name: name.trim(),
      description: description.trim(),
      imageUri,
      tags: selectedTags,
      isPublic,
    });
    setSaving(false);
    router.back();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#E8E0F4', '#F8F4EE']} style={[styles.headerGrad, { height: topPad + 70 }]} />

      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Feather name="x" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Log Outfit</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
          onPress={handleSave} disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: saving ? colors.mutedForeground : '#fff' }]}>
            {saving ? '...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* Image picker — tall portrait */}
        <TouchableOpacity
          style={[styles.imagePicker, {
            backgroundColor: imageUri ? 'transparent' : colors.muted,
            borderColor: imageUri ? 'transparent' : colors.border,
          }]}
          onPress={pickImage} activeOpacity={0.8}
        >
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.outfitImage} resizeMode="cover" />
              <View style={styles.changeOverlay}>
                <View style={[styles.changeChip, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                  <Feather name="camera" size={13} color={colors.foreground} />
                  <Text style={[styles.changeChipText, { color: colors.foreground }]}>Change photo</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.imagePlaceholder}>
              <View style={[styles.cameraCircle, { backgroundColor: `${colors.primary}15` }]}>
                <Feather name="camera" size={28} color={`${colors.primary}80`} />
              </View>
              <Text style={[styles.imagePlaceholderTitle, { color: colors.mutedForeground }]}>Add outfit photo</Text>
              <Text style={[styles.imagePlaceholderSub, { color: `${colors.mutedForeground}70` }]}>Optional · Portrait works best</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Name */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Outfit name</Text>
          <TextInput
            style={[styles.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="e.g. Starlight Cape · Dawn Cloak..."
            placeholderTextColor={`${colors.mutedForeground}80`}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.descInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="Where did you wear this? What does it feel like?"
            placeholderTextColor={`${colors.mutedForeground}70`}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Tags */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Vibe tags</Text>
          <View style={styles.tagsGrid}>
            {VIBE_TAGS.map(t => {
              const active = selectedTags.includes(t.label);
              return (
                <TouchableOpacity key={t.label}
                  style={[styles.tagChip, {
                    backgroundColor: active ? `${t.color}22` : `${t.color}0E`,
                    borderColor: active ? `${t.color}65` : `${t.color}22`,
                    borderWidth: active ? 1.5 : 1,
                  }]}
                  onPress={() => toggleTag(t.label)}
                >
                  <Text style={[styles.tagText, { color: t.color }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Visibility */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Visibility</Text>
          <View style={styles.privacyRow}>
            {(['Private', 'Public'] as const).map(opt => {
              const active = opt === 'Private' ? !isPublic : isPublic;
              return (
                <TouchableOpacity key={opt}
                  style={[styles.privBtn, {
                    backgroundColor: active ? `${colors.primary}15` : colors.muted,
                    borderColor: active ? `${colors.primary}40` : colors.border,
                    borderWidth: active ? 1.5 : 1,
                  }]}
                  onPress={() => setIsPublic(opt === 'Public')}
                >
                  <Feather name={opt === 'Private' ? 'lock' : 'globe'} size={13} color={active ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.privText, { color: active ? colors.primary : colors.mutedForeground }]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 18, paddingTop: 0, gap: 0 },
  imagePicker: { width: '100%', aspectRatio: 3 / 4, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden', marginBottom: 20 },
  outfitImage: { width: '100%', height: '100%' },
  changeOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 16 },
  changeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  changeChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  cameraCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderTitle: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  imagePlaceholderSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 },
  nameInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: 'Inter_400Regular' },
  descInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, minHeight: 90 },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tagText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  privacyRow: { flexDirection: 'row', gap: 10 },
  privBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  privText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
