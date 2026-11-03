import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platformOS: 'android',
  appOwnership: null as string | null,
  executionEnvironment: 'bare',
  prepareNativeVideo: vi.fn(),
  createUploadTask: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => ({
  UploadType: { MULTIPART: 1 },
  FileSystemUploadType: { MULTIPART: 1 },
  createUploadTask: mocks.createUploadTask,
}));

vi.mock('react-native', () => ({
  Platform: { get OS() { return mocks.platformOS; } },
}));

vi.mock('expo-constants', () => ({
  default: {
    get appOwnership() { return mocks.appOwnership; },
    get executionEnvironment() { return mocks.executionEnvironment; },
  },
}));

vi.mock('@/context/AppContext', () => ({
  getAuthToken: vi.fn().mockResolvedValue('auth-token'),
}));

vi.mock('@/utils/apiBase', () => ({
  getApiBase: () => 'https://api.example.test/api',
}));

vi.mock('@/utils/persistImage', () => ({
  ImageUploadError: class ImageUploadError extends Error {},
}));

vi.mock('@/utils/nativeVideoComposition', () => ({
  shouldPrepareNativeVideo: (platformOS: string, owner: string | null, environment: string) =>
    platformOS !== 'web' && owner !== 'expo' && environment !== 'storeClient',
  prepareNativeVideo: mocks.prepareNativeVideo,
}));

import { composeVideo } from '../composeVideo';

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

function successfulUpload() {
  mocks.createUploadTask.mockReturnValue({
    uploadAsync: vi.fn().mockResolvedValue({
      status: 201,
      body: JSON.stringify({
        compositionId: 'composition-1',
        path: '/api/videos/final.mp4',
        duration: 19.8,
      }),
    }),
    cancelAsync: vi.fn().mockResolvedValue(undefined),
  });
}

describe('composeVideo upload contract', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.platformOS = 'android';
    mocks.appOwnership = null;
    mocks.executionEnvironment = 'bare';
  });

  it('uploads the local export and resets composition fields after native preparation', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    mocks.prepareNativeVideo.mockResolvedValue({
      uri: 'file:///cache/prepared.mp4',
      durationSeconds: 19.8,
      cleanup,
    });
    successfulUpload();

    const controller = composeVideo({
      videoUri: 'file:///videos/original.mov',
      mimeType: 'video/quicktime',
      videoStartSeconds: 4,
      videoDurationSeconds: 20,
      music,
      musicStartSeconds: 10,
      originalVolume: 0.3,
      musicVolume: 0.8,
    });
    await expect(controller.promise).resolves.toMatchObject({ compositionId: 'composition-1' });

    expect(mocks.createUploadTask).toHaveBeenCalledWith(
      'https://api.example.test/api/media/compose-video',
      'file:///cache/prepared.mp4',
      expect.objectContaining({
        mimeType: 'video/mp4',
        parameters: expect.objectContaining({
          videoStartSeconds: '0',
          videoDurationSeconds: '19.8',
          music: '',
          originalVolume: '1',
          musicVolume: '1',
        }),
      }),
      expect.any(Function),
    );
    expect(mocks.createUploadTask.mock.calls[0][1]).not.toBe('file:///videos/original.mov');
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('keeps the original server composition fields in Expo Go', async () => {
    mocks.appOwnership = 'expo';
    mocks.executionEnvironment = 'storeClient';
    successfulUpload();

    const controller = composeVideo({
      videoUri: 'file:///videos/original.mov',
      mimeType: 'video/quicktime',
      videoStartSeconds: 4,
      videoDurationSeconds: 20,
      music,
      musicStartSeconds: 10,
      originalVolume: 0.3,
      musicVolume: 0.8,
    });
    await expect(controller.promise).resolves.toMatchObject({ compositionId: 'composition-1' });

    expect(mocks.prepareNativeVideo).not.toHaveBeenCalled();
    expect(mocks.createUploadTask.mock.calls[0][1]).toBe('file:///videos/original.mov');
    expect(mocks.createUploadTask.mock.calls[0][2].parameters).toMatchObject({
      videoStartSeconds: '4',
      videoDurationSeconds: '20',
      music: JSON.stringify(music),
      musicStartSeconds: '10',
      originalVolume: '0.3',
      musicVolume: '0.8',
    });
  });

  it('keeps server composition when native preparation cannot meet the upload target', async () => {
    mocks.prepareNativeVideo.mockResolvedValue(null);
    successfulUpload();

    const controller = composeVideo({
      videoUri: 'file:///videos/original.mov',
      mimeType: 'video/quicktime',
      videoStartSeconds: 4,
      videoDurationSeconds: 20,
      music,
      musicStartSeconds: 10,
      originalVolume: 0.3,
      musicVolume: 0.8,
    });
    await expect(controller.promise).resolves.toMatchObject({ compositionId: 'composition-1' });

    expect(mocks.createUploadTask.mock.calls[0][1]).toBe('file:///videos/original.mov');
    expect(mocks.createUploadTask.mock.calls[0][2].parameters).toMatchObject({
      videoStartSeconds: '4',
      videoDurationSeconds: '20',
      music: JSON.stringify(music),
      musicStartSeconds: '10',
      originalVolume: '0.3',
      musicVolume: '0.8',
    });
  });
});
