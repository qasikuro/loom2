import { Icon } from '@/components/Icon';
import type { GalleryPhoto, Outfit, Story } from '@/context/AppContext';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { SecureImage as Image } from '@/components/SecureImage';
import { useSecureMediaUri } from '@/hooks/useSecureMediaUri';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { getListGuideTutorialsQueryKey, useListGuideTutorials, type GuideTutorial } from '@workspace/api-client-react';
import { Images } from '@/assets/images/index';
import { Video, ResizeMode } from 'expo-av';
import { StorigamActivityIndicator as ActivityIndicator } from '@/components/SkyLoading';
import { TeyvatMemoryBoxArt } from '@/components/profile/TeyvatMemoryBoxArt';
import {
  TeyvatMemoryGalleryOverlay,
  type TeyvatMemoryGalleryItem,
} from '@/components/profile/TeyvatMemoryGalleryOverlay';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BG_MAP: Record<string, any> = {
  bg1:  Images.story_bg1,
  bg2:  Images.story_bg2,
  bg3:  Images.story_bg3,
  char: Images.character_default,
};

function getStoryCover(story: Story) {
  if (story.contentType === 'video' && story.thumbnailUri) {
    return { uri: story.thumbnailUri };
  }
  const p = story.panels[0];
  if (!p) return null;
  if (p.imageUri) return { uri: p.imageUri };
  if (p.bgPreset && BG_MAP[p.bgPreset]) return BG_MAP[p.bgPreset];
  return null;
}

const MOOD_COLORS: Record<string, string> = {
  Peaceful: '#8B7AB5', Joyful: '#D4A849', Melancholy: '#5D7BA5',
  Nostalgic: '#A5785D', Hopeful: '#6BA57A', Anxious: '#A56B6B',
  Dreamy: '#9B7AB5', Mysterious: '#6B6BA5', Romantic: '#D878B0',
  Chaotic: '#E8784A', Soft: '#C8A0D8',
};

// ── Fullscreen video player modal ─────────────────────────────────────────────

