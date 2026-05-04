import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MoodBadge } from '@/components/MoodBadge';
import { useColors } from '@/hooks/useColors';
import type { JournalEntry } from '@/context/AppContext';

interface JournalCardProps {
  entry: JournalEntry;
  onDelete?: () => void;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// ── Diary card ─────────────────────────────────────────────────────────────
function DiaryCard({ entry, onDelete }: JournalCardProps) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: `${colors.primary}60`, borderLeftWidth: 3 }]}>
      <View style={styles.topRow}>
        <View style={styles.typeRow}>
          <Text style={styles.typeEmoji}>📓</Text>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{formatDate(entry.date)}</Text>
        </View>
        {onDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Feather name="trash-2" size={13} color={`${colors.mutedForeground}70`} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.contentRow}>
        <Text style={[styles.diaryText, { color: colors.foreground }]} numberOfLines={entry.imageUri ? 3 : 5}>
          {entry.text}
        </Text>
        {entry.imageUri && (
          <Image source={{ uri: entry.imageUri }} style={styles.thumb} resizeMode="cover" />
        )}
      </View>
      <MoodBadge mood={entry.mood} size="sm" />
    </View>
  );
}

// ── Friend card ────────────────────────────────────────────────────────────
function FriendCard({ entry, onDelete }: JournalCardProps) {
  const colors = useColors();
  const name = entry.friendName ?? 'Unknown';
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: 'rgba(58,120,184,0.2)', borderLeftColor: '#3A78B8', borderLeftWidth: 3 }]}>
      <View style={styles.topRow}>
        <View style={styles.typeRow}>
          <Text style={styles.typeEmoji}>🤝</Text>
          <Text style={[styles.friendTypeLabel, { color: '#3A78B8' }]}>Friend</Text>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>· {formatDate(entry.date)}</Text>
        </View>
        {onDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Feather name="trash-2" size={13} color={`${colors.mutedForeground}70`} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.friendNameRow}>
        <View style={[styles.friendAvatar, { backgroundColor: 'rgba(58,120,184,0.12)' }]}>
          <Text style={[styles.friendAvatarText, { color: '#3A78B8' }]}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.friendName, { color: colors.foreground }]}>{name}</Text>
      </View>
      {entry.text !== `An encounter with ${name}.` && (
        <Text style={[styles.diaryText, { color: colors.mutedForeground }]} numberOfLines={3}>
          {entry.text}
        </Text>
      )}
      <MoodBadge mood={entry.mood} size="sm" />
    </View>
  );
}

// ── Moment card ────────────────────────────────────────────────────────────
function MomentCard({ entry, onDelete }: JournalCardProps) {
  const colors = useColors();
  return (
    <View style={[styles.card, styles.momentCard, { borderColor: 'rgba(88,72,168,0.2)', borderLeftColor: '#5848A8', borderLeftWidth: 3 }]}>
      <View style={[styles.momentBg, { backgroundColor: '#1A1630' }]}>
        <View style={styles.topRow}>
          <View style={styles.typeRow}>
            <Text style={styles.typeEmoji}>🌙</Text>
            <Text style={[styles.momentTypeLabel]}>Moment</Text>
            <Text style={styles.momentDate}> · {formatDate(entry.date)}</Text>
          </View>
          {onDelete && (
            <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Feather name="trash-2" size={13} color="rgba(200,184,232,0.35)" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.momentText} numberOfLines={5}>{entry.text}</Text>
        <MoodBadge mood={entry.mood} size="sm" />
      </View>
    </View>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────
export function JournalCard(props: JournalCardProps) {
  if (props.entry.type === 'friend') return <FriendCard {...props} />;
  if (props.entry.type === 'moment') return <MomentCard {...props} />;
  return <DiaryCard {...props} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  momentCard: { padding: 0, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typeEmoji: { fontSize: 14 },
  dateText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  friendTypeLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.2 },
  contentRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  diaryText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, fontStyle: 'italic' },
  thumb: { width: 70, height: 86, borderRadius: 10, flexShrink: 0 },
  // Friend
  friendNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  friendName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  // Moment
  momentBg: { padding: 14, gap: 8 },
  momentTypeLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: 'rgba(200,184,232,0.7)', letterSpacing: 0.2 },
  momentDate: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.45)' },
  momentText: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 23, color: 'rgba(240,234,248,0.85)' },
});
