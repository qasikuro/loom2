import { Platform, ScrollView, ScrollViewProps } from "react-native";

// react-native-keyboard-controller is a custom native module not bundled in Expo Go.
// We lazy-require it and fall back to a plain ScrollView when it's unavailable.
let KeyboardAwareScrollView: React.ComponentType<ScrollViewProps & { bottomOffset?: number }> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  KeyboardAwareScrollView = require("react-native-keyboard-controller").KeyboardAwareScrollView;
} catch { /* not available in Expo Go */ }

type Props = ScrollViewProps & { bottomOffset?: number };

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  if (Platform.OS === "web" || !KeyboardAwareScrollView) {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }
  const KASV = KeyboardAwareScrollView;
  return (
    <KASV keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
      {children}
    </KASV>
  );
}
