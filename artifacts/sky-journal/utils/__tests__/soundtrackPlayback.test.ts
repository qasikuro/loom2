import { describe, expect, it, vi } from 'vitest';
import { callable, deferred, effectCallback, evaluate, flush, focusCallback, pressCallback } from './helpers/soundtrackHarness';

const videoPath = 'components/DiscoverVideoPlayerModal.tsx';
const outfitPath = 'app/user-outfit.tsx';
const music = (id: string) => ({ id, title: id, streamUrl: `https://audio.example.test/${id}` });

class BrowserAudio {
  static instances: BrowserAudio[] = [];
  static blockNext = false;
  loop = false;
  muted = false;
  volume = 1;
  currentTime = 0;
  onended = null;
  listeners = new Map<string, () => void>();
  play = vi.fn(() => {
    if (BrowserAudio.blockNext) {
      BrowserAudio.blockNext = false;
      return Promise.reject(new Error('NotAllowedError: user activation required'));
    }
    this.listeners.get('playing')?.();
    return Promise.resolve();
  });
  pause = vi.fn(() => { this.listeners.get('pause')?.(); });
  removeAttribute = vi.fn();
  load = vi.fn();
  addEventListener = vi.fn((event: string, fn: () => void) => { this.listeners.set(event, fn); });
  removeEventListener = vi.fn((event: string) => { this.listeners.delete(event); });
  constructor(public src: string) { BrowserAudio.instances.push(this); }
}

function nativeSound() {
  return {
    playAsync: vi.fn().mockResolvedValue(undefined),
    stopAsync: vi.fn().mockResolvedValue(undefined),
    unloadAsync: vi.fn().mockResolvedValue(undefined),
    setIsMutedAsync: vi.fn().mockResolvedValue(undefined),
    setOnPlaybackStatusUpdate: vi.fn(),
  };
}

function videoHarness(platform = 'web', createAsync = vi.fn()) {
  const shared = {
    webAudioRef: { current: null as BrowserAudio | null },
    nativeSoundRef: { current: null },
    playbackGenerationRef: { current: 0 }, lifecycleRef: { current: 0 },
    soundtrackMutedRef: { current: false },
    setSoundtrackStarted: vi.fn(), setSoundtrackMuted: vi.fn(),
    registerNativeSound: vi.fn(), unregisterNativeSound: vi.fn(),
    useCallback: (fn: unknown) => fn,
    Platform: { OS: platform }, window: { Audio: BrowserAudio },
    Audio: { Sound: { createAsync } }, onClose: vi.fn(),
  };
  let cleanup: (() => void) | undefined;
  let env: Record<string, any>;
  return {
    shared,
    open(id: string, embedded = false, withMusic = true) {
      cleanup?.();
      env = {
        ...shared, post: { id, music: withMusic ? { ...music(id), embedded } : null },
        hasExternalSoundtrack: withMusic && !embedded, soundtrackStarted: false, soundtrackMuted: false,
      };
      for (const name of ['stopSoundtrack', 'startSoundtrack', 'toggleSoundtrack', 'handleClose']) {
        env[name] = evaluate(callable(videoPath, name), env);
      }
      cleanup = evaluate(effectCallback(videoPath, 'const lifecycleId'), env)();
    },
    tap: () => env.toggleSoundtrack(),
    close: () => env.handleClose(),
    unmount: () => cleanup?.(),
  };
}

function outfitHarness(platform = 'web', createAsync = vi.fn()) {
  const shared = {
    webAudioRef: { current: null as BrowserAudio | null },
    musicRef: { current: null }, audioGeneration: { current: 0 },
    setMusicPlaying: vi.fn(), setMusicMuted: vi.fn(), setMusicRetry: vi.fn(),
    registerNativeSound: vi.fn(), unregisterNativeSound: vi.fn(),
    useCallback: (fn: unknown) => fn,
    Platform: { OS: platform }, window: { Audio: BrowserAudio },
    prepareNativeOutfitAudio: vi.fn().mockResolvedValue({ Sound: { createAsync } }),
  };
  let cleanup: (() => void) | undefined;
  let env: Record<string, any>;
  return {
    shared,
    open(outfit: { music: ReturnType<typeof music> | null }, currentIdx = 0) {
      cleanup?.();
      env = { ...shared, outfit, currentIdx, musicRetry: 0, musicMuted: false, musicPlaying: false };
      cleanup = evaluate(focusCallback(outfitPath), env)();
    },
    tap: () => evaluate(pressCallback(outfitPath, 'if (!musicPlaying)'), env)(),
    leave: () => cleanup?.(),
  };
}

