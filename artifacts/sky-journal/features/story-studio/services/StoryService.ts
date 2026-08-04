/**
 * StoryService — Story Studio's API wrapper
 *
 * All story-related API calls that originate from within the Story Studio
 * module go through here. Wraps the shared `apiFetch` client so that
 * Story Studio screens never call apiFetch directly — they call this service.
 *
 * Shared infrastructure (apiFetch, auth token injection) is NOT duplicated;
 * this is a thin wrapper that encapsulates endpoint paths and response shapes.
 */
import { apiFetch } from '@/context/AppContext';

// ── Response shapes ────────────────────────────────────────────────────────────

export interface WitnessResult {
  witnessedCount: number;
  reward?: {
    type: string;
    message: string;
    milestone?: number;
  };
}

export interface ResonateResult {
  resonatedCount: number;
}

export interface SaveResult {
  savedCount: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const StoryService = {
  /**
   * Record a witness (read) on a story. Returns the new witness count and
   * any milestone reward the author earned.
   */
  witness(storyId: string): Promise<WitnessResult> {
    return apiFetch<WitnessResult>(`/stories/${storyId}/witness`, { method: 'POST' });
  },

  /**
   * Resonate with (like) a story.
   */
  resonate(storyId: string): Promise<ResonateResult> {
    return apiFetch<ResonateResult>(`/stories/${storyId}/resonate`, { method: 'POST' });
  },

  /**
   * Bookmark a story.
   */
  save(storyId: string): Promise<SaveResult> {
    return apiFetch<SaveResult>(`/stories/${storyId}/save`, { method: 'POST' });
  },

  /**
   * Remove a bookmark from a story.
   */
  unsave(storyId: string): Promise<void> {
    return apiFetch<void>(`/stories/${storyId}/save`, { method: 'DELETE' });
  },

  /**
   * Fetch a single story by ID (public endpoint — works for both own stories
   * and discover posts).
   */
  getById(storyId: string): Promise<unknown> {
    return apiFetch(`/stories/${storyId}`);
  },
} as const;
