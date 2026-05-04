import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MoodBadge } from '@/components/MoodBadge';
import { useColors } from '@/hooks/useColors';
import type { LogEntry } from '@/context/AppContext';

interface LogCardProps {
  entry: LogEntry;
  onPress?: () => void;
  onDelete?: () => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function LogCard({ entry, onPress, onDelete }: LogCardProps) {
  const colors = useColors();
  const panelImages = entry.panels.filter(p => p.imageUri).slice(0, 3);
  const firstText = entry.panels.find(p => p.text.trim())?.text ?? '';
  const panelCount = entry.panels.length;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.87}
    >
      {/* Panel thumbnail strip */}
      {panelImages.length > 0 ? (
        <View style={styles.thumbnailStrip}>
          {panelImages.map((p, i) => (
            <View key={p.id} style={[styles.thumbWrap, i > 0 && styles.thumbOverlap]}>
              <Image source={{ uri: p.imageUri }} style={styles.thumb} resizeMode="cover" />
            </View>
          ))}
          {panelCount > 3 && (
            <View style={[styles.thumbWrap, styles.thumbOverlap, styles.moreThumb, { backgroundColor: `${colors.primary}25` }]}>
              <Text style={[styles.moreThumbText, { color: colors.primary }]}>+{panelCount - 3}</Text>
            </View>
          )}
          {/* Full cover image */}
          <Image source={{ uri: panelImages[0].imageUri }} style={styles.coverImage} resizeMode="cover" />
          <View style={styles.coverOverlay} />
          {/* Panel count badge */}
          <View style={[styles.panelBadge, { backgroundColor: 'rgba(26,22,48,0.7)', borderColor: 'rgba(255,255,255,0.2)' }]}>
            <Feather name="layers" size={11} color="#fff" />
            <Text style={styles.panelBadgeText}>{panelCount} panel{panelCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.noCoverBanner, { backgroundColor: `${colors.primary}10` }]}>
          <Feather name="book-open" size={24} color={`${colors.primary}60`} />
          <View style={[styles.panelBadgeAlt, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}25` }]}>
            <Feather name="layers" size={11} color={colors.primary} />
            <Text style={[styles.panelBadgeAltText, { color: colors.primary }]}>
              {panelCount} panel{panelCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={10} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{formatDate(entry.date)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={10} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{entry.location}</Text>
          </View>
          {onDelete && (
            <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Feather name="trash-2" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>{entry.chapterTitle}</Text>

        {firstText.length > 0 && (
          <Text style={[styles.snippet, { color: colors.mutedForeground }]} numberOfLines={2}>
            {firstText}
          </Text>
        )}

        <View style={styles.footer}>
          <MoodBadge mood={entry.mood} size="sm" />
          <View style={styles.stats}>
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

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  thumbnailStrip: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  coverImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'transparent',
  },
  thumbWrap: {
    position: 'absolute',
    width: 40,
    height: 52,
    borderRadius: 6,
    overflow: 'hidden',
    bottom: 10,
    right: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    zIndex: 2,
  },
  thumbOverlap: { right: 10 },
  thumb: { width: '100%', height: '100%' },
  moreThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreThumbText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  panelBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 3,
  },
  panelBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  noCoverBanner: {
    width: '100%',
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  panelBadgeAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  panelBadgeAltText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  body: { padding: 14, gap: 7 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  title: { fontSize: 17, fontFamily: 'Inter_600SemiBold', lineHeight: 24 },
  snippet: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNum: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  privatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  privateText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
});
