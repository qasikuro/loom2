import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}sky_journal_images/`
  : null;

async function ensureDir(): Promise<void> {
  if (!DIR) return;
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

function ext(uri: string): string {
  const raw = uri.split('?')[0].split('.').pop() ?? 'jpg';
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
}

function uniqueName(e: string): string {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${e}`;
}

export async function persistImageUri(uri: string): Promise<string> {
  if (!uri) return uri;

  if (Platform.OS === 'web') {
    if (!uri.startsWith('blob:')) return uri;
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return uri;
    }
  }

  if (!DIR) return uri;
  if (uri.startsWith(DIR)) return uri;

  try {
    await ensureDir();
    const dest = `${DIR}${uniqueName(ext(uri))}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}
