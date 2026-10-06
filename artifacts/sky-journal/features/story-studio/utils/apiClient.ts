/**
 * Story Studio — API client hook
 *
 * Provides an `apiFetch` helper pre-loaded with the current user's Clerk
 * session token. All Story Studio screens that need the books/chapters API
 * import this hook instead of calling fetch directly.
 */
import { useCallback } from 'react';
import { useAuth } from '@clerk/expo';
import { getApiBase } from '@/utils/apiBase';

const BASE_URL = getApiBase();

export function useApiFetch() {
  const { getToken } = useAuth();

  return useCallback(
    async function apiFetch<T>(
      path: string,
      opts: Omit<RequestInit, 'body'> & { json?: unknown } = {},
    ): Promise<T> {
      const token = await getToken();
      const { json, ...rest } = opts;

      const response = await fetch(`${BASE_URL}${path}`, {
        ...rest,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
      });

      if (response.status === 204) return undefined as T;

      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as Record<string, string>;
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }

      return response.json() as Promise<T>;
    },
    [getToken],
  );
}
