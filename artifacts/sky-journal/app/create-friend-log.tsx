import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
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

const MOODS = [
  { label: 'Warm', icon: 'sun' as const, color: '#C8A84B' },
  { label: 'Peaceful', icon: 'cloud' as const, color: '#78A8C8' },
  { label: 'Grateful', icon: 'heart' as const, color: '#C870A0' },
  { label: 'Quiet', icon: 'moon' as const, color: '#7090C0' },
  { label: 'Joyful', icon: 'smile' as const, color: '#60A878' },
  { label: 'Nostalgic', icon: 'feather' as const, color: '#9888C0' },
];

export default function CreateFriendLogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addLog, addOrUpdateFriend, friends } = useApp();

  const [friendName, setFriendName] = useState('');
  const [note, setNote] = useState('');
  const [selectedMood, setSelectedMood] = useState('Warm');
  const [isPublic, setIsPublic] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const suggestions = friends.filter(f =>
    friendName.length > 0 && f.name.toLowerCase().includes(friendName.toLowerCase())
  );

  function handlePost() {
    if (!friendName.trim()) { Alert.alert('Missing name', 'Who did you encounter?'); return; }
    setPosting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const panelText = note.trim() || `A quiet moment with ${friendName.trim()}.`;

    addLog({
      id,
      date: new Date().toISOString(),
      chapterTitle: `With ${friendName.trim()}`,
      panels: [{ id: id + '_p', text: panelText }],
      mood: selectedMood,
      location: 'Sky',
      isPublic,
      witnessedCount: 0,
      savedCount: 0,
      logType: 'friend',
      friendTags: [friendName.trim()],
    });

    addOrUpdateFriend(friendName.trim(), note.trim() || undefined);

    setPosting(false);
    router.push('/(tabs)/log');
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#D8E8F8', '#F0F4F8', '#F8F4EE']} style={[styles.headerGrad, { height: topPad + 80 }]} />

      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: 'rgba(72,120,168,0.12)' }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color="#4878A8" />
        </TouchableOpacity>
        <View style={styles.typePill}>
          <Text style={styles.typeEmoji}>🤝</Text>
          <Text style={[styles.typeTitle, { color: '#4878A8' }]}>Friend Log</Text>
        </View>
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: posting ? colors.muted : '#4878A8' }]}
          onPress={handlePost} disabled={posting}
        >
          <Text style={[styles.postBtnText, { color: posting ? colors.mutedForeground : '#fff' }]}>
            {posting ? '...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>

        {/* Friend name */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            <Feather name="user" size={12} color={colors.mutedForeground} />  Who did you meet?
          </Text>
          <View style={[styles.nameInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="users" size={16} color="#4878A8" />
            <TextInput
              style={[styles.nameInput, { color: colors.foreground }]}
              placeholder="Friend's name or Sky ID..."
              placeholderTextColor={colors.mutedForeground}
              value={friendName}
              onChangeText={t => { setFriendName(t); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              returnKeyType="done"
            />
            {friendName.length > 0 && (
              <TouchableOpacity onPress={() => setFriendName('')}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {suggestions.map(f => (
                <TouchableOpacity key={f.id} style={styles.suggestionItem}
                  onPress={() => { setFriendName(f.name); setShowSuggestions(false); }}>
                  <View style={[styles.suggAvatar, { backgroundColor: 'rgba(72,120,168,0.15)' }]}>
                    <Text style={[styles.suggAvatarText, { color: '#4878A8' }]}>{f.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.suggInfo}>
                    <Text style={[styles.suggName, { color: colors.foreground }]}>{f.name}</Text>
                    <Text style={[styles.suggMeta, { color: colors.mutedForeground }]}>
                      Met {f.timesMet} time{f.timesMet !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Feather name="corner-down-left" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Note about the encounter */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            <Feather name="edit-3" size={12} color={colors.mutedForeground} />  What happened?
          </Text>
          <TextInput
            style={[styles.noteInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="We flew together above the clouds... or just a brief glance and a nod."
            placeholderTextColor={`${colors.mutedForeground}80`}
            value={note}
            onChangeText={setNote}
            multiline
            textAlignVertical="top"
          />
          <Text style={[styles.noteHint, { color: `${colors.mutedForeground}70` }]}>
            Optional — this gets saved to your friend memory history
          </Text>
        </View>

        {/* Mood */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            <Feather name="smile" size={12} color={colors.mutedForeground} />  How did it feel?
          </Text>
          <View style={styles.moodGrid}>
            {MOODS.map(m => (
              <TouchableOpacity key={m.label}
                style={[styles.moodChip, {
                  backgroundColor: selectedMood === m.label ? `${m.color}25` : `${m.color}10`,
                  borderColor: selectedMood === m.label ? `${m.color}60` : `${m.color}25`,
                  borderWidth: selectedMood === m.label ? 1.5 : 1,
                }]}
                onPress={() => { setSelectedMood(m.label); Haptics.selectionAsync(); }}>
                <Feather name={m.icon} size={14} color={m.color} />
                <Text style={[styles.moodChipText, { color: m.color }]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Visibility</Text>
          <View style={styles.privacyRow}>
            {(['Private', 'Public'] as const).map(opt => {
              const active = opt === 'Private' ? !isPublic : isPublic;
              return (
                <TouchableOpacity key={opt}
                  style={[styles.privBtn, {
                    backgroundColor: active ? 'rgba(72,120,168,0.15)' : colors.muted,
                    borderColor: active ? 'rgba(72,120,168,0.4)' : colors.border,
                    borderWidth: active ? 1.5 : 1,
                  }]}
                  onPress={() => setIsPublic(opt === 'Public')}>
                  <Feather name={opt === 'Private' ? 'lock' : 'globe'} size={13} color={active ? '#4878A8' : colors.mutedForeground} />
                  <Text style={[styles.privText, { color: active ? '#4878A8' : colors.mutedForeground }]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity style={[styles.submitBtn, { opacity: posting ? 0.7 : 1 }]} onPress={handlePost} disabled={posting}>
          <LinearGradient colors={['#5888B8', '#4878A8', '#2A5888']} style={styles.submitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Feather name="bookmark" size={16} color="#fff" />
            <Text style={styles.submitText}>{posting ? 'Saving...' : 'Save Friend Memory'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeEmoji: { fontSize: 18 },
  typeTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  postBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20 },
  postBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 18, paddingTop: 4, gap: 0 },
  section: { marginBottom: 22, gap: 8 },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 },
  nameInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  nameInput: { flex: 1, fontSize: 16, fontFamily: 'Inter_400Regular' },
  suggestions: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: 2 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  suggAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  suggAvatarText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  suggInfo: { flex: 1, gap: 1 },
  suggName: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  suggMeta: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  noteInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 24, minHeight: 120, fontStyle: 'italic' },
  noteHint: { fontSize: 11, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  moodChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  privacyRow: { flexDirection: 'row', gap: 10 },
  privBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  privText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  submitBtn: { borderRadius: 30, overflow: 'hidden', marginBottom: 8 },
  submitGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  submitText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
