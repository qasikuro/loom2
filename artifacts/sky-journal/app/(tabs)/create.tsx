import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images/index';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Image,
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

import { useApp, type StoryPanel, type StoryPage } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { DraftStore } from '@/utils/draftStore';

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

function MiniPageGrid({ page, getPanelImg }: { page: StoryPage; getPanelImg: (p: StoryPanel) => any }) {
  const layout = MINI_LAYOUTS.find(l => l.key === page.layoutKey) ?? MINI_LAYOUTS[0];
  const numRows = layout.rows.length;
  const rowH = (GRID_H - (numRows - 1) * GRID_G) / numRows;
  let idx = 0;

  return (
    <View style={{ width: GRID_W, height: GRID_H, borderRadius: 8, overflow: 'hidden', backgroundColor: '#0A0820' }}>
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
                    backgroundColor: '#1C1840',
                    marginLeft: ci > 0 ? GRID_G : 0,
                    overflow: 'hidden',
                  }}
                >
                  {imgSrc && (
                    <Image source={imgSrc} style={StyleSheet.absoluteFill} resizeMode="cover" />
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

export default function CreateScreen() {
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const { addStory } = useApp();
  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 120;

  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [mood,     setMood]     = useState('Hopeful');
  const [location, setLocation] = useState('Daylight Prairie');
  const [isPublic, setIsPublic] = useState(true);
  const [pages,    setPages]    = useState<StoryPage[]>([makePage()]);
  const [posting,  setPosting]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showMeta, setShowMeta] = useState(false);

  const currentMood = MOODS.find(m => m.label === mood);

  useFocusEffect(useCallback(() => {
    // nothing needed on focus
  }, []));

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

  function handlePublish() {
    if (!title.trim()) { setError('Give your story a title first.'); return; }
    const filledPages = pages
      .map(p => ({
        ...p,
        panels: p.panels.filter(panel =>
          panel.text.trim() || panel.bubbleText?.trim() || panel.imageUri || panel.bgPreset || (panel.overlays && panel.overlays.length > 0),
        ),
      }))
      .filter(p => p.panels.length > 0);
    if (!filledPages.length) { setError('Add content to at least one page.'); return; }
    setError(null);
    setPosting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addStory({
      id:             crypto.randomUUID(),
      date:           new Date().toISOString(),
      chapterTitle:   title.trim(),
      panels:         filledPages.flatMap(p => p.panels),
      mood,
      location,
      isPublic,
      witnessedCount: 0,
      savedCount:     0,
      pageLayoutKey:  filledPages[0].layoutKey,
      pages:          filledPages,
    });
    setPosting(false);
    setTitle('');
    setDesc('');
    setPages([makePage()]);
    router.push('/(tabs)');
  }

  // ── Panel image helper ───────────────────────────────────────────────────

  function getPanelImageSource(panel: StoryPanel) {
    if (panel.imageUri) return { uri: panel.imageUri };
    if (panel.bgPreset) {
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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header gradient */}
      <LinearGradient
        colors={['#14103A', '#0E0B28', colors.background]}
        style={[styles.headerGrad, { height: topPad + 80 }]}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Create Story</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{pages.length} page{pages.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerBtn, showMeta && { backgroundColor: `${colors.primary}22` }]}
          onPress={() => setShowMeta(v => !v)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="sliders" size={18} color={showMeta ? colors.primary : 'rgba(255,255,255,0.85)'} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* ── Title + Description ──────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title</Text>
          <TextInput
            style={[styles.titleInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: `rgba(255,255,255,0.04)` }]}
            placeholder="A Day Above the Clouds"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={t => { setTitle(t); if (error) setError(null); }}
            returnKeyType="next"
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Description</Text>
          <View style={styles.descWrapper}>
            <TextInput
              style={[styles.descInput, { color: colors.foreground }]}
              placeholder="A short story about friendship and adventure in Sky."
              placeholderTextColor={colors.mutedForeground}
              value={desc}
              onChangeText={setDesc}
              multiline
              textAlignVertical="top"
              returnKeyType="default"
            />
            <Image source={Images.character_default} style={styles.descIllustration} resizeMode="contain" />
          </View>
        </View>

        {/* ── Settings (expandable) ─────────────────────────────── */}
        {showMeta && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Mood</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {MOODS.map(m => (
                <TouchableOpacity
                  key={m.label}
                  style={[styles.chip, {
                    backgroundColor: mood === m.label ? `${m.color}22` : `${m.color}0C`,
                    borderColor:     mood === m.label ? `${m.color}55` : `${m.color}18`,
                    borderWidth:     mood === m.label ? 1.5 : 1,
                  }]}
                  onPress={() => { setMood(m.label); Haptics.selectionAsync(); }}
                >
                  <Icon name={m.icon} size={13} color={m.color} />
                  <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Location</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {LOCATIONS.map(loc => (
                <TouchableOpacity
                  key={loc}
                  style={[styles.chip, {
                    backgroundColor: location === loc ? `${colors.primary}18` : `${colors.primary}08`,
                    borderColor:     location === loc ? `${colors.primary}45` : `${colors.primary}15`,
                    borderWidth:     location === loc ? 1.5 : 1,
                  }]}
                  onPress={() => setLocation(loc)}
                >
                  <Icon name="map-pin" size={12} color={location === loc ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.chipText, { color: location === loc ? colors.primary : colors.mutedForeground }]}>{loc}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Visibility</Text>
            <View style={styles.privRow}>
              {(['Public', 'Private'] as const).map(opt => {
                const active = opt === 'Public' ? isPublic : !isPublic;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.privBtn, {
                      backgroundColor: active ? `${colors.primary}18` : colors.muted,
                      borderColor:     active ? `${colors.primary}45` : colors.border,
                      borderWidth:     active ? 1.5 : 1,
                    }]}
                    onPress={() => setIsPublic(opt === 'Public')}
                  >
                    <Icon name={opt === 'Public' ? 'globe' : 'lock'} size={13} color={active ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Pages ────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pages</Text>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Each page is a manga spread</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>{pages.length} / {MAX_PAGES}</Text>
            </View>
          </View>

          {pages.map((page, i) => {
            const layoutDef   = MINI_LAYOUTS.find(l => l.key === page.layoutKey) ?? MINI_LAYOUTS[0];
            const preview     = getPagePreview(page);
            const filledCount = page.panels.filter(p => p.text || p.bubbleText || p.imageUri || p.bgPreset).length;

            return (
              <View key={page.id}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <View style={styles.pageRow}>
                  {/* Mini layout grid */}
                  <MiniPageGrid page={page} getPanelImg={getPanelImageSource} />

                  {/* Info */}
                  <View style={styles.pageInfo}>
                    <View style={styles.pageInfoTop}>
                      <Text style={[styles.pageNum, { color: colors.foreground }]}>Page {i + 1}</Text>
                      <View style={[styles.layoutBadge, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}>
                        <Text style={[styles.layoutBadgeText, { color: colors.primary }]}>{layoutDef.label}</Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.pagePreview, { color: preview ? colors.mutedForeground : `${colors.mutedForeground}55`, fontStyle: preview ? 'italic' : 'normal' }]}
                      numberOfLines={2}
                    >
                      {preview || 'Empty — tap Edit to add content'}
                    </Text>
                    <Text style={[styles.panelCount, { color: `${colors.primary}70` }]}>
                      {filledCount}/{layoutDef.count} panels filled
                    </Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.pageActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}28` }]}
                      onPress={() => editPage(page.id, page.panels)}
                    >
                      <Icon name="edit-2" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    {pages.length > 1 && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: 'rgba(224,85,104,0.12)', borderColor: 'rgba(224,85,104,0.25)' }]}
                        onPress={() => deletePage(page.id)}
                      >
                        <Icon name="trash-2" size={13} color="#E05568" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Add Page button ───────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.addPageBtn, { borderColor: `${colors.primary}30`, opacity: pages.length >= MAX_PAGES ? 0.4 : 1 }]}
          onPress={addPage}
          activeOpacity={0.8}
          disabled={pages.length >= MAX_PAGES}
        >
          <LinearGradient
            colors={[`${colors.primary}1A`, `${colors.primary}0A`, 'transparent']}
            style={styles.addPageGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={[styles.addPageIconWrap, { backgroundColor: `${colors.primary}22` }]}>
              <Icon name="plus" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.addPageTitle, { color: colors.foreground }]}>Add Page</Text>
              <Text style={[styles.addPageSub, { color: colors.mutedForeground }]}>New set of manga panels</Text>
            </View>
            <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <Icon name="alert-circle" size={14} color="#E05C5C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Publish button ───────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.publishBtn, { opacity: posting ? 0.6 : 1 }]}
          onPress={handlePublish}
          disabled={posting}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.primary, '#6040E8', '#4A2ED0']}
            style={styles.publishGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Icon name="send" size={15} color="#fff" />
            <Text style={styles.publishText}>{posting ? 'Publishing…' : 'Publish Story'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },

  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: 18,
    paddingBottom:    14,
  },
  headerBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    fontSize: 17, fontFamily: 'Inter_700Bold',
    color: '#FFFFFF', letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 11, fontFamily: 'Inter_400Regular',
    textAlign: 'center', marginTop: 1,
  },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  card: {
    borderRadius: 20, borderWidth: 1,
    padding: 18, marginBottom: 14,
  },

  fieldLabel: {
    fontSize: 10, fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 8,
  },

  titleInput: {
    fontSize: 18, fontFamily: 'Inter_500Medium',
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },

  descWrapper:     { position: 'relative', minHeight: 80 },
  descInput: {
    fontSize: 14, fontFamily: 'Inter_400Regular',
    lineHeight: 22, minHeight: 80, paddingRight: 72,
    color: '#fff',
  },
  descIllustration: {
    position: 'absolute', bottom: 0, right: 0,
    width: 64, height: 64, opacity: 0.28,
  },

  chipRow: { marginBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, marginRight: 7,
  },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  privRow: { flexDirection: 'row', gap: 10 },
  privBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
  },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  sectionSub:   { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  divider: { height: 1, marginHorizontal: -2, opacity: 0.4, marginVertical: 2 },

  pageRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingVertical: 12,
  },

  pageInfo:    { flex: 1, gap: 4 },
  pageInfoTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageNum:     { fontSize: 13, fontFamily: 'Inter_700Bold' },
  layoutBadge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, borderWidth: 1,
  },
  layoutBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  pagePreview: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  panelCount:  { fontSize: 10, fontFamily: 'Inter_500Medium' },

  pageActions: { gap: 6 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },

  addPageBtn: {
    borderWidth: 1, borderRadius: 20,
    overflow: 'hidden', marginBottom: 14,
  },
  addPageGrad: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, paddingVertical: 16, paddingHorizontal: 16,
  },
  addPageIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  addPageTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  addPageSub:   { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(224,92,92,0.12)', borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.28)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: '#E05C5C' },

  publishBtn:  { borderRadius: 30, overflow: 'hidden', marginBottom: 4 },
  publishGrad: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 17,
  },
  publishText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: -0.2 },
});
