/**
 * ChapterReaderScreen — immersive full-screen chapter reader.
 *
 * Pages are navigated with horizontal swipe (FlatList pagingEnabled).
 * Each page renders its panel grid using the same manga layout system
 * as StoryViewerScreen.
 *
 * Route: /chapter-reader?chapterId=<uuid>&bookId=<uuid>
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { SecureImage as Image } from '@/components/SecureImage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon } from '@/components/Icon';
import { useApiFetch } from '../utils/apiClient';
import type { PanelOverlay } from '@/context/AppContext';
import { Images } from '@/assets/images/index';
import { SkyLoadingOverlay } from '@/components/SkyLoading';
import { useTranslation } from 'react-i18next';
import { PanelSticker } from '@/components/PanelSticker';
import { PanelOverlayText } from '@/components/PanelOverlayText';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChapterPanel {
  id: string;
  text: string;
  imageUri?: string;
  bgPreset?: string;
  bubbleText?: string;
  overlays?: PanelOverlay[];
  contentFit?: 'cover' | 'contain';
}

interface ChapterPage {
  id: string;
  layoutKey: string;
  panels: ChapterPanel[];
}

interface ChapterData {
  id: string;
  bookId: string;
  title: string;
  orderIndex: number;
  publishedAt: string | null;
  pageCount: number;
  pages: ChapterPage[];
}

// ── Layout registry ───────────────────────────────────────────────────────────

interface LayoutDef { key: string; rows: number[][] }
const LAYOUTS: LayoutDef[] = [
  { key: '1',  rows: [[1]] },
  { key: '2v', rows: [[1], [1]] },
  { key: '2h', rows: [[1, 1]] },
  { key: '3a', rows: [[1], [1, 1]] },
  { key: '3b', rows: [[1, 1], [1]] },
  { key: '4',  rows: [[1, 1], [1, 1]] },
  { key: '5a', rows: [[1], [1, 1], [1, 1]] },
  { key: '5b', rows: [[1, 1, 1], [1, 1]] },
];
const GUTTER = 3;
function getLayout(key?: string): LayoutDef {
  return LAYOUTS.find(l => l.key === key) ?? LAYOUTS[0]!;
}

// ── Background presets ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BG_PRESET_MAP: Record<string, any> = {
  bg1:  Images.story_bg1,
  bg2:  Images.story_bg2,
  bg3:  Images.story_bg3,
  char: Images.character_default,
};
function getPanelSrc(imageUri?: string, bgPreset?: string) {
  if (imageUri) return { uri: imageUri };
  if (bgPreset && BG_PRESET_MAP[bgPreset]) return BG_PRESET_MAP[bgPreset];
  return null;
}
const GRADIENT: [string, string, string] = ['#1A1630', '#252070', '#1E1A4A'];

const ACCENT = '#8B70C8';

// ── PanelCell ─────────────────────────────────────────────────────────────────

function PanelCell({ panel, cellW, cellH }: { panel: ChapterPanel; cellW: number; cellH: number }) {
  const imgSrc = getPanelSrc(panel.imageUri, panel.bgPreset);
  return (
    <View style={[{ width: cellW, height: cellH }, styles.cell]}>
      {imgSrc ? (
        <Image source={imgSrc} style={StyleSheet.absoluteFill} contentFit={panel.contentFit ?? 'cover'} cachePolicy="memory-disk" />
      ) : (
        <LinearGradient colors={GRADIENT} style={StyleSheet.absoluteFill} />
      )}
      {imgSrc && (
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.42)']} style={[StyleSheet.absoluteFill, { top: '40%' }]} />
      )}
      {/* Overlays */}
      {(panel.overlays ?? []).map(ov => {
        const left = ov.xPct * cellW;
        const top  = ov.yPct * cellH;
        const fontSize = ov.fontSize ?? (ov.type === 'sticker' ? 24 : 12);
        const bRadius = ov.bubbleStyle === 'sharp' ? 2 : ov.bubbleStyle === 'oval' ? 50 : 10;
        const hasTail = ov.bubbleStyle !== 'oval';
        return (
          <View key={ov.id} style={{ position: 'absolute', left, top, zIndex: 15 }}>
            {ov.type === 'bubble' && (
              <View style={[styles.bubble, { borderRadius: bRadius, maxWidth: cellW * 0.72 }]}>
                <PanelOverlayText overlay={ov} fontSize={fontSize} style={styles.bubbleTxt} numberOfLines={6} />
                {hasTail && <View style={styles.bubbleTail} />}
              </View>
            )}
            {ov.type === 'text' && (
              <PanelOverlayText overlay={ov} fontSize={fontSize} style={styles.overlayTxt} />
            )}
            {ov.type === 'sticker' && <PanelSticker content={ov.content} size={fontSize} />}
          </View>
        );
      })}
      {/* Legacy bubble */}
      {!!panel.bubbleText?.trim() && (
        <View style={styles.bubble}>
          <Text style={styles.bubbleTxt} numberOfLines={4}>{panel.bubbleText}</Text>
          <View style={styles.bubbleTail} />
        </View>
      )}
      {/* Caption */}
      {panel.text.trim().length > 0 && (
        <View style={styles.caption}>
          <Text style={styles.captionTxt} numberOfLines={3}>{panel.text}</Text>
        </View>
      )}
    </View>
  );
}

