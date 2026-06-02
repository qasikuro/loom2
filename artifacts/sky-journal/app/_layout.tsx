import '@/polyfills';
import '@/i18n';

import { ClerkLoaded, ClerkLoading, ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import Constants from 'expo-constants';
import * as Font from 'expo-font';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppSplashScreen } from '@/components/AppSplashScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import { AppProvider, setAuthTokenGetter, useApp } from '@/context/AppContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { SoundProvider } from '@/context/SoundContext';
import { OnboardingOverlay, hasCompletedOnboarding, markOnboardingDone } from '@/components/OnboardingOverlay';

// Configure how notifications appear when the app is in the foreground.
// Guarded by platform check — expo-notifications has no-op stubs on web.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
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
      if (Platform.OS !== 'web') {
        (async () => {
          try {
            const perms = await Notifications.requestPermissionsAsync();
            const granted = perms.granted ?? (perms.ios?.status === 1);
            if (!granted) return;
            const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
            if (!projectId) return;
            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            const authToken = await getToken();
            if (!authToken) return;
            const apiUrl = Constants.expoConfig?.extra?.apiUrl as string | null;
            if (!apiUrl) return;
            await fetch(`${apiUrl}/character`, {
              method:  'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
              body:    JSON.stringify({ pushToken: tokenData.data }),
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

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (!data?.type) return;
      switch (data.type) {
        case 'follow':
          router.push('/(tabs)/discover' as any);
          break;
        case 'witness':
        case 'save':
        case 'new_story':
          if (data.refId) router.push(`/story/${data.refId}` as any);
          break;
        case 'message':
          if (data.refId) router.push(`/campfire/${data.refId}` as any);
          break;
        default:
          break;
      }
    });

    return () => sub.remove();
  }, []);

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
        {/* App content — rendered immediately so Clerk/Router load in background */}
        {fontsReady && (
          <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={clerkProxyUrl}>
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
                        </KeyboardProvider>
                      </GestureHandlerRootView>
                      </ToastProvider>
                      </AppProvider>
                    </SoundProvider>
                  </QueryClientProvider>
                </ErrorBoundary>
              </SafeAreaProvider>
            </ClerkLoaded>
          </ClerkProvider>
        )}

        {/* Custom splash — overlays everything, fades out when ready */}
        {!splashDone && (
          <AppSplashScreen onReady={handleSplashReady} />
        )}
      </ThemedRoot>
    </ThemeProvider>
  );
}
