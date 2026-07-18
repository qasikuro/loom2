import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images/index';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompletionMoment } from '@/components/CompletionMoment';
import { MoodBadge } from '@/components/MoodBadge';
import { MilestoneModal, buildMilestoneInfo, type MilestoneInfo } from '@/components/MilestoneModal';
import { WitnessMosaic } from '@/components/WitnessMosaic';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { PanelOverlay } from '@/context/AppContext';
import { useTranslation } from 'react-i18next';
import { shareStory } from '@/utils/shareContent';

// ── Layout registry (mirrors panel-editor.tsx) ────────────────────────────────

interface LayoutDef {
  key:   string;
  count: number;
  rows:  number[][];
}

const LAYOUTS: LayoutDef[] = [
  { key: '1',  count: 1, rows: [[1]] },
  { key: '2v', count: 2, rows: [[1], [1]] },
  { key: '2h', count: 2, rows: [[1, 1]] },
  { key: '3a', count: 3, rows: [[1], [1, 1]] },
  { key: '3b', count: 3, rows: [[1, 1], [1]] },
  { key: '4',  count: 4, rows: [[1, 1], [1, 1]] },
  { key: '5a', count: 5, rows: [[1], [1, 1], [1, 1]] },
  { key: '5b', count: 5, rows: [[1, 1, 1], [1, 1]] },
];

const GUTTER = 3;

function getLayout(key?: string): LayoutDef {
  return LAYOUTS.find(l => l.key === key) ?? LAYOUTS[0];
}

function chunkPanels<T>(arr: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += size) pages.push(arr.slice(i, i + size));
  return pages;
}

// ── Background helpers ────────────────────────────────────────────────────────

const BG_PRESET_MAP: Record<string, any> = {
  bg1:  Images.story_bg1,
  bg2:  Images.story_bg2,
  bg3:  Images.story_bg3,
  char: Images.character_default,
};

function getPanelImageSource(imageUri?: string, bgPreset?: string) {
  if (imageUri)  return { uri: imageUri };
  if (bgPreset && BG_PRESET_MAP[bgPreset]) return BG_PRESET_MAP[bgPreset];
  return null;
}

const MOOD_GRADIENTS: Record<string, [string, string, string]> = {
  Hopeful:     ['#2A2060', '#3A3080', '#2E285A'],
  Peaceful:    ['#1A2840', '#243860', '#1E304E'],
  Lonely:      ['#1A1E38', '#24284E', '#1E2244'],
  Romantic:    ['#2A1830', '#3E2448', '#301A3C'],
  Chaotic:     ['#2A1A14', '#3E2418', '#301C16'],
  Dreamy:      ['#221840', '#342860', '#2A1E50'],
  Soft:        ['#201828', '#302240', '#281C34'],
  Adventurous: ['#142214', '#1E3420', '#182818'],
};

function getGradient(mood: string): [string, string, string] {
  return MOOD_GRADIENTS[mood] ?? ['#1A1630', '#252070', '#1E1A4A'];
}

// ── Single cell renderer ──────────────────────────────────────────────────────

interface CellPanel {
  imageUri?:        string;
  bgPreset?:        string;
  text:             string;
  bubbleText?:      string;
  overlays?:        PanelOverlay[];
  imageAspectRatio?: number;   // width/height — stored at crop time
}

