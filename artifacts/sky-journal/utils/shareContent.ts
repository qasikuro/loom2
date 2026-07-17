import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

async function tryShareImage(imageUri: string, dialogTitle: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) return false;
    const ext = (imageUri.split('.').pop()?.split('?')[0] ?? 'jpg').toLowerCase();
    const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg';
    const tmpUri = `${FileSystem.cacheDirectory}sky_share.${safeExt}`;
    const dl = await FileSystem.downloadAsync(imageUri, tmpUri);
    if (dl.status !== 200) return false;
    await Sharing.shareAsync(dl.uri, {
      dialogTitle,
      mimeType: safeExt === 'png' ? 'image/png' : 'image/jpeg',
      UTI: 'public.image',
    });
    return true;
  } catch {
    return false;
  }
}

export async function shareStory(opts: {
  title:      string;
  mood:       string;
  authorName: string;
  panels:     { imageUri?: string | null; text?: string | null }[];
}) {
  const { title, mood, authorName, panels } = opts;

  const firstText  = panels.find(p => p.text)?.text     ?? '';
  const firstImage = panels.find(p => p.imageUri)?.imageUri ?? null;

  const lines = [
    `✦ "${title}"`,
    mood ? `— ${mood}` : '',
    firstText ? `\n${firstText.slice(0, 120)}${firstText.length > 120 ? '…' : ''}` : '',
    `\nby ${authorName}  ·  Sky Journal`,
  ].filter(Boolean);

  const message = lines.join('\n');

  if (firstImage) {
    const shared = await tryShareImage(firstImage, title);
    if (shared) return;
  }

  await Share.share({ message, title }).catch(() => null);
}

export async function shareOutfit(opts: {
  name:        string;
  tags:        string[];
  description: string;
  imageUri:    string | null | undefined;
}) {
  const { name, tags, description, imageUri } = opts;

  const lines = [
    `✦ ${name}`,
    tags.length ? tags.map(t => `#${t}`).join('  ') : '',
    description ? description.slice(0, 120) : '',
    '\nLogged on Sky Journal ✨',
  ].filter(Boolean);

  const message = lines.join('\n');

  if (imageUri) {
    const shared = await tryShareImage(imageUri, name);
    if (shared) return;
  }

  await Share.share({ message, title: name }).catch(() => null);
}
