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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function LogCard({ entry, onPress, onDelete }: LogCardProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {entry.imageUri ? (
        <Image source={{ uri: entry.imageUri }} style={styles.image} resizeMode="cover" />
      ) : null}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.datePill}>
            <Feather name="calendar" size={10} color={colors.mutedForeground} />
            <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
              {formatDate(entry.date)}
            </Text>
          </View>
          <View style={styles.datePill}>
            <Feather name="map-pin" size={10} color={colors.mutedForeground} />
            <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{entry.location}</Text>
          </View>
          {onDelete && (
            <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Feather name="trash-2" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{entry.chapterTitle}</Text>
        <Text style={[styles.story, { color: colors.mutedForeground }]} numberOfLines={3}>
          {entry.storyText}
        </Text>
        <View style={styles.footer}>
          <MoodBadge mood={entry.mood} size="sm" />
          <View style={styles.stats}>
            <Feather name="eye" size={12} color={colors.mutedForeground} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>{entry.witnessedCount}</Text>
            <Feather name="bookmark" size={12} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>{entry.savedCount}</Text>
            {!entry.isPublic && (
              <View style={[styles.privatePill, { backgroundColor: `${colors.primary}15` }]}>
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
  image: {
    width: '100%',
    height: 180,
  },
  body: {
    padding: 16,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  title: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 24,
  },
  story: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  privatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  privateText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
});
