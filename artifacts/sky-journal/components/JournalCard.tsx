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
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function JournalCard({ entry, onDelete }: JournalCardProps) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Top row: date + delete */}
      <View style={styles.topRow}>
        <View style={styles.dateRow}>
          <Feather name="calendar" size={11} color={colors.mutedForeground} />
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatDate(entry.date)}
          </Text>
        </View>
        {onDelete && (
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Feather name="trash-2" size={14} color={`${colors.mutedForeground}80`} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content row: text + image */}
      <View style={styles.contentRow}>
        <Text
          style={[styles.text, { color: colors.foreground }]}
          numberOfLines={entry.imageUri ? 3 : 5}
        >
          {entry.text}
        </Text>
        {entry.imageUri && (
          <Image source={{ uri: entry.imageUri }} style={styles.thumb} resizeMode="cover" />
        )}
      </View>

      {/* Footer: mood */}
      <View style={styles.footer}>
        <MoodBadge mood={entry.mood} size="sm" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  date: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  contentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  text: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  thumb: {
    width: 72,
    height: 90,
    borderRadius: 10,
    flexShrink: 0,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
