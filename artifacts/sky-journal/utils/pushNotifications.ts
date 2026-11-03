import Constants from "expo-constants";
import { Platform } from "react-native";
import type * as ExpoNotifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PushPlatform = "ios" | "android" | "unknown";
export type PushPermissionState = "granted" | "denied" | "undetermined" | "unavailable";

type NotificationsModule = typeof ExpoNotifications;

let notificationsModule: NotificationsModule | null | undefined;
const CACHED_PUSH_TOKEN_KEY = "push_device_token_v1";

export async function cachePushToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHED_PUSH_TOKEN_KEY, token);
  } catch {
    // Server registration still succeeds if local token persistence is unavailable.
  }
}

export async function getCachedPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CACHED_PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearCachedPushToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHED_PUSH_TOKEN_KEY);
  } catch {
    // Best effort cleanup; registration can be refreshed from Expo next launch.
  }
}

export function getPushNotificationsModule(): NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;
  if (Platform.OS === "web") {
    notificationsModule = null;
    return null;
  }
  try {
    // expo-notifications can throw during module initialization in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require("expo-notifications") as NotificationsModule;
  } catch {
    notificationsModule = null;
  }
  return notificationsModule;
}

function isGranted(response: unknown): boolean {
  const permission = response as {
    granted?: boolean;
    ios?: { status?: number };
  };
  return permission.granted ?? (permission.ios?.status === 1 || permission.ios?.status === 3);
}

export async function getPushPermissionState(): Promise<{
  state: PushPermissionState;
  canAskAgain: boolean;
}> {
  const notifications = getPushNotificationsModule();
  if (!notifications) return { state: "unavailable", canAskAgain: false };

  const permission = await notifications.getPermissionsAsync();
  const value = permission as unknown as {
    granted?: boolean;
    status?: string;
    canAskAgain?: boolean;
    ios?: { status?: number };
  };
  if (isGranted(value)) return { state: "granted", canAskAgain: false };
  return {
    state: value.status === "denied" ? "denied" : "undetermined",
    canAskAgain: value.canAskAgain ?? true,
  };
}

export async function requestPushPermission(): Promise<boolean> {
  const notifications = getPushNotificationsModule();
  if (!notifications) return false;

  const current = await notifications.getPermissionsAsync();
  if (isGranted(current)) return true;
  const result = await notifications.requestPermissionsAsync();
  return isGranted(result);
}

export async function getExpoPushToken(): Promise<string | null> {
  const notifications = getPushNotificationsModule();
  if (!notifications) return null;

  const permission = await notifications.getPermissionsAsync();
  if (!isGranted(permission)) return null;

  if (Platform.OS === "android") {
    await notifications.setNotificationChannelAsync("default", {
      name: "Storigam notifications",
      importance: notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#9B78E8",
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;
  const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  return /^(?:Exponent|Expo)PushToken\[[^\]]+\]$/.test(token) ? token : null;
}

export function getPushPlatform(): PushPlatform {
  return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown";
}
