import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { useApp, type Outfit } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
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

const { width: SW } = Dimensions.get('window');
const GUTTER = 14;
const GAP    = 10;
const CARD_W = (SW - GUTTER * 2 - GAP) / 2;
const IMG_H  = CARD_W * 1.18;

// ── Tag gradient pools ────────────────────────────────────────────────────────
const TAG_COLORS: Record<string, [string, string]> = {
  calm:       ['#8B7AB5', '#5D5A8A'],
  dreamer:    ['#9B7AB5', '#6B5A8A'],
  quiet:      ['#5D7BA5', '#3D5A7A'],
  mysterious: ['#6B6BA5', '#4A4A7A'],
  cozy:       ['#A5785D', '#7A5840'],
  warm:       ['#D4A849', '#A07830'],
  bright:     ['#D4A849', '#B08028'],
  soft:       ['#8BA57A', '#6A7A58'],
  elegant:    ['#B59AB5', '#8A6A8A'],
  casual:     ['#7A9AB5', '#5A7A8A'],
  sky:        ['#7AB5D4', '#5A8AAA'],
  starlight:  ['#C8B8E8', '#9080B8'],
};
function tagColor(tag: string): [string, string] {
  const key = tag.toLowerCase();
  return TAG_COLORS[key] ?? ['#8B7AB5', '#5D5A8A'];
}

// Gradient background palettes for outfits with no image
const GRADIENT_POOLS: [string, string, string][] = [
  ['#2E2260', '#3A1D60', '#1A1040'],
  ['#1D2A50', '#2A3560', '#101830'],
  ['#282050', '#3A2860', '#181030'],
  ['#1A2840', '#243250', '#101828'],
  ['#2A2030', '#3A2845', '#181018'],
];
function getGradient(id: string): [string, string, string] {
  const n = id.charCodeAt(0) % GRADIENT_POOLS.length;
  return GRADIENT_POOLS[n];
}

// Small mood emoji by tag keyword
const TAG_ICON: Record<string, string> = {
  calm: '✦', dreamer: '✧', quiet: '◇', mysterious: '◈',
  cozy: '♡', warm: '☀', bright: '★', soft: '❋',
  elegant: '◆', casual: '○', sky: '☁', starlight: '✦',
};
function moodEmoji(tags: string[]): string {
  for (const t of tags) {
    const e = TAG_ICON[t.toLowerCase()];
    if (e) return e;
  }
  return '✦';
}

