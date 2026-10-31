import { useColorScheme } from "react-native";
import { nativeTheme, type NativeThemeMode } from "../lib/native-theme";

export function useColors(mode?: NativeThemeMode) {
  const systemMode = useColorScheme();
  return nativeTheme[mode ?? (systemMode === "light" ? "light" : "dark")];
}
