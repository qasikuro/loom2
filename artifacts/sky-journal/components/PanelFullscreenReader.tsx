import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images/index';
import type { PanelOverlay } from '@/context/AppContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BG_PRESET_MAP: Record<string, any> = {
  bg1:  Images.story_bg1,
  bg2:  Images.story_bg2,
  bg3:  Images.story_bg3,
  char: Images.character_default,
};

export interface ReaderPanel {
  imageUri?:         string;
  bgPreset?:         string;
  text:              string;
  bubbleText?:       string;
  overlays?:         PanelOverlay[];
  imageAspectRatio?: number;
}

interface Props {
  panels:       ReaderPanel[];
  initialIndex: number;
  gradient:     [string, string, string];
  onClose:      () => void;
}

const SWIPE_DIST_RATIO = 0.22;
const SWIPE_VEL        = 0.48;
const MAX_ZOOM         = 4.0;
const ZOOM_IN_SCALE    = 2.5;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function PanelFullscreenReader({ panels, initialIndex, gradient, onClose }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [index,     setIndex]     = useState(initialIndex);
  const [isZoomed,  setIsZoomed]  = useState(false);
  const [captionOn, setCaptionOn] = useState(true);

  // ── stable refs (avoid stale closure in responder) ──────────────────
  const indexRef    = useRef(initialIndex);
  const isZoomedRef = useRef(false);
  const panelsRef   = useRef(panels);
  const screenWRef  = useRef(screenW);
  const screenHRef  = useRef(screenH);

  useEffect(() => { screenWRef.current = screenW; }, [screenW]);
  useEffect(() => { screenHRef.current = screenH; }, [screenH]);
  useEffect(() => { panelsRef.current  = panels;  }, [panels]);

  // ── zoom / pan state refs ────────────────────────────────────────────
  const scaleRef   = useRef(1);
  const txRef      = useRef(0);
  const tyRef      = useRef(0);
  const txBaseRef  = useRef(0);
  const tyBaseRef  = useRef(0);

  // ── pinch gesture state ──────────────────────────────────────────────
  const pinchStartScaleRef = useRef(1);
  const pinchStartTXRef    = useRef(0);
  const pinchStartTYRef    = useRef(0);
  const pinchMidXRef       = useRef(0);
  const pinchMidYRef       = useRef(0);
  const pinchStartDistRef  = useRef<number | null>(null);
  const touchCountRef      = useRef(0);

  // ── double-tap detection ─────────────────────────────────────────────
  const lastTapRef    = useRef(0);
  const lastTapXRef   = useRef(0);
  const lastTapYRef   = useRef(0);

  // ── animated values ──────────────────────────────────────────────────
  const openAnim     = useRef(new Animated.Value(0)).current;
  const contentAlpha = useRef(new Animated.Value(1)).current;
  const scaleAnim    = useRef(new Animated.Value(1)).current;
  const txAnim       = useRef(new Animated.Value(0)).current;
  const tyAnim       = useRef(new Animated.Value(0)).current;
  const navSlideX    = useRef(new Animated.Value(0)).current;
  const captionAlpha = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(openAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }).start();
  }, []);

  // ── helpers ──────────────────────────────────────────────────────────
  function maxTX(s: number) { return (s - 1) * screenWRef.current  / 2; }
  function maxTY(s: number) { return (s - 1) * screenHRef.current / 2; }

  function resetZoom(animated = false) {
    scaleRef.current = 1;
    txRef.current    = 0;
    tyRef.current    = 0;
    isZoomedRef.current = false;
    setIsZoomed(false);
    if (animated) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 160, friction: 9, useNativeDriver: true }),
        Animated.spring(txAnim,    { toValue: 0, tension: 160, friction: 9, useNativeDriver: true }),
        Animated.spring(tyAnim,    { toValue: 0, tension: 160, friction: 9, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(1);
      txAnim.setValue(0);
      tyAnim.setValue(0);
    }
  }

  function applyZoom(newScale: number, newTX: number, newTY: number, animated = false) {
    const s  = clamp(newScale, 1, MAX_ZOOM);
    const cx = clamp(newTX, -maxTX(s), maxTX(s));
    const cy = clamp(newTY, -maxTY(s), maxTY(s));
    scaleRef.current = s;
    txRef.current    = cx;
    tyRef.current    = cy;
    const zoomed = s > 1.05;
    isZoomedRef.current = zoomed;
    setIsZoomed(zoomed);
    if (animated) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: s,  tension: 180, friction: 9, useNativeDriver: true }),
        Animated.spring(txAnim,    { toValue: cx, tension: 180, friction: 9, useNativeDriver: true }),
        Animated.spring(tyAnim,    { toValue: cy, tension: 180, friction: 9, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(s);
      txAnim.setValue(cx);
      tyAnim.setValue(cy);
    }
  }

  function navigateTo(newIdx: number, dir: 1 | -1 | 0) {
    const total = panelsRef.current.length;
    if (newIdx < 0 || newIdx >= total) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => null);
      Animated.spring(navSlideX, { toValue: 0, tension: 200, friction: 10, useNativeDriver: true }).start();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => null);

    const outX = dir === 1 ? -screenWRef.current : screenWRef.current;
    const inX  = dir === 1 ?  screenWRef.current : -screenWRef.current;

    const doSwitch = () => {
      contentAlpha.setValue(0);
      setIndex(newIdx);
      indexRef.current = newIdx;
      navSlideX.setValue(dir !== 0 ? inX : 0);
      resetZoom(false);
      requestAnimationFrame(() => {
        const anims: Animated.CompositeAnimation[] = [
          Animated.timing(contentAlpha, { toValue: 1, duration: 120, useNativeDriver: true }),
        ];
        if (dir !== 0) {
          anims.push(
            Animated.spring(navSlideX, { toValue: 0, tension: 90, friction: 12, useNativeDriver: true }),
          );
        }
        Animated.parallel(anims).start();
      });
    };

    if (dir !== 0) {
      Animated.timing(navSlideX, { toValue: outX, duration: 165, useNativeDriver: true }).start(doSwitch);
    } else {
      Animated.timing(contentAlpha, { toValue: 0, duration: 100, useNativeDriver: true }).start(doSwitch);
    }
  }

  // ── double-tap (from tap-zone onPress or PanResponder release) ───────
  function handleDoubleTap(tapX: number, tapY: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => null);
    if (scaleRef.current > 1.1) {
      resetZoom(true);
    } else {
      // zoom 2.5× centred on the tapped point
      const s  = ZOOM_IN_SCALE;
      const cx = (tapX - screenWRef.current  / 2) * (1 - s);
      const cy = (tapY - screenHRef.current / 2) * (1 - s);
      applyZoom(s, cx, cy, true);
    }
  }

  function handleSingleTap() {
    const newOn = !captionOn;
    setCaptionOn(newOn);
    Animated.timing(captionAlpha, {
      toValue: newOn ? 1 : 0, duration: 200, useNativeDriver: true,
    }).start();
  }

  // ── tap-zone press handler (for left / center / right zones) ─────────
  function handleZoneTap(tapX: number, tapY: number) {
    const now = Date.now();
    if (now - lastTapRef.current < 290) {
      lastTapRef.current = 0;
      handleDoubleTap(tapX, tapY);
    } else {
      lastTapRef.current = now;
      lastTapXRef.current = tapX;
      lastTapYRef.current = tapY;
    }
  }

  // ── PanResponder ─────────────────────────────────────────────────────
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      touchCountRef.current = evt.nativeEvent.touches.length;
      // grab immediately when 2 fingers (pinch) or when zoomed (for pan)
      return evt.nativeEvent.touches.length === 2 || isZoomedRef.current;
    },
    onMoveShouldSetPanResponder: (evt, gs) => {
      touchCountRef.current = evt.nativeEvent.touches.length;
      if (evt.nativeEvent.touches.length === 2) return true;
      if (isZoomedRef.current) return Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4;
      // nav swipe: horizontal
      return Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.1;
    },

    onPanResponderGrant: (evt) => {
      touchCountRef.current = evt.nativeEvent.touches.length;
      // save pan base
      txBaseRef.current = txRef.current;
      tyBaseRef.current = tyRef.current;

      if (touchCountRef.current === 2) {
        const t = evt.nativeEvent.touches;
        const dx = t[0].pageX - t[1].pageX;
        const dy = t[0].pageY - t[1].pageY;
        pinchStartDistRef.current  = Math.sqrt(dx * dx + dy * dy);
        pinchStartScaleRef.current = scaleRef.current;
        pinchStartTXRef.current    = txRef.current;
        pinchStartTYRef.current    = tyRef.current;
        pinchMidXRef.current       = (t[0].pageX + t[1].pageX) / 2;
        pinchMidYRef.current       = (t[0].pageY + t[1].pageY) / 2;
      }
    },

    onPanResponderMove: (evt, gs) => {
      touchCountRef.current = evt.nativeEvent.touches.length;

      if (touchCountRef.current === 2) {
        // ── pinch-to-zoom toward midpoint ─────────────────────────────
        const t  = evt.nativeEvent.touches;
        const dx = t[0].pageX - t[1].pageX;
        const dy = t[0].pageY - t[1].pageY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (pinchStartDistRef.current === null) {
          pinchStartDistRef.current = dist;
          return;
        }
        const ratio    = dist / pinchStartDistRef.current;
        const s0       = pinchStartScaleRef.current;
        const newScale = clamp(s0 * ratio, 1, MAX_ZOOM);
        const mx       = pinchMidXRef.current;
        const my       = pinchMidYRef.current;
        const sw       = screenWRef.current;
        const sh       = screenHRef.current;
        // keep midpoint fixed: newTX = (mx - sw/2)*(1 - newS/s0) + tx0*(newS/s0)
        const r = newScale / s0;
        const newTX = clamp(
          (mx - sw / 2) * (1 - r) + pinchStartTXRef.current * r,
          -maxTX(newScale), maxTX(newScale),
        );
        const newTY = clamp(
          (my - sh / 2) * (1 - r) + pinchStartTYRef.current * r,
          -maxTY(newScale), maxTY(newScale),
        );
        scaleRef.current = newScale;
        txRef.current    = newTX;
        tyRef.current    = newTY;
        scaleAnim.setValue(newScale);
        txAnim.setValue(newTX);
        tyAnim.setValue(newTY);

      } else if (isZoomedRef.current) {
        // ── single-finger pan when zoomed ─────────────────────────────
        const s   = scaleRef.current;
        const newTX = clamp(txBaseRef.current + gs.dx, -maxTX(s), maxTX(s));
        const newTY = clamp(tyBaseRef.current + gs.dy, -maxTY(s), maxTY(s));
        txAnim.setValue(newTX);
        tyAnim.setValue(newTY);

      } else {
        // ── swipe-to-navigate ─────────────────────────────────────────
        navSlideX.setValue(gs.dx);
      }
    },

    onPanResponderRelease: (evt, gs) => {
      // ── pinch release ────────────────────────────────────────────────
      if (touchCountRef.current === 2 || pinchStartDistRef.current !== null) {
        const s = scaleRef.current;
        if (s < 1.15) {
          resetZoom(true);
        } else {
          isZoomedRef.current = true;
          setIsZoomed(true);
        }
        pinchStartDistRef.current = null;
        touchCountRef.current     = 0;
        return;
      }

      // ── commit pan / detect double-tap when zoomed ───────────────────
      if (isZoomedRef.current) {
        const s   = scaleRef.current;
        const committed_tx = clamp(txBaseRef.current + gs.dx, -maxTX(s), maxTX(s));
        const committed_ty = clamp(tyBaseRef.current + gs.dy, -maxTY(s), maxTY(s));
        txRef.current = committed_tx;
        tyRef.current = committed_ty;
        txAnim.setValue(committed_tx);
        tyAnim.setValue(committed_ty);

        // tiny movement = tap → check for double-tap to zoom out
        if (Math.abs(gs.dx) < 8 && Math.abs(gs.dy) < 8 && gs.numberActiveTouches === 0) {
          const now = Date.now();
          const tapX = evt.nativeEvent.pageX;
          const tapY = evt.nativeEvent.pageY;
          if (now - lastTapRef.current < 290) {
            lastTapRef.current = 0;
            handleDoubleTap(tapX, tapY);
          } else {
            lastTapRef.current  = now;
            lastTapXRef.current = tapX;
            lastTapYRef.current = tapY;
          }
        }
        touchCountRef.current = 0;
        return;
      }

      // ── swipe navigation ─────────────────────────────────────────────
      const threshold = screenWRef.current * SWIPE_DIST_RATIO;
      if      (gs.dx < -threshold || gs.vx < -SWIPE_VEL) navigateTo(indexRef.current + 1,  1);
      else if (gs.dx >  threshold || gs.vx >  SWIPE_VEL) navigateTo(indexRef.current - 1, -1);
      else Animated.spring(navSlideX, { toValue: 0, tension: 180, friction: 10, useNativeDriver: true }).start();
      touchCountRef.current = 0;
    },

    onPanResponderTerminate: () => {
      touchCountRef.current     = 0;
      pinchStartDistRef.current = null;
      Animated.spring(navSlideX, { toValue: 0, tension: 180, friction: 10, useNativeDriver: true }).start();
    },
  })).current;

  // ── derived ──────────────────────────────────────────────────────────
  const panel      = panels[index];
  const imgSrc     = panel.imageUri
    ? { uri: panel.imageUri }
    : panel.bgPreset && BG_PRESET_MAP[panel.bgPreset]
      ? BG_PRESET_MAP[panel.bgPreset]
      : null;
  const hasCaption = panel.text.trim().length > 0;
  const topPad     = Platform.OS === 'web' ? 52 : insets.top;
  const botPad     = Platform.OS === 'web' ? 28 : insets.bottom;
  const showDots   = panels.length <= 14;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 999,
          opacity: openAnim,
          transform: [{ scale: openAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
        },
      ]}
    >
      {/* Ambient background */}
      <LinearGradient
        colors={[gradient[0], '#050310']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Nav slide layer — handles swipe-navigation slide */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: navSlideX }] }]}
        {...responder.panHandlers}
      >
        {/* Zoom + pan layer */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity:   contentAlpha,
              transform: [
                { translateX: txAnim  },
                { translateY: tyAnim  },
                { scale:      scaleAnim },
              ],
            },
          ]}
        >
          {imgSrc ? (
            <Image
              source={imgSrc}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient
              colors={gradient}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
            />
          )}

          {imgSrc && (
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
              style={[StyleSheet.absoluteFill, { top: '55%' }]}
            />
          )}

          {!!panel.bubbleText?.trim() && (
            <View style={[styles.bubble, { maxWidth: screenW * 0.72 }]}>
              <Text style={styles.bubbleTxt}>{panel.bubbleText}</Text>
              <View style={styles.bubbleTail} />
            </View>
          )}

          {panel.overlays?.map(ov => {
            const left = ov.xPct * screenW;
            const top  = ov.yPct * screenH;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ff   = (ov.fontFamily ?? 'Satoshi-Medium') as any;
            const fs   = Math.min((ov.fontSize ?? (ov.type === 'sticker' ? 28 : 13)) * 1.5, 34);
            const bR   = ov.bubbleStyle === 'sharp' ? 3 : ov.bubbleStyle === 'oval' ? 50 : 14;
            return (
              <View key={ov.id} style={{ position: 'absolute', left, top, zIndex: 15 }}>
                {ov.type === 'bubble' && (
                  <View style={[styles.bubble, { borderRadius: bR, position: 'relative', top: 0, left: 0, maxWidth: screenW * 0.65 }]}>
                    <Text style={[styles.bubbleTxt, { fontFamily: ff, fontSize: fs }]}>{ov.content}</Text>
                    {ov.bubbleStyle !== 'oval' && <View style={styles.bubbleTail} />}
                  </View>
                )}
                {ov.type === 'text' && (
                  <Text style={[styles.ovText, { fontFamily: ff, fontSize: fs, color: ov.color ?? '#fff' }]}>{ov.content}</Text>
                )}
                {ov.type === 'sticker' && <Text style={{ fontSize: fs }}>{ov.content}</Text>}
              </View>
            );
          })}
        </Animated.View>
      </Animated.View>

      {/* Tap zones — left nav / center double-tap-zoom / right nav */}
      {!isZoomed && (
        <>
          <TouchableOpacity
            style={[styles.tapZone, { left: 0, width: screenW * 0.28 }]}
            onPress={(e) => {
              const now = Date.now();
              const tx  = e.nativeEvent.pageX;
              const ty  = e.nativeEvent.pageY;
              if (now - lastTapRef.current < 290) {
                lastTapRef.current = 0;
                handleDoubleTap(tx, ty);
              } else {
                lastTapRef.current  = now;
                lastTapXRef.current = tx;
                lastTapYRef.current = ty;
                navigateTo(index - 1, -1);
              }
            }}
            activeOpacity={0.001}
          >
            {index > 0 && (
              <View style={[styles.navArrow, { left: 10 }]}>
                <Icon name="chevron-left" size={22} color="rgba(255,255,255,0.40)" />
              </View>
            )}
          </TouchableOpacity>

          {/* Centre zone — single tap = toggle caption, double tap = zoom to point */}
          <TouchableOpacity
            style={[styles.tapZone, { left: screenW * 0.28, width: screenW * 0.44 }]}
            onPress={(e) => handleZoneTap(e.nativeEvent.pageX, e.nativeEvent.pageY)}
            activeOpacity={0.001}
          />

          <TouchableOpacity
            style={[styles.tapZone, { right: 0, width: screenW * 0.28 }]}
            onPress={(e) => {
              const now = Date.now();
              const tx  = e.nativeEvent.pageX;
              const ty  = e.nativeEvent.pageY;
              if (now - lastTapRef.current < 290) {
                lastTapRef.current = 0;
                handleDoubleTap(tx, ty);
              } else {
                lastTapRef.current  = now;
                lastTapXRef.current = tx;
                lastTapYRef.current = ty;
                navigateTo(index + 1, 1);
              }
            }}
            activeOpacity={0.001}
          >
            {index < panels.length - 1 && (
              <View style={[styles.navArrow, { right: 10 }]}>
                <Icon name="chevron-right" size={22} color="rgba(255,255,255,0.40)" />
              </View>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* Header */}
      <Animated.View
        style={[styles.header, { paddingTop: topPad + 6, opacity: openAnim }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
          <Icon name="x" size={18} color="rgba(255,255,255,0.88)" />
        </TouchableOpacity>

        <View style={styles.counterPill}>
          <Text style={styles.counterTxt}>{index + 1} / {panels.length}</Text>
        </View>

        {isZoomed ? (
          <TouchableOpacity
            style={styles.zoomResetBtn}
            onPress={() => resetZoom(true)}
            activeOpacity={0.75}
          >
            <Icon name="minimize-2" size={14} color="rgba(255,255,255,0.75)" />
            <Text style={styles.zoomResetTxt}>Reset</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.hintPill}>
            <Text style={styles.hintTxt}>⊕ double-tap to zoom</Text>
          </View>
        )}
      </Animated.View>

      {/* Progress dots */}
      <View
        style={[styles.dotsRow, { bottom: (hasCaption && captionOn ? 92 : 22) + botPad }]}
        pointerEvents="none"
      >
        {showDots ? (
          panels.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width:           i === index ? 20 : 5,
                  backgroundColor: i === index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.22)',
                },
              ]}
            />
          ))
        ) : (
          <View style={styles.dotBadge}>
            <Text style={styles.dotBadgeTxt}>{index + 1} / {panels.length}</Text>
          </View>
        )}
      </View>

      {/* Caption strip */}
      {hasCaption && (
        <Animated.View
          style={[
            styles.captionStrip,
            {
              paddingBottom: botPad + 22,
              opacity:       captionAlpha,
              transform:     [{ translateY: captionAlpha.interpolate({ inputRange: [0, 1], outputRange: [72, 0] }) }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.captionTxt}>{panel.text}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.48)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center', justifyContent: 'center',
  },
  counterPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  counterTxt: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontFamily: 'Satoshi-Medium' },
  zoomResetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    minWidth: 72, justifyContent: 'center',
  },
  zoomResetTxt: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontFamily: 'Satoshi-Medium' },
  hintPill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    minWidth: 72, alignItems: 'center',
  },
  hintTxt: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: 'Satoshi-Regular' },

  tapZone: {
    position: 'absolute', top: 70, bottom: 80, zIndex: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  navArrow: {
    position: 'absolute', width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center',
  },

  dotsRow: {
    position: 'absolute', left: 0, right: 0, zIndex: 60,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5,
  },
  dot: { height: 5, borderRadius: 2.5 },
  dotBadge: {
    paddingHorizontal: 13, paddingVertical: 5, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  dotBadgeTxt: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontFamily: 'Satoshi-Medium' },

  captionStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 60,
    paddingHorizontal: 24, paddingTop: 18,
    backgroundColor: 'rgba(5,3,16,0.90)',
    borderTopWidth: 1, borderTopColor: 'rgba(200,184,232,0.14)',
  },
  captionTxt: {
    color: 'rgba(240,234,248,0.96)', fontSize: 15.5,
    fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    lineHeight: 24, textAlign: 'center',
  },

  bubble: {
    position: 'absolute', top: '11%', left: 14,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, zIndex: 20,
  },
  bubbleTxt: { fontSize: 14, fontFamily: 'Satoshi-Medium', color: '#1A1530', lineHeight: 21 },
  bubbleTail: {
    position: 'absolute', bottom: -8, left: 16,
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 8,
    borderStyle: 'solid',
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.97)',
  },
  ovText: {
    textShadowColor: 'rgba(0,0,0,0.92)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});
