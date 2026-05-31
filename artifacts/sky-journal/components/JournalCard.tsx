import { Icon } from '@/components/Icon';
import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MoodBadge } from '@/components/MoodBadge';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import type { JournalEntry } from '@/context/AppContext';

interface JournalCardProps {
  entry:         JournalEntry;
  onDelete?:     () => void;
  theme?:        string;
  stickerCount?: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Theme palettes ──────────────────────────────────────────────────────────
const THEME_STYLES: Record<string, { bg: string; border: string; accentLeft: string }> = {
  theme_locket: {
    bg:          'rgba(200,168,75,0.07)',
    border:      'rgba(200,168,75,0.28)',
    accentLeft:  '#C8A84B',
  },
  theme_aurora: {
    bg:          'rgba(120,180,220,0.07)',
    border:      'rgba(120,180,220,0.28)',
    accentLeft:  '#78B4DC',
  },
};

// ── Diary card ─────────────────────────────────────────────────────────────
function DiaryCard({ entry, onDelete, theme, stickerCount }: JournalCardProps) {
  const colors = useColors();
  const ts = theme ? THEME_STYLES[theme] : null;
  return (
    <View style={[
      styles.card,
      { backgroundColor: ts ? ts.bg : colors.card, borderColor: ts ? ts.border : colors.border },
      SHADOW.sm,
      styles.diaryAccent,
      ts && { borderLeftColor: ts.accentLeft },
    ]}>
      <View style={styles.topRow}>
        <View style={styles.metaLeft}>
          <View style={[styles.typeIcon, { backgroundColor: `${colors.primary}12` }]}>
            <Icon name="book-open" size={12} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.dateText, { color: colors.foreground }]}>{formatDate(entry.date)}</Text>
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{formatTime(entry.date)}</Text>
          </View>
        </View>
        {onDelete && (
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: colors.muted }]}
            onPress={onDelete}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 6 }}
          >
            <Icon name="trash-2" size={12} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.contentRow}>
        <Text style={[styles.diaryText, { color: colors.foreground }]} numberOfLines={entry.imageUri ? 3 : 5}>
          {entry.text}
        </Text>
        {entry.imageUri && (
          <Image source={{ uri: entry.imageUri }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
        )}
      </View>
      <View style={styles.footer}>
        <MoodBadge mood={entry.mood} size="sm" />
        {stickerCount != null && stickerCount > 0 && (
          <View style={styles.stickerBadge}>
            <Text style={styles.stickerBadgeText}>✦ {stickerCount}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Friend card ────────────────────────────────────────────────────────────
function FriendCard({ entry, onDelete, stickerCount }: JournalCardProps) {
  const colors = useColors();
  const name = entry.friendName ?? 'Unknown';
  const friendColor = '#3A78B8';
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: 'rgba(58,120,184,0.18)' }, SHADOW.sm, styles.friendAccent]}>
      <View style={styles.topRow}>
        <View style={styles.metaLeft}>
          <View style={[styles.typeIcon, { backgroundColor: 'rgba(58,120,184,0.1)' }]}>
            <Icon name="users" size={12} color={friendColor} />
          </View>
          <View>
            <Text style={[styles.dateText, { color: colors.foreground }]}>{formatDate(entry.date)}</Text>
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{formatTime(entry.date)}</Text>
          </View>
        </View>
        {onDelete && (
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: colors.muted }]}
            onPress={onDelete}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 6 }}
          >
            <Icon name="trash-2" size={12} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: 'rgba(58,120,184,0.12)' }]} />

      <View style={styles.friendRow}>
        <View style={[styles.friendAvatar, { backgroundColor: 'rgba(58,120,184,0.1)', borderColor: 'rgba(58,120,184,0.2)', borderWidth: 1.5 }]}>
          <Text style={[styles.friendAvatarText, { color: friendColor }]}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.foreground }]}>{name}</Text>
          <Text style={[styles.friendLabel, { color: friendColor }]}>Encounter logged</Text>
        </View>
      </View>

      {entry.text !== `An encounter with ${name}.` && (
        <Text style={[styles.noteText, { color: colors.mutedForeground, borderColor: 'rgba(58,120,184,0.1)', backgroundColor: 'rgba(58,120,184,0.04)' }]} numberOfLines={3}>
          {entry.text}
        </Text>
      )}

      <View style={styles.footer}>
        <MoodBadge mood={entry.mood} size="sm" />
        {stickerCount != null && stickerCount > 0 && (
          <View style={styles.stickerBadge}>
            <Text style={styles.stickerBadgeText}>✦ {stickerCount}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Moment card ────────────────────────────────────────────────────────────
function MomentCard({ entry, onDelete, stickerCount }: JournalCardProps) {
  return (
    <View style={[styles.momentCard, SHADOW.md]}>
      <View style={styles.topRow}>
        <View style={styles.metaLeft}>
          <View style={[styles.typeIcon, { backgroundColor: 'rgba(200,184,232,0.12)' }]}>
            <Icon name="moon" size={12} color="rgba(200,184,232,0.75)" />
          </View>
          <View>
            <Text style={styles.momentDate}>{formatDate(entry.date)}</Text>
            <Text style={styles.momentTime}>{formatTime(entry.date)}</Text>
          </View>
        </View>
        {onDelete && (
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: 'rgba(255,255,255,0.07)' }]}
            onPress={onDelete}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 6 }}
          >
            <Icon name="trash-2" size={12} color="rgba(200,184,232,0.4)" />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: 'rgba(200,184,232,0.12)' }]} />

      <Text style={styles.momentText} numberOfLines={5}>{entry.text}</Text>

      <View style={styles.footer}>
        <MoodBadge mood={entry.mood} size="sm" />
        {stickerCount != null && stickerCount > 0 && (
          <View style={[styles.stickerBadge, { backgroundColor: 'rgba(200,168,75,0.12)', borderColor: 'rgba(200,168,75,0.28)' }]}>
            <Text style={[styles.stickerBadgeText, { color: '#C8A84B' }]}>✦ {stickerCount}</Text>
          </View>
        )}
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

