import type { ChatMessage } from '@workspace/api-client-react';

export type MergeableChatMessage = ChatMessage & {
  deliveryState?: 'sending' | 'queued' | 'failed';
};

export type ChatHistoryListItem<T extends { id: string; createdAt: string }> =
  | { type: 'date'; date: string; key: string }
  | { type: 'msg'; msg: T; key: string };

/** Keep async retry updates scoped to the account and conversation that started them. */
export function isChatIdentityCurrent(expectedIdentity: string, currentIdentity: string): boolean {
  return expectedIdentity === currentIdentity;
}

/** Recheck identity when a deferred state updater actually runs, not only when it is queued. */
export function updateChatStateForIdentity<T>(
  expectedIdentity: string,
  currentIdentity: string,
  previous: T,
  update: (current: T) => T,
): T {
  return isChatIdentityCurrent(expectedIdentity, currentIdentity) ? update(previous) : previous;
}

/** Keep the native first-visible-row anchor enabled for the inverted history list. */
export const CHAT_HISTORY_VISIBLE_POSITION = {
  minIndexForVisible: 0,
  autoscrollToTopThreshold: 60,
} as const;

/** Build newest-first rows for an inverted list, with one separator per date group. */
export function buildChatHistoryListItems<T extends { id: string; createdAt: string }>(
  messages: T[],
  formatDate: (createdAt: string) => string,
): ChatHistoryListItem<T>[] {
  const items: ChatHistoryListItem<T>[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const date = formatDate(msg.createdAt);
    if (date !== lastDate) {
      items.push({ type: 'date', date, key: `date-${date}-${msg.id}` });
      lastDate = date;
    }
    items.push({ type: 'msg', msg, key: msg.id });
  }
  // Inverted lists render data[0] at the bottom, so newest-first data is required.
  return items.reverse();
}

const MESSAGE_FIELDS: (keyof MergeableChatMessage)[] = [
  'id', 'fromUserId', 'toUserId', 'content', 'imageUri', 'videoUri', 'thumbnailUri', 'expression',
  'isRead', 'createdAt', 'isOwn', 'deliveryState',
];

function sameMessage(a: MergeableChatMessage, b: MergeableChatMessage): boolean {
  return MESSAGE_FIELDS.every(field => a[field] === b[field]);
}

function compareMessages(a: MergeableChatMessage, b: MergeableChatMessage): number {
  const timeOrder = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  return timeOrder || a.id.localeCompare(b.id);
}

/** Insert/update live or queued rows without dropping newer rows already on screen. */
export function upsertChatMessages(
  previous: MergeableChatMessage[],
  incoming: MergeableChatMessage[],
  excludedMessageIds: ReadonlySet<string> = new Set(),
): MergeableChatMessage[] {
  const visiblePrevious = previous.filter(message => !excludedMessageIds.has(message.id));
  const visibleIncoming = incoming.filter(message => !excludedMessageIds.has(message.id));
  return mergeChatMessages(visiblePrevious, [...visiblePrevious, ...visibleIncoming]);
}

/** Replace a local pending row with its server-confirmed version exactly once. */
export function reconcileConfirmedChatMessage(
  previous: MergeableChatMessage[],
  confirmed: MergeableChatMessage,
  clientMessageId: string = confirmed.id,
  excludedMessageIds: ReadonlySet<string> = new Set(),
): MergeableChatMessage[] {
  if (excludedMessageIds.has(clientMessageId) || excludedMessageIds.has(confirmed.id)) {
    return previous.filter(message =>
      !excludedMessageIds.has(message.id)
      && message.id !== clientMessageId
      && message.id !== confirmed.id,
    );
  }
  const existingConfirmed = previous.find(
    message => message.id === confirmed.id && !message.deliveryState,
  );
  const confirmedRow = existingConfirmed ?? confirmed;
  const withoutPending = previous.filter(
    message => message.id !== clientMessageId || message.id === confirmed.id,
  );
  return upsertChatMessages(withoutPending, [confirmedRow]);
}

/** Merge server pages while preserving object identity for unchanged virtualized rows. */
export function mergeChatMessages(
  previous: MergeableChatMessage[],
  incoming: MergeableChatMessage[],
  preserveEarlier = false,
  excludedMessageIds: ReadonlySet<string> = new Set(),
): MergeableChatMessage[] {
  previous = previous.filter(message => !excludedMessageIds.has(message.id));
  incoming = incoming.filter(message => !excludedMessageIds.has(message.id));
  const previousById = new Map(previous.map(message => [message.id, message]));
  const mergedIncoming = new Map<string, MergeableChatMessage>();
  for (const message of incoming) {
    const existing = mergedIncoming.get(message.id) ?? previousById.get(message.id);
    const keepExisting = existing && (
      sameMessage(existing, message)
      || (!existing.deliveryState && !!message.deliveryState)
    );
    mergedIncoming.set(
      message.id,
      keepExisting ? existing : message,
    );
  }

  const result = new Map<string, MergeableChatMessage>(mergedIncoming);
  if (preserveEarlier && incoming.length > 0) {
    const oldestIncoming = incoming.reduce((oldest, message) =>
      compareMessages(message, oldest) < 0 ? message : oldest,
    );
    for (const message of previous) {
      if (compareMessages(message, oldestIncoming) < 0) result.set(message.id, message);
    }
  }

  const sorted = [...result.values()].sort(compareMessages);
  if (sorted.length === previous.length && sorted.every((message, index) => message === previous[index])) {
    return previous;
  }
  return sorted;
}
