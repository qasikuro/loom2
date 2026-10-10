import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

/** Brand accent for chat surfaces, derived from existing theme tokens. */
export function useChatAccent() {
  const colors = useColors();
  const { isDark } = useTheme();
  return {
    accent: isDark ? colors.primary : colors.secondary,
    onAccent: isDark ? colors.primaryForeground : colors.secondaryForeground,
  };
}
