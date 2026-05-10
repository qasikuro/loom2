/**
 * CropImageModal
 * Full-screen image crop UI — shows the photo with a draggable crop box.
 * Four corner handles let the user define the crop region.
 * "Crop & Use" applies the crop; "Use Full Photo" skips it.
 * Uses expo-image-manipulator for the pixel-level crop.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImgLayout {
  containerW: number;
  containerH: number;
  displayW:   number;
  displayH:   number;
  offsetX:    number;
  offsetY:    number;
  scale:      number;
}

export interface CropImageModalProps {
  visible:  boolean;
  uri:      string;
  onDone:   (croppedUri: string) => void;
  onCancel: () => void;
}

const HANDLE   = 30;
const MIN_SIDE = 60;
const PRIMARY  = '#6B5B95';
const OVERLAY  = 'rgba(0,0,0,0.54)';
const GRID_CLR = 'rgba(255,255,255,0.28)';

// ─── Component ────────────────────────────────────────────────────────────────

export default function CropImageModal({ visible, uri, onDone, onCancel }: CropImageModalProps) {
  const insets = useSafeAreaInsets();

  const [imgSize, setImgSize]         = useState<{ w: number; h: number } | null>(null);
  const [containerSz, setContainerSz] = useState<{ w: number; h: number } | null>(null);
  const [cropBox, setCropBox]         = useState<CropBox | null>(null);
  const [applying, setApplying]       = useState(false);

  // Computed layout: where the image is actually rendered (contain / letterbox)
  const layout = useMemo<ImgLayout | null>(() => {
    if (!imgSize || !containerSz) return null;
    const scale    = Math.min(containerSz.w / imgSize.w, containerSz.h / imgSize.h);
    const displayW = imgSize.w * scale;
    const displayH = imgSize.h * scale;
    const offsetX  = (containerSz.w - displayW) / 2;
    const offsetY  = (containerSz.h - displayH) / 2;
    return { containerW: containerSz.w, containerH: containerSz.h, displayW, displayH, offsetX, offsetY, scale };
  }, [imgSize, containerSz]);

  // Set initial crop box once layout is ready
  useEffect(() => {
    if (!layout || cropBox) return;
    setCropBox({ x: layout.offsetX, y: layout.offsetY, w: layout.displayW, h: layout.displayH });
  }, [layout]);

  // Reload image size when URI changes
  useEffect(() => {
    if (!uri) return;
    setImgSize(null);
    setCropBox(null);
    Image.getSize(uri, (w, h) => setImgSize({ w, h }), () => null);
  }, [uri]);

  // ── Crop actions ─────────────────────────────────────────────────────────

  function applyFull() { onDone(uri); }

  async function applyCrop() {
    if (!layout || !cropBox) { onDone(uri); return; }
    setApplying(true);
    try {
      const cx = Math.max(cropBox.x, layout.offsetX);
      const cy = Math.max(cropBox.y, layout.offsetY);
      const cw = Math.min(cropBox.w, layout.offsetX + layout.displayW - cx);
      const ch = Math.min(cropBox.h, layout.offsetY + layout.displayH - cy);

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{
          crop: {
            originX: Math.round((cx - layout.offsetX) / layout.scale),
            originY: Math.round((cy - layout.offsetY) / layout.scale),
            width:   Math.round(cw / layout.scale),
            height:  Math.round(ch / layout.scale),
          },
        }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      onDone(result.uri);
    } catch {
      onDone(uri);
    } finally {
      setApplying(false);
    }
  }

  // ── Gesture: 4 corner refs (one per corner, stable across renders) ────────
  // We keep a separate startBox ref per corner so concurrent drags stay isolated.

  const tlStart = useRef<CropBox | null>(null);
  const trStart = useRef<CropBox | null>(null);
  const blStart = useRef<CropBox | null>(null);
  const brStart = useRef<CropBox | null>(null);

  function clampBox(x: number, y: number, w: number, h: number, l: ImgLayout): CropBox {
    w = Math.max(w, MIN_SIDE);
    h = Math.max(h, MIN_SIDE);
    const maxX = l.offsetX + l.displayW;
    const maxY = l.offsetY + l.displayH;
    x = Math.max(l.offsetX, Math.min(x, maxX - w));
    y = Math.max(l.offsetY, Math.min(y, maxY - h));
    w = Math.min(w, maxX - x);
    h = Math.min(h, maxY - y);
    return { x, y, w, h };
  }

  const cropBoxRef = useRef(cropBox);
  useEffect(() => { cropBoxRef.current = cropBox; }, [cropBox]);
  const layoutRef  = useRef(layout);
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  const tlResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { tlStart.current = cropBoxRef.current; },
    onPanResponderMove: (_, gs) => {
      const b = tlStart.current; const l = layoutRef.current;
      if (!b || !l) return;
      setCropBox(clampBox(b.x + gs.dx, b.y + gs.dy, b.w - gs.dx, b.h - gs.dy, l));
    },
  }), []);

  const trResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { trStart.current = cropBoxRef.current; },
    onPanResponderMove: (_, gs) => {
      const b = trStart.current; const l = layoutRef.current;
      if (!b || !l) return;
      setCropBox(clampBox(b.x, b.y + gs.dy, b.w + gs.dx, b.h - gs.dy, l));
    },
  }), []);

  const blResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { blStart.current = cropBoxRef.current; },
    onPanResponderMove: (_, gs) => {
      const b = blStart.current; const l = layoutRef.current;
      if (!b || !l) return;
      setCropBox(clampBox(b.x + gs.dx, b.y, b.w - gs.dx, b.h + gs.dy, l));
    },
  }), []);

  const brResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { brStart.current = cropBoxRef.current; },
    onPanResponderMove: (_, gs) => {
      const b = brStart.current; const l = layoutRef.current;
      if (!b || !l) return;
      setCropBox(clampBox(b.x, b.y, b.w + gs.dx, b.h + gs.dy, l));
    },
  }), []);

  // ── Gesture: move entire box ──────────────────────────────────────────────

  const moveStart = useRef<CropBox | null>(null);
  const moveResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { moveStart.current = cropBoxRef.current; },
    onPanResponderMove: (_, gs) => {
      const b = moveStart.current; const l = layoutRef.current;
      if (!b || !l) return;
      let nx = b.x + gs.dx;
      let ny = b.y + gs.dy;
      nx = Math.max(l.offsetX, Math.min(nx, l.offsetX + l.displayW - b.w));
      ny = Math.max(l.offsetY, Math.min(ny, l.offsetY + l.displayH - b.h));
      setCropBox({ x: nx, y: ny, w: b.w, h: b.h });
    },
  }), []);

  // ── Render ────────────────────────────────────────────────────────────────

  const topInset    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 20 : insets.bottom;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: '#0E0C18' }]}>
        <StatusBar barStyle="light-content" />

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
          <TouchableOpacity style={styles.topBtn} onPress={onCancel}>
            <Icon name="x" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Choose a crop</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Image + crop overlay */}
        <View
          style={styles.imageContainer}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            setContainerSz({ w: width, h: height });
          }}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
            />
          ) : null}

          {cropBox && (
            <>
              {/* Dark overlay — 4 strips around the crop box */}
              <View style={[styles.overlay, { top: 0, left: 0, right: 0, height: cropBox.y }]} />
              <View style={[styles.overlay, { top: cropBox.y + cropBox.h, left: 0, right: 0, bottom: 0 }]} />
              <View style={[styles.overlay, { top: cropBox.y, left: 0, width: cropBox.x, height: cropBox.h }]} />
              <View style={[styles.overlay, { top: cropBox.y, left: cropBox.x + cropBox.w, right: 0, height: cropBox.h }]} />

              {/* Crop interior — drag to move */}
              <View
                style={[styles.cropBox, { left: cropBox.x, top: cropBox.y, width: cropBox.w, height: cropBox.h }]}
                {...moveResponder.panHandlers}
              >
                <View style={[styles.gridLine, { top: 0, bottom: 0, width: 1, left: '33.33%' }]} />
                <View style={[styles.gridLine, { top: 0, bottom: 0, width: 1, left: '66.66%' }]} />
                <View style={[styles.gridLine, { left: 0, right: 0, height: 1, top: '33.33%' }]} />
                <View style={[styles.gridLine, { left: 0, right: 0, height: 1, top: '66.66%' }]} />
                <View style={styles.cropBorder} />
              </View>

              {/* Corner handles */}
              <CornerHandle corner="TL" box={cropBox} responder={tlResponder} />
              <CornerHandle corner="TR" box={cropBox} responder={trResponder} />
              <CornerHandle corner="BL" box={cropBox} responder={blResponder} />
              <CornerHandle corner="BR" box={cropBox} responder={brResponder} />
            </>
          )}

          {(!imgSize || !layout) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          )}
        </View>

        {/* Bottom actions */}
        <View style={[styles.bottomBar, { paddingBottom: bottomInset + 12 }]}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.10)' }]}
            onPress={applyFull}
            disabled={applying}
          >
            <Icon name="maximize-2" size={15} color="rgba(255,255,255,0.7)" />
            <Text style={[styles.actionBtnText, { color: 'rgba(255,255,255,0.7)' }]}>Use Full Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: PRIMARY, opacity: applying ? 0.7 : 1 }]}
            onPress={applyCrop}
            disabled={applying || !cropBox}
          >
            {applying
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Icon name="crop" size={15} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>Crop & Use</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Corner handle ────────────────────────────────────────────────────────────

function CornerHandle({
  corner, box, responder,
}: {
  corner: 'TL' | 'TR' | 'BL' | 'BR';
  box: CropBox;
  responder: ReturnType<typeof PanResponder.create>;
}) {
  const isRight  = corner === 'TR' || corner === 'BR';
  const isBottom = corner === 'BL' || corner === 'BR';
  const left = isRight  ? box.x + box.w - HANDLE / 2 : box.x - HANDLE / 2;
  const top  = isBottom ? box.y + box.h - HANDLE / 2 : box.y - HANDLE / 2;
  const BRACKET = 16;
  const THICK   = 3;

  return (
    <View style={[styles.cornerHandle, { left, top }]} {...responder.panHandlers}>
      {/* Horizontal arm */}
      <View style={{
        position: 'absolute',
        width: BRACKET, height: THICK, borderRadius: 2,
        backgroundColor: '#fff',
        top:  isBottom ? HANDLE / 2 + BRACKET - THICK : HANDLE / 2 - THICK,
        left: isRight  ? HANDLE / 2 - BRACKET         : HANDLE / 2,
      }} />
      {/* Vertical arm */}
      <View style={{
        position: 'absolute',
        width: THICK, height: BRACKET, borderRadius: 2,
        backgroundColor: '#fff',
        top:  isBottom ? HANDLE / 2 - BRACKET : HANDLE / 2,
        left: isRight  ? HANDLE / 2 - THICK   : HANDLE / 2,
      }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:           { flex: 1 },
  topBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  topBtn:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.10)' },
  topTitle:       { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.2 },
  imageContainer: { flex: 1, overflow: 'hidden' },
  overlay:        { position: 'absolute', backgroundColor: OVERLAY },
  cropBox:        { position: 'absolute' },
  cropBorder:     { ...StyleSheet.absoluteFillObject, borderWidth: 1.5, borderColor: '#fff' },
  gridLine:       { position: 'absolute', backgroundColor: GRID_CLR },
  cornerHandle:   { position: 'absolute', width: HANDLE, height: HANDLE },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomBar:      { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, backgroundColor: '#0E0C18' },
  actionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 },
  actionBtnText:  { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
