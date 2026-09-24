import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { resolveUri } from '@/context/AppContext';

interface FriendAvatarProps {
  name: string;
  uri?: string | null;
  online?: boolean;
  size?: number;
  borderColor?: string;
  initialColor?: string;
  largeOnlineDot?: boolean;
}

export function FriendAvatar({
  name, uri, online = false, size = 46, borderColor = '#8468C4',
  initialColor = '#EDE8FF', largeOnlineDot = false,
}: FriendAvatarProps) {
  const sourceUri = resolveUri(uri);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = !!sourceUri && sourceUri !== failedUri;

  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor }]}>
      <View style={[styles.clip, { borderRadius: (size - 4) / 2 }]}>
        {showImage ? (
          <Image
            source={{ uri: sourceUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            onError={() => setFailedUri(sourceUri)}
          />
        ) : (
          <Text style={[styles.initial, { color: initialColor, fontSize: size * 0.4 }]}>
            {name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      {online && (
        <View style={[
          styles.onlineDot,
          largeOnlineDot ? styles.largeOnlineDot : styles.smallOnlineDot,
        ]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 1.5,
    backgroundColor: '#160D31',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clip: {
    flex: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: 'Satoshi-Bold' },
  onlineDot: { position: 'absolute', backgroundColor: '#43DC8D', borderWidth: 2 },
  smallOnlineDot: { right: -1, bottom: 1, width: 9, height: 9, borderRadius: 5, borderColor: '#080513' },
  largeOnlineDot: { right: -2, bottom: -2, width: 14, height: 14, borderRadius: 7, borderColor: '#17152B' },
});