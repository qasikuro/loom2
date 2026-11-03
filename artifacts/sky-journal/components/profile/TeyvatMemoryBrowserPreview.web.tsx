import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rive, Fit, Alignment, Layout } from '@rive-app/canvas';
import { Asset } from 'expo-asset';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static references to bundled local assets. */
const RIVE_ASSET = require('../../assets/rive/teyvat_memory_box.riv');
const CLOSED_BOX = require('../../assets/teyvat/memory_box_closed.png');
const OPEN_BOX = require('../../assets/teyvat/memory_box_open.png');
const MEMORY_ART = [
  require('../../assets/images/story_bg1.png'),
  require('../../assets/images/story_bg2.png'),
  require('../../assets/images/story_bg3.png'),
  require('../../assets/images/create_dashboard.png'),
  require('../../assets/images/create_chapter.png'),
  require('../../assets/images/create_video.png'),
];
/* eslint-enable @typescript-eslint/no-require-imports */

const CATEGORIES = ['All', 'Stories', 'Outfits'] as const;
type Category = (typeof CATEGORIES)[number];
type ArtboardMode = 'BoxClosed' | 'BoxOpen';
type PreviewPage = 'cover' | 'gallery' | 'memory';

const DEMO_MEMORIES = MEMORY_ART.map((image, index) => ({
  id: `demo-${index}`,
  image,
  category: index < 3 ? 'Stories' : 'Outfits',
  title: index < 3
    ? ['A quiet afternoon in Mondstadt', 'Where the road bends', 'A light in the distance'][index]
    : ['A look worth remembering', 'A new chapter begins', 'Made for the journey'][index - 3],
  date: ['A moment from the journey', 'Kept in the archive', 'A day in Teyvat'][index % 3],
}));

const ANIMATION_CSS = `
  @keyframes archiveArrive { from { opacity: 0; transform: translateY(16px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes softDrift { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
  @keyframes revealCard { from { opacity: 0; transform: translateY(18px) rotate(-2deg) scale(.96); } to { opacity: 1; transform: translateY(0) rotate(0) scale(1); } }
  @keyframes lightPulse { 0%, 100% { opacity: .34; transform: scale(.94); } 50% { opacity: .65; transform: scale(1.04); } }
  .sm-page { position: relative; isolation: isolate; overflow: hidden; }
  .sm-page:before { content: ''; position: absolute; z-index: -1; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 38%, rgba(119, 105, 169, .23), transparent 42%), radial-gradient(ellipse at 8% 90%, rgba(103, 123, 154, .13), transparent 32%), linear-gradient(148deg, #12131e 0%, #191a2b 50%, #11131d 100%); }
  .sm-page:after { content: ''; position: absolute; z-index: -1; inset: 0; opacity: .15; pointer-events: none; background-image: radial-gradient(rgba(242,232,209,.45) .6px, transparent .6px); background-size: 27px 27px; mask-image: linear-gradient(transparent, black 18%, black 85%, transparent); }
  .sm-arrive { animation: archiveArrive .68s cubic-bezier(.2,.72,.2,1) both; }
  .sm-float { animation: softDrift 6s ease-in-out infinite; }
  .sm-card { animation: revealCard .65s cubic-bezier(.2,.72,.2,1) both; }
  .sm-glimmer { animation: lightPulse 5s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .sm-arrive, .sm-float, .sm-card, .sm-glimmer { animation: none !important; } }
`;

function webClass(className: string) {
  return { className } as unknown as ViewStyle;
}

function readPreviewState(): { page: PreviewPage; category: Category } {
  if (typeof window === 'undefined') return { page: 'cover', category: 'All' };
  const params = new URLSearchParams(window.location.search);
  const selectedCategory = params.get('category')?.toLowerCase();
  return {
    page: params.get('open') === 'gallery' ? 'gallery' : 'cover',
    category: selectedCategory === 'stories' ? 'Stories' : selectedCategory === 'outfits' ? 'Outfits' : 'All',
  };
}

