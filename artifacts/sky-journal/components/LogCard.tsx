import { Icon } from '@/components/Icon';
import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MoodBadge } from '@/components/MoodBadge';
import { useColors } from '@/hooks/useColors';
import type { JournalEntry } from '@/context/AppContext';

interface LogCardProps {
  entry: JournalEntry;
  onPress?: () => void;
  onDelete?: () => void;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function DiaryCard({ entry, onPress, onDelete }: LogCardProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.87}
    >
      {entry.imageUri && (
        <View style={styles.coverWrap}>
          <Image source={{ uri: entry.imageUri }} style={styles.coverImg} contentFit="cover" cachePolicy="memory-disk" />
          <View style={styles.coverOverlay} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Icon name="book" size={10} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>Diary · {formatDate(entry.date)}</Text>
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={{ marginLeft: 'auto' }} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Icon name="trash-2" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        {entry.text.length > 0 && (
          <Text style={[styles.snippet, { color: colors.foreground }]} numberOfLines={3}>{entry.text}</Text>
        )}
        <View style={styles.footer}>
          <MoodBadge mood={entry.mood} size="sm" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FriendCard({ entry, onPress, onDelete }: LogCardProps) {
  const colors = useColors();
  const friendName = entry.friendName ?? 'Unknown';
  return (
    <TouchableOpacity
      style={[styles.card, styles.friendCard, { backgroundColor: colors.card, borderColor: '#4878A820', borderLeftWidth: 3, borderLeftColor: '#4878A8' }]}
      onPress={onPress}
      activeOpacity={0.87}
    >
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={{ fontSize: 14 }}>🤝</Text>
          <Text style={[styles.friendLogLabel, { color: '#4878A8' }]}>Friend Log</Text>
          <Icon name="calendar" size={10} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{formatDate(entry.date)}</Text>
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={{ marginLeft: 'auto' }} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Icon name="trash-2" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.friendNameRow}>
          <View style={[styles.friendAvatar, { backgroundColor: 'rgba(72,120,168,0.15)' }]}>
            <Text style={[styles.friendAvatarText, { color: '#4878A8' }]}>{friendName.charAt(0)}</Text>
          </View>
          <View>
            <Text style={[styles.friendName, { color: colors.foreground }]}>{friendName}</Text>
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>encounter recorded</Text>
          </View>
        </View>
        {entry.text.length > 0 && (
          <Text style={[styles.snippet, { color: colors.mutedForeground }]} numberOfLines={2}>{entry.text}</Text>
        )}
        <View style={styles.footer}>
          <MoodBadge mood={entry.mood} size="sm" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MomentCard({ entry, onPress, onDelete }: LogCardProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.card, styles.momentCard, { borderColor: 'rgba(104,88,168,0.2)', borderLeftWidth: 3, borderLeftColor: '#6858A8' }]}
      onPress={onPress}
      activeOpacity={0.87}
    >
      <View style={[styles.momentHeader, { backgroundColor: '#1A1630' }]}>
        <Text style={{ fontSize: 16 }}>🌙</Text>
        <Text style={[styles.momentLabel, { color: 'rgba(200,184,232,0.7)' }]}>Moment · {formatDate(entry.date)}</Text>
        {onDelete && (
          <TouchableOpacity onPress={onDelete} style={{ marginLeft: 'auto' }} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Icon name="trash-2" size={13} color="rgba(200,184,232,0.4)" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.body}>
        {entry.text.length > 0 && (
          <Text style={[styles.momentText, { color: colors.foreground }]} numberOfLines={4}>{entry.text}</Text>
        )}
        <View style={styles.footer}>
          <MoodBadge mood={entry.mood} size="sm" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function LogCard(props: LogCardProps) {
  const type = props.entry.type;
  if (type === 'friend') return <FriendCard {...props} />;
  if (type === 'moment') return <MomentCard {...props} />;
  return <DiaryCard {...props} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  friendCard: { borderRadius: 14 },
  momentCard: { borderRadius: 14, backgroundColor: '#FAFAF8' },
  coverWrap: { width: '100%', height: 190, position: 'relative' },
  coverImg: { width: '100%', height: '100%' },
  coverOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: 'transparent' },
  body: { padding: 14, gap: 7 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontFamily: 'Satoshi-Regular' },
  snippet: { fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 20, fontStyle: 'italic' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  friendLogLabel: { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 0.2 },
  friendNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { fontSize: 16, fontFamily: 'Satoshi-Bold' },
  friendName: { fontSize: 16, fontFamily: 'Satoshi-Bold' },
  momentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  momentLabel: { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  momentText: { fontSize: 15, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 24 },
});
