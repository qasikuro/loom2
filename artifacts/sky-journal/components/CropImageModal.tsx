/**
 * CropImageModal — Instagram-style zoom + reframe editor
 *
 * • Fixed 3:4 crop frame (matches the panel aspect ratio)
 * • Pinch to zoom in/out on native; +/− buttons on web
 * • Drag to pan the image inside the frame
 * • Image always covers the frame — no empty/black areas
 * • "Use This Crop" → pixel-perfect crop via expo-image-manipulator
 * • "Use Original"  → skip crop, pass URI as-is
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  Modal,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';

export interface CropImageModalProps {
  visible:  boolean;
  uri:      string;
  onDone:   (croppedUri: string) => void;
  onCancel: () => void;
}

const PANEL_RATIO = 3 / 4;   // width / height — matches MangaPanelEditor imageArea
const PRIMARY     = '#6B5B95';
const CORNER_LEN  = 22;
const CORNER_W    = 3;

function touchDist(touches: any[]): number {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CropImageModal({
  visible, uri, onDone, onCancel,
}: CropImageModalProps) {
  const insets                       = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [canvasH, setCanvasH]         = useState(0);
  const [applying, setApplying]       = useState(false);

  // Mutable refs for transform (gesture handlers read/write these directly)
  const scaleRef = useRef(1);
  const txRef    = useRef(0);  // image-centre offset from frame-centre, px
  const tyRef    = useRef(0);

  // Bump this to force a re-render after gesture mutations
  const [tick, setTick] = useState(0);
  const bump = () => setTick(t => t + 1);

  // ── Frame geometry ────────────────────────────────────────────────────────

  const frameW = screenW - 32;               // 16 px padding each side
  const frameH = frameW / PANEL_RATIO;

  // Vertical centre of the frame within the canvas
  const frameTop = Math.max(16, (canvasH - frameH) / 2);

  // ── Scale helpers ─────────────────────────────────────────────────────────

  // baseScale makes the image fill the frame (cover, not contain)
  const baseScale = useMemo(() => {
    if (!naturalSize) return 1;
    return Math.max(frameW / naturalSize.w, frameH / naturalSize.h);
  }, [naturalSize, frameW, frameH]);

  // Derived display size at current zoom
  const displayW = (naturalSize?.w ?? frameW) * baseScale * scaleRef.current;
  const displayH = (naturalSize?.h ?? frameH) * baseScale * scaleRef.current;

  // Clamp translate so image always fully covers the frame
  function clamp(tx: number, ty: number, scale: number) {
    if (!naturalSize) return { tx: 0, ty: 0 };
    const dw   = naturalSize.w * baseScale * scale;
    const dh   = naturalSize.h * baseScale * scale;
    const maxX = Math.max(0, (dw - frameW) / 2);
    const maxY = Math.max(0, (dh - frameH) / 2);
    return {
      tx: Math.max(-maxX, Math.min(maxX, tx)),
      ty: Math.max(-maxY, Math.min(maxY, ty)),
    };
  }

  // ── Reset when URI changes ────────────────────────────────────────────────

  useEffect(() => {
    if (!uri) return;
    setNaturalSize(null);
    scaleRef.current = 1;
    txRef.current    = 0;
    tyRef.current    = 0;
    RNImage.getSize(uri, (w, h) => setNaturalSize({ w, h }), () => null);
  }, [uri]);

  // Re-clamp when layout changes (e.g. orientation)
  useEffect(() => {
    if (!naturalSize) return;
    const c = clamp(txRef.current, tyRef.current, scaleRef.current);
    txRef.current = c.tx;
    tyRef.current = c.ty;
    bump();
  }, [naturalSize, baseScale]);

  // ── Gesture: pinch-to-zoom + pan ──────────────────────────────────────────

  const prevDist   = useRef(0);
  const panStart   = useRef({ tx: 0, ty: 0 });
  const isPinching = useRef(false);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder:  () => true,
    onMoveShouldSetPanResponder:   () => true,

    onPanResponderGrant: (e) => {
      panStart.current   = { tx: txRef.current, ty: tyRef.current };
      isPinching.current = e.nativeEvent.touches.length >= 2;
      prevDist.current   = 0;
    },

    onPanResponderMove: (e, gs) => {
      const touches = e.nativeEvent.touches as any[];

      if (touches.length >= 2) {
        // ── Pinch zoom ──
        isPinching.current = true;
        const d = touchDist(touches);
        if (prevDist.current > 0) {
          const newScale = Math.max(1, Math.min(8, scaleRef.current * (d / prevDist.current)));
          scaleRef.current = newScale;
          const c = clamp(txRef.current, tyRef.current, newScale);
          txRef.current = c.tx;
          tyRef.current = c.ty;
          bump();
        }
        prevDist.current = d;
      } else if (!isPinching.current) {
        // ── Pan ──
        const c = clamp(panStart.current.tx + gs.dx, panStart.current.ty + gs.dy, scaleRef.current);
        txRef.current = c.tx;
        tyRef.current = c.ty;
        bump();
      }
    },

    onPanResponderRelease: () => {
      prevDist.current   = 0;
      isPinching.current = false;
    },
  }), [baseScale, naturalSize, frameW, frameH]);

  // ── Zoom buttons (web + accessibility) ───────────────────────────────────

  function zoomBy(delta: number) {
    const newScale   = Math.max(1, Math.min(8, scaleRef.current + delta));
    scaleRef.current = newScale;
    const c          = clamp(txRef.current, tyRef.current, newScale);
    txRef.current    = c.tx;
    tyRef.current    = c.ty;
    bump();
  }

  // ── Apply crop ────────────────────────────────────────────────────────────

  async function applyCrop() {
    if (!naturalSize) { onDone(uri); return; }
    setApplying(true);
    try {
      const totalScale = baseScale * scaleRef.current;

      // Top-left corner of the frame in original-image pixel space
      const originX = Math.max(0, Math.round((displayW / 2 - frameW / 2 - txRef.current) / totalScale));
      const originY = Math.max(0, Math.round((displayH / 2 - frameH / 2 - tyRef.current) / totalScale));
      const cropW   = Math.max(1, Math.min(naturalSize.w - originX, Math.round(frameW / totalScale)));
      const cropH   = Math.max(1, Math.min(naturalSize.h - originY, Math.round(frameH / totalScale)));

      const MAX_DIM = 1600;
      const actions: ImageManipulator.Action[] = [
        { crop: { originX, originY, width: cropW, height: cropH } },
      ];
      if (cropW > MAX_DIM || cropH > MAX_DIM) {
        actions.push(
          cropW >= cropH
            ? { resize: { width: MAX_DIM } }
            : { resize: { height: MAX_DIM } },
        );
      }
      const result = await ImageManipulator.manipulateAsync(
        uri,
        actions,
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      onDone(result.uri);
    } catch {
      onDone(uri);
    } finally {
      setApplying(false);
    }
  }

  // ── Layout constants ──────────────────────────────────────────────────────

  const topInset    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 20 : insets.bottom;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: '#08060F' }]}>
        <StatusBar barStyle="light-content" />

        {/* ── Top bar ── */}
        <View style={[styles.topBar, { paddingTop: topInset + 6 }]}>
          <TouchableOpacity style={styles.topBtn} onPress={onCancel}>
            <Icon name="x" size={18} color="#fff" />
          </TouchableOpacity>

          <View style={styles.topCenter}>
            <Text style={styles.topTitle}>Reframe Photo</Text>
            <Text style={styles.topSub}>
              {Platform.OS === 'web'
                ? 'Use +/− to zoom · drag to reframe'
                : 'Pinch to zoom · drag to choose what to show'}
            </Text>
          </View>

          <View style={styles.zoomBtns}>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => zoomBy(0.3)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="plus" size={15} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => zoomBy(-0.3)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="minus" size={15} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Canvas (gesture area + frame) ── */}
        <View
          style={styles.canvas}
          onLayout={e => setCanvasH(e.nativeEvent.layout.height)}
          {...panResponder.panHandlers}
        >
          {/* Dark strips outside the frame */}
          <View style={[styles.dim, { top: 0, left: 0, right: 0, height: frameTop }]} />
          <View style={[styles.dim, { top: frameTop + frameH, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.dim, { top: frameTop, left: 0, width: 16, height: frameH }]} />
          <View style={[styles.dim, { top: frameTop, right: 0, width: 16, height: frameH }]} />

          {/* Crop frame — clips the image */}
          <View style={[styles.frame, { left: 16, top: frameTop, width: frameW, height: frameH }]}>
            {naturalSize ? (
              <View style={{
                position: 'absolute',
                width:    displayW,
                height:   displayH,
                left:     frameW / 2 - displayW / 2 + txRef.current,
                top:      frameH / 2 - displayH / 2 + tyRef.current,
              }}>
                <Image
                  source={{ uri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="fill"
                  cachePolicy="memory"
                />
              </View>
            ) : (
              <View style={styles.loadingCenter}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            )}

            {/* Grid lines (rule of thirds) */}
            <View style={[styles.gridLine, { top: 0, bottom: 0, width: 1, left: '33.33%' }]} />
            <View style={[styles.gridLine, { top: 0, bottom: 0, width: 1, left: '66.66%' }]} />
            <View style={[styles.gridLine, { left: 0, right: 0, height: 1, top: '33.33%' }]} />
            <View style={[styles.gridLine, { left: 0, right: 0, height: 1, top: '66.66%' }]} />

            {/* Frame border */}
            <View style={styles.frameBorder} />

            {/* Corner tick marks */}
            <CornerMark pos="TL" />
            <CornerMark pos="TR" />
            <CornerMark pos="BL" />
            <CornerMark pos="BR" />
          </View>
        </View>

        {/* ── Bottom bar ── */}
        <View style={[styles.bottomBar, { paddingBottom: bottomInset + 12 }]}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.10)' }]}
            onPress={() => onDone(uri)}
            disabled={applying}
          >
            <Icon name="image" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={[styles.actionBtnText, { color: 'rgba(255,255,255,0.7)' }]}>Use Original</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: PRIMARY, opacity: applying ? 0.7 : 1 }]}
            onPress={applyCrop}
            disabled={applying || !naturalSize}
          >
            {applying
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Icon name="check" size={14} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>Use This Crop</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Corner tick marks ──────────────────────────────────────────────────────────

function CornerMark({ pos }: { pos: 'TL' | 'TR' | 'BL' | 'BR' }) {
  const isR = pos === 'TR' || pos === 'BR';
  const isB = pos === 'BL' || pos === 'BR';
  return (
    <View style={{
      position: 'absolute',
      [isR ? 'right' : 'left']: 0,
      [isB ? 'bottom' : 'top']: 0,
      width: CORNER_LEN,
      height: CORNER_LEN,
    }}>
      {/* Horizontal arm */}
      <View style={{
        position: 'absolute',
        [isB ? 'bottom' : 'top']: 0,
        [isR ? 'right' : 'left']: 0,
        width: CORNER_LEN,
        height: CORNER_W,
        borderRadius: CORNER_W / 2,
        backgroundColor: '#fff',
      }} />
      {/* Vertical arm */}
      <View style={{
        position: 'absolute',
        [isB ? 'bottom' : 'top']: 0,
        [isR ? 'right' : 'left']: 0,
        width: CORNER_W,
        height: CORNER_LEN,
        borderRadius: CORNER_W / 2,
        backgroundColor: '#fff',
      }} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:         { flex: 1 },

  topBar:       {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12,
  },
  topBtn:       {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 2,
  },
  topCenter:    { flex: 1, alignItems: 'center', paddingTop: 4 },
  topTitle:     { color: '#fff', fontSize: 15, fontFamily: 'Satoshi-Bold' },
  topSub:       { color: 'rgba(255,255,255,0.42)', fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 2, textAlign: 'center' },
  zoomBtns:     { flexDirection: 'row', gap: 6, marginTop: 2 },
  zoomBtn:      {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  canvas:       { flex: 1 },
  dim:          { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.65)' },

  frame:        { position: 'absolute', overflow: 'hidden', backgroundColor: '#000' },
  frameBorder:  { ...StyleSheet.absoluteFillObject, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' },
  gridLine:     { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.18)' },
  loadingCenter:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  bottomBar:    {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingTop: 14,
    backgroundColor: '#08060F',
  },
  actionBtn:    {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 7,
    paddingVertical: 14, borderRadius: 14,
  },
  actionBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
});
