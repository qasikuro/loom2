import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images/index';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CompletionMoment } from '@/components/CompletionMoment';
import { useApp, type StoryPanel, type StoryPage } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { DraftStore } from '@/utils/draftStore';
import { useTranslation } from 'react-i18next';
import {
  FirstPublishOverlay,
  hasCompletedFirstPublish,
  markFirstPublishDone,
} from '@/components/FirstPublishOverlay';

// ── Layout registry (mirrors panel-editor.tsx) ────────────────────────────────

const MINI_LAYOUTS = [
  { key: '1',  label: 'Full',  count: 1, rows: [[1]] },
  { key: '2v', label: 'Stack', count: 2, rows: [[1], [1]] },
  { key: '2h', label: 'Side',  count: 2, rows: [[1, 1]] },
  { key: '3a', label: '1+2',   count: 3, rows: [[1], [1, 1]] },
  { key: '3b', label: '2+1',   count: 3, rows: [[1, 1], [1]] },
  { key: '4',  label: '2×2',   count: 4, rows: [[1, 1], [1, 1]] },
  { key: '5a', label: '1+4',   count: 5, rows: [[1], [1, 1], [1, 1]] },
  { key: '5b', label: '3+2',   count: 5, rows: [[1, 1, 1], [1, 1]] },
];

const MAX_PAGES = 12;

const MOODS = [
  { label: 'Hopeful',     icon: 'sun'     as const, color: '#F0C040' },
  { label: 'Lonely',      icon: 'moon'    as const, color: '#7090C0' },
  { label: 'Peaceful',    icon: 'cloud'   as const, color: '#78A8C8' },
  { label: 'Romantic',    icon: 'heart'   as const, color: '#C870A0' },
  { label: 'Chaotic',     icon: 'zap'     as const, color: '#D0784A' },
  { label: 'Dreamy',      icon: 'star'    as const, color: '#9B7FE8' },
  { label: 'Soft',        icon: 'feather' as const, color: '#B09AE0' },
  { label: 'Adventurous', icon: 'wind'    as const, color: '#60A878' },
];

const LOCATIONS = [
  'Daylight Prairie', 'Hidden Forest', 'Valley of Triumph',
  'Golden Wasteland', 'Isle of Dawn', 'Eye of Eden',
  'Vault of Knowledge', 'Aviary Village',
];

function makePanel(): StoryPanel {
  return { id: crypto.randomUUID(), text: '', bubbleText: '' };
}

function makePage(): StoryPage {
  return { id: crypto.randomUUID(), layoutKey: '1', panels: [makePanel()] };
}

// ── Mini page grid preview ────────────────────────────────────────────────────

