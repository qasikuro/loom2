import { execFile } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MAX_VIDEO_DURATION_SECONDS = 60;
export const MAX_OUTPUT_BYTES = 25 * 1024 * 1024;
const DURATION_TOLERANCE_SECONDS = 0.1;

export type MediaProbe = {
  duration: number;
  width: number;
  height: number;
  hasVideo: boolean;
  hasAudio: boolean;
  size: number;
  aspectRatio: number;
};

export type ComposeVideoInput = {
  sourcePath: string;
  videoStartSeconds: number;
  videoDurationSeconds: number;
  musicPath?: string;
  musicStartSeconds?: number;
  originalVolume?: number;
  musicVolume?: number;
  workDir: string;
  signal?: AbortSignal;
};

export type ComposeVideoResult = {
  outputPath: string;
  thumbnailPath: string;
  duration: number;
  width: number;
  height: number;
  fileSize: number;
};

type VideoCompositionErrorCode = "invalid" | "tool" | "output";

export class VideoCompositionError extends Error {
  readonly code: VideoCompositionErrorCode;
  constructor(message: string, code: VideoCompositionErrorCode = "invalid") {
    super(message);
    this.name = "VideoCompositionError";
    this.code = code;
  }
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateCompositionWindow(
  sourceDuration: number,
  start: number,
  duration: number,
): void {
  if (!finiteNumber(sourceDuration) || sourceDuration <= 0) {
    throw new VideoCompositionError("The source video duration could not be read.");
  }
  if (!finiteNumber(start) || start < 0) {
    throw new VideoCompositionError("Video start time must be zero or greater.");
  }
  if (!finiteNumber(duration) || duration <= 0 || duration > MAX_VIDEO_DURATION_SECONDS) {
    throw new VideoCompositionError("Selected video duration must be between 0 and 60 seconds.");
  }
  if (start + duration > sourceDuration + DURATION_TOLERANCE_SECONDS) {
    throw new VideoCompositionError("The selected video range exceeds the source video.");
  }
}

export function validateVolume(value: number | undefined, field: string): number {
  const normalized = value ?? 1;
  if (!finiteNumber(normalized) || normalized < 0 || normalized > 1) {
    throw new VideoCompositionError(`${field} must be between 0 and 1.`);
  }
  return normalized;
}

async function runTool(
  command: string,
  args: string[],
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> {
  if (signal?.aborted) throw new VideoCompositionError("Media processing was cancelled.", "tool");
  try {
    return await execFileAsync(command, args, {
      signal,
      timeout: 15 * 60 * 1000,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new VideoCompositionError("Media processing was cancelled.", "tool");
    }
    const detail = error instanceof Error ? error.message : "media tool failed";
    throw new VideoCompositionError(`Media processing failed: ${detail.slice(0, 500)}`, "tool");
  }
}

export async function probeMedia(filePath: string, signal?: AbortSignal): Promise<MediaProbe> {
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    throw new VideoCompositionError("Media file is unavailable.");
  }
  const { stdout } = await runTool("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-show_streams",
    "-of", "json",
    filePath,
  ], signal);
  let parsed: {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
  };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new VideoCompositionError("Media metadata could not be read.", "tool");
  }
  const streams = parsed.streams ?? [];
  const video = streams.find(stream => stream.codec_type === "video");
  const duration = Number(parsed.format?.duration);
  const width = Number(video?.width);
  const height = Number(video?.height);
  if (!video || !finiteNumber(duration) || duration <= 0 || !width || !height) {
    throw new VideoCompositionError("The file does not contain a readable video stream.");
  }
  return {
    duration,
    width,
    height,
    hasVideo: true,
    hasAudio: streams.some(stream => stream.codec_type === "audio"),
    size,
    aspectRatio: width / height,
  };
}

async function probeAudio(filePath: string, signal?: AbortSignal): Promise<{ duration: number; hasAudio: boolean }> {
  const { stdout } = await runTool("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type",
    "-of", "json",
    filePath,
  ], signal);
  try {
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string }>;
    };
    const duration = Number(parsed.format?.duration);
    return {
      duration,
      hasAudio: (parsed.streams ?? []).some(stream => stream.codec_type === "audio"),
    };
  } catch {
    throw new VideoCompositionError("Music metadata could not be read.", "tool");
  }
}

function scaleFilter(): string {
  return "scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2";
}

