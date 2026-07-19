import { Icon } from '@/components/Icon';
import { apiFetch } from '@/context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Purchase {
  id:          string;
  itemId:      string;
  itemName:    string;
  starsSpent:  number | null;
  auraSpent:   number | null;
  shardsSpent: number | null;
  purchasedAt: string;
}

const ITEM_EMOJI: Record<string, string> = {
  frame_starlight:     '✦',  frame_moonveil:      '◑',
  accent_aura:         '◈',  theme_locket:        '◇',
  theme_aurora:        '⋆',  frame_blossom:       '🌸',
  accent_petal:        '✿',  frame_solstice:      '☀',
  accent_twilight:     '◐',  frame_harvest:       '🍂',
  accent_ember:        '🔥', theme_aurora_winter:  '🌌',
  frame_frost:         '❄',  effect_butterfly:    '🦋',
  effect_hearts:       '💜', effect_fireflies:    '✨',
  effect_blossom:      '🌸', effect_fire:         '🔥',
  effect_leaves:       '🍃',
};

function categoryMeta(itemId: string): { label: string; color: string } {
  if (itemId.startsWith('frame_'))  return { label: 'Frame',  color: '#C8A84B' };
  if (itemId.startsWith('accent_')) return { label: 'Accent', color: '#9B8BCC' };
  if (itemId.startsWith('theme_'))  return { label: 'Theme',  color: '#78B8E8' };
  if (itemId.startsWith('effect_')) return { label: 'Effect', color: '#70C8A0' };
  return { label: 'Item', color: '#C8B8E8' };
}

function costStr(p: Purchase): string {
  const parts: string[] = [];
  if (p.starsSpent)  parts.push(`✦ ${p.starsSpent}`);
  if (p.auraSpent)   parts.push(`◈ ${p.auraSpent}`);
  if (p.shardsSpent) parts.push(`◇ ${p.shardsSpent}`);
  return parts.join(' · ') || 'Free';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function PurchaseHistoryScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [hasError,  setHasError]  = useState(false);

  useEffect(() => {
    apiFetch<Purchase[]>('/rewards/purchases')
      .then(data => { setPurchases(data ?? []); })
      .catch(() => { setHasError(true); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#0A081A', '#120E28', '#0A081A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-left" size={20} color="rgba(200,184,232,0.85)" />
        </TouchableOpacity>
        <Text style={s.title}>Purchase History</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#C8A84B" />
        </View>
      ) : hasError ? (
        <View style={s.center}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>✦</Text>
          <Text style={s.emptyHead}>Couldn't load history</Text>
          <Text style={s.emptySub}>Check your connection and try again.</Text>
        </View>
      ) : purchases.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Icon name="shopping-bag" size={26} color="rgba(200,168,75,0.55)" />
          </View>
          <Text style={s.emptyHead}>No purchases yet</Text>
          <Text style={s.emptySub}>Items you buy in the GameJo Shop will appear here.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {purchases.map((p, i) => {
            const cat  = categoryMeta(p.itemId);
            const emoji = ITEM_EMOJI[p.itemId] ?? '✦';
            return (
              <View
                key={p.id}
                style={[s.row, i === 0 && { marginTop: 4 }]}
              >
                {/* Icon bubble */}
                <View style={[s.iconBubble, { backgroundColor: `${cat.color}18`, borderColor: `${cat.color}30` }]}>
                  <Text style={s.catIcon}>{emoji}</Text>
                </View>

                {/* Info */}
                <View style={s.info}>
                  <Text style={s.itemName} numberOfLines={1}>{p.itemName}</Text>
                  <View style={s.metaRow}>
                    <View style={[s.catPill, { backgroundColor: `${cat.color}15`, borderColor: `${cat.color}28` }]}>
                      <Text style={[s.catPillText, { color: cat.color }]}>{cat.label}</Text>
                    </View>
                    <Text style={s.dateText}>{formatDate(p.purchasedAt)}</Text>
                  </View>
                </View>

                {/* Cost */}
                <Text style={s.costText}>{costStr(p)}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(200,184,232,0.08)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.14)',
  },
  title: {
    fontSize: 16, fontFamily: 'Satoshi-Bold',
    color: 'rgba(235,228,255,0.95)', letterSpacing: -0.2,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 36 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(200,168,75,0.08)',
    borderWidth: 1, borderColor: 'rgba(200,168,75,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyHead: { fontSize: 16, fontFamily: 'Satoshi-Bold',    color: 'rgba(200,184,232,0.75)', textAlign: 'center' },
  emptySub:  { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.40)', textAlign: 'center', lineHeight: 19, fontStyle: 'italic' },

  list: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 13, borderRadius: 14, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(200,184,232,0.10)',
  },
  iconBubble: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  catIcon: { fontSize: 18 },

  info:    { flex: 1, gap: 4 },
  itemName:{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: 'rgba(235,228,255,0.90)' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  catPillText: { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 0.2 },
  dateText: { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.38)' },

  costText: { fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,168,75,0.80)', textAlign: 'right' },
});
