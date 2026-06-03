import { Icon } from '@/components/Icon';
import CropImageModal from '@/components/CropImageModal';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { persistImageUri, ImageUploadError } from '@/utils/persistImage';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { StoryPanel } from '@/context/AppContext';

interface MangaPanelEditorProps {
  panel: StoryPanel;
  index: number;
  total: number;
  onChange: (updated: StoryPanel) => void;
  onDelete: () => void;
}

export function MangaPanelEditor({ panel, index, total, onChange, onDelete }: MangaPanelEditorProps) {
  const [pendingUri, setPendingUri]   = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedUri, setFailedUri]     = useState<string | null>(null);

  async function pickImage() {
    setUploadError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingUri(result.assets[0].uri);
    }
  }

  async function doUpload(uri: string) {
    setUploadError(null);
    setFailedUri(null);
    setUploading(true);
    try {
      const persisted = await persistImageUri(uri);
      onChange({ ...panel, imageUri: persisted });
    } catch (err: unknown) {
      const msg = err instanceof ImageUploadError ? err.userMessage : 'Upload failed — check your connection and tap Retry.';
      setUploadError(msg);
      setFailedUri(uri);
    } finally {
      setUploading(false);
    }
  }

  async function handleCropDone(croppedUri: string) {
    setPendingUri(null);
    await doUpload(croppedUri);
  }

  async function handleRetry() {
    if (failedUri) await doUpload(failedUri);
  }

  const wordCount = panel.text.trim() ? panel.text.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <>
      <View style={pm.container}>

        {/* ── Image area ────────────────────────────────────── */}
        <TouchableOpacity
          style={pm.imageArea}
          onPress={uploadError ? handleRetry : pickImage}
          activeOpacity={0.88}
          disabled={uploading}
        >
          {panel.imageUri ? (
            <Image
              source={{ uri: panel.imageUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient
              colors={['#16112E', '#0D0A22', '#060412']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 0.7, y: 1 }}
            />
          )}

          {/* Bottom scrim for text legibility */}
          <LinearGradient
            colors={['transparent', 'rgba(4,3,12,0.70)']}
            style={pm.bottomScrim}
            pointerEvents="none"
          />

          {/* Panel number badge — top left */}
          <View style={pm.numBadge}>
            <Text style={pm.numBadgeTxt}>{index + 1}</Text>
          </View>

          {/* Delete button — top right */}
          {total > 1 && (
            <TouchableOpacity
              style={pm.deleteBtn}
              onPress={onDelete}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Icon name="trash-2" size={12} color="rgba(255,160,160,0.75)" />
            </TouchableOpacity>
          )}

          {/* State overlays */}
          {uploading ? (
            <View style={pm.stateOverlay}>
              <ActivityIndicator color="rgba(220,205,255,0.85)" size="large" />
              <Text style={pm.stateOverlayTxt}>Uploading…</Text>
            </View>
          ) : uploadError ? (
            <View style={pm.stateOverlay}>
              <View style={pm.stateIconWrap}>
                <Icon name="wifi-off" size={26} color="rgba(255,120,120,0.80)" />
              </View>
              <Text style={[pm.stateOverlayTxt, { color: 'rgba(255,140,140,0.90)' }]}>Upload failed</Text>
              <Text style={pm.stateOverlaySub}>Tap to retry</Text>
            </View>
          ) : !panel.imageUri ? (
            <View style={pm.stateOverlay}>
              <View style={pm.addImgIcon}>
                <Icon name="camera" size={24} color="rgba(200,184,232,0.55)" />
              </View>
              <Text style={pm.stateOverlayTxt}>Add scene</Text>
              <Text style={pm.stateOverlaySub}>Tap to choose from gallery</Text>
            </View>
          ) : (
            <View style={pm.imageEditOverlay}>
              <View style={pm.editChip}>
                <Icon name="camera" size={11} color="rgba(255,255,255,0.88)" />
                <Text style={pm.editChipTxt}>Change</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Upload error banner */}
        {uploadError && !uploading && (
          <View style={pm.errorRow}>
            <Icon name="alert-circle" size={12} color="#E05C5C" />
            <Text style={pm.errorTxt} numberOfLines={1}>{uploadError}</Text>
            <TouchableOpacity onPress={handleRetry} style={pm.retryBtn}>
              <Text style={pm.retryTxt}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Narration area ───────────────────────────────── */}
        <View style={pm.narrationArea}>
          <TextInput
            style={pm.narrationInput}
            placeholder="What unfolds in this scene..."
            placeholderTextColor="rgba(180,165,230,0.22)"
            value={panel.text}
            onChangeText={t => onChange({ ...panel, text: t })}
            multiline
            textAlignVertical="top"
            returnKeyType="default"
          />
          {wordCount > 0 && (
            <Text style={pm.wordCount}>{wordCount}w</Text>
          )}
        </View>

      </View>

      {pendingUri && (
        <CropImageModal
          visible
          uri={pendingUri}
          onDone={handleCropDone}
          onCancel={() => setPendingUri(null)}
        />
      )}
    </>
  );
}

const pm = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#08060F',
    borderWidth: 1,
    borderColor: 'rgba(200,185,255,0.08)',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 10,
  },

  imageArea: {
    width: '100%',
    aspectRatio: 3 / 4,
    position: 'relative',
    overflow: 'hidden',
  },

  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },

  numBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  numBadgeTxt: {
    fontSize: 13,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(255,255,255,0.82)',
  },

  deleteBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,100,100,0.20)',
  },

  stateOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,100,100,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stateOverlayTxt: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,210,255,0.70)',
  },
  stateOverlaySub: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.38)',
  },

  addImgIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(200,184,232,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,184,232,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  imageEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 16,
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  editChipTxt: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(255,255,255,0.88)',
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(224,92,92,0.16)',
  },
  errorTxt: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: '#E05C5C',
    lineHeight: 16,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.35)',
    backgroundColor: 'rgba(224,92,92,0.10)',
  },
  retryTxt: {
    fontSize: 11.5,
    fontFamily: 'Satoshi-Bold',
    color: '#E05C5C',
  },

  narrationArea: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,185,255,0.06)',
    gap: 0,
  },
  narrationInput: {
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic',
    color: 'rgba(230,220,255,0.82)',
    lineHeight: 22,
    minHeight: 72,
  },
  wordCount: {
    fontSize: 10,
    fontFamily: 'Satoshi-Medium',
    color: 'rgba(180,165,230,0.28)',
    textAlign: 'right',
    marginTop: 6,
  },
});
