import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StorigamLoadingOverlay } from '@/components/SkyLoading';

/**
 * The native OAuth redirect URI is sky-journal://oauth-native-callback.
 * Register it with Expo Router so the brief return from the browser shows the
 * in-app loader instead of the generic +not-found screen while Clerk activates
 * the session. The sign-in flow and AuthNavigator take over as soon as it does.
 */
export default function OAuthNativeCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { t } = useTranslation();
  const [callbackTimedOut, setCallbackTimedOut] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setCallbackTimedOut(true), 20_000);
    return () => clearTimeout(timeout);
  }, []);

  if (isLoaded && isSignedIn) {
    return <Redirect href="/(tabs)/reels" />;
  }

  if (callbackTimedOut) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <StorigamLoadingOverlay message={t('common.loading')} />;
}