function PanelCell({
  panel,
  cellW,
  cellH,
  gradient,
  onRatioDetected,
}: {
  panel:              CellPanel | undefined;
  cellW:              number;
  cellH:              number;
  gradient:           [string, string, string];
  onRatioDetected?:   (ratio: number) => void;
}) {
  if (!panel) {
    return (
      <View style={[styles.cell, { width: cellW, height: cellH, backgroundColor: '#0D0B1A' }]} />
    );
  }

  const imgSrc    = getPanelImageSource(panel.imageUri, panel.bgPreset);
  const hasBubble = panel.bubbleText?.trim();
  // "cover" only when we know the exact ratio (cell is pre-sized to match).
  // "contain" shows the full image without cropping for old panels that lack a stored ratio.
  const fit       = panel.imageAspectRatio ? 'cover' : 'contain';

  return (
    <View style={[styles.cell, { width: cellW, height: cellH }]}>
      {imgSrc ? (
        <Image
          source={imgSrc}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          cachePolicy="memory-disk"
          onLoad={e => {
            const { width, height } = e.source;
            if (width && height && !panel.imageAspectRatio && onRatioDetected) {
              onRatioDetected(width / height);
            }
          }}
        />
      ) : (
        <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} />
      )}

      {/* Subtle vignette on image panels */}
      {imgSrc && (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
          style={[StyleSheet.absoluteFill, { top: '40%' }]}
        />
      )}

      {/* Legacy speech bubble (top-left) */}
      {!!hasBubble && (
        <View style={styles.speechBubble}>
          <Text style={styles.speechBubbleText} numberOfLines={4}>{panel.bubbleText}</Text>
          <View style={styles.speechBubbleTail} />
        </View>
      )}

      {/* Overlay items */}
      {panel.overlays?.map(ov => {
        const left     = ov.xPct * cellW;
        const top      = ov.yPct * cellH;
        const fontFam  = (ov.fontFamily ?? 'Satoshi-Medium') as any;
        const fontSize = ov.fontSize ?? (ov.type === 'sticker' ? 24 : 12);
        const bRadius  = ov.bubbleStyle === 'sharp' ? 2 : ov.bubbleStyle === 'oval' ? 50 : 10;
        const hasTail  = ov.bubbleStyle !== 'oval';

        return (
          <View key={ov.id} style={{ position: 'absolute', left, top, zIndex: 15 }}>
            {ov.type === 'bubble' && (
              <View style={[styles.speechBubble, { borderRadius: bRadius, position: 'relative', top: 0, left: 0, maxWidth: cellW * 0.72 }]}>
                <Text style={[styles.speechBubbleText, { fontFamily: fontFam, fontSize }]} numberOfLines={6}>{ov.content}</Text>
                {hasTail && <View style={styles.speechBubbleTail} />}
              </View>
            )}
            {ov.type === 'text' && (
              <Text style={[styles.overlayText, { fontFamily: fontFam, fontSize, color: ov.color ?? '#ffffff' }]}>
                {ov.content}
              </Text>
            )}
            {ov.type === 'sticker' && (
              <Text style={{ fontSize }}>{ov.content}</Text>
            )}
          </View>
        );
      })}

      {/* Narration caption (bottom strip) */}
      {panel.text.trim().length > 0 && (
        <View style={styles.captionBox}>
          <Text style={styles.captionText} numberOfLines={3}>{panel.text}</Text>
        </View>
      )}
    </View>
  );
}

// ── Manga page renderer ───────────────────────────────────────────────────────
// Row heights are computed from each panel's stored imageAspectRatio.
// For panels that don't have a stored ratio (older stories), height falls back
// to a sensible portrait default, and the image uses contentFit="contain" so
// nothing is ever clipped.  Once an image loads, its intrinsic ratio is
// detected via onLoad and the row re-renders at the correct height.