export { THEME_STYLES };

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 0,
  },
  diaryAccent: {
    borderLeftWidth: 3,
    borderLeftColor: '#8060B8',
  },
  friendAccent: {
    borderLeftWidth: 3,
    borderLeftColor: '#4088C8',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  typeIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dateText: { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  timeText: { fontSize: 10, fontFamily: 'Satoshi-Regular', marginTop: 1 },
  deleteBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginBottom: 12 },
  contentRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 10 },
  diaryText: { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 21, fontStyle: 'italic' },
  thumb: { width: 72, height: 88, borderRadius: 11, flexShrink: 0 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  stickerBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
    backgroundColor: 'rgba(200,168,75,0.10)', borderWidth: 1, borderColor: 'rgba(200,168,75,0.25)',
  },
  stickerBadgeText: { fontSize: 10, fontFamily: 'Satoshi-Bold', color: '#C8A84B' },
  // Friend
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  friendAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  friendAvatarText: { fontSize: 15, fontFamily: 'Satoshi-Bold' },
  friendInfo: { gap: 1 },
  friendName: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  friendLabel: { fontSize: 11, fontFamily: 'Satoshi-Medium', letterSpacing: 0.2 },
  noteText: {
    fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 21, fontStyle: 'italic',
    borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10,
  },
  // Moment (deep space card)
  momentCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(200,184,232,0.10)',
    borderLeftWidth: 3,
    borderLeftColor: '#6858B8',
    backgroundColor: '#0C0A20',
    padding: 14,
    marginBottom: 10,
    gap: 0,
    shadowColor: '#9B78FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  momentDate: { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(230,220,255,0.88)' },
  momentTime: { fontSize: 10, fontFamily: 'Satoshi-Regular', marginTop: 1, color: 'rgba(200,184,232,0.40)' },
  momentText: { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 22, color: 'rgba(240,234,255,0.85)', marginBottom: 8 },
});
