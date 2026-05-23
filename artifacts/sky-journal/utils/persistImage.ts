import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAuthToken } from '@/context/AppContext';

function resolveApiBase(): string {
  const extra  = (Constants.expoConfig as any)?.extra;
  const envUrl = extra?.apiUrl as string | null | undefined;
  return envUrl ?? '/api';
}

function extFromUri(uri: string): string {
  const raw = uri.split('?')[0].split('.').pop() ?? 'jpg';
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
}

async function uploadToServer(base64Data: string, ext: string): Promise<string | null> {
  try {
    const apiBase = resolveApiBase();
    const token = await getAuthToken();
    if (!token) {
      console.error('[persistImage] No auth token — upload skipped');
      return null;
    }
    const res = await fetch(`${apiBase}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data: base64Data, ext }),
    });
    if (!res.ok) {
      console.error('[persistImage] Upload failed — server returned', res.status);
      return null;
    }
    const json = await res.json() as { path: string };
    const domain = apiBase.replace(/\/api$/, '');
    return `${domain}${json.path}`;
  } catch (err) {
    console.error('[persistImage] Upload fetch error:', err);
    return null;
  }
}

/**
 * Uploads a local/blob/data URI to the server and returns the permanent https URL.
 * Returns null if the upload fails — callers must handle null and show an error.
 * Never stores local file:// paths (they are device-specific and invisible to others).
 */
export async function persistImageUri(uri: string): Promise<string | null> {
  if (!uri) return null;

  // Already a remote URL — nothing to do
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;

  if (Platform.OS === 'web') {
    if (uri.startsWith('blob:')) {
      try {
        const res     = await fetch(uri);
        const blob    = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror   = reject;
          reader.readAsDataURL(blob);
        });
        const ext       = (dataUrl.match(/data:[^/]+\/([a-z0-9]+);/) ?? [])[1] ?? 'jpg';
        const serverUrl = await uploadToServer(dataUrl, ext);
        return serverUrl ?? dataUrl; // keep data: on web as display fallback
      } catch (err) {
        console.error('[persistImage] blob: conversion failed:', err);
        return null;
      }
    }

    if (uri.startsWith('data:')) {
      const ext       = (uri.match(/data:[^/]+\/([a-z0-9]+);/) ?? [])[1] ?? 'jpg';
      const serverUrl = await uploadToServer(uri, ext);
      return serverUrl ?? uri; // keep data: on web as display fallback
    }

    return null;
  }

  // Native (iOS / Android):
  // Read file as base64 and upload. If upload fails, return null so the caller
  // can show a visible error. We never fall back to local file:// paths because
  // they are device-specific and invisible to other users.
  try {
    const ext    = extFromUri(uri);
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const serverUrl = await uploadToServer(base64, ext);
    if (serverUrl) return serverUrl;

    console.error('[persistImage] GCS upload returned null for', uri);
    return null;
  } catch (err) {
    console.error('[persistImage] readAsStringAsync failed for', uri, ':', err);
    return null;
  }
}
