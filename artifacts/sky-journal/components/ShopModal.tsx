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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Icon } from '@/components/Icon';

// ── Shop catalog (mirrors server SHOP_CATALOG) ────────────────────────────────

interface ShopItem {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  category:    'frame' | 'accent' | 'theme';
  cost:        { stars?: number; aura?: number; shards?: number };
}

const SHOP_CATALOG: ShopItem[] = [
  {
    id:          'frame_starlight',
    name:        'Starlight Frame',
    description: 'A golden radiant frame that surrounds your profile with starlight.',
    icon:        '✦',
    category:    'frame',
    cost:        { stars: 30 },
  },
  {
    id:          'frame_moonveil',
    name:        'Moonveil Frame',
    description: 'A silver crescent frame woven from moonlight and quiet wishes.',
    icon:        '◑',
    category:    'frame',
    cost:        { stars: 40, shards: 10 },
  },
  {
    id:          'accent_aura',
    name:        'Aura Glow',
    description: 'Wraps your bio in a soft purple luminescence.',
    icon:        '◈',
    category:    'accent',
    cost:        { aura: 25 },
  },
  {
    id:          'theme_locket',
    name:        'Memory Locket',
    description: 'A vintage golden-locket theme for your journal entries.',
    icon:        '◇',
    category:    'theme',
    cost:        { shards: 20 },
  },
  {
    id:          'theme_aurora',
    name:        'Aurora Theme',
    description: 'Paint your journal pages with the colours of the northern lights.',
    icon:        '⋆',
    category:    'theme',
    cost:        { aura: 15, shards: 15 },
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  frame:  'Profile Frame',
  accent: 'Bio Accent',
  theme:  'Journal Theme',
};

const CATEGORY_COLORS: Record<string, string> = {
  frame:  '#C8A84B',
  accent: '#9878D8',
  theme:  '#78B4DC',
};

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

function PurchaseToast({ message, type, visible }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity,     { toValue: 1,  duration: 260, useNativeDriver: true }),
        Animated.spring(translateY,  { toValue: 0,  tension: 180, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 8, duration: 220, useNativeDriver: true }),
      ]).start();
    }
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

// ── Balance row ───────────────────────────────────────────────────────────────

function BalanceChip({ icon, value, color, bg }: { icon: string; value: number; color: string; bg: string }) {
  return (
    <View style={[styles.balChip, { backgroundColor: bg, borderColor: `${color}44` }]}>
      <Text style={[styles.balChipIcon, { color }]}>{icon}</Text>
      <Text style={[styles.balChipNum, { color }]}>{value}</Text>
    </View>
  );
}

// ── Shop item card ────────────────────────────────────────────────────────────

interface ItemCardProps {
  item:         ShopItem;
  owned:        boolean;
  canAfford:    boolean;
  onBuy:        (item: ShopItem) => void;
  purchasing:   boolean;
}

