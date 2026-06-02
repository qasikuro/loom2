import type { GalleryPhoto } from '@/context/AppContext';
import { useRef, useState } from 'react';

interface GalleryDeps {
  galleryUsage: { limit: number; count: number };
  addGalleryPhoto: (uri: string, caption: string) => Promise<void>;
  deleteGalleryPhoto: (id: string) => void;
}

export function useGalleryState({ galleryUsage, addGalleryPhoto, deleteGalleryPhoto }: GalleryDeps) {
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryError,     setGalleryError]     = useState<string | null>(null);
  const [selectedPhoto,    setSelectedPhoto]    = useState<GalleryPhoto | null>(null);
  const [deletingPhoto,    setDeletingPhoto]    = useState(false);
  const deletePhotoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleAddGalleryPhoto() {
    const remaining = galleryUsage.limit - galleryUsage.count;
    if (remaining <= 0) { setGalleryError(`Gallery full (${galleryUsage.limit} photos max)`); return; }
    const { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync } = await import('expo-image-picker');
    const perm = await requestMediaLibraryPermissionsAsync();
    if ((perm.status as string) === 'denied' || (perm.status as string) === 'restricted') {
      setGalleryError('Photo access denied — enable it in Settings.'); return;
    }
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images'] as any, allowsEditing: false,
      allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    setGalleryUploading(true); setGalleryError(null);
    try {
      const { persistImageUri } = await import('@/utils/persistImage');
      const results = await Promise.allSettled(result.assets.map(async asset => {
        const uri = await persistImageUri(asset.uri);
        if (!uri) throw new Error('Upload failed');
        await addGalleryPhoto(uri, '');
      }));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) setGalleryError(`${failed} photo${failed > 1 ? 's' : ''} failed to upload.`);
    } catch (err: any) { setGalleryError(err?.message ?? 'Upload failed'); }
    finally { setGalleryUploading(false); }
  }

  function openPhoto(photo: GalleryPhoto) { setSelectedPhoto(photo); setDeletingPhoto(false); }
  function closePhoto() { setSelectedPhoto(null); setDeletingPhoto(false); }
  function handleDeletePhoto() {
    if (!selectedPhoto) return;
    if (deletingPhoto) {
      if (deletePhotoTimer.current) clearTimeout(deletePhotoTimer.current);
      deleteGalleryPhoto(selectedPhoto.id); closePhoto();
    } else {
      setDeletingPhoto(true);
      deletePhotoTimer.current = setTimeout(() => setDeletingPhoto(false), 3000);
    }
  }

  return {
    galleryUploading, galleryError,
    selectedPhoto, deletingPhoto,
    handleAddGalleryPhoto, openPhoto, closePhoto, handleDeletePhoto,
  };
}
