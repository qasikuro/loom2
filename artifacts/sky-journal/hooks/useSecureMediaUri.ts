import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  canonicalMediaUri,
  getMediaAuthScope,
  resolveMediaReadUrl,
  subscribeMediaAuthScope,
} from '@/utils/mediaAccess';

/** Resolves/renews a media URL while preserving player identity across refreshes. */
export function useSecureMediaUri(uri: string | null | undefined): {
  uri: string | undefined;
  renew: () => void;
} {
  const mediaScope = useSyncExternalStore(subscribeMediaAuthScope, getMediaAuthScope, getMediaAuthScope);
  const [resolved, setResolved] = useState(() => ({
    sourceUri: uri,
    scope: mediaScope,
    uri: uri ? canonicalMediaUri(uri) : undefined,
  }));
  const generation = useRef(0);
  const identity = useRef({ sourceUri: uri, scope: mediaScope });
  if (identity.current.sourceUri !== uri || identity.current.scope !== mediaScope) {
    identity.current = { sourceUri: uri, scope: mediaScope };
    generation.current += 1;
  }

  const renew = useCallback(async (force = false) => {
    if (!uri) return;
    const requestGeneration = generation.current;
    const requestScope = mediaScope;
    try {
      const next = await resolveMediaReadUrl(uri, force, requestScope);
      if (
        generation.current === requestGeneration
        && identity.current.sourceUri === uri
        && identity.current.scope === requestScope
      ) {
        setResolved({ sourceUri: uri, scope: requestScope, uri: next });
      }
    } catch {
      // The canonical source remains safe if resolution fails or is cancelled.
    }
  }, [uri, mediaScope]);

  useEffect(() => {
    setResolved({
      sourceUri: uri,
      scope: mediaScope,
      uri: uri ? canonicalMediaUri(uri) : undefined,
    });
    void renew();
  }, [uri, mediaScope, renew]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void renew(true);
    });
    return () => subscription.remove();
  }, [renew]);

  const resolvedUri = resolved.sourceUri === uri && resolved.scope === mediaScope
    ? resolved.uri
    : uri ? canonicalMediaUri(uri) : undefined;
  return { uri: resolvedUri, renew: () => { void renew(true); } };
}