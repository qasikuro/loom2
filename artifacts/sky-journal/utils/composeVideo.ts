import * as FileSystem from 'expo-file-system/legacy';
import { getApiBase } from '@/utils/apiBase';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAuthToken } from '@/context/AppContext';
import type { StoryMusic } from '@/context/mappers';
import { ImageUploadError } from '@/utils/persistImage';
import { isAbortError } from '@/utils/isAbortError';
import { prepareNativeVideo, shouldPrepareNativeVideo } from '@/utils/nativeVideoComposition';

export type ComposeVideoResult = {
  compositionId: string;
  path: string;
  thumbnailPath: string | null;
  duration: number;
  width: number;
  height: number;
  fileSize: number;
};

export type ComposeVideoOptions = {
  videoUri: string;
  mimeType?: string;
  fileName?: string | null;
  videoStartSeconds: number;
  videoDurationSeconds: number;
  music?: StoryMusic | null;
  musicStartSeconds?: number;
  originalVolume?: number;
  musicVolume?: number;
  onProgress?: (progress: number) => void;
};

export type ComposeVideoController = {
  promise: Promise<ComposeVideoResult>;
  cancel: () => void;
};

function resolveApiBase(): string {
  return getApiBase();
}

function normalizeResult(value: unknown): ComposeVideoResult {
  const result = (value ?? {}) as Partial<ComposeVideoResult>;
  if (!result.compositionId || !result.path || typeof result.duration !== 'number') {
    throw new ImageUploadError('The video processor returned an unexpected response. Please try again.');
  }
  return {
    compositionId: result.compositionId,
    path: result.path,
    thumbnailPath: result.thumbnailPath ?? null,
    duration: result.duration,
    width: result.width ?? 0,
    height: result.height ?? 0,
    fileSize: result.fileSize ?? 0,
  };
}

function fields(options: ComposeVideoOptions): Record<string, string> {
  return {
    videoStartSeconds: String(Math.max(0, options.videoStartSeconds)),
    videoDurationSeconds: String(Math.min(60, Math.max(0, options.videoDurationSeconds))),
    music: options.music ? JSON.stringify(options.music) : '',
    musicStartSeconds: String(Math.max(0, options.musicStartSeconds ?? 0)),
    originalVolume: String(Math.min(1, Math.max(0, options.originalVolume ?? 1))),
    musicVolume: String(Math.min(1, Math.max(0, options.musicVolume ?? 1))),
  };
}

function filename(options: ComposeVideoOptions): string {
  if (options.fileName) return options.fileName;
  if (options.mimeType === 'video/quicktime') return 'video.mov';
  if (options.mimeType === 'video/x-m4v') return 'video.m4v';
  return 'video.mp4';
}

export function composeVideo(options: ComposeVideoOptions): ComposeVideoController {
  const controller = new AbortController();
  let nativeTask: FileSystem.UploadTask | null = null;
  let cancelled = false;

  const promise = (async () => {
    const token = await getAuthToken();
    if (!token) throw new ImageUploadError('You need to be signed in to publish a video.');
    if (options.videoUri.startsWith('http://') || options.videoUri.startsWith('https://')) {
      throw new ImageUploadError('The selected video is no longer available. Please choose it again.');
    }

    const apiBase = resolveApiBase();
    const url = `${apiBase}/media/compose-video`;
    const prepared = shouldPrepareNativeVideo(
      Platform.OS,
      Constants.appOwnership,
      Constants.executionEnvironment,
    )
      ? await prepareNativeVideo(options, () => cancelled)
      : null;
    const uploadOptions: ComposeVideoOptions = prepared
      ? {
          ...options,
          videoUri: prepared.uri,
          mimeType: 'video/mp4',
          fileName: 'prepared-video.mp4',
          videoStartSeconds: 0,
          videoDurationSeconds: prepared.durationSeconds,
          music: null,
          musicStartSeconds: 0,
          originalVolume: 1,
          musicVolume: 1,
        }
      : options;
    const data = fields(uploadOptions);
    let response: Response | FileSystem.FileSystemUploadResult;

    try {
      if (cancelled) throw new ImageUploadError('Video processing was cancelled.');
      if (Platform.OS === 'web') {
        const source = await fetch(uploadOptions.videoUri, { signal: controller.signal });
        if (!source.ok) throw new ImageUploadError('Could not read the selected video. Please try again.');
        const blob = await source.blob();
        const form = new FormData();
        form.append('file', blob, filename(uploadOptions));
        Object.entries(data).forEach(([key, value]) => form.append(key, value));
        response = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
          signal: controller.signal,
        });
      } else {
        const taskOptions: FileSystem.FileSystemUploadOptions = {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: uploadOptions.mimeType ?? 'video/mp4',
          headers: { Authorization: `Bearer ${token}` },
          parameters: data,
        };
        nativeTask = FileSystem.createUploadTask(
          url,
          uploadOptions.videoUri,
          taskOptions,
          progress => {
            const total = progress.totalBytesExpectedToSend;
            options.onProgress?.(total > 0 ? progress.totalBytesSent / total : 0);
          },
        );
        const uploadResult = await nativeTask.uploadAsync();
        if (!uploadResult) throw new ImageUploadError('Video processing was cancelled.');
        response = uploadResult;
      }

      if (cancelled) throw new ImageUploadError('Video processing was cancelled.');
      const status = response.status;
      const body = await ('json' in response
        ? response.json()
        : Promise.resolve(JSON.parse(response.body || '{}')));
      if (status < 200 || status >= 300) {
        const message = (body as { error?: string })?.error;
        throw new ImageUploadError(message || `Video processing failed (${status}). Please try again.`);
      }
      options.onProgress?.(1);
      return normalizeResult(body);
    } finally {
      await prepared?.cleanup();
    }
  })().catch(error => {
    if (isAbortError(error)) {
      throw new ImageUploadError('Video processing was cancelled.');
    }
    if (error instanceof ImageUploadError) throw error;
    throw new ImageUploadError('Could not process this video. Please try again.', error);
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      controller.abort();
      nativeTask?.cancelAsync().catch(() => null);
    },
  };
}
