import { db, characterTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushPayload {
  title: string;
  body:  string;
  data?: Record<string, unknown>;
}

/**
 * Send an Expo push notification to a user.
 * Silently no-ops if the user has no registered push token.
 * Errors are swallowed so callers can fire-and-forget safely.
 */
export async function sendPushNotification(
  toUserId: string,
  payload:  PushPayload,
): Promise<void> {
  const [row] = await db
    .select({ pushToken: characterTable.pushToken })
    .from(characterTable)
    .where(eq(characterTable.userId, toUserId))
    .limit(1);

  const token = row?.pushToken;
  if (!token || !token.startsWith("ExponentPushToken[")) return;

  await fetch(EXPO_PUSH_URL, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Accept:         "application/json",
    },
    body: JSON.stringify({
      to:    token,
      sound: "default",
      title: payload.title,
      body:  payload.body,
      data:  payload.data ?? {},
    }),
  });
}