async function encode(
  input: ComposeVideoInput,
  probe: MediaProbe,
  outputPath: string,
  bitrate: string,
): Promise<void> {
  const duration = input.videoDurationSeconds;
  const start = input.videoStartSeconds;
  const originalVolume = validateVolume(input.originalVolume, "originalVolume");
  const musicVolume = validateVolume(input.musicVolume, "musicVolume");
  const args = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(start),
    "-i", input.sourcePath,
  ];
  if (input.musicPath) {
    args.push("-ss", String(input.musicStartSeconds ?? 0), "-i", input.musicPath);
  }

  const filters = [`[0:v:0]${scaleFilter()}[vout]`];
  if (input.musicPath) {
    const music = `[1:a:0]atrim=duration=${duration},asetpts=PTS-STARTPTS,volume=${musicVolume}[music]`;
    filters.push(music);
    if (probe.hasAudio) {
      filters.push(`[0:a:0]atrim=duration=${duration},asetpts=PTS-STARTPTS,volume=${originalVolume}[original]`);
      filters.push(`[original][music]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]`);
    } else {
      filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${duration}[silence]`);
      filters.push(`[silence][music]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]`);
    }
    args.push("-filter_complex", filters.join(";"), "-map", "[vout]", "-map", "[aout]");
  } else if (probe.hasAudio) {
    filters.push(`[0:a:0]atrim=duration=${duration},asetpts=PTS-STARTPTS,volume=${originalVolume}[aout]`);
    args.push("-filter_complex", filters.join(";"), "-map", "[vout]", "-map", "[aout]");
  } else {
    args.push("-vf", scaleFilter(), "-map", "0:v:0", "-an");
  }

  args.push(
    "-t", String(duration),
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-b:v", bitrate, "-maxrate", bitrate, "-bufsize", bitrate,
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    outputPath,
  );
  await runTool("ffmpeg", args, input.signal);
}

export async function composeVideo(input: ComposeVideoInput): Promise<ComposeVideoResult> {
  const probe = await probeMedia(input.sourcePath, input.signal);
  validateCompositionWindow(probe.duration, input.videoStartSeconds, input.videoDurationSeconds);
  if (input.musicStartSeconds !== undefined && (!finiteNumber(input.musicStartSeconds) || input.musicStartSeconds < 0)) {
    throw new VideoCompositionError("Music start time must be zero or greater.");
  }
  validateVolume(input.originalVolume, "originalVolume");
  validateVolume(input.musicVolume, "musicVolume");
  if (input.musicPath) {
    const musicProbe = await probeAudio(input.musicPath, input.signal);
    const musicStart = input.musicStartSeconds ?? 0;
    if (!musicProbe.hasAudio || musicStart >= musicProbe.duration) {
      throw new VideoCompositionError("The selected music segment is outside the available track.");
    }
  }
  await mkdir(input.workDir, { recursive: true });

  const outputPath = `${input.workDir}/final.mp4`;
  const thumbnailPath = `${input.workDir}/thumbnail.jpg`;
  // A bounded bitrate keeps the 25 MiB target achievable even for 60-second
  // 1080p sources. Retry at lower rates for unusually complex material.
  for (const bitrate of ["2.5M", "1.8M", "1.2M"]) {
    await rm(outputPath, { force: true });
    await encode(input, probe, outputPath, bitrate);
    const outputSize = (await stat(outputPath)).size;
    if (outputSize <= MAX_OUTPUT_BYTES) break;
    if (bitrate === "1.2M") {
      throw new VideoCompositionError("The processed video could not be compressed below 25 MB.", "output");
    }
  }

  await runTool("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", outputPath,
    "-frames:v", "1",
    "-vf", scaleFilter(),
    "-q:v", "3",
    thumbnailPath,
  ], input.signal);

  const finalProbe = await probeMedia(outputPath, input.signal);
  if (finalProbe.duration > input.videoDurationSeconds + DURATION_TOLERANCE_SECONDS) {
    throw new VideoCompositionError("The processed video exceeded the selected duration.", "output");
  }
  const outputSize = (await stat(outputPath)).size;
  return {
    outputPath,
    thumbnailPath,
    duration: Math.min(finalProbe.duration, input.videoDurationSeconds),
    width: finalProbe.width,
    height: finalProbe.height,
    fileSize: outputSize,
  };
}