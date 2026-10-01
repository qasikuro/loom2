import Constants from 'expo-constants';

export function getApiBase(): string {
  const publicUrl = process.env.EXPO_PUBLIC_API_URL;
  // Expo Go's legacy embedded API URL must not shadow the temporary Quick
  // Tunnel URL. Keep all default/production URL precedence unchanged.
  if (process.env.EXPO_PUBLIC_PHONE_DEV === 'true' && publicUrl) {
    return publicUrl.replace(/\/$/, '');
  }

  // Existing native installs may still carry the old embedded API URL.
  const legacyUrl = Constants.expoConfig?.extra?.apiUrl;
  if (typeof legacyUrl === 'string' && legacyUrl) return legacyUrl;
  if (publicUrl) return publicUrl.replace(/\/$/, '');
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : '/api';
}