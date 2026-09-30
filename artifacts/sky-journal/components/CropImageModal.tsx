import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image as RNImage,
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
import { SecureImage as Image } from '@/components/SecureImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { SkyLoadingMark } from '@/components/SkyLoading';

export interface CropImageModalProps {
  visible: boolean;
  uri: string;
  aspectRatio?: number;
  onDone: (croppedUri: string, aspectRatio: number, fit: 'cover' | 'contain') => void;
  onCancel: () => void;
}

type CropRect = { x: number; y: number; w: number; h: number };
type Corner = 'TL' | 'TR' | 'BL' | 'BR';
const CORNERS: Corner[] = ['TL', 'TR', 'BL', 'BR'];
const MIN_SIZE = 48;
const PRIMARY = '#9880D0';
const RATIO_OPTS = [
  { label: 'Free', value: null },
  { label: '3 : 4', value: 3 / 4 },
  { label: '1 : 1', value: 1 },
  { label: '4 : 3', value: 4 / 3 },
] as const;

function limit(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function centeredRect(w: number, h: number, ratio: number | null): CropRect {
  let cropW = w * 0.84;
  let cropH = h * 0.84;
  if (ratio) {
    cropW = Math.min(cropW, cropH * ratio);
    cropH = cropW / ratio;
  }
  return { x: (w - cropW) / 2, y: (h - cropH) / 2, w: cropW, h: cropH };
}

export default function CropImageModal({ visible, uri, aspectRatio, onDone, onCancel }: CropImageModalProps) {
  const insets = useSafeAreaInsets();
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState<number | null>(aspectRatio ?? null);
  const [selection, setSelection] = useState<CropRect | null>(null);
  const [applying, setApplying] = useState(false);
  const rectRef = useRef<CropRect | null>(null);
  const gestureStart = useRef<CropRect | null>(null);
  const gestureAction = useRef<Corner | 'move' | null>(null);

  const image = useMemo(() => {
    if (!naturalSize || !canvas.w || !canvas.h) return null;
    const scale = Math.min((canvas.w - 32) / naturalSize.w, (canvas.h - 32) / naturalSize.h);
    const w = naturalSize.w * scale;
    const h = naturalSize.h * scale;
    return { x: (canvas.w - w) / 2, y: (canvas.h - h) / 2, w, h };
  }, [naturalSize, canvas]);

  function updateRect(rect: CropRect) {
    rectRef.current = rect;
    setSelection(rect);
  }

  useEffect(() => {
    if (!visible || !uri) return;
    setNaturalSize(null);
    rectRef.current = null;
    setSelection(null);
    setRatio(aspectRatio ?? null);
    let active = true;
    RNImage.getSize(uri, (w, h) => {
      if (active) setNaturalSize({ w, h });
    }, () => {
      if (active) Alert.alert('Photo unavailable', 'Could not read this photo. Please choose another one.');
    });
    return () => { active = false; };
  }, [uri, visible, aspectRatio]);

  useEffect(() => {
    if (!image) return;
    updateRect(centeredRect(image.w, image.h, ratio));
    // Reset the selection only when the image/layout changes, not on a drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  function changeRatio(next: number | null) {
    setRatio(next);
    if (image) updateRect(centeredRect(image.w, image.h, next));
  }

  // One touch surface owns the entire gesture. Nested responders on the box
  // and corner handles compete on Android, so corner drags often become moves.
  const cropResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      const start = rectRef.current;
      gestureStart.current = start ? { ...start } : null;
      gestureAction.current = null;
      if (!start) return;

      // The touch surface covers the image exactly, so locationX/Y are image
      // coordinates; handles are decorative and cannot steal the responder.
      const { locationX: x, locationY: y } = event.nativeEvent;
      const handleRadius = 28;
      const corner = CORNERS.find(c => {
        const cx = c.endsWith('L') ? start.x : start.x + start.w;
        const cy = c.startsWith('T') ? start.y : start.y + start.h;
        return Math.abs(x - cx) <= handleRadius && Math.abs(y - cy) <= handleRadius;
      });
      if (corner) gestureAction.current = corner;
      else if (x >= start.x && x <= start.x + start.w && y >= start.y && y <= start.y + start.h) {
        gestureAction.current = 'move';
      }
    },
    onPanResponderMove: (_, gesture) => {
      const start = gestureStart.current;
      const action = gestureAction.current;
      if (!start || !action || !image) return;
      if (action === 'move') {
        updateRect({
          ...start,
          x: limit(start.x + gesture.dx, 0, image.w - start.w),
          y: limit(start.y + gesture.dy, 0, image.h - start.h),
        });
        return;
      }

      const fromLeft = action === 'TL' || action === 'BL';
      const fromTop = action === 'TL' || action === 'TR';
      const anchorX = fromLeft ? start.x + start.w : start.x;
      const anchorY = fromTop ? start.y + start.h : start.y;
      const maxW = fromLeft ? anchorX : image.w - anchorX;
      const maxH = fromTop ? anchorY : image.h - anchorY;
      const horizontal = start.w + (fromLeft ? -gesture.dx : gesture.dx);
      const vertical = start.h + (fromTop ? -gesture.dy : gesture.dy);
      let w: number;
      let h: number;
      if (ratio) {
        const deltaX = horizontal - start.w;
        const deltaY = (vertical - start.h) * ratio;
        const delta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
        w = limit(start.w + delta, Math.min(MIN_SIZE, maxW, maxH * ratio), Math.min(maxW, maxH * ratio));
        h = w / ratio;
      } else {
        w = limit(horizontal, Math.min(MIN_SIZE, maxW), maxW);
        h = limit(vertical, Math.min(MIN_SIZE, maxH), maxH);
      }
      updateRect({ x: fromLeft ? anchorX - w : anchorX, y: fromTop ? anchorY - h : anchorY, w, h });
    },
    onPanResponderRelease: () => { gestureAction.current = null; },
    onPanResponderTerminate: () => { gestureAction.current = null; },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [image, ratio]);

  async function applyCrop() {
    const rect = rectRef.current;
    if (!naturalSize || !image || !rect || applying) return;
    setApplying(true);
    try {
      const left = limit(Math.round(rect.x * naturalSize.w / image.w), 0, naturalSize.w - 1);
      const top = limit(Math.round(rect.y * naturalSize.h / image.h), 0, naturalSize.h - 1);
      const right = limit(Math.round((rect.x + rect.w) * naturalSize.w / image.w), left + 1, naturalSize.w);
      const bottom = limit(Math.round((rect.y + rect.h) * naturalSize.h / image.h), top + 1, naturalSize.h);
      const cropW = right - left;
      const cropH = bottom - top;
      const actions: ImageManipulator.Action[] = [
        { crop: { originX: left, originY: top, width: cropW, height: cropH } },
      ];
      if (cropW > 1600 || cropH > 1600) {
        actions.push(cropW >= cropH ? { resize: { width: 1600 } } : { resize: { height: 1600 } });
      }
      const result = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: 0.92,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      onDone(result.uri, cropW / cropH, 'contain');
    } catch {
      Alert.alert('Crop failed', 'The selected area could not be saved. Please try again or use the original.');
    } finally {
      setApplying(false);
    }
  }

  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 20 : insets.bottom;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.topBar, { paddingTop: topInset + 6 }]}>
          <TouchableOpacity style={styles.topBtn} onPress={onCancel} accessibilityLabel="Cancel crop">
            <Icon name="x" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={styles.topCenter}>
            <Text style={styles.topTitle}>Crop Photo</Text>
            <Text style={styles.topSub}>Drag the box to choose an area · drag corners to resize</Text>
          </View>
        </View>

        <View style={styles.ratioStrip}>
          {RATIO_OPTS.map(opt => (
            <TouchableOpacity
              key={opt.label}
              style={[styles.ratioBtn, ratio === opt.value && styles.ratioBtnActive]}
              onPress={() => changeRatio(opt.value)}
              accessibilityLabel={`${opt.label} crop`}
            >
              <Text style={[styles.ratioBtnText, ratio === opt.value && styles.ratioBtnTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.canvas} onLayout={e => {
          const { width: w, height: h } = e.nativeEvent.layout;
          setCanvas(previous => previous.w === w && previous.h === h ? previous : { w, h });
        }}>
          {image && selection ? (
            <View style={{ position: 'absolute', left: image.x, top: image.y, width: image.w, height: image.h }}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="fill" cachePolicy="memory" />
              <View pointerEvents="none" style={[styles.dim, { top: 0, left: 0, right: 0, height: selection.y }]} />
              <View pointerEvents="none" style={[styles.dim, { top: selection.y + selection.h, left: 0, right: 0, bottom: 0 }]} />
              <View pointerEvents="none" style={[styles.dim, { top: selection.y, left: 0, width: selection.x, height: selection.h }]} />
              <View pointerEvents="none" style={[styles.dim, { top: selection.y, left: selection.x + selection.w, right: 0, height: selection.h }]} />
              <View
                pointerEvents="none"
                style={[styles.selection, { left: selection.x, top: selection.y, width: selection.w, height: selection.h }]}
              >
                <View pointerEvents="none" style={[styles.gridLine, { left: '33.33%', top: 0, bottom: 0, width: 1 }]} />
                <View pointerEvents="none" style={[styles.gridLine, { left: '66.66%', top: 0, bottom: 0, width: 1 }]} />
                <View pointerEvents="none" style={[styles.gridLine, { top: '33.33%', left: 0, right: 0, height: 1 }]} />
                <View pointerEvents="none" style={[styles.gridLine, { top: '66.66%', left: 0, right: 0, height: 1 }]} />
                {CORNERS.map(corner => (
                  <View
                    key={corner}
                    style={[styles.handle, {
                      left: corner.endsWith('L') ? -16 : undefined,
                      right: corner.endsWith('R') ? -16 : undefined,
                      top: corner.startsWith('T') ? -16 : undefined,
                      bottom: corner.startsWith('B') ? -16 : undefined,
                    }]}
                  >
                    <View style={styles.handleDot} pointerEvents="none" />
                  </View>
                ))}
              </View>
              <View style={StyleSheet.absoluteFill} {...cropResponder.panHandlers} />
            </View>
          ) : (
            <View style={styles.loadingCenter}><SkyLoadingMark color="#fff" size={42} /></View>
          )}
        </View>

        <View style={[styles.bottomBar, { paddingBottom: bottomInset + 12 }]}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.originalBtn]}
            onPress={() => onDone(uri, naturalSize ? naturalSize.w / naturalSize.h : 1, 'contain')}
            disabled={applying || !naturalSize}
          >
            <Icon name="image" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.actionBtnText}>Use Original</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.cropBtn, applying && { opacity: 0.7 }]}
            onPress={applyCrop}
            disabled={applying || !selection}
          >
            {applying ? <SkyLoadingMark color="#fff" size={18} /> : <>
              <Icon name="check" size={14} color="#fff" />
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Use This Crop</Text>
            </>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08060F' },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingBottom: 10 },
  topBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)' },
  topCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  topTitle: { color: '#fff', fontSize: 17, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  topSub: { color: 'rgba(255,255,255,0.58)', fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 4, textAlign: 'center' },
  ratioStrip: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 12 },
  ratioBtn: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)', backgroundColor: 'rgba(255,255,255,0.06)' },
  ratioBtnActive: { backgroundColor: 'rgba(152,128,208,0.25)', borderColor: PRIMARY },
  ratioBtnText: { color: 'rgba(255,255,255,0.62)', fontSize: 12, fontFamily: 'Satoshi-Bold' },
  ratioBtnTextActive: { color: '#D9C9FF' },
  canvas: { flex: 1 },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.65)' },
  selection: { position: 'absolute', borderWidth: 2, borderColor: '#fff', backgroundColor: 'transparent' },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.35)' },
  handle: { position: 'absolute', width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  handleDot: { width: 16, height: 16, borderRadius: 4, borderWidth: 3, borderColor: '#fff', backgroundColor: PRIMARY },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  actionBtn: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 14, borderRadius: 14 },
  originalBtn: { backgroundColor: 'rgba(255,255,255,0.10)' },
  cropBtn: { backgroundColor: PRIMARY },
  actionBtnText: { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(255,255,255,0.8)', flexShrink: 1 },
});