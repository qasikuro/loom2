import React from 'react';
import { Redirect } from 'expo-router';
import { RiveIconBrowserPreview } from '@/components/RiveIconBrowserPreview';

/** Development-only browser preview for the app's animated Rive icon set. */
export default function RiveIconsPreviewRoute() {
  if (!__DEV__) return <Redirect href="/(auth)/sign-in" />;
  return <RiveIconBrowserPreview />;
}
