import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  state: undefined as unknown,
  refs: [] as { current: unknown }[],
  cursor: 0,
  scope: 'viewer-a',
}));
vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    return harness.refs[index] ?? (harness.refs[index] = { current: initial });
  },
  useState: (initial: () => unknown) => {
    harness.state ??= initial();
    return [harness.state, (next: unknown) => {
      harness.state = typeof next === 'function' ? next(harness.state) : next;
    }];
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() } }));
vi.mock('../mediaAccess', () => ({
  canonicalMediaUri: (uri: string) => uri.split('?')[0],
  isManagedMediaUri: (uri: string) => uri.startsWith('/api/videos/'),
  getMediaAuthScope: () => harness.scope,
  subscribeMediaAuthScope: vi.fn(),
  resolveMediaReadUrl: vi.fn(),
}));
import { useSecureMediaUri } from '../../hooks/useSecureMediaUri';
import { resolveMediaReadUrl } from '../mediaAccess';

function render(uri = '/api/videos/clip.mp4', waitForAuthorization = true) {
  harness.cursor = 0;
  // eslint-disable-next-line react-hooks/rules-of-hooks -- This isolated harness supplies mocked React hook state.
  return useSecureMediaUri(uri, { waitForAuthorization });
}

describe('reel video authorization before load', () => {
  beforeEach(() => {
    harness.state = undefined;
    harness.refs = [];
    harness.scope = 'viewer-a';
    vi.mocked(resolveMediaReadUrl).mockReset();
  });
  it('does not start a canonical request before the authorized URL is available', async () => {
    vi.mocked(resolveMediaReadUrl).mockResolvedValue('/api/videos/clip.mp4?ticket=current');
    const initial = render();
    expect(initial.uri).toBeUndefined();
    await initial.renew();
    expect(render().uri).toBe('/api/videos/clip.mp4?ticket=current');
  });
  it('preserves immediate loading for external videos and existing hook consumers', () => {
    expect(render('https://video.example/clip.mp4').uri).toBe('https://video.example/clip.mp4');
    expect(render('/api/videos/clip.mp4', false).uri).toBe('/api/videos/clip.mp4');
  });
  it('exposes authorization failures and allows an explicit retry', async () => {
    vi.mocked(resolveMediaReadUrl).mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('/api/videos/clip.mp4?ticket=renewed');
    await render().renew();
    expect(render().error).toBe(true);
    expect(render().uri).toBeUndefined();
    await render().renew();
    expect(render().error).toBe(false);
    expect(render().uri).toContain('renewed');
  });
  it('hides the old account URL immediately and ignores its late response', async () => {
    let finish!: (uri: string) => void;
    vi.mocked(resolveMediaReadUrl).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = render().renew();
    harness.scope = 'viewer-b';
    expect(render().uri).toBeUndefined();
    finish('/api/videos/clip.mp4?ticket=viewer-a');
    await pending;
    expect(render().uri).toBeUndefined();
  });
});
