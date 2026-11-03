import { db, characterTable, pushDevicesTable } from "@workspace/db";
import { inArray, sql } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_TOKEN_PATTERN = /^(?:Exponent|Expo)PushToken\[[^\]]+\]$/;
const MAX_BATCH_SIZE = 100;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 2;

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface UserPushMessage extends PushPayload {
  userId: string;
}

export interface BatchPushMessage extends PushPayload {
  token: string;
}

interface ExpoTicket {
  status?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Push is a best-effort delivery channel; persisted inbox rows/messages remain
 * the source of truth. This resolves every installation for a user while
 * retaining the legacy character token during the client rollout.
 */
export async function sendPushNotification(
  toUserId: string,
  payload: PushPayload,
): Promise<void> {
  await sendPushToUsers([{ userId: toUserId, ...payload }]);
}

export async function sendPushToUsers(messages: UserPushMessage[]): Promise<void> {
  const userIds = [...new Set(messages.map(message => message.userId).filter(Boolean))];
  if (userIds.length === 0 || messages.length === 0) return;

  const [devices, characters] = await Promise.all([
    db.select({ userId: pushDevicesTable.userId, token: pushDevicesTable.token })
      .from(pushDevicesTable)
      .where(inArray(pushDevicesTable.userId, userIds)),
    db.select({ userId: characterTable.userId, token: characterTable.pushToken })
      .from(characterTable)
      .where(inArray(characterTable.userId, userIds)),
  ]);

  const tokensByUser = new Map<string, string[]>();
  for (const device of devices) {
    if (!EXPO_TOKEN_PATTERN.test(device.token)) continue;
    const tokens = tokensByUser.get(device.userId) ?? [];
    tokens.push(device.token);
    tokensByUser.set(device.userId, tokens);
  }
  for (const character of characters) {
    if (tokensByUser.has(character.userId) || !character.token || !EXPO_TOKEN_PATTERN.test(character.token)) continue;
    tokensByUser.set(character.userId, [character.token]);
  }

  await sendPushToTokens(messages.flatMap(message =>
    [...new Set(tokensByUser.get(message.userId) ?? [])].map(token => ({
      token,
      title: message.title,
      body: message.body,
      data: message.data,
    })),
  ));
}

/**
 * Legacy callers pass one token per recipient. Expand each registered token
 * to every installation belonging to that account and dedupe identical sends.
 */
export async function sendPushToTokens(messages: BatchPushMessage[]): Promise<void> {
  const validMessages = messages.filter(message => EXPO_TOKEN_PATTERN.test(message.token));
  if (validMessages.length === 0) return;

  const suppliedTokens = [...new Set(validMessages.map(message => message.token))];
  const [deviceOwners, legacyOwners] = await Promise.all([
    db.select({ userId: pushDevicesTable.userId, token: pushDevicesTable.token })
      .from(pushDevicesTable)
      .where(inArray(pushDevicesTable.token, suppliedTokens)),
    db.select({ userId: characterTable.userId, token: characterTable.pushToken })
      .from(characterTable)
      .where(inArray(characterTable.pushToken, suppliedTokens)),
  ]);

  const ownerByToken = new Map<string, string>();
  for (const row of legacyOwners) if (row.token) ownerByToken.set(row.token, row.userId);
  for (const row of deviceOwners) ownerByToken.set(row.token, row.userId);
  const userIds = [...new Set(ownerByToken.values())];
  const allDevices = userIds.length
    ? await db.select({ userId: pushDevicesTable.userId, token: pushDevicesTable.token })
      .from(pushDevicesTable)
      .where(inArray(pushDevicesTable.userId, userIds))
    : [];
  const tokensByUser = new Map<string, string[]>();
  for (const device of allDevices) {
    if (!EXPO_TOKEN_PATTERN.test(device.token)) continue;
    const tokens = tokensByUser.get(device.userId) ?? [];
    tokens.push(device.token);
    tokensByUser.set(device.userId, tokens);
  }

  const expanded: BatchPushMessage[] = [];
  const seen = new Set<string>();
  for (const message of validMessages) {
    const userId = ownerByToken.get(message.token);
    const targets = userId ? (tokensByUser.get(userId) ?? [message.token]) : [message.token];
    for (const token of targets) {
      const entry = { ...message, token };
      const key = `${token}\u0000${entry.title}\u0000${entry.body}\u0000${JSON.stringify(entry.data ?? {})}`;
      if (seen.has(key)) continue;
      seen.add(key);
      expanded.push(entry);
    }
  }

  for (let i = 0; i < expanded.length; i += MAX_BATCH_SIZE) {
    await sendChunkWithRetry(expanded.slice(i, i + MAX_BATCH_SIZE));
  }
}

async function sendChunkWithRetry(messages: BatchPushMessage[]): Promise<void> {
  const invalidTokens: string[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages.map(message => ({
          to: message.token,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          sound: "default",
        }))),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt + 1 < MAX_ATTEMPTS) {
          await delay(250 * (attempt + 1));
          continue;
        }
        console.warn("[push] Expo request rejected", { status: response.status, count: messages.length });
        return;
      }

      const result = await response.json() as { data?: ExpoTicket[] | ExpoTicket; errors?: unknown[] };
      const tickets = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      if (tickets.length !== messages.length) {
        console.warn("[push] Expo returned an unexpected ticket count", {
          sent: messages.length,
          received: tickets.length,
        });
      }

      tickets.forEach((ticket, index) => {
        if (ticket.status !== "error") return;
        if (ticket.details?.error === "DeviceNotRegistered") {
          const token = messages[index]?.token;
          if (token) invalidTokens.push(token);
        } else {
          console.warn("[push] Expo ticket error", {
            code: ticket.details?.error ?? "unknown",
            count: 1,
          });
        }
      });
      if (invalidTokens.length) await removeInvalidTokens([...new Set(invalidTokens)]);
      return;
    } catch (error) {
      if (attempt + 1 < MAX_ATTEMPTS) {
        await delay(250 * (attempt + 1));
        continue;
      }
      console.warn("[push] Expo request failed after retry", {
        count: messages.length,
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }
}

async function removeInvalidTokens(tokens: string[]): Promise<void> {
  if (!tokens.length) return;
  await db.delete(pushDevicesTable).where(inArray(pushDevicesTable.token, tokens));
  await db.update(characterTable)
    .set({
      pushToken: sql<string | null>`(
        SELECT device.token
        FROM push_devices AS device
        WHERE device.user_id = ${characterTable.userId}
        ORDER BY device.last_seen_at DESC
        LIMIT 1
      )`,
    })
    .where(inArray(characterTable.pushToken, tokens));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
