import * as FileSystem from 'expo-file-system/legacy';
import { calculateMusicSegment } from '@/utils/videoEditing';
import type { ComposeVideoOptions } from '@/utils/composeVideo';

type NativeVideoTrim = typeof import('react-native-video-trim');

const NATIVE_UPLOAD_TARGET_BYTES = 20 * 1024 * 1024;
const NATIVE_UPLOAD_BITRATE_ATTEMPTS = [1, 0.75, 0.55] as const;
const NATIVE_DURATION_TOLERANCE_SECONDS = 0.1;

export type NativePreparedVideo = {
  uri: string;
  durationSeconds: number;
  cleanup: () => Promise<void>;
};

export function shouldPrepareNativeVideo(
  platformOS: string,
  appOwnership: string | null,
  executionEnvironment: string,
): boolean {
  return platformOS !== 'web' &&
    appOwnership !== 'expo' &&
    executionEnvironment !== 'storeClient';
}

function toFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  return `file://${path.startsWith('/') ? '' : '/'}${path}`;
}

async function compressPreparedVideo(
  media: NativeVideoTrim,
  videoPath: string,
  durationSeconds: number,
  outputs: string[],
  isCancelled: () => boolean,
): Promise<{ outputPath: string; durationSeconds: number } | null> {
  const sourceInfo = await FileSystem.getInfoAsync(toFileUri(videoPath));
  if (!sourceInfo.exists || sourceInfo.size <= NATIVE_UPLOAD_TARGET_BYTES) {
    return sourceInfo.exists ? { outputPath: videoPath, durationSeconds } : null;
  }

  const targetTotalBitrate = (NATIVE_UPLOAD_TARGET_BYTES * 0.95 * 8) / durationSeconds;
  const audioBitrate = 160_000;
  const targetVideoBitrate = Math.max(350_000, targetTotalBitrate - audioBitrate);

  for (const bitrateScale of NATIVE_UPLOAD_BITRATE_ATTEMPTS) {
    if (isCancelled()) return null;
    const compressed = await media.compress(videoPath, {
      bitrate: Math.floor(targetVideoBitrate * bitrateScale),
      outputExt: 'mp4',
      removeAudio: false,
    });
    if (!compressed.outputPath) return null;
    outputs.push(compressed.outputPath);

    const compressedUri = toFileUri(compressed.outputPath);
    const validation = await media.isValidFile(compressedUri);
    if (
      !validation.isValid ||
      validation.fileType !== 'video' ||
      validation.duration <= 0 ||
      Math.abs(validation.duration / 1000 - durationSeconds) > NATIVE_DURATION_TOLERANCE_SECONDS ||
      isCancelled()
    ) {
      return null;
    }

    const compressedInfo = await FileSystem.getInfoAsync(compressedUri);
    if (!compressedInfo.exists) return null;
    if (compressedInfo.size <= NATIVE_UPLOAD_TARGET_BYTES) {
      return {
        outputPath: compressed.outputPath,
        durationSeconds: validation.duration / 1000,
      };
    }
  }

  return null;
}

/**
 * Export the selected segment locally for custom native builds.
 * Expo Go must use the existing server-side composition endpoint.
 */
