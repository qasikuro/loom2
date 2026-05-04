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
import { SHADOW } from '@/constants/colors';

const HOURS = new Date().getHours();
const TIME_GREETING =
  HOURS < 5  ? 'Still up?' :
  HOURS < 12 ? 'Good morning' :
  HOURS < 17 ? 'Good afternoon' :
  HOURS < 21 ? 'Good evening' : 'Good night';

const SKY_COLORS: [string, string, string] =
  HOURS >= 5 && HOURS < 8   ? ['#E8956A', '#F4B89C', '#D4BCED'] :
  HOURS >= 8 && HOURS < 17  ? ['#9AB8D8', '#BDD0EC', '#DDE4F4'] :
  HOURS >= 17 && HOURS < 20 ? ['#C05848', '#D07870', '#C890D0'] :
                               ['#181428', '#22184A', '#321E62'];

const IS_NIGHT = HOURS >= 20 || HOURS < 5;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { character, journalEntries, stories, rewards, dismissReward } = useApp();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const latestEntry = journalEntries[0];
  const latestStory  = stories[0];

  const nightText  = (alpha: number) => `rgba(230,224,248,${alpha})`;
  const lightText  = (alpha: number) => `rgba(50,36,90,${alpha})`;
  const heroText   = IS_NIGHT ? nightText : lightText;

  return (
    <View style={[styles.container, { backgroundColor: IS_NIGHT ? '#12102A' : colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>

        {/* ── Sky hero ────────────────────────────────────────────── */}
        <View style={[styles.hero, { height: topPad + 280 }]}>
          <LinearGradient colors={SKY_COLORS} style={StyleSheet.absoluteFill} />

          {IS_NIGHT && [
            { t: 42, l: 55, s: 3 }, { t: 72, r: 78, s: 2 }, { t: 28, r: 136, s: 4 },
            { t: 96, l: 128, s: 2 }, { t: 58, r: 38, s: 3 }, { t: 110, l: 80, s: 2 },
            { t: 35, l: 200, s: 2 },
          ].map((star, i) => (
            <View key={i} style={[styles.star, {
              top: star.t + topPad,
              left: (star as any).l,
              right: (star as any).r,
              width: star.s, height: star.s,
              backgroundColor: `rgba(240,208,128,${0.35 + i * 0.07})`,
            }]} />
          ))}

          {/* Top bar */}
          <View style={[styles.topBar, { paddingTop: topPad + 14 }]}>
            <Text style={[styles.appName, { color: heroText(0.55) }]}>SKY JOURNAL</Text>
            <TouchableOpacity style={[styles.iconBtn, {
              backgroundColor: IS_NIGHT ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.48)',
            }]}>
              <Feather name="bell" size={16} color={heroText(0.75)} />
            </TouchableOpacity>
          </View>

          {/* Character hero */}
          <View style={styles.charArea}>
            <View style={[styles.charGlow, {
              backgroundColor: IS_NIGHT ? 'rgba(200,184,232,0.14)' : 'rgba(255,255,255,0.26)',
            }]} />
            <View style={[styles.charRing, {
              borderColor: IS_NIGHT ? 'rgba(200,184,232,0.28)' : 'rgba(255,255,255,0.70)',
            }]}>
              <Image source={Images.character_default} style={styles.charImg} resizeMode="cover" />
            </View>
            <Text style={[styles.greeting, { color: heroText(0.93) }]}>
              {TIME_GREETING}, {character.name}
            </Text>
            <MoodBadge mood={character.mood} size="sm" />
          </View>
        </View>

        {/* ── Content ──────────────────────────────────────────────── */}
        <View style={styles.content}>

          {/* Reward banners */}
          {rewards.slice(0, 1).map(r => (
            <RewardBanner key={r.id} reward={r} onDismiss={() => dismissReward(r.id)} />
          ))}

          {/* Quick actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.sm]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/create-journal-entry'); }}
              activeOpacity={0.88}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: `${colors.primary}12` }]}>
                <Feather name="feather" size={22} color={colors.primary} />
              </View>
              <View style={styles.actionTexts}>
                <Text style={[styles.actionLabel, { color: colors.foreground }]}>Write in Journal</Text>
                <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>Private · just for you</Text>
              </View>
              <Feather name="chevron-right" size={15} color={`${colors.mutedForeground}70`} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.sm]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(tabs)/create'); }}
              activeOpacity={0.88}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: `${colors.primary}12` }]}>
                <Feather name="book-open" size={22} color={colors.primary} />
              </View>
              <View style={styles.actionTexts}>
                <Text style={[styles.actionLabel, { color: colors.foreground }]}>Create Story</Text>
                <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>Manga · public panels</Text>
              </View>
              <Feather name="chevron-right" size={15} color={`${colors.mutedForeground}70`} />
            </TouchableOpacity>
          </View>

          {/* Latest journal entry */}
          {latestEntry && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionLeft}>
                  <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent journal entry</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)/log')}>
                  <Text style={[styles.sectionLink, { color: colors.primary }]}>See all</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary }, SHADOW.xs]}
                onPress={() => router.push('/(tabs)/log')}
                activeOpacity={0.88}
              >
                <View style={styles.entryTop}>
                  <Text style={[styles.entryDate, { color: colors.mutedForeground }]}>
                    {new Date(latestEntry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                  <MoodBadge mood={latestEntry.mood} size="sm" />
                </View>
                <View style={styles.entryRow}>
                  <Text style={[styles.entryText, { color: colors.foreground }]} numberOfLines={3}>{latestEntry.text}</Text>
                  {latestEntry.imageUri && (
                    <Image source={{ uri: latestEntry.imageUri }} style={styles.entryThumb} resizeMode="cover" />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Latest story */}
          {latestStory && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionLeft}>
                  <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Latest story</Text>
                </View>
                <TouchableOpacity onPress={() => router.push({ pathname: '/story/[id]', params: { id: latestStory.id, source: 'mine' } })}>
                  <Text style={[styles.sectionLink, { color: colors.primary }]}>Read</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.storyCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.sm]}
                onPress={() => router.push({ pathname: '/story/[id]', params: { id: latestStory.id, source: 'mine' } })}
                activeOpacity={0.88}
              >
                {latestStory.panels[0]?.imageUri && (
                  <Image source={{ uri: latestStory.panels[0].imageUri }} style={styles.storyBanner} resizeMode="cover" />
                )}
                <View style={[styles.storyBody, !latestStory.panels[0]?.imageUri && { paddingTop: 16 }]}>
                  <Text style={[styles.storyTitle, { color: colors.foreground }]}>{latestStory.chapterTitle}</Text>
                  <View style={styles.storyMeta}>
                    <MoodBadge mood={latestStory.mood} size="sm" />
                    <Text style={[styles.storyPanels, { color: colors.mutedForeground }]}>
                      {latestStory.panels.length} panels
                    </Text>
                    <View style={[styles.visBadge, { backgroundColor: latestStory.isPublic ? 'rgba(96,168,120,0.1)' : `${colors.primary}0F` }]}>
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
            <View style={[styles.emptyCard, { borderColor: `${colors.primary}15`, backgroundColor: `${colors.primary}06` }, SHADOW.xs]}>
              <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.primary}10` }]}>
                <Feather name="wind" size={26} color={`${colors.primary}80`} />
              </View>
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  appName: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2.5 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  charArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, position: 'relative' },
  charGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75 },
  charRing: { width: 110, height: 110, borderRadius: 55, borderWidth: 2.5, overflow: 'hidden' },
  charImg: { width: '100%', height: '100%' },
  greeting: { fontSize: 17, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.2 },
  content: { paddingHorizontal: 18, paddingTop: 20, gap: 22 },
  // Action cards — full-width stacked
  actionsRow: { gap: 10 },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  actionIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionTexts: { flex: 1 },
  actionLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  actionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  // Section
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  sectionLink: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  // Entry card
  entryCard: {
    borderRadius: 16, borderWidth: 1, borderLeftWidth: 3,
    padding: 14, gap: 8,
  },
  entryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  entryRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  entryText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, fontStyle: 'italic' },
  entryThumb: { width: 62, height: 76, borderRadius: 10, flexShrink: 0 },
  // Story card
  storyCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  storyBanner: { width: '100%', height: 130 },
  storyBody: { padding: 14, gap: 8 },
  storyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  storyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  storyPanels: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  visBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  visBadgeText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  // Empty
  emptyCard: { borderWidth: 1, borderRadius: 18, padding: 24, gap: 10, alignItems: 'center' },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, fontStyle: 'italic', textAlign: 'center' },
});
