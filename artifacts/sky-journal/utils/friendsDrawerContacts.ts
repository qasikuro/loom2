export interface FriendLike {
  userId: string; name: string; username?: string | null; avatarUri?: string | null;
  isOnline?: boolean; lastSeenAt?: string | null;
}
export interface ThreadLike {
  partnerId: string; partnerName: string; partnerHandle: string | null; partnerAvatar: string | null;
  lastMessage: string; lastAt: string; unread: boolean;
}
export interface Contact {
  userId: string; name: string; handle: string | null; avatar: string | null;
  isFriend: boolean; online: boolean; lastSeenAt: string | null;
  preview: string | null; lastAt: string | null; unread: boolean;
}

export function matchesQuery(query: string, name: string, handle: string | null | undefined): boolean {
  const q = query.trim().replace(/^@/, '').toLowerCase();
  return !q || `${name} ${handle ?? ''}`.toLowerCase().includes(q);
}

/** Merge friends with DM threads; blocked removed; only friends carry presence. */
export function mergeContacts(
  friends: readonly FriendLike[], threads: readonly ThreadLike[], blocked: ReadonlySet<string>, restricted: boolean,
): Contact[] {
  const map = new Map<string, Contact>();
  if (!restricted) {
    for (const f of friends) {
      if (blocked.has(f.userId)) continue;
      map.set(f.userId, {
        userId: f.userId, name: f.name, handle: f.username ?? null, avatar: f.avatarUri ?? null, isFriend: true,
        online: f.isOnline === true, lastSeenAt: f.lastSeenAt ?? null, preview: null, lastAt: null, unread: false,
      });
    }
    for (const th of threads) {
      if (blocked.has(th.partnerId)) continue;
      const base: Contact = map.get(th.partnerId) ?? {
        userId: th.partnerId, name: th.partnerName, handle: th.partnerHandle, avatar: th.partnerAvatar, isFriend: false,
        online: false, lastSeenAt: null, preview: null, lastAt: null, unread: false,
      };
      map.set(th.partnerId, { ...base, preview: th.lastMessage, lastAt: th.lastAt, unread: th.unread });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.lastAt && b.lastAt) return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    if (a.lastAt) return -1;
    if (b.lastAt) return 1;
    return a.name.localeCompare(b.name);
  });
}
