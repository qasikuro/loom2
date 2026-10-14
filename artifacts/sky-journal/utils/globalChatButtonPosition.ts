export type ChatButtonPoint = { x: number; y: number };
export type ChatButtonInsets = { top: number; right: number; bottom: number; left: number };

export function getChatButtonBounds(
  width: number,
  height: number,
  size: number,
  insets: ChatButtonInsets,
) {
  const minX = insets.left + 12;
  const maxX = Math.max(minX, width - insets.right - size - 12);
  const minY = insets.top + 12;
  const maxY = Math.max(minY, height - insets.bottom - size - 76);
  return { minX, maxX, minY, maxY };
}

export function clampChatButtonPoint(
  point: ChatButtonPoint,
  width: number,
  height: number,
  size: number,
  insets: ChatButtonInsets,
): ChatButtonPoint {
  const bounds = getChatButtonBounds(width, height, size, insets);
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)),
  };
}

export function getDefaultChatButtonPoint(
  width: number,
  height: number,
  size: number,
  insets: ChatButtonInsets,
): ChatButtonPoint {
  const bounds = getChatButtonBounds(width, height, size, insets);
  return clampChatButtonPoint({ x: bounds.maxX, y: Math.round(height * 0.49) }, width, height, size, insets);
}

export function pointFromChatButtonFractions(
  fractions: ChatButtonPoint,
  width: number,
  height: number,
  size: number,
  insets: ChatButtonInsets,
): ChatButtonPoint {
  const bounds = getChatButtonBounds(width, height, size, insets);
  return clampChatButtonPoint({
    x: bounds.minX + Math.max(0, Math.min(1, fractions.x)) * (bounds.maxX - bounds.minX),
    y: bounds.minY + Math.max(0, Math.min(1, fractions.y)) * (bounds.maxY - bounds.minY),
  }, width, height, size, insets);
}

export function getChatButtonFractions(
  point: ChatButtonPoint,
  width: number,
  height: number,
  size: number,
  insets: ChatButtonInsets,
): ChatButtonPoint {
  const bounded = clampChatButtonPoint(point, width, height, size, insets);
  const bounds = getChatButtonBounds(width, height, size, insets);
  return {
    x: bounds.maxX === bounds.minX ? 0 : (bounded.x - bounds.minX) / (bounds.maxX - bounds.minX),
    y: bounds.maxY === bounds.minY ? 0 : (bounded.y - bounds.minY) / (bounds.maxY - bounds.minY),
  };
}
