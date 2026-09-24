/**
 * ChaptersListScreen — full chapter list for a book with reorder controls.
 * Accessed from BookDetailsScreen via the list icon in the header.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useApiFetch } from '../utils/apiClient';
import { SkyLoadingMark, SkyLoadingOverlay } from '@/components/SkyLoading';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Chapter {
  id: string;
  title: string;
  orderIndex: number;
  status: 'draft' | 'published';
  pageCount: number;
  updatedAt: string;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ChaptersListScreen() {
  const colors  = useColors();
  const { t } = useTranslation();
  const insets  = useSafeAreaInsets();
  const fetch   = useApiFetch();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  async function loadChapters() {
    if (!bookId) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetch<Chapter[]>(`/books/${bookId}/chapters`);
      setChapters(data.sort((a, b) => a.orderIndex - b.orderIndex));
    } catch {
      Alert.alert(t('studioEditor.error'), t('studioEditor.couldNotLoadChapters'));
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { void loadChapters(); }, [bookId]));

  async function moveChapter(id: string, dir: -1 | 1) {
    const idx = chapters.findIndex(c => c.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= chapters.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Swap in local state immediately
    const reordered = [...chapters];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx]!, reordered[idx]!];
    const withNewOrder = reordered.map((c, i) => ({ ...c, orderIndex: i }));
    setChapters(withNewOrder);

    // Persist all affected chapters
    setSaving(true);
    try {
      await Promise.all(
        withNewOrder.map(c =>
          fetch<void>(`/chapters/${c.id}`, { method: 'PATCH', json: { orderIndex: c.orderIndex } }),
        ),
      );
    } catch {
      Alert.alert(t('studioEditor.error'), t('studioEditor.couldNotSaveOrder'));
      void loadChapters(); // revert
    } finally {
      setSaving(false);
    }
  }

  function timeAgo(iso: string) {
    const d = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (d < 1) return t('studioEditor.today');
    if (d < 2) return t('studioEditor.yesterday');
    if (d < 7) return t('studioEditor.daysAgo', { count: Math.floor(d) });
    return t('studioEditor.weeksAgo', { count: Math.floor(d / 7) });
  }

  function renderChapter({ item, index }: { item: Chapter; index: number }) {
    const isPublished = item.status === 'published';
    const statusColor = isPublished ? '#78C8A0' : '#9B7FE8';
    return (
      <View style={s.card}>
        {/* Drag handle / order controls */}
        <View style={s.orderCol}>
          <TouchableOpacity
            onPress={() => moveChapter(item.id, -1)}
            style={[s.arrowBtn, index === 0 && s.arrowDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t('studioEditor.moveUp')}
            disabled={index === 0}
          >
            <Icon name="chevron-up" size={14} color={index === 0 ? 'rgba(200,185,255,0.15)' : 'rgba(200,185,255,0.55)'} />
          </TouchableOpacity>
          <Text style={s.orderNum}>{index + 1}</Text>
          <TouchableOpacity
            onPress={() => moveChapter(item.id, 1)}
            style={[s.arrowBtn, index === chapters.length - 1 && s.arrowDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t('studioEditor.moveDown')}
            disabled={index === chapters.length - 1}
          >
            <Icon name="chevron-down" size={14} color={index === chapters.length - 1 ? 'rgba(200,185,255,0.15)' : 'rgba(200,185,255,0.55)'} />
          </TouchableOpacity>
        </View>

        {/* Chapter info */}
        <TouchableOpacity
          style={s.chapterBody}
          onPress={() => router.push(`/page-manager?chapterId=${item.id}&bookId=${bookId}` as never)}
          activeOpacity={0.7}
        >
          <Text style={s.chapterTitle} numberOfLines={1}>{item.title}</Text>
          <View style={s.chapterMeta}>
            <View style={[s.statusBadge, { borderColor: `${statusColor}40`, backgroundColor: `${statusColor}14` }]}>
              <Text style={[s.statusTxt, { color: statusColor }]}>{isPublished ? t('studioEditor.publishedStatus') : t('studioEditor.draft')}</Text>
            </View>
            <Text style={s.metaTxt}>{t('studioEditor.pagesWithTime', { count: item.pageCount, time: timeAgo(item.updatedAt) })}</Text>
          </View>
        </TouchableOpacity>

        <Icon name="chevron-right" size={14} color="rgba(200,185,255,0.22)" />
      </View>
    );
  }

  if (loading) {
    return <View style={[s.root, { backgroundColor: colors.background }]}><SkyLoadingOverlay message={t('studioEditor.loadChapters')} /></View>;
  }

  if (!bookId) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={s.emptyTxt}>{t('studioEditor.missingBookLink')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#8B70C8', fontSize: 14 }}>{t('studioEditor.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('studioEditor.allChapters')}</Text>
        {saving
          ? <SkyLoadingMark size={18} color="#8B70C8" />
          : <View style={{ width: 36 }} />}
      </View>

      <FlatList
        data={chapters}
        keyExtractor={c => c.id}
        renderItem={renderChapter}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 32 }]}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTxt}>{t('studioEditor.noChapters')}</Text>
          </View>
        }
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { flex: 1, color: 'rgba(255,255,255,0.92)', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  list:          { padding: 16, gap: 8 },
  card:          { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, gap: 10 },
  orderCol:      { alignItems: 'center', width: 32, gap: 2 },
  arrowBtn:      { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  arrowDisabled: { opacity: 0.3 },
  orderNum:      { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600' },
  chapterBody:   { flex: 1, paddingVertical: 4 },
  chapterTitle:  { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '500', marginBottom: 5 },
  chapterMeta:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  statusTxt:     { fontSize: 10, fontWeight: '600' },
  metaTxt:       { color: 'rgba(200,185,255,0.35)', fontSize: 11 },
  empty:         { alignItems: 'center', paddingVertical: 60 },
  emptyTxt:      { color: 'rgba(255,255,255,0.35)', fontSize: 15 },
});
