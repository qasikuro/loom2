import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { apiFetch, useApp, COSMETIC_CATEGORY_MAP, type ShopItem } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { Button as KindnessButton } from '@workspace/storigam-kindness/components/native/button';
import { useColors as useDesignSystemColors } from '@workspace/storigam-kindness/hooks/use-colors';
import type { NativeThemeColors, NativeThemeMode } from '@workspace/storigam-kindness/lib/native-theme';
import { Icon } from '@/components/Icon';
import { StorigamActivityIndicator as ActivityIndicator } from '@/components/SkyLoading';
import { FrameRing } from '@/components/profile/CharacterAuraHeader';
import AuroraCloudBackdrop from '@/components/profile/AuroraCloudBackdrop';
import FounderAuroraCardFrame from '@/components/profile/FounderAuroraCardFrame';
import { useTranslation } from 'react-i18next';

const COLLECTION_CACHE_KEY  = 'collection_v1';
const SHOP_CATALOG_CACHE_KEY = 'shop_catalog_v2';
const ANIMAL_EAR_FRAME_IDS = new Set([
  'frame_ember_fox_ears',
  'frame_moonhare_ears',
  'frame_frost_lynx_ears',
]);

// ── Seasonal constants ────────────────────────────────────────────────────────

const SEASON_COLORS: Record<string, string> = {
  Spring: 'accent',
  Summer: 'chart3',
  Autumn: 'chart3',
  Winter: 'chart4',
};

const SEASON_ICONS: Record<string, string> = {
  Spring: '🌸',
  Summer: '☀',
  Autumn: '🍂',
  Winter: '❄',
};

