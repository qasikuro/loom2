import { db, characterTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushPayload {
  title: string;
  body:  string;
  data?: Record<string, unknown>;
}

/**
 * Send an Expo push notification to a single user.
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

export interface BatchPushMessage {
  token:   string;
  title:   string;
  body:    string;
  data?:   Record<string, unknown>;
}

/**
 * Send push notifications to many pre-fetched tokens in one or more
 * batched requests (max 100 per Expo API call).
 * Invalid / non-Expo tokens are filtered out automatically.
 * Errors per batch are swallowed — callers can fire-and-forget.
 */
export async function sendPushToTokens(messages: BatchPushMessage[]): Promise<void> {
  const valid = messages.filter(m => m.token.startsWith("ExponentPushToken["));
  if (!valid.length) return;

  for (let i = 0; i < valid.length; i += 100) {
    const chunk = valid.slice(i, i + 100);
    try {
      await fetch(EXPO_PUSH_URL, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Accept:         "application/json",
        },
        body: JSON.stringify(
          chunk.map(m => ({
            to:    m.token,
            sound: "default",
            title: m.title,
            body:  m.body,
            data:  m.data ?? {},
          })),
        ),
      });
    } catch {
      // swallow per-chunk errors so remaining chunks still send
    }
  }
}
