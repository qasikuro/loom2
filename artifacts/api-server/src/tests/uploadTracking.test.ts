import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimUpload,
  registerPendingUpload,
  startOrphanCleanup,
} from "../lib/uploadTracking";

describe("pending upload lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not delete a composed video after the story claims both outputs", async () => {
    vi.useFakeTimers();
    const remove = vi.fn().mockResolvedValue(undefined);
    const now = new Date("2026-01-01T00:00:00Z");
    vi.setSystemTime(now);

    registerPendingUpload("/api/videos/final.mp4", "videos/final.mp4");
    registerPendingUpload("/api/images/final.jpg", "images/final.jpg");
    claimUpload("/api/videos/final.mp4");
    claimUpload("/api/images/final.jpg");

    startOrphanCleanup(remove);
    vi.setSystemTime(new Date(now.getTime() + 25 * 60 * 60_000));
    await vi.advanceTimersByTimeAsync(60 * 60_000);

    expect(remove).not.toHaveBeenCalled();
  });

  it("leaves failed/cancelled outputs eligible for orphan cleanup", async () => {
    vi.useFakeTimers();
    const remove = vi.fn().mockResolvedValue(undefined);
    const now = new Date("2026-01-01T00:00:00Z");
    vi.setSystemTime(now);

    registerPendingUpload("/api/videos/abandoned.mp4", "videos/abandoned.mp4");
    startOrphanCleanup(remove);
    vi.setSystemTime(new Date(now.getTime() + 25 * 60 * 60_000));
    await vi.advanceTimersByTimeAsync(60 * 60_000);

    expect(remove).toHaveBeenCalledWith("videos/abandoned.mp4");
  });
});