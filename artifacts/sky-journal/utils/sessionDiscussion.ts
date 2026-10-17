export interface SessionDiscussionMessage {
  id: string;
  userId: string;
  authorName: string;
  content: string | null;
  expression: string | null;
  createdAt: string;
}

/** Reuse unchanged rows/snapshots so refreshes and acknowledgements don't redraw chat. */
export function reuseSessionDiscussionMessages(
  previous: SessionDiscussionMessage[],
  next: SessionDiscussionMessage[],
): SessionDiscussionMessage[] {
  const existing = new Map(previous.map(message => [message.id, message]));
  const result = next.map(message => {
    const old = existing.get(message.id);
    return old && old.userId === message.userId && old.authorName === message.authorName
      && old.content === message.content && old.expression === message.expression
      && old.createdAt === message.createdAt ? old : message;
  });
  return result.length === previous.length && result.every((message, index) => message === previous[index])
    ? previous : result;
}

/** Bound history and deduplicate POST acknowledgements against live delivery. */
export function mergeSessionDiscussion(
  history: SessionDiscussionMessage[],
  updates: SessionDiscussionMessage[],
  blockedIds: readonly string[],
): SessionDiscussionMessage[] {
  const blocked = new Set(blockedIds);
  const rows = new Map<string, SessionDiscussionMessage>();
  for (const message of [...history, ...updates]) {
    if (message.id && !blocked.has(message.userId)) rows.set(message.id, message);
  }
  return reuseSessionDiscussionMessages(history, [...rows.values()]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))
    .slice(-100));
}

/** Snapshot refreshes must not lose messages/deletions arriving while fetching. */
export function reconcileSessionDiscussion(
  history: SessionDiscussionMessage[],
  changes: { messageId: string; message: SessionDiscussionMessage | null }[],
  blockedIds: readonly string[],
) {
  const deleted = new Set(changes.filter(change => !change.message).map(change => change.messageId));
  return mergeSessionDiscussion(
    history.filter(message => !deleted.has(message.id)),
    changes.flatMap(change => change.message && !deleted.has(change.messageId) ? [change.message] : []),
    blockedIds,
  );
}
