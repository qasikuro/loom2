import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import {
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
  { label: 'Warm',      icon: 'sun'     as const, color: '#C8A84B' },
  { label: 'Peaceful',  icon: 'cloud'   as const, color: '#78A8C8' },
  { label: 'Grateful',  icon: 'heart'   as const, color: '#C870A0' },
  { label: 'Quiet',     icon: 'moon'    as const, color: '#7090C0' },
  { label: 'Joyful',    icon: 'smile'   as const, color: '#60A878' },
  { label: 'Nostalgic', icon: 'feather' as const, color: '#9888C0' },
];

const FRIEND_SUGGESTIONS = [
  'Lumière', 'Yoru', 'Sol', 'Mira', 'Kael', 'Noctis',
];

export default function CreateFriendLogScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { addJournalEntry, journalEntries } = useApp();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const [friendName, setFriendName] = useState('');
  const [note, setNote] = useState('');
  const [mood, setMood] = useState('Warm');
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build suggestion list from past friend entries + static suggestions
  const pastFriends = Array.from(
    new Set(journalEntries.filter(e => e.type === 'friend' && e.friendName).map(e => e.friendName!))
  );
  const allSuggestions = Array.from(new Set([...pastFriends, ...FRIEND_SUGGESTIONS]));
  const filtered = friendName.trim()
    ? allSuggestions.filter(s => s.toLowerCase().includes(friendName.toLowerCase()) && s !== friendName)
    : pastFriends.slice(0, 4);

  function handleSave() {
    if (!friendName.trim()) { setError("Enter a friend's name to continue."); return; }
    setError(null);
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addJournalEntry({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      type: 'friend',
      text: note.trim() || `An encounter with ${friendName.trim()}.`,
      mood,
      friendName: friendName.trim(),
    });
    setSaving(false);
    router.back();
  }

  const timesMet = journalEntries.filter(e => e.type === 'friend' && e.friendName === friendName.trim()).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#D8EAF8', '#EEF4F8', '#F8F4EE']} style={[styles.headerGrad, { height: topPad + 70 }]} />

      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <BackButton style={[styles.iconBtn, { backgroundColor: colors.muted }]} iconName="x" size={18} color={colors.foreground} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>🤝</Text>
          <Text style={[styles.headerTitle, { color: '#3A78B8' }]}>{t('journal.friendEncounterTitle')}</Text>
          <View style={[styles.privatePill, { backgroundColor: 'rgba(58,120,184,0.1)' }]}>
            <Icon name="lock" size={10} color="#3A78B8" />
            <Text style={[styles.privatePillText, { color: '#3A78B8' }]}>{t('common.private')}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : '#3A78B8' }]}
          onPress={handleSave} disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: saving ? colors.mutedForeground : '#fff' }]}>
            {saving ? '...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20} keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* Friend name */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{t('journal.whoDidYouMeet')}</Text>
        <View style={[styles.nameRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.nameAvatar, { backgroundColor: friendName ? 'rgba(58,120,184,0.15)' : colors.muted }]}>
            <Text style={[styles.nameAvatarText, { color: friendName ? '#3A78B8' : colors.mutedForeground }]}>
              {friendName ? friendName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <TextInput
            style={[styles.nameInput, { color: colors.foreground }]}
            placeholder="Friend's name or Sky ID..."
            placeholderTextColor={colors.mutedForeground}
            value={friendName}
            onChangeText={t => { setFriendName(t); setShowSuggestions(true); if (error) setError(null); }}
            onFocus={() => setShowSuggestions(true)}
            returnKeyType="done"
            onSubmitEditing={() => setShowSuggestions(false)}
          />
          {friendName.length > 0 && (
            <TouchableOpacity onPress={() => setFriendName('')}>
              <Icon name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Past friends / suggestions */}
        {showSuggestions && filtered.length > 0 && (
          <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {filtered.slice(0, 5).map(name => {
              const count = journalEntries.filter(e => e.type === 'friend' && e.friendName === name).length;
              return (
                <TouchableOpacity key={name} style={styles.suggItem}
                  onPress={() => { setFriendName(name); setShowSuggestions(false); }}>
                  <View style={[styles.suggAvatar, { backgroundColor: 'rgba(58,120,184,0.12)' }]}>
                    <Text style={[styles.suggAvatarText, { color: '#3A78B8' }]}>{name.charAt(0)}</Text>
                  </View>
                  <Text style={[styles.suggName, { color: colors.foreground }]}>{name}</Text>
                  {count > 0 && (
                    <Text style={[styles.suggCount, { color: colors.mutedForeground }]}>met {count}×</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Times met badge */}
        {friendName.trim() && timesMet > 0 && (
          <View style={[styles.metBadge, { backgroundColor: 'rgba(58,120,184,0.1)', borderColor: 'rgba(58,120,184,0.25)' }]}>
            <Text style={{ fontSize: 14 }}>✨</Text>
            <Text style={[styles.metBadgeText, { color: '#3A78B8' }]}>
              You've logged {timesMet} encounter{timesMet !== 1 ? 's' : ''} with {friendName.trim()} before
            </Text>
          </View>
        )}

        {/* Note */}
        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>{t('journal.whatHappened')}</Text>
        <TextInput
          style={[styles.noteInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="We flew above the clouds together... or just a brief glance and a wave."
          placeholderTextColor={`${colors.mutedForeground}70`}
          value={note}
          onChangeText={setNote}
          multiline
          textAlignVertical="top"
        />

        {/* Mood */}
        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>{t('journal.howDidItFeel')}</Text>
        <View style={styles.moodGrid}>
          {MOODS.map(m => (
            <TouchableOpacity key={m.label}
              style={[styles.moodChip, {
                backgroundColor: mood === m.label ? `${m.color}22` : `${m.color}0E`,
                borderColor: mood === m.label ? `${m.color}65` : `${m.color}22`,
                borderWidth: mood === m.label ? 1.5 : 1,
              }]}
              onPress={() => { setMood(m.label); Haptics.selectionAsync(); }}
            >
              <Icon name={m.icon} size={14} color={m.color} />
              <Text style={[styles.moodChipText, { color: m.color }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inline validation error */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
            <Icon name="alert-circle" size={14} color="#DC2626" />
            <Text style={[styles.errorText, { color: '#DC2626' }]}>{error}</Text>
          </View>
        )}

        <View style={[styles.privateNote, { backgroundColor: 'rgba(58,120,184,0.07)', borderColor: 'rgba(58,120,184,0.15)' }]}>
          <Icon name="lock" size={12} color="rgba(58,120,184,0.6)" />
          <Text style={[styles.privateNoteText, { color: colors.mutedForeground }]}>
            Friend encounters are always private — only you can see them.
          </Text>
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
  headerCenter: { alignItems: 'center', gap: 2 },
  headerEmoji: { fontSize: 20 },
  headerTitle: { fontSize: 15, fontFamily: 'Satoshi-Bold' },
  privatePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  privatePillText: { fontSize: 10, fontFamily: 'Satoshi-Medium' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20 },
  saveBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  scroll: { paddingHorizontal: 18, paddingTop: 4 },
  label: { fontSize: 11, fontFamily: 'Satoshi-Medium', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  nameAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nameAvatarText: { fontSize: 16, fontFamily: 'Satoshi-Bold' },
  nameInput: { flex: 1, fontSize: 16, fontFamily: 'Satoshi-Regular' },
  suggestions: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: 4, marginBottom: 4 },
  suggItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  suggAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  suggAvatarText: { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  suggName: { flex: 1, fontSize: 14, fontFamily: 'Satoshi-Medium' },
  suggCount: { fontSize: 11, fontFamily: 'Satoshi-Regular' },
  metBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8 },
  metBadgeText: { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular' },
  noteInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15, fontFamily: 'Satoshi-Regular', lineHeight: 24, minHeight: 110, fontStyle: 'italic', marginBottom: 4 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  moodChipText: { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  privateNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  privateNoteText: { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Regular', lineHeight: 18, fontStyle: 'italic' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Medium' },
});
