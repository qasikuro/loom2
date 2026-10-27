import type { ChatMessage } from '@workspace/api-client-react';

export type MergeableChatMessage = ChatMessage & {
  deliveryState?: 'sending' | 'queued' | 'failed';
};

const MESSAGE_FIELDS: (keyof MergeableChatMessage)[] = [
  'id', 'fromUserId', 'toUserId', 'content', 'imageUri', 'expression',
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
): MergeableChatMessage[] {
  return mergeChatMessages(previous, [...previous, ...incoming]);
}

/** Merge server pages while preserving object identity for unchanged virtualized rows. */
export function mergeChatMessages(
  previous: MergeableChatMessage[],
  incoming: MergeableChatMessage[],
  preserveEarlier = false,
): MergeableChatMessage[] {
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
