import React from 'react';
import { Redirect } from 'expo-router';
import { TeyvatMemoryBrowserPreview } from '@/components/profile/TeyvatMemoryBrowserPreview';

/** Development-only browser preview; it does not read or display account media. */
export default function TeyvatPreviewRoute() {
  if (!__DEV__) return <Redirect href="/(auth)/sign-in" />;
  return <TeyvatMemoryBrowserPreview />;
}
