import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { SecureImage as Image } from '@/components/SecureImage';
import { CompletionMoment } from '@/components/CompletionMoment';
import { useApp, type StoryPanel, type StoryPage } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { persistImageUri } from '@/utils/persistImage';
import { TEXT_STORY_DRAFT_KEY } from '@/utils/entryDraftStore';
import { useColors } from '@workspace/storigam-kindness/hooks/use-colors';
import { useApiFetch } from '../utils/apiClient';

type TextBlockKind = 'paragraph' | 'heading' | 'quote' | 'bullet' | 'image';
type TextBlock = {
  id: string;
  kind: TextBlockKind;
  text: string;
  imageUri?: string;
  imageAspectRatio?: number;
  emphasis?: 'bold' | 'italic';
};

const TEXT_KINDS: TextBlockKind[] = ['paragraph', 'heading', 'quote', 'bullet'];
const STORY_MOODS = ['Dreamy', 'Hopeful', 'Peaceful', 'Romantic', 'Lonely', 'Adventurous'];

function blockId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newTextBlock(kind: TextBlockKind = 'paragraph'): TextBlock {
  return { id: blockId(), kind, text: '' };
}

function fromPanel(panel: StoryPanel): TextBlock {
  return {
    id: panel.id || blockId(),
    kind: panel.articleBlock ?? (panel.imageUri ? 'image' : 'paragraph'),
    text: panel.text ?? '',
    imageUri: panel.imageUri ?? undefined,
    imageAspectRatio: panel.imageAspectRatio,
    emphasis: panel.articleEmphasis,
  };
}

function toPanel(block: TextBlock): StoryPanel {
  return {
    id: block.id,
    text: block.text.trim(),
    textFormat: 'rich',
    articleBlock: block.kind,
    articleEmphasis: block.emphasis,
    imageUri: block.imageUri,
    imageAspectRatio: block.imageAspectRatio,
    contentFit: block.kind === 'image' ? 'cover' : undefined,
  };
}

function labelKey(kind: TextBlockKind): string {
  return kind === 'image' ? 'addImage' : kind;
}

