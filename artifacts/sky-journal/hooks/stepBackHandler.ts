/**
 * Returns a BackHandler callback for a multi-step creation screen.
 *
 * Behaviour:
 *  - step > firstStep  → calls setStep(s => s - 1) and returns true (event consumed)
 *  - step === firstStep → returns false so the navigation guard / beforeRemove fires
 *
 * Used by quick-moment.tsx and vibe-post.tsx so the exact same decision logic
 * can be imported and unit-tested without rendering the full screen.
 */
export function makeStepBackHandler(
  step: number,
  firstStep: number,
  setStep: (fn: (s: number) => number) => void,
): () => boolean {
  return () => {
    if (step > firstStep) {
      setStep(s => s - 1);
      return true;
    }
    return false;
  };
}
