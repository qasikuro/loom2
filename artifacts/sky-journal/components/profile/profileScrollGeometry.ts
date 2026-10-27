/**
 * Pure geometry for the profile "avatar flight". The expanded, centered avatar
 * is measured once (onLayout) in the screen-root coordinate system; these
 * helpers turn that anchor into native-driver interpolation configs that carry
 * the very same avatar into the compact sticky bar slot.
 */
export const COMPACT_BAR_HEIGHT = 56;
export const COMPACT_AVATAR_SIZE = 38;
export const COMPACT_PADDING_X = 14;
export const COMPACT_ACTION_WIDTH = 42;
export const COMPACT_GAP = 10;
export const PULL_RANGE = 140;
export const PULL_MAX_SCALE = 1.08;

export type AvatarAnchor = {
  /** Avatar center X relative to the screen root (handles centered maxWidth). */
  centerX: number;
  /** Avatar center Y relative to the screen root at scroll offset 0. */
  centerY: number;
};

export type AvatarFlightInput = AvatarAnchor & {
  /** Visible avatar circle diameter in the expanded state. */
  avatarSize: number;
  /** Scroll distance after which the avatar sits in the bar. */
  range: number;
  /** Safe top inset (compact bar content starts below it). */
  topInset: number;
  /** Compact bar has a left action (back button) before the avatar. */
  hasLeftAction?: boolean;
  /** Width of the screen root; the compact slot is clamped inside it. */
  rootWidth?: number;
};

export function compactAvatarCenterX(hasLeftAction = false): number {
  return COMPACT_PADDING_X + (hasLeftAction ? COMPACT_ACTION_WIDTH + COMPACT_GAP : 0) + COMPACT_AVATAR_SIZE / 2;
}

export function compactAvatarCenterY(topInset: number): number {
  return Math.max(0, topInset) + COMPACT_BAR_HEIGHT / 2;
}

const finite = (n: number, fallback = 0) => (Number.isFinite(n) ? n : fallback);

export function getAvatarFlight(input: AvatarFlightInput) {
  const R = Math.max(1, finite(input.range, 1));
  const size = Math.max(1, finite(input.avatarSize, 1));
  const endScale = Math.min(1, COMPACT_AVATAR_SIZE / size);
  const targetX = compactAvatarCenterX(input.hasLeftAction);
  const targetY = compactAvatarCenterY(finite(input.topInset));
  const endTx = targetX - finite(input.centerX);
  const endTy = targetY - finite(input.centerY);
  return {
    range: R,
    endScale,
    target: { x: targetX, y: targetY },
    // Pull-down: follow content 1:1 and grow slightly; scroll up: travel to slot, then pin.
    scale: { inputRange: [-PULL_RANGE, 0, R], outputRange: [PULL_MAX_SCALE, 1, endScale] },
    translateX: { inputRange: [0, R], outputRange: [0, endTx] },
    translateY: { inputRange: [-PULL_RANGE, 0, R], outputRange: [PULL_RANGE, 0, endTy] },
    /** Expanded-only decorations (halo, badges) fade out over the first half. */
    decor: { inputRange: [0, R * 0.5], outputRange: [1, 0] },
    /** Identity text below the avatar fades while it scrolls under the bar. */
    info: { inputRange: [0, R * 0.75], outputRange: [1, 0] },
    /** Compact bar background/name fades in as the avatar arrives. */
    barCollapseAt: Math.max(0, R - 36),
  };
}

/** Converts window measurements into a root-relative anchor at scroll 0. */
export function anchorFromMeasure(m: {
  slotX: number; slotY: number; slotW: number; slotH: number;
  rootX: number; rootY: number; scrollOffset: number;
}): AvatarAnchor {
  return {
    centerX: finite(m.slotX - m.rootX + m.slotW / 2),
    centerY: finite(m.slotY - m.rootY + m.slotH / 2 + m.scrollOffset),
  };
}
