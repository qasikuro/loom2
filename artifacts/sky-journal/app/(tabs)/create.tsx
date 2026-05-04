import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';

const LOG_TYPES = [
  {
    key: 'memory',
    icon: 'camera' as const,
    emoji: '📸',
    title: 'Memory Log',
    description: 'Capture moments with images and manga-style story panels',
    gradient: ['#7B6BA8', '#5A4A80'] as const,
    lightBg: '#EDE0F8' as const,
    href: '/create-memory' as const,
  },
  {
    key: 'friend',
    icon: 'users' as const,
    emoji: '🤝',
    title: 'Friend Log',
    description: 'Record an encounter with someone from your sky journey',
    gradient: ['#4878A8', '#2A5080'] as const,
    lightBg: '#D8E8F8' as const,
    href: '/create-friend-log' as const,
  },
  {
    key: 'moment',
    icon: 'moon' as const,
    emoji: '🌙',
    title: 'Moment Log',
    description: 'A quiet emotional reflection — no image needed',
    gradient: ['#3A3060', '#1E1840'] as const,
    lightBg: '#E0DCF0' as const,
    href: '/create-moment-log' as const,
  },
] as const;

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  function handleSelect(href: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(href as any);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#EDE8F8', '#F8F4EE']}
        style={[styles.headerGrad, { height: topPad + 80 }]}
      />

      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>New Entry</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          What would you like to record?
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {LOG_TYPES.map((type, idx) => (
          <TouchableOpacity
            key={type.key}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleSelect(type.href)}
            activeOpacity={0.88}
          >
            {/* Gradient left bar */}
            <LinearGradient
              colors={type.gradient}
              style={styles.cardBar}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />

            <View style={styles.cardContent}>
              <View style={[styles.cardIcon, { backgroundColor: type.lightBg }]}>
                <Feather name={type.icon} size={22} color={type.gradient[0]} />
              </View>
              <View style={styles.cardText}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{type.title}</Text>
                  <Text style={styles.cardEmoji}>{type.emoji}</Text>
                </View>
                <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
                  {type.description}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
          </TouchableOpacity>
        ))}

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or search your memories</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        {/* Search shortcut */}
        <TouchableOpacity
          style={[styles.searchShortcut, { backgroundColor: colors.muted, borderColor: colors.border }]}
          onPress={() => router.push('/search')}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <Text style={[styles.searchShortcutText, { color: colors.mutedForeground }]}>
            Search memories, friends, or feelings
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 20,
    gap: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
  },
  scroll: { paddingHorizontal: 18, gap: 0 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: { flex: 1, gap: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cardEmoji: { fontSize: 16 },
  cardDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: 'Inter_400Regular', flexShrink: 0 },
  searchShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchShortcutText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