function RiveCanvas({ mode }: { mode: ArtboardMode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = Asset.fromModule(RIVE_ASSET).uri;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) {
      setFailed(true);
      return;
    }

    let instance: Rive | null = null;
    try {
      setLoaded(false);
      setFailed(false);
      instance = new Rive({
        src: source,
        canvas,
        artboard: mode,
        stateMachine: mode === 'BoxClosed' ? 'MemoryIdle' : 'MemoryReveal',
        autoplay: true,
        layout: new Layout({
          fit: mode === 'BoxClosed' ? Fit.Contain : Fit.Contain,
          alignment: Alignment.Center,
        }),
        onLoad: () => {
          instance?.resizeDrawingSurfaceToCanvas();
          setLoaded(true);
        },
        onLoadError: () => {
          setLoaded(false);
          setFailed(true);
        },
      });
    } catch {
      setLoaded(false);
      setFailed(true);
    }

    const resize = () => instance?.resizeDrawingSurfaceToCanvas();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      instance?.cleanup();
    };
  }, [mode, source]);

  return (
    <View style={styles.riveWrap}>
      {(failed || !loaded) && (
        React.createElement('img', {
          src: Asset.fromModule(mode === 'BoxClosed' ? CLOSED_BOX : OPEN_BOX).uri,
          alt: '',
          'aria-hidden': true,
          draggable: false,
          style: {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          },
        })
      )}
      {!failed && React.createElement('canvas', {
        ref: canvasRef,
        'aria-label': mode === 'BoxClosed' ? 'Animated closed Teyvat memory box' : 'Animated open Teyvat memory box',
        style: { display: 'block', width: '100%', height: '100%', opacity: loaded ? 1 : 0 },
      })}
    </View>
  );
}

