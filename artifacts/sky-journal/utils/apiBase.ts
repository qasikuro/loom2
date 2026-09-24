import Constants from 'expo-constants';

export function getApiBase(): string {
  // Existing native installs may still carry the old embedded API URL.
  const legacyUrl = Constants.expoConfig?.extra?.apiUrl;
  if (typeof legacyUrl === 'string' && legacyUrl) return legacyUrl;
  const publicUrl = process.env.EXPO_PUBLIC_API_URL;
  if (publicUrl) return publicUrl.replace(/\/$/, '');
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : '/api';
}