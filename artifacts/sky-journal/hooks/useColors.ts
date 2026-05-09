import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

/**
 * Returns the design tokens for the currently active theme.
 * Picks `colors.dark` or `colors.light` based on the user-selected
 * ThemeMode (dark / light / system) stored in ThemeContext.
 */
export function useColors() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
