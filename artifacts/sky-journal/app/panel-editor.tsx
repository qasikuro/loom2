import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images/index';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { DraftStore } from '@/utils/draftStore';
import type { StoryPanel } from '@/context/AppContext';
import { persistImageUri } from '@/utils/persistImage';

const { width: SW } = Dimensions.get('window');
const GUTTER = 4;

type ToolMode = 'bubble' | 'text' | 'sticker' | null;

const BG_PRESETS: { key: string; src: any }[] = [
  { key: 'bg1',  src: Images.story_bg1 },
  { key: 'bg2',  src: Images.story_bg2 },
  { key: 'bg3',  src: Images.story_bg3 },
  { key: 'char', src: Images.character_default },
];

const STICKERS = ['✨', '🌟', '💫', '🌙', '☁️', '🕊️', '🌸', '🍃'];

function SpeechBubble({ text, size = 'large' }: { text: string; size?: 'large' | 'small' }) {
  if (!text?.trim()) return null;
  const isLarge = size === 'large';
  return (
    <View style={[styles.bubble, isLarge ? styles.bubbleLarge : styles.bubbleSmall]}>
      <Text
        style={[styles.bubbleText, isLarge ? styles.bubbleTextLarge : styles.bubbleTextSmall]}
        numberOfLines={isLarge ? 4 : 2}
      >
        {text}
      </Text>
      <View style={styles.bubbleTail} />
    </View>
  );
}

