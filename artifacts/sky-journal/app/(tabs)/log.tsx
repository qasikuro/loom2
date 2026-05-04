import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JournalCard } from '@/components/JournalCard';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function JournalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { journalEntries, deleteJournalEntry } = useApp();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  function handleDelete(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteJournalEntry(id);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#EDE0F8', '#F4EFF8', '#F8F4EE']} style={[styles.headerGrad, { height: topPad + 90 }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>My Journal</Text>
            <View style={[styles.privateBadge, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}22` }]}>
              <Feather name="lock" size={10} color={colors.primary} />
              <Text style={[styles.privateBadgeText, { color: colors.primary }]}>Private</Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {journalEntries.length === 0
              ? 'Your personal diary'
              : `${journalEntries.length} ${journalEntries.length === 1 ? 'entry' : 'entries'}`}
          </Text>
        </View>
      </View>

      <FlatList
        data={journalEntries}
        keyExtractor={e => e.id}
        renderItem={({ item }) => (
          <JournalCard entry={item} onDelete={() => handleDelete(item.id)} />
        )}
        contentContainerStyle={[
          styles.list,
          journalEntries.length === 0 && styles.listEmpty,
          { paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <LinearGradient
              colors={[`${colors.primary}18`, `${colors.primary}08`]}
              style={styles.emptyIconWrap}
            >
              <Feather name="feather" size={32} color={`${colors.primary}80`} />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Your journal is empty
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              This is your private space — write freely. No one else can see your entries.
            </Text>
            <TouchableOpacity
              style={[styles.writeBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/create-journal-entry')}
            >
              <Feather name="edit-3" size={15} color="#fff" />
              <Text style={styles.writeBtnText}>Write first entry</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: bottomPad - 20 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/create-journal-entry');
        }}
        activeOpacity={0.85}
      >
        <Feather name="edit-3" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { paddingHorizontal: 20, paddingBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  privateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1,
  },
  privateBadgeText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 3 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  listEmpty: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 14, paddingTop: 60 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  emptyText: {
    fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center',
    lineHeight: 22, fontStyle: 'italic',
  },
  writeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 13, borderRadius: 26, marginTop: 4,
  },
  writeBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  fab: {
    position: 'absolute', right: 22,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6B5B95', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
  },
});
