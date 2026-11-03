import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SecureImage as Image } from '@/components/SecureImage';
import type { StoryPanel } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@workspace/storigam-kindness/hooks/use-colors';

type ArticlePanel = Pick<
  StoryPanel,
  'text' | 'imageUri' | 'imageAspectRatio' | 'articleBlock' | 'articleEmphasis'
>;

export function RichStoryBlock({
  panel,
  onImagePress,
}: {
  panel: ArticlePanel;
  onImagePress?: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, 760);
  const { isDark } = useTheme();
  const colors = useColors(isDark ? 'dark' : 'light');
  const kind = panel.articleBlock ?? 'paragraph';
  const hasImage = kind === 'image' || !!panel.imageUri;

  if (hasImage) {
    if (!panel.imageUri) return null;
    const imageWidth = Math.max(1, width - 40);
    const ratio = panel.imageAspectRatio && panel.imageAspectRatio > 0
      ? panel.imageAspectRatio
      : 1.45;
    return (
      <Pressable
        style={styles.imageFrame}
        onPress={onImagePress}
        disabled={!onImagePress}
        accessibilityRole={onImagePress ? 'button' : undefined}
        accessibilityLabel={onImagePress ? 'Open story image' : undefined}
      >
        <Image
          source={{ uri: panel.imageUri }}
          style={{ width: imageWidth, aspectRatio: ratio, maxHeight: 520 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessibilityLabel="Story illustration"
        />
      </Pressable>
    );
  }

  if (!panel.text.trim()) return null;
  if (kind === 'quote') {
    return (
      <View style={[styles.quote, { borderLeftColor: colors.primary, backgroundColor: colors.card }]}>
        <Text
          style={[
            styles.quoteText,
            { color: colors.foreground },
            panel.articleEmphasis === 'bold' && styles.bold,
          ]}
        >
          {panel.text}
        </Text>
      </View>
    );
  }

  if (kind === 'heading') {
    return (
      <Text
        accessibilityRole="header"
        style={[
          styles.heading,
          { color: colors.foreground },
          panel.articleEmphasis === 'italic' && styles.italic,
        ]}
      >
        {panel.text}
      </Text>
    );
  }

  if (kind === 'bullet') {
    return (
      <View style={styles.bulletRow}>
        <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
        <Text
          style={[
            styles.paragraph,
            { color: colors.foreground },
            panel.articleEmphasis === 'bold' && styles.bold,
            panel.articleEmphasis === 'italic' && styles.italic,
          ]}
        >
          {panel.text}
        </Text>
      </View>
    );
  }

  return (
    <Text
      style={[
        styles.paragraph,
        { color: colors.foreground },
        panel.articleEmphasis === 'bold' && styles.bold,
        panel.articleEmphasis === 'italic' && styles.italic,
      ]}
    >
      {panel.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  imageFrame: {
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
    marginVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
  },
  heading: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 25,
    lineHeight: 33,
    marginTop: 16,
    marginBottom: 2,
    letterSpacing: -0.4,
  },
  paragraph: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 18,
    lineHeight: 30,
    letterSpacing: 0.05,
  },
  quote: {
    borderLeftWidth: 3,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 17,
    marginVertical: 5,
  },
  quoteText: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 18,
    lineHeight: 29,
    fontStyle: 'italic',
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 12 },
  bold: { fontFamily: 'Satoshi-Bold' },
  italic: { fontStyle: 'italic' },
});