// ── MangaPage ─────────────────────────────────────────────────────────────────

function MangaPage({ page, screenW }: { page: ChapterPage; screenW: number }) {
  const layout = getLayout(page.layoutKey);
  let panelIdx = 0;
  return (
    <View style={{ width: screenW }}>
      {layout.rows.map((cols, ri) => {
        const totalFlex = cols.reduce((a, b) => a + b, 0);
        // Estimate row height: portrait 3:4 for the first cell
        const firstCellW = (screenW - (cols.length - 1) * GUTTER) * (cols[0]! / totalFlex);
        const rH = Math.round(firstCellW * (4 / 3));
        const rowPanels = cols.map(() => page.panels[panelIdx++]);
        return (
          <View key={ri} style={{ flexDirection: 'row', marginTop: ri > 0 ? GUTTER : 0 }}>
            {cols.map((flex, ci) => {
              const cellW = (screenW - (cols.length - 1) * GUTTER) * (flex / totalFlex);
              const p = rowPanels[ci];
              return p ? (
                <PanelCell key={p.id} panel={p} cellW={cellW} cellH={rH} />
              ) : (
                <View key={ci} style={{ width: cellW, height: rH, backgroundColor: '#0D0B1A' }} />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ChapterReaderScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const apiFetch = useApiFetch();
  const { chapterId, bookId } = useLocalSearchParams<{ chapterId: string; bookId: string }>();

  const [chapter,      setChapter]      = useState<ChapterData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [currentPage,  setCurrentPage]  = useState(0);
  const [fontSize,     setFontSize]     = useState(14);
  const [showControls, setShowControls] = useState(true);
  const [bookmarked,   setBookmarked]   = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const controlHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load bookmark state
  useEffect(() => {
    if (!chapterId) return;
    AsyncStorage.getItem(`bookmark_chapter_${chapterId}`)
      .then(v => setBookmarked(v === '1'))
      .catch(() => {});
  }, [chapterId]);

  // Load chapter
  useEffect(() => {
    if (!chapterId || !bookId) {
      setLoading(false);
      return;
    }
    apiFetch<ChapterData>(`/chapters/${chapterId}/read`)
      .then(data => setChapter(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chapterId, bookId]);

  // Auto-hide controls
  useEffect(() => {
    scheduleHide();
    return () => { if (controlHideTimer.current) clearTimeout(controlHideTimer.current); };
  }, []);

  function scheduleHide() {
    if (controlHideTimer.current) clearTimeout(controlHideTimer.current);
    controlHideTimer.current = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowControls(false));
    }, 4000);
  }

  function toggleControls() {
    if (showControls) {
      if (controlHideTimer.current) clearTimeout(controlHideTimer.current);
      Animated.timing(controlsOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowControls(false));
    } else {
      setShowControls(true);
      controlsOpacity.setValue(0);
      Animated.timing(controlsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      scheduleHide();
    }
    setShowFontMenu(false);
  }

  async function handleShare() {
    if (!chapter) return;
    try {
      await Share.share({
        message: t('studioReader.shareChapterMessage', { title: chapter.title }),
        title: chapter.title,
      });
    } catch { /* user dismissed */ }
  }

  async function toggleBookmark() {
    if (!chapterId) return;
    const next = !bookmarked;
    setBookmarked(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await AsyncStorage.setItem(`bookmark_chapter_${chapterId}`, next ? '1' : '0').catch(() => {});
  }

  const totalPages = chapter?.pages.length ?? 0;
  const isLast = currentPage === totalPages - 1;
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading) {
    return <View style={styles.root}><SkyLoadingOverlay message={t('studioReader.openingChapter')} /></View>;
  }

  if (!chapterId || !bookId) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={styles.errorTxt}>{t('studioReader.missingChapterId')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: ACCENT, fontSize: 14 }}>{t('studioReader.goBackLower')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!chapter || chapter.pages.length === 0) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Icon name="book-open" size={40} color="rgba(200,185,255,0.2)" />
        <Text style={styles.errorTxt}>{t('studioReader.noChapterPages')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: ACCENT, fontSize: 14 }}>{t('studioReader.goBackLower')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── End-of-chapter card ────────────────────────────────────────────────────

  const endCard = (
    <View style={[styles.endCard, { width: screenW, minHeight: screenH, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingBottom: bottomInset + 72, gap: 20 }]}>
      <Icon name="check-circle" size={44} color={ACCENT} />
      <Text style={styles.endTitle}>{t('studioReader.endOfChapter', { number: chapter.orderIndex + 1 })}</Text>
      <Text style={styles.endSub}>"{chapter.title}"</Text>
      <TouchableOpacity
        style={styles.endBtn}
        onPress={() => router.push(`/engagement?chapterId=${chapterId}&bookId=${bookId}&tab=comments` as never)}
        activeOpacity={0.85}
      >
        <Icon name="message-circle" size={15} color="#fff" />
        <Text style={styles.endBtnTxt}>{t('studioReader.leaveComment')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.endBtn, styles.endBtnSecondary]}
        onPress={() => router.push(`/book-public?bookId=${bookId}` as never)}
        activeOpacity={0.85}
      >
        <Icon name="book" size={15} color={ACCENT} />
        <Text style={[styles.endBtnTxt, { color: ACCENT }]}>{t('studioReader.viewAllChapters')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Pages + end card
  const data: Array<ChapterPage | 'end'> = [...chapter.pages, 'end'];

  return (
    <View style={styles.root}>
      {/* Page swipe */}
      <TouchableWithoutFeedback onPress={toggleControls}>
        <FlatList
          data={data}
          keyExtractor={(item, i) => typeof item === 'string' ? 'end' : item.id ?? String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenW);
            setCurrentPage(Math.min(idx, totalPages - 1));
          }}
          renderItem={({ item }) => {
            if (item === 'end') return endCard;
            return (
              <View style={{ width: screenW, minHeight: screenH, backgroundColor: '#0D0B1A' }}>
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{
                    minHeight: screenH,
                    paddingTop: topInset + 52,
                    paddingBottom: bottomInset + 72,
                    justifyContent: 'center',
                  }}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  <MangaPage page={item} screenW={screenW} />
                </ScrollView>
              </View>
            );
          }}
          getItemLayout={(_, index) => ({ length: screenW, offset: screenW * index, index })}
        />
      </TouchableWithoutFeedback>

      {/* Top controls overlay */}
      <Animated.View
        style={[styles.topBar, { paddingTop: topInset + 8, opacity: controlsOpacity }]}
        pointerEvents={showControls ? 'box-none' : 'none'}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        {/* Progress pill */}
        <View style={styles.progressPill}>
          <Text style={styles.progressTxt}>
            {Math.min(currentPage + 1, totalPages)} / {totalPages}
          </Text>
        </View>

        <View style={styles.topActions}>
          {/* Font size */}
          <TouchableOpacity
            onPress={() => { setShowFontMenu(f => !f); scheduleHide(); }}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.aaBtn}>Aa</Text>
          </TouchableOpacity>
          {/* Share */}
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="share-2" size={17} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>
          {/* Bookmark */}
          <TouchableOpacity onPress={toggleBookmark} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="bookmark" size={18} color={bookmarked ? '#FFCC44' : 'rgba(255,255,255,0.65)'} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Font size picker */}
      {showFontMenu && showControls && (
        <View style={[styles.fontMenu, { top: topInset + 52 }]}>
          {[12, 14, 16, 18, 20].map(sz => (
            <TouchableOpacity
              key={sz}
              style={[styles.fontOption, fontSize === sz && styles.fontOptionActive]}
              onPress={() => { setFontSize(sz); setShowFontMenu(false); scheduleHide(); }}
            >
              <Text style={[styles.fontOptionTxt, { fontSize: sz }, fontSize === sz && { color: ACCENT }]}>A</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Bottom action bar */}
      <Animated.View
        style={[styles.bottomBar, { paddingBottom: bottomInset + 8, opacity: controlsOpacity }]}
        pointerEvents={showControls ? 'box-none' : 'none'}
      >
        <TouchableOpacity
          style={styles.barBtn}
          onPress={() => router.push(`/engagement?chapterId=${chapterId}&bookId=${bookId}&tab=comments` as never)}
        >
          <Icon name="message-circle" size={20} color="rgba(255,255,255,0.60)" />
          <Text style={styles.barBtnTxt}>{t('studioReader.comments')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.barBtn} onPress={toggleBookmark}>
          <Icon name="bookmark" size={20} color={bookmarked ? '#FFCC44' : 'rgba(255,255,255,0.60)'} />
          <Text style={[styles.barBtnTxt, bookmarked && { color: '#FFCC44' }]}>
            {bookmarked ? t('studioReader.bookmarked') : t('studioReader.bookmark')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.barBtn}
          onPress={() => router.push(`/book-public?bookId=${bookId}` as never)}
        >
          <Icon name="book" size={20} color="rgba(255,255,255,0.60)" />
          <Text style={styles.barBtnTxt}>{t('studioReader.chapters')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#0D0B1A' },
  cell:           { overflow: 'hidden' },
  bubble:         { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.92)', padding: 8, borderRadius: 10, zIndex: 20 },
  bubbleTxt:      { color: '#1a1a2e', fontSize: 11, fontWeight: '600' },
  bubbleTail:     { position: 'absolute', bottom: -8, left: 12, width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'rgba(255,255,255,0.92)' },
  overlayTxt:     { textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  caption:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.72)', paddingVertical: 7, paddingHorizontal: 10 },
  captionTxt:     { color: 'rgba(255,255,255,0.88)', fontSize: 11, lineHeight: 16 },
  topBar:         { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10, backgroundColor: 'rgba(13,11,26,0.75)' },
  iconBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  progressPill:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', flexShrink: 1 },
  progressTxt:    { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
  topActions:     { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  aaBtn:          { color: 'rgba(255,255,255,0.80)', fontSize: 16, fontWeight: '700' },
  fontMenu:       { position: 'absolute', right: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6, backgroundColor: 'rgba(30,24,60,0.95)', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', zIndex: 50, maxWidth: '94%' },
  fontOption:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  fontOptionActive:{ backgroundColor: 'rgba(139,112,200,0.20)' },
  fontOptionTxt:  { color: 'rgba(255,255,255,0.55)' },
  bottomBar:      { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12, backgroundColor: 'rgba(13,11,26,0.85)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  barBtn:         { alignItems: 'center', gap: 4, paddingBottom: 4, minWidth: 72, flexShrink: 1 },
  barBtnTxt:      { color: 'rgba(255,255,255,0.45)', fontSize: 10 },
  endCard:        { backgroundColor: '#0D0B1A' },
  endTitle:       { color: 'rgba(255,255,255,0.88)', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  endSub:         { color: 'rgba(200,185,255,0.45)', fontSize: 14, textAlign: 'center', fontStyle: 'italic' },
  endBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 26, backgroundColor: ACCENT, maxWidth: '100%' },
  endBtnSecondary:{ backgroundColor: 'rgba(139,112,200,0.12)', borderWidth: 1, borderColor: `${ACCENT}44` },
  endBtnTxt:      { color: '#fff', fontSize: 14, fontWeight: '600' },
  errorTxt:       { color: 'rgba(200,185,255,0.45)', fontSize: 15, marginTop: 12, textAlign: 'center', paddingHorizontal: 32 },
});
