import * as Linking from 'expo-linking';

const LEGACY_PHONE_DEV_CLIENT_SCHEME = 'sky-journal';
const OAUTH_CALLBACK_PATH = 'oauth-native-callback';

export function createOAuthRedirectUrl(): string {
  if (process.env.EXPO_PUBLIC_PHONE_DEV === 'true') {
    // The installed phone development client predates the Storigam rebrand and
    // only has this scheme registered natively. Its JavaScript bundle can use
    // the newer brand, but Android still needs the native scheme to reopen it.
    return Linking.createURL(OAUTH_CALLBACK_PATH, {
      scheme: LEGACY_PHONE_DEV_CLIENT_SCHEME,
    });
  }

  return Linking.createURL(OAUTH_CALLBACK_PATH);
}