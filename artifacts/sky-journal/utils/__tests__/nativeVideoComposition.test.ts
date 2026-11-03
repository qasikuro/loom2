import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  trim: vi.fn(),
  mixAudio: vi.fn(),
  extractAudio: vi.fn(),
  compress: vi.fn(),
  isValidFile: vi.fn(),
  deleteFile: vi.fn().mockResolvedValue(true),
  downloadAsync: vi.fn(),
  deleteAsync: vi.fn().mockResolvedValue(undefined),
  getInfoAsync: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  downloadAsync: mocks.downloadAsync,
  deleteAsync: mocks.deleteAsync,
  getInfoAsync: mocks.getInfoAsync,
}));

vi.mock('react-native-video-trim', () => ({
  trim: mocks.trim,
  mixAudio: mocks.mixAudio,
  extractAudio: mocks.extractAudio,
  compress: mocks.compress,
  isValidFile: mocks.isValidFile,
  deleteFile: mocks.deleteFile,
}));

import { prepareNativeVideo, shouldPrepareNativeVideo } from '../nativeVideoComposition';

const music = {
  id: 'track-1',
  title: 'Night Sky',
  artist: 'Storigam',
  artworkUrl: null,
  duration: 120,
  genre: 'Ambient',
  mood: 'Dreamy',
  streamUrl: 'https://audio.example.test/track-1',
};

function options(overrides: Record<string, unknown> = {}) {
  return {
    videoUri: 'file:///videos/source.mov',
    mimeType: 'video/quicktime',
    videoStartSeconds: 3,
    videoDurationSeconds: 20,
    music,
    musicStartSeconds: 5,
    originalVolume: 0.25,
    musicVolume: 0.7,
    ...overrides,
  };
}

