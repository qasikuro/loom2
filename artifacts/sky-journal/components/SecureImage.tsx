import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import type { ImageErrorEventData, ImageProps } from 'expo-image';
import {
  canonicalMediaUri,
  getMediaAuthScope,
  resolveMediaReadUrl,
  subscribeMediaAuthScope,
} from '../utils/mediaAccess';

function uriFromSource(source: ImageProps['source']): string | undefined {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && 'uri' in source && typeof source.uri === 'string') {
    return source.uri;
  }
  return undefined;
}

/** Drop-in Expo Image that renews managed API media on entry, resume, and load failure. */
export function SecureImage({ source, onError, recyclingKey: callerRecyclingKey, ...props }: ImageProps) {
  const originalUri = uriFromSource(source);
  const mediaScope = useSyncExternalStore(subscribeMediaAuthScope, getMediaAuthScope, getMediaAuthScope);
  const sourceIdentity = originalUri ?? (typeof source === 'number' ? `asset:${source}` : null);
  const secureRecyclingKey = JSON.stringify([callerRecyclingKey ?? null, mediaScope, sourceIdentity]);
  const [resolved, setResolved] = useState(() => ({
    sourceUri: originalUri,
    scope: mediaScope,
    uri: originalUri ? canonicalMediaUri(originalUri) : undefined,
  }));
  const failedUri = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const identity = useRef({ sourceUri: originalUri, scope: mediaScope });
  if (identity.current.sourceUri !== originalUri || identity.current.scope !== mediaScope) {
    identity.current = { sourceUri: originalUri, scope: mediaScope };
    generation.current += 1;
  }

  const renew = useCallback(async (force = false) => {
    if (!originalUri) return;
    const requestGeneration = generation.current;
    const requestScope = mediaScope;
    try {
      const next = await resolveMediaReadUrl(originalUri, force, requestScope);
      if (
        generation.current === requestGeneration
        && identity.current.sourceUri === originalUri
        && identity.current.scope === requestScope
      ) {
        setResolved({ sourceUri: originalUri, scope: requestScope, uri: next });
      }
    } catch {
      // Keep the current URI visible; a native image error can trigger another renewal.
    }
  }, [originalUri, mediaScope]);

  useEffect(() => {
    failedUri.current = undefined;
    setResolved({
      sourceUri: originalUri,
      scope: mediaScope,
      uri: originalUri ? canonicalMediaUri(originalUri) : undefined,
    });
    void renew();
  }, [originalUri, mediaScope, renew]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void renew(true);
    });
    return () => subscription.remove();
  }, [renew]);

  const resolvedUri = resolved.sourceUri === originalUri && resolved.scope === mediaScope
    ? resolved.uri
    : originalUri ? canonicalMediaUri(originalUri) : undefined;
  const handleError: ImageProps['onError'] = useCallback((event: ImageErrorEventData) => {
    onError?.(event);
    if (originalUri && failedUri.current !== resolvedUri) {
      failedUri.current = resolvedUri;
      void renew(true);
    }
  }, [onError, originalUri, resolvedUri, renew]);

  const renderedSource = source && typeof source === 'object' && 'uri' in source && resolvedUri
    ? { ...source, uri: resolvedUri }
    : typeof source === 'string' && resolvedUri
      ? resolvedUri
      : source;

  return <ExpoImage {...props} recyclingKey={secureRecyclingKey} source={renderedSource} onError={handleError} />;
}