describe('browser autoplay recovery through the real viewer controls', () => {
  it('video Play music retries the blocked element synchronously within the tap', async () => {
    BrowserAudio.blockNext = true;
    const viewer = videoHarness();
    viewer.open('a');
    await flush();
    const audio = viewer.shared.webAudioRef.current!;
    expect(audio.play).toHaveBeenCalledOnce();
    expect(viewer.shared.setSoundtrackStarted).toHaveBeenLastCalledWith(false);
    const retry = viewer.tap();
    // Assert play was called BEFORE waiting: essential for user-gesture permission.
    expect(audio.play).toHaveBeenCalledTimes(2);
    await retry;
    expect(viewer.shared.setSoundtrackStarted).toHaveBeenLastCalledWith(true);
    viewer.unmount();
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
    expect(audio.load).toHaveBeenCalledOnce();
  });

  it('outfit Play music recovers blocked autoplay on the existing element', async () => {
    BrowserAudio.blockNext = true;
    const viewer = outfitHarness();
    viewer.open({ music: music('a') });
    await flush();
    const audio = viewer.shared.webAudioRef.current!;
    expect(viewer.shared.setMusicPlaying).toHaveBeenLastCalledWith(false);
    viewer.tap();
    expect(audio.play).toHaveBeenCalledTimes(2);
    await flush();
    expect(viewer.shared.setMusicPlaying).toHaveBeenLastCalledWith(true);
    viewer.leave();
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
    expect(audio.load).toHaveBeenCalledOnce();
  });

  it.each(['video', 'outfit'])('%s ignores a pending Play completion after close or blur', async kind => {
    BrowserAudio.blockNext = true;
    const pending = deferred<void>();
    if (kind === 'video') {
      const viewer = videoHarness();
      viewer.open('a');
      await flush();
      viewer.shared.webAudioRef.current!.play.mockImplementationOnce(() => pending.promise);
      const retry = viewer.tap();
      viewer.close();
      viewer.shared.setSoundtrackStarted.mockClear();
      pending.resolve();
      await retry;
      expect(viewer.shared.setSoundtrackStarted).not.toHaveBeenCalledWith(true);
    } else {
      const viewer = outfitHarness();
      viewer.open({ music: music('a') });
      await flush();
      viewer.shared.webAudioRef.current!.play.mockImplementationOnce(() => pending.promise);
      viewer.tap();
      viewer.leave();
      viewer.shared.setMusicPlaying.mockClear();
      pending.resolve();
      await flush();
      expect(viewer.shared.setMusicPlaying).not.toHaveBeenCalledWith(true);
    }
  });

  it('video content changes release the old stream; silent and embedded posts do not start a second track', async () => {
    const viewer = videoHarness();
    viewer.open('a');
    await flush();
    const first = viewer.shared.webAudioRef.current!;
    viewer.open('b');
    await flush();
    expect(first.pause).toHaveBeenCalled();
    expect(first.removeAttribute).toHaveBeenCalledWith('src');
    const second = viewer.shared.webAudioRef.current!;
    expect(second.src).toBe(music('b').streamUrl);
    viewer.open('embedded', true);
    await flush();
    expect(second.load).toHaveBeenCalled();
    expect(viewer.shared.webAudioRef.current).toBeNull();
    viewer.open('silent', false, false);
    await flush();
    expect(viewer.shared.webAudioRef.current).toBeNull();
    viewer.unmount();
  });
});

