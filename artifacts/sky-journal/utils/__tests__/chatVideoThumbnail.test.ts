import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

const h = vi.hoisted(() => ({
  scope: 'reader-a',
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  stateCursor: 0,
  refCursor: 0,
  effect: null as null | (() => void | (() => void)),
}));

vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useState: (initial: unknown) => {
    const index = h.stateCursor++;
    if (!(index in h.states)) h.states[index] = initial;
    return [h.states[index], (next: unknown) => {
      h.states[index] = typeof next === 'function'
        ? (next as (current: unknown) => unknown)(h.states[index])
        : next;
    }];
  },
  useRef: (initial: unknown) => {
    const index = h.refCursor++;
    if (!h.refs[index]) h.refs[index] = { current: initial };
    return h.refs[index];
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (callback: () => void | (() => void)) => { h.effect = callback; },
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'Spinner',
  Modal: 'Modal',
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  Text: 'Text',
  TouchableOpacity: 'Button',
  View: 'View',
}));
vi.mock('expo-image', () => ({ Image: 'NativeImage' }));
vi.mock('@/components/VideoSurface', () => ({ VideoSurface: 'Video', ResizeMode: { CONTAIN: 'contain' } }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('../../components/SecureImage', () => ({ SecureImage: 'SecureImage' }));
vi.mock('../../components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@workspace/storigam-kindness/hooks/use-colors', () => ({
  useColors: () => ({
    background: '#fff', foreground: '#111', muted: '#eee', primary: '#635bff',
    primaryForeground: '#fff', fontFamily: { medium: 'Medium', bold: 'Bold', regular: 'Regular' },
  }),
}));
vi.mock('../mediaAccess', () => ({
  getMediaAuthScope: () => h.scope,
  subscribeMediaAuthScope: () => () => undefined,
  resolveMediaReadUrl: vi.fn(),
}));

import { ChatMessageVideo } from '../../components/ChatVideo';
import { resolveMediaReadUrl } from '../mediaAccess';

type Node = React.ReactElement<Record<string, unknown>>;

function find(node: unknown, type: string): Node | undefined {
  if (Array.isArray(node)) return node.map(child => find(child, type)).find(Boolean);
  if (!React.isValidElement(node)) return undefined;
  const element = node as Node;
  return element.type === type ? element : find(element.props.children, type);
}

function render() {
  h.stateCursor = 0;
  h.refCursor = 0;
  return ChatMessageVideo({ thumbnailUri: '/api/images/chat-video.jpg', width: 250, height: 150 });
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('private chat video thumbnail', () => {
  beforeEach(() => {
    h.scope = 'reader-a';
    h.states = [];
    h.refs = [];
    h.stateCursor = 0;
    h.refCursor = 0;
    h.effect = null;
    vi.mocked(resolveMediaReadUrl).mockReset();
  });

  it('shows a loading state before requesting an authorized thumbnail URL', async () => {
    vi.mocked(resolveMediaReadUrl).mockResolvedValue('https://media.test/thumb?ticket=reader-a');
    expect(find(render(), 'Spinner')).toBeDefined();
    h.effect!();
    await flush();
    expect(resolveMediaReadUrl).toHaveBeenCalledWith('/api/images/chat-video.jpg', false, 'reader-a');
    expect(find(render(), 'NativeImage')?.props.source).toEqual({
      uri: 'https://media.test/thumb?ticket=reader-a',
      cacheKey: JSON.stringify(['reader-a', '/api/images/chat-video.jpg']),
    });
  });

  it('shows the ready state after the thumbnail loads', async () => {
    vi.mocked(resolveMediaReadUrl).mockResolvedValue('https://media.test/thumb?ticket=reader-a');
    render();
    h.effect!();
    await flush();
    const image = find(render(), 'NativeImage')!;
    (image.props.onLoad as () => void)();
    expect(find(render(), 'NativeImage')?.props.testID).toBe('chat-video-thumbnail-ready');
  });

  it('offers manual retry after URL resolution fails and force-renews on tap', async () => {
    vi.mocked(resolveMediaReadUrl).mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('https://media.test/thumb?ticket=renewed');
    render();
    h.effect!();
    await flush();
    const retry = find(render(), 'Button')!;
    expect(retry.props.accessibilityLabel).toContain('Tap to retry');
    (retry.props.onPress as () => void)();
    await flush();
    expect(resolveMediaReadUrl).toHaveBeenLastCalledWith('/api/images/chat-video.jpg', true, 'reader-a');
    expect(find(render(), 'NativeImage')?.props.source).toEqual({
      uri: 'https://media.test/thumb?ticket=renewed',
      cacheKey: JSON.stringify(['reader-a', '/api/images/chat-video.jpg']),
    });
  });

  it('renews once after an image failure, then exposes retry if that also fails', async () => {
    vi.mocked(resolveMediaReadUrl)
      .mockResolvedValueOnce('https://media.test/thumb?ticket=first')
      .mockResolvedValueOnce('https://media.test/thumb?ticket=renewed')
      .mockResolvedValueOnce('https://media.test/thumb?ticket=manual');
    render();
    h.effect!();
    await flush();
    (find(render(), 'NativeImage')!.props.onError as () => void)();
    await flush();
    expect(resolveMediaReadUrl).toHaveBeenLastCalledWith('/api/images/chat-video.jpg', true, 'reader-a');
    (find(render(), 'NativeImage')!.props.onError as () => void)();
    await flush();
    const retry = find(render(), 'Button')!;
    expect(retry.props.testID).toBe('retry-chat-video-thumbnail');
    expect(find(render(), 'Video')).toBeUndefined();
    (retry.props.onPress as () => void)();
    await flush();
    expect(resolveMediaReadUrl).toHaveBeenLastCalledWith('/api/images/chat-video.jpg', true, 'reader-a');
    const source = find(render(), 'NativeImage')!.props.source as { uri: string };
    expect(source.uri).toContain('manual');
  });

  it('hides and ignores a pending thumbnail URL when the signed-in account changes', async () => {
    let finishOld!: (uri: string) => void;
    vi.mocked(resolveMediaReadUrl)
      .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValueOnce('https://media.test/thumb?ticket=reader-b');
    render();
    h.effect!();

    h.scope = 'reader-b';
    expect(find(render(), 'NativeImage')).toBeUndefined();
    h.effect!();
    await flush();
    const newAccountSource = find(render(), 'NativeImage')!.props.source as { uri: string };
    expect(newAccountSource.uri).toContain('reader-b');

    finishOld('https://media.test/thumb?ticket=reader-a');
    await flush();
    const sourceAfterOldResponse = find(render(), 'NativeImage')!.props.source as { uri: string };
    expect(sourceAfterOldResponse.uri).toContain('reader-b');
  });
});