export async function prepareNativeVideo(
  options: ComposeVideoOptions,
  isCancelled: () => boolean,
): Promise<NativePreparedVideo | null> {
  if (FileSystem.cacheDirectory == null) return null;

  let media: NativeVideoTrim;
  try {
    media = await import('react-native-video-trim');
  } catch {
    // This native module is absent from Expo Go and may also be unavailable in
    // older installed builds. Keep those builds on the server-authoritative path.
    return null;
  }

  const outputs: string[] = [];
  const temporaryUris: string[] = [];
  const cleanup = async () => {
    await Promise.all([
      ...outputs.map(path => Promise.resolve().then(() => media.deleteFile(path)).catch(() => false)),
      ...temporaryUris.map(uri => Promise.resolve()
        .then(() => FileSystem.deleteAsync(uri, { idempotent: true }))
        .catch(() => null)),
    ]);
  };

  try {
    if (isCancelled()) return null;
    const trim = await media.trim(options.videoUri, {
      startTime: Math.round(options.videoStartSeconds * 1000),
      endTime: Math.round((options.videoStartSeconds + options.videoDurationSeconds) * 1000),
      enablePreciseTrimming: true,
      type: 'video',
      outputExt: 'mp4',
      removeAudio: !options.music && (options.originalVolume ?? 1) === 0,
    });
    outputs.push(trim.outputPath);
    if (!trim.success || !trim.outputPath || trim.duration <= 0 || isCancelled()) {
      await cleanup();
      return null;
    }

    let outputPath = trim.outputPath;
    let durationSeconds = trim.duration / 1000;
    if (options.music) {
      const cacheDirectory = FileSystem.cacheDirectory;
      if (!cacheDirectory) {
        await cleanup();
        return null;
      }
      const downloadedMusicUri = `${cacheDirectory}storigam-music-${Date.now()}-${Math.random().toString(36).slice(2)}.source`;
      temporaryUris.push(downloadedMusicUri);
      const download = await FileSystem.downloadAsync(options.music.streamUrl, downloadedMusicUri);
      if (download.status < 200 || download.status >= 300 || isCancelled()) {
        await cleanup();
        return null;
      }

      const segment = calculateMusicSegment(
        options.videoDurationSeconds,
        options.music.duration,
        options.musicStartSeconds ?? 0,
      );
      if (segment.durationSeconds <= 0) {
        await cleanup();
        return null;
      }
      const musicTrim = await media.trim(download.uri, {
        startTime: Math.round(segment.startSeconds * 1000),
        endTime: Math.round(segment.endsAtSeconds * 1000),
        type: 'audio',
        outputExt: 'm4a',
      });
      outputs.push(musicTrim.outputPath);
      if (!musicTrim.success || !musicTrim.outputPath || isCancelled()) {
        await cleanup();
        return null;
      }

      const mixed = await media.mixAudio(outputPath, musicTrim.outputPath, {
        originalAudioVolume: options.originalVolume ?? 1,
        backgroundAudioVolume: options.musicVolume ?? 1,
        loopAudio: false,
        outputExt: 'mp4',
      });
      outputs.push(mixed.outputPath);
      if (
        !mixed.outputPath ||
        mixed.duration <= 0 ||
        mixed.duration < trim.duration - 100 ||
        isCancelled()
      ) {
        await cleanup();
        return null;
      }
      outputPath = mixed.outputPath;
      durationSeconds = mixed.duration / 1000;
    } else if ((options.originalVolume ?? 1) > 0 && (options.originalVolume ?? 1) < 1) {
      const audio = await media.extractAudio(outputPath, { outputExt: 'm4a' });
      outputs.push(audio.outputPath);
      if (!audio.outputPath || isCancelled()) {
        await cleanup();
        return null;
      }
      const mixed = await media.mixAudio(outputPath, audio.outputPath, {
        originalAudioVolume: options.originalVolume ?? 1,
        backgroundAudioVolume: 0,
        loopAudio: false,
        outputExt: 'mp4',
      });
      outputs.push(mixed.outputPath);
      if (
        !mixed.outputPath ||
        mixed.duration <= 0 ||
        mixed.duration < trim.duration - 100 ||
        isCancelled()
      ) {
        await cleanup();
        return null;
      }
      outputPath = mixed.outputPath;
      durationSeconds = mixed.duration / 1000;
    }

    const compressed = await compressPreparedVideo(
      media,
      outputPath,
      durationSeconds,
      outputs,
      isCancelled,
    );
    if (!compressed) {
      await cleanup();
      return null;
    }
    outputPath = compressed.outputPath;
    durationSeconds = compressed.durationSeconds;

    if (isCancelled()) {
      await cleanup();
      return null;
    }

    const retainedOutput = outputPath;
    const retainedDuration = durationSeconds;
    return {
      uri: toFileUri(retainedOutput),
      durationSeconds: retainedDuration,
      cleanup: async () => {
        await cleanup();
      },
    };
  } catch {
    await cleanup();
    return null;
  }
}
