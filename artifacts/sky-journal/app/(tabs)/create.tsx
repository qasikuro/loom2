import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SecureImage as Image } from '@/components/SecureImage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAiFeatureAccess } from '@/features/ai/aiFeatureAccess';
import { getResumableStoryDraft, type ResumableStoryDraft } from '@/utils/entryDraftStore';
import { useColors as useDesignSystemColors } from '@workspace/storigam-kindness/hooks/use-colors';

const MORE_MODES = [
  {
    id: 'quick',
    icon: 'sparkles' as const,
    nameKey: 'feature.create.quick',
    descriptionKey: 'feature.create.quickDesc',
    route: '/quick-moment',
  },
  {
    id: 'journal',
    icon: 'feather' as const,
    nameKey: 'feature.create.journal',
    descriptionKey: 'feature.create.journalDesc',
    route: '/(tabs)/log',
  },
  {
    id: 'video',
    icon: 'video' as const,
    nameKey: 'feature.create.video',
    descriptionKey: 'feature.create.videoDesc',
    route: '/post-video',
  },
  {
    id: 'books',
    icon: 'book-open' as const,
    nameKey: 'studioEditor.myBooksTitle',
    route: '/my-books',
  },
  {
    id: 'dashboard',
    icon: 'trending-up' as const,
    nameKey: 'feature.create.dashboard',
    descriptionKey: 'feature.create.dashboardDesc',
    route: '/creator-dashboard',
  },
] as const;