describe('native video composition', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.compress.mockReset();
    mocks.mixAudio.mockReset();
    mocks.extractAudio.mockReset();
    mocks.deleteFile.mockResolvedValue(true);
    mocks.deleteAsync.mockResolvedValue(undefined);
    mocks.getInfoAsync.mockResolvedValue({ exists: true, size: 1024 });
    mocks.isValidFile.mockResolvedValue({ isValid: true, fileType: 'video', duration: 20_000 });
  });

  it('uses server composition in Expo Go and on web, but enables native builds', () => {
    expect(shouldPrepareNativeVideo('ios', 'expo', 'storeClient')).toBe(false);
    expect(shouldPrepareNativeVideo('android', null, 'storeClient')).toBe(false);
    expect(shouldPrepareNativeVideo('web', null, 'bare')).toBe(false);
    expect(shouldPrepareNativeVideo('ios', null, 'bare')).toBe(true);
    expect(shouldPrepareNativeVideo('android', 'standalone', 'standalone')).toBe(true);
  });

  it('trims locally, downloads and trims the selected music segment, then mixes volumes', async () => {
    mocks.trim
      .mockResolvedValueOnce({ success: true, outputPath: '/cache/trimmed.mp4', duration: 20_000 })
      .mockResolvedValueOnce({ success: true, outputPath: '/cache/music.m4a', duration: 20_000 });
    mocks.downloadAsync.mockResolvedValue({
      status: 200,
      uri: 'file:///cache/storigam-music.source',
    });
    mocks.mixAudio.mockResolvedValue({
      outputPath: '/cache/mixed.mp4',
      duration: 20_000,
    });

    const result = await prepareNativeVideo(options(), () => false);
    expect(result).toMatchObject({
      uri: 'file:///cache/mixed.mp4',
      durationSeconds: 20,
    });
    expect(mocks.trim).toHaveBeenNthCalledWith(1, 'file:///videos/source.mov', {
      startTime: 3_000,
      endTime: 23_000,
      enablePreciseTrimming: true,
      type: 'video',
      outputExt: 'mp4',
      removeAudio: false,
    });
    expect(mocks.downloadAsync).toHaveBeenCalledWith(
      music.streamUrl,
      expect.stringMatching(/^file:\/\/\/cache\/storigam-music-/),
    );
    expect(mocks.trim).toHaveBeenNthCalledWith(2, 'file:///cache/storigam-music.source', {
      startTime: 5_000,
      endTime: 25_000,
      type: 'audio',
      outputExt: 'm4a',
    });
    expect(mocks.mixAudio).toHaveBeenCalledWith('/cache/trimmed.mp4', '/cache/music.m4a', {
      originalAudioVolume: 0.25,
      backgroundAudioVolume: 0.7,
      loopAudio: false,
      outputExt: 'mp4',
    });

    await result?.cleanup();
    expect(mocks.deleteFile).toHaveBeenCalledWith('/cache/trimmed.mp4');
    expect(mocks.deleteFile).toHaveBeenCalledWith('/cache/music.m4a');
    expect(mocks.deleteFile).toHaveBeenCalledWith('/cache/mixed.mp4');
    expect(mocks.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/cache\/storigam-music-/),
      { idempotent: true },
    );
  });

  it('compresses a large mixed clip without changing its duration or audio', async () => {
    mocks.trim
      .mockResolvedValueOnce({ success: true, outputPath: '/cache/trimmed.mp4', duration: 20_000 })
      .mockResolvedValueOnce({ success: true, outputPath: '/cache/music.m4a', duration: 20_000 });
    mocks.downloadAsync.mockResolvedValue({
      status: 200,
      uri: 'file:///cache/storigam-music.source',
    });
    mocks.mixAudio.mockResolvedValue({ outputPath: '/cache/mixed.mp4', duration: 20_000 });
    mocks.getInfoAsync
      .mockResolvedValueOnce({ exists: true, size: 30 * 1024 * 1024 })
      .mockResolvedValueOnce({ exists: true, size: 18 * 1024 * 1024 });
    mocks.compress.mockResolvedValue({ outputPath: '/cache/compressed.mp4' });

    const result = await prepareNativeVideo(options(), () => false);

    expect(result).toMatchObject({
      uri: 'file:///cache/compressed.mp4',
      durationSeconds: 20,
    });
    expect(mocks.compress).toHaveBeenCalledWith('/cache/mixed.mp4', {
      bitrate: expect.any(Number),
      outputExt: 'mp4',
      removeAudio: false,
    });
    expect(mocks.isValidFile).toHaveBeenCalledWith('file:///cache/compressed.mp4');
    expect(mocks.deleteFile).not.toHaveBeenCalledWith('/cache/compressed.mp4');

    await result?.cleanup();
    expect(mocks.deleteFile).toHaveBeenCalledWith('/cache/compressed.mp4');
  });

  it('falls back to server processing when native compression cannot meet the upload target', async () => {
    mocks.trim.mockResolvedValue({
      success: true,
      outputPath: '/cache/trimmed.mp4',
      duration: 20_000,
    });
    mocks.getInfoAsync
      .mockResolvedValueOnce({ exists: true, size: 30 * 1024 * 1024 })
      .mockResolvedValue({ exists: true, size: 22 * 1024 * 1024 });
    mocks.compress
      .mockResolvedValueOnce({ outputPath: '/cache/compressed-1.mp4' })
      .mockResolvedValueOnce({ outputPath: '/cache/compressed-2.mp4' })
      .mockResolvedValueOnce({ outputPath: '/cache/compressed-3.mp4' });

    await expect(
      prepareNativeVideo(options({ music: null, originalVolume: 1 }), () => false),
    ).resolves.toBeNull();
    expect(mocks.compress).toHaveBeenCalledTimes(3);
    expect(mocks.compress.mock.calls[0][1].bitrate)
      .toBeGreaterThan(mocks.compress.mock.calls[1][1].bitrate);
    expect(mocks.compress.mock.calls[1][1].bitrate)
      .toBeGreaterThan(mocks.compress.mock.calls[2][1].bitrate);
    expect(mocks.deleteFile).toHaveBeenCalledWith('/cache/compressed-1.mp4');
    expect(mocks.deleteFile).toHaveBeenCalledWith('/cache/compressed-2.mp4');
    expect(mocks.deleteFile).toHaveBeenCalledWith('/cache/compressed-3.mp4');
  });

  it('preserves original audio volume when no music is selected', async () => {
    mocks.trim.mockResolvedValue({
      success: true,
      outputPath: '/cache/trimmed.mp4',
      duration: 20_000,
    });
    mocks.extractAudio.mockResolvedValue({ outputPath: '/cache/original.m4a', duration: 20_000 });
    mocks.mixAudio.mockResolvedValue({ outputPath: '/cache/quiet.mp4', duration: 20_000 });

    const result = await prepareNativeVideo(
      options({ music: null, originalVolume: 0.4 }),
      () => false,
    );

    expect(mocks.extractAudio).toHaveBeenCalledWith('/cache/trimmed.mp4', { outputExt: 'm4a' });
    expect(mocks.mixAudio).toHaveBeenCalledWith('/cache/trimmed.mp4', '/cache/original.m4a', {
      originalAudioVolume: 0.4,
      backgroundAudioVolume: 0,
      loopAudio: false,
      outputExt: 'mp4',
    });
    expect(result?.uri).toBe('file:///cache/quiet.mp4');
  });

  it('falls back when native mixing shortens the selected video', async () => {
    mocks.trim
      .mockResolvedValueOnce({ success: true, outputPath: '/cache/trimmed.mp4', duration: 20_000 })
      .mockResolvedValueOnce({ success: true, outputPath: '/cache/music.m4a', duration: 8_000 });
    mocks.downloadAsync.mockResolvedValue({
      status: 200,
      uri: 'file:///cache/storigam-music.source',
    });
    mocks.mixAudio.mockResolvedValue({ outputPath: '/cache/short.mp4', duration: 8_000 });

    await expect(prepareNativeVideo(options(), () => false)).resolves.toBeNull();
    expect(mocks.deleteFile).toHaveBeenCalledWith('/cache/short.mp4');
    expect(mocks.deleteAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/cache\/storigam-music-/),
      { idempotent: true },
    );
  });
});