function VideoPlayerModal({
  story,
  onClose,
  onDelete,
}: {
  story: Story | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [muted, setMuted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { uri: videoUri, renew: renewVideoUri } = useSecureMediaUri(story?.videoUri);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setConfirmDelete(false);
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
  }, [story?.id]);

  function handleDelete() {
    if (!story) return;
    if (confirmDelete) {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onClose();
      onDelete(story.id);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setConfirmDelete(true);
      deleteTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  if (!story || story.contentType !== 'video' || !story.videoUri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[vp.backdrop, { width: W, height: H }]}>
        <Video
          source={{ uri: videoUri ?? story.videoUri }}
          onError={renewVideoUri}
          shouldPlay
          isLooping
          isMuted={muted}
          resizeMode={ResizeMode.CONTAIN}
          style={StyleSheet.absoluteFill}
          useNativeControls={false}
        />
        <View style={[vp.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={vp.iconBtn} onPress={onClose} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="x" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={vp.rightControls}>
            <TouchableOpacity style={[vp.iconBtn, confirmDelete && vp.iconBtnDanger]} onPress={handleDelete} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="trash-2" size={18} color={confirmDelete ? '#FF6B6B' : '#fff'} />
            </TouchableOpacity>
            <TouchableOpacity style={vp.iconBtn} onPress={() => setMuted(m => !m)} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name={muted ? 'volume-x' : 'volume-2'} size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        {confirmDelete && (
          <View style={vp.confirmBanner} pointerEvents="none">
            <Icon name="alert-triangle" size={13} color="#FF6B6B" />
            <Text style={vp.confirmText}>{t('components.profileSection.confirmDelete')}</Text>
          </View>
        )}
        <View style={[vp.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={vp.title} numberOfLines={2}>{story.chapterTitle}</Text>
          {!!story.description && (
            <Text style={vp.desc} numberOfLines={3}>{story.description}</Text>
          )}
          <View style={vp.moodPill}>
            <Text style={vp.moodText}>{story.mood}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Story action sheet ────────────────────────────────────────────────────────

interface StoryActionSheetProps {
  story: Story | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onTogglePublic: (id: string, isPublic: boolean) => void;
}

function StoryActionSheet({ story, onClose, onDelete, onTogglePublic }: StoryActionSheetProps) {
  const { t } = useTranslation();
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideAnim   = useRef(new Animated.Value(300)).current;

  React.useEffect(() => {
    if (story) {
      setConfirmDelete(false);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 12 }).start();
    }
  }, [story, slideAnim]);

  function dismiss() {
    Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }).start(onClose);
  }

  function handleDelete() {
    if (!story) return;
    if (confirmDelete) {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onDelete(story.id);
      dismiss();
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setConfirmDelete(true);
      deleteTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  if (!story) return null;

  const cover     = getStoryCover(story);
  const moodColor = MOOD_COLORS[story.mood] ?? '#9B7AB5';

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable style={ss.backdrop} onPress={dismiss} />
      <Animated.View
        style={[
          ss.sheet,
          {
            backgroundColor: colors.card,
            borderColor:      'rgba(200,184,232,0.12)',
            paddingBottom:    insets.bottom + 12,
            transform:        [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={ss.previewRow}>
          <View style={[ss.previewThumb, { backgroundColor: `${moodColor}22` }]}>
            {cover ? (
              <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <LinearGradient colors={[`${moodColor}55`, `${moodColor}20`]} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient colors={['transparent', 'rgba(8,6,22,0.7)']} style={StyleSheet.absoluteFill} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ss.previewTitle, { color: colors.foreground }]} numberOfLines={2}>
              {story.chapterTitle}
            </Text>
            <View style={ss.statsRow}>
              <View style={ss.statChip}>
                <Icon name="eye"      size={11} color="rgba(255,210,100,0.9)" />
                <Text style={ss.statChipText}>{t('components.profileSection.witnessed', { count: story.witnessedCount })}</Text>
              </View>
              <View style={ss.statChip}>
                <Icon name="bookmark" size={11} color="rgba(200,184,232,0.75)" />
                <Text style={ss.statChipText}>{t('components.profileSection.saved', { count: story.savedCount })}</Text>
              </View>
            </View>
            <View style={[ss.pubBadge, { backgroundColor: story.isPublic ? `${moodColor}20` : 'rgba(200,184,232,0.08)', borderColor: story.isPublic ? `${moodColor}40` : 'rgba(200,184,232,0.15)' }]}>
              <Icon name={story.isPublic ? 'globe' : 'lock'} size={9} color={story.isPublic ? moodColor : 'rgba(200,184,232,0.5)'} />
              <Text style={[ss.pubText, { color: story.isPublic ? moodColor : 'rgba(200,184,232,0.5)' }]}>
                {story.isPublic ? t('common.public') : t('common.private')}
              </Text>
            </View>
          </View>
        </View>

        <View style={[ss.divider, { backgroundColor: 'rgba(200,184,232,0.08)' }]} />

        {story.contentType !== 'video' && (
          <TouchableOpacity style={ss.action} onPress={() => { dismiss(); setTimeout(() => router.push(`/story/${story.id}` as never), 280); }} activeOpacity={0.75}>
            <View style={[ss.actionIcon, { backgroundColor: 'rgba(155,122,232,0.12)' }]}>
              <Icon name="eye" size={16} color="#9B7AB5" />
            </View>
            <Text style={[ss.actionText, { color: colors.foreground }]}>{t('components.profileSection.viewStory')}</Text>
            <Icon name="chevron-right" size={14} color="rgba(200,184,232,0.35)" />
          </TouchableOpacity>
        )}

        {story.contentType !== 'video' && (
          <TouchableOpacity style={ss.action} onPress={() => { dismiss(); setTimeout(() => router.push((`/chapter-editor?editId=${story.id}`) as never), 280); }} activeOpacity={0.75}>
            <View style={[ss.actionIcon, { backgroundColor: 'rgba(100,180,120,0.12)' }]}>
              <Icon name="edit-2" size={16} color="#64B478" />
            </View>
            <Text style={[ss.actionText, { color: colors.foreground }]}>{t('components.profileSection.editStory')}</Text>
            <Icon name="chevron-right" size={14} color="rgba(200,184,232,0.35)" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={ss.action}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onTogglePublic(story.id, !story.isPublic);
            dismiss();
          }}
          activeOpacity={0.75}
        >
          <View style={[ss.actionIcon, { backgroundColor: story.isPublic ? 'rgba(180,140,60,0.12)' : 'rgba(100,160,220,0.12)' }]}>
            <Icon name={story.isPublic ? 'lock' : 'globe'} size={16} color={story.isPublic ? '#C8A840' : '#64A0DC'} />
          </View>
          <Text style={[ss.actionText, { color: colors.foreground }]}>
            {story.isPublic ? t('components.profileSection.makePrivate') : t('components.profileSection.makePublic')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={ss.action} onPress={handleDelete} activeOpacity={0.75}>
          <View style={[ss.actionIcon, { backgroundColor: confirmDelete ? 'rgba(180,60,60,0.18)' : 'rgba(180,60,60,0.10)' }]}>
            <Icon name="trash-2" size={16} color={confirmDelete ? '#E05555' : '#C06060'} />
          </View>
          <Text style={[ss.actionText, { color: confirmDelete ? '#E05555' : '#C06060' }]}>
            {confirmDelete ? t('components.profileSection.confirmDelete') : t('components.profileSection.deleteStory')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[ss.cancelBtn, { backgroundColor: 'rgba(200,184,232,0.07)', borderColor: 'rgba(200,184,232,0.12)' }]} onPress={dismiss} activeOpacity={0.75}>
          <Text style={[ss.cancelText, { color: 'rgba(200,184,232,0.60)' }]}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ── Story card (horizontal scroll) ───────────────────────────────────────────

type GalleryFilter = 'all' | 'stories' | 'outfits' | 'tutorials';
type GalleryEntry =
  | { kind: 'photo'; photo: GalleryPhoto }
  | { kind: 'story'; story: Story }
  | { kind: 'outfit'; outfit: Outfit }
  | { kind: 'tutorial'; tutorial: GuideTutorial };

function getEntryDate(entry: GalleryEntry): string {
  if (entry.kind === 'photo') return entry.photo.createdAt;
  if (entry.kind === 'story') return entry.story.date;
  if (entry.kind === 'tutorial') return entry.tutorial.updatedAt;
  return entry.outfit.date;
}

function getEntryKey(entry: GalleryEntry) {
  if (entry.kind === 'photo') return `photo-${entry.photo.id}`;
  if (entry.kind === 'story') return `story-${entry.story.id}`;
  if (entry.kind === 'tutorial') return `tutorial-${entry.tutorial.id}`;
  return `outfit-${entry.outfit.id}`;
}

function GalleryMediaCard({
  entry,
  width,
  height,
  isActiveOutfit,
  onOpenPhoto,
  onOpenStory,
  onOpenOutfit,
  onStoryMenu,
}: {
  entry: GalleryEntry;
  width: number;
  height: number;
  isActiveOutfit: boolean;
  onOpenPhoto: (photo: GalleryPhoto) => void;
  onOpenStory: (story: Story) => void;
  onOpenOutfit: (id: string) => void;
  onStoryMenu: (story: Story) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const story = entry.kind === 'story' ? entry.story : null;
  const tutorial = entry.kind === 'tutorial' ? entry.tutorial : null;
  const tutorialCover = tutorial?.steps.find(step => step.type === 'image' && step.mediaUri)?.mediaUri;
  const imageSource = entry.kind === 'photo'
    ? { uri: entry.photo.imageUri }
    : entry.kind === 'outfit'
      ? (entry.outfit.imageUri ? { uri: entry.outfit.imageUri } : null)
      : entry.kind === 'tutorial'
        ? (tutorialCover ? { uri: tutorialCover } : null)
        : getStoryCover(entry.story);
  const fallbackColor = story ? (MOOD_COLORS[story.mood] ?? colors.lavender) : colors.secondary;
  const title = entry.kind === 'photo'
    ? (entry.photo.caption || t('profile.galleryUsage'))
    : entry.kind === 'story'
      ? entry.story.chapterTitle
      : entry.kind === 'tutorial' ? entry.tutorial.title : entry.outfit.name;
  const kindIcon = entry.kind === 'photo'
    ? 'image'
    : entry.kind === 'outfit'
      ? 'grid'
      : entry.kind === 'tutorial' ? 'book'
      : story?.contentType === 'video'
        ? 'video'
        : 'book-open';
  const label = entry.kind === 'story'
    ? t('shell.myStories.openStory', { title: entry.story.chapterTitle })
    : entry.kind === 'outfit'
      ? `${t('profile.wardrobe')}: ${entry.outfit.name}`
      : entry.kind === 'tutorial'
        ? `Open tutorial: ${entry.tutorial.title}`
        : `${t('profile.galleryUsage')}: ${entry.photo.caption || t('common.addPhoto')}`;
  const active = entry.kind === 'outfit' && isActiveOutfit;

  function openEntry() {
    Haptics.selectionAsync();
    if (entry.kind === 'photo') onOpenPhoto(entry.photo);
    else if (entry.kind === 'outfit') onOpenOutfit(entry.outfit.id);
    else if (entry.kind === 'tutorial') router.push(`/guide-tutorial/${entry.tutorial.id}` as never);
    else onOpenStory(entry.story);
  }

  return (
    <TouchableOpacity
      style={[s.galleryMediaCard, { width, height, borderColor: colors.border, backgroundColor: colors.muted }]}
      onPress={openEntry}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {imageSource ? (
        <Image source={imageSource} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
      ) : (
        <LinearGradient
          colors={[`${fallbackColor}55`, `${fallbackColor}18`, colors.card]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
        >
          <Icon name={kindIcon} size={20} color={`${fallbackColor}90`} style={s.galleryFallbackIcon} />
        </LinearGradient>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(10,8,28,0.22)', 'rgba(8,6,22,0.88)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={s.galleryKindBadge} pointerEvents="none">
        <Icon name={kindIcon} size={11} color="#fff" />
      </View>
      {active && (
        <View style={s.galleryWornBadge} pointerEvents="none">
          <Text style={s.galleryWornText}>{t('components.profileSection.worn')}</Text>
        </View>
      )}
      {tutorial?.status === 'draft' && (
        <View style={[s.galleryWornBadge, { top: 35, left: 7 }]} pointerEvents="none">
          <Text style={s.galleryWornText}>Draft</Text>
        </View>
      )}
      {story && (
        <TouchableOpacity
          style={s.galleryMenuButton}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onStoryMenu(story); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={story.chapterTitle}
        >
          <Icon name="more-vertical" size={14} color="#fff" />
        </TouchableOpacity>
      )}
      <View style={s.galleryMediaFooter} pointerEvents="none">
        <Text style={s.galleryMediaTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  userId:              string | null | undefined;
  outfits:             Outfit[];
  stories:             Story[];
  openOutfit:          (id: string) => void;
  deleteStory:         (id: string) => void;
  gallery:             GalleryPhoto[];
  openPhoto:           (photo: GalleryPhoto) => void;
  handleAddGalleryPhoto: () => Promise<void>;
  galleryUploading:    boolean;
  galleryError:        string | null;
  activeOutfitId:      string | null;
}

export function ProfileStyleSection({
  userId,
  outfits, stories, openOutfit, deleteStory,
  gallery, openPhoto,
  handleAddGalleryPhoto, galleryUploading, galleryError,
  activeOutfitId,
}: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const { updateStory } = useApp();
  const { width: screenWidth } = useWindowDimensions();
  const [activeStory,  setActiveStory]  = useState<Story | null>(null);
  const [playingVideo, setPlayingVideo] = useState<Story | null>(null);
  const [teyvatGalleryVisible, setTeyvatGalleryVisible] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>('all');
  const [galleryExpanded, setGalleryExpanded] = useState(false);
  const myTutorialsQuery = useListGuideTutorials({ mine: true }, {
    query: {
      queryKey: [...getListGuideTutorialsQueryKey({ mine: true }), userId],
      enabled: !!userId,
      staleTime: 30_000,
    },
  });
  const refetchTutorials = myTutorialsQuery.refetch;
  useFocusEffect(useCallback(() => {
    if (userId) void refetchTutorials();
  }, [userId, refetchTutorials]));

  const allEntries = useMemo<GalleryEntry[]>(
    () => [
      ...gallery.map(photo => ({ kind: 'photo' as const, photo })),
      ...stories.map(story => ({ kind: 'story' as const, story })),
      ...outfits.map(outfit => ({ kind: 'outfit' as const, outfit })),
      ...(myTutorialsQuery.data ?? []).map(tutorial => ({ kind: 'tutorial' as const, tutorial })),
    ].sort((a, b) => (Date.parse(getEntryDate(b)) || 0) - (Date.parse(getEntryDate(a)) || 0)),
    [gallery, stories, outfits, myTutorialsQuery.data],
  );
  const teyvatMemoryItems = useMemo<TeyvatMemoryGalleryItem[]>(
    () => allEntries.flatMap((entry): TeyvatMemoryGalleryItem[] => {
      if (entry.kind === 'tutorial') return [];
        const id = getEntryKey(entry);
        if (entry.kind === 'photo') {
          return [{
            id,
            category: 'photo',
            title: entry.photo.caption || t('profile.galleryUsage'),
            subtitle: new Date(entry.photo.createdAt).toLocaleDateString(),
            imageUri: entry.photo.imageUri,
            fallbackIcon: 'image',
          }];
        }
        if (entry.kind === 'story') {
          const firstPanel = entry.story.panels[0];
          return [{
            id,
            category: 'story',
            title: entry.story.chapterTitle,
            subtitle: entry.story.mood,
            imageUri: entry.story.contentType === 'video'
              ? entry.story.thumbnailUri || null
              : firstPanel?.imageUri || null,
            fallbackIcon: 'book-open',
          }];
        }
        if (entry.kind === 'outfit') {
          return [{
            id,
            category: 'outfit',
            title: entry.outfit.name,
            subtitle: entry.outfit.id === activeOutfitId ? t('components.profileSection.worn') : undefined,
            imageUri: entry.outfit.imageUri || null,
            fallbackIcon: 'grid',
          }];
        }
        return [];
    }),
    [activeOutfitId, allEntries, t],
  );
  const selectedKind = galleryFilter === 'stories' ? 'story' : galleryFilter === 'outfits' ? 'outfit' : galleryFilter === 'tutorials' ? 'tutorial' : null;
  const filteredEntries = useMemo(
    () => selectedKind ? allEntries.filter(entry => entry.kind === selectedKind) : allEntries,
    [allEntries, selectedKind],
  );
  const [galleryWidth, setGalleryWidth] = useState(0);
  // Content width: measured container, else screen minus the profile column padding (14*2).
  const contentWidth = Math.max(0, (galleryWidth || Math.min(screenWidth, 800) - 28) - 4);
  const PREVIEW_GAP = 8;
  const GRID_GAP = 8;
  const teyvatCardWidth = Math.floor(Math.min(220, (contentWidth - PREVIEW_GAP) / 2));
  const teyvatCardHeight = Math.round(teyvatCardWidth * 1.25);
  const teyvatHaloSize = Math.min(106, teyvatCardWidth * 0.62);
  const gridColumns = contentWidth >= 620 ? 5 : contentWidth >= 460 ? 4 : 3;
  const gridCardWidth = Math.floor((contentWidth - GRID_GAP * (gridColumns - 1)) / gridColumns);
  const gridCardHeight = Math.round(gridCardWidth * 1.5);
  const totalCount = allEntries.length;
  const teyvatInitialFilter = galleryFilter === 'stories' || galleryFilter === 'outfits' ? galleryFilter : 'all';

  return (
    <>
      {/* ── Unified profile gallery ─── */}
      <View style={s.section} onLayout={e => { const w = Math.round(e.nativeEvent.layout.width); if (w !== galleryWidth) setGalleryWidth(w); }}>
        <View style={[s.galleryPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.galleryHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[s.galleryHeadingIcon, { backgroundColor: `${colors.tint}16` }]}>
                <Icon name="image" size={15} color={colors.tint} />
              </View>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>{t('profile.myGallery')}</Text>
              {totalCount > 0 && (
              <View style={[s.countPill, { backgroundColor: colors.muted }]}>
                  <Text style={[s.countPillText, { color: colors.foreground }]}>{totalCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
              style={[s.gallerySeeAll, { backgroundColor: `${colors.tint}12`, borderColor: `${colors.tint}30` }]}
              onPress={() => { Haptics.selectionAsync(); setGalleryExpanded(value => !value); }}
            activeOpacity={0.75}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={galleryExpanded ? t('common.close') : t('components.profileSection.seeAll')}
          >
              <Text style={[s.gallerySeeAllText, { color: colors.tint }]}>
                {galleryExpanded ? t('common.close') : t('components.profileSection.seeAll')}
              </Text>
              <Icon name={galleryExpanded ? 'chevron-up' : 'chevron-right'} size={13} color={colors.tint} />
          </TouchableOpacity>
        </View>

          <View style={[s.galleryTabs, { backgroundColor: colors.muted }]}>
            {([
              { id: 'all', label: t('social.all') },
              { id: 'stories', label: t('components.profile.stats.stories') },
              { id: 'outfits', label: t('components.profile.stats.outfits') },
              { id: 'tutorials', label: 'Tutorials' },
            ] as const).map(tab => {
              const isSelected = galleryFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[s.galleryTab, isSelected && { backgroundColor: colors.tint }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setGalleryFilter(tab.id);
                    setGalleryExpanded(false);
                  }}
                  activeOpacity={0.8}
                  hitSlop={{ top: 4, bottom: 4 }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[s.galleryTabText, { color: isSelected ? colors.primaryForeground : colors.mutedForeground }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {galleryFilter === 'tutorials' && (
          <View style={s.tutorialHeading}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Satoshi-Bold', fontSize: 13 }}>My tutorials</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Regular', fontSize: 11, marginTop: 2 }}>Your drafts and published guides</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/guide-tutorials')} style={{ padding: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.primary, fontFamily: 'Satoshi-Bold', fontSize: 12 }}>Manage</Text>
              <Icon name="chevron-right" size={13} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {galleryFilter === 'tutorials' && myTutorialsQuery.isLoading ? (
          <View style={[s.tutorialState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Medium', fontSize: 12 }}>Loading your tutorials…</Text>
          </View>
        ) : galleryFilter === 'tutorials' && myTutorialsQuery.isError && !myTutorialsQuery.data ? (
          <TouchableOpacity onPress={() => { void refetchTutorials(); }} style={[s.tutorialState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="refresh-cw" size={16} color={colors.primary} />
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Medium', fontSize: 12 }}>Could not load your tutorials · Tap to retry</Text>
          </TouchableOpacity>
        ) : galleryExpanded ? (
          <View style={s.galleryGrid}>
            {filteredEntries.map(entry => (
              <GalleryMediaCard
                key={getEntryKey(entry)}
                entry={entry}
                width={gridCardWidth}
                height={gridCardHeight}
                isActiveOutfit={entry.kind === 'outfit' && entry.outfit.id === activeOutfitId}
                onOpenPhoto={openPhoto}
                onOpenStory={story => {
                  if (story.contentType === 'video' && story.videoUri) setPlayingVideo(story);
                  else router.push(`/story/${story.id}` as never);
                }}
                onOpenOutfit={openOutfit}
                onStoryMenu={setActiveStory}
              />
            ))}
            <GalleryAddCard
              filter={galleryFilter}
              width={gridCardWidth}
              height={gridCardHeight}
              uploading={galleryUploading}
              colors={colors}
              onAddPhoto={handleAddGalleryPhoto}
            />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.galleryRow}>
            <TouchableOpacity
              style={[
                s.teyvatCard,
                {
                  width: teyvatCardWidth,
                  height: teyvatCardHeight,
                  borderColor: `${colors.tint}45`,
                  backgroundColor: colors.card,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setTeyvatGalleryVisible(true);
              }}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={`Open Memories in Teyvat, ${teyvatMemoryItems.length} ${teyvatMemoryItems.length === 1 ? 'memory' : 'memories'}`}
              testID="teyvat-memory-box-open"
            >
              <LinearGradient
                colors={[`${colors.tint}18`, `${colors.tint}08`, colors.card]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View
                style={[
                  s.teyvatCardArt,
                  { height: Math.round(teyvatCardHeight * 0.6) },
                ]}
              >
                <View
                  style={[
                    s.teyvatCardHalo,
                    {
                      width: teyvatHaloSize,
                      height: teyvatHaloSize,
                      borderRadius: teyvatHaloSize / 2,
                      backgroundColor: `${colors.tint}12`,
                      borderColor: `${colors.tint}28`,
                    },
                  ]}
                />
                <TeyvatMemoryBoxArt
                  mode="closed"
                  style={StyleSheet.absoluteFill}
                  testID="teyvat-memory-box-art"
                />
              </View>
              <View style={s.teyvatCardCopy} pointerEvents="none">
                <Text style={[s.teyvatCardTitle, { color: colors.foreground }]} numberOfLines={1}>
                  Memories in Teyvat
                </Text>
                <Text style={[s.teyvatCardCount, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {teyvatMemoryItems.length} {teyvatMemoryItems.length === 1 ? 'moment' : 'moments'}
                </Text>
              </View>
            </TouchableOpacity>
            <GalleryAddCard
              filter={galleryFilter}
              width={teyvatCardWidth}
              height={teyvatCardHeight}
              uploading={galleryUploading}
              colors={colors}
              subtitle={galleryFilter === 'all' ? t('common.addPhoto') : undefined}
              featured
              onAddPhoto={handleAddGalleryPhoto}
            />
          </ScrollView>
        )}

        {galleryError && (
          <Text style={[s.galError, { color: colors.destructive, marginTop: 6 }]}>{galleryError}</Text>
        )}
      </View>

      {/* ── Story action sheet ─── */}
      <StoryActionSheet
        story={activeStory}
        onClose={() => setActiveStory(null)}
        onDelete={deleteStory}
        onTogglePublic={(id, isPublic) => updateStory(id, { isPublic })}
      />

      {/* ── Video player modal ─── */}
      <VideoPlayerModal story={playingVideo} onClose={() => setPlayingVideo(null)} onDelete={deleteStory} />
      <TeyvatMemoryGalleryOverlay
        visible={teyvatGalleryVisible}
        items={teyvatMemoryItems}
        initialFilter={teyvatInitialFilter}
        onClose={() => setTeyvatGalleryVisible(false)}
        renderBox={mode => (
          <TeyvatMemoryBoxArt
            mode={mode}
            style={{ width: '100%', height: '100%' }}
            testID={`teyvat-memory-box-${mode}`}
          />
        )}
      />
    </>
  );
}

function GalleryAddCard({
  filter,
  width,
  height,
  uploading,
  colors,
  subtitle,
  featured = false,
  onAddPhoto,
}: {
  filter: GalleryFilter;
  width: number;
  height: number;
  uploading: boolean;
  colors: ReturnType<typeof useColors>;
  subtitle?: string;
  featured?: boolean;
  onAddPhoto: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const label = filter === 'all'
    ? t('profile.addToGallery')
    : filter === 'stories'
      ? t('components.profileSection.newStory')
      : filter === 'tutorials' ? 'New tutorial' : t('components.profileSection.newOutfit');

  return (
    <TouchableOpacity
      key={`add-${filter}`}
      style={[
        s.galleryAddCard,
        featured && s.galleryAddCardFeatured,
        { width, height, backgroundColor: `${colors.tint}0B`, borderColor: `${colors.tint}50` },
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        if (filter === 'all') void onAddPhoto();
        else if (filter === 'stories') router.push('/(tabs)/create' as never);
        else if (filter === 'tutorials') router.push('/create-guide-tutorial');
        else router.push('/create-outfit' as never);
      }}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={filter === 'all' ? `${label}. ${t('common.addPhoto')}` : label}
    >
      <View style={[s.galleryAddIcon, featured && s.galleryAddIconFeatured, { backgroundColor: `${colors.tint}16` }]}>
        {filter === 'all' && uploading ? (
          <ActivityIndicator size="small" color={colors.tint} />
        ) : (
          <Icon name="plus" size={featured ? 26 : 20} color={colors.tint} />
        )}
      </View>
      <Text style={[s.galleryAddText, featured && s.galleryAddTextFeatured, { color: colors.foreground }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
      {subtitle ? (
        <Text style={[s.galleryAddSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ── Section styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  section:           { marginBottom: 10 },
  sectionTitle:      { fontSize: 18, fontFamily: 'Satoshi-Bold', letterSpacing: -0.35 },
  countPill:         { borderRadius: 11, paddingHorizontal: 7, paddingVertical: 3 },
  countPillText:     { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  galleryPanel:      { borderWidth: 1, borderRadius: 16, marginBottom: 10 },
  galleryHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, minHeight: 50 },
  galleryHeadingIcon:{ width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  gallerySeeAll:     { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 34, borderWidth: 1, borderRadius: 17, paddingHorizontal: 12 },
  gallerySeeAllText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  galleryTabs:       { flexDirection: 'row', alignItems: 'center', gap: 3, marginHorizontal: 10, marginBottom: 9, padding: 4, borderRadius: 13 },
  galleryTab:        { flex: 1, minWidth: 0, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 5 },
  galleryTabText:    { fontSize: 12.5, fontFamily: 'Satoshi-Bold' },
  tutorialHeading:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 10 },
  tutorialState:    { minHeight: 100, borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  galleryRow:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', flexGrow: 1, gap: 8, paddingHorizontal: 2, paddingBottom: 6 },
  galleryGrid:       { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8, paddingHorizontal: 2, paddingBottom: 6 },
  galleryMediaCard:  { borderWidth: 1, borderRadius: 13, overflow: 'hidden', position: 'relative' },
  galleryFallbackIcon:{ position: 'absolute', top: '42%', alignSelf: 'center' },
  galleryKindBadge:  { position: 'absolute', top: 7, left: 7, width: 23, height: 23, borderRadius: 12, backgroundColor: 'rgba(8,6,22,0.62)', alignItems: 'center', justifyContent: 'center' },
  galleryWornBadge:  { position: 'absolute', top: 7, left: 34, minHeight: 23, paddingHorizontal: 7, borderRadius: 12, backgroundColor: 'rgba(8,6,22,0.68)', alignItems: 'center', justifyContent: 'center' },
  galleryWornText:   { fontSize: 9.5, fontFamily: 'Satoshi-Bold', color: '#fff' },
  galleryMenuButton: { position: 'absolute', top: 5, right: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(8,6,22,0.62)', alignItems: 'center', justifyContent: 'center' },
  galleryMediaFooter:{ position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 42, justifyContent: 'flex-end', paddingHorizontal: 7, paddingBottom: 7 },
  galleryMediaTitle: { color: '#fff', fontSize: 12, lineHeight: 15, fontFamily: 'Satoshi-Bold' },
  galleryAddCard:    { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 13, paddingHorizontal: 6, gap: 9 },
  galleryAddCardFeatured: { borderRadius: 22, paddingHorizontal: 12, gap: 6 },
  galleryAddIcon:    { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  galleryAddIconFeatured: { width: 56, height: 56, borderRadius: 20 },
  galleryAddText:    { maxWidth: '94%', fontSize: 12, lineHeight: 15, textAlign: 'center', fontFamily: 'Satoshi-Bold' },
  galleryAddTextFeatured: { fontSize: 14, lineHeight: 18 },
  galleryAddSubtitle:{ maxWidth: '94%', fontSize: 11, lineHeight: 14, textAlign: 'center', fontFamily: 'Satoshi-Medium', marginTop: -3 },
  teyvatCard:        { borderWidth: 1, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9, paddingTop: 8, paddingBottom: 10, gap: 4 },
  teyvatCardArt:     { width: '100%', position: 'relative', alignItems: 'center', justifyContent: 'center' },
  teyvatCardHalo:    { position: 'absolute', borderWidth: 1 },
  teyvatCardCopy:    { width: '100%', alignItems: 'center', gap: 2, paddingTop: 1 },
  teyvatCardTitle:   { fontSize: 13, lineHeight: 17, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  teyvatCardCount:   { color: '#847C93', fontSize: 11, fontFamily: 'Satoshi-Medium', textAlign: 'center' },
  galError:          { fontSize: 12, fontFamily: 'Satoshi-Regular' },
});

// ── Action sheet & video modal styles omitted for brevity but remain the same ──

const ss = StyleSheet.create({
  backdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:          { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20 },
  previewRow:     { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  previewThumb:   { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  previewTitle:   { fontSize: 16, fontFamily: 'Satoshi-Bold', marginBottom: 4 },
  statsRow:       { flexDirection: 'row', gap: 10, alignItems: 'center' },
  statChip:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statChipText:   { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.7)' },
  pubBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start', marginTop: 8 },
  pubText:        { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  divider:        { height: 1, marginVertical: 8 },
  action:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  actionIcon:     { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText:     { flex: 1, fontSize: 15, fontFamily: 'Satoshi-Medium' },
  cancelBtn:      { marginTop: 12, paddingVertical: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  cancelText:     { fontSize: 14, fontFamily: 'Satoshi-Bold' },
});

const vp = StyleSheet.create({
  backdrop:       { flex: 1, backgroundColor: '#000' },
  topBar:         { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, zIndex: 10 },
  rightControls:  { flexDirection: 'row', gap: 8 },
  iconBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger:  { backgroundColor: 'rgba(255,100,100,0.2)' },
  confirmBanner:  { position: 'absolute', top: 100, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  confirmText:    { color: '#FF6B6B', fontSize: 13, fontFamily: 'Satoshi-Bold' },
  bottomBar:      { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 60 },
  title:          { color: '#fff', fontSize: 20, fontFamily: 'Satoshi-Bold', marginBottom: 4, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  desc:           { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Satoshi-Regular', marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  moodPill:       { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  moodText:       { color: '#fff', fontSize: 11, fontFamily: 'Satoshi-Bold' },
});
