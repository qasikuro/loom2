import AsyncStorage from '@react-native-async-storage/async-storage';

export type OnboardingStep = 1 | 2 | 3 | 4;

export interface OnboardingProgress {
  currentStep: OnboardingStep;
  completed: OnboardingStep[];
  skipped: OnboardingStep[];
  storyBaseline: number;
  outfitBaseline: number;
}

const key = (userId: string) => `action_onboarding_v1:${userId}`;

export const emptyOnboardingProgress = (
  storyBaseline = 0,
  outfitBaseline = 0,
): OnboardingProgress => ({
  currentStep: 1,
  completed: [],
  skipped: [],
  storyBaseline,
  outfitBaseline,
});

/** Setup milestones count regardless of which screen the user used. */
export function reconcileOnboardingProgress(
  progress: OnboardingProgress,
  username: string | null | undefined,
  storyCount: number,
  outfitCount: number,
): OnboardingProgress {
  const completed = new Set(progress.completed);
  if (/^[a-z0-9_]{3,20}$/.test(username?.trim().toLowerCase() ?? '')) completed.add(1);
  if (storyCount > 0) completed.add(2);
  if (outfitCount > 0) completed.add(3);
  // Step 4 is only a summary, not another task to repeat in onboarding.
  if ([1, 2, 3].every(step => completed.has(step as OnboardingStep))) completed.add(4);
  return {
    ...progress,
    currentStep: completed.has(4) ? 4 : progress.currentStep,
    completed: Array.from(completed).sort(),
    skipped: progress.skipped.filter(step => !completed.has(step)),
  };
}

export async function loadOnboardingProgress(
  userId: string,
  storyBaseline = 0,
  outfitBaseline = 0,
  username?: string | null,
): Promise<OnboardingProgress> {
  let saved = emptyOnboardingProgress(storyBaseline, outfitBaseline);
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      const steps = (value: unknown): OnboardingStep[] => Array.isArray(value)
        ? value.filter((step): step is OnboardingStep => [1, 2, 3, 4].includes(step))
        : [];
      saved = { ...saved, ...parsed, completed: steps(parsed.completed), skipped: steps(parsed.skipped) };
    }
  } catch {
    // Keep usable progress even if local storage is unavailable.
  }
  const next = reconcileOnboardingProgress(saved, username, storyBaseline, outfitBaseline);
  if (JSON.stringify(next) !== JSON.stringify(saved)) {
    await saveOnboardingProgress(userId, next).catch(() => null);
  }
  return next;
}

export async function saveOnboardingProgress(userId: string, progress: OnboardingProgress) {
  await AsyncStorage.setItem(key(userId), JSON.stringify(progress));
}