function ItemCard({ item, owned, canAfford, onBuy, purchasing }: ItemCardProps) {
  const colors    = useColors();
  const scale     = useRef(new Animated.Value(1)).current;
  const catColor  = CATEGORY_COLORS[item.category] ?? '#9878D8';

  function pressIn()  { Animated.spring(scale, { toValue: 0.95, tension: 200, friction: 8, useNativeDriver: true }).start(); }
  function pressOut() { Animated.spring(scale, { toValue: 1,    tension: 200, friction: 8, useNativeDriver: true }).start(); }

  const costParts: React.ReactNode[] = [];
  if (item.cost.stars)  costParts.push(<Text key="s" style={[styles.costPart, { color: '#C8A84B' }]}>✦ {item.cost.stars}</Text>);
  if (item.cost.aura)   costParts.push(<Text key="a" style={[styles.costPart, { color: '#9878D8' }]}>◈ {item.cost.aura}</Text>);
  if (item.cost.shards) costParts.push(<Text key="h" style={[styles.costPart, { color: '#78B4DC' }]}>◇ {item.cost.shards}</Text>);

  const disabled = owned || !canAfford || purchasing;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBuy(item); } }}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        disabled={disabled}
      >
        <View style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: owned ? `${catColor}60` : colors.border },
          owned && { borderWidth: 1.5 },
        ]}>
          {/* Icon + badge */}
          <View style={[styles.cardIconWrap, { backgroundColor: `${catColor}18` }]}>
            <Text style={[styles.cardIcon, { color: catColor }]}>{item.icon}</Text>
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.catBadge, { backgroundColor: `${catColor}18` }]}>
                <Text style={[styles.catBadgeText, { color: catColor }]}>{CATEGORY_LABELS[item.category]}</Text>
              </View>
            </View>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text>
            <View style={styles.cardFooter}>
              <View style={styles.costRow}>{costParts.reduce<React.ReactNode[]>((acc, p, i) => {
                if (i > 0) acc.push(<Text key={`sep${i}`} style={styles.costSep}>+</Text>);
                acc.push(p); return acc;
              }, [])}</View>
              {owned ? (
                <View style={[styles.ownedBadge, { backgroundColor: `${catColor}22` }]}>
                  <Text style={[styles.ownedBadgeText, { color: catColor }]}>Owned ✦</Text>
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

// ── Main modal ────────────────────────────────────────────────────────────────

interface ShopModalProps {
  visible:  boolean;
  onClose:  () => void;
}

export function ShopModal({ visible, onClose }: ShopModalProps) {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { rewardBalance, reloadRewards } = useApp();

  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  const [purchasing,   setPurchasing]   = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ message: string; type: ToastProps['type'] } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slideY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, tension: 55, friction: 13, useNativeDriver: true }).start();
      loadPurchases();
    } else {
      Animated.timing(slideY, { toValue: 600, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible]);

  async function loadPurchases() {
    try {
      const data = await apiFetch<{ purchasedIds: string[] }>('/rewards/shop');
      setPurchasedIds(data.purchasedIds);
    } catch { /* silently skip */ }
  }

  function showToast(message: string, type: ToastProps['type']) {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  const handleBuy = useCallback(async (item: ShopItem) => {
    setPurchasing(item.id);
    try {
      const res = await apiFetch<{
        success: boolean;
        newBalance: { stars: number; auraEnergy: number; memoryShards: number; lifetimeStars: number };
      }>('/rewards/spend', {
        method: 'POST',
        body:   JSON.stringify({ itemId: item.id }),
      });
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPurchasedIds(prev => [...prev, item.id]);
        showToast(`${item.icon} ${item.name} is yours!`, 'success');
        reloadRewards();
      }
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('already_owned')) {
        showToast('You already own this item.', 'info');
        setPurchasedIds(prev => prev.includes(item.id) ? prev : [...prev, item.id]);
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
  }, [reloadRewards]);

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
            <Text style={[styles.title, { color: colors.foreground }]}>Sky Shop</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Spend your stars on cosmetic treasures
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
            <Icon name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <View style={[styles.balanceRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.balLabel, { color: colors.mutedForeground }]}>Your balance</Text>
          <View style={styles.balChips}>
            <BalanceChip icon="✦" value={stars}  color="#C8A84B" bg="rgba(200,168,75,0.14)" />
            <BalanceChip icon="◈" value={aura}   color="#9878D8" bg="rgba(152,120,216,0.14)" />
            <BalanceChip icon="◇" value={shards} color="#78B4DC" bg="rgba(120,180,220,0.14)" />
          </View>
        </View>

        {/* Items */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.itemList}
          showsVerticalScrollIndicator={false}
        >
          {SHOP_CATALOG.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              owned={purchasedIds.includes(item.id)}
              canAfford={canAfford(item)}
              onBuy={handleBuy}
              purchasing={purchasing === item.id}
            />
          ))}
          <Text style={[styles.footer, { color: colors.mutedForeground }]}>
            More items drift in with each season ✦
          </Text>
        </ScrollView>

        {/* Toast */}
        {toast && (
          <PurchaseToast message={toast.message} type={toast.type} visible={!!toast} />
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  balChipIcon: { fontSize: 11 },
  balChipNum:  { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },

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
    gap: 8,
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
});
