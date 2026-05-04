import '@/polyfills';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import * as Font from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppProvider, setAuthTokenGetter, useApp } from '@/context/AppContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

function AuthTokenBridge() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { reloadData } = useApp();
  const prevSignedIn = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    setAuthTokenGetter(async () => {
      if (!isSignedIn) return null;
      try { return await getToken(); } catch { return null; }
    });
    if (isSignedIn && prevSignedIn.current !== true) reloadData();
    if (!isSignedIn && prevSignedIn.current === true) setAuthTokenGetter(async () => null);
    prevSignedIn.current = isSignedIn ?? false;
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}

function AuthNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();

  const inAuthGroup = segments[0] === '(auth)';
  const inTabsGroup = segments[0] === '(tabs)';

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1630', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#C8A84B" size="large" />
      </View>
    );
  }

  if (isSignedIn && inAuthGroup) return <Redirect href="/(tabs)" />;
  if (!isSignedIn && !inAuthGroup && inTabsGroup) return <Redirect href="/(auth)/sign-in" />;

  return null;
}

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
      // Load from a local copy in assets/fonts/ — avoids pnpm symlink issues
      // where Metro can't follow symlinks into the pnpm store at build time.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Feather: require('../assets/fonts/Feather.ttf'),
    })
      .catch(() => { /* if loading fails, still show the app — icons fall back to ☐ */ })
      .finally(() => {
        setFontsReady(true);
        SplashScreen.hideAsync();
      });
  }, []);

  if (!fontsReady) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AppProvider>
                <AuthTokenBridge />
                <AuthNavigator />
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
                    </Stack>
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </AppProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
