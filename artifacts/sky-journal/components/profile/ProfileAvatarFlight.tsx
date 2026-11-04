import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { anchorFromMeasure, getAvatarFlight, type AvatarAnchor } from './profileScrollGeometry';

/**
 * The wing artwork extends well beyond the avatar circle. Keep the transformed
 * Android hardware layer wide enough to contain the full frame instead of
 * clipping feather tips at the portrait's old 124–128px bounds.
 */
export const PROFILE_AVATAR_RENDER_BOUNDS = 240;

/**
 * Measures an in-scroll avatar slot in the screen root's coordinate space.
 * Measurement happens on layout only (never per scroll frame).
 */
export function useAvatarAnchor(scrollOffsetRef: React.MutableRefObject<number>) {
  const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const slotRef = useRef<React.ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<AvatarAnchor | null>(null);
  const anchorRef = useRef<AvatarAnchor | null>(null);
  const measurementVersion = useRef(0);

  const invalidate = useCallback(() => {
    measurementVersion.current += 1;
    anchorRef.current = null;
    setAnchor(null);
  }, []);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const slot = slotRef.current;
    if (!root || !slot) return;
    const version = measurementVersion.current;
    requestAnimationFrame(() => {
      if (version !== measurementVersion.current) return;
      root.measureInWindow((rootX, rootY) => {
        if (version !== measurementVersion.current) return;
        slot.measureInWindow((slotX, slotY, slotW, slotH) => {
          if (version !== measurementVersion.current) return;
          if (!slotW || !slotH) return;
          const next = anchorFromMeasure({ slotX, slotY, slotW, slotH, rootX, rootY, scrollOffset: scrollOffsetRef.current });
          const prev = anchorRef.current;
          if (prev && Math.abs(prev.centerX - next.centerX) < 0.5 && Math.abs(prev.centerY - next.centerY) < 0.5) return;
          anchorRef.current = next;
          setAnchor(next);
        });
      });
    });
  }, [scrollOffsetRef]);

  // Navigation can restore a screen without firing layout again. Drop the old
  // window coordinates on every return and remeasure after the transition.
  useFocusEffect(useCallback(() => {
    invalidate();
    let focused = true;
    const firstFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (focused) measure();
      });
    });
    return () => {
      focused = false;
      cancelAnimationFrame(firstFrame);
      invalidate();
    };
  }, [invalidate, measure]));

  return { rootRef, slotRef, anchor, measure };
}

type OverlayProps = {
  anchor: AvatarAnchor | null;
  scrollY: Animated.Value;
  range: number;
  topInset: number;
  hasLeftAction?: boolean;
  /** Bounding box of the rendered avatar (incl. frame art). */
  boxSize: number;
  /** Visible avatar circle diameter. */
  avatarSize: number;
  /** Visible frame artwork bounds used for compact-slot scaling. */
  fitBoxSize?: number;
  hidden?: boolean;
  children: React.ReactNode | ((decorOpacity: Animated.AnimatedInterpolation<number>) => React.ReactNode);
  /** Decorations that only belong to the expanded state. */
  expandedDecor?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The single, real avatar. Rendered once above the scroll content and moved
 * with native-driver transforms from its measured slot into the compact bar.
 */
export function AvatarFlightOverlay({
  anchor, scrollY, range, topInset, hasLeftAction, boxSize, avatarSize, fitBoxSize, hidden, children, expandedDecor, style,
}: OverlayProps) {
  const anim = useMemo(() => {
    if (!anchor) return null;
    const f = getAvatarFlight({ ...anchor, avatarSize, avatarBoxSize: fitBoxSize ?? boxSize, range, topInset, hasLeftAction });
    return {
      scale: scrollY.interpolate({ ...f.scale, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      tx: scrollY.interpolate({ ...f.translateX, extrapolate: 'clamp' }),
      ty: scrollY.interpolate({ ...f.translateY, extrapolateLeft: 'extend', extrapolateRight: 'clamp' }),
      decor: scrollY.interpolate({ ...f.decor, extrapolate: 'clamp' }),
    };
  }, [anchor, avatarSize, boxSize, fitBoxSize, range, topInset, hasLeftAction, scrollY]);

  if (!anchor || !anim || hidden) return null;
  const avatar = typeof children === 'function' ? children(anim.decor) : children;
  return (
    <Animated.View
      testID="profile-avatar-flight"
      pointerEvents="none"
      collapsable={false}
      // The whole avatar is translated/scaled by the native scroll driver.
      // A small hardware layer avoids repeatedly rasterizing its wing artwork
      // and animated rings on Android during quick scroll gestures.
      renderToHardwareTextureAndroid
      style={[
        s.root,
        {
          width: boxSize,
          height: boxSize,
          left: anchor.centerX - boxSize / 2,
          top: anchor.centerY - boxSize / 2,
          transform: [{ translateX: anim.tx }, { translateY: anim.ty }, { scale: anim.scale }],
        },
        style,
      ]}
    >
      {expandedDecor ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.center, { opacity: anim.decor }]}>
          {expandedDecor}
        </Animated.View>
      ) : null}
      {avatar}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // Keep the compact bar's name and actions above the flying avatar.
  root: { position: 'absolute', zIndex: 48, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
