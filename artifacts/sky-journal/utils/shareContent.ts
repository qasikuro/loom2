import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Placeholder deep-link base — swap for real domain/store link once published
const APP_URL = 'https://skyjournal.replit.app';

// ─── Story share ──────────────────────────────────────────────────────────────
export async function shareStory(opts: {
  id?:        string;
  title:      string;
  mood:       string;
  authorName: string;
  panels:     { imageUri?: string | null; text?: string | null }[];
}) {
  const { id, title, mood, authorName, panels } = opts;

  const excerpt   = panels.find(p => p.text?.trim())?.text ?? '';
  const trimmed   = excerpt.length > 160 ? `${excerpt.slice(0, 157)}…` : excerpt;
  const moodLine  = mood ? `${mood}` : '';
  const storyLink = id ? `${APP_URL}/story/${id}` : APP_URL;

  // Rich message — always shown regardless of whether an image is attached
  const lines: string[] = [
    `✦ "${title}"`,
    moodLine,
    trimmed ? `\n"${trimmed}"` : '',
    `\nby ${authorName} · Sky Journal`,
    `\n${storyLink}`,
  ];

  const message = lines.filter(Boolean).join('\n');

  // On native: use the built-in Share sheet (supports message + URL; shows app name in preview)
  // On web: fall back gracefully
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, text: message, url: storyLink }).catch(() => null);
    } else {
      await Share.share({ message, title }).catch(() => null);
    }
    return;
  }

  // Native path — always share the rich text message.
  // On iOS, Share.share also accepts `url` which renders a link preview card.
  await Share.share(
    Platform.OS === 'ios'
      ? { message, url: storyLink }
      : { message },
    { dialogTitle: `Share "${title}"` },
  ).catch(() => null);
}

// ─── Outfit share ─────────────────────────────────────────────────────────────
export async function shareOutfit(opts: {
  name:        string;
  tags:        string[];
  description: string;
  imageUri:    string | null | undefined;
}) {
  const { name, tags, description, imageUri } = opts;

  const tagLine   = tags.length ? tags.map(t => `#${t}`).join('  ') : '';
  const desc      = description.trim().slice(0, 160);

  const lines: string[] = [
    `✦ ${name}`,
    tagLine,
    desc ? `\n"${desc}"` : '',
    `\nLogged on Sky Journal ✨`,
    `\n${APP_URL}`,
  ];

  const message = lines.filter(Boolean).join('\n');

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: name, text: message, url: APP_URL }).catch(() => null);
    } else {
      await Share.share({ message, title: name }).catch(() => null);
    }
    return;
  }

  // If there's an image AND sharing is available, offer both paths:
  // Try native share-with-file so the image appears in the share sheet alongside the caption.
  if (imageUri) {
    try {
      const available = await Sharing.isAvailableAsync();
      if (available) {
        const ext = (imageUri.split('.').pop()?.split('?')[0] ?? 'jpg').toLowerCase();
        const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg';
        const tmpUri  = `${FileSystem.cacheDirectory}sky_outfit_share.${safeExt}`;
        const dl      = await FileSystem.downloadAsync(imageUri, tmpUri);
        if (dl.status === 200) {
          // shareAsync opens the native sheet with the image; caption goes in dialogTitle / subject
          await Sharing.shareAsync(dl.uri, {
            dialogTitle: message,          // shown as subject on Android
            mimeType: safeExt === 'png' ? 'image/png' : 'image/jpeg',
            UTI: 'public.image',
          });
          return;
        }
      }
    } catch {
      // fall through to text share
    }
  }

  await Share.share(
    Platform.OS === 'ios'
      ? { message, url: APP_URL }
      : { message },
    { dialogTitle: `Share outfit: ${name}` },
  ).catch(() => null);
}
