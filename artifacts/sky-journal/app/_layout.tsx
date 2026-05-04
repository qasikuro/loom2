import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
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
      try {
        return await getToken();
      } catch {
        return null;
      }
    });

    // Reload from API whenever the user signs in (including first load after Clerk resolves)
    if (isSignedIn && prevSignedIn.current !== true) {
      reloadData();
    }

    // Clear data when user signs out
    if (!isSignedIn && prevSignedIn.current === true) {
      setAuthTokenGetter(async () => null);
    }

    prevSignedIn.current = isSignedIn ?? false;
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AppProvider>
                <AuthTokenBridge />
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
