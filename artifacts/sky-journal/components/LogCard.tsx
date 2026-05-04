import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MoodBadge } from '@/components/MoodBadge';
import { useColors } from '@/hooks/useColors';
import type { LogEntry } from '@/context/AppContext';

interface LogCardProps {
  entry: LogEntry;
  onPress?: () => void;
  onDelete?: () => void;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ── Memory card ─────────────────────────────────────────────────────────────
function MemoryCard({ entry, onPress, onDelete }: LogCardProps) {
  const colors = useColors();
  const panelImages = entry.panels.filter(p => p.imageUri).slice(0, 1);
  const firstText = entry.panels.find(p => p.text.trim())?.text ?? '';
  const panelCount = entry.panels.length;

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress} activeOpacity={0.87}>
      {/* Cover image */}
      {panelImages.length > 0 ? (
        <View style={styles.coverWrap}>
          <Image source={{ uri: panelImages[0].imageUri }} style={styles.coverImg} resizeMode="cover" />
          <View style={styles.coverOverlay} />
          <View style={[styles.typeBadge, { backgroundColor: 'rgba(26,22,48,0.65)', borderColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.typeBadgeEmoji}>📸</Text>
            <Feather name="layers" size={11} color="rgba(255,255,255,0.8)" />
            <Text style={styles.typeBadgeText}>{panelCount}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.noCoverRow, { backgroundColor: `${colors.primary}10` }]}>
          <Text style={{ fontSize: 16 }}>📸</Text>
          <View style={[styles.panelCountPill, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}25` }]}>
            <Feather name="layers" size={11} color={colors.primary} />
            <Text style={[styles.panelCountText, { color: colors.primary }]}>{panelCount} panel{panelCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}
      {/* Body */}
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Feather name="calendar" size={10} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{formatDate(entry.date)}</Text>
          <Feather name="map-pin" size={10} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{entry.location}</Text>
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={{ marginLeft: 'auto' }} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Feather name="trash-2" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{entry.chapterTitle}</Text>
        {firstText.length > 0 && (
          <Text style={[styles.snippet, { color: colors.mutedForeground }]} numberOfLines={2}>{firstText}</Text>
        )}
        <View style={styles.footer}>
          <MoodBadge mood={entry.mood} size="sm" />
          <View style={styles.statsRow}>
            <Feather name="eye" size={12} color={colors.mutedForeground} />
            <Text style={[styles.statNum, { color: colors.mutedForeground }]}>{entry.witnessedCount}</Text>
            <Feather name="bookmark" size={12} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
            <Text style={[styles.statNum, { color: colors.mutedForeground }]}>{entry.savedCount}</Text>
            {!entry.isPublic && (
              <View style={[styles.privatePill, { backgroundColor: `${colors.primary}12` }]}>
                <Feather name="lock" size={10} color={colors.primary} />
                <Text style={[styles.privateText, { color: colors.primary }]}>Private</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Friend log card ──────────────────────────────────────────────────────────
function FriendCard({ entry, onPress, onDelete }: LogCardProps) {
  const colors = useColors();
  const noteText = entry.panels[0]?.text ?? '';
  const friendName = entry.friendTags?.[0] ?? 'Unknown';

  return (
    <TouchableOpacity
      style={[styles.card, styles.friendCard, { backgroundColor: colors.card, borderColor: '#4878A820', borderLeftWidth: 3, borderLeftColor: '#4878A8' }]}
      onPress={onPress} activeOpacity={0.87}>
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={{ fontSize: 14 }}>🤝</Text>
          <Text style={[styles.friendLogLabel, { color: '#4878A8' }]}>Friend Log</Text>
          <Feather name="calendar" size={10} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{formatDate(entry.date)}</Text>
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={{ marginLeft: 'auto' }} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Feather name="trash-2" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        {/* Friend name display */}
        <View style={styles.friendNameRow}>
          <View style={[styles.friendAvatar, { backgroundColor: 'rgba(72,120,168,0.15)' }]}>
            <Text style={[styles.friendAvatarText, { color: '#4878A8' }]}>{friendName.charAt(0)}</Text>
          </View>
          <View>
            <Text style={[styles.friendName, { color: colors.foreground }]}>{friendName}</Text>
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>encounter recorded</Text>
          </View>
        </View>
        {noteText.length > 0 && (
          <Text style={[styles.snippet, { color: colors.mutedForeground }]} numberOfLines={2}>{noteText}</Text>
        )}
        <View style={styles.footer}>
          <MoodBadge mood={entry.mood} size="sm" />
          {!entry.isPublic && (
            <View style={[styles.privatePill, { backgroundColor: `${colors.primary}12` }]}>
              <Feather name="lock" size={10} color={colors.primary} />
              <Text style={[styles.privateText, { color: colors.primary }]}>Private</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Moment log card ──────────────────────────────────────────────────────────
function MomentCard({ entry, onPress, onDelete }: LogCardProps) {
  const colors = useColors();
  const text = entry.panels[0]?.text ?? '';

  return (
    <TouchableOpacity
      style={[styles.card, styles.momentCard, { borderColor: 'rgba(104,88,168,0.2)', borderLeftWidth: 3, borderLeftColor: '#6858A8' }]}
      onPress={onPress} activeOpacity={0.87}>
      {/* Night gradient header */}
      <View style={[styles.momentHeader, { backgroundColor: '#1A1630' }]}>
        <Text style={{ fontSize: 16 }}>🌙</Text>
        <Text style={[styles.momentLabel, { color: 'rgba(200,184,232,0.7)' }]}>Moment · {formatDate(entry.date)}</Text>
        {onDelete && (
          <TouchableOpacity onPress={onDelete} style={{ marginLeft: 'auto' }} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Feather name="trash-2" size={13} color="rgba(200,184,232,0.4)" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.body}>
        {text.length > 0 && (
          <Text style={[styles.momentText, { color: colors.foreground }]} numberOfLines={4}>{text}</Text>
        )}
        <View style={styles.footer}>
          <MoodBadge mood={entry.mood} size="sm" />
          {!entry.isPublic && (
            <View style={[styles.privatePill, { backgroundColor: `${colors.primary}12` }]}>
              <Feather name="lock" size={10} color={colors.primary} />
              <Text style={[styles.privateText, { color: colors.primary }]}>Private</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────
export function LogCard(props: LogCardProps) {
  const type = props.entry.logType ?? 'memory';
  if (type === 'friend') return <FriendCard {...props} />;
  if (type === 'moment') return <MomentCard {...props} />;
  return <MemoryCard {...props} />;
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
  typeBadge: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1,
  },
  typeBadgeEmoji: { fontSize: 12 },
  typeBadgeText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontFamily: 'Inter_500Medium' },
  noCoverRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  panelCountPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  panelCountText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  body: { padding: 14, gap: 7 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold', lineHeight: 23 },
  snippet: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, fontStyle: 'italic' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNum: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  privatePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  privateText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  // Friend
  friendLogLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.2 },
  friendNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  friendName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  // Moment
  momentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  momentLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  momentText: { fontSize: 15, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 24 },
});
