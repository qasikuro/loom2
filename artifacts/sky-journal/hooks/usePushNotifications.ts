import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

let Notifications: typeof import('expo-notifications') | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
try { Notifications = require('expo-notifications'); } catch { /* not available in Expo Go */ }

/**
 * Registers the device for Expo push notifications and syncs the token
 * to the API server so the backend can send push messages.
 *
 * - Runs once per sign-in (guarded by a ref).
 * - Silently no-ops on web or when expo-notifications is unavailable.
 * - Calls DELETE on sign-out to clear the stored token.
 */
export function usePushNotifications(
  isSignedIn: boolean,
  getToken:   () => Promise<string | null>,
  apiFetch:   (path: string, opts?: RequestInit) => Promise<Response>,
) {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) return;
    if (!isSignedIn) {
      // Clear token on sign-out so user stops receiving notifications.
      if (registeredRef.current) {
        registeredRef.current = false;
        apiFetch('/push/register', { method: 'DELETE' }).catch(() => {});
      }
      return;
    }
    if (registeredRef.current) return;

    (async () => {
      try {
        // PermissionResponse base type doesn't resolve cleanly in this TS config;
        // cast to access the runtime-present `granted` field.
        type PermRes = { granted?: boolean; ios?: { status: number } };
        const existing = await Notifications!.getPermissionsAsync();
        const isGranted = (existing as unknown as PermRes).granted
          ?? (existing.ios?.status === 1 || existing.ios?.status === 3);
        let finalGranted = isGranted;
        if (!isGranted) {
          const asked = await Notifications!.requestPermissionsAsync();
          finalGranted = (asked as unknown as PermRes).granted
            ?? (asked.ios?.status === 1 || asked.ios?.status === 3);
        }
        if (!finalGranted) return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        if (!projectId) return;

        const tokenData = await Notifications!.getExpoPushTokenAsync({ projectId });
        const pushToken = tokenData.data;
        if (!pushToken?.startsWith('ExponentPushToken[')) return;

        const res = await apiFetch('/push/register', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token: pushToken }),
        });
        if (res.ok) registeredRef.current = true;
      } catch {
        // Silently ignore — push notifications are non-critical
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);
}
