import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as { deps: unknown[]; cleanup?: () => void }[],
  pending: [] as (() => void)[],
  stateCursor: 0,
  refCursor: 0,
  effectCursor: 0,
  player: {
    status: 'readyToPlay', playing: true, currentTime: 1, duration: 12,
    loop: false, muted: false, volume: 1, timeUpdateEventInterval: 0,
    videoTrack: { size: { width: 720, height: 1280 } },
    play: vi.fn(), pause: vi.fn(),
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = h.stateCursor++;
    if (!(index in h.states)) h.states[index] = initial;
    return [h.states[index], (next: unknown) => {
      h.states[index] = typeof next === 'function'
        ? (next as (value: unknown) => unknown)(h.states[index]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const index = h.refCursor++;
    return h.refs[index] ?? (h.refs[index] = { current: initial });
  },
  useImperativeHandle: () => undefined,
  useEffect: (callback: () => void | (() => void), deps: unknown[]) => {
    const index = h.effectCursor++;
    const previous = h.effects[index];
    if (previous && deps.length === previous.deps.length && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return;
    h.pending.push(() => {
      previous?.cleanup?.();
      const cleanup = callback();
      h.effects[index] = { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
    });
  },
}));
vi.mock('expo-video', () => ({ VideoView: 'VideoView', useVideoPlayer: () => h.player }));
vi.mock('expo-image', () => ({ Image: 'Poster' }));
vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } },
}));

import { VideoSurface } from '../../components/VideoSurface';

type Node = React.ReactElement<Record<string, unknown>>;
type Props = React.ComponentProps<typeof VideoSurface>;
const defaultProps: Props = {
  source: { uri: 'https://example.test/reel.mp4' },
  posterSource: { uri: 'https://example.test/poster.jpg' },
  usePoster: true,
  shouldPlay: true,
};

function render(props: Props = defaultProps): Node {
  h.stateCursor = h.refCursor = h.effectCursor = 0;
  const component = VideoSurface as unknown as { render: (props: Props, ref: null) => Node };
  const tree = component.render(props, null);
  h.pending.splice(0).forEach(effect => effect());
  return tree;
}

function child(tree: Node, type: string): Node | undefined {
  const children = React.Children.toArray(tree.props.children as React.ReactNode);
  return children.find(node => React.isValidElement(node) && node.type === type) as Node | undefined;
}

function showFirstFrame() {
  const tree = render();
  (child(tree, 'VideoView')!.props.onFirstFrameRender as () => void)();
  expect(child(render(), 'Poster')).toBeUndefined();
}

function flattenStyle(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return Object.assign({}, ...value.map(flattenStyle));
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

describe('video surface visibility', () => {
  beforeEach(() => {
    h.states = []; h.refs = []; h.effects = []; h.pending = [];
    h.stateCursor = h.refCursor = h.effectCursor = 0;
    vi.clearAllMocks();
  });

  it.each(['fullscreen', 'reel'])('preserves the %s caller’s absolute-fill layout', kind => {
    const fill = { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 };
    const tree = render({ ...defaultProps, style: kind === 'reel' ? [fill, { opacity: 1 }] : fill });
    expect(flattenStyle(tree.props.style)).toMatchObject({ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 });
  });

  it('keeps normal-flow players with explicit dimensions intact', () => {
    const tree = render({ ...defaultProps, style: { width: 300, height: 200 } });
    expect(flattenStyle(tree.props.style)).toMatchObject({ position: 'relative', width: 300, height: 200 });
  });

  it('does not cover an already rendered video with its poster when pausing or muting', () => {
    showFirstFrame();
    const paused = { ...defaultProps, shouldPlay: false, isMuted: true };
    render(paused);
    expect(child(render(paused), 'Poster')).toBeUndefined();
    expect(h.player.pause).toHaveBeenCalled();
  });

  it('resets the poster when a new source replaces the current source on the same native player', () => {
    showFirstFrame();
    const previousPlayCalls = h.player.play.mock.calls.length;
    const next = { ...defaultProps, source: { uri: 'https://example.test/next.mp4' } };
    render(next);
    expect(child(render(next), 'Poster')).toBeDefined();
    expect(h.player.play.mock.calls.length).toBeGreaterThan(previousPlayCalls);
  });
});
