import '@/polyfills';
import '@/i18n';

import { ClerkLoaded, ClerkLoading, ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import Constants from 'expo-constants';
import * as Font from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppSplashScreen } from '@/components/AppSplashScreen';
import { XPFlash } from '@/components/XPFlash';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import { AppProvider, setAuthTokenGetter, useApp } from '@/context/AppContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { SoundProvider } from '@/context/SoundContext';
import { OnboardingOverlay, hasCompletedOnboarding, markOnboardingDone } from '@/components/OnboardingOverlay';

// expo-notifications throws at import time in Expo Go SDK 53+ because Android push
// notifications were removed. Lazy-require it so the error can't crash _layout.tsx
// and prevent ClerkProvider from mounting.
// eslint-disable-next-line @typescript-eslint/no-require-imports
let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch { /* not available in Expo Go */ }

// Configure how notifications appear when the app is in the foreground.
if (Platform.OS !== 'web' && Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  true,
      shouldSetBadge:   false,
    }),
  });
}

function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#080714' : '#F5F2FF' }}>
      {children}
    </View>
  );
}

// Keep the native splash visible until we're ready to show our custom one
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const clerkProxyUrl  = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

function AuthTokenBridge() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { reloadData, clearUserData } = useApp();
  const prevSignedIn = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    setAuthTokenGetter(async () => {
      if (!isSignedIn) return null;
      try { return await getToken(); } catch { return null; }
    });
    if (isSignedIn && prevSignedIn.current !== true) {
      reloadData();
      if (Platform.OS !== 'web' && Notifications) {
        (async () => {
          try {
            const perms = await Notifications!.requestPermissionsAsync();
            // PermissionResponse base type doesn't resolve cleanly in this TS config;
            // cast to access the runtime-present `granted` field.
            const granted = (perms as unknown as { granted?: boolean }).granted
              ?? (perms.ios?.status === 1 || perms.ios?.status === 3);
            if (!granted) return;
            const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
            if (!projectId) return;
            const tokenData = await Notifications!.getExpoPushTokenAsync({ projectId });
            const authToken = await getToken();
            if (!authToken) return;
            const apiUrl = Constants.expoConfig?.extra?.apiUrl as string | null;
            if (!apiUrl) return;
            await fetch(`${apiUrl}/push/register`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
              body:    JSON.stringify({ token: tokenData.data }),
            });
          } catch { /* push token registration requires a dev/prod build — silently skip in Expo Go */ }
        })();
      }
    }
    if (!isSignedIn && prevSignedIn.current === true) {
      setAuthTokenGetter(async () => null);
      clearUserData();
    }
    prevSignedIn.current = isSignedIn ?? false;
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}

function AppOverlays() {
  const { isSignedIn, isLoaded } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || checkedRef.current) return;
    checkedRef.current = true;
    hasCompletedOnboarding().then(done => {
      if (!done) setShowOnboarding(true);
    });
  }, [isLoaded, isSignedIn]);

  function handleComplete() {
    setShowOnboarding(false);
    markOnboardingDone();
  }

  return <OnboardingOverlay visible={showOnboarding} onComplete={handleComplete} />;
}

function NotificationDeepLinkHandler() {
  const router = useRouter();

  const navigate = useCallback((data: Record<string, unknown>) => {
    if (!data?.type) return;
    switch (data.type) {
      case 'follow':
        if (data.refId) router.push(`/user/${data.refId}` as any);
        break;
      case 'witness':
      case 'save':
      case 'new_story':
        if (data.refId) router.push(`/story/${data.refId}` as any);
        break;
      case 'message':
        if (data.refId) router.push(`/messages/${data.refId}` as any);
        break;
      default:
        break;
    }
  }, [router]);

  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) return;

    // Handle notification taps when the app is already open
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      navigate(response.notification.request.content.data as Record<string, unknown>);
    });

    // Handle cold-start: app launched by tapping a notification
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        navigate(response.notification.request.content.data as Record<string, unknown>);
      }
    }).catch(() => null);

    return () => sub.remove();
  }, [navigate]);

  return null;
}

function AuthNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();

  const inAuthGroup = segments[0] === '(auth)';
  const inTabsGroup = segments[0] === '(tabs)';

  if (!isLoaded) return null;

  if (isSignedIn && inAuthGroup) return <Redirect href="/(tabs)" />;
  if (!isSignedIn && !inAuthGroup && inTabsGroup) return <Redirect href="/(auth)/sign-in" />;

  return null;
}

