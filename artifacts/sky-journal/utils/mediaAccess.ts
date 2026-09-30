import { apiFetch } from '../context/AppContext';
import { getApiBase } from './apiBase';

const MEDIA_URL_TTL_MS = 14 * 60_000;
const resolvedMedia = new Map<string, { uri: string; expiresAt: number }>();
const pending = new Map<string, Promise<string>>();
type ReadUrlHandler = { path: string; scope: string | null; resolve: (uri: string) => void; reject: (error: unknown) => void };
const queued = new Map<string, ReadUrlHandler>();
const inFlight = new Map<string, ReadUrlHandler>();
let flushScheduled = false;
let authScope: string | null = null;
let scopeGeneration = 0;
const scopeListeners = new Set<() => void>();

const scopeKey = (scope: string | null, path: string) => JSON.stringify([scope, path]);

export function getMediaAuthScope(): string | null {
  return authScope;
}

export function subscribeMediaAuthScope(listener: () => void): () => void {
  scopeListeners.add(listener);
  return () => scopeListeners.delete(listener);
}

/** Clerk user scope for private tickets. Switching users invalidates all cached and in-flight work. */
export function setMediaAuthScope(scope: string | null): void {
  if (scope === authScope) return;
  authScope = scope;
  scopeGeneration += 1;
  const error = new Error('Media request cancelled because the signed-in account changed.');
  for (const handler of queued.values()) handler.reject(error);
  for (const handler of inFlight.values()) handler.reject(error);
  queued.clear();
  inFlight.clear();
  pending.clear();
  resolvedMedia.clear();
  flushScheduled = false;
  scopeListeners.forEach(listener => listener());
}

function mediaPath(uri: string): string | null {
  const apiBase = getApiBase();
  const baseUrl = /^https?:\/\//i.test(apiBase) ? apiBase : undefined;
  const isAbsoluteUrl = /^(?:https?:)?\/\//i.test(uri);
  let parsed: URL;
  try {
    const parsingBase = baseUrl
      ?? (typeof window !== 'undefined' ? window.location.origin : 'https://media-path.invalid');
    parsed = new URL(uri, parsingBase);
  } catch {
    return null;
  }

  // Root-relative API paths are local media references. Absolute URLs are only
  // managed when they point at this app's API origin; foreign URLs stay intact.
  const expectedOrigin = baseUrl
    ? new URL(baseUrl).origin
    : typeof window !== 'undefined'
      ? window.location.origin
      : process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : undefined;
  if (isAbsoluteUrl && (!expectedOrigin || parsed.origin !== expectedOrigin)) return null;
  if (!isAbsoluteUrl && !uri.startsWith('/') && (!expectedOrigin || parsed.origin !== expectedOrigin)) return null;

  const match = parsed.pathname.match(/^\/api\/(images|videos)\/([^/]+)\/?$/i);
  if (!match) return null;

  let filename: string;
  try {
    filename = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  // Filenames are single safe segments. Reject separators, URI delimiters,
  // control characters, and other characters outside the server's allowlist.
  if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename === '.' || filename === '..') return null;

  return `/api/${match[1].toLowerCase()}/${filename}`;
}

function absoluteMediaUri(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const apiBase = getApiBase();
  const domain = apiBase.replace(/\/api\/?$/, '');
  return `${domain}${value.startsWith('/') ? value : `/${value}`}`;
}

async function flushQueue(): Promise<void> {
  flushScheduled = false;
  const batch = [...queued.entries()].slice(0, 100);
  const generation = scopeGeneration;
  for (const [key, handler] of batch) {
    queued.delete(key);
    inFlight.set(key, handler);
  }
  if (!batch.length) return;

  try {
    const result = await apiFetch<{ urls: Record<string, string> }>('/media/read-urls', {
      method: 'POST',
      body: JSON.stringify({ paths: batch.map(([, handler]) => handler.path) }),
    });
    if (generation !== scopeGeneration) return;
    for (const [key, handler] of batch) {
      const value = result.urls?.[handler.path];
      if (typeof value !== 'string' || !value) {
        handler.reject(new Error(`Media resolver did not return a URL for ${handler.path}`));
        continue;
      }
      const uri = absoluteMediaUri(value);
      resolvedMedia.set(key, { uri, expiresAt: Date.now() + MEDIA_URL_TTL_MS });
      handler.resolve(uri);
    }
  } catch (error) {
    if (generation === scopeGeneration) batch.forEach(([, handler]) => handler.reject(error));
  } finally {
    for (const [key, handler] of batch) {
      if (inFlight.get(key) === handler) inFlight.delete(key);
    }
  }

  if (queued.size && !flushScheduled) {
    flushScheduled = true;
    queueMicrotask(() => void flushQueue());
  }
}

export function isManagedMediaUri(uri: string): boolean {
  return mediaPath(uri) !== null;
}

/** Strip any signed query while keeping the URI usable by native image/video loaders. */
export function canonicalMediaUri(uri: string): string {
  const path = mediaPath(uri);
  return path ? absoluteMediaUri(path) : uri;
}

export async function resolveMediaReadUrl(uri: string, forceRenew = false, expectedScope = authScope): Promise<string> {
  if (expectedScope !== authScope) throw new Error('Media request cancelled because the signed-in account changed.');
  const path = mediaPath(uri);
  if (!path) return uri;

  const key = scopeKey(expectedScope, path);
  const cached = resolvedMedia.get(key);
  if (!forceRenew && cached && cached.expiresAt > Date.now()) return cached.uri;
  if (forceRenew) resolvedMedia.delete(key);

  const existing = pending.get(key);
  if (existing) return existing;

  const request = new Promise<string>((resolve, reject) => {
    queued.set(key, { path, scope: expectedScope, resolve, reject });
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(() => void flushQueue());
    }
  }).finally(() => {
    if (pending.get(key) === request) pending.delete(key);
  });
  pending.set(key, request);
  return request;
}