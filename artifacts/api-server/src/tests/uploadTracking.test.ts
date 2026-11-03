import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimUpload,
  discardPendingUpload,
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

    registerPendingUpload("/api/videos/final.mp4", "videos/final.mp4", "alice");
    registerPendingUpload("/api/images/final.jpg", "images/final.jpg", "alice");
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

    registerPendingUpload("/api/videos/abandoned.mp4", "videos/abandoned.mp4", "alice");
    startOrphanCleanup(remove);
    vi.setSystemTime(new Date(now.getTime() + 25 * 60 * 60_000));
    await vi.advanceTimersByTimeAsync(60 * 60_000);

    expect(remove).toHaveBeenCalledWith("videos/abandoned.mp4");
  });

  it("immediately discards only a still-pending upload owned by the requester", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    registerPendingUpload("/api/videos/cancelled.mp4", "videos/cancelled.mp4", "alice");

    expect(await discardPendingUpload("/api/videos/cancelled.mp4", "bob", remove)).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(await discardPendingUpload("/api/videos/cancelled.mp4", "alice", remove)).toBe(true);
    expect(remove).toHaveBeenCalledWith("videos/cancelled.mp4");
    expect(await discardPendingUpload("/api/videos/cancelled.mp4", "alice", remove)).toBe(false);
  });

  it("keeps a pending upload registered if immediate deletion fails", async () => {
    const remove = vi.fn().mockRejectedValue(new Error("storage unavailable"));
    registerPendingUpload("/api/videos/retry-delete.mp4", "videos/retry-delete.mp4", "alice");

    await expect(discardPendingUpload("/api/videos/retry-delete.mp4", "alice", remove)).rejects.toThrow("storage unavailable");
    expect(await discardPendingUpload("/api/videos/retry-delete.mp4", "alice", vi.fn().mockResolvedValue(undefined))).toBe(true);
  });
});