describe('native playback ownership and delayed loading', () => {
  it.each(['video', 'outfit'])('%s stops and unloads music when content changes and on close', async kind => {
    const first = nativeSound(), second = nativeSound();
    const create = vi.fn().mockResolvedValueOnce({ sound: first }).mockResolvedValueOnce({ sound: second });
    if (kind === 'video') {
      const viewer = videoHarness('android', create);
      viewer.open('a');
      await flush();
      viewer.open('b');
      await flush();
      expect(first.stopAsync).toHaveBeenCalled();
      expect(first.unloadAsync).toHaveBeenCalled();
      expect(second.playAsync).toHaveBeenCalledOnce();
      viewer.close();
      await flush();
      expect(second.stopAsync).toHaveBeenCalled();
      expect(second.unloadAsync).toHaveBeenCalled();
    } else {
      const viewer = outfitHarness('android', create);
      viewer.open({ music: music('a') });
      await flush();
      viewer.open({ music: music('b') }, 1);
      await flush();
      expect(first.stopAsync).toHaveBeenCalled();
      expect(first.unloadAsync).toHaveBeenCalled();
      expect(second.playAsync).toHaveBeenCalledOnce();
      viewer.leave();
      await flush();
      expect(second.stopAsync).toHaveBeenCalled();
      expect(second.unloadAsync).toHaveBeenCalled();
    }
  });

  it('a video track finishing creation after another post opens cannot replace the current player', async () => {
    const delayed = deferred<{ sound: ReturnType<typeof nativeSound> }>();
    const stale = nativeSound(), current = nativeSound();
    const create = vi.fn().mockReturnValueOnce(delayed.promise).mockResolvedValueOnce({ sound: current });
    const viewer = videoHarness('android', create);
    viewer.open('a');
    await flush();
    viewer.open('b');
    await flush();
    delayed.resolve({ sound: stale });
    await flush();
    expect(stale.playAsync).not.toHaveBeenCalled();
    expect(stale.unloadAsync).toHaveBeenCalled();
    expect(viewer.shared.nativeSoundRef.current).toBe(current);
    viewer.close();
    await flush();
    expect(current.unloadAsync).toHaveBeenCalled();
  });

  it('a video closed before native creation finishes never plays', async () => {
    const delayed = deferred<{ sound: ReturnType<typeof nativeSound> }>();
    const sound = nativeSound();
    const viewer = videoHarness('android', vi.fn().mockReturnValue(delayed.promise));
    viewer.open('a');
    await flush();
    viewer.close();
    delayed.resolve({ sound });
    await flush();
    expect(sound.playAsync).not.toHaveBeenCalled();
    expect(sound.unloadAsync).toHaveBeenCalled();
  });
});

describe('public-profile outfit soundtrack paging', () => {
  it('preserves distinct tracks and no-music outfits from navigation through page changes', async () => {
    const outfits = [
      { id: 'a', name: 'First', music: music('a') },
      { id: 'b', name: 'Second', music: music('b') },
      { id: 'c', name: 'Silent', music: null },
    ];
    const push = vi.fn();
    const open = evaluate(callable('app/user/[userId].tsx', 'openOutfitAt'), {
      profile: { userId: 'author', name: 'Author', traits: [] },
      outfitList: outfits, isSelf: false, router: { push },
      Haptics: { impactAsync: vi.fn(), ImpactFeedbackStyle: { Light: 'light' } },
    });
    open(1);
    const params = push.mock.calls[0][0].params;
    expect(params.initialIndex).toBe('1');
    expect(JSON.parse(params.outfitMusic)).toEqual(music('b'));
    const pages = evaluate<any[]>(callable(outfitPath, 'allOutfits'), { params });
    expect(pages.map(p => p.music)).toEqual(outfits.map(p => p.music));
    const viewer = outfitHarness();
    viewer.open(pages[1], 1);
    await flush();
    const second = viewer.shared.webAudioRef.current!;
    expect(second.src).toBe(music('b').streamUrl);
    viewer.open(pages[0], 0);
    await flush();
    expect(second.load).toHaveBeenCalled();
    const first = viewer.shared.webAudioRef.current!;
    expect(first.src).toBe(music('a').streamUrl);
    viewer.open(pages[2], 2);
    await flush();
    expect(first.load).toHaveBeenCalled();
    expect(viewer.shared.webAudioRef.current).toBeNull();
    viewer.leave();
  });
});
