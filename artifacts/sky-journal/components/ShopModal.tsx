import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { apiFetch, useApp, COSMETIC_CATEGORY_MAP, type ShopItem } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Icon } from '@/components/Icon';

const COLLECTION_CACHE_KEY  = 'collection_v1';
const SHOP_CATALOG_CACHE_KEY = 'shop_catalog_v2';

// ── Seasonal constants ────────────────────────────────────────────────────────

const SEASON_COLORS: Record<string, string> = {
  Spring: '#E88FB0',
  Summer: '#C8A84B',
  Autumn: '#C8784B',
  Winter: '#78B4DC',
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
};

// Static fallback — effects only, shown instantly before API responds
const FALLBACK_CATALOG: ShopItem[] = [
  { id: 'effect_butterfly', name: 'Ethereal Butterflies', description: 'Luminous butterflies drift across your profile, wings catching the light of distant stars.', icon: '🦋', category: 'effect', cost: { stars: 0 } },
  { id: 'effect_fireflies', name: 'Firefly Glow',         description: 'Golden fireflies blink softly around you like scattered wishes under a summer sky.',         icon: '✨', category: 'effect', cost: { stars: 0 } },
  { id: 'effect_hearts',    name: 'Floating Hearts',      description: 'Soft hearts rise gently from below, carrying warmth to every corner of your sky.',           icon: '💜', category: 'effect', cost: { stars: 0 } },
];

const CATEGORY_LABELS: Record<string, string> = {
  frame:  'Profile Frame',
  accent: 'Bio Accent',
  theme:  'Journal Theme',
  effect: 'Profile Effect',
};

const CATEGORY_COLORS: Record<string, string> = {
  frame:  '#C8A84B',
  accent: '#9878D8',
  theme:  '#78B4DC',
  effect: '#70C8A0',
};

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

  const bg   = type === 'success' ? 'rgba(104,200,160,0.96)'
             : type === 'error'   ? 'rgba(220,80,80,0.96)'
             :                      'rgba(107,91,149,0.96)';
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

function BalanceChip({ icon, value, color, bg, label }: { icon: string; value: number; color: string; bg: string; label: string }) {
  return (
    <View style={styles.balChipWrap}>
      <View style={[styles.balChip, { backgroundColor: bg, borderColor: `${color}44` }]}>
        <Text style={[styles.balChipIcon, { color }]}>{icon}</Text>
        <Text style={[styles.balChipNum, { color }]}>{value}</Text>
      </View>
      <Text style={[styles.balChipLabel, { color: `${color}AA` }]}>{label}</Text>
    </View>
  );
}

// ── Seasonal badge pill ───────────────────────────────────────────────────────

