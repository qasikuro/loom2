import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Images } from '@/assets/images';
import { RewardBanner } from '@/components/RewardBanner';
import { MoodBadge } from '@/components/MoodBadge';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const HOURS = new Date().getHours();
const TIME_GREETING =
  HOURS < 5 ? 'Still up?' :
  HOURS < 12 ? 'Good morning' :
  HOURS < 17 ? 'Good afternoon' :
  HOURS < 21 ? 'Good evening' : 'Good night';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { character, journalEntries, stories, rewards, dismissReward } = useApp();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const latestEntry = journalEntries[0];
  const latestStory = stories[0];

  const skyColors: [string, string, string] =
    HOURS >= 5 && HOURS < 8   ? ['#F4A460', '#FFB6C1', '#C8B8E8'] :
    HOURS >= 8 && HOURS < 17  ? ['#B0C8E8', '#C8D8F0', '#E8E8F8'] :
    HOURS >= 17 && HOURS < 20 ? ['#C8684A', '#D4806A', '#C8A0D8'] :
                                 ['#1A1630', '#2A1E50', '#3A2870'];

  const isNight = HOURS >= 20 || HOURS < 5;

  return (
    <View style={[styles.container, { backgroundColor: isNight ? colors.night : colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>

        {/* Sky hero */}
        <View style={[styles.hero, { height: topPad + 270 }]}>
          <LinearGradient colors={skyColors} style={StyleSheet.absoluteFill} />
          {isNight && [
            { t: 40, l: 60, s: 3 }, { t: 70, r: 80, s: 2 }, { t: 30, r: 140, s: 4 },
            { t: 90, l: 130, s: 2 }, { t: 55, r: 40, s: 3 },
          ].map((star, i) => (
            <View key={i} style={[styles.star, {
              top: star.t + topPad,
              left: (star as any).l ?? undefined,
              right: (star as any).r ?? undefined,
              width: star.s, height: star.s,
              backgroundColor: `rgba(240,208,128,${0.45 + i * 0.08})`,
            }]} />
          ))}

          {/* Top bar */}
          <View style={[styles.topBar, { paddingTop: topPad + 12 }]}>
            <Text style={[styles.appName, { color: isNight ? 'rgba(240,234,248,0.6)' : 'rgba(80,60,120,0.6)' }]}>
              SKY JOURNAL
            </Text>
            <TouchableOpacity
              style={[styles.notifBtn, { backgroundColor: isNight ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.55)' }]}
            >
              <Feather name="bell" size={17} color={isNight ? 'rgba(240,234,248,0.8)' : 'rgba(80,60,120,0.65)'} />
            </TouchableOpacity>
          </View>

          {/* Character */}
          <View style={styles.charArea}>
            <View style={[styles.charGlow, { backgroundColor: isNight ? 'rgba(200,184,232,0.16)' : 'rgba(255,255,255,0.28)' }]} />
            <View style={[styles.charAvatar, { borderColor: isNight ? 'rgba(200,184,232,0.35)' : 'rgba(255,255,255,0.75)' }]}>
              <Image source={Images.character_default} style={styles.charImg} resizeMode="cover" />
            </View>
            <Text style={[styles.greeting, { color: isNight ? 'rgba(240,234,248,0.92)' : 'rgba(50,30,90,0.85)' }]}>
              {TIME_GREETING}, {character.name}
            </Text>
            <MoodBadge mood={character.mood} size="sm" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {rewards.slice(0, 1).map(r => (
            <RewardBanner key={r.id} reward={r} onDismiss={() => dismissReward(r.id)} />
          ))}

          {/* Quick actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/create-journal-entry'); }}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${colors.primary}14` }]}>
                <Feather name="feather" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Write in Journal</Text>
              <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>Private · just for you</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(tabs)/create'); }}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${colors.primary}14` }]}>
                <Feather name="book-open" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Create Story</Text>
              <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>Manga · public panels</Text>
            </TouchableOpacity>
          </View>

          {/* Latest journal entry */}
          {latestEntry && (
            <View style={styles.recentBlock}>
              <View style={styles.recentBlockHeader}>
                <View style={styles.recentBlockLeft}>
                  <Feather name="lock" size={13} color={colors.primary} />
                  <Text style={[styles.recentBlockTitle, { color: colors.foreground }]}>Last journal entry</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)/log')}>
                  <Text style={[styles.seeAll, { color: colors.primary }]}>All entries</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push('/(tabs)/log')}
                activeOpacity={0.85}
              >
                <View style={styles.entryCardRow}>
                  <Text style={[styles.entryText, { color: colors.foreground }]} numberOfLines={3}>
                    {latestEntry.text}
                  </Text>
                  {latestEntry.imageUri && (
                    <Image source={{ uri: latestEntry.imageUri }} style={styles.entryThumb} resizeMode="cover" />
                  )}
                </View>
                <MoodBadge mood={latestEntry.mood} size="sm" />
              </TouchableOpacity>
            </View>
          )}

          {/* Latest story */}
          {latestStory && (
            <View style={styles.recentBlock}>
              <View style={styles.recentBlockHeader}>
                <View style={styles.recentBlockLeft}>
                  <Feather name="layers" size={13} color={colors.primary} />
                  <Text style={[styles.recentBlockTitle, { color: colors.foreground }]}>Latest story</Text>
                </View>
                <TouchableOpacity onPress={() => router.push({ pathname: '/story/[id]', params: { id: latestStory.id, source: 'mine' } })}>
                  <Text style={[styles.seeAll, { color: colors.primary }]}>Read</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.storyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: '/story/[id]', params: { id: latestStory.id, source: 'mine' } })}
                activeOpacity={0.85}
              >
                {latestStory.panels[0]?.imageUri && (
                  <Image source={{ uri: latestStory.panels[0].imageUri }} style={styles.storyBanner} resizeMode="cover" />
                )}
                <View style={[styles.storyCardBody, !latestStory.panels[0]?.imageUri && { paddingTop: 16 }]}>
                  <Text style={[styles.storyCardTitle, { color: colors.foreground }]}>{latestStory.chapterTitle}</Text>
                  <View style={styles.storyMeta}>
                    <MoodBadge mood={latestStory.mood} size="sm" />
                    <Text style={[styles.storyPanels, { color: colors.mutedForeground }]}>
                      {latestStory.panels.length} panels
                    </Text>
                    <View style={[styles.visBadge, {
                      backgroundColor: latestStory.isPublic ? 'rgba(96,168,120,0.12)' : `${colors.primary}10`,
                    }]}>
                      <Feather name={latestStory.isPublic ? 'globe' : 'lock'} size={10} color={latestStory.isPublic ? '#60A878' : colors.primary} />
                      <Text style={[styles.visBadgeText, { color: latestStory.isPublic ? '#60A878' : colors.primary }]}>
                        {latestStory.isPublic ? 'Public' : 'Private'}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Empty state */}
          {!latestEntry && !latestStory && (
            <View style={[styles.emptyPrompt, { borderColor: `${colors.primary}18`, backgroundColor: `${colors.primary}07` }]}>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Begin your sky journey</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Write privately in your journal, or create a manga story to share with the world.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { position: 'relative', overflow: 'hidden' },
  star: { position: 'absolute', borderRadius: 99 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  appName: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 2 },
  notifBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  charArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, position: 'relative' },
  charGlow: { position: 'absolute', width: 140, height: 140, borderRadius: 70 },
  charAvatar: { width: 108, height: 108, borderRadius: 54, borderWidth: 3, overflow: 'hidden' },
  charImg: { width: '100%', height: '100%' },
  greeting: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 18, paddingTop: 18, gap: 20 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionCard: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  actionSub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  recentBlock: { gap: 10 },
  recentBlockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentBlockLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  recentBlockTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  seeAll: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  entryCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  entryCardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  entryText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, fontStyle: 'italic' },
  entryThumb: { width: 60, height: 74, borderRadius: 10, flexShrink: 0 },
  storyCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  storyBanner: { width: '100%', height: 138 },
  storyCardBody: { padding: 14, gap: 8 },
  storyCardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  storyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  storyPanels: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  visBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  visBadgeText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  emptyPrompt: { borderWidth: 1, borderRadius: 16, padding: 22, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, fontStyle: 'italic' },
});
