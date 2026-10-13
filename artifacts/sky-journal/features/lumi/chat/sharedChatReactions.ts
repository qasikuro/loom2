import { CHAT_EMOTES, getChatEmote, type ChatEmoteId } from './chatEmotes';

export type SharedLumiEvent = {
  messageId: string;
  emoteId: ChatEmoteId;
  side: 'own' | 'other';
  createdAt: string;
};
export type SharedReactionMessage = {
  id: string; fromUserId: string; toUserId: string; content: string | null;
  createdAt: string; expression?: string | null; imageUri?: string | null;
};
export type SharedReactionTracker = { seen: string[] };
export const MAX_SHARED_REACTION_EVENTS = 16;
export const MAX_PENDING_PERFORMANCES = 8;
export const MAX_SHARED_REACTION_AGE_MS = 60_000;
const MAX_SEEN = 512;
const wireEmotes = new Map(CHAT_EMOTES.map(emote => [`Lumi: ${emote.emoji}`, emote.id]));

/** Human-readable text also works on older apps, notifications and moderation.
 * Use the existing authenticated, persisted message API and its rate limits.
 * Do not add unsupported expression identifiers or a separate public channel.
 */
export function sharedReactionContent(id: ChatEmoteId): string {
  const emote = getChatEmote(id);
  if (!emote) throw new Error('Unknown Lumi reaction');
  return `Lumi: ${emote.emoji}`;
}
export function parseSharedReaction(content: string | null | undefined): ChatEmoteId | null {
  return typeof content === 'string' ? wireEmotes.get(content) ?? null : null;
}

/** The same persisted message can arrive via POST and SSE in either order.
 * Also handles someone typing the readable Lumi text in the normal composer.
 */
export function mergeConfirmedChatMessage<T extends { id: string }>(
  messages: readonly T[], sent: T, optimisticId?: string,
): T[] {
  const remaining = optimisticId ? messages.filter(message => message.id !== optimisticId) : [...messages];
  return remaining.some(message => message.id === sent.id) ? remaining : [...remaining, sent];
}
function remember(tracker: SharedReactionTracker, ids: readonly string[]) {
  tracker.seen = [...new Set([...tracker.seen, ...ids])].slice(-MAX_SEEN);
}
export function seedSharedReactionHistory(tracker: SharedReactionTracker, messages: readonly { id: string }[]) {
  remember(tracker, messages.map(message => message.id));
}

/** Call only on confirmed live messages or subsequent active-chat gap fills.
 * Initial cached/fetched history is seeded separately and never animated.
 */
export function acceptSharedReaction(
  tracker: SharedReactionTracker,
  message: SharedReactionMessage,
  context: { viewerId: string; partnerId: string; active: boolean; now: number },
): SharedLumiEvent | null {
  if (!message.id || message.id.startsWith('temp-') || tracker.seen.includes(message.id)) return null;
  const emoteId = parseSharedReaction(message.content);
  if (!emoteId || message.imageUri || message.expression) return null;
  const own = message.fromUserId === context.viewerId && message.toUserId === context.partnerId;
  const other = message.fromUserId === context.partnerId && message.toUserId === context.viewerId;
  if (!own && !other) return null;
  remember(tracker, [message.id]);
  const time = Date.parse(message.createdAt);
  const age = context.now - time;
  if (!context.active || !Number.isFinite(time) || age < -30_000 || age > MAX_SHARED_REACTION_AGE_MS) return null;
  return { messageId: message.id, emoteId, side: own ? 'own' : 'other', createdAt: message.createdAt };
}

/** Both actors share one bounded queue so their center performances cannot clash. */
export function queueSharedPerformances(
  queue: readonly SharedLumiEvent[],
  incoming: readonly SharedLumiEvent[],
  playingId?: string,
): SharedLumiEvent[] {
  const ids = new Set<string>(playingId ? [playingId] : []);
  return [...queue, ...incoming].filter(event => {
    if (ids.has(event.messageId)) return false;
    ids.add(event.messageId);
    return true;
  }).slice(0, MAX_PENDING_PERFORMANCES);
}
