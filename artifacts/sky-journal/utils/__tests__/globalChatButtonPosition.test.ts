import { describe, expect, it } from 'vitest';
import {
  clampChatButtonPoint,
  getChatButtonFractions,
  getDefaultChatButtonPoint,
  pointFromChatButtonFractions,
} from '../globalChatButtonPosition';

const insets = { top: 24, right: 0, bottom: 24, left: 0 };

describe('global chat button position', () => {
  it('starts at the familiar right-side middle position', () => {
    expect(getDefaultChatButtonPoint(400, 800, 60, insets)).toEqual({ x: 328, y: 392 });
  });
  it('keeps dragged positions inside safe screen bounds', () => {
    expect(clampChatButtonPoint({ x: 900, y: 900 }, 400, 800, 60, insets)).toEqual({ x: 328, y: 640 });
  });
  it('persists position proportionally when the screen size changes', () => {
    const saved = getChatButtonFractions({ x: 164, y: 400 }, 400, 800, 60, insets);
    const moved = pointFromChatButtonFractions(saved, 800, 400, 60, insets);
    expect(moved.x).toBeCloseTo(356.4, 0);
    expect(moved.y).toBeCloseTo(159.0, 0);
  });
  it('clamps invalid fractions from stored preferences', () => {
    expect(pointFromChatButtonFractions({ x: 4, y: -1 }, 400, 800, 60, insets)).toEqual({ x: 328, y: 36 });
  });
});