export function TeyvatMemoryBrowserPreview() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [previewState] = useState(readPreviewState);
  const [page, setPage] = useState<PreviewPage>(previewState.page);
  const [category, setCategory] = useState<Category>(previewState.category);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailDragY = useRef(new Animated.Value(0)).current;
  const detailOpacity = useRef(new Animated.Value(1)).current;
  const cardReveal = useRef(new Animated.Value(0)).current;
  const selected = DEMO_MEMORIES.find(item => item.id === selectedId);
  const filtered = useMemo(
    () => category === 'All' ? DEMO_MEMORIES : DEMO_MEMORIES.filter(item => item.category === category),
    [category],
  );
  const isNarrow = width < 600;
  const columns = width >= 1050 ? 6 : width >= 700 ? 5 : width >= 340 ? 4 : 3;
  const contentWidth = Math.min(Math.max(width - 36, 0), 880);
  const gap = isNarrow ? 7 : 10;
  const tileWidth = Math.floor((contentWidth - gap * (columns - 1)) / columns);

  const closeMemory = useCallback(() => {
    Animated.parallel([
      Animated.timing(detailDragY, { toValue: Math.max(height * 0.36, 180), duration: 190, useNativeDriver: true }),
      Animated.timing(detailOpacity, { toValue: 0, duration: 190, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setPage('gallery');
      setSelectedId(null);
      detailDragY.setValue(0);
      detailOpacity.setValue(1);
      cardReveal.setValue(0);
    });
  }, [cardReveal, detailDragY, detailOpacity, height]);
  useEffect(() => {
    if (page !== 'memory' || !selectedId) return;
    cardReveal.setValue(0);
    const reveal = Animated.spring(cardReveal, {
      toValue: 1,
      stiffness: 135,
      damping: 18,
      mass: 0.8,
      useNativeDriver: true,
    });
    reveal.start();
    return () => reveal.stop();
  }, [cardReveal, page, selectedId]);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => !!selectedId && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
    onPanResponderMove: (_, gesture) => {
      if (gesture.dy > 0) {
        detailDragY.setValue(gesture.dy);
        detailOpacity.setValue(Math.max(0.24, 1 - gesture.dy / Math.max(height * 0.8, 1)));
      }
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > Math.min(105, height * 0.16) || gesture.vy > 1.1) {
        closeMemory();
      } else {
        Animated.parallel([
          Animated.spring(detailDragY, { toValue: 0, useNativeDriver: true, bounciness: 3 }),
          Animated.timing(detailOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
      }
    },
    onPanResponderTerminate: () => Animated.parallel([
      Animated.spring(detailDragY, { toValue: 0, useNativeDriver: true, bounciness: 3 }),
      Animated.timing(detailOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start(),
  }), [closeMemory, detailDragY, detailOpacity, height, selectedId]);

  const chooseMemory = (id: string) => {
    detailDragY.setValue(0);
    detailOpacity.setValue(1);
    setSelectedId(id);
    setPage('memory');
  };

  if (!__DEV__) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.title}>Preview unavailable</Text>
        <Text style={styles.hint}>This demo is available from the development browser preview only.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.page, webClass('sm-page'), { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 18) }]}>
      {React.createElement('style', null, ANIMATION_CSS)}
      <View style={[styles.content, { width: contentWidth }]}>
        {page === 'cover' && (
          <View style={[styles.coverStage, webClass('sm-arrive')]}>
            <View style={styles.brandline}>
              <View style={styles.brandSeal}><Text style={styles.brandSealText}>S</Text></View>
              <Text style={styles.eyebrow}>STORIGAM <Text style={styles.eyebrowDivider}>/</Text> MEMORY BOX</Text>
            </View>
            <Text style={styles.title}>Teyvat, kept close.</Text>
            <Text style={styles.hint}>A personal archive for the moments that made the journey yours.</Text>
            <View style={styles.coverFilters} accessibilityLabel="Choose archive contents">
              {CATEGORIES.map(option => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === option }}
                  onPress={() => setCategory(option)}
                  style={[styles.filter, category === option && styles.activeFilter]}
                >
                  <Text style={[styles.filterText, category === option && styles.activeFilterText]}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open Teyvat memory box with ${category.toLowerCase()} selected`}
              onPress={() => setPage('gallery')}
              style={[styles.coverCard, webClass('sm-float')]}
            >
              <View style={[styles.coverHalo, webClass('sm-glimmer')]} />
              <View style={styles.coverCanvas}>
                <RiveCanvas mode="BoxClosed" />
              </View>
              <View style={styles.coverCardRule} />
              <Text style={styles.coverLabel}>Your Teyvat memory box</Text>
              <Text style={styles.coverSubLabel}>Open the lid. Find your way back.</Text>
              <View style={styles.openPrompt}><Text style={styles.openPromptText}>OPEN ARCHIVE</Text><Text style={styles.openArrow}>↗</Text></View>
            </Pressable>
            <Text style={styles.demoNote}>A small sample archive <Text style={styles.noteDot}>·</Text> No account data</Text>
          </View>
        )}

        {page === 'gallery' && (
          <View style={[styles.galleryPage, webClass('sm-arrive')]}>
            <View style={styles.galleryHeader}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>TEYVAT MEMORY BOX</Text>
                <Text style={styles.galleryTitle}>The archive</Text>
                <Text style={styles.hint}>{filtered.length} {filtered.length === 1 ? 'moment' : 'moments'} saved in this view</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close archive and return to memory box"
                onPress={() => setPage('cover')}
                style={styles.closeButton}
              >
                <Text style={styles.closeLabel}>×</Text>
              </Pressable>
            </View>
            <View style={styles.openBoxCanvas}>
              <RiveCanvas mode="BoxOpen" />
              <View style={styles.boxCaption}><Text style={styles.boxCaptionText}>A box of small beginnings and faraway places</Text></View>
            </View>
            <View style={styles.archiveToolbar}>
              <View style={styles.filters}>
                {CATEGORIES.map(option => (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: category === option }}
                    onPress={() => setCategory(option)}
                    style={[styles.filter, category === option && styles.activeFilter]}
                  >
                    <Text style={[styles.filterText, category === option && styles.activeFilterText]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.archiveCount}>{String(filtered.length).padStart(2, '0')} / {String(DEMO_MEMORIES.length).padStart(2, '0')}</Text>
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
              {filtered.length ? filtered.map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open memory: ${item.title}`}
                  onPress={() => chooseMemory(item.id)}
                  style={[
                    styles.memoryTile,
                    webClass('sm-card'),
                     {
                       width: tileWidth,
                       height: tileWidth,
                       marginRight: index % columns === columns - 1 ? 0 : gap,
                       marginBottom: gap,
                       animationDelay: `${index * 75}ms`,
                     } as unknown as ViewStyle,
                  ]}
                >
                  <ExpoImage source={item.image} style={styles.tileImage} contentFit="cover" />
                </Pressable>
              )) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptySeal}><Text style={styles.emptySealText}>—</Text></View>
                  <Text style={styles.emptyTitle}>Nothing tucked away here yet.</Text>
                  <Text style={styles.emptyCopy}>Choose another part of the archive to revisit your moments.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {page === 'memory' && selected && (
          <Animated.View
            style={[
              styles.memoryScreen,
              webClass('sm-arrive'),
              { opacity: detailOpacity, transform: [{ translateY: detailDragY }] },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.memoryTopbar}>
              <Text style={styles.memoryIndex}>{String(filtered.findIndex(item => item.id === selected.id) + 1).padStart(2, '0')} <Text style={styles.indexDivider}>/</Text> {String(filtered.length).padStart(2, '0')}</Text>
            </View>
            <Animated.View
              style={[
                styles.fullMemoryFrame,
                {
                  opacity: cardReveal,
                  transform: [{ scale: cardReveal.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
                },
              ]}
            >
              <View style={styles.frameInner}>
                <ExpoImage source={selected.image} style={styles.fullMemory} contentFit="contain" />
              </View>
              <View pointerEvents="none" style={styles.frameShine} />
            </Animated.View>
            <View style={styles.memoryDetails}>
              <Text style={styles.memoryCategory}>{selected.category.toUpperCase()} <Text style={styles.noteDot}>·</Text> TEYVAT</Text>
              <Text style={styles.memoryTitle}>{selected.title}</Text>
              <Text style={styles.memoryDate}>{selected.date}</Text>
            </View>
            <View style={styles.memoryControls} pointerEvents="none">
              <Text style={styles.swipeHint}>Swipe down to return</Text>
            </View>
          </Animated.View>
        )}
      </View>
      <Text style={styles.footer}>Demo artwork and sample cards only. Your personal gallery remains unchanged.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#12131e',
  },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#12131e' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', maxHeight: 1020, minHeight: 0 },
  coverStage: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  brandline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
  brandSeal: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: '#b7ad8e', alignItems: 'center', justifyContent: 'center' },
  brandSealText: { color: '#ddd3b5', fontSize: 13, fontWeight: '700', fontFamily: 'serif' },
  eyebrow: { color: '#c8c0a5', fontSize: 10, fontWeight: '700', letterSpacing: 2.4 },
  eyebrowDivider: { color: '#817d79', fontWeight: '400' },
  title: { color: '#f0ecdf', fontSize: 38, lineHeight: 47, fontWeight: '500', textAlign: 'center', letterSpacing: -1.2, fontFamily: 'Georgia, serif' },
  hint: { color: '#aaa9b2', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 7, maxWidth: 440 },
  coverFilters: { flexDirection: 'row', alignSelf: 'center', justifyContent: 'center', gap: 8, marginTop: 22, marginBottom: 5 },
  coverCard: {
    width: 310,
    maxWidth: '100%',
    minHeight: 406,
    marginTop: 15,
    overflow: 'hidden',
    borderRadius: 158,
    borderWidth: 1,
    borderColor: 'rgba(205,194,158,.42)',
    backgroundColor: 'rgba(31,33,48,.82)',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 21,
    paddingHorizontal: 20,
    shadowColor: '#b8a77d',
    shadowOpacity: 0.17,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  coverHalo: { position: 'absolute', width: 230, height: 230, top: 44, borderRadius: 120, backgroundColor: 'rgba(202,188,143,.15)' },
  coverCanvas: { width: '100%', height: 244 },
  coverCardRule: { width: 45, height: 1, backgroundColor: '#817957', opacity: 0.9, marginTop: 0 },
  coverLabel: { color: '#f0ecdf', fontSize: 17, fontWeight: '600', textAlign: 'center', marginTop: 12, fontFamily: 'Georgia, serif' },
  coverSubLabel: { color: '#aaa9b2', fontSize: 12, marginTop: 5, letterSpacing: 0.25 },
  openPrompt: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 17 },
  openPromptText: { color: '#d0c8ae', fontSize: 9, fontWeight: '700', letterSpacing: 2.3 },
  openArrow: { color: '#d0c8ae', fontSize: 14, marginTop: -2 },
  demoNote: { color: '#878894', fontSize: 11, letterSpacing: 0.4, marginTop: 17 },
  noteDot: { color: '#b8a77d' },
  galleryPage: { flex: 1, width: '100%', maxHeight: '100%', minHeight: 0 },
  galleryHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, paddingTop: 5 },
  headerCopy: { alignItems: 'flex-start' },
  galleryTitle: { color: '#f0ecdf', fontSize: 34, lineHeight: 41, fontWeight: '500', letterSpacing: -0.7, marginTop: 4, fontFamily: 'Georgia, serif' },
  closeButton: { width: 42, height: 42, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(51,52,66,.72)', borderWidth: 1, borderColor: '#555464' },
  closeLabel: { color: '#e4e0d3', fontSize: 26, lineHeight: 29, fontWeight: '300' },
  openBoxCanvas: { width: '100%', height: 155, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  boxCaption: { position: 'absolute', bottom: 1, alignSelf: 'center' },
  boxCaptionText: { color: '#a8a6ac', fontSize: 11, letterSpacing: 0.25, textAlign: 'center' },
  archiveToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(188,180,157,.17)', paddingBottom: 12, marginTop: 10, marginBottom: 14 },
  filters: { flexDirection: 'row', gap: 7 },
  filter: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, alignItems: 'center', backgroundColor: 'rgba(49,50,65,.72)', borderWidth: 1, borderColor: 'rgba(170,166,153,.13)' },
  activeFilter: { backgroundColor: '#c8bd9b', borderColor: '#d8ceb0' },
  filterText: { color: '#b9b8c0', fontWeight: '600', fontSize: 12 },
  activeFilterText: { color: '#282a35' },
  archiveCount: { color: '#8f9099', fontSize: 10, letterSpacing: 1.4, fontVariant: ['tabular-nums'] },
  scroll: { width: '100%', flex: 1, minHeight: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', paddingBottom: 24 },
  memoryTile: { position: 'relative', overflow: 'hidden', borderRadius: 14, backgroundColor: '#252735', borderWidth: 1, borderColor: 'rgba(199,188,158,.34)', shadowColor: '#080a11', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  tileImage: { width: '100%', height: '100%' },
  emptyState: { width: '100%', minHeight: 190, alignItems: 'center', justifyContent: 'center', padding: 26, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(199,188,158,.2)', backgroundColor: 'rgba(37,39,53,.5)' },
  emptySeal: { width: 34, height: 34, borderRadius: 18, borderWidth: 1, borderColor: '#827b64', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptySealText: { color: '#c8bd9b', fontSize: 17 },
  emptyTitle: { color: '#e8e4d8', fontSize: 16, fontWeight: '600', fontFamily: 'Georgia, serif' },
  emptyCopy: { color: '#a8a6af', fontSize: 12, textAlign: 'center', marginTop: 7, maxWidth: 270, lineHeight: 18 },
  memoryScreen: { flex: 1, width: '100%', minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  memoryTopbar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingVertical: 6 },
  memoryIndex: { color: '#ded9cb', fontSize: 11, letterSpacing: 1.3 },
  indexDivider: { color: '#777983' },
  fullMemoryFrame: { flex: 1, width: '100%', minHeight: 0, marginTop: 10, marginBottom: 15, borderRadius: 17, padding: 8, overflow: 'hidden', backgroundColor: 'rgba(208,199,170,.1)', borderWidth: 1, borderColor: 'rgba(211,199,160,.4)' },
  frameInner: { flex: 1, minHeight: 0, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 11, backgroundColor: 'rgba(12,14,21,.78)' },
  fullMemory: { width: '100%', height: '100%' },
  frameShine: { ...StyleSheet.absoluteFill, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(246,238,213,.11)' },
  memoryDetails: { alignSelf: 'stretch', alignItems: 'center', paddingBottom: 8 },
  memoryCategory: { color: '#c9bd98', fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  memoryTitle: { color: '#f0ecdf', fontSize: 25, lineHeight: 31, marginTop: 7, textAlign: 'center', fontFamily: 'Georgia, serif' },
  memoryDate: { color: '#a5a5ad', fontSize: 12, marginTop: 5 },
  memoryControls: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 9 },
  swipeHint: { color: '#92939d', fontSize: 11, letterSpacing: 0.35 },
  riveWrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  footer: { color: '#777983', fontSize: 10, textAlign: 'center', marginTop: 10, maxWidth: 570, letterSpacing: 0.2 },
});
