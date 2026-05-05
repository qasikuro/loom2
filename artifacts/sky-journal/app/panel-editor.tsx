import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { DraftStore } from '@/utils/draftStore';
import type { BubbleStyle, PanelOverlay, StoryPanel } from '@/context/AppContext';
import { persistImageUri } from '@/utils/persistImage';

const { width: SW } = Dimensions.get('window');
const GAP      = 3;
const CANVAS_H = 390;

// ── Layout definitions ────────────────────────────────────────────────────────

interface Layout {
  key:   string;
  label: string;
  count: number;
  rows:  number[][];   // each row → array of column flex-weights
}

const LAYOUTS: Layout[] = [
  { key: '1',  label: 'Full',  count: 1, rows: [[1]] },
  { key: '2v', label: 'Stack', count: 2, rows: [[1], [1]] },
  { key: '2h', label: 'Side',  count: 2, rows: [[1, 1]] },
  { key: '3a', label: '1+2',   count: 3, rows: [[1], [1, 1]] },
  { key: '3b', label: '2+1',   count: 3, rows: [[1, 1], [1]] },
  { key: '4',  label: '2×2',   count: 4, rows: [[1, 1], [1, 1]] },
  { key: '5a', label: '1+4',   count: 5, rows: [[1], [1, 1], [1, 1]] },
  { key: '5b', label: '3+2',   count: 5, rows: [[1, 1, 1], [1, 1]] },
];

function defaultLayoutKey(count: number): string {
  if (count >= 5) return '5a';
  if (count === 4) return '4';
  if (count === 3) return '3a';
  if (count === 2) return '2v';
  return '1';
}

function getPanelW(layout: Layout, pIdx: number, canvasW: number): number {
  let flat = 0;
  for (const cols of layout.rows) {
    const totalFlex = cols.reduce((a, b) => a + b, 0);
    for (const flex of cols) {
      if (flat === pIdx) return (canvasW - (cols.length - 1) * GAP) * (flex / totalFlex);
      flat++;
    }
  }
  return canvasW;
}

function getPanelH(layout: Layout, canvasH: number): number {
  return (canvasH - (layout.rows.length - 1) * GAP) / layout.rows.length;
}

// ── Mini layout icon ──────────────────────────────────────────────────────────

