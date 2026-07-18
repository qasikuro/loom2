import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images/index';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Image } from 'expo-image';
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp, type Story } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from 'react-i18next';

const { width: SW } = Dimensions.get('window');
const GUTTER  = 14;
const GAP     = 8;
const CARD_W  = (SW - GUTTER * 2 - GAP) / 2;
const CARD_H  = CARD_W * 1.28;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BG_MAP: Record<string, any> = {
  bg1:  Images.story_bg1,
  bg2:  Images.story_bg2,
  bg3:  Images.story_bg3,
  char: Images.character_default,
};

function getCover(story: Story) {
  const p = story.panels[0];
  if (!p) return null;
  if (p.imageUri) return { uri: p.imageUri };
  if (p.bgPreset && BG_MAP[p.bgPreset]) return BG_MAP[p.bgPreset];
  return null;
}

function getMoodColor(mood: string) {
  const map: Record<string, string> = {
    Peaceful: '#8B7AB5', Joyful: '#D4A849', Melancholy: '#5D7BA5',
    Nostalgic: '#A5785D', Hopeful: '#6BA57A', Anxious: '#A56B6B',
    Dreamy: '#9B7AB5', Mysterious: '#6B6BA5',
  };
  return map[mood] ?? '#8B7AB5';
}

// ── Story card ────────────────────────────────────────────────────────────────
function StoryCard({ story, colors: _colors }: { story: Story; colors: ReturnType<typeof useColors> }) {
  const cover = getCover(story);
  const moodColor = getMoodColor(story.mood);

  return (
    <TouchableOpacity
      style={[styles.card, { width: CARD_W, height: CARD_H }]}
      onPress={() => {
        Haptics.selectionAsync();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(`/story/${story.id}` as any);
      }}
      activeOpacity={0.88}
    >
      {/* Cover image */}
      {cover ? (
        <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient
          colors={[`${moodColor}55`, `${moodColor}20`, '#0F0D1E']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
        >
          <Icon name="star" size={18} color={`${moodColor}50`} style={{ position: 'absolute', top: 18, right: 18 }} />
          <Icon name="moon" size={12} color={`${moodColor}35`} style={{ position: 'absolute', top: 40, left: 20 }} />
        </LinearGradient>
      )}

      {/* Gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(10,8,28,0.55)', 'rgba(8,6,22,0.92)']}
        style={styles.cardGrad}
      />

      {/* Mood dot */}
      <View style={[styles.moodDot, { backgroundColor: moodColor }]} />

      {/* Bottom info */}
      <View style={styles.cardBottom}>
        <Text style={styles.cardTitle} numberOfLines={2}>{story.chapterTitle}</Text>
        <View style={styles.cardMeta}>
          <View style={styles.cardStat}>
            <Icon name="eye" size={11} color="rgba(255,210,100,0.85)" />
            <Text style={styles.cardStatText}>{story.witnessedCount}</Text>
          </View>
          <View style={styles.cardStat}>
            <Icon name="bookmark" size={11} color="rgba(200,184,232,0.65)" />
            <Text style={styles.cardStatText}>{story.savedCount}</Text>
          </View>
          {(story.stickerCount ?? 0) > 0 && (
            <View style={styles.cardStat}>
              <Text style={{ fontSize: 10, color: 'rgba(255,210,100,0.85)', lineHeight: 13 }}>✦</Text>
              <Text style={styles.cardStatText}>{story.stickerCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Public badge */}
      {story.isPublic && (
        <View style={styles.publicBadge}>
          <Icon name="globe" size={9} color="rgba(200,232,200,0.9)" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ tab, colors }: { tab: string; colors: ReturnType<typeof useColors> }) {
  const { t: tr } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <LinearGradient
        colors={[`${colors.primary}18`, `${colors.primary}08`]}
        style={styles.emptyIcon}
      >
        <Icon name={tab === 'mine' ? 'book-open' : 'users'} size={32} color={`${colors.primary}70`} />
      </LinearGradient>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {tab === 'mine' ? 'No stories yet' : 'Nothing shared yet'}
      </Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
        {tab === 'mine'
          ? 'Start writing your first chapter\nand let others witness your journey.'
          : 'Stories shared with you will\nappear here.'}
      </Text>
      {tab === 'mine' && (
        <TouchableOpacity
          style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/create' as any); }}
        >
          <Icon name="plus" size={14} color="#fff" />
          <Text style={styles.emptyBtnText}>{tr('create.createStory')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MyStoriesScreen() {
  const colors = useColors();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const { stories } = useApp();

  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const botPad = Platform.OS === 'web' ? 20 : insets.bottom + 16;

  const sorted = [...stories].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const renderItem = ({ item, index }: { item: Story; index: number }) => (
    <View style={{ marginLeft: index % 2 === 1 ? GAP : 0 }}>
      <StoryCard story={item} colors={colors} />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Gradient header */}
      <LinearGradient
        colors={['#1E1A48', '#252050', colors.background]}
        style={[styles.headerBg, { height: topPad + 110 }]}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <BackButton style={styles.backBtn} color="rgba(235,228,255,0.9)" size={20} />
        <Text style={styles.headerTitle}>{tr('profile.myStoriesTitle')}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/create' as any); }}
        >
          <Icon name="plus" size={20} color="rgba(235,228,255,0.9)" />
        </TouchableOpacity>
      </View>

      {/* Story grid */}
      {sorted.length === 0 ? (
        <EmptyState tab="mine" colors={colors} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={s => s.id}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={[styles.grid, { paddingBottom: botPad }]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:      { flex: 1 },
  headerBg:  { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 20, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.97)',
    letterSpacing: 0.2,
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(139,122,181,0.25)',
    borderWidth: 1, borderColor: 'rgba(139,122,181,0.4)',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row', marginHorizontal: GUTTER,
    borderRadius: 30, borderWidth: 1,
    padding: 3, marginBottom: 16,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  tabBtnText: { fontSize: 13, fontFamily: 'Satoshi-Medium' },

  // Grid
  grid:  { paddingHorizontal: GUTTER, paddingTop: 4 },
  row:   { marginBottom: GAP },

  // Card
  card: {
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#1C1840',
  },
  cardGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%' },
  moodDot: {
    position: 'absolute', top: 12, right: 12,
    width: 8, height: 8, borderRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5, shadowRadius: 2,
  },
  publicBadge: {
    position: 'absolute', top: 12, left: 12,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, gap: 6 },
  cardTitle: {
    fontSize: 13, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.97)', lineHeight: 18,
  },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardStat:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatText: { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.75)' },

  // Empty
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 12,
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  emptySub:   { fontSize: 14, fontFamily: 'Satoshi-Regular', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 20, marginTop: 8,
  },
  emptyBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff' },
});