const GRID_H = 72;
const GRID_W = 96;
const GRID_G = 2;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MiniPageGrid({ page, getPanelImg }: { page: StoryPage; getPanelImg: (p: StoryPanel) => any }) {
  const layout = MINI_LAYOUTS.find(l => l.key === page.layoutKey) ?? MINI_LAYOUTS[0];
  const numRows = layout.rows.length;
  const rowH = (GRID_H - (numRows - 1) * GRID_G) / numRows;
  let idx = 0;

  return (
    <View style={{ width: GRID_W, height: GRID_H, borderRadius: 8, overflow: 'hidden', backgroundColor: '#07060F' }}>
      {layout.rows.map((cols, ri) => {
        const totalFlex = cols.reduce((a, b) => a + b, 0);
        return (
          <View key={ri} style={{ flexDirection: 'row', height: rowH, marginTop: ri > 0 ? GRID_G : 0, gap: 0 }}>
            {cols.map((flex, ci) => {
              const panel  = page.panels[idx++];
              const imgSrc = panel ? getPanelImg(panel) : null;
              const cellW  = (GRID_W - (cols.length - 1) * GRID_G) * (flex / totalFlex);
              return (
                <View
                  key={ci}
                  style={{
                    width: cellW, height: rowH,
                    backgroundColor: '#100D22',
                    marginLeft: ci > 0 ? GRID_G : 0,
                    overflow: 'hidden',
                  }}
                >
                  {imgSrc && (
                    <Image source={imgSrc} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                  )}
                  {!imgSrc && (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="image" size={12} color="rgba(140,120,180,0.3)" />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ChapterEditorScreen() {
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const { t: tr } = useTranslation();
  const { addStory, updateStory, stories, storiesLoadError, apiOnline, isLoading, reloadData } = useApp();
  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 120;

  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [mood,     setMood]     = useState('Hopeful');
  const [location, setLocation] = useState('Daylight Prairie');
  const [isPublic, setIsPublic] = useState(true);
  const [pages,    setPages]    = useState<StoryPage[]>([makePage()]);
  const [posting,  setPosting]  = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showMeta, setShowMeta] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [showFirstPublish, setShowFirstPublish] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFilledPagesRef = useRef<StoryPage[] | null>(null);

  const currentMood = MOODS.find(m => m.label === mood);

  const { editId, eventPrompt, eventMood } = useLocalSearchParams<{ editId?: string; eventPrompt?: string; eventMood?: string }>();
  const prevEditIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (editId && editId !== prevEditIdRef.current) {
      const s = stories.find(st => st.id === editId);
      if (s) {
        setTitle(s.chapterTitle);
        setDesc(s.description ?? '');
        setMood(s.mood);
        setLocation(s.location);
        setIsPublic(s.isPublic);
        setPages(s.pages?.length ? s.pages : [{ id: crypto.randomUUID(), layoutKey: s.pageLayoutKey ?? '1', panels: s.panels }]);
      }
      prevEditIdRef.current = editId;
    } else if (!editId && prevEditIdRef.current) {
      setTitle('');
      setDesc('');
      setMood('Hopeful');
      setLocation('Daylight Prairie');
      setIsPublic(true);
      setPages([makePage()]);
      prevEditIdRef.current = null;
    }
  }, [editId, stories]);

  // Pre-fill from event params (only for new stories, not edits)
  useEffect(() => {
    if (editId) return;
    if (eventPrompt) setDesc(String(eventPrompt));
    if (eventMood) {
      const m = MOODS.find(x => x.label === eventMood);
      if (m) setMood(m.label);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draft persistence ─────────────────────────────────────────────────────
  const DRAFT_KEY = 'story_draft_v2';

  function stripPageImages(ps: StoryPage[]): StoryPage[] {
    return ps.map(p => ({
      ...p,
      panels: p.panels.map(({ imageUri: _img, ...rest }) => rest as StoryPanel),
    }));
  }

  useFocusEffect(useCallback(() => {
    if (editId) return;
    AsyncStorage.getItem(DRAFT_KEY).then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        const hasContent = d.title?.trim() ||
          (d.pages ?? []).some((p: StoryPage) =>
            p.panels?.some((panel: StoryPanel) => panel.text?.trim() || panel.bubbleText?.trim())
          );
        if (hasContent) setHasDraft(true);
      } catch { /* ignore */ }
    }).catch(() => null);
  }, [editId]));

  useEffect(() => {
    if (editId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const hasContent = title.trim() ||
        pages.some(p => p.panels.some(panel => panel.text?.trim() || panel.bubbleText?.trim()));
      if (hasContent) {
        AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({
          title, desc, mood, location, isPublic,
          pages: stripPageImages(pages),
        })).catch(() => null);
      }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, desc, mood, location, isPublic, pages, editId]);

  async function loadDraft() {
    const raw = await AsyncStorage.getItem(DRAFT_KEY).catch(() => null);
    if (!raw) { setHasDraft(false); return; }
    try {
      const d = JSON.parse(raw);
      setTitle(d.title ?? '');
      setDesc(d.desc ?? '');
      setMood(d.mood ?? 'Hopeful');
      setLocation(d.location ?? 'Daylight Prairie');
      setIsPublic(d.isPublic ?? true);
      setPages(d.pages?.length ? d.pages : [makePage()]);
      setHasDraft(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { setHasDraft(false); }
  }

  async function discardDraft() {
    await AsyncStorage.removeItem(DRAFT_KEY).catch(() => null);
    setHasDraft(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  // ── Panel editor launchers ───────────────────────────────────────────────

  function addPage() {
    if (pages.length >= MAX_PAGES) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newId   = crypto.randomUUID();
    const newPage = makePage();
    newPage.id    = newId;
    setPages(prev => [...prev, newPage]);
    DraftStore.set({
      panels:           newPage.panels,
      activePanelIndex: 0,
      onSave: (updatedPanels, layoutKey) => {
        setPages(prev => prev.map(p => p.id === newId ? { ...p, panels: updatedPanels, layoutKey } : p));
      },
    });
    router.push('/panel-editor');
  }

  function editPage(pageId: string, currentPanels: StoryPanel[]) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    DraftStore.set({
      panels:           currentPanels,
      activePanelIndex: 0,
      onSave: (updatedPanels, layoutKey) => {
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, panels: updatedPanels, layoutKey } : p));
      },
    });
    router.push('/panel-editor');
  }

  function deletePage(pageId: string) {
    if (pages.length <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPages(prev => prev.filter(p => p.id !== pageId));
  }

  // ── Publish ─────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!title.trim()) { setError(tr('create.needTitle')); return; }
    const filledPages = pages
      .map(p => ({
        ...p,
        panels: p.panels.filter(panel =>
          panel.text.trim() || panel.bubbleText?.trim() || panel.imageUri || panel.bgPreset || (panel.overlays && panel.overlays.length > 0),
        ),
      }))
      .filter(p => p.panels.length > 0);
    if (!filledPages.length) { setError(tr('create.needContent')); return; }
    setError(null);

    if (editId) {
      // Editing an existing story — no first-publish gate
      setPosting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateStory(editId, {
        chapterTitle:   title.trim(),
        description:    desc.trim(),
        panels:         filledPages.flatMap(p => p.panels),
        mood,
        location,
        isPublic,
        pageLayoutKey:  filledPages[0].layoutKey,
        pages:          filledPages,
      });
      setPosting(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace('/(tabs)/create' as any);
      return;
    }

    // New story — check first-publish gate
    const isFirstPublish = !(await hasCompletedFirstPublish());
    if (isFirstPublish) {
      pendingFilledPagesRef.current = filledPages;
      setShowFirstPublish(true);
      return;
    }
    doPublish(filledPages, mood, '');
  }

  async function doPublish(filledPages: StoryPage[], finalMood: string, _openingLine: string) {
    setPosting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const ok = await addStory({
      id:             crypto.randomUUID(),
      date:           new Date().toISOString(),
      chapterTitle:   title.trim(),
      description:    desc.trim(),
      panels:         filledPages.flatMap(p => p.panels),
      mood:           finalMood,
      location,
      isPublic,
      witnessedCount: 0,
      savedCount:     0,
      stickerCount:   0,
      pageLayoutKey:  filledPages[0].layoutKey,
      pages:          filledPages,
    });
    setPosting(false);
    if (!ok) {
      setError(tr('create.saveFailed') || "Story couldn't be saved — check your connection and try again");
      return;
    }
    await markFirstPublishDone();
    await AsyncStorage.removeItem(DRAFT_KEY).catch(() => null);
    setTitle('');
    setDesc('');
    setPages([makePage()]);
    setShowCompletion(true);
  }

  // ── Panel image helper ───────────────────────────────────────────────────

  function getPanelImageSource(panel: StoryPanel) {
    if (panel.imageUri) return { uri: panel.imageUri };
    if (panel.bgPreset) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: Record<string, any> = {
        bg1:  Images.story_bg1,
        bg2:  Images.story_bg2,
        bg3:  Images.story_bg3,
        char: Images.character_default,
      };
      return map[panel.bgPreset] ?? null;
    }
    return null;
  }

  function getPagePreview(page: StoryPage): string {
    const texts = page.panels.map(p => p.text?.trim() || p.bubbleText?.trim() || '').filter(Boolean);
    return texts.join(' · ') || '';
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const moodColor = currentMood?.color ?? '#6B5B95';

  return (
    <View style={c.root}>
      {/* Ambient mood tint — shifts with selected mood */}
      <LinearGradient
        colors={[`${moodColor}22`, `${moodColor}08`, 'transparent']}
        style={c.moodAmbient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      {/* Top dark header scrim */}
      <LinearGradient
        colors={['#060410', '#040310', 'transparent']}
        style={[c.headerGrad, { height: topPad + 88 }]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* ── Stories load error banner ───────────────────────────── */}
      {(storiesLoadError || (!apiOnline && !isLoading)) && (
        <View style={[c.offlineBar, { top: topPad + 4 }]}>
          <Text style={c.offlineBarText} numberOfLines={1}>
            {storiesLoadError && apiOnline
              ? "Couldn't load stories"
              : "Offline — showing cached"}
          </Text>
          <TouchableOpacity onPress={reloadData} activeOpacity={0.7} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={c.offlineBarBtn}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={[c.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={c.navBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.78)" />
        </TouchableOpacity>

        <View style={c.headerCenter}>
          <View style={[c.headerMoodDot, { backgroundColor: moodColor, shadowColor: moodColor }]} />
          <Text style={c.headerTitle}>{editId ? 'Edit Chapter' : 'New Chapter'}</Text>
          <Text style={c.headerPageCount}>{pages.length}/{MAX_PAGES}</Text>
        </View>

        <TouchableOpacity
          style={[c.navBtn, showMeta && { backgroundColor: `${moodColor}22`, borderColor: `${moodColor}38` }]}
          onPress={() => setShowMeta(v => !v)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="map-pin" size={16} color={showMeta ? moodColor : 'rgba(255,255,255,0.78)'} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[c.scroll, { paddingBottom: bottomPad }]}
      >

        {/* ── Draft banner ───────────────────────────────────── */}
        {hasDraft && !editId && (
          <View style={c.draftBanner}>
            <View style={c.draftLeft}>
              <View style={c.draftIconWrap}>
                <Icon name="edit-3" size={13} color="#8B70C8" />
              </View>
              <View>
                <Text style={c.draftTitle}>Unfinished story</Text>
                <Text style={c.draftSub}>You have a draft saved</Text>
              </View>
            </View>
            <View style={c.draftActions}>
              <TouchableOpacity
                onPress={loadDraft}
                style={[c.draftBtn, { backgroundColor: 'rgba(107,91,149,0.22)', borderColor: 'rgba(107,91,149,0.50)' }]}
              >
                <Text style={[c.draftBtnTxt, { color: '#C8B8E8' }]}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={discardDraft}
                style={[c.draftBtn, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)' }]}
              >
                <Text style={[c.draftBtnTxt, { color: 'rgba(255,255,255,0.38)' }]}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Story identity — title, mood, desc ─────────────── */}
        <View style={c.identityBlock}>
          {/* Mood accent side strip */}
          <View style={[c.moodStrip, { backgroundColor: moodColor, shadowColor: moodColor }]} />

          <View style={c.identityInner}>
            {/* Mood picker — always visible */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={c.moodRow}
            >
              {MOODS.map(m => {
                const active = mood === m.label;
                return (
                  <TouchableOpacity
                    key={m.label}
                    style={[c.moodPill, {
                      borderColor:     active ? m.color : 'rgba(255,255,255,0.07)',
                      backgroundColor: active ? `${m.color}1C` : 'rgba(255,255,255,0.03)',
                    }]}
                    onPress={() => { setMood(m.label); Haptics.selectionAsync(); }}
                  >
                    <Icon name={m.icon} size={12} color={active ? m.color : 'rgba(200,185,255,0.32)'} />
                    <Text style={[c.moodPillTxt, { color: active ? m.color : 'rgba(200,185,255,0.32)' }]}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {tr(`moods.${m.label}` as any)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Chapter title — large borderless input */}
            <TextInput
              style={c.titleInput}
              placeholder="Chapter title…"
              placeholderTextColor="rgba(200,185,255,0.18)"
              value={title}
              onChangeText={t => { setTitle(t); if (error) setError(null); }}
              returnKeyType="next"
              maxLength={80}
            />
            <View style={c.titleFooter}>
              <View style={[c.titleUnderline, { backgroundColor: moodColor, opacity: title.length > 0 ? 0.40 : 0.12 }]} />
              <Text style={c.charCount}>{title.length}/80</Text>
            </View>

            {/* Description — soft italic */}
            <TextInput
              style={c.descInput}
              placeholder="A brief scene-setter…"
              placeholderTextColor="rgba(200,185,255,0.15)"
              value={desc}
              onChangeText={setDesc}
              multiline
              textAlignVertical="top"
              maxLength={200}
            />
          </View>
        </View>

        {/* ── Visibility + location row ──────────────────────── */}
        <View style={c.metaRow}>
          {(['Public', 'Private'] as const).map(opt => {
            const active   = opt === 'Public' ? isPublic : !isPublic;
            const optColor = opt === 'Public' ? '#78C8A0' : '#9B7FE8';
            return (
              <TouchableOpacity
                key={opt}
                style={[c.visBtn, {
                  borderColor:     active ? `${optColor}45` : 'rgba(255,255,255,0.07)',
                  backgroundColor: active ? `${optColor}14` : 'rgba(255,255,255,0.03)',
                }]}
                onPress={() => { setIsPublic(opt === 'Public'); Haptics.selectionAsync(); }}
              >
                <Icon
                  name={opt === 'Public' ? 'globe' : 'lock'}
                  size={12}
                  color={active ? optColor : 'rgba(200,185,255,0.28)'}
                />
                <Text style={[c.visBtnTxt, { color: active ? optColor : 'rgba(200,185,255,0.28)' }]}>
                  {opt === 'Public' ? tr('common.public') : tr('common.private')}
                </Text>
              </TouchableOpacity>
            );
          })}
          <Text style={c.visHint}>
            {isPublic ? 'Visible in Discover' : 'Only you can see this'}
          </Text>
        </View>

        {/* ── Location (expandable) ──────────────────────────── */}
        {showMeta && (
          <View style={c.locationSection}>
            <Text style={c.locationLabel}>LOCATION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.locationRow}>
              {LOCATIONS.map(loc => {
                const active = location === loc;
                return (
                  <TouchableOpacity
                    key={loc}
                    style={[c.locationPill, {
                      borderColor:     active ? `${colors.primary}50` : 'rgba(255,255,255,0.07)',
                      backgroundColor: active ? `${colors.primary}16` : 'rgba(255,255,255,0.03)',
                    }]}
                    onPress={() => setLocation(loc)}
                  >
                    <Icon name="map-pin" size={11} color={active ? colors.primary : 'rgba(200,185,255,0.28)'} />
                    <Text style={[c.locationPillTxt, { color: active ? colors.primary : 'rgba(200,185,255,0.28)' }]}>
                      {loc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Pages ──────────────────────────────────────────── */}
        <View style={c.pagesSection}>
          <View style={c.pagesSectionHeader}>
            <Text style={c.pagesSectionTitle}>Pages</Text>
            <View style={[c.pagesCountBadge, { backgroundColor: `${moodColor}14`, borderColor: `${moodColor}28` }]}>
              <Text style={[c.pagesCountTxt, { color: moodColor }]}>{pages.length} / {MAX_PAGES}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[c.addPageInlineBtn, {
                opacity:         pages.length >= MAX_PAGES ? 0.4 : 1,
                backgroundColor: `${moodColor}16`,
                borderColor:     `${moodColor}32`,
              }]}
              onPress={addPage}
              disabled={pages.length >= MAX_PAGES}
            >
              <Icon name="plus" size={13} color={moodColor} />
              <Text style={[c.addPageInlineTxt, { color: moodColor }]}>Add page</Text>
            </TouchableOpacity>
          </View>

          {pages.map((page, i) => {
            const layoutDef   = MINI_LAYOUTS.find(l => l.key === page.layoutKey) ?? MINI_LAYOUTS[0];
            const preview     = getPagePreview(page);
            const filledCount = page.panels.filter(p => p.text || p.bubbleText || p.imageUri || p.bgPreset).length;

            return (
              <View
                key={page.id}
                style={[c.pageCard, { borderColor: filledCount > 0 ? `${moodColor}18` : 'rgba(200,185,255,0.06)' }]}
              >
                {/* Mini grid thumbnail */}
                <MiniPageGrid page={page} getPanelImg={getPanelImageSource} />

                {/* Info */}
                <View style={c.pageCardInfo}>
                  <View style={c.pageCardTopRow}>
                    <Text style={c.pageCardNum}>Page {i + 1}</Text>
                    <View style={[c.pageLayoutTag, { backgroundColor: `${moodColor}10`, borderColor: `${moodColor}20` }]}>
                      <Text style={[c.pageLayoutTagTxt, { color: `${moodColor}CC` }]}>{layoutDef.label}</Text>
                    </View>
                  </View>
                  <Text
                    style={[c.pageCardPreview, !preview && c.pageCardPreviewEmpty]}
                    numberOfLines={2}
                  >
                    {preview || 'Tap Edit to add content'}
                  </Text>
                  {/* Filled-panel dot track */}
                  <View style={c.pageCardDotRow}>
                    {Array.from({ length: layoutDef.count }).map((_, di) => (
                      <View
                        key={di}
                        style={[c.pageCardDot, {
                          backgroundColor: di < filledCount
                            ? moodColor
                            : 'rgba(255,255,255,0.08)',
                          opacity: di < filledCount ? 0.75 : 1,
                        }]}
                      />
                    ))}
                  </View>
                </View>

                {/* Action buttons */}
                <View style={c.pageCardActions}>
                  <TouchableOpacity
                    style={[c.pageActionBtn, { backgroundColor: `${moodColor}18`, borderColor: `${moodColor}30` }]}
                    onPress={() => editPage(page.id, page.panels)}
                  >
                    <Icon name="edit-2" size={14} color={moodColor} />
                  </TouchableOpacity>
                  {pages.length > 1 && (
                    <TouchableOpacity
                      style={[c.pageActionBtn, { backgroundColor: 'rgba(224,85,104,0.10)', borderColor: 'rgba(224,85,104,0.22)' }]}
                      onPress={() => deletePage(page.id)}
                    >
                      <Icon name="trash-2" size={13} color="#E05568" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Error */}
        {error && (
          <View style={c.errorBanner}>
            <Icon name="alert-circle" size={14} color="#E05C5C" />
            <Text style={c.errorTxt}>{error}</Text>
          </View>
        )}

        {/* ── Publish / Save button ──────────────────────────── */}
        <TouchableOpacity
          style={[c.publishBtn, { opacity: posting ? 0.65 : 1 }]}
          onPress={handlePublish}
          disabled={posting}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={[moodColor, `${moodColor}CC`, '#3018A8']}
            style={c.publishGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Icon name={editId ? 'check' : 'send'} size={17} color="#fff" />
            <Text style={c.publishTxt}>
              {posting
                ? (editId ? 'Saving…' : 'Publishing…')
                : (editId ? 'Save Changes' : 'Publish Story')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Soft bottom note */}
        <Text style={c.bottomNote}>
          {isPublic ? '✦ Your story will appear in Discover' : '✦ Only visible to you'}
        </Text>

      </KeyboardAwareScrollView>

      <FirstPublishOverlay
        visible={showFirstPublish}
        initialMood={mood}
        onPublish={(overlayMood, openingLine) => {
          setShowFirstPublish(false);
          const pages = pendingFilledPagesRef.current ?? [];
          doPublish(pages, overlayMood, openingLine);
        }}
      />

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <CompletionMoment visible={showCompletion} variant="story" onFinish={() => router.push('/(tabs)' as any)} />
    </View>
  );
}

const c = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#04030C' },
  moodAmbient: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  headerGrad:  { position: 'absolute', top: 0, left: 0, right: 0 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 10,
  },
  navBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.09)',
  },
  headerCenter:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerMoodDot:   { width: 8, height: 8, borderRadius: 4, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 6 },
  headerTitle:     { fontSize: 16, fontFamily: 'Satoshi-Bold', color: 'rgba(248,244,255,0.92)', letterSpacing: -0.3 },
  headerPageCount: { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(200,185,255,0.28)', letterSpacing: 0.2 },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  // ── Draft banner ──────────────────────────────────────────────────────────
  draftBanner: {
    borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(107,91,149,0.30)',
    backgroundColor: 'rgba(107,91,149,0.10)',
    padding: 14, marginBottom: 14,
  },
  draftLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  draftIconWrap:{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(107,91,149,0.20)', alignItems: 'center', justifyContent: 'center' },
  draftTitle:   { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(248,244,255,0.90)' },
  draftSub:     { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(255,255,255,0.40)', marginTop: 2 },
  draftActions: { flexDirection: 'row', gap: 8 },
  draftBtn:     { borderRadius: 10, borderWidth: 1, paddingVertical: 7, paddingHorizontal: 14 },
  draftBtnTxt:  { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  // ── Story identity block ──────────────────────────────────────────────────
  identityBlock: { flexDirection: 'row', marginBottom: 16 },
  moodStrip: {
    width: 3, borderRadius: 2, marginRight: 14,
    marginTop: 6, marginBottom: 6,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8,
  },
  identityInner: { flex: 1 },

  // Mood pills
  moodRow: { flexDirection: 'row', gap: 6, paddingBottom: 14, paddingRight: 12 },
  moodPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 18, borderWidth: 1,
  },
  moodPillTxt: { fontSize: 12, fontFamily: 'Satoshi-Medium' },

  // Title
  titleInput: {
    fontSize: 28, fontFamily: 'Satoshi-Bold',
    color: 'rgba(248,244,255,0.97)',
    letterSpacing: -0.9, lineHeight: 34,
    paddingVertical: 2, marginBottom: 6,
  },
  titleFooter: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  titleUnderline: { flex: 1, height: 1.5, borderRadius: 1 },
  charCount: { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(200,185,255,0.22)', marginLeft: 10 },

  // Description
  descInput: {
    fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(220,210,255,0.62)',
    lineHeight: 22, minHeight: 55,
    paddingVertical: 2,
  },

  // ── Visibility + meta row ─────────────────────────────────────────────────
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12, flexWrap: 'wrap' },
  visBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 18, borderWidth: 1,
  },
  visBtnTxt: { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  visHint:   { fontSize: 10.5, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.25)', fontStyle: 'italic', marginLeft: 2 },

  // ── Location ──────────────────────────────────────────────────────────────
  locationSection: { marginBottom: 12 },
  locationLabel: {
    fontSize: 8.5, fontFamily: 'Satoshi-Bold', letterSpacing: 1.8,
    textTransform: 'uppercase', color: 'rgba(200,185,255,0.32)',
    marginBottom: 8,
  },
  locationRow: { flexDirection: 'row', gap: 6, paddingRight: 12 },
  locationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 18, borderWidth: 1,
  },
  locationPillTxt: { fontSize: 11.5, fontFamily: 'Satoshi-Medium' },

  // ── Pages section ─────────────────────────────────────────────────────────
  pagesSection:       { marginBottom: 12 },
  pagesSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  pagesSectionTitle:  { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(230,220,255,0.80)', letterSpacing: -0.2 },
  pagesCountBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9, borderWidth: 1 },
  pagesCountTxt:      { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  addPageInlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1,
  },
  addPageInlineTxt: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  // Page card row
  pageCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.022)',
    borderWidth: 1,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 4,
  },
  pageCardInfo:        { flex: 1, gap: 5 },
  pageCardTopRow:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pageCardNum:         { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(230,220,255,0.86)' },
  pageLayoutTag:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  pageLayoutTagTxt:    { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  pageCardPreview:     { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,185,255,0.52)', lineHeight: 17 },
  pageCardPreviewEmpty:{ color: 'rgba(200,185,255,0.22)', fontStyle: 'normal' },
  pageCardDotRow:      { flexDirection: 'row', gap: 4, marginTop: 2 },
  pageCardDot:         { width: 16, height: 3, borderRadius: 2 },
  pageCardActions:     { gap: 6, alignItems: 'center' },
  pageActionBtn: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },

  // ── Offline / load-error bar ──────────────────────────────────────────────
  offlineBar: {
    position: 'absolute', left: 16, right: 16, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(6,4,18,0.82)', borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.30)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  offlineBarText: { flex: 1, fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(224,92,92,0.90)' },
  offlineBarBtn:  { fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(200,168,232,0.90)' },

  // ── Error ─────────────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(224,92,92,0.10)', borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.25)', borderRadius: 14,
    padding: 12, marginBottom: 10,
  },
  errorTxt: { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Medium', color: '#E05C5C' },

  // ── Publish button ────────────────────────────────────────────────────────
  publishBtn:  { borderRadius: 24, overflow: 'hidden', marginBottom: 8 },
  publishGrad: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    paddingVertical: 20, paddingHorizontal: 24,
  },
  publishTxt: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: -0.2 },

  bottomNote: {
    fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(200,185,255,0.22)', textAlign: 'center',
    marginBottom: 8,
  },
});
