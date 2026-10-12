import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

/** Shared visibility/accessibility policy for both Home and companion avatars. */
export function useLumiActivity() {
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active' || AppState.currentState == null);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReducedMotion(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { alive = false; sub.remove(); };
  }, []);
  return { active: focused && appActive, reducedMotion };
}
