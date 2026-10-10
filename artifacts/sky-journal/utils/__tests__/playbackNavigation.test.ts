import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Exercise the actual hook/effect bodies with delayed native players, without
// requiring a React Native bridge in Node.
const root = new URL('../../', import.meta.url);
function source(path: string) {
  return readFileSync(new URL(path, root), 'utf8');
}
function run(body: string, env: Record<string, unknown>) {
  const js = ts.transpileModule(
    body.replaceAll("const { Audio } = await import('expo-av');", ''),
    { compilerOptions: { target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  return new Function(...Object.keys(env), js)(...Object.values(env));
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function sound() {
  return {
    playAsync: vi.fn().mockResolvedValue(undefined),
    stopAsync: vi.fn().mockResolvedValue(undefined),
    unloadAsync: vi.fn().mockResolvedValue(undefined),
    setOnPlaybackStatusUpdate: vi.fn(),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function outfitEffect(createAsync: ReturnType<typeof vi.fn>) {
  const text = source('app/user-outfit.tsx');
  const start = text.indexOf('useFocusEffect(useCallback(() => {');
  const end = text.indexOf('\n\n  useEffect(() => {', start);
  let focus!: () => () => void;
  run(text.slice(start, end), {
    useFocusEffect: (cb: typeof focus) => { focus = cb; },
    useCallback: (cb: unknown) => cb,
    audioGeneration: { current: 0 },
    musicRef: { current: null },
    webAudioRef: { current: null },
    outfit: { music: { streamUrl: 'https://example.test/track' } },
    currentIdx: 0, musicRetry: 0, musicMuted: false,
    setMusicPlaying: vi.fn(),
    Platform: { OS: 'android' },
    Audio: { setAudioModeAsync: vi.fn().mockResolvedValue(undefined), Sound: { createAsync } },
    registerNativeSound: vi.fn(), unregisterNativeSound: vi.fn(),
  });
  return focus;
}
function previewHook(createAsync: ReturnType<typeof vi.fn>) {
  const text = source('features/story-studio/components/AudiusMusicPicker.tsx');
  const start = text.indexOf('function useAudiusPreview()');
  const end = text.indexOf('\ntype PreviewController', start);
  let cleanup!: () => void;
  const controller = run(text.slice(start, end) + '\nreturn useAudiusPreview();', {
    useState: () => [null, vi.fn()],
    useRef: (value: unknown) => ({ current: value }),
    useCallback: (cb: unknown) => cb,
    useEffect: (cb: () => () => void) => { cleanup = cb(); },
    Audio: { Sound: { createAsync } },
    registerNativeSound: vi.fn(), unregisterNativeSound: vi.fn(),
  });
  return { controller, leave: () => cleanup() };
}

describe('media playback navigation cleanup', () => {
  it('stops and unloads outfit music on blur, then creates a fresh player on return', async () => {
    const first = sound(), second = sound();
    const create = vi.fn().mockResolvedValueOnce({ sound: first }).mockResolvedValueOnce({ sound: second });
    const focus = outfitEffect(create);
    const leave = focus();
    await flush();
    expect(first.playAsync).toHaveBeenCalledOnce();
    leave();
    await flush();
    expect(first.stopAsync).toHaveBeenCalled();
    expect(first.unloadAsync).toHaveBeenCalled();
    const leaveAgain = focus();
    await flush();
    expect(second.playAsync).toHaveBeenCalledOnce();
    leaveAgain();
    await flush();
    expect(second.unloadAsync).toHaveBeenCalled();
  });

  it('never starts an outfit track that finishes loading after blur', async () => {
    const pending = deferred<{ sound: ReturnType<typeof sound> }>();
    const player = sound();
    const create = vi.fn().mockReturnValue(pending.promise);
    const leave = outfitEffect(create)();
    await flush();
    expect(create.mock.calls[0][1].shouldPlay).toBe(false);
    leave();
    pending.resolve({ sound: player });
    await flush();
    expect(player.playAsync).not.toHaveBeenCalled();
    expect(player.unloadAsync).toHaveBeenCalled();
  });

  it('stops the story player when it is removed on screen blur', async () => {
    const player = sound();
    const { controller, leave } = previewHook(vi.fn().mockResolvedValue({ sound: player }));
    await controller.toggle({ id: 'track', streamUrl: 'https://example.test/track' });
    expect(player.playAsync).toHaveBeenCalledOnce();
    leave();
    await flush();
    expect(player.stopAsync).toHaveBeenCalled();
    expect(player.unloadAsync).toHaveBeenCalled();
  });

  it('never starts a story track that loads after leaving', async () => {
    const pending = deferred<{ sound: ReturnType<typeof sound> }>();
    const player = sound(), create = vi.fn().mockReturnValue(pending.promise);
    const { controller, leave } = previewHook(create);
    const loading = controller.toggle({ id: 'track', streamUrl: 'https://example.test/track' });
    await flush();
    expect(create.mock.calls[0][1].shouldPlay).toBe(false);
    leave();
    pending.resolve({ sound: player });
    await loading;
    expect(player.playAsync).not.toHaveBeenCalled();
    expect(player.unloadAsync).toHaveBeenCalled();
  });

  it('gates inline reels, the full video modal, and story music on route focus', () => {
    const reels = source('app/(tabs)/reels.tsx');
    expect(reels).toContain('playing={isFocused && !selectedVideoPost');
    expect(reels).toContain('post={isFocused ? selectedVideoPost : null}');
    expect(source('features/story-studio/screens/StoryViewerScreen.tsx'))
      .toContain('{isFocused && <AudiusTrackPlayer');
  });
});
