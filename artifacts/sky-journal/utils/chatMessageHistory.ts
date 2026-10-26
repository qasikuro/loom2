import type { ChatMessage } from '@workspace/api-client-react';

const MESSAGE_FIELDS: (keyof ChatMessage)[] = [
  'id', 'fromUserId', 'toUserId', 'content', 'imageUri', 'expression',
  'isRead', 'createdAt', 'isOwn',
];

function sameMessage(a: ChatMessage, b: ChatMessage): boolean {
  return MESSAGE_FIELDS.every(field => a[field] === b[field]);
}

function compareMessages(a: ChatMessage, b: ChatMessage): number {
  const timeOrder = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  return timeOrder || a.id.localeCompare(b.id);
}

/** Merge server pages while preserving object identity for unchanged virtualized rows. */
export function mergeChatMessages(
  previous: ChatMessage[],
  incoming: ChatMessage[],
  preserveEarlier = false,
): ChatMessage[] {
  const previousById = new Map(previous.map(message => [message.id, message]));
  const mergedIncoming = new Map<string, ChatMessage>();
  for (const message of incoming) {
    const existing = previousById.get(message.id);
    mergedIncoming.set(
      message.id,
      existing && sameMessage(existing, message) ? existing : message,
    );
  }

  const result = new Map(mergedIncoming);
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
