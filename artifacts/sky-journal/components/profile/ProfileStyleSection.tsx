import { Icon } from '@/components/Icon';
import type { GalleryPhoto, Outfit, Story } from '@/context/AppContext';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { SecureImage as Image } from '@/components/SecureImage';
import { useSecureMediaUri } from '@/hooks/useSecureMediaUri';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Images } from '@/assets/images/index';
import { Video, ResizeMode } from 'expo-av';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
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

const CARD_W = 104;
const CARD_H = 130;

function StoryCard({ story, onMenu, onPlay }: { story: Story; onMenu: (s: Story) => void; onPlay: (s: Story) => void }) {
  const cover      = getStoryCover(story);
  const moodColor  = MOOD_COLORS[story.mood] ?? '#9B7AB5';
  const isVideo    = story.contentType === 'video';

  return (
    <TouchableOpacity
      style={sc.card}
      onPress={isVideo
        ? () => { Haptics.selectionAsync(); onPlay(story); }
        : () => { Haptics.selectionAsync(); router.push(`/story/${story.id}` as never); }
      }
      activeOpacity={0.88}
    >
      {cover ? (
        <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={[`${moodColor}55`, `${moodColor}20`, '#0F0D1E']} style={StyleSheet.absoluteFill} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}>
          <Icon name="star" size={14} color={`${moodColor}50`} style={{ position: 'absolute', top: 14, right: 14 }} />
        </LinearGradient>
      )}
      <LinearGradient colors={['transparent', 'rgba(8,6,22,0.55)', 'rgba(8,6,22,0.93)']} style={sc.grad} />

      {/* Mood dot */}
      <View style={[sc.moodDot, { backgroundColor: moodColor }]} />

      {/* Video badge */}
      {isVideo ? (
        <View style={sc.videoBadge}>
          <Icon name="video" size={8} color="rgba(240,200,255,0.95)" />
        </View>
      ) : story.isPublic ? (
        <View style={sc.globeBadge}>
          <Icon name="globe" size={8} color="rgba(200,232,200,0.9)" />
        </View>
      ) : null}

      {/* ⋮ menu */}
      <TouchableOpacity
        style={sc.menuBtn}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMenu(story); }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        activeOpacity={0.7}
      >
        <Icon name="more-vertical" size={14} color="rgba(240,234,255,0.85)" />
      </TouchableOpacity>

      {/* Bottom info */}
      <View style={sc.bottom}>
        <Text style={sc.title} numberOfLines={2}>{story.chapterTitle}</Text>
        <View style={sc.metaRow}>
          <Icon name="eye"      size={10} color="rgba(255,210,100,0.85)" />
          <Text style={sc.metaText}>{story.witnessedCount}</Text>
          <Icon name="bookmark" size={10} color="rgba(200,184,232,0.65)" />
          <Text style={sc.metaText}>{story.savedCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
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
  outfits, stories, openOutfit, deleteStory,
  gallery, openPhoto,
  handleAddGalleryPhoto, galleryUploading, galleryError,
  activeOutfitId,
}: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const { updateStory } = useApp();
  const [activeStory,  setActiveStory]  = useState<Story | null>(null);
  const [playingVideo, setPlayingVideo] = useState<Story | null>(null);

  const sorted = [...stories].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      {/* ── My Stories ─── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>{t('profile.myStories')}</Text>
            {stories.length > 0 && (
              <View style={[s.countPill, { backgroundColor: colors.muted }]}>
                <Text style={[s.countPillText, { color: colors.foreground }]}>{stories.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => { Haptics.selectionAsync(); router.push('/my-stories' as never); }}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="book-open" size={12} color="#B89AE8" />
            <Text style={[s.addBtnText, { color: colors.foreground }]}>{t('components.profileSection.seeAll')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollPad}>
          {sorted.slice(0, 10).map(story => (
            <StoryCard key={story.id} story={story} onMenu={setActiveStory} onPlay={setPlayingVideo} />
          ))}
          {/* Add Story Card Placeholder */}
          <TouchableOpacity
            style={[sc.card, { borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}
            onPress={() => router.push('/(tabs)/create' as never)}
            activeOpacity={0.75}
          >
            <Icon name="plus" size={20} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontSize: 12, textAlign: 'center', fontFamily: 'Satoshi-Medium', marginTop: 8 }}>{t('components.profileSection.newStory')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── My Wardrobe ─── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>{t('profile.wardrobe')}</Text>
            {outfits.length > 0 && (
              <View style={[s.countPill, { backgroundColor: colors.muted }]}>
                <Text style={[s.countPillText, { color: colors.foreground }]}>{outfits.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => router.push('/create-outfit' as never)}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="plus" size={13} color="#B89AE8" />
            <Text style={[s.addBtnText, { color: colors.foreground }]}>{t('components.profileSection.newOutfit')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollPad}>
          {outfits.slice(0, 8).map(outfit => {
            const isActive = outfit.id === activeOutfitId;
            return (
              <TouchableOpacity
                key={outfit.id}
                style={[s.outfitCard, { borderColor: isActive ? colors.primary : colors.border }]}
                onPress={() => openOutfit(outfit.id)}
                activeOpacity={0.85}
              >
                {outfit.imageUri ? (
                  <Image source={{ uri: outfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }]}>
                    <Icon name="camera" size={22} color="rgba(255,255,255,0.3)" />
                  </View>
                )}
                <LinearGradient colors={['transparent', 'rgba(8,6,22,0.90)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]} pointerEvents="none">
                  <Text style={s.outfitName} numberOfLines={2}>{outfit.name}</Text>
                  {isActive && (
                    <View style={[s.activePill, { backgroundColor: colors.primary }]}>
                      <Text style={s.activePillText}>{t('components.profileSection.worn')}</Text>
                    </View>
                  )}
                </LinearGradient>
                {(outfit.tags ?? []).length > 0 && (
                  <View style={[s.rarityPill, { backgroundColor: 'rgba(8,6,22,0.75)', top: 6, left: 6 }]}>
                    <Text style={[s.rarityText, { color: 'rgba(220,200,255,0.9)' }]}>{outfit.tags[0]}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Gallery ─── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>{t('profile.galleryUsage')}</Text>
            {gallery.length > 0 && (
              <View style={[s.countPill, { backgroundColor: colors.muted }]}>
                <Text style={[s.countPillText, { color: colors.foreground }]}>{gallery.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={handleAddGalleryPhoto}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {galleryUploading ? (
              <ActivityIndicator size="small" color="#B89AE8" />
            ) : (
              <Icon name="plus" size={13} color="#B89AE8" />
            )}
            <Text style={[s.addBtnText, { color: colors.foreground }]}>{t('common.addPhoto')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollPad}>
          {gallery.slice(0, 8).map(photo => (
            <TouchableOpacity key={photo.id} style={s.galleryThumb} onPress={() => openPhoto(photo)} activeOpacity={0.88}>
              <Image source={{ uri: photo.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.galleryThumb, { borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}
            onPress={handleAddGalleryPhoto}
            activeOpacity={0.75}
          >
            <Icon name="plus" size={20} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontSize: 12, textAlign: 'center', fontFamily: 'Satoshi-Medium', marginTop: 8 }}>{t('common.addPhoto')}</Text>
          </TouchableOpacity>
        </ScrollView>

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
    </>
  );
}

// ── Section styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  section:       { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle:  { fontSize: 17, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },
  countPill:     { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  countPillText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 12, minHeight: 36, borderWidth: 1 },
  addBtnText:    { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  scrollPad:     { paddingRight: 16, gap: 12 },
  outfitCard:    { width: CARD_W, height: CARD_H, borderRadius: 14, overflow: 'hidden', borderWidth: 1, position: 'relative', backgroundColor: 'rgba(255,255,255,0.03)' },
  outfitName:    { fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.95)', lineHeight: 14 },
  activePill:    { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  activePillText:{ fontSize: 9, fontFamily: 'Satoshi-Bold', color: '#fff' },
  rarityPill:    { position: 'absolute', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)' },
  rarityText:    { fontSize: 9, fontFamily: 'Satoshi-Medium' },
  galleryThumb:  { width: 80, height: 80, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  galError:      { fontSize: 12, fontFamily: 'Satoshi-Regular' },
});

// ── Story card styles ─────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  card:      { width: CARD_W, height: CARD_H, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', position: 'relative' },
  grad:      { position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%' },
  moodDot:   { position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 3.5 },
  globeBadge:{ position: 'absolute', top: 9, left: 9, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  videoBadge:{ position: 'absolute', top: 9, left: 9, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(107,91,149,0.55)', alignItems: 'center', justifyContent: 'center' },
  menuBtn:   { position: 'absolute', top: 5, right: 3, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  bottom:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, gap: 5 },
  title:     { fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.97)', lineHeight: 14 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText:  { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.75)', marginRight: 3 },
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
