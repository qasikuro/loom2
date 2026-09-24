/**
 * PublishChapterScreen — final review before publishing a chapter.
 * Shows page count, estimated reading time, visibility toggle, and a
 * preview of the first page. Two CTAs: Publish Chapter / Save as Draft.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useApiFetch } from '../utils/apiClient';
import { SkyLoadingMark, SkyLoadingOverlay } from '@/components/SkyLoading';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Panel {
  id:        string;
  text:      string;
  imageUri?: string;
  bgPreset?: string;
}

interface Page {
  id:        string;
  layoutKey: string;
  panels:    Panel[];
}

interface ChapterDetail {
  id:          string;
  bookId:      string;
  title:       string;
  status:      'draft' | 'published';
  publishedAt: string | null;
  pageCount:   number;
  pages:       Page[];
}

// ── Screen ────────────────────────────────────────────────────────────────────

const AVG_SECONDS_PER_PAGE = 45; // reading time estimate

export default function PublishChapterScreen() {
  const colors    = useColors();
  const { t } = useTranslation();
  const insets    = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const apiFetch  = useApiFetch();
  const { chapterId, bookId } = useLocalSearchParams<{ chapterId: string; bookId: string }>();

  const [chapter,    setChapter]    = useState<ChapterDetail | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishingStatus, setPublishingStatus] = useState<'published' | 'draft' | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  useFocusEffect(useCallback(() => {
    if (!chapterId || !bookId) {
      setLoading(false);
      return;
    }
    apiFetch<ChapterDetail>(`/chapters/${chapterId}`)
      .then(data => { setChapter(data); })
      .catch(() => Alert.alert(t('studioEditor.error'), t('studioEditor.couldNotLoadChapterPublish')))
      .finally(() => setLoading(false));
  }, [chapterId, bookId]));

  async function publish(status: 'published' | 'draft') {
    if (!chapterId) return;
    setPublishing(true);
    setPublishingStatus(status);
    try {
      await apiFetch<ChapterDetail>(`/chapters/${chapterId}`, {
        method: 'PATCH',
        json: { status, publishedAt: status === 'published' ? new Date().toISOString() : null },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        status === 'published' ? t('studioEditor.published') : t('studioEditor.savedAsDraft'),
        status === 'published' ? t('studioEditor.chapterLive') : t('studioEditor.chapterSavedDraft'),
        [{ text: t('studioEditor.ok'), onPress: () => router.replace(`/book-details?bookId=${bookId}` as never) }],
      );
    } catch (err) {
      Alert.alert(t('studioEditor.publishError'), err instanceof Error ? err.message : t('studioEditor.couldNotUpdateChapter'));
    } finally {
      setPublishing(false);
      setPublishingStatus(null);
    }
  }

  function readingTime(pageCount: number) {
    const secs = pageCount * AVG_SECONDS_PER_PAGE;
    if (secs < 60) return t('studioEditor.secondsRead', { count: secs });
    return t('studioEditor.minutesRead', { count: Math.round(secs / 60) });
  }

  const accent = '#8B70C8';
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const contentWidth = Math.min(windowWidth, 720);
  const firstPage = chapter?.pages?.[0];
  const firstImage = firstPage?.panels?.find(p => p.imageUri)?.imageUri;
  const isPublished = chapter?.status === 'published';

  if (loading) {
    return <View style={[s.root, { backgroundColor: colors.background }]}><SkyLoadingOverlay message={t('studioEditor.prepareChapter')} /></View>;
  }

  if (!chapterId || !bookId) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15 }}>{t('studioEditor.missingPublishChapter')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#8B70C8', fontSize: 14 }}>{t('studioEditor.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topInset + 12, maxWidth: 800, width: '100%', alignSelf: 'center' }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{t('studioEditor.reviewChapter')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: bottomInset + 32, width: contentWidth, maxWidth: '100%', alignSelf: 'center' }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Chapter title */}
        <View style={s.titleBlock}>
          <Text style={s.chapterLabel}>{t('studioEditor.chapter')}</Text>
          <Text style={s.chapterTitle}>{chapter?.title ?? ''}</Text>
          {isPublished && (
            <View style={s.publishedBadge}>
              <Icon name="check-circle" size={12} color="#78C8A0" />
              <Text style={s.publishedBadgeTxt}>{t('studioEditor.alreadyPublished')}</Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Icon name="file" size={18} color={accent} />
            <Text style={s.statValue}>{chapter?.pageCount ?? 0}</Text>
            <Text style={s.statLabel}>{t('studioEditor.pageCountLabel')}</Text>
          </View>
          <View style={s.statCard}>
            <Icon name="clock" size={18} color="#78C8A0" />
            <Text style={s.statValue}>{readingTime(chapter?.pageCount ?? 0)}</Text>
            <Text style={s.statLabel}>{t('studioEditor.estimatedRead')}</Text>
          </View>
          <View style={s.statCard}>
            <Icon name={isPublished ? 'globe' : 'edit-3'} size={18} color={isPublished ? '#78C8A0' : '#9B7FE8'} />
            <Text style={s.statValue}>{isPublished ? t('studioEditor.live') : t('studioEditor.draft')}</Text>
            <Text style={s.statLabel}>{t('studioEditor.status')}</Text>
          </View>
        </View>

        {/* First page preview */}
        {firstPage && (
          <View style={s.previewSection}>
            <Text style={s.previewLabel}>{t('studioEditor.firstPagePreview')}</Text>
            <View style={s.previewCard}>
              {firstImage
                ? <Image source={{ uri: firstImage }} style={s.previewImg} contentFit="contain" />
                : <View style={s.previewEmpty}>
                    <Icon name="image" size={28} color="rgba(140,120,180,0.25)" />
                    <Text style={s.previewEmptyTxt}>{t('studioEditor.noFirstPageImage')}</Text>
                  </View>}
              {firstPage.panels[0]?.text ? (
                <View style={s.previewOverlay}>
                  <Text style={s.previewText} numberOfLines={3}>{firstPage.panels[0].text}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Visibility toggle */}
        <View style={s.visSection}>
          <Text style={s.visLabel}>{t('studioEditor.visibility')}</Text>
          <View style={s.visRow}>
            {(['public', 'private'] as const).map(v => {
              const active = visibility === v;
              const c = v === 'public' ? '#78C8A0' : '#9B7FE8';
              return (
                <TouchableOpacity
                  key={v}
                  style={[s.visBtn, active && { borderColor: `${c}55`, backgroundColor: `${c}14` }]}
                  onPress={() => { setVisibility(v); Haptics.selectionAsync(); }}
                >
                  <Icon name={v === 'public' ? 'globe' : 'lock'} size={14} color={active ? c : 'rgba(200,185,255,0.35)'} />
                  <Text style={[s.visBtnTxt, active && { color: c }]}>{t(`studioEditor.${v}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.visHint}>
            {visibility === 'public' ? t('studioEditor.readersFeed') : t('studioEditor.onlyYouRead')}
          </Text>
        </View>

        {/* CTAs */}
        <View style={s.ctaRow}>
          <TouchableOpacity
            style={[s.draftBtn, { opacity: publishing ? 0.6 : 1 }]}
            onPress={() => publish('draft')}
            disabled={publishing}
          >
            {publishingStatus === 'draft'
              ? <SkyLoadingMark size={18} color="rgba(200,185,255,0.70)" />
              : <Icon name="edit-3" size={14} color="rgba(200,185,255,0.70)" />}
            <Text style={s.draftBtnTxt}>{publishingStatus === 'draft' ? t('studioEditor.saving') : t('studioEditor.saveAsDraft')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.publishBtn, { backgroundColor: accent, opacity: publishing ? 0.7 : 1 }]}
            onPress={() => publish('published')}
            disabled={publishing}
          >
            {publishing
              ? <SkyLoadingMark size={18} color="#fff" />
              : <>
                  <Icon name="send" size={15} color="#fff" />
                  <Text style={s.publishBtnTxt}>{t('studioEditor.publishChapter')}</Text>
                </>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:            { flex: 1 },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { flex: 1, minWidth: 0, color: 'rgba(255,255,255,0.92)', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  scroll:          { padding: 20, gap: 22 },
  titleBlock:      { gap: 6 },
  chapterLabel:    { color: 'rgba(200,185,255,0.40)', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  chapterTitle:    { color: 'rgba(255,255,255,0.92)', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  publishedBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  publishedBadgeTxt: { color: '#78C8A0', fontSize: 12 },
  statsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard:        { flex: 1, minWidth: 92, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, alignItems: 'center', gap: 6 },
  statValue:       { color: 'rgba(255,255,255,0.88)', fontSize: 16, fontWeight: '700' },
  statLabel:       { color: 'rgba(200,185,255,0.40)', fontSize: 11 },
  previewSection:  { gap: 10 },
  previewLabel:    { color: 'rgba(200,185,255,0.40)', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  previewCard:     { borderRadius: 14, overflow: 'hidden', backgroundColor: '#100D22', aspectRatio: 1.5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  previewImg:      { width: '100%', height: '100%' },
  previewEmpty:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewEmptyTxt: { color: 'rgba(200,185,255,0.30)', fontSize: 13 },
  previewOverlay:  { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(6,4,16,0.75)', padding: 12 },
  previewText:     { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18 },
  visSection:      { gap: 10 },
  visLabel:        { color: 'rgba(200,185,255,0.40)', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  visRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  visBtn:          { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.03)' },
  visBtnTxt:       { color: 'rgba(200,185,255,0.45)', fontSize: 13 },
  visHint:         { color: 'rgba(200,185,255,0.30)', fontSize: 12 },
  ctaRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  draftBtn:        { flex: 1, minWidth: 130, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 15, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(200,185,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)' },
  draftBtnTxt:     { color: 'rgba(200,185,255,0.70)', fontSize: 14, fontWeight: '600' },
  publishBtn:      { flex: 1.4, minWidth: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 15, borderRadius: 14 },
  publishBtnTxt:   { color: '#fff', fontSize: 14, fontWeight: '700' },
});
