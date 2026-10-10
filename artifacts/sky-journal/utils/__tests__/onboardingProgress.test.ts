import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyOnboardingProgress, loadOnboardingProgress, reconcileOnboardingProgress } from '../onboardingProgress';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(AsyncStorage.getItem).mockReset().mockResolvedValue(null);
  vi.mocked(AsyncStorage.setItem).mockReset().mockResolvedValue();
});

describe('setup progress from existing profile and creations', () => {
  it('counts outfits already present before onboarding, not just additions beyond the baseline', () => {
    const next = reconcileOnboardingProgress(emptyOnboardingProgress(0, 3), null, 0, 3);
    expect(next.completed).toEqual([3]);
  });

  it('counts a valid username saved through the profile', () => {
    expect(reconcileOnboardingProgress(emptyOnboardingProgress(), 'sky_user', 0, 0).completed).toEqual([1]);
    expect(reconcileOnboardingProgress(emptyOnboardingProgress(), '', 0, 0).completed).toEqual([]);
  });

  it('counts stories and outfits in any order and clears their skipped flags', () => {
    const saved = { ...emptyOnboardingProgress(2, 3), skipped: [2, 3] as const };
    const next = reconcileOnboardingProgress({ ...saved, skipped: [...saved.skipped] }, null, 2, 3);
    expect(next.completed).toEqual([2, 3]);
    expect(next.skipped).toEqual([]);
  });

  it('completes the summary automatically when all real tasks are done', () => {
    const next = reconcileOnboardingProgress(emptyOnboardingProgress(), 'sky_user', 1, 1);
    expect(next.completed).toEqual([1, 2, 3, 4]);
    expect(next.currentStep).toBe(4);
  });

  it('does not count skipped tasks or erase previously earned milestones after deletion', () => {
    const saved = { ...emptyOnboardingProgress(), completed: [2, 2] as const, skipped: [1, 3] as const };
    const next = reconcileOnboardingProgress({ ...saved, completed: [...saved.completed], skipped: [...saved.skipped] }, null, 0, 0);
    expect(next.completed).toEqual([2]);
    expect(next.skipped).toEqual([1, 3]);
  });

  it('reconciles and persists existing accounts under the correct user key', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(emptyOnboardingProgress(2, 3)));
    const next = await loadOnboardingProgress('user-a', 2, 3, 'sky_user');
    expect(next.completed).toEqual([1, 2, 3, 4]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('action_onboarding_v1:user-a', JSON.stringify(next));
  });

  it('reconstructs progress on a new device and tolerates failed storage reads', async () => {
    expect((await loadOnboardingProgress('user-b', 0, 3)).completed).toEqual([3]);
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('unavailable'));
    expect((await loadOnboardingProgress('user-c', 1, 0, 'sky_user')).completed).toEqual([1, 2]);
  });
});
