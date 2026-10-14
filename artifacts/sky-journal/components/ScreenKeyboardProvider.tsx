import React from "react";
import { Platform } from "react-native";

/**
 * Screen-scoped react-native-keyboard-controller provider.
 *
 * The root layout intentionally does NOT mount KeyboardProvider (an Android
 * root-level event view was previously suspected of swallowing taps). Mounting it around a single
 * screen's content keeps that native view scoped: KeyboardControllerView wraps
 * its children as a flex:1 parent (not an overlay).
 *
 * Pair it with KeyboardAvoidingViewCompat behavior="padding" for animated
 * keyboard avoidance; do not add a second manual keyboard-height offset.
 *
 * Falls back to a passthrough on web and when the native module is missing
 * (e.g. Expo Go), matching KeyboardAwareScrollViewCompat.
 */
type ProviderProps = { children: React.ReactNode };

let NativeKeyboardProvider: React.ComponentType<ProviderProps> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  NativeKeyboardProvider = require("react-native-keyboard-controller").KeyboardProvider ?? null;
} catch { /* not available in Expo Go */ }

/** True when screens wrapped in ScreenKeyboardProvider get controller-driven keyboard events. */
export const hasScreenKeyboardController = Platform.OS !== "web" && !!NativeKeyboardProvider;

export function ScreenKeyboardProvider({ children }: ProviderProps) {
  if (!hasScreenKeyboardController || !NativeKeyboardProvider) return <>{children}</>;
  const Provider = NativeKeyboardProvider;
  return <Provider>{children}</Provider>;
}

export default ScreenKeyboardProvider;
