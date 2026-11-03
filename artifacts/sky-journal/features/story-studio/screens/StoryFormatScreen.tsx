import React from 'react';
import { ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@workspace/storigam-kindness/hooks/use-colors';

export default function StoryFormatScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = useColors(isDark ? 'dark' : 'light');
  const params = useLocalSearchParams<{ eventPrompt?: string; eventMood?: string }>();
  const top = Platform.OS === 'web' ? 20 : insets.top;

  function openEditor(pathname: '/chapter-editor' | '/text-story') {
    const routeParams = {
      ...(params.eventPrompt ? { eventPrompt: String(params.eventPrompt) } : {}),
      ...(params.eventMood ? { eventMood: String(params.eventMood) } : {}),
    };
    router.push(Object.keys(routeParams).length
      ? { pathname, params: routeParams } as never
      : pathname as never);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.back, { borderColor: colors.border, backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Icon name="arrow-left" size={19} color={colors.foreground} />
        </Pressable>
        <View style={[styles.step, { backgroundColor: colors.muted }]}>
          <Icon name="book-open" size={14} color={colors.primary} />
          <Text style={[styles.stepText, { color: colors.mutedForeground, fontFamily: colors.fontFamily.medium }]}>
            {t('create.createStory')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, { color: colors.primary, fontFamily: colors.fontFamily.bold }]}>
          STORIGAM STORY STUDIO
        </Text>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
          {t('studioEditor.chooseFormatTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]}>
          {t('studioEditor.chooseFormatSubtitle')}
        </Text>

        <Pressable
          onPress={() => openEditor('/chapter-editor')}
          style={({ pressed }) => [
            styles.choice,
            styles.mangaChoice,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${t('studioEditor.mangaTitle')}. ${t('studioEditor.mangaDescription')}`}
          testID="story-format-manga"
        >
          <ImageBackground
            source={Images.create_chapter}
            resizeMode="cover"
            style={styles.art}
            imageStyle={styles.artImage}
          >
            <LinearGradient
              colors={['rgba(9,7,23,0.02)', 'rgba(9,7,23,0.93)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
            <View style={styles.choiceCopy}>
              <View style={[styles.iconBadge, { backgroundColor: colors.primary }]}>
                <Icon name="grid" size={19} color={colors.primaryForeground} />
              </View>
              <Text style={[styles.choiceTitle, { color: '#fff', fontFamily: colors.fontFamily.bold }]}>
                {t('studioEditor.mangaTitle')}
              </Text>
              <Text style={[styles.choiceDescription, { color: 'rgba(255,255,255,0.76)', fontFamily: colors.fontFamily.regular }]}>
                {t('studioEditor.mangaDescription')}
              </Text>
              <View style={styles.choiceLink}>
                <Text style={[styles.choiceLinkText, { color: '#fff', fontFamily: colors.fontFamily.bold }]}>
                  {t('create.createStory')}
                </Text>
                <Icon name="arrow-right" size={16} color="#fff" />
              </View>
            </View>
          </ImageBackground>
        </Pressable>

        <Pressable
          onPress={() => openEditor('/text-story')}
          style={({ pressed }) => [
            styles.choice,
            styles.textChoice,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${t('studioEditor.textStoryTitle')}. ${t('studioEditor.textStoryDescription')}`}
          testID="story-format-text"
        >
          <View style={[styles.paperGlow, { backgroundColor: colors.primary }]} />
          <View style={[styles.iconBadge, { backgroundColor: colors.secondary }]}>
            <Icon name="file-text" size={19} color={colors.primary} />
          </View>
          <View style={styles.textChoiceCopy}>
            <Text style={[styles.choiceTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
              {t('studioEditor.textStoryTitle')}
            </Text>
            <Text style={[styles.choiceDescription, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]}>
              {t('studioEditor.textStoryDescription')}
            </Text>
            <View style={styles.choiceLink}>
              <Text style={[styles.textLinkText, { color: colors.primary, fontFamily: colors.fontFamily.bold }]}>
                {t('studioEditor.textStoryTitle')}
              </Text>
              <Icon name="arrow-right" size={16} color={colors.primary} />
            </View>
          </View>
          <View style={[styles.previewPaper, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.previewLine, { backgroundColor: colors.primary, width: '52%' }]} />
            <View style={[styles.previewLine, { backgroundColor: colors.border, width: '88%' }]} />
            <View style={[styles.previewLine, { backgroundColor: colors.border, width: '75%' }]} />
            <View style={[styles.previewQuote, { borderLeftColor: colors.primary, backgroundColor: colors.secondary }]} />
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  step: { minHeight: 34, borderRadius: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepText: { fontSize: 12 },
  content: { paddingHorizontal: 20, paddingTop: 42, paddingBottom: 44 },
  eyebrow: { fontSize: 10, letterSpacing: 2.1, marginBottom: 12 },
  title: { fontSize: 29, lineHeight: 36, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 23, marginTop: 8, marginBottom: 27, maxWidth: 340 },
  choice: { borderWidth: 1, borderRadius: 24, overflow: 'hidden', marginBottom: 16 },
  mangaChoice: { height: 228 },
  art: { flex: 1, justifyContent: 'flex-end' },
  artImage: { borderRadius: 23 },
  choiceCopy: { padding: 18, gap: 6 },
  iconBadge: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  choiceTitle: { fontSize: 20, letterSpacing: -0.25 },
  choiceDescription: { fontSize: 13, lineHeight: 19, maxWidth: 290 },
  choiceLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  choiceLinkText: { fontSize: 13 },
  textChoice: { minHeight: 176, flexDirection: 'row', padding: 18, gap: 14, position: 'relative' },
  paperGlow: { position: 'absolute', width: 130, height: 130, borderRadius: 65, opacity: 0.09, right: -24, top: -30 },
  textChoiceCopy: { flex: 1, justifyContent: 'center', gap: 6 },
  textLinkText: { fontSize: 13 },
  previewPaper: { width: 86, height: 122, borderRadius: 13, borderWidth: 1, padding: 10, justifyContent: 'center', gap: 8, alignSelf: 'center' },
  previewLine: { height: 4, borderRadius: 2 },
  previewQuote: { height: 28, borderLeftWidth: 2, borderRadius: 4, marginTop: 2 },
});
