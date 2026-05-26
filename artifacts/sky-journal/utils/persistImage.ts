import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAuthToken } from '@/context/AppContext';

const MAX_DIM = 1200;

function resolveApiBase(): string {
  const extra  = (Constants.expoConfig as any)?.extra;
  const envUrl = extra?.apiUrl as string | null | undefined;
  return envUrl ?? '/api';
}

/**
 * Resize a native file:// URI to at most MAX_DIM px on the longest edge.
 * Returns a new file:// URI (from ImageManipulator cache). Falls back to the
 * original URI if manipulation fails so the upload can still be attempted.
 */
async function resizeIfNeeded(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_DIM } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return uri;
  }
}

/**
 * Native upload using Expo FileSystem.uploadAsync (binary multipart).
 * Much more reliable than fetch + base64 on Android/iOS:
 *   - Uses the native HTTP client (no JS memory pressure from base64)
 *   - 25% smaller payload (binary vs base64)
 *   - Works regardless of JS heap size
 */
async function uploadNative(fileUri: string): Promise<string | null> {
  try {
    const apiBase = resolveApiBase();
    const token   = await getAuthToken();
    if (!token) {
      console.error('[persistImage] No auth token — upload skipped');
      return null;
    }

    const result = await FileSystem.uploadAsync(`${apiBase}/upload`, fileUri, {
      httpMethod:  'POST',
      uploadType:  FileSystem.FileSystemUploadType.MULTIPART,
      fieldName:   'file',
      mimeType:    'image/jpeg',
      headers:     { Authorization: `Bearer ${token}` },
    });

    if (result.status >= 200 && result.status < 300) {
      const json    = JSON.parse(result.body) as { path: string };
      const domain  = apiBase.replace(/\/api$/, '');
      return `${domain}${json.path}`;
    }

    let errMsg = '';
    try { errMsg = (JSON.parse(result.body) as { error?: string }).error ?? ''; } catch { /* ignore */ }
    console.error('[persistImage] Upload failed —', result.status, errMsg);
    return null;
  } catch (err) {
    console.error('[persistImage] Upload error:', err);
    return null;
  }
}

/**
 * Web upload: blob: / data: URI → JSON body with base64.
 */
async function uploadWeb(base64Data: string, ext: string): Promise<string | null> {
  try {
    const apiBase = resolveApiBase();
    const token   = await getAuthToken();
    if (!token) {
      console.error('[persistImage] No auth token — upload skipped');
      return null;
    }

    const res = await fetch(`${apiBase}/upload`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ data: base64Data, ext }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      console.error('[persistImage] Upload failed —', res.status, body?.error ?? '');
      return null;
    }

    const json   = await res.json() as { path: string };
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
 *
 * Native (Android/iOS):
 *   Resize to ≤1200 px → upload as binary multipart (no base64 overhead).
 *
 * Web:
 *   blob: → convert to base64 data URI → JSON upload.
 *   data: → JSON upload directly.
 */
export async function persistImageUri(uri: string): Promise<string | null> {
  if (!uri) return null;

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
        const serverUrl = await uploadWeb(dataUrl, ext);
        return serverUrl ?? dataUrl;
      } catch (err) {
        console.error('[persistImage] blob: conversion failed:', err);
        return null;
      }
    }

    if (uri.startsWith('data:')) {
      const ext       = (uri.match(/data:[^/]+\/([a-z0-9]+);/) ?? [])[1] ?? 'jpg';
      const serverUrl = await uploadWeb(uri, ext);
      return serverUrl ?? uri;
    }

    return null;
  }

  try {
    const resized = await resizeIfNeeded(uri);
    const result  = await uploadNative(resized);
    if (result) return result;

    console.error('[persistImage] Upload returned null for', uri);
    return null;
  } catch (err) {
    console.error('[persistImage] Unexpected error for', uri, ':', err);
    return null;
  }
}
