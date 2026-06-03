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
 * Typed error thrown by persistImageUri on failure.
 * Callers can catch this to display `err.userMessage` instead of a generic string.
 */
export class ImageUploadError extends Error {
  constructor(
    public readonly userMessage: string,
    cause?: unknown,
  ) {
    super(userMessage);
    this.name = 'ImageUploadError';
    if (cause instanceof Error) this.cause = cause;
  }
}

/**
 * Returns true for errors that should NOT be retried (auth, quota, format issues).
 */
function isNonRetryable(err: unknown): boolean {
  if (!(err instanceof ImageUploadError)) return false;
  const msg = err.userMessage;
  return (
    msg.includes('signed in') ||
    msg.includes('Session expired') ||
    msg.includes('too large') ||
    msg.includes('Unsupported image') ||
    msg.includes('No image')
  );
}

/**
 * Retry wrapper — attempts `fn` up to `maxAttempts` times.
 * Waits `delayMs` between each attempt. Skips retry for non-transient errors.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isNonRetryable(err)) throw err;
      if (attempt < maxAttempts) {
        await new Promise<void>(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
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
async function uploadNative(fileUri: string): Promise<string> {
  const apiBase = resolveApiBase();
  const token   = await getAuthToken();
  if (!token) {
    throw new ImageUploadError('You need to be signed in to upload photos.');
  }

  let result: FileSystem.FileSystemUploadResult;
  try {
    result = await FileSystem.uploadAsync(`${apiBase}/upload`, fileUri, {
      httpMethod:  'POST',
      uploadType:  FileSystem.FileSystemUploadType.MULTIPART,
      fieldName:   'file',
      mimeType:    'image/jpeg',
      headers:     { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    throw new ImageUploadError(
      'Could not reach the server — check your connection and try again.',
      err,
    );
  }

  if (result.status >= 200 && result.status < 300) {
    try {
      const json    = JSON.parse(result.body) as { path: string };
      const domain  = apiBase.replace(/\/api$/, '');
      return `${domain}${json.path}`;
    } catch {
      throw new ImageUploadError('The server returned an unexpected response. Please try again.');
    }
  }

  if (result.status === 401 || result.status === 403) {
    throw new ImageUploadError('Session expired — please sign out and back in, then try again.');
  }
  if (result.status === 413) {
    throw new ImageUploadError('That photo is too large. Try a smaller image.');
  }
  if (result.status >= 500) {
    throw new ImageUploadError('The server ran into an error. Please try again in a moment.');
  }

  let errMsg = '';
  try { errMsg = (JSON.parse(result.body) as { error?: string }).error ?? ''; } catch { /* ignore */ }
  throw new ImageUploadError(
    errMsg || `Upload failed (${result.status}) — please try again.`,
  );
}

/**
 * Web upload: blob: / data: URI → JSON body with base64.
 */
async function uploadWeb(base64Data: string, ext: string): Promise<string> {
  const apiBase = resolveApiBase();
  const token   = await getAuthToken();
  if (!token) {
    throw new ImageUploadError('You need to be signed in to upload photos.');
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase}/upload`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ data: base64Data, ext }),
    });
  } catch (err) {
    throw new ImageUploadError(
      'Could not reach the server — check your connection and try again.',
      err,
    );
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ImageUploadError('Session expired — please sign out and back in, then try again.');
    }
    if (res.status === 413) {
      throw new ImageUploadError('That photo is too large. Try a smaller image.');
    }
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new ImageUploadError(
      body?.error || `Upload failed (${res.status}) — please try again.`,
    );
  }

  const json   = await res.json() as { path: string };
  const domain = apiBase.replace(/\/api$/, '');
  return `${domain}${json.path}`;
}

/**
 * Uploads a local/blob/data URI to the server and returns the permanent https URL.
 * Retries up to 3 times (1 s back-off) for transient network/server errors.
 * Throws `ImageUploadError` on final failure — callers should catch and display `err.userMessage`.
 *
 * Native (Android/iOS):
 *   Resize to ≤1200 px → upload as binary multipart (no base64 overhead).
 *
 * Web:
 *   blob: → convert to base64 data URI → JSON upload.
 *   data: → JSON upload directly.
 */
export async function persistImageUri(uri: string): Promise<string> {
  if (!uri) throw new ImageUploadError('No image was selected.');

  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;

  if (Platform.OS === 'web') {
    if (uri.startsWith('blob:')) {
      let dataUrl: string;
      try {
        const res  = await fetch(uri);
        const blob = await res.blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror   = reject;
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        throw new ImageUploadError('Could not read the selected image. Please try again.', err);
      }
      const ext = (dataUrl.match(/data:[^/]+\/([a-z0-9]+);/) ?? [])[1] ?? 'jpg';
      return withRetry(() => uploadWeb(dataUrl, ext), 3, 1000);
    }

    if (uri.startsWith('data:')) {
      const ext = (uri.match(/data:[^/]+\/([a-z0-9]+);/) ?? [])[1] ?? 'jpg';
      return withRetry(() => uploadWeb(uri, ext), 3, 1000);
    }

    throw new ImageUploadError('Unsupported image format.');
  }

  const resized = await resizeIfNeeded(uri);
  return withRetry(() => uploadNative(resized), 3, 1000);
}

/**
 * Safe wrapper — returns null instead of throwing.
 * Use when you already have your own try/catch or just need a null-check.
 * @deprecated Prefer calling `persistImageUri` directly in a try/catch so you can
 * display `err.userMessage` to the user.
 */
export async function persistImageUriSafe(uri: string): Promise<string | null> {
  try {
    return await persistImageUri(uri);
  } catch {
    return null;
  }
}