// Map item IDs → emoji icon (mirrors SHOP_CATALOG on the server)
const ITEM_ICON_MAP: Record<string, string> = {
  frame_starlight:    '✦',
  frame_moonveil:     '◑',
  frame_moonlight:    '☾',
  frame_fire:         '✦',
  frame_celestial_wings: '✦',
  frame_ember_fox_ears: '✦',
  frame_moonhare_ears: '✦',
  frame_frost_lynx_ears: '✦',
  accent_aura:        '◈',
  theme_locket:       '◇',
  theme_aurora:       '⋆',
  frame_blossom:      '🌸',
  accent_petal:       '✿',
  frame_solstice:     '☀',
  accent_twilight:    '◐',
  frame_harvest:      '🍂',
  accent_ember:       '🔥',
  theme_aurora_winter:'🌌',
  frame_frost:        '❄',
  effect_butterfly:   '🦋',
  effect_hearts:      '💜',
  effect_fireflies:   '✨',
  effect_blossom:     '🌸',
  effect_fire:        '🔥',
  effect_leaves:      '🍃',
  effect_aurora_clouds: '✦',
  effect_moonlit_muse: '✦',
  effect_cosmic_arrival: '✦',
  card_frame_founder_regalia: '◆',
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MOONLIT_MUSE_IMAGE = require('../assets/moonlit_muse.png');

// Static fallback — effects only, shown instantly before API responds
const FALLBACK_CATALOG: ShopItem[] = [
  { id: 'frame_moonlight', name: 'Moonlight', description: 'A silver-lilac orbit, a quiet crescent, and tiny stars circling your profile picture.', icon: '☾', category: 'frame', cost: { stars: 180 } },
  { id: 'frame_fire', name: 'Fire', description: 'A living ember ring with warm sparks that flicker around your profile picture.', icon: '✦', category: 'frame', cost: { stars: 180 } },
  { id: 'frame_celestial_wings', name: 'Celestial Wings', description: 'Pearl-white wings with gold filigree, softly moving in a celestial breeze.', icon: '✦', category: 'frame', cost: { stars: 360 } },
  { id: 'frame_ember_fox_ears', name: 'Ember Fox', description: 'Detailed russet fur, a plush copper halo, and softly flicking fox ears.', icon: '✦', category: 'frame', cost: { stars: 360 } },
  { id: 'frame_moonhare_ears', name: 'Moonhare', description: 'Velvet ivory rabbit ears with a gentle, independent sway around your portrait.', icon: '✦', category: 'frame', cost: { stars: 360 } },
  { id: 'frame_frost_lynx_ears', name: 'Frost Lynx', description: 'Soft, tufted lynx ears that perk and settle around your profile picture.', icon: '✦', category: 'frame', cost: { stars: 360 } },
  { id: 'effect_butterfly', name: 'Ethereal Butterflies', description: 'Luminous butterflies drift across your profile, wings catching the light of distant stars.', icon: '🦋', category: 'effect', cost: { stars: 0 } },
  { id: 'effect_fireflies', name: 'Firefly Glow',         description: 'Golden fireflies blink softly around you like scattered wishes under a summer sky.',         icon: '✨', category: 'effect', cost: { stars: 0 } },
  { id: 'effect_hearts',    name: 'Floating Hearts',      description: 'Soft hearts rise gently from below, carrying warmth to every corner of your sky.',           icon: '💜', category: 'effect', cost: { stars: 0 } },
  { id: 'card_frame_founder_regalia', name: 'Founder Regalia', description: 'Gold filigree and violet crystals crowning your whole profile card. Included free with Founder.', icon: '◆', category: 'card_frame', cost: { stars: 0 }, founderOnly: true },
  { id: 'effect_aurora_clouds', name: 'Aurora Sanctuary', description: 'A living fantasy sky of violet auroras, drifting clouds, and distant mountains.', icon: '✦', category: 'effect', cost: { stars: 600 } },
  { id: 'effect_moonlit_muse', name: 'Moonlit Muse', description: 'A gothic anime muse arrives in a moonlit burst of violet ribbons, petals, and starlight.', icon: '✦', category: 'effect', cost: { stars: 350 } },
  { id: 'effect_cosmic_arrival', name: 'Cosmic Arrival', description: 'A golden star falls through luminous blue smoke when visitors open your profile.', icon: '✦', category: 'effect', cost: { stars: 0 } },
];

const CATEGORY_COLORS: Record<string, keyof NativeThemeColors> = {
  ears: 'chart3',
  frame:  'chart3',
  accent: 'primary',
  theme:  'chart4',
  effect: 'chart5',
  card_frame: 'chart3',
};

function useShopColors() {
  const { isDark } = useTheme();
  return useDesignSystemColors(isDark ? 'dark' : 'light');
}

function categoryColor(category: string, colors: NativeThemeColors) {
  return colors[CATEGORY_COLORS[category] ?? 'primary'] as string;
}

function getSeasonColor(season: string, colors: NativeThemeColors) {
  const token = SEASON_COLORS[season] as keyof NativeThemeColors | undefined;
  return colors[token ?? 'primary'] as string;
}

function categoryLabel(t: (k: string, o?: Record<string, unknown>) => string, category: string) {
  return category === 'card_frame'
    ? t('components.shop.categories.card_frame', { defaultValue: 'Profile border' })
    : t(`components.shop.categories.${category}`);
}

// ── Purchase history entry type ───────────────────────────────────────────────

interface PurchaseEntry {
  id:          string;
  itemId:      string;
  itemName:    string;
  starsSpent:  number;
  auraSpent:   number;
  shardsSpent: number;
  purchasedAt: string;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

function PurchaseToast({ message, type, visible }: ToastProps) {
  const colors = useShopColors();
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, tension: 180, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 8, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const bg   = type === 'success' ? colors.chart5
             : type === 'error'   ? colors.destructive
             :                      colors.primary;
  const icon = type === 'success' ? '✦' : type === 'error' ? '✕' : 'ℹ';

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { backgroundColor: bg, opacity, transform: [{ translateY }] }]}
    >
      <Text style={styles.toastIcon}>{icon}</Text>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ── Balance chip ──────────────────────────────────────────────────────────────

function BalanceChip({ icon, value, color, label }: { icon: string; value: number; color: string; label: string }) {
  const colors = useShopColors();
  return (
    <View style={styles.balChipWrap}>
      <View style={[styles.balChip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Text style={[styles.balChipIcon, { color }]}>{icon}</Text>
        <Text style={[styles.balChipNum, { color }]}>{value}</Text>
      </View>
      <Text style={[styles.balChipLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ── Seasonal badge pill ───────────────────────────────────────────────────────

function SeasonalBadge({ label }: { label: string }) {
  const colors = useShopColors();
  const color = getSeasonColor(label, colors);
  const icon  = SEASON_ICONS[label]  ?? '✦';
  return (
    <View style={[styles.seasonBadge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      <Text style={[styles.seasonBadgeText, { color }]}>{icon} {label}</Text>
    </View>
  );
}

// ── Visual cosmetic preview ───────────────────────────────────────────────────
// Shows a miniature visual of what each category looks like when equipped.
// Frames → concentric border rings. Accents → glow band. Themes → page lines.

function ItemPreview({ category, icon, color, itemId, large = false }: { category: string; color: string; icon: string; itemId: string; large?: boolean }) {
  const isAnimalEarFrame = ANIMAL_EAR_FRAME_IDS.has(itemId);
  const frameSize = large ? (isAnimalEarFrame ? 76 : itemId === 'frame_celestial_wings' ? 68 : 72) : (isAnimalEarFrame ? 40 : itemId === 'frame_celestial_wings' ? 30 : 58);
  return (
    <View style={[pv.wrap, large && pv.largeWrap, { backgroundColor: `${color}0C`, borderColor: `${color}28` }]}>
      {category === 'frame' && (
        itemId === 'frame_moonlight' || itemId === 'frame_fire' || itemId === 'frame_celestial_wings' || isAnimalEarFrame ? (
          <View style={pv.premiumFramePreview}>
            <FrameRing frameId={itemId} size={frameSize} layer="wings" />
            <View style={[pv.previewAvatar, large && pv.largePreviewAvatar, { backgroundColor: `${color}20`, borderColor: `${color}65` }]}>
              {isAnimalEarFrame
                ? <Icon name="user" size={large ? 19 : 14} color={color} strokeWidth={1.7} />
                : <Text style={[pv.icon, { color }]}>{itemId === 'frame_moonlight' ? '✧' : itemId === 'frame_celestial_wings' ? '✦' : '◉'}</Text>}
            </View>
            <FrameRing frameId={itemId} size={frameSize} layer="ornament" />
          </View>
        ) : (
          <View style={[pv.frameOuter, { borderColor: `${color}60` }]}>
            <View style={[pv.frameMid, { borderColor: `${color}40` }]}>
              <View style={[pv.frameInner, { borderColor: `${color}28`, backgroundColor: `${color}12` }]}>
                <Text style={pv.icon}>{icon}</Text>
              </View>
            </View>
          </View>
        )
      )}

      {category === 'card_frame' && (
        <View style={pv.cardFrameWrap}>
          <FounderAuroraCardFrame compact />
        </View>
      )}

      {category === 'accent' && (
        <View style={pv.accentWrap}>
          <LinearGradient
            colors={[`${color}00`, `${color}48`, `${color}00`]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={pv.accentBand}
            pointerEvents="none"
          />
          <Text style={pv.icon}>{icon}</Text>
          <View style={pv.accentDots}>
            {[0, 1, 2, 3, 4].map(d => (
              <View key={d} style={[pv.dot, { opacity: 0.15 + d * 0.08, backgroundColor: color }]} />
            ))}
          </View>
        </View>
      )}

      {category === 'theme' && (
        <View style={pv.themeWrap}>
          {[80, 100, 60, 90].map((w, l) => (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <View key={l} style={[pv.themeLine, { backgroundColor: `${color}26`, width: `${w}%` as any }]} />
          ))}
          <View style={[pv.themeIconBadge, { backgroundColor: `${color}18`, borderColor: `${color}35` }]}>
            <Text style={[pv.icon, { fontSize: 13 }]}>{icon}</Text>
          </View>
        </View>
      )}

      {category === 'effect' && itemId === 'effect_aurora_clouds' && (
        <View style={[pv.effectWrap, { position: 'relative', overflow: 'hidden', backgroundColor: '#0A0818' }]}>
          <AuroraCloudBackdrop />
          <Text style={[pv.effectIcon, { color: '#EDE8FF', zIndex: 1 }]}>✦</Text>
        </View>
      )}

      {category === 'effect' && itemId === 'effect_moonlit_muse' && (
        <View style={[pv.effectWrap, { position: 'relative', overflow: 'hidden', backgroundColor: '#10091D' }]}>
          <LinearGradient
            colors={['rgba(39,16,63,0.15)', 'rgba(118,58,171,0.4)', 'rgba(16,9,29,0.9)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
          />
          <Image
            source={MOONLIT_MUSE_IMAGE}
            resizeMode="contain"
            style={{ position: 'absolute', width: 74, height: 74, bottom: -9, left: 4 }}
          />
          <Text style={[pv.effectIcon, { color: '#F6C7FF', position: 'absolute', right: 9, top: 9 }]}>✦</Text>
          <Text style={[pv.effectIcon, { color: '#D8ABFF', position: 'absolute', left: 9, top: 11, fontSize: 11 }]}>♡</Text>
        </View>
      )}

      {category === 'effect' && itemId === 'effect_cosmic_arrival' && (
        <View style={[pv.effectWrap, { position: 'relative', overflow: 'hidden', backgroundColor: '#081226' }]}>
          <LinearGradient
            colors={['#132D55', '#11132B', '#090916']}
            start={{ x: 0.12, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ position: 'absolute', width: 58, height: 58, borderRadius: 29, left: 17, top: 19, backgroundColor: 'rgba(53,147,255,0.17)' }} />
          <View style={{ position: 'absolute', width: 38, height: 38, borderRadius: 19, left: 35, top: 42, backgroundColor: 'rgba(102,196,255,0.2)' }} />
          <View style={{ position: 'absolute', width: 26, height: 26, borderRadius: 13, left: 51, top: 58, backgroundColor: 'rgba(125,210,255,0.22)' }} />
          <Text style={{ position: 'absolute', left: 30, top: 13, color: '#FFF0BA', fontSize: 26, textShadowColor: '#FFD36E', textShadowRadius: 12 }}>✦</Text>
          <Text style={{ position: 'absolute', left: 64, top: 33, color: '#D8F5FF', fontSize: 12 }}>✧</Text>
        </View>
      )}

      {category === 'effect' && itemId !== 'effect_aurora_clouds' && itemId !== 'effect_moonlit_muse' && itemId !== 'effect_cosmic_arrival' && (
        <View style={[pv.effectWrap, { backgroundColor: `${color}0A` }]}>
          {['●', '✦', '●'].map((dot, i) => (
            <View
              key={i}
              style={[pv.effectDot, {
                backgroundColor: color,
                opacity: 0.30 + i * 0.25,
                transform: [{ scale: 0.7 + i * 0.2 }],
              }]}
            />
          ))}
          <Text style={[pv.effectIcon, { color }]}>{icon}</Text>
          {['●', '✦', '●'].map((dot, i) => (
            <View
              key={i + 3}
              style={[pv.effectDot, {
                backgroundColor: color,
                opacity: 0.80 - i * 0.25,
                transform: [{ scale: 1.1 - i * 0.2 }],
              }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Shop item card ────────────────────────────────────────────────────────────

interface ItemCardProps {
  item:       ShopItem;
  owned:      boolean;
  isActive:   boolean;
  canAfford:  boolean;
  onBuy:      (item: ShopItem) => void;
  onActivate: (item: ShopItem) => void;
  purchasing: boolean;
  founderLocked?: boolean;
}

function ItemCard({ item, owned, isActive, canAfford, onBuy, onActivate, purchasing, founderLocked = false }: ItemCardProps) {
  const { t } = useTranslation();
  const colors   = useShopColors();
  const { isDark } = useTheme();
  const mode: NativeThemeMode = isDark ? 'dark' : 'light';
  const catColor = categoryColor(item.category, colors);

  // availableNow is only set to false for out-of-season seasonal items
  const availableNow = item.availableNow !== false;

  const costParts: React.ReactNode[] = [];
  if (item.cost.stars)  costParts.push(<Text key="s" style={[styles.costPart, { color: colors.chart3 }]}>✦ {item.cost.stars}</Text>);
  if (item.cost.aura)   costParts.push(<Text key="a" style={[styles.costPart, { color: colors.primary }]}>◈ {item.cost.aura}</Text>);
  if (item.cost.shards) costParts.push(<Text key="h" style={[styles.costPart, { color: colors.chart4 }]}>◇ {item.cost.shards}</Text>);

  const isUnavailable = (!availableNow || founderLocked) && !owned;
  const disabled      = isUnavailable || (!owned && (!canAfford || purchasing));

  return (
    <View style={styles.cardWrapper}>
        <View style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: isActive ? catColor : owned ? `${catColor}60` : colors.border },
          (owned || isActive) && { borderWidth: 1.5 },
          isActive && { backgroundColor: `${catColor}0A` },
          isUnavailable && { opacity: 0.72 },
        ]}>
          <View style={[styles.cardPreview, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <ItemPreview category={item.category} icon={item.icon} color={catColor} itemId={item.id} large />
            {(owned || isUnavailable) && (
              <View style={[
                styles.cardStatus,
                { backgroundColor: colors.card, borderColor: isActive ? catColor : colors.border },
              ]}>
                <Text style={[styles.cardStatusText, { color: isActive ? catColor : colors.mutedForeground }]}>
                  {isActive
                    ? t('components.shop.active')
                    : owned
                      ? t('components.shop.owned', { defaultValue: 'Owned' })
                      : founderLocked
                        ? t('components.shop.founderExclusive', { defaultValue: 'Founder' })
                        : t('components.shop.returns')}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.cardTitleArea}>
              <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.cardCategory, { color: catColor }]} numberOfLines={1}>
                {categoryLabel(t, item.category)}
              </Text>
              {item.seasonal && item.seasonalLabel && (
                <SeasonalBadge label={item.seasonalLabel} />
              )}
            </View>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text>
            <View style={styles.cardFooter}>
              <View style={styles.costRow}>
                {costParts.length === 0
                  ? <Text style={[styles.costPart, { color: catColor }]}>{t('components.shop.free', { defaultValue: 'Free' })}</Text>
                  : costParts.reduce<React.ReactNode[]>((acc, p, i) => {
                      if (i > 0) acc.push(<Text key={`sep${i}`} style={styles.costSep}>+</Text>);
                      acc.push(p);
                      return acc;
                    }, [])}
              </View>

              {owned ? (
                <KindnessButton
                  label={isActive ? t('components.shop.active') : t('components.shop.setActive')}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onActivate(item); }}
                  mode={mode}
                  variant={isActive ? 'primary' : 'outline'}
                  size="small"
                  accessibilityLabel={isActive ? t('components.shop.active') : t('components.shop.setActive')}
                  style={[
                    styles.actionButton,
                    { backgroundColor: isActive ? catColor : colors.muted, borderColor: isActive ? catColor : colors.border },
                  ]}
                  labelStyle={[styles.actionButtonLabel, { color: isActive ? colors.primaryForeground : colors.foreground }]}
                />
              ) : founderLocked ? (
                <View style={[styles.returnsBadge, { backgroundColor: `${catColor}14`, borderColor: `${catColor}55` }]}>
                  <Text style={[styles.returnsBadgeText, { color: catColor }]}>
                    {t('components.shop.founderExclusive', { defaultValue: 'Founder exclusive' })}
                  </Text>
                </View>
              ) : !availableNow ? (
                <View style={[styles.returnsBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.returnsBadgeText, { color: colors.mutedForeground }]}>
                    {t('components.shop.returns')}
                  </Text>
                </View>
              ) : (
                <KindnessButton
                  label={purchasing ? '…' : canAfford ? t('components.shop.get') : t('components.shop.needMore')}
                  onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBuy(item); } }}
                  mode={mode}
                  variant="primary"
                  size="small"
                  disabled={disabled}
                  accessibilityLabel={purchasing ? t('components.shop.purchasing', { defaultValue: 'Purchasing' }) : canAfford ? t('components.shop.get') : t('components.shop.needMore')}
                  style={[
                    styles.actionButton,
                    { backgroundColor: canAfford ? catColor : colors.muted, borderColor: canAfford ? catColor : colors.border },
                  ]}
                  labelStyle={[styles.actionButtonLabel, { color: canAfford ? colors.primaryForeground : colors.mutedForeground }]}
                />
              )}
            </View>
          </View>
        </View>
    </View>
  );
}

// ── Collection row ────────────────────────────────────────────────────────────

interface CollectionRowProps {
  entry:      PurchaseEntry;
  isActive:   boolean;
  onActivate: (itemId: string) => void;
}

function CollectionRow({ entry, isActive, onActivate }: CollectionRowProps) {
  const { t } = useTranslation();
  const colors   = useShopColors();
  const { isDark } = useTheme();
  const mode: NativeThemeMode = isDark ? 'dark' : 'light';
  const category = COSMETIC_CATEGORY_MAP[entry.itemId] ?? 'frame';
  const catColor = categoryColor(category, colors);
  const icon     = ITEM_ICON_MAP[entry.itemId] ?? '✦';

  const date = new Date(entry.purchasedAt);
  const dateStr = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const costParts: React.ReactNode[] = [];
  if (entry.starsSpent  > 0) costParts.push(<Text key="s" style={[styles.collCostPart, { color: colors.chart3 }]}>✦ {entry.starsSpent}</Text>);
  if (entry.auraSpent   > 0) costParts.push(<Text key="a" style={[styles.collCostPart, { color: colors.primary }]}>◈ {entry.auraSpent}</Text>);
  if (entry.shardsSpent > 0) costParts.push(<Text key="h" style={[styles.collCostPart, { color: colors.chart4 }]}>◇ {entry.shardsSpent}</Text>);

  return (
    <View style={[
      styles.collRow,
      { backgroundColor: colors.card, borderColor: isActive ? catColor : `${catColor}40` },
      isActive && { borderWidth: 1.5, backgroundColor: `${catColor}0A` },
    ]}>
      <View style={[styles.collIconWrap, { backgroundColor: isActive ? `${catColor}28` : `${catColor}18` }]}>
        <Text style={[styles.collIcon, { color: catColor }]}>{icon}</Text>
      </View>

      <View style={styles.collInfo}>
        <View style={styles.collTitleRow}>
          <Text style={[styles.collName, { color: colors.foreground }]} numberOfLines={1}>{entry.itemName}</Text>
          <View style={[styles.catBadge, { backgroundColor: `${catColor}18` }]}>
            <Text style={[styles.catBadgeText, { color: catColor }]}>{categoryLabel(t, category)}</Text>
          </View>
        </View>
        <View style={styles.collMeta}>
          <View style={styles.collCostRow}>
            {costParts.reduce<React.ReactNode[]>((acc, p, i) => {
              if (i > 0) acc.push(<Text key={`sep${i}`} style={styles.costSep}>+</Text>);
              acc.push(p); return acc;
            }, [])}
          </View>
          <Text style={[styles.collDate, { color: colors.mutedForeground }]}>{dateStr}</Text>
        </View>
      </View>

      <KindnessButton
        label={isActive ? t('components.shop.active') : t('components.shop.setActive')}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onActivate(entry.itemId); }}
        mode={mode}
        variant={isActive ? 'primary' : 'outline'}
        size="small"
        style={[
          styles.actionButton,
          { backgroundColor: isActive ? catColor : colors.muted, borderColor: isActive ? catColor : colors.border },
        ]}
        labelStyle={[styles.actionButtonLabel, { color: isActive ? colors.primaryForeground : colors.foreground }]}
      />
    </View>
  );
}

// ── Collection tab ────────────────────────────────────────────────────────────

interface CollectionTabProps {
  visible: boolean;
  purchaseVersion: number;
  catalogItems: ShopItem[];
}

function CollectionTab({ visible, purchaseVersion, catalogItems }: CollectionTabProps) {
  const { t } = useTranslation();
  const colors  = useShopColors();
  const { activeCosmetics, setActiveCosmetic, character } = useApp();
  const isFounder = !!character?.isFounder;
  const [purchases,      setPurchases]      = useState<PurchaseEntry[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error,          setError]          = useState(false);
  // true while a background refresh is running (cache already shown)
  const [refreshing, setRefreshing] = useState(false);
  // Founder entitlements have no purchase record — surface them from the catalog.
  const purchasedSet = new Set(purchases.map(p => p.itemId));
  const founderItems = isFounder
    ? catalogItems.filter(i => (i.founderOnly || i.id === 'card_frame_founder_regalia') && !purchasedSet.has(i.id))
    : [];
  const founderCatColor = categoryColor('card_frame', colors);

  // Track whether we need to force a fresh fetch (post-purchase)
  const needsRefresh = useRef(true);
  // Track the last purchaseVersion we've synced
  const lastPurchaseVersion = useRef(-1);

  // When a purchase completes, mark that we need a fresh fetch
  useEffect(() => {
    if (purchaseVersion !== lastPurchaseVersion.current) {
      lastPurchaseVersion.current = purchaseVersion;
      needsRefresh.current = true;
    }
  }, [purchaseVersion]);

  // Main fetch logic: called on every open
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    async function loadCollection() {
      // 1. Try AsyncStorage first for an instant view
      try {
        const raw = await AsyncStorage.getItem(COLLECTION_CACHE_KEY);
        if (raw && !cancelled) {
          const cached: PurchaseEntry[] = JSON.parse(raw);
          setPurchases(cached);
          setInitialLoading(false);
          setError(false);
        } else if (!cancelled) {
          // No cache yet — show spinner for the first real fetch
          setInitialLoading(true);
        }
      } catch {
        if (!cancelled) setInitialLoading(true);
      }

      // 2. Always do a background API refresh — silently if cache was shown,
      //    or with a spinner if this is the very first load (no cache).
      if (!cancelled) setRefreshing(true);

      try {
        const data = await apiFetch<PurchaseEntry[]>('/rewards/purchases');
        if (!cancelled) {
          setPurchases(data);
          setInitialLoading(false);
          setError(false);
          needsRefresh.current = false;
          // Write fresh data to cache
          AsyncStorage.setItem(COLLECTION_CACHE_KEY, JSON.stringify(data)).catch(() => null);
        }
      } catch {
        if (!cancelled) {
          // Only show error state if we have nothing to display
          setPurchases(prev => {
            if (prev.length === 0) setError(true);
            return prev;
          });
          setInitialLoading(false);
        }
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }

    loadCollection();

    return () => { cancelled = true; };
    // Re-run whenever the tab becomes visible or a purchase invalidates the cache
  }, [visible, purchaseVersion]);

  if (initialLoading) {
    return (
      <View style={styles.collCenter}>
        <ActivityIndicator size="small" color="#9878D8" />
        <Text style={[styles.collHint, { color: colors.mutedForeground }]}>{t('components.shop.loadingCollection')}</Text>
      </View>
    );
  }

  if (error && purchases.length === 0 && founderItems.length === 0) {
    return (
      <View style={styles.collCenter}>
        <Text style={styles.collEmptyIcon}>✕</Text>
        <Text style={[styles.collEmptyText, { color: colors.foreground }]}>{t('components.shop.collectionLoadError')}</Text>
        <Text style={[styles.collHint, { color: colors.mutedForeground }]}>{t('components.shop.connectionRetry')}</Text>
      </View>
    );
  }

  if (purchases.length === 0 && founderItems.length === 0) {
    return (
      <View style={styles.collCenter}>
        <Text style={styles.collEmptyIcon}>✦</Text>
        <Text style={[styles.collEmptyText, { color: colors.foreground }]}>{t('components.shop.emptyCollection')}</Text>
        <Text style={[styles.collHint, { color: colors.mutedForeground }]}>
          {t('components.shop.collectionEmpty')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.collList}
      showsVerticalScrollIndicator={false}
    >
      {founderItems.length > 0 && (
        <View style={{ gap: 10, marginBottom: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: founderCatColor }}>
            {t('components.shop.includedWithFounder', { defaultValue: 'Included with Founder' })}
          </Text>
          {founderItems.map(item => {
            const category = COSMETIC_CATEGORY_MAP[item.id] ?? item.category;
            return (
              <ItemCard
                key={item.id}
                item={item}
                owned
                isActive={activeCosmetics[category] === item.id}
                canAfford
                onBuy={() => undefined}
                onActivate={it => setActiveCosmetic(it.id)}
                purchasing={false}
              />
            );
          })}
        </View>
      )}
      {purchases.map(entry => (
        <CollectionRow
          key={entry.id}
          entry={entry}
          isActive={activeCosmetics[COSMETIC_CATEGORY_MAP[entry.itemId] ?? 'frame'] === entry.itemId}
          onActivate={setActiveCosmetic}
        />
      ))}
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        {purchases.length} {purchases.length === 1 ? 'treasure' : 'treasures'} collected ✦
        {refreshing ? '  ↻' : ''}
      </Text>
    </ScrollView>
  );
}

// ── Tab switcher ──────────────────────────────────────────────────────────────

type ActiveTab = 'shop' | 'collection';

function TabSwitcher({ active, onChange, colors }: { active: ActiveTab; onChange: (t: ActiveTab) => void; colors: NativeThemeColors }) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const mode: NativeThemeMode = isDark ? 'dark' : 'light';
  return (
    <View style={[styles.tabSwitcher, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      {(['shop', 'collection'] as ActiveTab[]).map(tab => {
        const isActive = tab === active;
        return (
          <KindnessButton
            key={tab}
            label={tab === 'shop' ? `✦ ${t('components.shop.shopTab')}` : `◇ ${t('components.shop.collectionTab')}`}
            onPress={() => onChange(tab)}
            mode={mode}
            variant={isActive ? 'primary' : 'ghost'}
            size="small"
            style={[styles.tabBtn, { borderRadius: colors.radius }]}
            labelStyle={[styles.tabBtnText, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}
          />
        );
      })}
    </View>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface ShopModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ShopModal({ visible, onClose }: ShopModalProps) {
  const { t } = useTranslation();
  const colors  = useShopColors();
  const { isDark } = useTheme();
  const mode: NativeThemeMode = isDark ? 'dark' : 'light';
  const insets  = useSafeAreaInsets();
  const { rewardBalance, reloadRewards, purchasedIds, activeCosmetics, setActiveCosmetic, markPurchased, character } = useApp();
  const isFounder = !!character?.isFounder;

  // Refresh balance in background every time the modal opens so the chip
  // shows the cached value instantly and updates silently when the API responds.
  useEffect(() => {
    if (visible) reloadRewards().catch(() => null);
  }, [visible, reloadRewards]);

  const [activeTab,       setActiveTab]       = useState<ActiveTab>('shop');
  const [filterCat,       setFilterCat]       = useState<string | null>(null);
  const [showEarnGuide,   setShowEarnGuide]   = useState(false);
  const [catalogItems,    setCatalogItems]    = useState<ShopItem[]>(FALLBACK_CATALOG);
  const [previewItems,    setPreviewItems]    = useState<ShopItem[]>([]);
  const [purchasing,      setPurchasing]      = useState<string | null>(null);
  const [purchaseVersion, setPurchaseVersion] = useState(0);
  const [toast,        setToast]        = useState<{ message: string; type: ToastProps['type'] } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slideY = useRef(new Animated.Value(600)).current;

  // Reset to shop tab + clear category filter when modal re-opens
  useEffect(() => {
    if (visible) { setActiveTab('shop'); setFilterCat(null); }
  }, [visible]);

  // Load catalog — always fetch fresh from API (no stale cache reads)
  useEffect(() => {
    if (!visible) return;
    Animated.spring(slideY, { toValue: 0, tension: 55, friction: 13, useNativeDriver: true }).start();

    // Reset to fallback immediately so any stale in-memory state is cleared
    setCatalogItems(FALLBACK_CATALOG);
    setPreviewItems([]);

    // Clear any stale persisted cache so it never poisons a future session
    AsyncStorage.removeItem(SHOP_CATALOG_CACHE_KEY).catch(() => null);

    let cancelled = false;

    async function fetchCatalog() {
      // Always fetch fresh — ?t= param busts the native HTTP cache (prevents 304)
      try {
        const data = await apiFetch<{
          catalog:         ShopItem[];
          seasonalPreview: ShopItem[];
          purchasedIds:    string[];
          activeCosmetics: Record<string, string>;
        }>(`/rewards/shop?t=${Date.now()}`);
        if (!cancelled) {
          setCatalogItems(data.catalog.length > 0 ? data.catalog : FALLBACK_CATALOG);
          setPreviewItems(data.seasonalPreview ?? []);
        }
      } catch {
        if (!cancelled) {
          // Network/auth failed — FALLBACK_CATALOG (already set above) stays visible
        }
      }
    }

    fetchCatalog();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      Animated.timing(slideY, { toValue: 600, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function showToast(message: string, type: ToastProps['type']) {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  const handleBuy = useCallback(async (item: ShopItem) => {
    setPurchasing(item.id);
    try {
      const res = await apiFetch<{
        success:    boolean;
        newBalance: { stars: number; auraEnergy: number; memoryShards: number; lifetimeStars: number };
      }>('/rewards/spend', {
        method: 'POST',
        body:   JSON.stringify({ itemId: item.id }),
      });
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        markPurchased(item.id);
        showToast(t('components.shop.purchaseSuccess', { icon: item.icon, name: item.name }), 'success');
        reloadRewards();
        setPurchaseVersion(v => v + 1);
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('already_owned')) {
        showToast(t('components.shop.owned'), 'info');
        markPurchased(item.id);
      } else if (msg.includes('seasonal_unavailable') || msg.includes('403')) {
        showToast(t('components.shop.outOfSeason'), 'info');
      } else if (msg.includes('insufficient_funds') || msg.includes('402')) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast(t('components.shop.notEnoughCurrency'), 'error');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast(t('components.shop.purchaseError'), 'error');
      }
    } finally {
      setPurchasing(null);
    }
  }, [reloadRewards, markPurchased, t]);

  function canAfford(item: ShopItem): boolean {
    const costs = [item.cost.stars ?? 0, item.cost.aura ?? 0, item.cost.shards ?? 0];
    if (costs.every(cost => cost === 0)) return true;
    if (!rewardBalance) return false;
    return (
      (rewardBalance.stars        >= (item.cost.stars  ?? 0)) &&
      (rewardBalance.auraEnergy   >= (item.cost.aura   ?? 0)) &&
      (rewardBalance.memoryShards >= (item.cost.shards ?? 0))
    );
  }

  const stars  = rewardBalance?.stars        ?? 0;
  const aura   = rewardBalance?.auraEnergy   ?? 0;
  const shards = rewardBalance?.memoryShards ?? 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 },
          { transform: [{ translateY: slideY }] },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              {t('components.shop.personalizeLabel', { defaultValue: 'PERSONALIZE YOUR PROFILE' })}
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{t('components.shop.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {t('components.shop.subtitle', { defaultValue: 'Choose little details that feel like you.' })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
            style={[styles.closeBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
          >
            <Icon name="x" size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabSwitcherWrap}>
          <TabSwitcher active={activeTab} onChange={setActiveTab} colors={colors} />
        </View>

        {activeTab === 'shop' ? (
          <>
            {/* Balance */}
            <View style={[styles.balanceRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.balLabel, { color: colors.mutedForeground }]}>{t('components.shop.balanceTitle')}</Text>
              </View>
              <View style={styles.balChips}>
                <BalanceChip icon="✦" value={stars}  color={colors.chart3} label={t('components.shop.stars')} />
                <BalanceChip icon="◈" value={aura}   color={colors.primary} label={t('components.shop.aura')} />
                <BalanceChip icon="◇" value={shards} color={colors.chart4} label={t('components.shop.shards')} />
              </View>
            </View>

            <KindnessButton
              label={t('components.shop.howToEarn')}
              onPress={() => setShowEarnGuide(value => !value)}
              mode={mode}
              variant="ghost"
              size="small"
              accessibilityLabel={t('components.shop.howToEarn')}
              style={styles.earnToggle}
              labelStyle={[styles.earnToggleLabel, { color: colors.mutedForeground }]}
            />
            {showEarnGuide && (
              <View style={[styles.earnGuide, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {[
                  { icon: '✦', color: colors.chart3, name: t('components.shop.stars'), tips: t('components.shop.earnStars') },
                  { icon: '◈', color: colors.primary, name: t('components.shop.aura'), tips: t('components.shop.earnAura') },
                  { icon: '◇', color: colors.chart4, name: t('components.shop.shards'), tips: t('components.shop.earnShards') },
                ].map(({ icon, color, name, tips }) => (
                  <View key={name} style={styles.earnGuideRow}>
                    <Text style={[styles.earnGuideIcon, { color }]}>{icon}</Text>
                    <Text style={[styles.earnGuideName, { color }]}>{name}</Text>
                    <Text style={[styles.earnGuideTips, { color: colors.mutedForeground }]}>{tips}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Category filter pills */}
            {(() => {
              const cats: { id: string | null; label: string; icon: string; color: string }[] = [
                { id: null,     label: t('components.shop.all'), icon: '✦', color: colors.primary },
                { id: 'ears',   label: t('components.shop.categories.ears', { defaultValue: 'Animal ears' }), icon: '⌁', color: categoryColor('ears', colors) },
                { id: 'frame',  label: t('components.shop.categories.frame'), icon: '◉', color: categoryColor('frame', colors) },
                { id: 'effect', label: t('components.shop.categories.effect'), icon: '✧', color: categoryColor('effect', colors) },
                { id: 'accent', label: t('components.shop.categories.accent'), icon: '◈', color: categoryColor('accent', colors) },
                { id: 'theme',  label: t('components.shop.categories.theme'), icon: '⋆', color: categoryColor('theme', colors) },
                { id: 'card_frame', label: categoryLabel(t, 'card_frame'), icon: '◆', color: categoryColor('card_frame', colors) },
              ];
              return (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
                  {cats.map(c => {
                    const active = filterCat === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id ?? 'all'}
                        onPress={() => setFilterCat(c.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.filterPill,
                          { backgroundColor: active ? `${c.color}20` : colors.muted, borderColor: active ? c.color : colors.border },
                        ]}
                      >
                        <Text style={[styles.filterPillText, { color: active ? c.color : colors.mutedForeground }]}>
                          {c.icon} {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              );
            })()}

            {/* Items — split into This Season + Always Available */}
            {(() => {
              const visible_catalog = filterCat === 'ears'
                ? catalogItems.filter(i => ANIMAL_EAR_FRAME_IDS.has(i.id))
                : filterCat
                  ? catalogItems.filter(i => i.category === filterCat)
                : catalogItems;
              const visible_preview_items = filterCat === 'ears'
                ? previewItems.filter(i => ANIMAL_EAR_FRAME_IDS.has(i.id))
                : filterCat
                  ? previewItems.filter(i => i.category === filterCat)
                  : previewItems;
              const seasonalItems  = visible_catalog.filter(i => i.seasonal);
              const permanentItems = visible_catalog.filter(i => !i.seasonal);

              // Derive current season label + colour from the first seasonal item
              const seasonLabel = seasonalItems[0]?.seasonalLabel ?? null;
              const seasonAccent = seasonLabel ? getSeasonColor(seasonLabel, colors) : colors.primary;
              const seasonIcon  = seasonLabel ? (SEASON_ICONS[seasonLabel]  ?? '✦')       : '✦';

              function renderItem(item: ShopItem, overrides?: Partial<ShopItem>) {
                const founderOnly = !!item.founderOnly || item.id === 'card_frame_founder_regalia';
                const owned    = purchasedIds.includes(item.id) || (founderOnly && isFounder);
                const category = COSMETIC_CATEGORY_MAP[item.id];
                const isActive = owned && !!category && activeCosmetics[category] === item.id;
                return (
                  <ItemCard
                    key={item.id}
                    item={overrides ? { ...item, ...overrides } : item}
                    owned={owned}
                    isActive={isActive}
                    canAfford={canAfford(item)}
                    onBuy={handleBuy}
                    onActivate={it => setActiveCosmetic(it.id)}
                    purchasing={purchasing === item.id}
                    founderLocked={founderOnly && !isFounder}
                  />
                );
              }

              return (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.itemList}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.resultsHeader}>
                    <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
                      {filterCat === 'ears'
                        ? t('components.shop.categories.ears', { defaultValue: 'Animal ears' })
                        : filterCat
                          ? categoryLabel(t, filterCat)
                          : t('components.shop.discoverItems', { defaultValue: 'Discover something for your profile' })}
                    </Text>
                    <Text style={[styles.resultsCount, { color: colors.mutedForeground }]}>
                      {visible_catalog.length}
                    </Text>
                  </View>
                  {/* ── This Season ─────────────────────────────── */}
                  {seasonalItems.length > 0 && (
                    <>
                      <View style={[styles.seasonHeader, { borderColor: `${seasonAccent}30`, backgroundColor: `${seasonAccent}0C` }]}>
                        <Text style={[styles.seasonHeaderIcon]}>{seasonIcon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.seasonHeaderTitle, { color: seasonAccent }]}>
                            {t('components.shop.seasonCollection', { season: seasonLabel })}
                          </Text>
                          <Text style={[styles.seasonHeaderSub, { color: colors.mutedForeground }]}>
                            {t('components.shop.seasonOnly')}
                          </Text>
                        </View>
                        <SeasonalBadge label={seasonLabel!} />
                      </View>
                      <View style={styles.itemGrid}>
                        {seasonalItems.map(item => renderItem(item))}
                      </View>

                      <View style={styles.sectionDivider}>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>{t('components.shop.alwaysAvailable')}</Text>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                      </View>
                    </>
                  )}

                  {/* ── Permanent items ──────────────────────────── */}
                  {permanentItems.length > 0 && (
                    <View style={styles.itemGrid}>
                      {permanentItems.map(item => renderItem(item))}
                    </View>
                  )}

                  {/* ── Out-of-season preview ────────────────────── */}
                  {visible_preview_items.length > 0 && (
                    <>
                      <View style={styles.sectionDivider}>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>{t('components.shop.futureSeason')}</Text>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                      </View>
                      <View style={styles.itemGrid}>
                        {visible_preview_items.map(item => renderItem(item, { availableNow: false }))}
                      </View>
                    </>
                  )}

                  <Text style={[styles.footer, { color: colors.mutedForeground }]}>
                    {t('components.shop.moreItems')}
                  </Text>
                </ScrollView>
              );
            })()}
          </>
        ) : (
          <CollectionTab visible={activeTab === 'collection'} purchaseVersion={purchaseVersion} catalogItems={catalogItems} />
        )}

        {/* Toast */}
        {toast && (
          <PurchaseToast message={toast.message} type={toast.type} visible={!!toast} />
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// ── ItemPreview styles ────────────────────────────────────────────────────────
const pv = StyleSheet.create({
  cardFrameWrap: { width: 46, height: 50, alignItems: 'center', justifyContent: 'center' },
  wrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  largeWrap: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
    borderRadius: 0,
  },
  icon: { fontSize: 18 },
  premiumFramePreview: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largePreviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  // Frame: concentric border rings
  frameOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameMid: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Accent: glow band
  accentWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 22,
  },
  accentDots: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Theme: journal lines
  themeWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  themeLine: {
    height: 3,
    borderRadius: 2,
  },
  themeIconBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Effect: floating particle row
  effectWrap: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  effectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  effectIcon: {
    fontSize: 19,
  },
});

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab switcher
  tabSwitcherWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  tabSwitcher: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabBtnText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.2,
  },

  // Balance
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  balLabel: {
    fontSize: 11,
    fontFamily: 'Satoshi-Medium',
    letterSpacing: 0.2,
  },
  balChips: {
    flexDirection: 'row',
    gap: 6,
  },
  balChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  balChipIcon:  { fontSize: 11 },
  balChipNum:   { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  balChipWrap:  { alignItems: 'center', gap: 3 },
  balChipLabel: { fontSize: 9, fontFamily: 'Satoshi-Medium', letterSpacing: 0.4 },
  balHint:      { fontSize: 10, fontFamily: 'Satoshi-Regular', marginTop: 2, fontStyle: 'italic' },

  // Earn guide
  earnGuide: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  earnToggle: {
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 4,
    minHeight: 32,
    paddingHorizontal: 8,
  },
  earnToggleLabel: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  earnGuideTitle: { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 0.9 },
  earnGuideGrid:  { gap: 6 },
  // Category filter pills
  filterRow:        { flexShrink: 0, marginBottom: 4 },
  filterRowContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       'transparent',
    backgroundColor:   'transparent',
  },
  filterPillText: { fontSize: 12, fontFamily: 'Satoshi-Medium', letterSpacing: -0.1 },

  earnGuideRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  earnGuideIcon:  { fontSize: 13, lineHeight: 18, width: 18, textAlign: 'center' },
  earnGuideName:  { fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: -0.1, lineHeight: 16 },
  earnGuideTips:  { flex: 1, fontSize: 10, fontFamily: 'Satoshi-Regular', lineHeight: 15 },

  // Item list
  itemList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    paddingBottom: 2,
  },
  resultsTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.2,
  },
  resultsCount: {
    minWidth: 26,
    textAlign: 'right',
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },

  // Card
  cardWrapper: {
    width: '48%',
  },
  card: {
    width: '100%',
    minHeight: 238,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  cardPreview: {
    height: 112,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardStatus: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  cardStatusText: {
    fontSize: 8,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.25,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardIcon: { fontSize: 22 },
  cardInfo: { flex: 1, gap: 5 },
  cardTitleArea: { gap: 2, minHeight: 38 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardName: {
    fontSize: 13,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  cardCategory: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  catBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  catBadgeText: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  seasonBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  seasonBadgeText: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.4,
  },
  cardDesc: {
    fontSize: 10,
    fontFamily: 'Satoshi-Regular',
    lineHeight: 14,
    minHeight: 28,
  },
  cardFooter: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    marginTop: 2,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  costPart: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
  },
  costSep: {
    fontSize: 10,
    color: 'rgba(150,140,160,0.6)',
    fontFamily: 'Satoshi-Regular',
  },
  ownedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  ownedBadgeText: {
    fontSize: 11,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.2,
  },
  returnsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  returnsBadgeText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Medium',
    letterSpacing: 0.1,
    fontStyle: 'italic',
  },
  buyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  buyBtnText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.2,
  },
  actionButton: {
    width: '100%',
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 8,
  },
  actionButtonLabel: {
    fontSize: 11,
    letterSpacing: 0,
    textAlign: 'center',
  },

  // ── Season section header ─────────────────────────────────────────────────
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  seasonHeaderIcon:  { fontSize: 22, lineHeight: 26 },
  seasonHeaderTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.1 },
  seasonHeaderSub:   { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 1 },

  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Medium',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },

  footer: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic',
    marginTop: 8,
    paddingBottom: 4,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  toastIcon: { fontSize: 15, color: '#fff' },
  toastText: { fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#fff', flex: 1 },

  // Collection
  collList: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 8,
  },
  collRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  collIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  collIcon: { fontSize: 20 },
  collInfo: { flex: 1, gap: 4 },
  collTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  collName: {
    fontSize: 13,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  collMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  collCostPart: {
    fontSize: 11,
    fontFamily: 'Satoshi-Bold',
  },
  collDate: {
    fontSize: 10,
    fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic',
  },
  collCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 8,
  },
  collEmptyIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  collEmptyText: {
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  collHint: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 2,
  },
});
