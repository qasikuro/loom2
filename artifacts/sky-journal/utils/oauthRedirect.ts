import * as Linking from 'expo-linking';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const COMPATIBLE_NATIVE_OAUTH_SCHEME = 'sky-journal';
const OAUTH_CALLBACK_PATH = 'oauth-native-callback';

export function createOAuthRedirectUrl(): string {
  const isNativeApp =
    Platform.OS !== 'web' &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  const redirectScheme =
    process.env.EXPO_PUBLIC_CLERK_REDIRECT_SCHEME ||
    (process.env.EXPO_PUBLIC_PHONE_DEV === 'true' || isNativeApp
      ? COMPATIBLE_NATIVE_OAUTH_SCHEME
      : undefined);

  if (redirectScheme) {
    // Preserve the pre-rebrand OAuth callback even when build-time env is
    // missing. The branded scheme remains available for normal app links.
    // Switch OAuth schemes only after verifying the production Clerk allowlist.
    return Linking.createURL(OAUTH_CALLBACK_PATH, {
      scheme: redirectScheme,
    });
  }

  return Linking.createURL(OAUTH_CALLBACK_PATH);
}