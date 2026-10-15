import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Decorative motion should not compete with the visible screen or run in the background. */
export function useAmbientAnimationActive() {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);
  return focused && foreground;
}
