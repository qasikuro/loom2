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

export async function loadOnboardingProgress(
  userId: string,
  storyBaseline = 0,
  outfitBaseline = 0,
): Promise<OnboardingProgress> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return emptyOnboardingProgress(storyBaseline, outfitBaseline);
    return { ...emptyOnboardingProgress(storyBaseline, outfitBaseline), ...JSON.parse(raw) };
  } catch {
    return emptyOnboardingProgress(storyBaseline, outfitBaseline);
  }
}

export async function saveOnboardingProgress(userId: string, progress: OnboardingProgress) {
  await AsyncStorage.setItem(key(userId), JSON.stringify(progress));
}
