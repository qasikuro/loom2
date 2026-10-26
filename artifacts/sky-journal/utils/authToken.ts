/** Shared token registry key; survives Metro HMR without importing AppContext. */
export const TOKEN_GETTER_KEY = '__skyJournalTokenGetter';
export type TokenGetter = () => Promise<string | null>;

export function readAuthToken(): Promise<string | null> {
  const getter = (globalThis as Record<string, unknown>)[TOKEN_GETTER_KEY] as TokenGetter | undefined;
  return getter ? getter() : Promise.resolve(null);
}
