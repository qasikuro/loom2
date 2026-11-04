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
import { SecureImage as Image } from '@/components/SecureImage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useAiFeatureAccess } from '@/features/ai/aiFeatureAccess';
import {
  getCreateDestination,
  getDraftResumeDestination,
  getResumableStoryDraft,
  type CreateDestination,
  type ResumableStoryDraft,
} from '@/utils/entryDraftStore';
import { useColors as useDesignSystemColors } from '@workspace/storigam-kindness/hooks/use-colors';

type IconName = React.ComponentProps<typeof Icon>['name'];
type CreationCategoryId = 'stories' | 'outfits' | 'tutorials' | 'sessions' | 'books';

type CreationChoice = {
  id: string;
  icon: IconName;
  titleKey: string;
  titleFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  route: string;
  params?: Record<string, string>;
};

const CREATION_CATEGORIES: {
  id: CreationCategoryId;
  icon: IconName;
  titleKey: string;
  titleFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  wide?: boolean;
}[] = [
  {
    id: 'stories',
    icon: 'book-open',
    titleKey: 'create.createStory',
    titleFallback: 'Stories',
    descriptionKey: 'studioEditor.chooseFormatSubtitle',
    descriptionFallback: 'Write, illustrate, or share a video story.',
  },
  {
    id: 'outfits',
    icon: 'shopping-bag',
    titleKey: 'feature.create.outfits',
    titleFallback: 'Outfits',
    descriptionKey: 'feature.create.outfitsDesc',
    descriptionFallback: 'Share a look or write about its story.',
  },
  {
    id: 'tutorials',
    icon: 'lightbulb',
    titleKey: 'feature.create.tutorials',
    titleFallback: 'Tutorials',
    descriptionKey: 'feature.create.tutorialsDesc',
    descriptionFallback: 'Teach something with clear steps and media.',
  },
  {
    id: 'sessions',
    icon: 'users',
    titleKey: 'feature.create.sessions',
    titleFallback: 'Guide sessions',
    descriptionKey: 'feature.create.sessionsDesc',
    descriptionFallback: 'Host a guided group session.',
  },
  {
    id: 'books',
    icon: 'book-open',
    titleKey: 'studioEditor.myBooksTitle',
    titleFallback: 'Books & chapters',
    descriptionKey: 'feature.create.booksDesc',
    descriptionFallback: 'Build a series and manage your chapters.',
    wide: true,
  },
];

const CREATION_CHOICES: Record<CreationCategoryId, CreationChoice[]> = {
  stories: [
    {
      id: 'text-story',
      icon: 'file-text',
      titleKey: 'studioEditor.textStoryTitle',
      titleFallback: 'Rich text story',
      descriptionKey: 'studioEditor.textStoryDescription',
      descriptionFallback: 'Write chapters with headings, quotes, and photos.',
      route: '/text-story',
    },
    {
      id: 'manga',
      icon: 'grid',
      titleKey: 'studioEditor.mangaTitle',
      titleFallback: 'Manga story',
      descriptionKey: 'studioEditor.mangaDescription',
      descriptionFallback: 'Tell your story panel by panel.',
      route: '/chapter-editor',
    },
    {
      id: 'video-story',
      icon: 'video',
      titleKey: 'feature.create.video',
      titleFallback: 'Video story',
      descriptionKey: 'feature.create.videoDesc',
      descriptionFallback: 'Share a video clip with a caption.',
      route: '/post-video',
    },
  ],
  outfits: [
    {
      id: 'outfit-post',
      icon: 'shopping-bag',
      titleKey: 'feature.create.outfitPost',
      titleFallback: 'Outfit post',
      descriptionKey: 'feature.create.outfitPostDesc',
      descriptionFallback: 'Share your look with photos and notes.',
      route: '/create-outfit',
    },
    {
      id: 'outfit-journal',
      icon: 'feather',
      titleKey: 'feature.create.journal',
      titleFallback: 'Journal entry',
      descriptionKey: 'feature.create.journalDesc',
      descriptionFallback: 'Write about an outfit, a memory, or your day.',
      route: '/create-journal-entry',
      params: { type: 'diary' },
    },
  ],
  tutorials: [
    {
      id: 'tutorial',
      icon: 'file-text',
      titleKey: 'feature.create.tutorialAction',
      titleFallback: 'Create a tutorial',
      descriptionKey: 'feature.create.tutorialsDesc',
      descriptionFallback: 'Arrange helpful steps, images, and video.',
      route: '/create-guide-tutorial',
    },
  ],
  sessions: [
    {
      id: 'guide-session',
      icon: 'calendar',
      titleKey: 'feature.create.sessionAction',
      titleFallback: 'Create a guide session',
      descriptionKey: 'feature.create.sessionsDesc',
      descriptionFallback: 'Set a time and invite people to learn together.',
      route: '/create-guide-session',
    },
  ],
  books: [
    {
      id: 'book-library',
      icon: 'book-open',
      titleKey: 'studioEditor.myBooksTitle',
      titleFallback: 'Books & chapters',
      descriptionKey: 'feature.create.booksDesc',
      descriptionFallback: 'Start a book or continue a series you have begun.',
      route: '/my-books',
    },
  ],
};

