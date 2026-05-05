import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images/index';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
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

import { useApp, type StoryPanel } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { DraftStore } from '@/utils/draftStore';

const MAX_PANELS = 20;

const MOODS = [
  { label: 'Hopeful',     icon: 'sun'     as const, color: '#C8A84B' },
  { label: 'Lonely',      icon: 'moon'    as const, color: '#7090C0' },
  { label: 'Peaceful',    icon: 'cloud'   as const, color: '#78A8C8' },
  { label: 'Romantic',    icon: 'heart'   as const, color: '#C870A0' },
  { label: 'Chaotic',     icon: 'zap'     as const, color: '#D0784A' },
  { label: 'Dreamy',      icon: 'star'    as const, color: '#8B6BA8' },
  { label: 'Soft',        icon: 'feather' as const, color: '#9888C0' },
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

export default function CreateScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { addStory } = useApp();
  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 90;

  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [mood, setMood]           = useState('Hopeful');
  const [location, setLocation]   = useState('Daylight Prairie');
  const [isPublic, setIsPublic]   = useState(true);
  const [panels, setPanels]       = useState<StoryPanel[]>([makePanel()]);
  const [posting, setPosting]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [showMeta, setShowMeta]   = useState(false);
  const [panelMenu, setPanelMenu] = useState<number | null>(null);

  const currentMood = MOODS.find(m => m.label === mood);

  // When returning from panel-editor, panels state is already updated via DraftStore callback
  // Just clear any stale menu state
  useFocusEffect(useCallback(() => {
    setPanelMenu(null);
  }, []));

  function openPanelEditor(index: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    DraftStore.set({
      panels,
      activePanelIndex: index,
      onSave: (updated) => setPanels(updated),
    });
    router.push('/panel-editor');
  }

  function addPanel() {
    if (panels.length >= MAX_PANELS) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPanels(prev => [...prev, makePanel()]);
  }

  function removePanel(i: number) {
    if (panels.length <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPanels(prev => prev.filter((_, idx) => idx !== i));
    setPanelMenu(null);
  }

  function handlePublish() {
    if (!title.trim()) { setError('Give your story a title first.'); return; }
    const filled = panels.filter(p => p.text.trim() || p.bubbleText?.trim() || p.imageUri || p.bgPreset || (p.overlays && p.overlays.length > 0));
    if (!filled.length) { setError('Add content to at least one panel.'); return; }
    setError(null);
    setPosting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addStory({
      id:             crypto.randomUUID(),
      date:           new Date().toISOString(),
      chapterTitle:   title.trim(),
      panels:         filled,
      mood,
      location,
      isPublic,
      witnessedCount: 0,
      savedCount:     0,
    });
    setPosting(false);
    setTitle('');
    setDesc('');
    setPanels([makePanel()]);
    router.push('/(tabs)');
  }

  function getPanelPreview(panel: StoryPanel): string {
    if (panel.bubbleText?.trim()) return panel.bubbleText.trim();
    if (panel.text.trim()) return panel.text.trim();
    return 'Tap to add content...';
  }

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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header gradient */}
      <LinearGradient
        colors={['#1A1640', '#1E1A48', '#22204C']}
        style={[styles.headerGrad, { height: topPad + 72 }]}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={20} color="rgba(235,228,255,0.9)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setShowMeta(v => !v)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="more-horizontal" size={20} color="rgba(235,228,255,0.9)" />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* ── Title + Description card ─────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title</Text>
          <TextInput
            style={[styles.titleInput, { color: colors.foreground, borderColor: colors.border }]}
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
              value={description}
              onChangeText={setDesc}
              multiline
              textAlignVertical="top"
              returnKeyType="default"
            />
            <Image
              source={Images.character_default}
              style={styles.descIllustration}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* ── Mood / Location / Privacy (expandable) ───────────── */}
        {showMeta && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Mood */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Mood</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodRow}>
              {MOODS.map(m => (
                <TouchableOpacity
                  key={m.label}
                  style={[
                    styles.moodChip,
                    {
                      backgroundColor: mood === m.label ? `${m.color}28` : `${m.color}10`,
                      borderColor:     mood === m.label ? `${m.color}60` : `${m.color}20`,
                      borderWidth:     mood === m.label ? 1.5 : 1,
                    },
                  ]}
                  onPress={() => { setMood(m.label); Haptics.selectionAsync(); }}
                >
                  <Icon name={m.icon} size={13} color={m.color} />
                  <Text style={[styles.moodChipText, { color: m.color }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Location */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Location</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodRow}>
              {LOCATIONS.map(loc => (
                <TouchableOpacity
                  key={loc}
                  style={[
                    styles.moodChip,
                    {
                      backgroundColor: location === loc ? `${colors.primary}18` : `${colors.primary}08`,
                      borderColor:     location === loc ? `${colors.primary}50` : `${colors.primary}18`,
                      borderWidth:     location === loc ? 1.5 : 1,
                    },
                  ]}
                  onPress={() => setLocation(loc)}
                >
                  <Icon name="map-pin" size={12} color={location === loc ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.moodChipText, { color: location === loc ? colors.primary : colors.mutedForeground }]}>{loc}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Privacy */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Visibility</Text>
            <View style={styles.privRow}>
              {(['Public', 'Private'] as const).map(opt => {
                const active = opt === 'Public' ? isPublic : !isPublic;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.privBtn,
                      {
                        backgroundColor: active ? `${colors.primary}18` : colors.muted,
                        borderColor:     active ? `${colors.primary}50` : colors.border,
                        borderWidth:     active ? 1.5 : 1,
                      },
                    ]}
                    onPress={() => setIsPublic(opt === 'Public')}
                  >
                    <Icon name={opt === 'Public' ? 'globe' : 'lock'} size={13} color={active ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.moodChipText, { color: active ? colors.primary : colors.mutedForeground }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Panels card ──────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Panels header */}
          <View style={styles.panelsHeader}>
            <Text style={[styles.panelsTitle, { color: colors.foreground }]}>Panels</Text>
            <View style={[styles.panelsBadge, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
              <Text style={[styles.panelsBadgeText, { color: colors.primary }]}>
                {panels.length}/{MAX_PANELS} ◆
              </Text>
            </View>
          </View>

          {/* Panel rows */}
          {panels.map((panel, i) => {
            const imgSrc = getPanelImageSource(panel);
            const hasContent = !!(panel.imageUri || panel.bgPreset || panel.text.trim() || panel.bubbleText?.trim());
            return (
              <View key={panel.id}>
                {i > 0 && <View style={[styles.panelDivider, { backgroundColor: colors.border }]} />}
                <TouchableOpacity
                  style={styles.panelRow}
                  onPress={() => {
                    if (panelMenu === i) { setPanelMenu(null); return; }
                    openPanelEditor(i);
                  }}
                  activeOpacity={0.75}
                >
                  {/* Drag handle */}
                  <View style={styles.dragHandle}>
                    <Icon name="menu" size={18} color={colors.mutedForeground} />
                  </View>

                  {/* Thumbnail */}
                  <View style={[styles.thumb, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    {imgSrc ? (
                      <Image source={imgSrc} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <Icon name="image" size={16} color={`${colors.mutedForeground}60`} />
                    )}
                  </View>

                  {/* Info */}
                  <View style={styles.panelInfo}>
                    <Text style={[styles.panelName, { color: colors.foreground }]}>Panel {i + 1}</Text>
                    <Text
                      style={[styles.panelPreviewText, { color: hasContent ? colors.mutedForeground : `${colors.mutedForeground}60`, fontStyle: hasContent ? 'italic' : 'normal' }]}
                      numberOfLines={1}
                    >
                      {getPanelPreview(panel)}
                    </Text>
                  </View>

                  {/* Options */}
                  <TouchableOpacity
                    style={styles.panelMenuBtn}
                    onPress={() => setPanelMenu(panelMenu === i ? null : i)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="more-horizontal" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </TouchableOpacity>

                {/* Inline options menu */}
                {panelMenu === i && (
                  <View style={[styles.panelOptionsRow, { borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.panelOptionBtn}
                      onPress={() => { setPanelMenu(null); openPanelEditor(i); }}
                    >
                      <Icon name="edit-2" size={14} color={colors.primary} />
                      <Text style={[styles.panelOptionText, { color: colors.primary }]}>Edit</Text>
                    </TouchableOpacity>
                    {panels.length > 1 && (
                      <TouchableOpacity style={styles.panelOptionBtn} onPress={() => removePanel(i)}>
                        <Icon name="trash-2" size={14} color="#E05C5C" />
                        <Text style={[styles.panelOptionText, { color: '#E05C5C' }]}>Remove</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.panelOptionBtn} onPress={() => setPanelMenu(null)}>
                      <Icon name="x" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.panelOptionText, { color: colors.mutedForeground }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Add Panel button ─────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.addPanelBtn, { backgroundColor: '#1A1848', borderColor: `${colors.primary}30` }]}
          onPress={addPanel}
          activeOpacity={0.8}
          disabled={panels.length >= MAX_PANELS}
        >
          <View style={[styles.addPanelIcon, { backgroundColor: `${colors.primary}20` }]}>
            <Icon name="plus" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.addPanelText, { color: colors.foreground }]}>Add Panel</Text>
        </TouchableOpacity>

        {/* Error banner */}
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
            colors={['#7B6BA8', '#6B5B95', '#5A4A80']}
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
  root:            { flex: 1 },
  headerGrad:      { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 18,
    paddingBottom:   14,
  },
  headerBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(235,228,255,0.95)',
    letterSpacing: -0.2,
  },

  scroll:  { paddingHorizontal: 16, paddingTop: 8 },

  card: {
    borderRadius: 20,
    borderWidth:  1,
    padding:      18,
    marginBottom: 14,
  },

  fieldLabel: {
    fontSize:    11,
    fontFamily:  'Inter_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  titleInput: {
    fontSize:    18,
    fontFamily:  'Inter_500Medium',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical:   11,
  },

  descWrapper:       { position: 'relative', minHeight: 80 },
  descInput: {
    fontSize:    14,
    fontFamily:  'Inter_400Regular',
    lineHeight:  22,
    minHeight:   80,
    paddingRight: 72,
  },
  descIllustration: {
    position: 'absolute',
    bottom:   0,
    right:    0,
    width:    64,
    height:   64,
    opacity:  0.35,
  },

  moodRow: { marginBottom: 4 },
  moodChip: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    paddingHorizontal: 12,
    paddingVertical:    7,
    borderRadius:   20,
    marginRight:    7,
  },
  moodChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  privRow:  { flexDirection: 'row', gap: 10 },
  privBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    paddingVertical: 10,
    borderRadius:   12,
  },

  panelsHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   14,
  },
  panelsTitle:     { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  panelsBadge: {
    paddingHorizontal: 10,
    paddingVertical:    4,
    borderRadius:      20,
    borderWidth:        1,
  },
  panelsBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  panelDivider: { height: 1, marginHorizontal: -2, opacity: 0.5 },
  panelRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    paddingVertical: 11,
  },

  dragHandle: {
    width:  24,
    alignItems: 'center',
  },

  thumb: {
    width:        68,
    height:       52,
    borderRadius: 10,
    borderWidth:   1,
    overflow:     'hidden',
    alignItems:   'center',
    justifyContent: 'center',
  },

  panelInfo: { flex: 1, gap: 3 },
  panelName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  panelPreviewText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },

  panelMenuBtn:    { padding: 4 },
  panelOptionsRow: {
    flexDirection:  'row',
    gap:             8,
    paddingBottom:  10,
    paddingTop:      2,
    paddingHorizontal: 36,
    borderTopWidth: 0,
  },
  panelOptionBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             5,
    paddingHorizontal: 12,
    paddingVertical:    7,
    borderRadius:   16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  panelOptionText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  addPanelBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
    borderWidth:     1,
    borderRadius:   28,
    paddingVertical: 16,
    marginBottom:   14,
  },
  addPanelIcon: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
  },
  addPanelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  errorBanner: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             8,
    backgroundColor: 'rgba(224,92,92,0.12)',
    borderWidth:     1,
    borderColor:    'rgba(224,92,92,0.30)',
    borderRadius:   12,
    paddingHorizontal: 14,
    paddingVertical:   10,
    marginBottom:   12,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: '#E05C5C' },

  publishBtn:  { borderRadius: 30, overflow: 'hidden', marginBottom: 4 },
  publishGrad: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:             8,
    paddingVertical: 16,
  },
  publishText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
