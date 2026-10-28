import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { anchorFromMeasure, getAvatarFlight, type AvatarAnchor } from './profileScrollGeometry';

/**
 * Measures an in-scroll avatar slot in the screen root's coordinate space.
 * Measurement happens on layout only (never per scroll frame).
 */
export function useAvatarAnchor(scrollOffsetRef: React.MutableRefObject<number>) {
  const rootRef = useRef<View>(null);
  const slotRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<AvatarAnchor | null>(null);
  const anchorRef = useRef<AvatarAnchor | null>(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const slot = slotRef.current;
    if (!root || !slot) return;
    requestAnimationFrame(() => {
      root.measureInWindow((rootX, rootY) => {
        slot.measureInWindow((slotX, slotY, slotW, slotH) => {
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
  anchor, scrollY, range, topInset, hasLeftAction, boxSize, avatarSize, hidden, children, expandedDecor, style,
}: OverlayProps) {
  const anim = useMemo(() => {
    if (!anchor) return null;
    const f = getAvatarFlight({ ...anchor, avatarSize, avatarBoxSize: boxSize, range, topInset, hasLeftAction });
    return {
      scale: scrollY.interpolate({ ...f.scale, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      tx: scrollY.interpolate({ ...f.translateX, extrapolate: 'clamp' }),
      ty: scrollY.interpolate({ ...f.translateY, extrapolateLeft: 'extend', extrapolateRight: 'clamp' }),
      decor: scrollY.interpolate({ ...f.decor, extrapolate: 'clamp' }),
    };
  }, [anchor, avatarSize, boxSize, range, topInset, hasLeftAction, scrollY]);

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
  root: { position: 'absolute', zIndex: 48, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