export default function RootLayout() {
  const [fontsReady,  setFontsReady]  = useState(false);
  const [splashDone,  setSplashDone]  = useState(false);

  useEffect(() => {
    Font.loadAsync({
      'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.ttf'),
      'Satoshi-Medium':  require('../assets/fonts/Satoshi-Medium.ttf'),
      'Satoshi-Bold':    require('../assets/fonts/Satoshi-Bold.ttf'),
      'Satoshi-Black':   require('../assets/fonts/Satoshi-Black.ttf'),
      'Satoshi-Light':   require('../assets/fonts/Satoshi-Light.ttf'),
    })
      .catch(() => { /* fonts optional — app still usable */ })
      .finally(() => {
        setFontsReady(true);
        // Hide the native splash — silently ignore if not registered (hot-reload in Expo Go)
        SplashScreen.hideAsync().catch(() => null);
      });
  }, []);

  const handleSplashReady = useCallback(() => {
    setSplashDone(true);
  }, []);

  return (
    <ThemeProvider>
      <ThemedRoot>
        {/*
          ClerkProvider must be unconditional — @clerk/expo v3 uses useClerkSignal
          internally, which throws if the provider is not mounted on every render.
          Gating it behind fontsReady caused sign-in to render outside the provider
          when Expo Router initialised routes before fonts finished loading.
        */}
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={clerkProxyUrl}>
          {/* Show a spinner while fonts load (AppSplashScreen overlays this) */}
          {!fontsReady ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1630' }}>
              <ActivityIndicator size="large" color="#C8A84B" />
            </View>
          ) : (
            <>
            <ClerkLoading>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1630' }}>
                <ActivityIndicator size="large" color="#C8A84B" />
              </View>
            </ClerkLoading>
            <ClerkLoaded>
              <SafeAreaProvider>
                <ErrorBoundary>
                  <QueryClientProvider client={queryClient}>
                    <SoundProvider>
                      <AppProvider>
                        <AuthTokenBridge />
                        <NotificationDeepLinkHandler />
                        <AuthNavigator />
                        <AppOverlays />
                        <ToastProvider>
                        <GestureHandlerRootView style={{ flex: 1 }}>
                        <KeyboardProvider>
                          <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="(auth)" />
                            <Stack.Screen name="(tabs)" />
                            <Stack.Screen
                              name="story/[id]"
                              options={{ presentation: 'card', animation: 'slide_from_bottom' }}
                            />
                            <Stack.Screen
                              name="create-journal-entry"
                              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                            />
                            <Stack.Screen
                              name="create-friend-log"
                              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                            />
                            <Stack.Screen
                              name="create-moment-log"
                              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                            />
                            <Stack.Screen
                              name="create-outfit"
                              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                            />
                            <Stack.Screen
                              name="panel-editor"
                              options={{ presentation: 'card', animation: 'slide_from_right' }}
                            />
                            <Stack.Screen
                              name="my-stories"
                              options={{ presentation: 'card', animation: 'slide_from_right' }}
                            />
                            <Stack.Screen
                              name="wardrobe"
                              options={{ presentation: 'card', animation: 'slide_from_right' }}
                            />
                            <Stack.Screen
                              name="user-outfit"
                              options={{ presentation: 'card', animation: 'slide_from_right' }}
                            />
                            <Stack.Screen
                              name="journal-entry"
                              options={{ presentation: 'card', animation: 'slide_from_right' }}
                            />
                            <Stack.Screen
                              name="campfire/index"
                              options={{ presentation: 'card', animation: 'fade' }}
                            />
                            <Stack.Screen
                              name="campfire/[roomId]"
                              options={{ presentation: 'card', animation: 'fade' }}
                            />
                            <Stack.Screen
                              name="purchase-history"
                              options={{ presentation: 'card', animation: 'slide_from_right' }}
                            />
                          </Stack>
                          <XPFlash />
                        </KeyboardProvider>
                      </GestureHandlerRootView>
                      </ToastProvider>
                      </AppProvider>
                    </SoundProvider>
                  </QueryClientProvider>
                </ErrorBoundary>
              </SafeAreaProvider>
            </ClerkLoaded>
            </>
          )}
        </ClerkProvider>

        {/* Custom splash — overlays everything, fades out when ready */}
        {!splashDone && (
          <AppSplashScreen onReady={handleSplashReady} />
        )}
      </ThemedRoot>
    </ThemeProvider>
  );
}
