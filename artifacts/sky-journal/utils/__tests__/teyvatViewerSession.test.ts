import { describe, expect, it } from 'vitest';
import { createTeyvatViewerSession } from '../../components/profile/teyvatViewerSession';

describe('Teyvat viewing sessions', () => {
  it('accepts one selection even before React renders it', () => {
    const viewer = createTeyvatViewerSession();
    expect(viewer.open()).not.toBeNull();
    expect(viewer.open()).toBeNull();
  });

  it('blocks reopening during exit and until the removal commits', () => {
    const viewer = createTeyvatViewerSession();
    const session = viewer.open()!;
    expect(viewer.beginClose(session)).toBe(true);
    expect(viewer.open()).toBeNull();
    expect(viewer.finishClose(session)).toBe(true);
    expect(viewer.open()).toBeNull();
    viewer.commitClosed();
    expect(viewer.open()).not.toBeNull();
  });

  it('gives reopening the same picture a new entrance animation identity', () => {
    const viewer = createTeyvatViewerSession();
    const first = viewer.open()!;
    viewer.beginClose(first);
    viewer.finishClose(first);
    viewer.commitClosed();
    expect(viewer.open()).toBeGreaterThan(first);
  });

  it('ignores duplicate dismissal and completion callbacks', () => {
    const viewer = createTeyvatViewerSession();
    const session = viewer.open()!;
    expect(viewer.beginClose(session)).toBe(true);
    expect(viewer.beginClose(session)).toBe(false);
    expect(viewer.finishClose(session)).toBe(true);
    expect(viewer.finishClose(session)).toBe(false);
  });

  it('ignores animation callbacks left over from closing the whole gallery', () => {
    const viewer = createTeyvatViewerSession();
    const previous = viewer.open()!;
    viewer.beginClose(previous);
    viewer.reset();
    const current = viewer.open()!;
    expect(viewer.finishClose(previous)).toBe(false);
    expect(viewer.beginClose(previous)).toBe(false);
    expect(viewer.beginClose(current)).toBe(true);
  });

  it('does not unlock a visible picture on an unrelated commit', () => {
    const viewer = createTeyvatViewerSession();
    viewer.open();
    viewer.commitClosed();
    expect(viewer.open()).toBeNull();
    expect(viewer.isOpen()).toBe(true);
  });
});
