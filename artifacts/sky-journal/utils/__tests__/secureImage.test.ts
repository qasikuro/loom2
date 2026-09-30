import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mediaScope } = vi.hoisted(() => ({ mediaScope: { current: 'image-owner-a' as string | null } }));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: (callback: (...args: never[]) => unknown) => callback,
    useEffect: () => undefined,
    useRef: (initial: unknown) => ({ current: initial }),
    useState: (initial: unknown) => [typeof initial === 'function' ? (initial as () => unknown)() : initial, vi.fn()],
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
  };
});
vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() } }));
vi.mock('expo-image', () => ({ Image: 'MockExpoImage' }));
vi.mock('../../utils/mediaAccess', () => ({
  canonicalMediaUri: (uri: string) => uri.split('?')[0],
  getMediaAuthScope: () => mediaScope.current,
  resolveMediaReadUrl: vi.fn(),
  subscribeMediaAuthScope: () => () => undefined,
}));

import type { ImageProps } from 'expo-image';
import { SecureImage } from '../../components/SecureImage';

function recyclingKey(sourceUri: string): string {
  const element = SecureImage({ source: { uri: sourceUri } } as ImageProps);
  return (element.props as { recyclingKey: string }).recyclingKey;
}

describe('SecureImage recycling identity', () => {
  beforeEach(() => {
    mediaScope.current = 'image-owner-a';
  });

  it('resets native image content on account or source change, but not a same-source renewal', () => {
    const source = '/api/images/private-photo.jpg';
    const initialKey = recyclingKey(source);
    // A renewed signed URL is internal resolved state; source identity stays canonical and stable.
    expect(recyclingKey(source)).toBe(initialKey);

    mediaScope.current = 'image-owner-b';
    expect(recyclingKey(source)).not.toBe(initialKey);
    expect(recyclingKey('/api/images/other-photo.jpg')).not.toBe(recyclingKey(source));
  });
});