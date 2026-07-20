import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name:    config.name    ?? "GameJo",
  slug:    config.slug    ?? "sky-journal",
  version: config.version ?? "1.0.0",
  icon: './assets/images/gamejo_logo.png',
  splash: {
    image: './assets/images/gamejo_splash.png',
    resizeMode: 'cover',
    backgroundColor: '#0D0B1E',
  },
  android: {
    package: "com.gamejo.app",
    versionCode: 1,
  },
  plugins: [
    ...(Array.isArray(config.plugins) ? config.plugins : []),
    ['expo-notifications', {
      icon:  './assets/images/gamejo_logo.png',
      color: '#7C3AED',
      sounds: [],
    }],
    ['expo-build-properties', {
      android: {
        packagingOptions: {
          exclude: [
            'META-INF/versions/9/OSGI-INF/MANIFEST.MF',
          ],
        },
      },
    }],
  ],
  extra: {
    ...config.extra,
    eas: {
      projectId: config.extra?.eas?.projectId,
    },
    apiUrl: process.env.PRODUCTION_API_URL
      ?? (process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}/api`
        : null),
  },
});
