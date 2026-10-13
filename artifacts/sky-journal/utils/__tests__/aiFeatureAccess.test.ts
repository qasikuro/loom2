import { describe, expect, it } from 'vitest';
import { isAiFeatureEnabled } from '@/features/ai/aiFeatureAccess';

describe('AI feature visibility', () => {
  it('enables AI only when the public server config explicitly allows it', () => {
    expect(isAiFeatureEnabled({ features: { ai: true, image_generation: true } })).toBe(true);
    expect(isAiFeatureEnabled({ features: { ai: false, image_generation: true } })).toBe(false);
    expect(isAiFeatureEnabled({ features: { ai: true, image_generation: false } })).toBe(false);
    expect(isAiFeatureEnabled(undefined)).toBe(false);
    expect(isAiFeatureEnabled({ features: { ai: true } })).toBe(false);
    expect(isAiFeatureEnabled({ features: { ai: 'true', image_generation: true } })).toBe(false);
  });
});
