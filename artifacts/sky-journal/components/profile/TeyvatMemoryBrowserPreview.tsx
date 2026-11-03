import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

// Metro requires compile-time asset references for local images.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BOX_ART = require('../../assets/teyvat/memory_box_closed.png');

export function TeyvatMemoryBrowserPreview() {
  return (
    <View style={styles.page}>
      <Image source={BOX_ART} style={styles.art} resizeMode="contain" />
      <Text style={styles.title}>Teyvat Memory Preview</Text>
      <Text style={styles.copy}>Open this route in a browser to preview the Rive animation.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0B0817',
  },
  art: { width: 220, height: 180 },
  title: { color: '#F6EEFF', fontSize: 22, fontWeight: '700', marginTop: 12 },
  copy: { color: '#B7A7D0', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
