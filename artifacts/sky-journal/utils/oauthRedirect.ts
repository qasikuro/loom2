import * as Linking from 'expo-linking';

const LEGACY_PHONE_DEV_CLIENT_SCHEME = 'sky-journal';
const OAUTH_CALLBACK_PATH = 'oauth-native-callback';

export function createOAuthRedirectUrl(): string {
  const redirectScheme =
    process.env.EXPO_PUBLIC_CLERK_REDIRECT_SCHEME ||
    (process.env.EXPO_PUBLIC_PHONE_DEV === 'true'
      ? LEGACY_PHONE_DEV_CLIENT_SCHEME
      : undefined);

  if (redirectScheme) {
    // Keep the older OAuth callback available while Storigam uses its branded
    // scheme for normal app links. Both schemes are registered in app.json.
    return Linking.createURL(OAUTH_CALLBACK_PATH, {
      scheme: redirectScheme,
    });
  }

  return Linking.createURL(OAUTH_CALLBACK_PATH);
}