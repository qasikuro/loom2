/**
 * PageManagerScreen — thumbnail grid of pages in a chapter.
 * Supports reorder (up/down), delete with confirmation, and "Add Page" via
 * the shared DraftStore + panel-editor flow used by ChapterEditorScreen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useApiFetch } from '../utils/apiClient';
import { DraftStore } from '../utils/draftStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Panel {
  id:          string;
  text:        string;
  imageUri?:   string;
  bgPreset?:   string;
  bubbleText?: string;
}

interface Page {
  id:        string;
  layoutKey: string;
  panels:    Panel[];
}

interface ChapterDetail {
  id:        string;
  bookId:    string;
  title:     string;
  status:    'draft' | 'published';
  pageCount: number;
  pages:     Page[];
}

// ── Mini thumbnail ────────────────────────────────────────────────────────────

function PageThumb({ page }: { page: Page }) {
  const first = page.panels.find(p => p.imageUri);
  return (
    <View style={t.thumb}>
      {first?.imageUri
        ? <Image source={{ uri: first.imageUri }} style={t.thumbImg} contentFit="cover" />
        : <View style={t.thumbEmpty}>
            <Icon name="image" size={20} color="rgba(140,120,180,0.25)" />
          </View>}
    </View>
  );
}

const t = StyleSheet.create({
  thumb:      { width: '100%', aspectRatio: 0.7, borderRadius: 8, overflow: 'hidden', backgroundColor: '#100D22' },
  thumbImg:   { width: '100%', height: '100%' },
  thumbEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

// ── Screen ────────────────────────────────────────────────────────────────────

const COLS = 3;

export default function PageManagerScreen() {
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const apiFetch  = useApiFetch();
  const { chapterId, bookId } = useLocalSearchParams<{ chapterId: string; bookId: string }>();

  const [chapter,  setChapter]  = useState<ChapterDetail | null>(null);
  const [pages,    setPages]    = useState<Page[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Track whether pages changed so we auto-save on focus return
  const pagesRef = useRef<Page[]>([]);
  const dirtyRef = useRef(false);

  async function loadChapter() {
    if (!chapterId) return;
    try {
      const data = await apiFetch<ChapterDetail>(`/chapters/${chapterId}`);
      setChapter(data);
      setPages(data.pages ?? []);
      pagesRef.current = data.pages ?? [];
    } catch {
      Alert.alert('Error', 'Could not load chapter');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => {
    if (dirtyRef.current) {
      // Returned from panel-editor — auto-save updated pages
      void persistPages(pagesRef.current);
      dirtyRef.current = false;
    } else {
      void loadChapter();
    }
  }, [chapterId]));

  async function persistPages(updatedPages: Page[]) {
    if (!chapterId) return;
    setSaving(true);
    try {
      await apiFetch<ChapterDetail>(`/chapters/${chapterId}`, {
        method: 'PATCH',
        json: { pages: updatedPages, pageCount: updatedPages.length },
      });
      setPages(updatedPages);
      pagesRef.current = updatedPages;
    } catch {
      Alert.alert('Error', 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  function addPage() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newId   = crypto.randomUUID();
    const newPage: Page = { id: newId, layoutKey: '1', panels: [{ id: crypto.randomUUID(), text: '', bubbleText: '' }] };
    const next = [...pagesRef.current, newPage];
    pagesRef.current = next;
    dirtyRef.current = true;

    DraftStore.set({
      panels:           newPage.panels,
      activePanelIndex: 0,
      onSave: (updatedPanels: Panel[], layoutKey: string) => {
        const updated = pagesRef.current.map(p => p.id === newId ? { ...p, panels: updatedPanels, layoutKey } : p);
        pagesRef.current = updated;
      },
    });
    router.push('/panel-editor');
  }

  function editPage(page: Page) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dirtyRef.current = true;
    DraftStore.set({
      panels:           page.panels,
      activePanelIndex: 0,
      onSave: (updatedPanels: Panel[], layoutKey: string) => {
        const updated = pagesRef.current.map(p => p.id === page.id ? { ...p, panels: updatedPanels, layoutKey } : p);
        pagesRef.current = updated;
      },
    });
    router.push('/panel-editor');
  }

  function deletePage(id: string) {
    if (pages.length <= 1) { Alert.alert('Cannot delete', 'A chapter must have at least one page.'); return; }
    Alert.alert('Delete Page', 'Remove this page from the chapter?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const next = pages.filter(p => p.id !== id);
          pagesRef.current = next;
          void persistPages(next);
        },
      },
    ]);
  }

  function movePage(id: string, dir: -1 | 1) {
    const idx = pages.findIndex(p => p.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= pages.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const reordered = [...pages];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx]!, reordered[idx]!];
    pagesRef.current = reordered;
    void persistPages(reordered);
  }

  const accent = '#8B70C8';

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{chapter?.title ?? 'Pages'}</Text>
          {saving && <ActivityIndicator size="small" color={accent} style={{ marginLeft: 8 }} />}
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/publish-chapter?chapterId=${chapterId}&bookId=${bookId}` as never)}
          style={s.publishBtn}
        >
          <Text style={s.publishBtnTxt}>Review</Text>
        </TouchableOpacity>
      </View>

      {/* Page grid */}
      <ScrollView contentContainerStyle={[s.grid, { paddingBottom: insets.bottom + 100 }]}>
        {pages.map((page, idx) => (
          <View key={page.id} style={s.pageCell}>
            {/* Thumbnail */}
            <TouchableOpacity onPress={() => editPage(page)} activeOpacity={0.75}>
              <PageThumb page={page} />
            </TouchableOpacity>

            {/* Page number */}
            <Text style={s.pageNum}>Page {idx + 1}</Text>

            {/* Controls row */}
            <View style={s.pageControls}>
              <TouchableOpacity onPress={() => movePage(page.id, -1)} style={[s.ctrlBtn, idx === 0 && s.ctrlDisabled]} disabled={idx === 0}>
                <Icon name="chevron-left" size={12} color={idx === 0 ? 'rgba(200,185,255,0.15)' : 'rgba(200,185,255,0.55)'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => editPage(page)} style={s.ctrlBtn}>
                <Icon name="edit-2" size={12} color="rgba(200,185,255,0.55)" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deletePage(page.id)} style={s.ctrlBtn}>
                <Icon name="trash-2" size={12} color="rgba(200,185,255,0.40)" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => movePage(page.id, 1)} style={[s.ctrlBtn, idx === pages.length - 1 && s.ctrlDisabled]} disabled={idx === pages.length - 1}>
                <Icon name="chevron-right" size={12} color={idx === pages.length - 1 ? 'rgba(200,185,255,0.15)' : 'rgba(200,185,255,0.55)'} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Add page cell */}
        <View style={s.pageCell}>
          <TouchableOpacity style={s.addCell} onPress={addPage} activeOpacity={0.7}>
            <Icon name="plus" size={22} color={accent} />
            <Text style={[s.addTxt, { color: accent }]}>Add Page</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Review FAB */}
      <View style={[s.fab, { bottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[s.fabBtn, { backgroundColor: accent }]}
          onPress={() => router.push(`/publish-chapter?chapterId=${chapterId}&bookId=${bookId}` as never)}
        >
          <Icon name="send" size={15} color="#fff" />
          <Text style={s.fabTxt}>Review &amp; Publish</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const GAP  = 10;
const COLS_COUNT = COLS;

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { color: 'rgba(255,255,255,0.92)', fontSize: 16, fontWeight: '600' },
  publishBtn:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(139,112,200,0.38)', backgroundColor: 'rgba(139,112,200,0.12)' },
  publishBtnTxt:{ color: '#8B70C8', fontSize: 13, fontWeight: '600' },
  grid:         { padding: GAP, flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  pageCell:     { width: `${(100 - GAP * (COLS_COUNT + 1) / COLS_COUNT) / COLS_COUNT}%` as unknown as number, gap: 5 },
  addCell:      { aspectRatio: 0.7, borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(139,112,200,0.25)', borderStyle: 'dashed', backgroundColor: 'rgba(139,112,200,0.05)', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addTxt:       { fontSize: 11, fontWeight: '600' },
  pageNum:      { color: 'rgba(255,255,255,0.40)', fontSize: 10, textAlign: 'center', marginTop: 2 },
  pageControls: { flexDirection: 'row', justifyContent: 'center', gap: 2 },
  ctrlBtn:      { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  ctrlDisabled: { opacity: 0.3 },
  fab:          { position: 'absolute', alignSelf: 'center' },
  fabBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 26, shadowColor: '#8B70C8', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabTxt:       { color: '#fff', fontSize: 14, fontWeight: '700' },
});
