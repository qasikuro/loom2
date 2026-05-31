import { Icon } from '@/components/Icon';
import { apiFetch } from '@/context/AppContext';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  starsSpent:  number;
  auraSpent:   number;
  shardsSpent: number;
  purchasedAt: string;
}

const CATEGORY_ICON: Record<string, string> = {
  frame_starlight: '✦',
  frame_moonveil:  '◑',
  frame_solstice:  '☀',
  accent_aura:     '◈',
  accent_twilight: '◐',
  theme_locket:    '◇',
  theme_aurora:    '⋆',
};

export default function PurchaseHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    apiFetch<Purchase[]>('/rewards/purchases')
      .then(data => setPurchases(data ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function costStr(p: Purchase) {
    const parts: string[] = [];
    if (p.starsSpent)  parts.push(`✦ ${p.starsSpent}`);
    if (p.auraSpent)   parts.push(`◈ ${p.auraSpent}`);
    if (p.shardsSpent) parts.push(`◇ ${p.shardsSpent}`);
    return parts.join(' · ') || 'Free';
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={20} color="rgba(200,184,232,0.85)" />
        </TouchableOpacity>
        <Text style={s.title}>Purchase History</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#C8A84B" style={{ marginTop: 60 }} />
      ) : purchases.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>◇</Text>
          <Text style={s.emptyHead}>No purchases yet</Text>
          <Text style={s.emptySub}>Items you buy from the shop will appear here.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {purchases.map(p => (
            <View key={p.id} style={s.item}>
              <View style={s.itemIcon}>
                <Text style={{ fontSize: 18 }}>{CATEGORY_ICON[p.itemId] ?? '✦'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{p.itemName}</Text>
                <Text style={s.itemDate}>{formatDate(p.purchasedAt)}</Text>
              </View>
              <Text style={s.itemCost}>{costStr(p)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#08061A' },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 12 },
  title:    { fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#C8B8E8' },

  empty:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, color: 'rgba(200,168,75,0.35)', marginBottom: 4 },
  emptyHead: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.5)', textAlign: 'center' },
  emptySub:  { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.32)', textAlign: 'center' },

  item:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  itemIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(200,168,75,0.10)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(200,168,75,0.18)' },
  itemName: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.85)' },
  itemDate: { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.40)', marginTop: 2 },
  itemCost: { fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#C8A84B' },
});
