import React from 'react';
import { Image } from 'expo-image';
import { Text } from 'react-native';
import { getStorigamSticker } from '@/assets/stickers';

interface Props {
  content: string;
  size: number;
  /** Fullscreen readers scale artwork without changing legacy emoji sizing. */
  imageSize?: number;
}

/** Shared by the editor and readers; existing emoji overlays remain readable. */
export function PanelSticker({ content, size, imageSize = size }: Props) {
  const sticker = getStorigamSticker(content);
  if (!sticker) {
    return <Text style={{ fontSize: size }}>{content}</Text>;
  }

  return (
    <Image
      source={sticker.source}
      style={{ width: imageSize, height: imageSize }}
      contentFit="contain"
      accessibilityLabel={sticker.label}
    />
  );
}