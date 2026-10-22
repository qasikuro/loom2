import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  canonicalMediaUri,
  getMediaAuthScope,
  isManagedMediaUri,
  resolveMediaReadUrl,
  subscribeMediaAuthScope,
} from '@/utils/mediaAccess';

/** Resolves/renews a media URL while preserving player identity across refreshes. */
export function useSecureMediaUri(uri: string | null | undefined, { waitForAuthorization = false }: { waitForAuthorization?: boolean } = {}): {
  uri: string | undefined;
  renew: () => Promise<void>;
  error: boolean;
} {
  const mediaScope = useSyncExternalStore(subscribeMediaAuthScope, getMediaAuthScope, getMediaAuthScope);
  const initialUri = uri && (!waitForAuthorization || !isManagedMediaUri(uri)) ? canonicalMediaUri(uri) : undefined;
  const [resolved, setResolved] = useState(() => ({
    sourceUri: uri,
    scope: mediaScope,
    uri: initialUri,
    error: false,
  }));
  const generation = useRef(0);
  const identity = useRef({ sourceUri: uri, scope: mediaScope });
  if (identity.current.sourceUri !== uri || identity.current.scope !== mediaScope) {
    identity.current = { sourceUri: uri, scope: mediaScope };
    generation.current += 1;
  }

  const renew = useCallback(async (force = false) => {
    if (!uri) return;
    if (waitForAuthorization) setResolved(current => ({ ...current, error: false }));
    const requestGeneration = generation.current;
    const requestScope = mediaScope;
    try {
      const next = await resolveMediaReadUrl(uri, force, requestScope);
      if (
        generation.current === requestGeneration
        && identity.current.sourceUri === uri
        && identity.current.scope === requestScope
      ) {
        setResolved({ sourceUri: uri, scope: requestScope, uri: next, error: false });
      }
    } catch {
      // The canonical source remains safe if resolution fails or is cancelled.
      if (waitForAuthorization && generation.current === requestGeneration && identity.current.sourceUri === uri && identity.current.scope === requestScope) {
        setResolved(current => ({ ...current, error: true }));
      }
    }
  }, [uri, mediaScope, waitForAuthorization]);

  useEffect(() => {
    setResolved({
      sourceUri: uri,
      scope: mediaScope,
      uri: initialUri,
      error: false,
    });
    void renew();
  }, [uri, mediaScope, initialUri, renew]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void renew(true);
    });
    return () => subscription.remove();
  }, [renew]);

  const resolvedUri = resolved.sourceUri === uri && resolved.scope === mediaScope
    ? resolved.uri
    : initialUri;
  return { uri: resolvedUri, renew: () => renew(true), error: resolved.sourceUri === uri && resolved.scope === mediaScope && resolved.error };
}