function SeasonalBadge({ label }: { label: string }) {
  const color = SEASON_COLORS[label] ?? '#9878D8';
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

function ItemPreview({ category, icon, color }: { category: string; color: string; icon: string }) {
  return (
    <View style={[pv.wrap, { backgroundColor: `${color}0C`, borderColor: `${color}28` }]}>
      {category === 'frame' && (
        <View style={[pv.frameOuter, { borderColor: `${color}60` }]}>
          <View style={[pv.frameMid, { borderColor: `${color}40` }]}>
            <View style={[pv.frameInner, { borderColor: `${color}28`, backgroundColor: `${color}12` }]}>
              <Text style={pv.icon}>{icon}</Text>
            </View>
          </View>
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

      {category === 'effect' && (
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
}

function ItemCard({ item, owned, isActive, canAfford, onBuy, onActivate, purchasing }: ItemCardProps) {
  const colors   = useColors();
  const scale    = useRef(new Animated.Value(1)).current;
  const catColor = CATEGORY_COLORS[item.category] ?? '#9878D8';

  // availableNow is only set to false for out-of-season seasonal items
  const availableNow = item.availableNow !== false;

  function pressIn()  { Animated.spring(scale, { toValue: 0.95, tension: 200, friction: 8, useNativeDriver: true }).start(); }
  function pressOut() { Animated.spring(scale, { toValue: 1,    tension: 200, friction: 8, useNativeDriver: true }).start(); }

  const costParts: React.ReactNode[] = [];
  if (item.cost.stars)  costParts.push(<Text key="s" style={[styles.costPart, { color: '#C8A84B' }]}>✦ {item.cost.stars}</Text>);
  if (item.cost.aura)   costParts.push(<Text key="a" style={[styles.costPart, { color: '#9878D8' }]}>◈ {item.cost.aura}</Text>);
  if (item.cost.shards) costParts.push(<Text key="h" style={[styles.costPart, { color: '#78B4DC' }]}>◇ {item.cost.shards}</Text>);

  const isUnavailable = !availableNow && !owned;
  const disabled      = isUnavailable || (!owned && (!canAfford || purchasing));

  function handlePress() {
    if (isUnavailable) return;
    if (owned) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onActivate(item);
    } else if (canAfford && !purchasing) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onBuy(item);
    }
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={isUnavailable ? undefined : pressIn}
        onPressOut={isUnavailable ? undefined : pressOut}
        activeOpacity={1}
        disabled={disabled}
      >
        <View style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: isActive ? catColor : owned ? `${catColor}60` : colors.border },
          (owned || isActive) && { borderWidth: 1.5 },
          isActive && { backgroundColor: `${catColor}0A` },
          isUnavailable && { opacity: 0.72 },
        ]}>
          {/* Visual preview */}
          <ItemPreview category={item.category} icon={item.icon} color={catColor} />

          {/* Info */}
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.catBadge, { backgroundColor: `${catColor}18` }]}>
                <Text style={[styles.catBadgeText, { color: catColor }]}>{CATEGORY_LABELS[item.category]}</Text>
              </View>
              {item.seasonal && item.seasonalLabel && (
                <SeasonalBadge label={item.seasonalLabel} />
              )}
            </View>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text>
            <View style={styles.cardFooter}>
              <View style={styles.costRow}>{costParts.reduce<React.ReactNode[]>((acc, p, i) => {
                if (i > 0) acc.push(<Text key={`sep${i}`} style={styles.costSep}>+</Text>);
                acc.push(p); return acc;
              }, [])}</View>

              {owned ? (
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onActivate(item); }}
                  style={[
                    styles.ownedBadge,
                    isActive
                      ? { backgroundColor: catColor }
                      : { backgroundColor: `${catColor}22` },
                  ]}
                >
                  <Text style={[styles.ownedBadgeText, { color: isActive ? '#fff' : catColor }]}>
                    {isActive ? '✦ Active' : 'Set Active'}
                  </Text>
                </TouchableOpacity>
              ) : !availableNow ? (
                <View style={[styles.returnsBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.returnsBadgeText, { color: colors.mutedForeground }]}>
                    Returns in season
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBuy(item); } }}
                  disabled={disabled}
                  style={[
                    styles.buyBtn,
                    canAfford
                      ? { backgroundColor: catColor }
                      : { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.buyBtnText, { color: canAfford ? '#fff' : colors.mutedForeground }]}>
                    {purchasing ? '…' : canAfford ? 'Get' : 'Need more'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Collection row ────────────────────────────────────────────────────────────

interface CollectionRowProps {
  entry:      PurchaseEntry;
  isActive:   boolean;
  onActivate: (itemId: string) => void;
}

function CollectionRow({ entry, isActive, onActivate }: CollectionRowProps) {
  const colors   = useColors();
  const category = COSMETIC_CATEGORY_MAP[entry.itemId] ?? 'frame';
  const catColor = CATEGORY_COLORS[category] ?? '#9878D8';
  const icon     = ITEM_ICON_MAP[entry.itemId] ?? '✦';

  const date = new Date(entry.purchasedAt);
  const dateStr = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const costParts: React.ReactNode[] = [];
  if (entry.starsSpent  > 0) costParts.push(<Text key="s" style={[styles.collCostPart, { color: '#C8A84B' }]}>✦ {entry.starsSpent}</Text>);
  if (entry.auraSpent   > 0) costParts.push(<Text key="a" style={[styles.collCostPart, { color: '#9878D8' }]}>◈ {entry.auraSpent}</Text>);
  if (entry.shardsSpent > 0) costParts.push(<Text key="h" style={[styles.collCostPart, { color: '#78B4DC' }]}>◇ {entry.shardsSpent}</Text>);

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
            <Text style={[styles.catBadgeText, { color: catColor }]}>{CATEGORY_LABELS[category]}</Text>
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

      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onActivate(entry.itemId); }}
        style={[
          styles.ownedBadge,
          isActive
            ? { backgroundColor: catColor }
            : { backgroundColor: `${catColor}22` },
        ]}
      >
        <Text style={[styles.ownedBadgeText, { color: isActive ? '#fff' : catColor }]}>
          {isActive ? '✦ Active' : 'Set Active'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Collection tab ────────────────────────────────────────────────────────────

interface CollectionTabProps {
  visible: boolean;
  purchaseVersion: number;
}

function CollectionTab({ visible, purchaseVersion }: CollectionTabProps) {
  const colors  = useColors();
  const { activeCosmetics, setActiveCosmetic } = useApp();
  const [purchases,      setPurchases]      = useState<PurchaseEntry[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error,          setError]          = useState(false);
  // true while a background refresh is running (cache already shown)
  const [refreshing, setRefreshing] = useState(false);

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
        <Text style={[styles.collHint, { color: colors.mutedForeground }]}>Gathering your collection…</Text>
      </View>
    );
  }

  if (error && purchases.length === 0) {
    return (
      <View style={styles.collCenter}>
        <Text style={styles.collEmptyIcon}>✕</Text>
        <Text style={[styles.collEmptyText, { color: colors.foreground }]}>Couldn't load your collection</Text>
        <Text style={[styles.collHint, { color: colors.mutedForeground }]}>Check your connection and try again.</Text>
      </View>
    );
  }

  if (purchases.length === 0) {
    return (
      <View style={styles.collCenter}>
        <Text style={styles.collEmptyIcon}>✦</Text>
        <Text style={[styles.collEmptyText, { color: colors.foreground }]}>Your collection is empty</Text>
        <Text style={[styles.collHint, { color: colors.mutedForeground }]}>
          Purchase cosmetics from the Shop tab, or receive items through seasonal sky events.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TabSwitcher({ active, onChange, colors }: { active: ActiveTab; onChange: (t: ActiveTab) => void; colors: any }) {
  return (
    <View style={[styles.tabSwitcher, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      {(['shop', 'collection'] as ActiveTab[]).map(tab => {
        const isActive = tab === active;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onChange(tab)}
            style={[styles.tabBtn, isActive && { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, { color: isActive ? '#6B5B95' : colors.mutedForeground }]}>
              {tab === 'shop' ? '✦ Shop' : '◇ Collection'}
            </Text>
          </TouchableOpacity>
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
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { rewardBalance, reloadRewards, purchasedIds, activeCosmetics, setActiveCosmetic, markPurchased } = useApp();

  // Refresh balance in background every time the modal opens so the chip
  // shows the cached value instantly and updates silently when the API responds.
  useEffect(() => {
    if (visible) reloadRewards().catch(() => null);
  }, [visible, reloadRewards]);

  const [activeTab,       setActiveTab]       = useState<ActiveTab>('shop');
  const [filterCat,       setFilterCat]       = useState<string | null>(null);
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
        showToast(`${item.icon} ${item.name} is yours!`, 'success');
        reloadRewards();
        setPurchaseVersion(v => v + 1);
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('already_owned')) {
        showToast('You already own this item.', 'info');
        markPurchased(item.id);
      } else if (msg.includes('seasonal_unavailable') || msg.includes('403')) {
        showToast('This item is out of season.', 'info');
      } else if (msg.includes('insufficient_funds') || msg.includes('402')) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast('Not enough currency for this item.', 'error');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast('Something went wrong. Try again.', 'error');
      }
    } finally {
      setPurchasing(null);
    }
  }, [reloadRewards, markPurchased]);

  function canAfford(item: ShopItem): boolean {
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
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Shop</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Spend your stars on cosmetic treasures
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
            <Icon name="x" size={14} color={colors.mutedForeground} />
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
                <Text style={[styles.balLabel, { color: colors.mutedForeground }]}>Your balance</Text>
                <Text style={[styles.balHint, { color: colors.mutedForeground }]}>Journal & create to earn more</Text>
              </View>
              <View style={styles.balChips}>
                <BalanceChip icon="✦" value={stars}  color="#C8A84B" bg="rgba(200,168,75,0.14)"   label="Stars" />
                <BalanceChip icon="◈" value={aura}   color="#9878D8" bg="rgba(152,120,216,0.14)"  label="Aura" />
                <BalanceChip icon="◇" value={shards} color="#78B4DC" bg="rgba(120,180,220,0.14)"  label="Shards" />
              </View>
            </View>

            {/* Earn guide */}
            <View style={[styles.earnGuide, { borderColor: colors.border }]}>
              <Text style={[styles.earnGuideTitle, { color: colors.mutedForeground }]}>HOW TO EARN</Text>
              <View style={styles.earnGuideGrid}>
                {[
                  { icon: '✦', color: '#C8A84B', name: 'Stars',  tips: 'Write in your journal (+2)  ·  Create stories (+3)' },
                  { icon: '◈', color: '#9878D8', name: 'Aura',   tips: 'Open the app daily (+3)  ·  Follow wanderers (+1)' },
                  { icon: '◇', color: '#78B4DC', name: 'Shards', tips: 'Save a story (+2)  ·  Give stickers (+1)' },
                ].map(({ icon, color, name, tips }) => (
                  <View key={name} style={styles.earnGuideRow}>
                    <Text style={[styles.earnGuideIcon, { color }]}>{icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.earnGuideName, { color }]}>{name}</Text>
                      <Text style={[styles.earnGuideTips, { color: colors.mutedForeground }]}>{tips}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Category filter pills */}
            {(() => {
              const cats: { id: string | null; label: string; icon: string; color: string }[] = [
                { id: null,     label: 'All',    icon: '✦', color: '#9878D8' },
                { id: 'effect', label: 'Effect', icon: '✨', color: '#70C8A0' },
                { id: 'frame',  label: 'Frame',  icon: '◑', color: '#C8A84B' },
                { id: 'accent', label: 'Accent', icon: '◈', color: '#9878D8' },
                { id: 'theme',  label: 'Theme',  icon: '⋆', color: '#78B4DC' },
              ];
              return (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
                  {cats.map(c => {
                    const active = filterCat === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id ?? 'all'}
                        onPress={() => setFilterCat(c.id)}
                        style={[styles.filterPill, active && { backgroundColor: `${c.color}22`, borderColor: c.color }]}
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
              const visible_catalog = filterCat
                ? catalogItems.filter(i => i.category === filterCat)
                : catalogItems;
              const seasonalItems  = visible_catalog.filter(i => i.seasonal);
              const permanentItems = visible_catalog.filter(i => !i.seasonal);

              // Derive current season label + colour from the first seasonal item
              const seasonLabel = seasonalItems[0]?.seasonalLabel ?? null;
              const seasonColor = seasonLabel ? (SEASON_COLORS[seasonLabel] ?? '#9878D8') : '#9878D8';
              const seasonIcon  = seasonLabel ? (SEASON_ICONS[seasonLabel]  ?? '✦')       : '✦';

              function renderItem(item: ShopItem, overrides?: Partial<ShopItem>) {
                const owned    = purchasedIds.includes(item.id);
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
                  />
                );
              }

              return (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.itemList}
                  showsVerticalScrollIndicator={false}
                >
                  {/* ── This Season ─────────────────────────────── */}
                  {seasonalItems.length > 0 && (
                    <>
                      <View style={[styles.seasonHeader, { borderColor: `${seasonColor}30`, backgroundColor: `${seasonColor}0C` }]}>
                        <Text style={[styles.seasonHeaderIcon]}>{seasonIcon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.seasonHeaderTitle, { color: seasonColor }]}>
                            {seasonLabel} Collection
                          </Text>
                          <Text style={[styles.seasonHeaderSub, { color: colors.mutedForeground }]}>
                            Available this season only
                          </Text>
                        </View>
                        <SeasonalBadge label={seasonLabel!} />
                      </View>
                      {seasonalItems.map(item => renderItem(item))}

                      <View style={styles.sectionDivider}>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>Always Available</Text>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                      </View>
                    </>
                  )}

                  {/* ── Permanent items ──────────────────────────── */}
                  {permanentItems.map(item => renderItem(item))}

                  {/* ── Out-of-season preview ────────────────────── */}
                  {previewItems.length > 0 && (
                    <>
                      <View style={styles.sectionDivider}>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>Coming in a future season</Text>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                      </View>
                      {previewItems.map(item => renderItem(item, { availableNow: false }))}
                    </>
                  )}

                  <Text style={[styles.footer, { color: colors.mutedForeground }]}>
                    More items drift in with each season ✦
                  </Text>
                </ScrollView>
              );
            })()}
          </>
        ) : (
          <CollectionTab visible={activeTab === 'collection'} purchaseVersion={purchaseVersion} />
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
  icon: { fontSize: 18 },

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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    width: 30,
    height: 30,
    borderRadius: 15,
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
    marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(107,91,149,0.04)',
    gap: 8,
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
  earnGuideTips:  { fontSize: 10, fontFamily: 'Satoshi-Regular', lineHeight: 15 },

  // Item list
  itemList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 10,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
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
  cardInfo: { flex: 1, gap: 4 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardName: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.2,
    flexShrink: 1,
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
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    lineHeight: 17,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
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
