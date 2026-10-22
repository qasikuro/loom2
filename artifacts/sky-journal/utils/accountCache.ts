const ACCOUNT_CACHE_PREFIX = 'storigam:account-cache:v1';

/** Persistent app data is isolated by Clerk account; auth tokens are never stored here. */
export function accountCacheKey(userId: string, key: string): string {
  return `${ACCOUNT_CACHE_PREFIX}:${encodeURIComponent(userId)}:${key}`;
}

export function friendOutfitsCacheKey(userId: string): string {
  return accountCacheKey(userId, 'home-friend-outfits:v1');
}

export function friendOutfitsCacheScope(friendIds: readonly string[], blockedIds: readonly string[]): string {
  const friends = [...new Set(friendIds)].sort();
  const blocked = [...new Set(blockedIds)].sort();
  return JSON.stringify([friends, blocked]);
}

/** Do not label a startup as offline until a request has actually completed. */
export function shouldShowOfflinePill(
  isLoading: boolean,
  hasCheckedApi: boolean,
  apiOnline: boolean,
): boolean {
  return !isLoading && hasCheckedApi && !apiOnline;
}