function LayoutIcon({ layout, size = 38 }: { layout: Layout; size?: number }) {
  const numRows = layout.rows.length;
  const rowH    = (size - (numRows - 1) * 2) / numRows;
  return (
    <View style={{ width: size, height: size, gap: 2 }}>
      {layout.rows.map((cols, ri) => {
        const totalFlex = cols.reduce((a, b) => a + b, 0);
        return (
          <View key={ri} style={{ flexDirection: 'row', height: rowH, gap: 2 }}>
            {cols.map((flex, ci) => (
              <View
                key={ci}
                style={{ flex: flex / totalFlex, borderRadius: 2, backgroundColor: 'rgba(200,184,232,0.35)' }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FONTS = [
  { key: 'Inter_400Regular',  label: 'Regular'  },
  { key: 'Inter_500Medium',   label: 'Medium'   },
  { key: 'Inter_600SemiBold', label: 'SemiBold' },
  { key: 'Inter_700Bold',     label: 'Bold'     },
] as const;

const BUBBLE_STYLES: { key: BubbleStyle; label: string; radius: number; hasTail: boolean }[] = [
  { key: 'rounded', label: 'Rounded', radius: 12, hasTail: true  },
  { key: 'sharp',   label: 'Sharp',   radius: 2,  hasTail: true  },
  { key: 'oval',    label: 'Oval',    radius: 50, hasTail: false },
];

const STICKERS = ['✨','🌟','💫','🌙','☁️','🕊️','🌸','🍃','⭐','🌊','🦋','🌈','🔮','🌺','❄️','🌿'];

function getBgSource(panel?: StoryPanel) {
  if (!panel) return null;
  if (panel.imageUri) return { uri: panel.imageUri };
  return null;
}

// ── DraggableOverlay ──────────────────────────────────────────────────────────

interface DraggableOverlayProps {
  overlay:    PanelOverlay;
  panelW:     number;
  panelH:     number;
  isSelected: boolean;
  onSelect:   (id: string) => void;
  onMove:     (id: string, xPct: number, yPct: number) => void;
  onDelete:   (id: string) => void;
}

function DraggableOverlay({ overlay, panelW, panelH, isSelected, onSelect, onMove, onDelete }: DraggableOverlayProps) {
  const initX  = overlay.xPct * panelW;
  const initY  = overlay.yPct * panelH;
  const posRef = useRef({ x: initX, y: initY });
  const anim   = useRef(new Animated.ValueXY({ x: initX, y: initY })).current;

  // Keep a always-current ref so the PanResponder (created once) never
  // captures stale callbacks or dimensions — the key fix for text-reset on drag.
  const liveRef = useRef({ onMove, onSelect, onDelete, panelW, panelH, id: overlay.id });
  liveRef.current = { onMove, onSelect, onDelete, panelW, panelH, id: overlay.id };

  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => {
      anim.setOffset({ x: posRef.current.x, y: posRef.current.y });
      anim.setValue({ x: 0, y: 0 });
      liveRef.current.onSelect(liveRef.current.id);
    },
    onPanResponderMove: Animated.event([null, { dx: anim.x, dy: anim.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gs) => {
      const { panelW: pW, panelH: pH, id, onMove: mv } = liveRef.current;
      anim.flattenOffset();
      const nx = Math.max(0, Math.min(pW * 0.85, posRef.current.x + gs.dx));
      const ny = Math.max(0, Math.min(pH * 0.88, posRef.current.y + gs.dy));
      posRef.current = { x: nx, y: ny };
      anim.setValue({ x: nx, y: ny });
      mv(id, nx / pW, ny / pH);
    },
  })).current;

  const bStyle   = BUBBLE_STYLES.find(b => b.key === (overlay.bubbleStyle ?? 'rounded')) ?? BUBBLE_STYLES[0];
  const fontFam  = (overlay.fontFamily ?? 'Inter_500Medium') as any;
  const fontSize = overlay.fontSize ?? (overlay.type === 'sticker' ? 30 : 13);

  return (
    <Animated.View
      style={[styles.overlayWrap, { transform: [{ translateX: anim.x }, { translateY: anim.y }] }]}
      {...pr.panHandlers}
    >
      {overlay.type === 'bubble' && (
        <View style={[styles.bubbleBox, { borderRadius: bStyle.radius }, isSelected && styles.bubbleBoxSelected]}>
          <Text style={[styles.bubbleBoxText, { fontFamily: fontFam, fontSize }]}>{overlay.content || '...'}</Text>
          {bStyle.hasTail && <View style={styles.bubbleTailDown} />}
        </View>
      )}
      {overlay.type === 'text' && (
        <View style={isSelected ? styles.textBoxSelected : undefined}>
          <Text style={[styles.overlayText, { fontFamily: fontFam, fontSize, color: overlay.color ?? '#ffffff' }]}>
            {overlay.content || 'Text'}
          </Text>
        </View>
      )}
      {overlay.type === 'sticker' && (
        <View style={isSelected ? styles.stickerSelected : undefined}>
          <Text style={{ fontSize }}>{overlay.content}</Text>
        </View>
      )}
      {isSelected && (
        <TouchableOpacity
          style={styles.deleteBadge}
          onPress={() => onDelete(overlay.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="x" size={9} color="#fff" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ── StaticOverlay (non-active panels, read-only) ──────────────────────────────

function StaticOverlay({ overlay, panelW, panelH }: { overlay: PanelOverlay; panelW: number; panelH: number }) {
  const left    = overlay.xPct * panelW;
  const top     = overlay.yPct * panelH;
  const bStyle  = BUBBLE_STYLES.find(b => b.key === (overlay.bubbleStyle ?? 'rounded')) ?? BUBBLE_STYLES[0];
  const fontFam = (overlay.fontFamily ?? 'Inter_500Medium') as any;
  const scale   = 0.58;
  const fontSize = Math.max(8, (overlay.fontSize ?? 13) * scale);

  return (
    <View style={{ position: 'absolute', left, top, zIndex: 10 }}>
      {overlay.type === 'bubble' && (
        <View style={[styles.bubbleBox, {
          borderRadius: bStyle.radius * scale,
          paddingHorizontal: 6, paddingVertical: 4, maxWidth: 90,
        }]}>
          <Text style={[styles.bubbleBoxText, { fontFamily: fontFam, fontSize }]} numberOfLines={2}>
            {overlay.content}
          </Text>
          {bStyle.hasTail && (
            <View style={[styles.bubbleTailDown, {
              borderTopWidth: 5, borderLeftWidth: 5, borderRightWidth: 5, bottom: -5,
            }]} />
          )}
        </View>
      )}
      {overlay.type === 'text' && (
        <Text style={[styles.overlayText, { fontFamily: fontFam, fontSize, color: overlay.color ?? '#ffffff' }]} numberOfLines={1}>
          {overlay.content}
        </Text>
      )}
      {overlay.type === 'sticker' && (
        <Text style={{ fontSize: Math.max(12, fontSize) }}>{overlay.content}</Text>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PanelEditorScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === 'web' ? 48 : insets.top;
  const botPad  = Platform.OS === 'web' ? 20 : insets.bottom + 8;

  const draft = DraftStore.get();
  const initPanels = draft?.panels ?? [];

  const [panels,    setPanels]    = useState<StoryPanel[]>(initPanels);
  const [layoutKey, setLayoutKey] = useState<string>(() => defaultLayoutKey(initPanels.length));
  const [activeIdx, setActiveIdx] = useState(draft?.activePanelIndex ?? 0);
  const [selId,     setSelId]     = useState<string | null>(null);
  const [toolMode,  setToolMode]  = useState<'bubble' | 'text' | 'sticker' | null>(null);
  const [canvasW,   setCanvasW]   = useState(SW - 36);

  const currentLayout = LAYOUTS.find(l => l.key === layoutKey) ?? LAYOUTS[0];

  if (!draft) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.mutedForeground }}>No panel to edit.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function updatePanel(idx: number, updates: Partial<StoryPanel>) {
    setPanels(prev => {
      const next = prev.map((p, i) => i === idx ? { ...p, ...updates } : p);
      DraftStore.updatePanel(idx, updates);
      return next;
    });
  }

  const activePanel = panels[activeIdx];

  function getSelOverlay(): PanelOverlay | null {
    return activePanel?.overlays?.find(o => o.id === selId) ?? null;
  }

  async function pickPanelImage(idx: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.88,
    });
    if (!res.canceled && res.assets[0]) {
      const uri = await persistImageUri(res.assets[0].uri);
      updatePanel(idx, { imageUri: uri, bgPreset: undefined });
    }
  }

  function changeLayout(key: string) {
    Haptics.selectionAsync();
    const newLayout = LAYOUTS.find(l => l.key === key) ?? LAYOUTS[0];
    setLayoutKey(key);
    setPanels(prev => {
      let next = [...prev];
      while (next.length < newLayout.count) {
        next.push({ id: crypto.randomUUID(), text: '', imageUri: undefined, bgPreset: undefined, bubbleText: '', overlays: [] });
      }
      if (next.length > newLayout.count) next = next.slice(0, newLayout.count);
      const d = DraftStore.get()!;
      DraftStore.set({ panels: next, activePanelIndex: 0, onSave: d.onSave });
      return next;
    });
    setActiveIdx(0);
    setSelId(null);
    setToolMode(null);
  }

  function addOverlay(type: PanelOverlay['type'], content = '') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id: string = crypto.randomUUID();
    const ov: PanelOverlay = {
      id, type, content,
      xPct: 0.08, yPct: 0.08,
      fontFamily:  'Inter_500Medium',
      fontSize:     type === 'sticker' ? 30 : 13,
      bubbleStyle: 'rounded',
      color:       '#ffffff',
    };
    updatePanel(activeIdx, { overlays: [...(activePanel?.overlays ?? []), ov] });
    setSelId(id);
    setToolMode(null);
  }

  function updateOverlay(id: string, updates: Partial<PanelOverlay>) {
    if (!activePanel?.overlays) return;
    updatePanel(activeIdx, {
      overlays: activePanel.overlays.map(o => o.id === id ? { ...o, ...updates } : o),
    });
  }

  function deleteOverlay(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!activePanel?.overlays) return;
    updatePanel(activeIdx, { overlays: activePanel.overlays.filter(o => o.id !== id) });
    setSelId(null);
  }

  function moveOverlay(id: string, xPct: number, yPct: number) {
    if (!activePanel?.overlays) return;
    updatePanel(activeIdx, {
      overlays: activePanel.overlays.map(o => o.id === id ? { ...o, xPct, yPct } : o),
    });
  }

  function switchActive(idx: number) {
    setActiveIdx(idx);
    setSelId(null);
    setToolMode(null);
    DraftStore.setActiveIndex(idx);
  }

  function handleSave() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    DraftStore.save();
    router.back();
  }

  const selOverlay = getSelOverlay();
  const rowH       = getPanelH(currentLayout, CANVAS_H);

  // Precompute row start indices
  const rowStarts: number[] = [];
  let counter = 0;
  for (const cols of currentLayout.rows) {
    rowStarts.push(counter);
    counter += cols.length;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <LinearGradient colors={['#1A1640', '#1E1A48']} style={[styles.headerGrad, { height: topPad + 58 }]} />
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Manga panel canvas ────────────────────────────── */}
        <View style={[styles.mangaWrapper, { backgroundColor: '#0B091A', borderColor: 'rgba(200,184,232,0.07)' }]}>
          <View
            style={[styles.mangaCanvas, { height: CANVAS_H }]}
            onLayout={e => setCanvasW(e.nativeEvent.layout.width)}
          >
            {currentLayout.rows.map((cols, ri) => {
              const rowStart  = rowStarts[ri];
              const totalFlex = cols.reduce((a, b) => a + b, 0);
              return (
                <View key={ri} style={[styles.panelRow, { height: rowH }]}>
                  {cols.map((flex, ci) => {
                    const pIdx    = rowStart + ci;
                    const panel   = panels[pIdx];
                    const isActive = pIdx === activeIdx;
                    const bg      = getBgSource(panel);
                    const pW      = getPanelW(currentLayout, pIdx, canvasW);

                    return (
                      <TouchableWithoutFeedback
                        key={ci}
                        onPress={() => {
                          if (isActive && selId) { setSelId(null); return; }
                          switchActive(pIdx);
                          if (!bg) pickPanelImage(pIdx);
                        }}
                      >
                        <View style={[
                          styles.panelCell,
                          { flex: flex / totalFlex },
                          isActive
                            ? { borderColor: 'rgba(139,122,181,0.80)', borderWidth: 2 }
                            : { borderColor: 'rgba(200,184,232,0.07)', borderWidth: 1 },
                        ]}>
                          {/* Background image */}
                          {bg
                            ? <Image source={bg} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            : (
                              <View style={styles.emptyHint}>
                                <Icon name="image" size={isActive ? 26 : 16} color="rgba(180,165,220,0.25)" />
                                {isActive && <Text style={styles.emptyHintText}>Tap to add photo</Text>}
                              </View>
                            )
                          }

                          {/* Dim */}
                          {bg && <View style={styles.dimOverlay} />}

                          {/* Camera change — active only */}
                          {isActive && bg && (
                            <TouchableOpacity style={styles.changeBtn} onPress={() => pickPanelImage(pIdx)}>
                              <Icon name="camera" size={12} color="rgba(235,228,255,0.9)" />
                            </TouchableOpacity>
                          )}

                          {/* Draggable overlays (active panel) */}
                          {isActive && panel?.overlays?.map(ov => (
                            <DraggableOverlay
                              key={ov.id}
                              overlay={ov}
                              panelW={pW}
                              panelH={rowH}
                              isSelected={selId === ov.id}
                              onSelect={setSelId}
                              onMove={moveOverlay}
                              onDelete={deleteOverlay}
                            />
                          ))}

                          {/* Static overlays (inactive panels) */}
                          {!isActive && panel?.overlays?.map(ov => (
                            <StaticOverlay key={ov.id} overlay={ov} panelW={pW} panelH={rowH} />
                          ))}
                        </View>
                      </TouchableWithoutFeedback>
                    );
                  })}
                </View>
              );
            })}
          </View>

          {/* Panel indicator */}
          {currentLayout.count > 1 && (
            <View style={styles.panelIndicator}>
              {panels.slice(0, currentLayout.count).map((_, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.dot, {
                    backgroundColor: i === activeIdx ? 'rgba(139,122,181,0.9)' : 'rgba(200,184,232,0.22)',
                    width:  i === activeIdx ? 18 : 7,
                    height: 7,
                  }]}
                  onPress={() => switchActive(i)}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Toolbar ───────────────────────────────────────── */}
        <View style={[styles.toolbar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {([
            { mode: 'bubble'  as const, icon: 'message-circle' as const, label: 'Speech Bubble' },
            { mode: 'text'    as const, icon: 'type'           as const, label: 'Text' },
            { mode: 'sticker' as const, icon: 'star'           as const, label: 'Sticker' },
          ]).map(({ mode, icon, label }) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.toolBtn,
                { borderColor: 'transparent' },
                toolMode === mode && {
                  backgroundColor: `${colors.primary}20`,
                  borderColor: `${colors.primary}40`,
                  borderWidth: 1,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setToolMode(prev => prev === mode ? null : mode);
                if (mode !== 'sticker') setSelId(null);
              }}
            >
              <Icon name={icon} size={18} color={toolMode === mode ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toolLabel, { color: toolMode === mode ? colors.primary : colors.mutedForeground }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Add overlay CTA ───────────────────────────────── */}
        {(toolMode === 'bubble' || toolMode === 'text') && !selId && (
          <TouchableOpacity
            style={[styles.addCTA, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}
            onPress={() => addOverlay(toolMode)}
          >
            <Icon name="plus-circle" size={16} color={colors.primary} />
            <Text style={[styles.addCTAText, { color: colors.primary }]}>
              {toolMode === 'bubble' ? 'Add Speech Bubble to Panel' : 'Add Text to Panel'}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Sticker picker ────────────────────────────────── */}
        {toolMode === 'sticker' && (
          <View style={[styles.stickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>STICKERS</Text>
            <View style={styles.stickerGrid}>
              {STICKERS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.stickerBtn, { backgroundColor: `${colors.primary}10`, borderColor: colors.border }]}
                  onPress={() => addOverlay('sticker', e)}
                >
                  <Text style={styles.stickerEmoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Selected overlay editor ───────────────────────── */}
        {selOverlay && (
          <View style={[styles.overlayEditor, { backgroundColor: colors.card, borderColor: `${colors.primary}28` }]}>
            {/* Header row */}
            <View style={styles.editorHeaderRow}>
              <Icon
                name={selOverlay.type === 'bubble' ? 'message-circle' : selOverlay.type === 'text' ? 'type' : 'star'}
                size={14} color={colors.primary}
              />
              <Text style={[styles.editorHeaderTitle, { color: colors.primary }]}>
                {selOverlay.type === 'bubble' ? 'Speech Bubble' : selOverlay.type === 'text' ? 'Text Overlay' : 'Sticker'}
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>  · drag to move</Text>
              </Text>
              <TouchableOpacity onPress={() => deleteOverlay(selOverlay.id)} style={styles.editorDeleteBtn}>
                <Icon name="trash-2" size={14} color="#E05C5C" />
              </TouchableOpacity>
            </View>

            {/* ── Font quick-bar (always-visible for bubble/text) ── */}
            {(selOverlay.type === 'bubble' || selOverlay.type === 'text') && (
              <View style={[styles.fontBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                {FONTS.map(f => {
                  const active = selOverlay.fontFamily === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.fontBarBtn, active && { backgroundColor: `${colors.primary}22`, borderColor: `${colors.primary}60` }]}
                      onPress={() => { Haptics.selectionAsync(); updateOverlay(selOverlay.id, { fontFamily: f.key }); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.fontBarSample, { fontFamily: f.key as any, color: active ? colors.primary : colors.foreground }]}>
                        Aa
                      </Text>
                      <Text style={[styles.fontBarLabel, { color: active ? colors.primary : colors.mutedForeground }]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Size pills inline */}
                <View style={[styles.fontBarDivider, { backgroundColor: colors.border }]} />
                {[10, 13, 16, 20, 24].map(sz => {
                  const active = selOverlay.fontSize === sz;
                  return (
                    <TouchableOpacity
                      key={sz}
                      style={[styles.sizePill, { borderColor: active ? colors.primary : 'transparent', backgroundColor: active ? `${colors.primary}22` : 'transparent' }]}
                      onPress={() => updateOverlay(selOverlay.id, { fontSize: sz })}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: active ? colors.primary : colors.mutedForeground }}>
                        {sz === 10 ? 'XS' : sz === 13 ? 'S' : sz === 16 ? 'M' : sz === 20 ? 'L' : 'XL'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Text input */}
            {(selOverlay.type === 'bubble' || selOverlay.type === 'text') && (
              <TextInput
                style={[styles.editorInput, { color: colors.foreground, borderColor: colors.border, fontFamily: (selOverlay.fontFamily ?? 'Inter_500Medium') as any }]}
                value={selOverlay.content}
                onChangeText={t => updateOverlay(selOverlay.id, { content: t })}
                placeholder={selOverlay.type === 'bubble' ? 'The wind guides us…' : 'Enter text…'}
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
                autoFocus
              />
            )}

            {selOverlay.type === 'bubble' && (
              <>
                <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>BUBBLE STYLE</Text>
                <View style={styles.chipRow}>
                  {BUBBLE_STYLES.map(bs => {
                    const active = selOverlay.bubbleStyle === bs.key;
                    return (
                      <TouchableOpacity
                        key={bs.key}
                        style={[styles.styleChip, {
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? `${colors.primary}18` : colors.muted,
                        }]}
                        onPress={() => { Haptics.selectionAsync(); updateOverlay(selOverlay.id, { bubbleStyle: bs.key }); }}
                      >
                        <View style={[styles.stylePreview, { borderRadius: bs.radius }]} />
                        <Text style={[styles.styleChipLabel, { color: active ? colors.primary : colors.mutedForeground }]}>{bs.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {selOverlay.type === 'sticker' && (
              <>
                <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>SIZE</Text>
                <View style={styles.chipRow}>
                  {[24, 32, 44, 56].map(sz => {
                    const active = selOverlay.fontSize === sz;
                    return (
                      <TouchableOpacity
                        key={sz}
                        style={[styles.chip, styles.chipSq, {
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? `${colors.primary}18` : colors.muted,
                        }]}
                        onPress={() => updateOverlay(selOverlay.id, { fontSize: sz })}
                      >
                        <Text style={{ fontSize: active ? 18 : 14, color: active ? colors.primary : colors.foreground }}>
                          {sz === 24 ? 'S' : sz === 32 ? 'M' : sz === 44 ? 'L' : 'XL'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Frame / Layout selector ───────────────────────── */}
        <View style={[styles.frameCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.frameTitleRow}>
            <Icon name="layout" size={13} color={colors.primary} />
            <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>FRAME LAYOUT</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.frameScroll}>
            <View style={styles.frameRow}>
              {LAYOUTS.map(layout => {
                const isActive = layoutKey === layout.key;
                return (
                  <TouchableOpacity
                    key={layout.key}
                    style={[styles.frameOption, {
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? `${colors.primary}16` : colors.muted,
                    }]}
                    onPress={() => changeLayout(layout.key)}
                    activeOpacity={0.75}
                  >
                    <LayoutIcon layout={layout} size={38} />
                    <Text style={[styles.frameLabel, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                      {layout.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:       { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 12,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: 'rgba(235,228,255,0.95)' },
  saveBtn: {
    paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20,
    backgroundColor: 'rgba(139,122,181,0.25)',
    borderWidth: 1, borderColor: 'rgba(139,122,181,0.50)',
  },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: 'rgba(220,210,255,0.95)' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 8, gap: 12 },

  mangaWrapper: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden', padding: 4,
  },
  mangaCanvas: {
    borderRadius: 10, overflow: 'hidden',
    gap: GAP, flexDirection: 'column',
  },
  panelRow: { flexDirection: 'row', gap: GAP },
  panelCell: {
    overflow: 'hidden', borderRadius: 6,
    position: 'relative', backgroundColor: '#151228',
  },

  panelIndicator: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 5, paddingVertical: 8,
  },
  dot: { borderRadius: 4 },

  emptyHint:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  emptyHintText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(180,165,220,0.35)' },
  dimOverlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,6,22,0.22)' },
  changeBtn: {
    position: 'absolute', top: 7, right: 7,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', zIndex: 5,
  },

  overlayWrap: { position: 'absolute', zIndex: 20 },
  bubbleBox: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    paddingHorizontal: 10, paddingVertical: 7, maxWidth: 160,
  },
  bubbleBoxSelected: { borderWidth: 1.5, borderColor: 'rgba(139,122,181,0.7)' },
  bubbleBoxText:     { color: '#1A1530', lineHeight: 16 },
  bubbleTailDown: {
    position: 'absolute', bottom: -7, left: 12,
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 7,
    borderStyle: 'solid',
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.93)',
  },
  overlayText: {
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  textBoxSelected:  { borderWidth: 1, borderColor: 'rgba(139,122,181,0.7)', borderRadius: 6, padding: 2 },
  stickerSelected:  { borderWidth: 1.5, borderColor: 'rgba(139,122,181,0.7)', borderRadius: 8, padding: 2 },
  deleteBadge: {
    position: 'absolute', top: -10, right: -10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#E05C5C',
    alignItems: 'center', justifyContent: 'center', zIndex: 30,
  },

  toolbar: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 4, gap: 4 },
  toolBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11, borderRadius: 12, borderWidth: 1,
  },
  toolLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  addCTA: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1,
  },
  addCTAText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  stickerCard:  { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  stickerGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stickerBtn:   { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stickerEmoji: { fontSize: 24 },

  overlayEditor:     { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  editorHeaderRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editorHeaderTitle: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  editorDeleteBtn:   { padding: 4 },
  editorInput: {
    fontSize: 14, lineHeight: 20,
    minHeight: 58, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
  },

  fontBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 4, gap: 2,
  },
  fontBarBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4,
    borderRadius: 9, borderWidth: 1, borderColor: 'transparent', gap: 2,
  },
  fontBarSample: { fontSize: 16 },
  fontBarLabel:  { fontSize: 8, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  fontBarDivider:{ width: 1, height: 32, marginHorizontal: 4 },
  sizePill: {
    paddingHorizontal: 7, paddingVertical: 5,
    borderRadius: 7, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  pickerLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, textTransform: 'uppercase' },
  chipRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  chipSq: { paddingHorizontal: 10, minWidth: 44 },
  styleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  stylePreview: {
    width: 22, height: 14,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  styleChipLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  frameCard:     { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  frameTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  frameScroll:   { marginHorizontal: -4 },
  frameRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  frameOption: {
    alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 14, borderWidth: 1.5, minWidth: 62,
  },
  frameLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3, textTransform: 'uppercase' },
});
