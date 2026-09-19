import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  composeVideo,
  probeMedia,
  validateCompositionWindow,
  VideoCompositionError,
} from "../services/videoCompositionService";

const execFileAsync = promisify(execFile);
let fixtureDir = "";
let toolsAvailable = true;

async function makeFixture(name: string, duration: number, audio: boolean): Promise<string> {
  const output = join(fixtureDir, name);
  const args = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `color=c=0x171329:s=320x180:r=5`,
  ];
  if (audio) args.push("-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000");
  args.push(
    "-t", String(duration),
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    ...(audio ? ["-c:a", "aac", "-shortest"] : ["-an"]),
    output,
  );
  await execFileAsync("ffmpeg", args);
  return output;
}

describe("video composition processor", () => {
  beforeAll(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), "sky-video-tests-"));
    try {
      await execFileAsync("ffmpeg", ["-version"]);
      await execFileAsync("ffprobe", ["-version"]);
    } catch {
      toolsAvailable = false;
    }
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it("validates the 60-second contract before processing", () => {
    expect(() => validateCompositionWindow(90, 0, 61)).toThrow(VideoCompositionError);
    expect(() => validateCompositionWindow(60, 1, 60)).toThrow(VideoCompositionError);
    expect(() => validateCompositionWindow(90, 65, 30)).toThrow(VideoCompositionError);
    expect(() => validateCompositionWindow(90, 65, 25)).not.toThrow();
  });

  it.skipIf(!toolsAvailable)("trims a 90-second source to 25 seconds", async () => {
    const source = await makeFixture("source-90.mp4", 90, false);
    const result = await composeVideo({
      sourcePath: source,
      videoStartSeconds: 20,
      videoDurationSeconds: 25,
      workDir: join(fixtureDir, "compose-90"),
    });
    expect(result.duration).toBeLessThanOrEqual(25.1);
    expect((await stat(result.outputPath)).size).toBeGreaterThan(0);
  }, 120_000);

  it.skipIf(!toolsAvailable)("trims a five-minute source to the 60-second maximum", async () => {
    const source = await makeFixture("source-300.mp4", 300, true);
    const result = await composeVideo({
      sourcePath: source,
      videoStartSeconds: 120,
      videoDurationSeconds: 60,
      workDir: join(fixtureDir, "compose-300"),
      originalVolume: 0.35,
    });
    expect(result.duration).toBeLessThanOrEqual(60.1);
    expect(result.fileSize).toBeLessThanOrEqual(25 * 1024 * 1024);
  }, 180_000);

  it.skipIf(!toolsAvailable)("uses a selected segment of long music and keeps video duration", async () => {
    const source = await makeFixture("source-40.mp4", 40, false);
    const music = await makeFixture("music-180.mp4", 180, true);
    const result = await composeVideo({
      sourcePath: source,
      videoStartSeconds: 0,
      videoDurationSeconds: 40,
      musicPath: music,
      musicStartSeconds: 90,
      musicVolume: 0.8,
      workDir: join(fixtureDir, "compose-long-music"),
    });
    expect(result.duration).toBeLessThanOrEqual(40.1);
    expect((await probeMedia(result.outputPath)).hasAudio).toBe(true);
  }, 120_000);

  it.skipIf(!toolsAvailable)("allows a short music track without looping or extending it", async () => {
    const source = await makeFixture("source-20.mp4", 20, false);
    const music = await makeFixture("music-10.mp4", 10, true);
    const result = await composeVideo({
      sourcePath: source,
      videoStartSeconds: 0,
      videoDurationSeconds: 20,
      musicPath: music,
      workDir: join(fixtureDir, "compose-short-music"),
    });
    expect(result.duration).toBeLessThanOrEqual(20.1);
    expect((await probeMedia(result.outputPath)).duration).toBeLessThanOrEqual(20.1);
  }, 120_000);

  it.skipIf(!toolsAvailable)("mixes original audio and music and supports an exact 60-second selection", async () => {
    const source = await makeFixture("source-audio-90.mp4", 90, true);
    const music = await makeFixture("music-audio-90.mp4", 90, true);
    const result = await composeVideo({
      sourcePath: source,
      videoStartSeconds: 10,
      videoDurationSeconds: 60,
      musicPath: music,
      musicStartSeconds: 5,
      originalVolume: 0.2,
      musicVolume: 0.7,
      workDir: join(fixtureDir, "compose-mixed"),
    });
    expect(result.duration).toBeLessThanOrEqual(60.1);
    expect(result.width).toBeLessThanOrEqual(1080);
    expect(result.height).toBeLessThanOrEqual(1920);
    expect((await probeMedia(result.outputPath)).hasAudio).toBe(true);
  }, 180_000);
});