function PanelCell({
  panel,
  active,
  size,
  stickerOverlay,
  onPress,
}: {
  panel: StoryPanel | undefined;
  active: boolean;
  size: 'large' | 'small';
  stickerOverlay?: string;
  onPress: () => void;
}) {
  const colors  = useColors();
  const imgSrc  = panel?.imageUri
    ? { uri: panel.imageUri }
    : panel?.bgPreset
      ? BG_PRESETS.find(b => b.key === panel.bgPreset)?.src ?? null
      : null;

  return (
    <TouchableOpacity
      style={[
        styles.panelCell,
        size === 'large' ? styles.panelCellLarge : styles.panelCellSmall,
        { backgroundColor: colors.muted },
        active && styles.panelCellActive,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Background image */}
      {imgSrc && <Image source={imgSrc} style={StyleSheet.absoluteFill} resizeMode="cover" />}
      {!imgSrc && (
        <View style={styles.panelEmpty}>
          <Icon name="image" size={size === 'large' ? 28 : 18} color="rgba(180,165,220,0.35)" />
          {size === 'large' && (
            <Text style={styles.panelEmptyText}>Tap a background below</Text>
          )}
        </View>
      )}

      {/* Dark overlay so text is readable */}
      {imgSrc && <View style={styles.panelOverlay} />}

      {/* Speech bubble */}
      {panel && <SpeechBubble text={panel.bubbleText ?? ''} size={size} />}

      {/* Sticker overlay */}
      {stickerOverlay && (
        <View style={styles.stickerOverlay}>
          <Text style={[styles.stickerText, size === 'small' && styles.stickerTextSmall]}>
            {stickerOverlay}
          </Text>
        </View>
      )}

      {/* Narration caption at bottom */}
      {panel?.text?.trim() && !panel.bubbleText?.trim() && (
        <View style={styles.captionBar}>
          <Text style={styles.captionText} numberOfLines={1}>{panel.text}</Text>
        </View>
      )}

      {/* Active indicator */}
      {active && <View style={styles.activeRing} pointerEvents="none" />}
    </TouchableOpacity>
  );
}

export default function PanelEditorScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === 'web' ? 48 : insets.top;
  const botPad  = Platform.OS === 'web' ? 20 : insets.bottom + 8;

  const draft   = DraftStore.get();
  const [panels,    setPanels]    = useState<StoryPanel[]>(draft?.panels ?? []);
  const [activeIdx, setActiveIdx] = useState(draft?.activePanelIndex ?? 0);
  const [toolMode,  setToolMode]  = useState<ToolMode>(null);
  const [stickers,  setStickers]  = useState<Record<number, string>>({});
  const bubbleRef = useRef<TextInput>(null);
  const textRef   = useRef<TextInput>(null);

  if (!draft || panels.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.mutedForeground }}>No panel to edit.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const panel0 = panels[activeIdx];
  const panel1 = panels[activeIdx + 1];
  const panel2 = panels[activeIdx + 2];

  function updatePanel(idx: number, updates: Partial<StoryPanel>) {
    setPanels(prev => prev.map((p, i) => i === idx ? { ...p, ...updates } : p));
    DraftStore.updatePanel(idx, updates);
  }

  function handleToolPress(mode: ToolMode) {
    Haptics.selectionAsync();
    if (toolMode === mode) {
      setToolMode(null);
      return;
    }
    setToolMode(mode);
    if (mode === 'bubble') setTimeout(() => bubbleRef.current?.focus(), 150);
    if (mode === 'text')   setTimeout(() => textRef.current?.focus(), 150);
  }

  async function pickCustomBg() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) {
      const uri = await persistImageUri(res.assets[0].uri);
      updatePanel(activeIdx, { imageUri: uri, bgPreset: undefined });
    }
  }

  function selectPreset(key: string) {
    Haptics.selectionAsync();
    updatePanel(activeIdx, { bgPreset: key, imageUri: undefined });
  }

  function selectSticker(emoji: string) {
    Haptics.selectionAsync();
    setStickers(prev => ({ ...prev, [activeIdx]: emoji }));
    setToolMode(null);
  }

  function switchActive(idx: number) {
    if (idx < 0 || idx >= panels.length) return;
    Haptics.selectionAsync();
    setActiveIdx(idx);
    setToolMode(null);
    DraftStore.setActiveIndex(idx);
  }

  function handleSave() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    DraftStore.save();
    router.back();
  }

  // Layout heights
  const AVAILABLE_H = Dimensions.get('window').height - topPad - 52 - 52 - 120 - botPad;
  const LARGE_H     = Math.min(AVAILABLE_H * 0.58, 260);
  const SMALL_H     = Math.min(AVAILABLE_H * 0.35, 155);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1A1640', '#1E1A48']}
        style={[styles.headerGrad, { height: topPad + 58 }]}
      />
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => { DraftStore.discard(); router.back(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="arrow-left" size={20} color="rgba(235,228,255,0.9)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Panel</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 12 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Manga layout ─────────────────────────────────── */}
        <View style={[styles.mangaWrapper, { backgroundColor: '#0C0A1A', borderColor: 'rgba(200,184,232,0.08)' }]}>
          {/* Large main panel */}
          <PanelCell
            panel={panel0}
            active={true}
            size="large"
            stickerOverlay={stickers[activeIdx]}
            onPress={() => {}}
          />

          {/* Two smaller panels */}
          <View style={styles.subRow}>
            <PanelCell
              panel={panel1}
              active={false}
              size="small"
              stickerOverlay={stickers[activeIdx + 1]}
              onPress={() => switchActive(activeIdx + 1)}
            />
            <View style={{ width: GUTTER }} />
            <PanelCell
              panel={panel2}
              active={false}
              size="small"
              stickerOverlay={stickers[activeIdx + 2]}
              onPress={() => switchActive(activeIdx + 2)}
            />
          </View>

          {/* Panel navigation dots */}
          {panels.length > 1 && (
            <View style={styles.dotsRow}>
              {panels.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.dot, i === activeIdx && styles.dotActive, { backgroundColor: i === activeIdx ? colors.primary : 'rgba(200,184,232,0.25)' }]}
                  onPress={() => switchActive(i)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Toolbar ─────────────────────────────────────── */}
        <View style={[styles.toolbar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { mode: 'bubble' as ToolMode, icon: 'message-circle' as const, label: 'Speech Bubble' },
            { mode: 'text'   as ToolMode, icon: 'type'           as const, label: 'Text' },
            { mode: 'sticker'as ToolMode, icon: 'star'           as const, label: 'Sticker' },
          ].map(({ mode, icon, label }) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.toolBtn,
                toolMode === mode && { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` },
                { borderColor: colors.border },
              ]}
              onPress={() => handleToolPress(mode)}
            >
              <Icon name={icon} size={18} color={toolMode === mode ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toolLabel, { color: toolMode === mode ? colors.primary : colors.mutedForeground }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Speech Bubble input ──────────────────────────── */}
        {toolMode === 'bubble' && (
          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: `${colors.primary}35` }]}>
            <View style={styles.inputHeader}>
              <Icon name="message-circle" size={14} color={colors.primary} />
              <Text style={[styles.inputCardLabel, { color: colors.primary }]}>Speech Bubble</Text>
            </View>
            <TextInput
              ref={bubbleRef}
              style={[styles.bubbleInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="The wind guides us where we need to go."
              placeholderTextColor={colors.mutedForeground}
              value={panel0?.bubbleText ?? ''}
              onChangeText={t => updatePanel(activeIdx, { bubbleText: t })}
              multiline
              textAlignVertical="top"
              autoFocus
            />
          </View>
        )}

        {/* ── Narration text input ─────────────────────────── */}
        {toolMode === 'text' && (
          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: `${colors.primary}35` }]}>
            <View style={styles.inputHeader}>
              <Icon name="type" size={14} color={colors.primary} />
              <Text style={[styles.inputCardLabel, { color: colors.primary }]}>Narration</Text>
            </View>
            <TextInput
              ref={textRef}
              style={[styles.bubbleInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="Write the narration for this panel…"
              placeholderTextColor={colors.mutedForeground}
              value={panel0?.text ?? ''}
              onChangeText={t => updatePanel(activeIdx, { text: t })}
              multiline
              textAlignVertical="top"
              autoFocus
            />
          </View>
        )}

        {/* ── Sticker picker ───────────────────────────────── */}
        {toolMode === 'sticker' && (
          <View style={[styles.stickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.stickerCardLabel, { color: colors.mutedForeground }]}>Choose a sticker</Text>
            <View style={styles.stickerGrid}>
              {STICKERS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.stickerBtn,
                    { backgroundColor: `${colors.primary}12`, borderColor: colors.border },
                    stickers[activeIdx] === emoji && { borderColor: colors.primary, backgroundColor: `${colors.primary}22` },
                  ]}
                  onPress={() => selectSticker(emoji)}
                >
                  <Text style={styles.stickerEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              {stickers[activeIdx] && (
                <TouchableOpacity
                  style={[styles.stickerBtn, { backgroundColor: 'rgba(224,92,92,0.12)', borderColor: 'rgba(224,92,92,0.30)' }]}
                  onPress={() => { setStickers(p => { const n = { ...p }; delete n[activeIdx]; return n; }); setToolMode(null); }}
                >
                  <Icon name="x" size={18} color="#E05C5C" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Background picker ────────────────────────────── */}
        <View style={[styles.bgCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.bgCardLabel, { color: colors.mutedForeground }]}>Background</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bgScroll}>
            {BG_PRESETS.map(({ key, src }) => {
              const isActive = panel0?.bgPreset === key && !panel0?.imageUri;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.bgThumb, isActive && { borderColor: colors.primary, borderWidth: 2.5 }]}
                  onPress={() => selectPreset(key)}
                  activeOpacity={0.8}
                >
                  <Image source={src} style={styles.bgThumbImg} resizeMode="cover" />
                </TouchableOpacity>
              );
            })}
            {/* Custom / camera roll button */}
            <TouchableOpacity
              style={[styles.bgThumb, styles.bgCustomBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
              onPress={pickCustomBg}
            >
              <Icon name="camera" size={22} color={colors.mutedForeground} />
              <Text style={[styles.bgCustomText, { color: colors.mutedForeground }]}>Custom</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  headerGrad:  { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 18,
    paddingBottom:   12,
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
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical:    9,
    borderRadius:      20,
    backgroundColor:  'rgba(139,122,181,0.25)',
    borderWidth:       1,
    borderColor:      'rgba(139,122,181,0.50)',
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(220,210,255,0.95)',
  },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 8, gap: 12 },

  // ── Manga layout
  mangaWrapper: {
    borderRadius:   16,
    borderWidth:     1,
    overflow:       'hidden',
    padding:        GUTTER,
    gap:            GUTTER,
  },

  panelCell: {
    overflow:     'hidden',
    borderRadius:  6,
    position:     'relative',
  },
  panelCellLarge: {
    width:  '100%',
    height: 230,
  },
  panelCellSmall: {
    flex:   1,
    height: 140,
  },
  panelCellActive: {
    // The large top panel is always the active one
  },

  panelEmpty: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:             8,
  },
  panelEmptyText: {
    fontSize:   11,
    fontFamily: 'Inter_400Regular',
    color:      'rgba(180,165,220,0.35)',
  },

  panelOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,8,30,0.25)',
  },

  subRow: {
    flexDirection: 'row',
    width:         '100%',
  },

  // Speech bubble
  bubble: {
    position:        'absolute',
    top:             10,
    left:            10,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius:    10,
    paddingHorizontal: 10,
    paddingVertical:   7,
    maxWidth:        '75%',
    zIndex:          10,
  },
  bubbleLarge: {
    top:   12,
    left:  12,
    maxWidth: '70%',
  },
  bubbleSmall: {
    top:    7,
    left:   7,
    paddingHorizontal: 7,
    paddingVertical:   5,
    borderRadius: 8,
    maxWidth: '85%',
  },
  bubbleText:      { fontFamily: 'Inter_500Medium', color: '#1A1530', lineHeight: 16 },
  bubbleTextLarge: { fontSize: 13, lineHeight: 18 },
  bubbleTextSmall: { fontSize: 10, lineHeight: 14 },
  bubbleTail: {
    position:    'absolute',
    bottom:      -7,
    left:        14,
    width:        0,
    height:       0,
    borderLeftWidth:  7,
    borderRightWidth: 7,
    borderTopWidth:   7,
    borderStyle: 'solid',
    borderLeftColor:  'transparent',
    borderRightColor: 'transparent',
    borderTopColor:   'rgba(255,255,255,0.93)',
  },

  // Sticker
  stickerOverlay: {
    position:   'absolute',
    bottom:     10,
    right:      10,
    zIndex:     12,
  },
  stickerText:      { fontSize: 30 },
  stickerTextSmall: { fontSize: 20 },

  // Caption
  captionBar: {
    position:        'absolute',
    bottom:           0,
    left:             0,
    right:            0,
    backgroundColor: 'rgba(10,8,30,0.72)',
    paddingHorizontal: 10,
    paddingVertical:    6,
  },
  captionText: {
    fontSize:   11,
    fontFamily: 'Inter_400Regular',
    color:      'rgba(230,220,255,0.90)',
    fontStyle:  'italic',
  },

  // Active ring
  activeRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth:  2.5,
    borderColor:  'rgba(139,122,181,0.70)',
    borderRadius:  6,
  },

  // Navigation dots
  dotsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:             6,
    paddingVertical: 8,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  dotActive: {
    width:  10,
    height: 10,
  },

  // ── Toolbar
  toolbar: {
    flexDirection:  'row',
    borderWidth:     1,
    borderRadius:   16,
    padding:         4,
    gap:             4,
  },
  toolBtn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:             5,
    paddingVertical: 11,
    borderRadius:   12,
    borderWidth:     1,
    borderColor:    'transparent',
  },
  toolLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  // ── Input cards
  inputCard: {
    borderWidth:  1,
    borderRadius: 16,
    padding:      14,
    gap:          10,
  },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  inputCardLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
  bubbleInput: {
    fontSize:    14,
    fontFamily:  'Inter_400Regular',
    lineHeight:  22,
    minHeight:   72,
    borderWidth:  1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical:   10,
  },

  // ── Sticker card
  stickerCard: {
    borderWidth:  1,
    borderRadius: 16,
    padding:      14,
    gap:          10,
  },
  stickerCardLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase' },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stickerBtn: {
    width:          48,
    height:         48,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:     1,
  },
  stickerEmoji: { fontSize: 24 },

  // ── Background picker
  bgCard: {
    borderWidth:  1,
    borderRadius: 16,
    padding:      14,
    gap:           10,
  },
  bgCardLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase' },
  bgScroll:    { marginHorizontal: -4 },
  bgThumb: {
    width:        72,
    height:       72,
    borderRadius: 12,
    overflow:     'hidden',
    marginHorizontal: 4,
    borderWidth:   2,
    borderColor:  'transparent',
  },
  bgThumbImg:  { width: '100%', height: '100%' },
  bgCustomBtn: {
    alignItems:     'center',
    justifyContent: 'center',
    gap:             4,
  },
  bgCustomText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
});