export default function TextStoryScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const colors = useColors(isDark ? 'dark' : 'light');
  const apiFetch = useApiFetch();
  const {
    addStory, updateStory, stories,
  } = useApp();
  const { editId, eventPrompt, eventMood, resumeDraft, chapterId, bookId } = useLocalSearchParams<{
    editId?: string;
    eventPrompt?: string;
    eventMood?: string;
    resumeDraft?: string;
    chapterId?: string;
    bookId?: string;
  }>();
  const isBookChapter = !!chapterId && !!bookId;
  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [mood, setMood] = useState('Dreamy');
  const [isPublic, setIsPublic] = useState(true);
  const [blocks, setBlocks] = useState<TextBlock[]>(() => [newTextBlock()]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState('');
  const [bookChapterSnapshot, setBookChapterSnapshot] = useState('');
  const [bookChapterReady, setBookChapterReady] = useState(false);
  const [loadingBookChapter, setLoadingBookChapter] = useState(isBookChapter);
  const [bookChapterStatus, setBookChapterStatus] = useState<'draft' | 'published'>('draft');
  const loadedEditId = useRef<string | null>(null);
  const loadedBookChapterId = useRef<string | null>(null);
  const hasLoadedDraft = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshot = useMemo(
    () => JSON.stringify({ title, synopsis, mood, isPublic, blocks }),
    [title, synopsis, mood, isPublic, blocks],
  );
  const hasContent = title.trim().length > 0
    || synopsis.trim().length > 0
    || blocks.some(block => block.text.trim() || block.imageUri);
  const isDirty = isBookChapter
    ? !!bookChapterSnapshot && snapshot !== bookChapterSnapshot
    : editId
      ? !!editSnapshot && snapshot !== editSnapshot
      : hasContent || !isPublic || mood !== 'Dreamy';
  const markSaved = useNavigationGuard(isDirty);
  const activeBlock = blocks.find(block => block.id === activeBlockId && block.kind !== 'image');

  useEffect(() => {
    if (!editId || isBookChapter || loadedEditId.current === editId) return;
    const story = stories.find(item => item.id === editId);
    if (!story) return;
    const sourcePanels = story.pages?.length
      ? story.pages.flatMap(page => page.panels)
      : story.panels;
    const articleBlocks = sourcePanels
      .filter(panel => panel.textFormat === 'rich')
      .map(fromPanel);
    if (!articleBlocks.length) {
      router.replace({ pathname: '/chapter-editor', params: { editId } } as never);
      return;
    }
    const next = {
      title: story.chapterTitle,
      synopsis: story.description ?? '',
      mood: story.mood || 'Dreamy',
      isPublic: story.isPublic,
      blocks: articleBlocks,
    };
    setTitle(next.title);
    setSynopsis(next.synopsis);
    setMood(next.mood);
    setIsPublic(next.isPublic);
    setBlocks(articleBlocks);
    setEditSnapshot(JSON.stringify(next));
    loadedEditId.current = editId;
  }, [editId, isBookChapter, stories]);

  useEffect(() => {
    if (!isBookChapter || !chapterId || loadedBookChapterId.current === chapterId) return;
    let active = true;
    setBookChapterReady(false);
    setBookChapterSnapshot('');
    setLoadingBookChapter(true);
    setError('');
    void apiFetch<{ title: string; status?: 'draft' | 'published'; pages?: StoryPage[] }>(`/chapters/${encodeURIComponent(chapterId)}`)
      .then(chapter => {
        if (!active) return;
        const sourcePanels = chapter.pages?.flatMap(page => page.panels) ?? [];
        const hasIllustratedContent = sourcePanels.some(panel =>
          !!(panel.bgPreset || panel.bubbleText?.trim() || panel.overlays?.length)
          || (panel.textFormat !== 'rich' && !!(panel.text?.trim() || panel.imageUri)),
        );
        if (hasIllustratedContent) {
          loadedBookChapterId.current = chapterId;
          setError(t('studioEditor.richTextMangaPreserved', {
            defaultValue: 'This chapter contains illustrated pages. Create a new chapter to write in rich text so those pages stay safe.',
          }));
          return;
        }

        const richBlocks = sourcePanels
          .filter(panel => panel.textFormat === 'rich')
          .map(fromPanel);
        const nextBlocks = richBlocks.length ? richBlocks : [newTextBlock()];
        const nextTitle = chapter.title ?? '';
        const baseline = {
          title: nextTitle,
          synopsis: '',
          mood: 'Dreamy',
          isPublic: true,
          blocks: nextBlocks,
        };
        setTitle(nextTitle);
        setSynopsis('');
        setMood('Dreamy');
        setIsPublic(true);
        setBlocks(nextBlocks);
        setBookChapterStatus(chapter.status ?? 'draft');
        setBookChapterSnapshot(JSON.stringify(baseline));
        setBookChapterReady(true);
        loadedBookChapterId.current = chapterId;
      })
      .catch(() => {
        if (active) {
          setError(t('studioEditor.couldNotLoadChapter', {
            defaultValue: 'Could not load this chapter. Go back and try again.',
          }));
        }
      })
      .finally(() => {
        if (active) setLoadingBookChapter(false);
      });
    return () => { active = false; };
  }, [apiFetch, chapterId, isBookChapter, t]);

  useEffect(() => {
    if (editId || isBookChapter || hasLoadedDraft.current) return;

    hasLoadedDraft.current = true;
    let active = true;
    void AsyncStorage.getItem(TEXT_STORY_DRAFT_KEY).then(raw => {
      if (!active || !raw) return;
      try {
        const draft = JSON.parse(raw) as {
          title?: string;
          synopsis?: string;
          mood?: string;
          isPublic?: boolean;
          blocks?: TextBlock[];
        };
        const hasDraftContent = !!draft.title?.trim()
          || !!draft.blocks?.some(block => block.text?.trim() || block.imageUri);
        if (!hasDraftContent) return;
        if (resumeDraft === '1') {
          setTitle(draft.title ?? '');
          setSynopsis(draft.synopsis ?? '');
          setMood(draft.mood ?? 'Dreamy');
          setIsPublic(draft.isPublic ?? true);
          setBlocks(draft.blocks?.length ? draft.blocks : [newTextBlock()]);
        } else if (!title && !blocks.some(block => block.text || block.imageUri)) {
          Alert.alert(
            t('studioEditor.draftSaved'),
            `${draft.title || t('studioEditor.textStoryTitle')}`,
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('studioEditor.resume'),
                onPress: () => {
                  setTitle(draft.title ?? '');
                  setSynopsis(draft.synopsis ?? '');
                  setMood(draft.mood ?? 'Dreamy');
                  setIsPublic(draft.isPublic ?? true);
                  setBlocks(draft.blocks?.length ? draft.blocks : [newTextBlock()]);
                },
              },
            ],
          );
        }
      } catch {
        // A malformed local draft should not prevent a new story.
      }
    }).catch(() => null);
    return () => { active = false; };
  // Draft recovery is checked once when the editor mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, isBookChapter, resumeDraft]);

  useEffect(() => {
    if (editId || isBookChapter) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!hasContent) return;
    saveTimer.current = setTimeout(() => {
      void AsyncStorage.setItem(TEXT_STORY_DRAFT_KEY, JSON.stringify({
        title, synopsis, mood, isPublic, blocks, savedAt: Date.now(),
      })).catch(() => null);
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, synopsis, mood, isPublic, blocks, hasContent, editId, isBookChapter]);


  useEffect(() => {
    if (editId || isBookChapter) return;
    if (eventPrompt && !synopsis) setSynopsis(String(eventPrompt));
    if (eventMood && STORY_MOODS.includes(String(eventMood))) setMood(String(eventMood));
  // Event context is initial-only, before the user edits the story.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateBlock = useCallback((id: string, updates: Partial<TextBlock>) => {
    setBlocks(current => current.map(block => block.id === id ? { ...block, ...updates } : block));
  }, []);

  function addBlock(kind: TextBlockKind) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (kind === 'image') {
      void addImageBlock();
      return;
    }
    const block = newTextBlock(kind);
    setBlocks(current => [...current, block]);
    setActiveBlockId(block.id);
    setError('');
  }

  function applyKind(kind: TextBlockKind) {
    if (kind === 'image') {
      void addImageBlock();
      return;
    }
    const active = blocks.find(block => block.id === activeBlockId);
    if (active && active.kind !== 'image' && !active.text.trim()) {
      updateBlock(active.id, { kind });
    } else {
      const block = newTextBlock(kind);
      setBlocks(current => [...current, block]);
      setActiveBlockId(block.id);
    }
    Haptics.selectionAsync();
  }

  function toggleEmphasis(emphasis: 'bold' | 'italic') {
    const active = blocks.find(block => block.id === activeBlockId && block.kind !== 'image');
    if (!active) {
      addBlock('paragraph');
      return;
    }
    updateBlock(active.id, { emphasis: active.emphasis === emphasis ? undefined : emphasis });
    Haptics.selectionAsync();
  }

  async function addImageBlock() {
    if (uploading) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      setError('');
      const imageUri = await persistImageUri(asset.uri);
      setBlocks(current => [...current, {
        id: blockId(),
        kind: 'image',
        text: '',
        imageUri,
        imageAspectRatio: asset.width && asset.height ? asset.width / asset.height : undefined,
      }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError(t('studioEditor.photoUploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  function removeBlock(id: string) {
    setBlocks(current => {
      const next = current.filter(block => block.id !== id);
      return next.length ? next : [newTextBlock()];
    });
    if (activeBlockId === id) setActiveBlockId(null);
  }

  function moveBlock(id: string, direction: -1 | 1) {
    setBlocks(current => {
      const index = current.findIndex(block => block.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    Haptics.selectionAsync();
  }

  async function publish() {
    if (posting || uploading || loadingBookChapter) return;
    const cleanTitle = title.trim();
    const savedBlocks = blocks.filter(block => block.text.trim() || block.imageUri);
    if (!cleanTitle || savedBlocks.length === 0) {
      setError(t('studioEditor.storyNeedsText'));
      return;
    }
    setPosting(true);
    setError('');
    const panels = savedBlocks.map(toPanel);
    const page: StoryPage = { id: blockId(), layoutKey: '1', panels };

    if (isBookChapter) {
      if (!chapterId || !bookId) {
        setPosting(false);
        setError(t('studioEditor.couldNotLoadChapter', { defaultValue: 'Could not load this chapter.' }));
        return;
      }
      try {
        await apiFetch(`/chapters/${encodeURIComponent(chapterId)}`, {
          method: 'PATCH',
          json: { title: cleanTitle, pages: [page], pageCount: 1 },
        });
        setPosting(false);
        markSaved();
        router.back();
      } catch {
        setPosting(false);
        setError(t('studioEditor.couldNotSaveChanges', { defaultValue: 'Could not save this chapter. Please try again.' }));
      }
      return;
    }

    if (editId) {
      updateStory(editId, {
        chapterTitle: cleanTitle,
        description: synopsis.trim(),
        panels,
        pages: [page],
        pageLayoutKey: '1',
        mood,
        location: '',
        isPublic,
      });
      setPosting(false);
      markSaved();
      router.back();
      return;
    }

    const ok = await addStory({
      id: Crypto.randomUUID(),
      date: new Date().toISOString(),
      chapterTitle: cleanTitle,
      description: synopsis.trim(),
      panels,
      pages: [page],
      pageLayoutKey: '1',
      mood,
      location: '',
      isPublic,
      witnessedCount: 0,
      savedCount: 0,
      stickerCount: 0,
    });
    setPosting(false);
    if (!ok) {
      setError(t('studioEditor.storySaveFailed'));
      return;
    }
    markSaved();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await AsyncStorage.removeItem(TEXT_STORY_DRAFT_KEY).catch(() => null);
    setShowCompletion(true);
  }

  const headingTitle = isBookChapter
    ? t('studioEditor.richTextBookChapter', { defaultValue: 'Rich-text book chapter' })
    : editId
      ? t('studioEditor.editChapter')
      : t('studioEditor.textStoryHeader');

  if (isBookChapter && (loadingBookChapter || !bookChapterReady)) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 14 }]}>
        {loadingBookChapter
          ? <ActivityIndicator size="large" color={colors.primary} />
          : <Icon name="alert-circle" size={28} color={colors.destructive} />}
        <Text style={{ color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }}>
          {loadingBookChapter
            ? t('studioEditor.loadingBookChapter', { defaultValue: 'Opening your chapter…' })
            : error || t('studioEditor.couldNotLoadChapter', { defaultValue: 'Could not load this chapter.' })}
        </Text>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
          <Text style={{ color: colors.primary, fontFamily: colors.fontFamily.medium }}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Icon name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]} numberOfLines={1}>
            {headingTitle}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]} numberOfLines={1}>
            {isBookChapter
              ? t(
                bookChapterStatus === 'published' ? 'studioEditor.publishedChapterSaveHint' : 'studioEditor.bookChapterSaveHint',
                {
                  defaultValue: bookChapterStatus === 'published'
                    ? 'Saving updates this published chapter immediately.'
                    : 'Save this draft, then review it to publish.',
                },
              )
              : t('studioEditor.textStorySubheader')}
          </Text>
        </View>
        {!isBookChapter && (
          <View
            style={[styles.visibility, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            accessibilityLabel={isPublic ? t('studioEditor.public') : t('studioEditor.private')}
          >
            <Icon name={isPublic ? 'globe' : 'lock'} size={14} color={isPublic ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.visibilityBadgeText, { color: isPublic ? colors.primary : colors.mutedForeground, fontFamily: colors.fontFamily.medium }]}>
              {isPublic ? t('studioEditor.public') : t('studioEditor.private')}
            </Text>
          </View>
        )}
      </View>

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(bottomPad, 18) + 30 }]}
        bottomOffset={100}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.introCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.introMark, { backgroundColor: colors.secondary }]}>
            <Icon name="feather" size={19} color={colors.primary} />
          </View>
          <View style={styles.introCopy}>
            <Text style={[styles.introTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
              {isBookChapter
                ? t('studioEditor.richTextBookChapter', { defaultValue: 'Write your chapter' })
                : t('studioEditor.textStoryHeader')}
            </Text>
            <Text style={[styles.introSubtitle, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]}>
              {isBookChapter
                ? t('studioEditor.richTextBookChapterHint', { defaultValue: 'Use paragraphs, headings, quotes, and images to shape your chapter.' })
                : t('studioEditor.textStorySubheader')}
            </Text>
          </View>
        </View>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('studioEditor.storyTitlePlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          maxLength={200}
          returnKeyType="next"
          style={[styles.titleInput, { color: colors.foreground, borderBottomColor: colors.border, fontFamily: colors.fontFamily.bold }]}
          accessibilityLabel={t('create.titleLabel')}
          testID="text-story-title"
        />
        {!isBookChapter && (
          <TextInput
            value={synopsis}
            onChangeText={setSynopsis}
            placeholder={t('studioEditor.synopsisPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            maxLength={1000}
            multiline
            style={[styles.synopsisInput, { color: colors.mutedForeground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: colors.fontFamily.regular }]}
            accessibilityLabel={t('create.descLabel')}
            testID="text-story-synopsis"
          />
        )}

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
            {t('studioEditor.addContent')}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.mutedForeground, fontFamily: colors.fontFamily.medium }]}>
            {blocks.filter(block => block.text.trim() || block.imageUri).length}
          </Text>
        </View>

        {blocks.map((block, index) => (
          <View
            key={block.id}
            style={[
              styles.blockCard,
              { backgroundColor: colors.card, borderColor: activeBlockId === block.id ? colors.primary : colors.border },
            ]}
          >
            <View style={styles.blockTop}>
              <View style={[styles.blockLabel, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.blockLabelText, { color: colors.primary, fontFamily: colors.fontFamily.bold }]}>
                  {t(`studioEditor.${labelKey(block.kind)}`)}
                </Text>
              </View>
              <View style={styles.blockActions}>
                <Pressable
                  onPress={() => moveBlock(block.id, -1)}
                  disabled={index === 0}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('studioEditor.moveBlockUp')}
                  style={styles.actionIcon}
                >
                  <Icon name="arrow-up" size={15} color={index === 0 ? colors.border : colors.mutedForeground} />
                </Pressable>
                <Pressable
                  onPress={() => moveBlock(block.id, 1)}
                  disabled={index === blocks.length - 1}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('studioEditor.moveBlockDown')}
                  style={styles.actionIcon}
                >
                  <Icon name="arrow-down" size={15} color={index === blocks.length - 1 ? colors.border : colors.mutedForeground} />
                </Pressable>
                <Pressable
                  onPress={() => removeBlock(block.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('studioEditor.removeBlock')}
                  style={styles.actionIcon}
                >
                  <Icon name="trash-2" size={15} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            {block.kind === 'image' ? (
              block.imageUri ? (
                <Image
                  source={{ uri: block.imageUri }}
                  style={[styles.storyImage, { aspectRatio: block.imageAspectRatio || 1.45 }]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : null
            ) : (
              <TextInput
                value={block.text}
                onChangeText={text => updateBlock(block.id, { text })}
                onFocus={() => setActiveBlockId(block.id)}
                placeholder={index === 0 && block.kind === 'paragraph' ? t('studioEditor.firstParagraphPlaceholder') : t('studioEditor.panelPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
                style={[
                  styles.blockInput,
                  { color: colors.foreground, fontFamily: block.emphasis === 'bold' ? colors.fontFamily.bold : colors.fontFamily.regular },
                  block.kind === 'heading' && styles.headingInput,
                  block.kind === 'quote' && [styles.quoteInput, { borderLeftColor: colors.primary }],
                  block.kind === 'bullet' && styles.bulletInput,
                  block.emphasis === 'italic' && styles.italicInput,
                ]}
                accessibilityLabel={t(`studioEditor.${labelKey(block.kind)}`)}
                testID={`text-story-block-${index}`}
              />
            )}
          </View>
        ))}

        <View style={[styles.formatToolbar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.toolbarLabel, { color: colors.mutedForeground, fontFamily: colors.fontFamily.medium }]}>
            {t('studioEditor.addContent')}
          </Text>
          <View style={styles.toolRows}>
            {TEXT_KINDS.map(kind => (
              <Pressable
                key={kind}
                onPress={() => applyKind(kind)}
                style={({ pressed }) => [
                  styles.toolButton,
                  { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t(`studioEditor.${kind}`)}
                testID={`text-story-add-${kind}`}
              >
                <Text style={[styles.toolText, { color: colors.foreground, fontFamily: colors.fontFamily.medium }]}>
                  {kind === 'heading' ? 'H1' : kind === 'quote' ? '“ ”' : kind === 'bullet' ? '•' : 'T'}
                </Text>
                <Text style={[styles.toolCaption, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]}>
                  {t(`studioEditor.${kind}`)}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => applyKind('image')}
              disabled={uploading}
              style={({ pressed }) => [
                styles.toolButton,
                { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('studioEditor.addImage')}
              testID="text-story-add-image"
            >
              {uploading
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Icon name="image" size={17} color={colors.primary} />}
              <Text style={[styles.toolCaption, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]}>
                {t('studioEditor.addImage')}
              </Text>
            </Pressable>
          </View>
          <View style={[styles.emphasisRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.emphasisHint, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]}>
              {activeBlockId ? t('studioEditor.textStyleHeading') : t('studioEditor.textStorySubheader')}
            </Text>
            <Pressable
              onPress={() => toggleEmphasis('bold')}
              style={[styles.emphasisButton, { borderColor: activeBlock?.emphasis === 'bold' ? colors.primary : colors.border, backgroundColor: activeBlock?.emphasis === 'bold' ? colors.primary : colors.secondary }]}
              accessibilityRole="button"
              accessibilityLabel={t('studioEditor.formatBold')}
              testID="text-story-bold"
            >
              <Text style={[styles.boldMark, { color: activeBlock?.emphasis === 'bold' ? colors.primaryForeground : colors.foreground }]}>B</Text>
            </Pressable>
            <Pressable
              onPress={() => toggleEmphasis('italic')}
              style={[styles.emphasisButton, { borderColor: activeBlock?.emphasis === 'italic' ? colors.primary : colors.border, backgroundColor: activeBlock?.emphasis === 'italic' ? colors.primary : colors.secondary }]}
              accessibilityRole="button"
              accessibilityLabel={t('studioEditor.formatItalic')}
              testID="text-story-italic"
            >
              <Text style={[styles.italicMark, { color: activeBlock?.emphasis === 'italic' ? colors.primaryForeground : colors.foreground }]}>I</Text>
            </Pressable>
          </View>
        </View>

        {!isBookChapter && <View style={styles.moodSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
            {t('studioEditor.textStoryMood')}
          </Text>
          <View style={styles.moodRow}>
            {STORY_MOODS.map(item => (
              <Pressable
                key={item}
                onPress={() => setMood(item)}
                style={[
                  styles.moodPill,
                  { backgroundColor: mood === item ? colors.secondary : colors.card, borderColor: mood === item ? colors.primary : colors.border },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: mood === item }}
              >
                <Text style={[styles.moodText, { color: mood === item ? colors.primary : colors.mutedForeground, fontFamily: colors.fontFamily.medium }]}>
                  {t(`moods.${item}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>}

        {!isBookChapter && <Pressable
          onPress={() => setIsPublic(value => !value)}
          style={[styles.visibilityRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="switch"
          accessibilityState={{ checked: isPublic }}
        >
          <View style={[styles.visibilityIcon, { backgroundColor: colors.secondary }]}>
            <Icon name={isPublic ? 'globe' : 'lock'} size={17} color={colors.primary} />
          </View>
          <View style={styles.visibilityCopy}>
            <Text style={[styles.visibilityTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
              {isPublic ? t('studioEditor.public') : t('studioEditor.private')}
            </Text>
            <Text style={[styles.visibilityDescription, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]}>
              {isPublic ? t('studioEditor.visibleInDiscover') : t('studioEditor.onlyYouSee')}
            </Text>
          </View>
          <View style={[styles.switchTrack, { backgroundColor: isPublic ? colors.primary : colors.muted }]}>
            <View style={[styles.switchThumb, { alignSelf: isPublic ? 'flex-end' : 'flex-start', backgroundColor: colors.primaryForeground }]} />
          </View>
        </Pressable>}

        {!!error && (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive, fontFamily: colors.fontFamily.medium }]}>
            {error}
          </Text>
        )}

        <Pressable
          onPress={() => void publish()}
          disabled={posting || uploading}
          style={({ pressed }) => [
            styles.publishButton,
            { backgroundColor: colors.primary, opacity: posting || uploading ? 0.58 : pressed ? 0.84 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={posting
            ? t(isBookChapter ? 'studioEditor.savingBookChapter' : 'studioEditor.publishingTextStory', { defaultValue: isBookChapter ? 'Saving chapter' : 'Publishing story' })
            : t(isBookChapter ? 'studioEditor.saveBookChapter' : 'studioEditor.publishTextStory', { defaultValue: isBookChapter ? 'Save chapter' : 'Publish story' })}
          testID={isBookChapter ? 'text-story-save-book-chapter' : 'text-story-publish'}
        >
          {posting
            ? <ActivityIndicator size="small" color={colors.primaryForeground} />
            : <Icon name="send" size={17} color={colors.primaryForeground} />}
          <Text style={[styles.publishText, { color: colors.primaryForeground, fontFamily: colors.fontFamily.bold }]}>
            {posting
              ? t(isBookChapter ? 'studioEditor.savingBookChapter' : 'studioEditor.publishingTextStory', { defaultValue: isBookChapter ? 'Saving chapter' : 'Publishing story' })
              : t(isBookChapter ? 'studioEditor.saveBookChapter' : 'studioEditor.publishTextStory', { defaultValue: isBookChapter ? 'Save chapter' : 'Publish story' })}
          </Text>
          {!posting && <Icon name="arrow-right" size={17} color={colors.primaryForeground} />}
        </Pressable>
      </KeyboardAwareScrollView>

      <CompletionMoment
        visible={showCompletion}
        variant="story"
        onFinish={() => router.replace('/(tabs)/create' as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16 },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  visibility: { height: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  visibilityBadgeText: { fontSize: 11 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 19, gap: 15 },
  introCard: { borderRadius: 19, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  introMark: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1, gap: 3 },
  introTitle: { fontSize: 17 },
  introSubtitle: { fontSize: 12, lineHeight: 18 },
  titleInput: { fontSize: 27, lineHeight: 35, paddingVertical: 12, borderBottomWidth: 1 },
  synopsisInput: { minHeight: 70, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, lineHeight: 21 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  sectionTitle: { fontSize: 16 },
  sectionCount: { fontSize: 12 },
  blockCard: { borderWidth: 1, borderRadius: 18, padding: 13, gap: 11 },
  blockTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockLabel: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  blockLabelText: { fontSize: 10, letterSpacing: 0.45, textTransform: 'uppercase' },
  blockActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  blockInput: { minHeight: 78, fontSize: 16, lineHeight: 25, paddingHorizontal: 3, paddingVertical: 5 },
  headingInput: { minHeight: 50, fontSize: 22, lineHeight: 29 },
  quoteInput: { borderLeftWidth: 3, paddingLeft: 12, fontStyle: 'italic', minHeight: 74 },
  bulletInput: { paddingLeft: 18 },
  italicInput: { fontStyle: 'italic' },
  storyImage: { width: '100%', borderRadius: 13, backgroundColor: '#100D1D' },
  formatToolbar: { borderWidth: 1, borderRadius: 18, padding: 13, gap: 11 },
  toolbarLabel: { fontSize: 11, letterSpacing: 0.35 },
  toolRows: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolButton: { minWidth: 68, minHeight: 62, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 4 },
  toolText: { fontSize: 18 },
  toolCaption: { fontSize: 10 },
  emphasisRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  emphasisHint: { flex: 1, fontSize: 11, lineHeight: 16 },
  emphasisButton: { width: 36, height: 34, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  boldMark: { fontSize: 16, fontWeight: '800' },
  italicMark: { fontSize: 16, fontStyle: 'italic', fontWeight: '600' },
  moodSection: { gap: 10 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodPill: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 8 },
  moodText: { fontSize: 12 },
  visibilityRow: { minHeight: 68, borderWidth: 1, borderRadius: 17, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  visibilityIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  visibilityCopy: { flex: 1, gap: 3 },
  visibilityTitle: { fontSize: 14 },
  visibilityDescription: { fontSize: 11 },
  switchTrack: { width: 42, height: 24, borderRadius: 12, padding: 3, justifyContent: 'center' },
  switchThumb: { width: 18, height: 18, borderRadius: 9 },
  error: { fontSize: 13, lineHeight: 19 },
  publishButton: { minHeight: 52, borderRadius: 17, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 2 },
  publishText: { fontSize: 15 },
});
