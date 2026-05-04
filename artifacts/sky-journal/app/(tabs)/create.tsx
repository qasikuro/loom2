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
  ScrollView,
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

const LOCATIONS = [
  'Daylight Prairie',
  'Hidden Forest',
  'Valley of Triumph',
  'Golden Wasteland',
  'Isle of Dawn',
  'Eye of Eden',
  'Vault of Knowledge',
  'Aviary Village',
];

const MOODS = [
  { label: 'Hopeful', icon: 'sun' as const, color: '#C8A84B' },
  { label: 'Lonely', icon: 'moon' as const, color: '#7090C0' },
  { label: 'Peaceful', icon: 'cloud' as const, color: '#78A8C8' },
  { label: 'Romantic', icon: 'heart' as const, color: '#C870A0' },
  { label: 'Chaotic', icon: 'zap' as const, color: '#D0784A' },
  { label: 'Dreamy', icon: 'star' as const, color: '#8B6BA8' },
  { label: 'Soft', icon: 'feather' as const, color: '#9888C0' },
  { label: 'Adventurous', icon: 'wind' as const, color: '#60A878' },
];

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addLog } = useApp();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [storyText, setStoryText] = useState('');
  const [selectedMood, setSelectedMood] = useState('Hopeful');
  const [selectedLocation, setSelectedLocation] = useState('Daylight Prairie');
  const [isPublic, setIsPublic] = useState(true);
  const [showLocations, setShowLocations] = useState(false);
  const [posting, setPosting] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  function handlePost() {
    if (!chapterTitle.trim()) {
      Alert.alert('Missing title', 'Please give your chapter a title.');
      return;
    }
    if (!storyText.trim()) {
      Alert.alert('Missing story', 'Please write something in your log.');
      return;
    }
    setPosting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    addLog({
      id,
      date: new Date().toISOString(),
      chapterTitle: chapterTitle.trim(),
      storyText: storyText.trim(),
      mood: selectedMood,
      location: selectedLocation,
      imageUri: imageUri ?? undefined,
      isPublic,
      witnessedCount: 0,
      savedCount: 0,
      vibeTag: selectedMood,
    });

    setPosting(false);
    setChapterTitle('');
    setStoryText('');
    setImageUri(null);
    setSelectedMood('Hopeful');
    setIsPublic(true);
    router.push('/(tabs)/log');
  }

  const currentMoodColor = MOODS.find(m => m.label === selectedMood)?.color ?? colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#EDE8F8', '#F8F4EE']}
        style={[styles.headerGrad, { height: topPad + 70 }]}
      />

      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.muted }]}
          onPress={() => router.back()}
        >
          <Feather name="x" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>New Log</Text>
        <TouchableOpacity
          style={[styles.checkBtn, { backgroundColor: posting ? colors.muted : colors.primary }]}
          onPress={handlePost}
          disabled={posting}
        >
          <Feather name="check" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* Image Upload */}
        <TouchableOpacity
          style={[
            styles.imageUpload,
            {
              backgroundColor: colors.muted,
              borderColor: colors.border,
              borderStyle: imageUri ? 'solid' : 'dashed',
            },
          ]}
          onPress={pickImage}
          activeOpacity={0.8}
        >
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.uploadedImage} resizeMode="cover" />
              <View style={styles.imageOverlay}>
                <View style={[styles.changeImgBtn, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                  <Feather name="camera" size={14} color={colors.foreground} />
                  <Text style={[styles.changeImgText, { color: colors.foreground }]}>Edit Image</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <View style={[styles.uploadIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Feather name="camera" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.uploadText, { color: colors.mutedForeground }]}>Tap to add image</Text>
              <Text style={[styles.uploadSub, { color: `${colors.mutedForeground}80` }]}>Optional</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Chapter Title */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Chapter Title</Text>
          <TextInput
            style={[
              styles.input,
              { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
            ]}
            placeholder="The day I found a new hope"
            placeholderTextColor={colors.mutedForeground}
            value={chapterTitle}
            onChangeText={setChapterTitle}
            returnKeyType="next"
          />
        </View>

        {/* Location & Mood Row */}
        <View style={styles.twoCol}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Location</Text>
            <TouchableOpacity
              style={[styles.select, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => setShowLocations(!showLocations)}
            >
              <Feather name="map-pin" size={13} color={colors.primary} />
              <Text style={[styles.selectText, { color: colors.foreground }]} numberOfLines={1}>
                {selectedLocation}
              </Text>
              <Feather name={showLocations ? 'chevron-up' : 'chevron-down'} size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Mood</Text>
            <View style={[styles.moodDisplay, { borderColor: `${currentMoodColor}40`, backgroundColor: `${currentMoodColor}12` }]}>
              <Feather
                name={MOODS.find(m => m.label === selectedMood)?.icon ?? 'sun'}
                size={13}
                color={currentMoodColor}
              />
              <Text style={[styles.selectText, { color: currentMoodColor }]}>{selectedMood}</Text>
            </View>
          </View>
        </View>

        {/* Location Dropdown */}
        {showLocations && (
          <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {LOCATIONS.map(loc => (
              <TouchableOpacity
                key={loc}
                style={[
                  styles.dropdownItem,
                  selectedLocation === loc && { backgroundColor: `${colors.primary}12` },
                ]}
                onPress={() => { setSelectedLocation(loc); setShowLocations(false); }}
              >
                <Feather
                  name="map-pin"
                  size={12}
                  color={selectedLocation === loc ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.dropdownText,
                    { color: selectedLocation === loc ? colors.primary : colors.foreground },
                  ]}
                >
                  {loc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Mood Selector */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Select Mood</Text>
          <View style={styles.moodGrid}>
            {MOODS.map(mood => (
              <TouchableOpacity
                key={mood.label}
                style={[
                  styles.moodOption,
                  {
                    backgroundColor:
                      selectedMood === mood.label ? `${mood.color}25` : `${mood.color}10`,
                    borderColor:
                      selectedMood === mood.label ? `${mood.color}60` : `${mood.color}25`,
                    borderWidth: selectedMood === mood.label ? 1.5 : 1,
                  },
                ]}
                onPress={() => {
                  setSelectedMood(mood.label);
                  Haptics.selectionAsync();
                }}
              >
                <Feather name={mood.icon} size={16} color={mood.color} />
                <Text style={[styles.moodOptionText, { color: mood.color }]}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Story Text */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Write your story...</Text>
          <TextInput
            style={[
              styles.textArea,
              { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
            ]}
            placeholder="Today, I followed a little bird of light. It led me to a place I had never seen before..."
            placeholderTextColor={colors.mutedForeground}
            value={storyText}
            onChangeText={setStoryText}
            multiline
            textAlignVertical="top"
            returnKeyType="default"
          />
        </View>

        {/* Post To */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Post to</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                {
                  backgroundColor: !isPublic ? colors.muted : `${colors.primary}18`,
                  borderColor: !isPublic ? colors.border : `${colors.primary}40`,
                  borderWidth: !isPublic ? 1 : 1.5,
                },
              ]}
              onPress={() => setIsPublic(false)}
            >
              <Feather
                name="lock"
                size={14}
                color={!isPublic ? colors.mutedForeground : colors.primary}
              />
              <Text
                style={[
                  styles.toggleText,
                  { color: !isPublic ? colors.mutedForeground : colors.primary },
                ]}
              >
                Private
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                {
                  backgroundColor: isPublic ? `${colors.primary}18` : colors.muted,
                  borderColor: isPublic ? `${colors.primary}40` : colors.border,
                  borderWidth: isPublic ? 1.5 : 1,
                },
              ]}
              onPress={() => setIsPublic(true)}
            >
              <Feather
                name="globe"
                size={14}
                color={isPublic ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.toggleText,
                  { color: isPublic ? colors.primary : colors.mutedForeground },
                ]}
              >
                Public
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Post Button */}
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: colors.primary, opacity: posting ? 0.7 : 1 }]}
          onPress={handlePost}
          disabled={posting}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#7B6BA8', '#6B5B95', '#5A4A80']}
            style={styles.postBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Feather name="send" size={16} color="#fff" />
            <Text style={styles.postBtnText}>{posting ? 'Posting...' : 'Post Log'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 20, paddingTop: 4, gap: 0 },
  imageUpload: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 16,
  },
  uploadedImage: { width: '100%', height: '100%' },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  changeImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  changeImgText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  uploadPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  uploadSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  field: { marginBottom: 14, gap: 6 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  selectText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  moodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: -8,
    marginBottom: 14,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dropdownText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  moodOptionText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 140,
    lineHeight: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  postBtn: {
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 8,
  },
  postBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  postBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