function MangaPage({
  panels,
  layout,
  gradient,
  pageNum,
  totalPages,
  screenW,
}: {
  panels:     (CellPanel | undefined)[];
  layout:     LayoutDef;
  gradient:   [string, string, string];
  pageNum:    number;
  totalPages: number;
  screenW:    number;
}) {
  // Detected ratios for panels that lack a stored imageAspectRatio.
  // Key: `${rowIndex}_${colIndex}` → width/height ratio
  const [detectedRatios, setDetectedRatios] = useState<Record<string, number>>({});

  // Pre-compute row data (panel slices per row) so we can reference them safely.
  let cellIdx = 0;
  const rowData = layout.rows.map(cols => {
    const rowPanels = cols.map(() => panels[cellIdx++]);
    return { cols, rowPanels };
  });

  // Compute the height for a single row given the panels it contains.
  function rowHeight(ri: number, cols: number[], rowPanels: (CellPanel | undefined)[]): number {
    const totalFlex = cols.reduce((a, b) => a + b, 0);
    let maxH = 0;
    cols.forEach((flex, ci) => {
      const cellW = (screenW - (cols.length - 1) * GUTTER) * (flex / totalFlex);
      const ratio =
        rowPanels[ci]?.imageAspectRatio ??
        detectedRatios[`${ri}_${ci}`];
      if (ratio && ratio > 0) {
        maxH = Math.max(maxH, cellW / ratio);
      }
    });
    if (maxH === 0) {
      // Fallback: portrait 3:4 based on the first cell's width
      const firstFlex  = cols[0];
      const firstCellW = (screenW - (cols.length - 1) * GUTTER) * (firstFlex / totalFlex);
      maxH = Math.round(firstCellW * (4 / 3));
    }
    return Math.round(maxH);
  }

  return (
    <View style={styles.page}>
      {rowData.map(({ cols, rowPanels }, ri) => {
        const totalFlex = cols.reduce((a, b) => a + b, 0);
        const rH = rowHeight(ri, cols, rowPanels);
        return (
          <View key={ri} style={[styles.pageRow, { height: rH, marginTop: ri > 0 ? GUTTER : 0 }]}>
            {cols.map((flex, ci) => {
              const cellW = (screenW - (cols.length - 1) * GUTTER) * (flex / totalFlex);
              return (
                <View key={ci} style={{ width: cellW, height: rH }}>
                  <PanelCell
                    panel={rowPanels[ci]}
                    cellW={cellW}
                    cellH={rH}
                    gradient={gradient}
                    onRatioDetected={
                      rowPanels[ci]?.imageAspectRatio
                        ? undefined
                        : ratio => setDetectedRatios(prev => ({
                            ...prev, [`${ri}_${ci}`]: ratio,
                          }))
                    }
                  />
                </View>
              );
            })}
          </View>
        );
      })}

      {totalPages > 1 && (
        <View style={styles.pageNumBadge}>
          <Text style={styles.pageNumText}>{pageNum} / {totalPages}</Text>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StoryScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id, source } = useLocalSearchParams<{ id: string; source: string }>();
  const { stories, discoverPosts, savedStoryIds, toggleSavePost, deleteStory, updateStory,
          showRewardToast, reloadRewards, reloadConstellation, reloadData, isLoading } = useApp();

  const { width: screenW } = useWindowDimensions();
  const [witnessed,        setWitnessed]        = useState(false);
  const [showWitnessFlash, setShowWitnessFlash] = useState(false);
  const [savedOffset,      setSavedOffset]      = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [activeMilestone,  setActiveMilestone]  = useState<MilestoneInfo | null>(null);
  const [continuePost,     setContinuePost]     = useState<typeof discoverPosts[number] | null>(null);
  const [continueDismissed, setContinueDismissed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Continue Reading card slide-in animation
  const continueSlideY   = useRef(new Animated.Value(180)).current;
  const continueOpacity  = useRef(new Animated.Value(0)).current;
  const continueDragY    = useRef(new Animated.Value(0)).current;
  const continueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endReachedRef    = useRef(false);

  // Witness button bounce animation
  const witnessScale = useRef(new Animated.Value(1)).current;
  const witnessGlow  = useRef(new Animated.Value(0)).current;

  // Sticker badge bounce animation (prevStickerRef init to 0 — stickerCount is derived below)
  const stickerBounce  = useRef(new Animated.Value(1)).current;
  const prevStickerRef = useRef(0);

  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  const story = stories.find(s => s.id === id) ?? null;
  const post  = discoverPosts.find(p => p.id === id) ?? null;
  const isOwnStory = !!story;

  // ── Creator-facing milestone check: show modal for unshown milestones ──────
  const shownKey = `shown_milestones_v1_${id ?? ''}`;
  useEffect(() => {
    if (!isOwnStory || !story?.witnessMilestones?.length) return;
    AsyncStorage.getItem(shownKey).then(raw => {
      const shown: number[] = raw ? (JSON.parse(raw) as number[]) : [];
      const unshown = story.witnessMilestones!.find(t => !shown.includes(t));
      if (unshown != null) setActiveMilestone(buildMilestoneInfo(unshown, ''));
    }).catch(() => null);
  }, [isOwnStory, id, (story?.witnessMilestones ?? []).join(',')]);

  function handleMilestoneDismiss() {
    if (activeMilestone && id) {
      AsyncStorage.getItem(shownKey).then(raw => {
        const shown: number[] = raw ? (JSON.parse(raw) as number[]) : [];
        shown.push(activeMilestone.threshold);
        return AsyncStorage.setItem(shownKey, JSON.stringify(shown));
      }).catch(() => null);
    }
    setActiveMilestone(null);
  }

  const title      = story?.chapterTitle ?? post?.chapterTitle ?? t('discover.untitledChapter');
  const mood       = story?.mood         ?? post?.mood         ?? 'Peaceful';
  const authorName = post?.authorName    ?? t('common.you');
  const chapterNum = post?.chapterNumber ?? 1;
  const isSaved    = savedStoryIds.has(id ?? '');

  const witnessedCount = ((story?.witnessedCount ?? post?.witnessedCount ?? 0) + (witnessed ? 1 : 0));
  const savedCount     = (story?.savedCount ?? post?.savedCount ?? 0) + savedOffset;
  const stickerCount   = story?.stickerCount ?? post?.stickerCount ?? 0;

  // Trigger sticker bounce when count increases
  useEffect(() => {
    if (stickerCount > prevStickerRef.current) {
      prevStickerRef.current = stickerCount;
      stickerBounce.setValue(0.55);
      Animated.spring(stickerBounce, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    } else {
      prevStickerRef.current = stickerCount;
    }
  }, [stickerCount]);

  function toCellPanel(p: any): CellPanel {
    return {
      imageUri:         p.imageUri,
      bgPreset:         p.bgPreset,
      text:             p.text ?? '',
      bubbleText:       p.bubbleText,
      overlays:         p.overlays,
      imageAspectRatio: p.imageAspectRatio,
    };
  }

  // ── Continue Reading logic ────────────────────────────────────────────────────
  // These hooks must live before any early returns so they always run in the
  // same order every render (Rules of Hooks).

  // Swipe-down pan responder for the Continue card
  const continuePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 6 && gs.dy > 0,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) continueDragY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 50 || gs.vy > 0.6) {
          if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
          setContinueDismissed(true);
          Animated.parallel([
            Animated.timing(continueSlideY,  { toValue: 220, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.timing(continueOpacity, { toValue: 0,   duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.timing(continueDragY,   { toValue: 0,   duration: 0, useNativeDriver: true }),
          ]).start(() => setContinuePost(null));
        } else {
          Animated.spring(continueDragY, { toValue: 0, tension: 180, friction: 12, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  function showContinueCard() {
    if (endReachedRef.current || continueDismissed) return;
    endReachedRef.current = true;

    const candidates = discoverPosts.filter(p => p.id !== id && (p.mood === mood || p.vibe === mood));
    const fallback   = discoverPosts.filter(p => p.id !== id);
    const next       = candidates[0] ?? fallback[0] ?? null;
    if (!next) return;

    setContinuePost(next);
    continueTimerRef.current = setTimeout(() => {
      continueDragY.setValue(0);
      Animated.parallel([
        Animated.spring(continueSlideY,  { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(continueOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
      autoDismissTimer.current = setTimeout(dismissContinueCard, 10_000);
    }, 1500);
  }

  function dismissContinueCard() {
    if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    setContinueDismissed(true);
    Animated.parallel([
      Animated.timing(continueSlideY,  { toValue: 180, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(continueOpacity, { toValue: 0,   duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => setContinuePost(null));
  }

  // End-of-story detection: fires when scroll settles at the bottom
  const handleScrollEnd = useCallback((e: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    if (distanceFromBottom < 120 && !endReachedRef.current && !continueDismissed) {
      showContinueCard();
    }
  }, [id, mood, discoverPosts, continueDismissed]);

  // Clear timers on unmount so card doesn't appear after navigating away
  useEffect(() => {
    return () => {
      if (continueTimerRef.current) clearTimeout(continueTimerRef.current);
      if (autoDismissTimer.current)  clearTimeout(autoDismissTimer.current);
    };
  }, []);

  // ── Full-screen error state — must run before any panel/page derivation ───
  // Guards against crash when panels is missing or wrong type.
  const storyNotFound  = !story && !post;
  const storyCorrupted = (story != null && (!story.chapterTitle || !Array.isArray(story.panels))) ||
                         (post  != null && !post.chapterTitle);

  if (storyNotFound || storyCorrupted) {
    return (
      <View style={[errState.container, { backgroundColor: '#0D0B1A' }]}>
        <TouchableOpacity
          style={[errState.backBtn, { top: topPad + 12 }]}
          onPress={() => router.back()}
          activeOpacity={0.78}
        >
          <Icon name="chevron-left" size={20} color="rgba(200,184,232,0.9)" />
        </TouchableOpacity>
        <View style={errState.content}>
          <Text style={errState.icon}>✦</Text>
          <Text style={errState.title}>This story couldn't be opened</Text>
          <Text style={errState.sub}>
            {storyCorrupted
              ? 'The story data appears to be incomplete.'
              : 'This story may have been removed or is no longer available.'}
          </Text>
          <TouchableOpacity style={errState.btn} onPress={() => router.back()} activeOpacity={0.82}>
            <Icon name="chevron-left" size={15} color="rgba(200,184,232,0.9)" />
            <Text style={errState.btnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  type RenderPage = { layoutKey: string; panels: CellPanel[] };
  let renderPages: RenderPage[];

  if (story?.pages?.length) {
    renderPages = story.pages.map(pg => ({ layoutKey: pg.layoutKey, panels: pg.panels.map(toCellPanel) }));
  } else if (post?.pages?.length) {
    renderPages = post.pages.map(pg => ({ layoutKey: pg.layoutKey, panels: pg.panels.map(toCellPanel) }));
  } else {
    const flatPanels: CellPanel[] = story
      ? story.panels.map(toCellPanel)
      : post
        ? (post.panels ?? [{ text: post.storySnippet }]).map(toCellPanel)
        : [];
    const fallbackKey = story?.pageLayoutKey ?? post?.pageLayoutKey ?? '1';
    const fallbackLayout = getLayout(fallbackKey);
    renderPages = chunkPanels(flatPanels, fallbackLayout.count).map(chunk => ({ layoutKey: fallbackKey, panels: chunk }));
  }

  // Full-screen error: story not found or contains no valid panels
  if (!isLoading && (renderPages.length === 0 || (!story && !post))) {
    return (
      <View style={[errStyles.wrap, { backgroundColor: colors.background, paddingTop: topPad + 12 }]}>
        <BackButton style={errStyles.back} />
        <Text style={errStyles.glyph}>✦</Text>
        <Text style={[errStyles.title, { color: colors.text }]}>This story couldn't be opened</Text>
        <Text style={[errStyles.sub, { color: colors.secondary }]}>
          It may have been removed or contains invalid data.
        </Text>
      </View>
    );
  }

  const gradient   = getGradient(mood);
  const firstPanel = renderPages[0]?.panels[0];
  const heroImgSrc = getPanelImageSource(firstPanel?.imageUri, firstPanel?.bgPreset);
  const totalPanelCount = renderPages.reduce((acc, pg) => acc + pg.panels.length, 0);

  function handleShare() {
    const panels = story?.panels ?? post?.panels ?? [];
    shareStory({ title, mood, authorName, panels }).catch(() => null);
  }

  function handleWitness() {
    if (witnessed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWitnessed(true);
    setShowWitnessFlash(true);
    // Bounce + glow animation
    Animated.sequence([
      Animated.spring(witnessScale, { toValue: 1.28, useNativeDriver: true, tension: 200, friction: 5 }),
      Animated.spring(witnessScale, { toValue: 1,    useNativeDriver: true, tension: 180, friction: 8 }),
    ]).start();
    Animated.sequence([
      Animated.timing(witnessGlow, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(witnessGlow, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
    ]).start();
    apiFetch<{
      rewardGranted?: boolean;
      rewardAmounts?: { stars?: number; aura?: number; shards?: number };
      milestone?: { threshold: number; titleName: string; rewardType: string; aura: number; stars: number } | null;
    }>(`/stories/${id}/witness`, { method: 'POST' }).then(res => {
      if (res?.rewardGranted && res.rewardAmounts) {
        showRewardToast('Daily witness', res.rewardAmounts);
        reloadRewards().catch(() => null);
        reloadConstellation().catch(() => null);
      }
      // Refresh stories so the creator's witnessMilestones are up-to-date next time they open their story
      if (res?.milestone) reloadData().catch(() => null);
    }).catch(() => null);
  }

  function handleSave() {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const willBeSaved = !savedStoryIds.has(id);
    setSavedOffset(prev => prev + (willBeSaved ? 1 : -1));
    toggleSavePost(id);
  }

  function handleToggleVisibility() {
    if (!id || !story) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateStory(id, { isPublic: !story.isPublic });
  }

  function handleDelete() {
    if (confirmingDelete) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      deleteStory(id!);
      router.back();
    } else {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3000);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: '#0D0B1A' }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 90 }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
      >
        {/* ── Hero cover ─────────────────────────────────── */}
        <View style={[styles.hero, { height: topPad + 300 }]}>
          {heroImgSrc ? (
            <Image source={heroImgSrc} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.12)', 'rgba(13,11,26,0.94)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Back */}
          <BackButton style={[styles.backBtn, { top: topPad + 12 }]} color="#fff" size={20} />

          {/* Visibility toggle */}
          {isOwnStory && !confirmingDelete && (
            <TouchableOpacity
              style={[styles.visibilityBtn, { top: topPad + 12, backgroundColor: story?.isPublic ? 'rgba(120,200,160,0.25)' : 'rgba(0,0,0,0.35)' }]}
              onPress={handleToggleVisibility}
              activeOpacity={0.78}
            >
              <Icon name={story?.isPublic ? 'globe' : 'lock'} size={15} color={story?.isPublic ? '#78C8A0' : 'rgba(200,184,232,0.9)'} />
            </TouchableOpacity>
          )}

          {/* Edit */}
          {isOwnStory && !confirmingDelete && (
            <TouchableOpacity
              style={[styles.editBtn, { top: topPad + 12 }]}
              onPress={() => router.push({ pathname: '/chapter-editor', params: { editId: id } } as any)}
              activeOpacity={0.78}
            >
              <Icon name="edit-2" size={18} color="rgba(200,184,232,0.9)" />
            </TouchableOpacity>
          )}

          {/* Delete */}
          {isOwnStory && (
            <TouchableOpacity
              style={[
                styles.moreBtn,
                { top: topPad + 12 },
                confirmingDelete && { backgroundColor: '#E04455', paddingHorizontal: 14 },
              ]}
              onPress={handleDelete}
              activeOpacity={0.78}
            >
              {confirmingDelete
                ? <Text style={styles.deleteConfirmText}>{t('common.deleteConfirm')}</Text>
                : <Icon name="trash-2" size={18} color="rgba(255,120,100,0.9)" />
              }
            </TouchableOpacity>
          )}

          {/* Hero meta */}
          <View style={styles.heroOverlay}>
            <View style={styles.heroMeta}>
              <TouchableOpacity
                onPress={() => post?.authorUserId && router.push({ pathname: '/user/[userId]', params: { userId: post.authorUserId } } as any)}
                activeOpacity={post?.authorUserId ? 0.78 : 1}
                style={styles.heroAvatarBtn}
              >
                {post?.authorAvatarUri ? (
                  <Image
                    source={{ uri: post.authorAvatarUri }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 17 }]}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Text style={styles.heroAvatarText}>{authorName.charAt(0)}</Text>
                )}
              </TouchableOpacity>
              <View>
                <Text style={styles.heroAuthor}>{authorName}</Text>
                <Text style={styles.heroChapter}>{t('discover.chapter')} {chapterNum}</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{title}</Text>
            {!!(story?.description ?? post?.description) && (
              <Text style={styles.heroDescription}>
                {story?.description ?? post?.description}
              </Text>
            )}
            <View style={styles.heroMoodRow}>
              <MoodBadge mood={mood} size="sm" />
              <View style={styles.infoBadge}>
                <Icon name="layers" size={11} color="rgba(255,255,255,0.8)" />
                <Text style={styles.infoBadgeText}>{renderPages.length === 1 ? t('discover.infoBadge', { panels: totalPanelCount, pages: renderPages.length }) : t('discover.infoBadgePlural', { panels: totalPanelCount, pages: renderPages.length })}</Text>
              </View>
              {isOwnStory && (
                <View style={[styles.infoBadge, story?.isPublic ? styles.infoBadgePublic : styles.infoBadgePrivate]}>
                  <Icon name={story?.isPublic ? 'globe' : 'lock'} size={11} color={story?.isPublic ? '#78C8A0' : 'rgba(200,184,232,0.8)'} />
                  <Text style={[styles.infoBadgeText, { color: story?.isPublic ? '#78C8A0' : 'rgba(200,184,232,0.8)' }]}>
                    {story?.isPublic ? t('common.public') : t('common.private')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Manga pages ────────────────────────────────── */}
        <View style={styles.pagesWrap}>
          {renderPages.map((page, pi) => {
            const pageLayout = getLayout(page.layoutKey);
            return (
              <MangaPage
                key={pi}
                panels={page.panels}
                layout={pageLayout}
                gradient={gradient}
                pageNum={pi + 1}
                totalPages={renderPages.length}
                screenW={screenW}
              />
            );
          })}
        </View>

        {/* ── End card ───────────────────────────────────── */}
        <View style={[styles.endCard, { backgroundColor: 'rgba(139,122,181,0.12)', borderColor: 'rgba(139,122,181,0.25)' }]}>
          <Text style={{ fontSize: 26 }}>✦</Text>
          <Text style={styles.endTitle}>{t('discover.endOfChapter', { n: chapterNum })}</Text>
          <Text style={styles.endSub}>{post ? t('discover.byAuthor', { name: authorName }) : t('discover.yourStory')}</Text>
          <View style={styles.endStats}>
            <Icon name="eye"      size={14} color={witnessed ? '#C8A84B' : 'rgba(200,184,232,0.6)'} />
            <Text style={[styles.endStatText, witnessed && { color: '#C8A84B' }]}>{witnessedCount}</Text>
            <View style={styles.endStatDot} />
            <Icon name="bookmark" size={14} color={isSaved ? '#8B7AB5' : 'rgba(200,184,232,0.6)'} />
            <Text style={[styles.endStatText, isSaved && { color: '#8B7AB5' }]}>{savedCount}</Text>
            {stickerCount > 0 && (
              <Animated.View style={{ flexDirection: 'row', alignItems: 'center', transform: [{ scale: stickerBounce }] }}>
                <View style={styles.endStatDot} />
                <Text style={styles.endStatStickerIcon}>✦</Text>
                <Text style={styles.endStatText}>{stickerCount}</Text>
              </Animated.View>
            )}
          </View>
          {/* Witness mosaic — own story view only */}
          {isOwnStory && witnessedCount > 0 && (
            <WitnessMosaic count={witnessedCount} accent={gradient[1]} />
          )}
          {/* Follow author CTA for discover posts */}
          {post?.authorUserId && (
            <TouchableOpacity
              style={styles.endViewProfile}
              onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: post.authorUserId } } as any)}
              activeOpacity={0.82}
            >
              <Icon name="user" size={13} color="rgba(200,184,232,0.85)" />
              <Text style={styles.endViewProfileText}>View {authorName}'s profile</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.45)" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky bottom bar ──────────────────────────── */}
      <View style={[styles.bottomBar, { backgroundColor: 'rgba(13,11,26,0.94)', paddingBottom: bottomPad + 8, borderTopColor: 'rgba(255,255,255,0.08)' }]}>
        <View style={styles.witnessedRow}>
          <Icon name="eye"      size={15} color="rgba(240,234,248,0.6)" />
          <Text style={styles.witnessedNum}>{witnessedCount}</Text>
          <View style={styles.dotDivider} />
          <Icon name="bookmark" size={14} color="rgba(240,234,248,0.6)" />
          <Text style={styles.witnessedNum}>{savedCount}</Text>
          {stickerCount > 0 && (
            <Animated.View style={{ flexDirection: 'row', alignItems: 'center', transform: [{ scale: stickerBounce }] }}>
              <View style={styles.dotDivider} />
              <Text style={styles.bottomStickerIcon}>✦</Text>
              <Text style={styles.witnessedNum}>{stickerCount}</Text>
            </Animated.View>
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.shareIconBtn]}
            onPress={handleShare}
            activeOpacity={0.72}
            accessibilityLabel="Share story"
          >
            <Icon name="share-2" size={16} color="rgba(200,184,232,0.75)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isSaved ? 'rgba(139,122,181,0.25)' : 'rgba(255,255,255,0.08)', borderColor: isSaved ? '#8B7AB5' : 'rgba(255,255,255,0.18)' }]}
            onPress={handleSave}
          >
            <Icon name="bookmark" size={15} color={isSaved ? '#8B7AB5' : 'rgba(240,234,248,0.75)'} />
            <Text style={[styles.actionBtnText, { color: isSaved ? '#8B7AB5' : 'rgba(240,234,248,0.75)' }]}>{isSaved ? t('discover.saved') : t('discover.save')}</Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: witnessScale }] }}>
            <TouchableOpacity
              style={[styles.witnessBtn, {
                backgroundColor: witnessed ? 'rgba(200,168,75,0.22)' : 'rgba(139,122,181,0.25)',
                borderColor:     witnessed ? 'rgba(200,168,75,0.65)' : 'rgba(139,122,181,0.55)',
              }]}
              onPress={handleWitness}
              activeOpacity={witnessed ? 1 : 0.78}
            >
              <Animated.View style={{ opacity: witnessGlow.interpolate({ inputRange: [0,1], outputRange: [0, 1] }), position: 'absolute', top: -8, left: -8, right: -8, bottom: -8, borderRadius: 28, backgroundColor: 'rgba(200,168,75,0.18)' }} pointerEvents="none" />
              <Icon name="eye" size={15} color={witnessed ? '#C8A84B' : '#C8B8E8'} />
              <Text style={[styles.actionBtnText, { color: witnessed ? '#C8A84B' : '#C8B8E8' }]}>
                {witnessed ? t('discover.witnessedBadge') : t('discover.witness')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
      <CompletionMoment visible={showWitnessFlash} variant="witness" onFinish={() => setShowWitnessFlash(false)} />
      <MilestoneModal
        visible={activeMilestone !== null}
        milestone={activeMilestone}
        onDismiss={handleMilestoneDismiss}
      />

      {/* ── Continue Reading slide-in card ─────────────── */}
      {!!continuePost && (
        <Animated.View
          style={[
            styles.continueWrap,
            {
              bottom: bottomPad + 88,
              transform: [
                { translateY: Animated.add(continueSlideY, continueDragY) },
              ],
              opacity: continueOpacity,
            },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={styles.continueCard}
            {...continuePanResponder.panHandlers}
          >
            {/* Dismiss button */}
            <TouchableOpacity
              style={styles.continueDismissBtn}
              onPress={dismissContinueCard}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              activeOpacity={0.75}
            >
              <Icon name="x" size={13} color="rgba(200,184,232,0.6)" />
            </TouchableOpacity>

            <Text style={styles.continueLabel}>Continue Reading</Text>

            <TouchableOpacity
              style={styles.continueInner}
              onPress={() => {
                dismissContinueCard();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/story/[id]', params: { id: continuePost.id, source: 'discover' } });
              }}
              activeOpacity={0.82}
            >
              {/* Thumbnail */}
              <View style={styles.continueThumbnail}>
                {continuePost.imageUri ? (
                  <Image
                    source={{ uri: continuePost.imageUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <LinearGradient
                    colors={getGradient(continuePost.mood ?? continuePost.vibe ?? 'Peaceful')}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
              </View>

              {/* Text info */}
              <View style={styles.continueMeta}>
                <Text style={styles.continueTitle} numberOfLines={2}>{continuePost.chapterTitle}</Text>
                <Text style={styles.continueAuthor} numberOfLines={1}>
                  {continuePost.authorHandle ?? continuePost.authorName}
                </Text>
              </View>

              <Icon name="chevron-right" size={16} color="rgba(200,184,232,0.5)" />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const errState = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    position: 'absolute', left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { alignItems: 'center', paddingHorizontal: 40, gap: 14 },
  icon:  { fontSize: 40, color: 'rgba(200,184,232,0.6)', marginBottom: 8 },
  title: { fontSize: 20, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,248,0.92)', textAlign: 'center', letterSpacing: -0.3 },
  sub:   { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,184,232,0.55)', textAlign: 'center', lineHeight: 22 },
  btn:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(139,122,181,0.45)', backgroundColor: 'rgba(139,122,181,0.12)' },
  btnText: { fontSize: 14, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.9)' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero:     { width: '100%', position: 'relative', overflow: 'hidden' },
  heroOverlay: { position: 'absolute', bottom: 22, left: 20, right: 20, gap: 10 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroAvatarBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,122,181,0.5)', overflow: 'hidden' },
  heroAvatarText: { color: '#fff', fontSize: 14, fontFamily: 'Satoshi-Bold' },
  heroAuthor:  { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'Satoshi-Bold' },
  heroChapter: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Satoshi-Regular' },
  heroTitle:       { color: '#fff', fontSize: 24, fontFamily: 'Satoshi-Bold', lineHeight: 32 },
  heroDescription: { color: 'rgba(255,255,255,0.72)', fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 20, fontStyle: 'italic' },
  heroMoodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  infoBadgePublic:  { backgroundColor: 'rgba(120,200,160,0.18)', borderColor: 'rgba(120,200,160,0.40)' },
  infoBadgePrivate: { backgroundColor: 'rgba(200,184,232,0.12)', borderColor: 'rgba(200,184,232,0.28)' },
  infoBadgeText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Satoshi-Regular' },

  backBtn: {
    position: 'absolute', left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  visibilityBtn: {
    position: 'absolute', right: 120,
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  editBtn: {
    position: 'absolute', right: 68,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  moreBtn: {
    position: 'absolute', right: 16,
    height: 40, minWidth: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteConfirmText: { color: '#fff', fontSize: 13, fontFamily: 'Satoshi-Bold' },

  pagesWrap: { backgroundColor: '#0D0B1A', gap: 16, paddingTop: 8, paddingBottom: 8 },

  page:    { width: '100%', overflow: 'hidden', backgroundColor: '#0D0B1A' },
  pageRow: { flexDirection: 'row', gap: GUTTER },

  pageNumBadge: {
    position: 'absolute', bottom: 8, right: 12,
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  pageNumText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'Satoshi-Regular' },

  cell: { overflow: 'hidden', position: 'relative', backgroundColor: '#0D0B1A' },

  speechBubble: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    maxWidth: '70%', zIndex: 10,
  },
  speechBubbleText: { fontSize: 12, fontFamily: 'Satoshi-Medium', color: '#1A1530', lineHeight: 17 },
  speechBubbleTail: {
    position: 'absolute', bottom: -7, left: 14,
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 7,
    borderStyle: 'solid',
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.94)',
  },

  overlayText: {
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  captionBox: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,11,26,0.82)',
    paddingHorizontal: 10, paddingVertical: 7,
    borderTopWidth: 1, borderTopColor: 'rgba(200,184,232,0.12)',
  },
  captionText: {
    color: 'rgba(240,234,248,0.92)', fontSize: 11,
    fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 16,
  },

  endCard: {
    margin: 16, borderRadius: 20, borderWidth: 1,
    padding: 32, alignItems: 'center', gap: 8,
  },
  endTitle: { fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#F0EAF8', marginTop: 8 },
  endSub:   { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,184,232,0.7)' },
  endStats: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  endStatText: { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.6)' },
  endStatDot:  { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(200,184,232,0.3)', marginHorizontal: 4 },
  endStatStickerIcon: { fontSize: 11, color: 'rgba(200,184,232,0.6)' },
  endViewProfile: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 12, paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(200,184,232,0.22)',
    backgroundColor: 'rgba(200,184,232,0.08)',
  },
  endViewProfileText: { fontSize: 13, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.85)', flex: 1 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1,
  },
  witnessedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  witnessedNum: { color: 'rgba(240,234,248,0.6)', fontSize: 14, fontFamily: 'Satoshi-Regular' },
  dotDivider: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(240,234,248,0.3)', marginHorizontal: 4 },
  bottomStickerIcon: { fontSize: 12, color: 'rgba(240,234,248,0.6)' },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  shareIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
  },
  witnessBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontFamily: 'Satoshi-Medium' },

  continueWrap: {
    position: 'absolute',
    left: 16, right: 16,
  },
  continueCard: {
    backgroundColor: 'rgba(22,18,40,0.97)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,122,181,0.35)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 14,
    gap: 10,
  },
  continueDismissBtn: {
    position: 'absolute',
    top: 10, right: 12,
    width: 26, height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  continueLabel: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(200,184,232,0.45)',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  continueInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  continueThumbnail: {
    width: 52, height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1A1630',
  },
  continueMeta: {
    flex: 1,
    gap: 3,
  },
  continueTitle: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: '#F0EAFF',
    lineHeight: 18,
  },
  continueAuthor: {
    fontSize: 11,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.55)',
  },
});

const errStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  back: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  glyph: {
    fontSize: 48,
    color: '#C8B8E8',
    marginBottom: 20,
    opacity: 0.7,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Satoshi-Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  sub: {
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    textAlign: 'center',
    lineHeight: 21,
    opacity: 0.7,
  },
});
