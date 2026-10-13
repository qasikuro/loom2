import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

// A small hook harness exercises the reader lifecycle without pretending to run a native image decoder.
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
      h.states[index] = typeof next === 'function' ? next(h.states[index]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const index = h.refCursor++;
    if (!h.refs[index]) h.refs[index] = { current: initial };
    return h.refs[index];
  },
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => void | (() => void)) => { if (!h.effect) h.effect = fn; },
}));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', TouchableOpacity: 'Button', ActivityIndicator: 'Spinner', Modal: 'Modal',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {}, absoluteFillObject: {} },
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock('expo-image', () => ({ Image: 'NativeImage' }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('../../components/SecureImage', () => ({ SecureImage: 'SecureImage' }));
vi.mock('../../components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../hooks/useColors', () => ({ useColors: () => ({
  muted: '#161426', primary: '#9B75FC', foreground: '#fff',
}) }));
vi.mock('../mediaAccess', () => ({
  getMediaAuthScope: () => h.scope,
  subscribeMediaAuthScope: () => () => undefined,
  resolveMediaReadUrl: vi.fn(),
}));
import { ChatMessagePhoto } from '../../components/ChatPhoto';
import { resolveMediaReadUrl } from '../mediaAccess';

type Node = React.ReactElement<Record<string, unknown>>;
function find(node: unknown, type: string): Node | undefined {
  if (Array.isArray(node)) return node.map(n => find(n, type)).find(Boolean);
  if (!React.isValidElement(node)) return undefined;
  const element = node as Node;
  return element.type === type ? element : find(element.props.children, type);
}
function render(): Node {
  h.stateCursor = 0; h.refCursor = 0;
  const element = ChatMessagePhoto({ uri: '/api/images/chat.jpg', width: 250 });
  return (element.type as (props: typeof element.props) => Node)(element.props);
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('private chat photo reader lifecycle', () => {
  beforeEach(() => {
    h.scope = 'reader-a'; h.states = []; h.refs = []; h.effect = null;
    vi.mocked(resolveMediaReadUrl).mockReset();
  });
  it('never starts a native request with an unsigned private path', async () => {
    vi.mocked(resolveMediaReadUrl).mockResolvedValue('https://media.test/chat.jpg?test-read-capability');
    expect(find(render(), 'NativeImage')).toBeUndefined();
    expect(find(render(), 'Spinner')).toBeDefined();
    h.effect!();
    await flush();
    const image = find(render(), 'NativeImage')!;
    expect(image.props.source).toEqual({ uri: 'https://media.test/chat.jpg?test-read-capability' });
    expect(resolveMediaReadUrl).toHaveBeenCalledWith('/api/images/chat.jpg', false, 'reader-a');
  });
  it('does not display a late URL after the reader account changes', async () => {
    let finish!: (url: string) => void;
    vi.mocked(resolveMediaReadUrl).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(); h.effect!();
    h.scope = 'reader-b';
    finish('https://media.test/private-owner-a');
    await flush();
    expect(find(render(), 'NativeImage')).toBeUndefined();
  });
  it('drops a response after the photo is unmounted', async () => {
    let finish!: (url: string) => void;
    vi.mocked(resolveMediaReadUrl).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render();
    const cleanup = h.effect!();
    if (typeof cleanup === 'function') cleanup();
    finish('https://media.test/late');
    await flush();
    expect(find(render(), 'NativeImage')).toBeUndefined();
  });
  it('shows a retry instead of an empty bubble when the resolver is unavailable', async () => {
    vi.mocked(resolveMediaReadUrl).mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce('https://media.test/renewed');
    render(); h.effect!(); await flush();
    const retry = find(render(), 'Button')!;
    expect(retry.props.accessibilityLabel).toContain('Tap to retry');
    (retry.props.onPress as () => void)();
    await flush();
    expect(resolveMediaReadUrl).toHaveBeenLastCalledWith('/api/images/chat.jpg', true, 'reader-a');
    expect(find(render(), 'NativeImage')!.props.source).toEqual({ uri: 'https://media.test/renewed' });
  });
  it('bounds automatic image-failure renewal to one attempt before offering manual retry', async () => {
    vi.mocked(resolveMediaReadUrl).mockResolvedValue('https://media.test/read');
    render(); h.effect!(); await flush();
    (find(render(), 'NativeImage')!.props.onError as () => void)();
    await flush();
    (find(render(), 'NativeImage')!.props.onError as () => void)();
    await flush();
    expect(resolveMediaReadUrl).toHaveBeenCalledTimes(2);
    expect(find(render(), 'Button')).toBeDefined();
  });
});
