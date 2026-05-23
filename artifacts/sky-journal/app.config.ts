import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name:    config.name    ?? "Sky Journal",
  slug:    config.slug    ?? "sky-journal",
  version: config.version ?? "1.0.0",
  icon: './assets/images/logo.jpg',
  splash: {
    image: './assets/images/logo.jpg',
    resizeMode: 'contain',
    backgroundColor: '#0D0B1E',
  },
  extra: {
    ...config.extra,
    // REPLIT_DEV_DOMAIN is available at bundle time in the Node.js environment.
    // The Expo bundler bakes this value into the bundle so the native app can
    // reach the API server via the shared Replit proxy.
    apiUrl: process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/api`
      : null,
  },
});