const MORE_MODES = [
  {
    id: 'quick',
    icon: 'sparkles' as const,
    nameKey: 'feature.create.quick',
    descriptionKey: 'feature.create.quickDesc',
    route: '/quick-moment',
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
  const [selectedCategory, setSelectedCategory] = useState<CreationCategoryId | null>(null);

  const sheetY = useRef(new Animated.Value(sheetHeight)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const detailsProgress = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    sheetY.setValue(sheetHeight);
    bgOpacity.setValue(0);
    detailsProgress.setValue(0);
    setSelectedCategory(null);
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

  function selectMode(route: string | CreateDestination, extraParams?: Record<string, string>) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeAfterAnimation(() => {
      const destination = typeof route === 'string'
        ? getCreateDestination(
          route,
          hasEventContext && eventPrompt ? String(eventPrompt) : undefined,
          hasEventContext && eventMood ? String(eventMood) : undefined,
          extraParams,
        )
        : route;
      if (destination.params) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push({ pathname: destination.pathname as any, params: destination.params } as any);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(destination.pathname as any);
      }
    });
  }

  function resumeSavedDraft(draft: ResumableStoryDraft) {
    const destination = getDraftResumeDestination(
      draft,
      hasEventContext && eventPrompt ? String(eventPrompt) : undefined,
      hasEventContext && eventMood ? String(eventMood) : undefined,
    );
    selectMode(destination);
  }

  function toggleCategory(category: CreationCategoryId) {
    void Haptics.selectionAsync();
    if (selectedCategory === category) {
      setSelectedCategory(null);
      detailsProgress.setValue(0);
      return;
    }

    detailsProgress.setValue(0);
    setSelectedCategory(category);
    requestAnimationFrame(() => {
      Animated.timing(detailsProgress, {
        toValue: 1,
        duration: 190,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  }

  const activeCategory = selectedCategory
    ? CREATION_CATEGORIES.find(category => category.id === selectedCategory) ?? null
    : null;
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

          <View style={[s.startCard, { backgroundColor: colors.secondary, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={s.startHeading}>
              <View style={[s.startIcon, { backgroundColor: withAlpha(colors.primary, 0.16), borderRadius: colors.radius * 0.65 }]}>
                <Icon name="sparkles" size={19} color={colors.primary} />
              </View>
              <Text style={[s.startEyebrow, { color: colors.primary, fontFamily: colors.fontFamily.bold }]}>
                {t('feature.create.title')}
              </Text>
            </View>
            {!activeCategory ? (
              <>
                <Text style={[s.startTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
                  {t('feature.create.startTitle', { defaultValue: 'What would you like to make today?' })}
                </Text>
                <Text style={[s.startDescription, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]}>
                  {t('feature.create.startDescription', { defaultValue: 'Choose a path. You can add the details as you go.' })}
                </Text>

                <View style={s.categoryGrid}>
                  {CREATION_CATEGORIES.map(category => {
                    const title = t(category.titleKey, { defaultValue: category.titleFallback });
                    const description = t(category.descriptionKey, { defaultValue: category.descriptionFallback });
                    return (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          s.categoryCard,
                          category.wide && s.categoryCardWide,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderRadius: colors.radius * 0.8,
                          },
                        ]}
                        onPress={() => toggleCategory(category.id)}
                        activeOpacity={0.84}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: false }}
                        accessibilityLabel={`${title}. ${description}`}
                        testID={`create-category-${category.id}`}
                      >
                        {category.wide ? (
                          <View style={s.wideCategoryContent}>
                            <View style={[s.categoryIcon, { backgroundColor: withAlpha(colors.primary, 0.14), borderRadius: colors.radius * 0.55 }]}>
                              <Icon name={category.icon} size={19} color={colors.primary} />
                            </View>
                            <View style={s.categoryCopy}>
                              <Text style={[s.categoryTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
                                {title}
                              </Text>
                              <Text style={[s.categoryDescription, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]} numberOfLines={2}>
                                {description}
                              </Text>
                            </View>
                            <Icon name="chevron-down" size={17} color={colors.mutedForeground} />
                          </View>
                        ) : (
                          <>
                            <View style={s.categoryTop}>
                              <View style={[s.categoryIcon, { backgroundColor: withAlpha(colors.primary, 0.14), borderRadius: colors.radius * 0.55 }]}>
                                <Icon name={category.icon} size={19} color={colors.primary} />
                              </View>
                              <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
                            </View>
                            <View style={s.categoryCopy}>
                              <Text style={[s.categoryTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]} numberOfLines={1}>
                                {title}
                              </Text>
                              <Text style={[s.categoryDescription, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]} numberOfLines={2}>
                                {description}
                              </Text>
                            </View>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <Animated.View
                style={[
                  s.selectedModeContent,
                  {
                    opacity: detailsProgress,
                    transform: [{
                      translateY: detailsProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                    }],
                  },
                ]}
                testID="create-category-details"
              >
                <View style={s.selectedPanelHeading}>
                  <View style={[s.selectedPanelIcon, { backgroundColor: withAlpha(colors.primary, 0.16), borderRadius: colors.radius * 0.6 }]}>
                    <Icon name={activeCategory.icon} size={18} color={colors.primary} />
                  </View>
                  <View style={s.selectedPanelCopy}>
                    <Text style={[s.selectedPanelTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
                      {t(activeCategory.titleKey, { defaultValue: activeCategory.titleFallback })}
                    </Text>
                    <Text style={[s.selectedPanelDescription, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]} numberOfLines={2}>
                      {t(activeCategory.descriptionKey, { defaultValue: activeCategory.descriptionFallback })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[s.changeCategoryButton, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius * 0.65 }]}
                    onPress={() => toggleCategory(activeCategory.id)}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.change', { defaultValue: 'Change category' })}
                    testID="change-create-category"
                  >
                    <Text style={[s.changeCategoryText, { color: colors.primary, fontFamily: colors.fontFamily.bold }]}>
                      {t('common.change', { defaultValue: 'Change' })}
                    </Text>
                    <Icon name="chevron-down" size={15} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={s.choiceList}>
                  {CREATION_CHOICES[activeCategory.id].map(choice => (
                    <TouchableOpacity
                      key={choice.id}
                      style={[s.choiceRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius * 0.75 }]}
                      onPress={() => selectMode(choice.route, choice.params)}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                      accessibilityLabel={`${t(choice.titleKey, { defaultValue: choice.titleFallback })}. ${t(choice.descriptionKey, { defaultValue: choice.descriptionFallback })}`}
                      testID={`create-choice-${choice.id}`}
                    >
                      <View style={[s.choiceIcon, { backgroundColor: withAlpha(colors.primary, 0.13), borderRadius: colors.radius * 0.55 }]}>
                        <Icon name={choice.icon} size={18} color={colors.primary} />
                      </View>
                      <View style={s.choiceCopy}>
                        <Text style={[s.choiceTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
                          {t(choice.titleKey, { defaultValue: choice.titleFallback })}
                        </Text>
                        <Text style={[s.choiceDescription, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]} numberOfLines={2}>
                          {t(choice.descriptionKey, { defaultValue: choice.descriptionFallback })}
                        </Text>
                      </View>
                      <Icon name="chevron-right" size={17} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>
            )}
          </View>

          {savedDraft && (
            <TouchableOpacity
              style={[s.draftCard, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}
              onPress={() => resumeSavedDraft(savedDraft)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`${t('studioEditor.resume')}: ${savedDraft.title}`}
              testID="resume-story-draft"
            >
              {savedDraft.imageUri ? (
                <Image source={{ uri: savedDraft.imageUri }} style={[s.draftImage, { borderRadius: colors.radius * 0.65 }]} contentFit="cover" />
              ) : (
                <View style={[s.draftIcon, { backgroundColor: colors.secondary, borderRadius: colors.radius * 0.65 }]}>
                  <Icon
                    name={savedDraft.kind === 'manga' ? 'sparkles' : 'file-text'}
                    size={19}
                    color={colors.primary}
                  />
                </View>
              )}
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
              {t('feature.create.moreTools', { defaultValue: 'More tools' })}
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
  scrim: { ...StyleSheet.absoluteFill },
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
  startCard: {
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  startHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  startIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  startEyebrow: { fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase' },
  startTitle: { fontSize: 19, lineHeight: 25, letterSpacing: -0.3, marginTop: 2 },
  startDescription: { fontSize: 12, lineHeight: 17, marginTop: -4, marginBottom: 4 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: {
    width: '48%',
    minHeight: 116,
    borderWidth: 1,
    padding: 11,
    justifyContent: 'space-between',
    gap: 8,
  },
  categoryCardWide: { width: '100%', minHeight: 74, justifyContent: 'center' },
  categoryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wideCategoryContent: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  categoryIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  categoryCopy: { flex: 1, minWidth: 0 },
  categoryTitle: { fontSize: 13, lineHeight: 17, letterSpacing: -0.1 },
  categoryDescription: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  selectedModeContent: { gap: 0 },
  selectedPanelHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedPanelIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  selectedPanelCopy: { flex: 1, minWidth: 0 },
  selectedPanelTitle: { fontSize: 15, lineHeight: 20 },
  selectedPanelDescription: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  changeCategoryButton: {
    minHeight: 34,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  changeCategoryText: { fontSize: 11 },
  choiceList: { gap: 8, marginTop: 12 },
  choiceRow: {
    minHeight: 64,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  choiceIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1, minWidth: 0 },
  choiceTitle: { fontSize: 13, lineHeight: 17 },
  choiceDescription: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  draftCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 17,
    padding: 12,
    gap: 10,
  },
  draftImage: {
    width: 42,
    height: 42,
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
