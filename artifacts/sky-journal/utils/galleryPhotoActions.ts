import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { resolveMediaReadUrl } from '@/utils/mediaAccess';

interface ImageFileInfo {
  extension: string;
  mimeType: string;
}

function getImageFileInfo(uri: string): ImageFileInfo {
  const extension = uri.split(/[?#]/, 1)[0].split('.').pop()?.toLowerCase() ?? '';
  const safeExtension = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'].includes(extension)
    ? extension
    : 'jpg';
  const mimeType = safeExtension === 'png'
    ? 'image/png'
    : safeExtension === 'webp'
      ? 'image/webp'
      : safeExtension === 'gif'
        ? 'image/gif'
        : safeExtension === 'heic'
          ? 'image/heic'
          : 'image/jpeg';

  return { extension: safeExtension, mimeType };
}

function makeFileName(uri: string): string {
  const { extension } = getImageFileInfo(uri);
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `storigam-gallery-${uniquePart}.${extension}`;
}

async function downloadPhotoToCache(imageUri: string, fileName: string): Promise<string> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error('Photo cache is unavailable.');

  const readUrl = await resolveMediaReadUrl(imageUri);
  const destination = `${cacheDirectory}${fileName}`;
  const download = await FileSystem.downloadAsync(readUrl, destination);
  if (download.status < 200 || download.status >= 300) {
    await FileSystem.deleteAsync(download.uri, { idempotent: true }).catch(() => {});
    throw new Error('Could not download this photo.');
  }

  return download.uri;
}

async function fetchPhotoBlob(imageUri: string): Promise<Blob> {
  const readUrl = await resolveMediaReadUrl(imageUri);
  const response = await fetch(readUrl);
  if (!response.ok) throw new Error('Could not download this photo.');
  return response.blob();
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function saveGalleryPhotoToDevice(
  imageUri: string,
): Promise<{ granted: boolean; canAskAgain?: boolean }> {
  const fileName = makeFileName(imageUri);

  if (Platform.OS === 'web') {
    triggerBrowserDownload(await fetchPhotoBlob(imageUri), fileName);
    return { granted: true };
  }

  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    return { granted: false, canAskAgain: permission.canAskAgain };
  }

  const localUri = await downloadPhotoToCache(imageUri, fileName);
  try {
    await MediaLibrary.saveToLibraryAsync(localUri);
  } finally {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
  }

  return { granted: true };
}

export async function shareGalleryPhoto(imageUri: string): Promise<void> {
  const fileName = makeFileName(imageUri);
  const { mimeType } = getImageFileInfo(imageUri);

  if (Platform.OS === 'web') {
    const blob = await fetchPhotoBlob(imageUri);
    const file = new File([blob], fileName, { type: blob.type || mimeType });
    const webNavigator = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string }) => Promise<void>;
    };
    if (!webNavigator.share || !webNavigator.canShare?.({ files: [file] })) {
      throw new Error('Photo sharing is unavailable in this browser.');
    }
    await webNavigator.share({ files: [file], title: 'Storigam photo' });
    return;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Photo sharing is unavailable on this device.');
  }

  const localUri = await downloadPhotoToCache(imageUri, fileName);
  try {
    await Sharing.shareAsync(localUri, {
      dialogTitle: 'Share Storigam photo',
      mimeType,
      UTI: 'public.image',
    });
  } finally {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
  }
}