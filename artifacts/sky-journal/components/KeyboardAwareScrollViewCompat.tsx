import {
  KeyboardAvoidingView as NativeKeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from "react-native";

// react-native-keyboard-controller is a custom native module not bundled in Expo Go.
// We lazy-require it and fall back to a plain ScrollView when it's unavailable.
let KeyboardAwareScrollView: React.ComponentType<ScrollViewProps & { bottomOffset?: number }> | null = null;
let ControllerKeyboardAvoidingView: React.ComponentType<KeyboardAvoidingViewProps> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const keyboardController = require("react-native-keyboard-controller");
  KeyboardAwareScrollView = keyboardController.KeyboardAwareScrollView;
  ControllerKeyboardAvoidingView = keyboardController.KeyboardAvoidingView;
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

export function KeyboardAvoidingViewCompat(props: KeyboardAvoidingViewProps) {
  if (Platform.OS === "web" || !ControllerKeyboardAvoidingView) {
    return <NativeKeyboardAvoidingView {...props} />;
  }
  const KeyboardAvoidingView = ControllerKeyboardAvoidingView;
  return <KeyboardAvoidingView {...props} />;
}
