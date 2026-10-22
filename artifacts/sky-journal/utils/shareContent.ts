import { Alert, Platform, Share } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { resolveMediaReadUrl } from '@/utils/mediaAccess';

export type ShareContentOptions = {
  title: string;
  description?: string;
  /** A route that already exists in Expo Router. */
  path?: string;
  /** An already-verified public URL. Do not pass a development or signed media URL. */
  url?: string;
  /** Optional local or authorized media to share as a file when supported. */
  imageUri?: string | null;
  imageMimeType?: string;
};

/**
 * Creates an app-scheme link for an existing Expo Router path.
 * The app currently has no associated-domain setup, so this intentionally does
 * not fabricate an HTTPS landing URL.
 */
export function createStorigamDeepLink(path: string): string {
  const normalizedPath = path.replace(/^\/+/, '');
  return Platform.OS === 'web'
    ? `storigam:///${normalizedPath}`
    : ExpoLinking.createURL(`/${normalizedPath}`);
}

function isCancelled(error: unknown): boolean {
  return !!error && typeof error === 'object' &&
    'name' in error && (error as { name?: string }).name === 'AbortError';
}

function buildMessage(options: ShareContentOptions, url?: string): string {
  return [options.title.trim(), options.description?.trim(), url]
    .filter((part): part is string => !!part)
    .join('\n\n');
}

async function shareImage(imageUri: string, options: ShareContentOptions): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    let shareUri = imageUri;
    if (!shareUri.startsWith('file:')) {
      const cacheDirectory = FileSystem.cacheDirectory;
      if (!cacheDirectory) return false;
      const extensionFromUri = imageUri.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
      const extension = extensionFromUri && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extensionFromUri)
        ? extensionFromUri
        : 'jpg';
      const localUri = `${cacheDirectory}storigam-share-${Date.now()}.${extension}`;
      const resolvedUri = await resolveMediaReadUrl(imageUri);
      const download = await FileSystem.downloadAsync(resolvedUri, localUri);
      if (download.status !== 200) return false;
      shareUri = download.uri;
    }
    await Sharing.shareAsync(shareUri, {
      dialogTitle: options.title,
      mimeType: options.imageMimeType ?? 'image/jpeg',
      UTI: 'public.image',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the platform share sheet. Native app routes are shared as Storigam
 * deep links; web shares use the browser's current route only when explicitly
 * supplied as a verified URL. When browser sharing is unavailable, copy the
 * share text/link instead.
 */
export async function shareContent(options: ShareContentOptions): Promise<void> {
  const url = options.url ?? (options.path ? createStorigamDeepLink(options.path) : undefined);
  const message = buildMessage(options, Platform.OS === 'ios' ? undefined : url);

  if (options.imageUri && Platform.OS !== 'web') {
    if (await shareImage(options.imageUri, options)) return;
  }

  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: options.title,
          text: options.description ?? options.title,
          ...(url ? { url } : {}),
        });
        return;
      } catch (error) {
        if (isCancelled(error)) return;
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        if (typeof window !== 'undefined') window.alert('Share details copied.');
        return;
      }
    } catch {
      // Fall through to the platform Share API as the last available option.
    }
  }

  try {
    const result = await Share.share(
      {
        title: options.title,
        message,
        ...(Platform.OS === 'ios' && url ? { url } : {}),
      },
      { dialogTitle: options.title },
    );
    if (result.action === Share.dismissedAction) return;
  } catch {
    const fallback = url
      ? `The share menu could not open. You can copy this app link instead:\n\n${url}`
      : 'The share menu could not open. Please try again.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(fallback);
    } else {
      Alert.alert('Could not share', fallback);
    }
  }
}

export async function shareStory(opts: {
  id?: string;
  isPublic: boolean;
  title: string;
  mood: string;
  authorName: string;
  panels: { imageUri?: string | null; text?: string | null }[];
}): Promise<void> {
  const excerpt = opts.panels.find(panel => panel.text?.trim())?.text?.trim() ?? '';
  const trimmedExcerpt = excerpt.length > 160 ? `${excerpt.slice(0, 157)}…` : excerpt;
  const description = [
    opts.mood,
    trimmedExcerpt ? `“${trimmedExcerpt}”` : '',
    `By ${opts.authorName} · Storigam`,
  ].filter(Boolean).join('\n');

  await shareContent({
    title: opts.title,
    description,
    path: opts.id && opts.isPublic ? `/story/${encodeURIComponent(opts.id)}` : undefined,
  });
}

export async function shareOutfit(opts: {
  name: string;
  tags: string[];
  description: string;
  imageUri: string | null | undefined;
}): Promise<void> {
  const tagLine = opts.tags.length ? opts.tags.map(tag => `#${tag}`).join('  ') : '';
  const description = [
    tagLine,
    opts.description.trim().slice(0, 160),
    'Made with Storigam',
  ].filter(Boolean).join('\n');

  await shareContent({
    title: opts.name,
    description,
    imageUri: opts.imageUri,
  });
}