// ── Outfit card ───────────────────────────────────────────────────────────────
function OutfitCard({ outfit, isActive, onSetActive, colors }: {
  outfit:      Outfit;
  isActive:    boolean;
  onSetActive: (id: string) => void;
  colors:      ReturnType<typeof useColors>;
}) {
  const grad = getGradient(outfit.id);
  const emoji = moodEmoji(outfit.tags);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {/* Image area */}
      <View style={styles.imgWrap}>
        {outfit.imageUri ? (
          <Image
            source={{ uri: outfit.imageUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <LinearGradient
            colors={grad}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
          >
            <View style={styles.placeholderCenter}>
              <Text style={styles.placeholderEmoji}>✦</Text>
            </View>
          </LinearGradient>
        )}

        {/* Active badge */}
        {isActive && (
          <View style={styles.activeBadge}>
            <Icon name="home" size={9} color="#fff" />
          </View>
        )}

        {/* Public badge */}
        {outfit.isPublic && !isActive && (
          <View style={styles.pubBadge}>
            <Icon name="globe" size={8} color="rgba(200,240,200,0.9)" />
          </View>
        )}
      </View>

      {/* Info area */}
      <View style={styles.cardInfo}>
        <View style={styles.cardNameRow}>
          <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={2}>
            {outfit.name}
          </Text>
          <Text style={[styles.cardEmoji, { color: colors.primary }]}>{emoji}</Text>
        </View>

        {outfit.tags.length > 0 && (
          <View style={styles.tagRow}>
            {outfit.tags.slice(0, 3).map(tag => {
              const [c1] = tagColor(tag);
              return (
                <View
                  key={tag}
                  style={[styles.tagChip, { backgroundColor: `${c1}18`, borderColor: `${c1}35` }]}
                >
                  <Text style={[styles.tagText, { color: c1 }]}>{tag.toLowerCase()}</Text>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={[styles.useBtn, {
            borderColor: isActive ? `${colors.primary}50` : colors.border,
            backgroundColor: isActive ? `${colors.primary}14` : 'transparent',
          }]}
          onPress={() => { Haptics.selectionAsync(); onSetActive(outfit.id); }}
          activeOpacity={0.75}
        >
          <Icon
            name={isActive ? 'check-circle' : 'home'}
            size={10}
            color={isActive ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.useBtnText, { color: isActive ? colors.primary : colors.mutedForeground }]}>
            {isActive ? 'Worn on home' : 'Wear this'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <LinearGradient
        colors={[`${colors.primary}20`, `${colors.primary}08`]}
        style={styles.emptyIcon}
      >
        <Text style={styles.emptyIconText}>✦</Text>
      </LinearGradient>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('profile.noOutfitsYet')}</Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
        Record your daily Sky looks and{'\n'}build your wardrobe over time.
      </Text>
      <TouchableOpacity
        style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onPress={() => { Haptics.selectionAsync(); router.push('/create-outfit' as any); }}
      >
        <Icon name="plus" size={14} color="#fff" />
        <Text style={styles.emptyBtnText}>{t('profile.logFirstOutfitBtn')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function WardrobeScreen() {
  const colors  = useColors();
  const { t } = useTranslation();
  const insets  = useSafeAreaInsets();
  const { outfits, activeOutfitId, setActiveOutfitId } = useApp();

  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const botPad = Platform.OS === 'web' ? 20 : insets.bottom + 16;

  const [tab, setTab] = useState<'outfits' | 'accessories'>('outfits');

  const sorted = [...outfits].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  function handleSetActive(id: string) {
    setActiveOutfitId(activeOutfitId === id ? null : id);
  }

  const renderItem = ({ item, index }: { item: Outfit; index: number }) => (
    <View style={{ marginLeft: index % 2 === 1 ? GAP : 0 }}>
      <OutfitCard
        outfit={item}
        isActive={activeOutfitId === item.id}
        onSetActive={handleSetActive}
        colors={colors}
      />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Gradient header bg */}
      <LinearGradient
        colors={['#1E1A48', '#252050', colors.background]}
        style={[styles.headerBg, { height: topPad + 120 }]}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <BackButton style={styles.headerBtn} color="rgba(235,228,255,0.9)" size={20} />

        <Text style={styles.headerTitle}>{t('profile.wardrobeTitle')}</Text>

        <TouchableOpacity
          style={[styles.headerBtn, styles.headerBtnAccent]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => { Haptics.selectionAsync(); router.push('/create-outfit' as any); }}
        >
          <Icon name="plus" size={20} color="rgba(235,228,255,0.9)" />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: `${colors.card}CC`, borderColor: colors.border }]}>
        {(['outfits', 'accessories'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { backgroundColor: colors.primary }]}
            onPress={() => { Haptics.selectionAsync(); setTab(t); }}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.tabBtnText,
              { color: tab === t ? '#fff' : colors.mutedForeground },
              tab === t && { fontFamily: 'Satoshi-Bold' },
            ]}>
              {t === 'outfits' ? 'Outfits' : 'Accessories'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === 'accessories' ? (
        <View style={styles.emptyWrap}>
          <LinearGradient
            colors={[`${colors.primary}20`, `${colors.primary}08`]}
            style={styles.emptyIcon}
          >
            <Icon name="star" size={28} color={`${colors.primary}70`} />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('common.comingSoon')}</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Accessories logging will be{'\n'}available in a future update.
          </Text>
        </View>
      ) : sorted.length === 0 ? (
        <EmptyState colors={colors} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={o => o.id}
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
  root:     { flex: 1 },
  headerBg: { position: 'absolute', top: 0, left: 0, right: 0 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 16,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerBtnAccent: {
    backgroundColor: 'rgba(139,122,181,0.25)',
    borderWidth: 1, borderColor: 'rgba(139,122,181,0.4)',
  },
  headerTitle: {
    fontSize: 20, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.97)', letterSpacing: 0.2,
  },

  tabBar: {
    flexDirection: 'row', marginHorizontal: GUTTER,
    borderRadius: 30, borderWidth: 1,
    padding: 3, marginBottom: 16,
  },
  tabBtn:     { flex: 1, paddingVertical: 10, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  tabBtnText: { fontSize: 13, fontFamily: 'Satoshi-Medium' },

  grid: { paddingHorizontal: GUTTER, paddingTop: 4 },
  row:  { marginBottom: GAP },

  // Card
  card: {
    width: CARD_W, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  imgWrap: {
    width: CARD_W, height: IMG_H,
    backgroundColor: '#1C1840', overflow: 'hidden',
  },
  placeholderCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderEmoji:  { fontSize: 40, color: 'rgba(200,184,232,0.25)' },

  activeBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(139,122,181,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  pubBadge: {
    position: 'absolute', top: 10, left: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  cardInfo: {
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 7,
  },
  cardNameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  cardName: {
    flex: 1, fontSize: 13, fontFamily: 'Satoshi-Bold',
    lineHeight: 18, letterSpacing: 0.1,
  },
  cardEmoji: { fontSize: 13, marginTop: 1 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tagChip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  tagText: { fontSize: 10, fontFamily: 'Satoshi-Medium' },

  useBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1, marginTop: 2,
  },
  useBtnText: { fontSize: 10, fontFamily: 'Satoshi-Medium' },

  // Empty
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 12,
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyIconText: { fontSize: 32, color: 'rgba(200,184,232,0.4)' },
  emptyTitle:    { fontSize: 18, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  emptySub:      { fontSize: 14, fontFamily: 'Satoshi-Regular', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 20, marginTop: 8,
  },
  emptyBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff' },
});