function withAlpha(color: string, alpha: number): string {
  const normalized = color.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return color;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export default function CreateScreen() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const colors = useDesignSystemColors(isDark ? 'dark' : 'light');
  const aiAccess = useAiFeatureAccess();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.min(windowHeight * 0.92, 820);
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  const { eventPrompt, eventMood } = useLocalSearchParams<{
    eventPrompt?: string;
    eventMood?: string;
  }>();
  const hasEventContext = !!eventPrompt;
  const [savedDraft, setSavedDraft] = useState<ResumableStoryDraft | null>(null);

  const sheetY = useRef(new Animated.Value(sheetHeight)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    sheetY.setValue(sheetHeight);
    bgOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(sheetY, {
        toValue: 0,
        tension: 48,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    let active = true;
    void getResumableStoryDraft()
      .then(draft => {
        if (active) setSavedDraft(draft);
      })
      .catch(() => {
        if (active) setSavedDraft(null);
      });

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stable Animated.Value refs; the sheet height controls its entrance
  }, [sheetHeight]));

  function closeAfterAnimation(onClosed: () => void) {
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: sheetHeight,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(onClosed);
  }

  function dismiss() {
    closeAfterAnimation(() => {
      // Return to the Home tab.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace('/(tabs)' as any);
    });
  }

  function selectMode(route: string, extraParams?: Record<string, string>) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeAfterAnimation(() => {
      const params = {
        ...(hasEventContext && eventPrompt ? { eventPrompt: String(eventPrompt) } : {}),
        ...(hasEventContext && eventMood ? { eventMood: String(eventMood) } : {}),
        ...extraParams,
      };
      if (Object.keys(params).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push({ pathname: route as any, params } as any);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(route as any);
      }
    });
  }

  function resumeSavedDraft(draft: ResumableStoryDraft) {
    const route = draft.kind === 'manga' ? '/quick-moment' : '/chapter-editor';
    selectMode(route, { resumeDraft: '1' });
  }

  const visibleModes = MORE_MODES.filter(mode => mode.id !== 'quick' || aiAccess.enabled);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          s.scrim,
          { backgroundColor: withAlpha(colors.background, 0.76), opacity: bgOpacity },
        ]}
        pointerEvents="none"
      />

      <Pressable
        style={s.dismissArea}
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />

      <Animated.View
        style={[
          s.sheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: colors.foreground,
            borderTopLeftRadius: colors.radius,
            borderTopRightRadius: colors.radius,
            height: sheetHeight,
            paddingBottom: botPad,
            transform: [{ translateY: sheetY }],
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={[s.handle, { backgroundColor: colors.border }]} />

        <View style={s.headerRow}>
          <View style={s.headerCopy}>
            <Text style={[s.sheetTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
              {t('feature.create.title')}
            </Text>
            <Text style={[s.sheetSub, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]}>
              {t('feature.create.subtitle')}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.closeBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={dismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            testID="create-close"
          >
            <Icon name="x" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {hasEventContext && (
          <View style={[s.eventCtx, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[s.eventCtxLabel, { color: colors.primary, fontFamily: colors.fontFamily.bold }]}>
              {t('feature.create.eventPrompt')}
            </Text>
            <Text style={[s.eventCtxText, { color: colors.foreground, fontFamily: colors.fontFamily.regular }]} numberOfLines={3}>
              {eventPrompt}
            </Text>
          </View>
        )}

        <ScrollView
          style={s.contentScroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {aiAccess.hasError && (
            <TouchableOpacity
              onPress={() => { void aiAccess.retry(); }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Retry checking AI creation availability"
              style={[s.aiConfigNotice, { borderColor: colors.border, backgroundColor: colors.muted }]}
            >
              <Icon name="refresh-cw" size={16} color={colors.primary} />
              <Text style={[s.aiConfigNoticeText, { color: colors.mutedForeground, fontFamily: colors.fontFamily.medium }]}>
                AI creation options couldn’t be checked. Tap to retry.
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.storyCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => selectMode('/chapter-editor')}
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel={`${t('create.createStory')}. ${t('feature.create.chapterDesc')}`}
            testID="create-story"
          >
            <Image
              source={Images.create_chapter}
              style={s.storyArtwork}
              contentFit="cover"
              contentPosition="right center"
            />
            <LinearGradient
              colors={[
                withAlpha(colors.card, 0.02),
                withAlpha(colors.card, 0.92),
                colors.card,
              ]}
              locations={[0, 0.52, 1]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            />
            <View style={[s.storyArtWash, { backgroundColor: withAlpha(colors.primary, 0.1) }]} pointerEvents="none" />
            <View style={s.storyCopy}>
            <View style={[s.storyIcon, { backgroundColor: withAlpha(colors.primary, 0.16), borderRadius: colors.radius * 0.65 }]}>
                <Icon name="book-open" size={21} color={colors.primary} />
              </View>
              <Text style={[s.storyTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
                {t('create.createStory')}
              </Text>
              <Text style={[s.storyDescription, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]} numberOfLines={2}>
                {t('feature.create.chapterDesc').replace('\n', ' ')}
              </Text>
            <View style={[s.storyAction, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
                <Text style={[s.storyActionText, { color: colors.primaryForeground, fontFamily: colors.fontFamily.bold }]}>
                  {t('feature.season.beginWriting')}
                </Text>
                <Icon name="arrow-right" size={16} color={colors.primaryForeground} />
              </View>
            </View>
            <View style={[s.storyCardBorder, { borderColor: colors.border }]} pointerEvents="none" />
          </TouchableOpacity>

          {savedDraft && (
            <TouchableOpacity
              style={[s.draftCard, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}
              onPress={() => resumeSavedDraft(savedDraft)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`${t('studioEditor.resume')}: ${savedDraft.title}`}
              testID="resume-story-draft"
            >
              <View style={[s.draftIcon, { backgroundColor: colors.secondary, borderRadius: colors.radius * 0.65 }]}>
                <Icon
                  name={savedDraft.kind === 'manga' ? 'sparkles' : 'file-text'}
                  size={19}
                  color={colors.primary}
                />
              </View>
              <View style={s.draftCopy}>
                <Text style={[s.draftKicker, { color: colors.mutedForeground, fontFamily: colors.fontFamily.medium }]}>
                  {t('studioEditor.draft')}
                </Text>
                <Text style={[s.draftName, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]} numberOfLines={1}>
                  {savedDraft.title}
                </Text>
              </View>
              <View style={s.draftResume}>
                <Text style={[s.draftResumeText, { color: colors.primary, fontFamily: colors.fontFamily.bold }]}>
                  {t('studioEditor.resume')}
                </Text>
                <Icon name="chevron-right" size={17} color={colors.primary} />
              </View>
            </TouchableOpacity>
          )}

          <View style={s.moreHeader}>
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
              {t('studioEditor.quickActions')}
            </Text>
          </View>

          <View style={s.modeGrid}>
            {visibleModes.map(mode => (
              <TouchableOpacity
                key={mode.id}
                style={[s.modeCard, { backgroundColor: colors.secondary, borderColor: colors.border, borderRadius: colors.radius * 0.8 }]}
                onPress={() => selectMode(mode.route)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t(mode.nameKey)}
                testID={`create-mode-${mode.id}`}
              >
                <View style={[s.modeIcon, { backgroundColor: colors.muted, borderRadius: colors.radius * 0.6 }]}>
                  <Icon name={mode.icon} size={19} color={colors.primary} />
                </View>
                <View style={s.modeText}>
                  <Text style={[s.modeName, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]} numberOfLines={1}>
                    {t(mode.nameKey)}
                  </Text>
                  {'descriptionKey' in mode && (
                    <Text style={[s.modeDescription, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]} numberOfLines={2}>
                      {t(mode.descriptionKey).replace('\n', ' ')}
                    </Text>
                  )}
                </View>
                <Icon name="chevron-right" size={17} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject },
  dismissArea: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 22,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  sheetTitle: { fontSize: 28, letterSpacing: -0.6 },
  sheetSub: { fontSize: 14, lineHeight: 20, marginTop: 1 },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCtx: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  eventCtxLabel: { fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4 },
  eventCtxText: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  contentScroll: { flex: 1, minHeight: 0 },
  content: { gap: 16, paddingBottom: 8 },
  aiConfigNotice: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  aiConfigNoticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  storyCard: {
    height: 184,
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  storyArtwork: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '68%',
    height: '100%',
  },
  storyArtWash: { ...StyleSheet.absoluteFillObject },
  storyCopy: { width: '76%', paddingHorizontal: 16, paddingVertical: 12, alignItems: 'flex-start' },
  storyIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  storyTitle: { fontSize: 20, letterSpacing: -0.3 },
  storyDescription: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  storyAction: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 17,
    marginTop: 10,
  },
  storyActionText: { fontSize: 12 },
  storyCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: 20,
  },
  draftCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 17,
    padding: 12,
    gap: 10,
  },
  draftIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  draftCopy: { flex: 1, minWidth: 0 },
  draftKicker: { fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 2 },
  draftName: { fontSize: 14 },
  draftResume: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  draftResumeText: { fontSize: 12 },
  moreHeader: { marginTop: 1 },
  sectionTitle: { fontSize: 15, letterSpacing: 0.1 },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  modeCard: {
    width: '47%',
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeText: { flex: 1, minWidth: 0 },
  modeName: { fontSize: 12, lineHeight: 16 },
  modeDescription: { fontSize: 10, lineHeight: 13, marginTop: 2 },
});
