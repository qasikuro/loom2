import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAuthToken } from '@/context/AppContext';

const DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}sky_journal_images/`
  : null;

function resolveApiBase(): string {
  const extra  = (Constants.expoConfig as any)?.extra;
  const envUrl = extra?.apiUrl as string | null | undefined;
  return envUrl ?? '/api';
}

async function ensureDir(): Promise<void> {
  if (!DIR) return;
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

function extFromUri(uri: string): string {
  const raw = uri.split('?')[0].split('.').pop() ?? 'jpg';
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
}

function uniqueName(e: string): string {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${e}`;
}

async function uploadToServer(base64Data: string, ext: string): Promise<string | null> {
  try {
    const apiBase = resolveApiBase();
    const token = await getAuthToken();
    if (!token) return null;
    const res = await fetch(`${apiBase}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data: base64Data, ext }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { path: string };
    const domain = apiBase.replace(/\/api$/, '');
    return `${domain}${json.path}`;
  } catch {
    return null;
  }
}

export async function persistImageUri(uri: string): Promise<string> {
  if (!uri) return uri;

  // Already a remote URL — nothing to do
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;

  if (Platform.OS === 'web') {
    // Web: handle blob: and data: URIs
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
        return serverUrl ?? dataUrl;
      } catch {
        return uri;
      }
    }

    if (uri.startsWith('data:')) {
      const ext       = (uri.match(/data:[^/]+\/([a-z0-9]+);/) ?? [])[1] ?? 'jpg';
      const serverUrl = await uploadToServer(uri, ext);
      return serverUrl ?? uri;
    }

    return uri;
  }

  // Native (iOS / Android):
  // Read as base64 DIRECTLY from the source URI — no copyAsync needed.
  // copyAsync was failing on Android because ImagePicker cache files are
  // sometimes read-only or locked; readAsStringAsync works without copying.
  try {
    const ext       = extFromUri(uri);
    const base64    = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const serverUrl = await uploadToServer(base64, ext);
    if (serverUrl) return serverUrl;

    // Upload failed — save a local copy as fallback so the image at least
    // works on THIS device (it won't be visible to others).
    try {
      await ensureDir();
      const dest = `${DIR}${uniqueName(ext)}`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      return dest;
    } catch {
      return uri;
    }
  } catch {
    return uri;
  }
}
