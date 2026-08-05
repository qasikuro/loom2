import { Icon } from '@/components/Icon';
import type { GalleryPhoto, Outfit, Story } from '@/context/AppContext';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Images } from '@/assets/images/index';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BG_MAP: Record<string, any> = {
  bg1:  Images.story_bg1,
  bg2:  Images.story_bg2,
  bg3:  Images.story_bg3,
  char: Images.character_default,
};

function getStoryCover(story: Story) {
  // Video posts use their extracted thumbnail
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
  Dreamy: '#9B7AB5', Mysterious: '#6B6BA5',
};

// ── Story action sheet ────────────────────────────────────────────────────────

interface StoryActionSheetProps {
  story: Story | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onTogglePublic: (id: string, isPublic: boolean) => void;
}

function StoryActionSheet({ story, onClose, onDelete, onTogglePublic }: StoryActionSheetProps) {
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
        {/* Story preview row */}
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
                <Text style={ss.statChipText}>{story.witnessedCount} witnessed</Text>
              </View>
              <View style={ss.statChip}>
                <Icon name="bookmark" size={11} color="rgba(200,184,232,0.75)" />
                <Text style={ss.statChipText}>{story.savedCount} saved</Text>
              </View>
              {(story.stickerCount ?? 0) > 0 && (
                <View style={ss.statChip}>
                  <Text style={{ fontSize: 10, color: 'rgba(255,210,100,0.9)', lineHeight: 13 }}>✦</Text>
                  <Text style={ss.statChipText}>{story.stickerCount}</Text>
                </View>
              )}
            </View>
            <View style={[ss.pubBadge, { backgroundColor: story.isPublic ? `${moodColor}20` : 'rgba(200,184,232,0.08)', borderColor: story.isPublic ? `${moodColor}40` : 'rgba(200,184,232,0.15)' }]}>
              <Icon name={story.isPublic ? 'globe' : 'lock'} size={9} color={story.isPublic ? moodColor : 'rgba(200,184,232,0.5)'} />
              <Text style={[ss.pubText, { color: story.isPublic ? moodColor : 'rgba(200,184,232,0.5)' }]}>
                {story.isPublic ? 'Public' : 'Private'}
              </Text>
            </View>
          </View>
        </View>

        <View style={[ss.divider, { backgroundColor: 'rgba(200,184,232,0.08)' }]} />

        {/* Actions — story-only (hidden for video posts) */}
        {story.contentType !== 'video' && (
          <TouchableOpacity style={ss.action} onPress={() => { dismiss(); setTimeout(() => router.push(`/story/${story.id}` as never), 280); }} activeOpacity={0.75}>
            <View style={[ss.actionIcon, { backgroundColor: 'rgba(155,122,232,0.12)' }]}>
              <Icon name="eye" size={16} color="#9B7AB5" />
            </View>
            <Text style={[ss.actionText, { color: colors.foreground }]}>View story</Text>
            <Icon name="chevron-right" size={14} color="rgba(200,184,232,0.35)" />
          </TouchableOpacity>
        )}

        {story.contentType !== 'video' && (
          <TouchableOpacity style={ss.action} onPress={() => { dismiss(); setTimeout(() => router.push((`/chapter-editor?editId=${story.id}`) as never), 280); }} activeOpacity={0.75}>
            <View style={[ss.actionIcon, { backgroundColor: 'rgba(100,180,120,0.12)' }]}>
              <Icon name="edit-2" size={16} color="#64B478" />
            </View>
            <Text style={[ss.actionText, { color: colors.foreground }]}>Edit story</Text>
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
            {story.isPublic ? 'Make private' : 'Make public'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={ss.action} onPress={handleDelete} activeOpacity={0.75}>
          <View style={[ss.actionIcon, { backgroundColor: confirmDelete ? 'rgba(180,60,60,0.18)' : 'rgba(180,60,60,0.10)' }]}>
            <Icon name="trash-2" size={16} color={confirmDelete ? '#E05555' : '#C06060'} />
          </View>
          <Text style={[ss.actionText, { color: confirmDelete ? '#E05555' : '#C06060' }]}>
            {confirmDelete ? 'Tap again to confirm delete' : 'Delete story'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[ss.cancelBtn, { backgroundColor: 'rgba(200,184,232,0.07)', borderColor: 'rgba(200,184,232,0.12)' }]} onPress={dismiss} activeOpacity={0.75}>
          <Text style={[ss.cancelText, { color: 'rgba(200,184,232,0.60)' }]}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ── Story card (horizontal scroll) ───────────────────────────────────────────

const CARD_W = 118;
const CARD_H = 152;

function StoryCard({ story, onMenu }: { story: Story; onMenu: (s: Story) => void }) {
  const cover      = getStoryCover(story);
  const moodColor  = MOOD_COLORS[story.mood] ?? '#9B7AB5';
  const isVideo    = story.contentType === 'video';

  return (
    <TouchableOpacity
      style={sc.card}
      onPress={isVideo ? undefined : () => { Haptics.selectionAsync(); router.push(`/story/${story.id}` as never); }}
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

      {/* Video badge — shown in place of globe icon for video posts */}
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
  moodAccent:          string;
}

export function ProfileStyleSection({
  outfits, stories, openOutfit, deleteStory,
  gallery, openPhoto,
  handleAddGalleryPhoto, galleryUploading, galleryError,
  activeOutfitId, moodAccent,
}: Props) {
  const colors = useColors();
  const { updateStory } = useApp();
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  const sorted = [...stories].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      {/* ── My Stories ─── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>My Stories</Text>
            {stories.length > 0 && (
              <View style={[s.countPill, { backgroundColor: `${moodAccent}18`, borderColor: `${moodAccent}28` }]}>
                <Text style={[s.countPillText, { color: moodAccent }]}>{stories.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}
            onPress={() => { Haptics.selectionAsync(); router.push('/my-stories' as never); }}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="book-open" size={12} color={colors.primary} />
            <Text style={[s.addBtnText, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>

        {sorted.length === 0 ? (
          <TouchableOpacity
            style={[s.emptyCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}18` }]}
            onPress={() => router.push('/(tabs)/create' as never)}
            activeOpacity={0.75}
          >
            <View style={[s.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
              <Icon name="book-open" size={20} color={`${colors.primary}70`} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No stories yet</Text>
            <Text style={[s.emptySub, { color: colors.mutedForeground }]}>Write your first sky chapter</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollPad}>
            {sorted.slice(0, 10).map(story => (
              <StoryCard key={story.id} story={story} onMenu={setActiveStory} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Wardrobe ─── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>My Wardrobe</Text>
            {outfits.length > 0 && (
              <View style={[s.countPill, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}28` }]}>
                <Text style={[s.countPillText, { color: colors.primary }]}>{outfits.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}
            onPress={() => router.push('/create-outfit' as never)}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="plus" size={13} color={colors.primary} />
            <Text style={[s.addBtnText, { color: colors.primary }]}>New outfit</Text>
          </TouchableOpacity>
        </View>

        {outfits.length === 0 ? (
          <TouchableOpacity
            style={[s.emptyCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}18` }]}
            onPress={() => router.push('/create-outfit' as never)}
            activeOpacity={0.75}
          >
            <View style={[s.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
              <Icon name="camera" size={20} color={`${colors.primary}70`} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No outfits yet</Text>
            <Text style={[s.emptySub, { color: colors.mutedForeground }]}>Log your first sky look</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollPad}>
            {outfits.slice(0, 8).map(outfit => {
              const isActive = outfit.id === activeOutfitId;
              return (
                <TouchableOpacity
                  key={outfit.id}
                  style={[s.outfitCard, { backgroundColor: colors.card, borderColor: isActive ? colors.primary : colors.border }]}
                  onPress={() => openOutfit(outfit.id)}
                  activeOpacity={0.85}
                >
                  {outfit.imageUri ? (
                    <Image source={{ uri: outfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.primary}14`, alignItems: 'center', justifyContent: 'center' }]}>
                      <Icon name="camera" size={22} color={`${colors.primary}50`} />
                    </View>
                  )}
                  <LinearGradient colors={['transparent', 'rgba(8,6,22,0.90)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}>
                    <Text style={s.outfitName} numberOfLines={2}>{outfit.name}</Text>
                    {isActive && (
                      <View style={[s.activePill, { backgroundColor: colors.primary }]}>
                        <Text style={s.activePillText}>Worn</Text>
                      </View>
                    )}
                  </LinearGradient>
                  {(outfit.tags ?? []).length > 0 && (
                    <View style={[s.rarityPill, { backgroundColor: 'rgba(8,6,22,0.75)', top: 7, left: 7 }]}>
                      <Text style={[s.rarityText, { color: 'rgba(220,200,255,0.9)' }]}>{outfit.tags[0]}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Gallery ─── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Gallery</Text>
            {gallery.length > 0 && (
              <View style={[s.countPill, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}28` }]}>
                <Text style={[s.countPillText, { color: colors.primary }]}>{gallery.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}
            onPress={handleAddGalleryPhoto}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {galleryUploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="plus" size={13} color={colors.primary} />
            )}
            <Text style={[s.addBtnText, { color: colors.primary }]}>Add photo</Text>
          </TouchableOpacity>
        </View>

        {gallery.length === 0 ? (
          <TouchableOpacity
            style={[s.emptyCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}18` }]}
            onPress={handleAddGalleryPhoto}
            activeOpacity={0.75}
          >
            <View style={[s.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
              <Icon name="image" size={20} color={`${colors.primary}70`} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No photos yet</Text>
            <Text style={[s.emptySub, { color: colors.mutedForeground }]}>Tap to add your first sky memory</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollPad}>
            {gallery.slice(0, 8).map(photo => (
              <TouchableOpacity key={photo.id} style={s.galleryThumb} onPress={() => openPhoto(photo)} activeOpacity={0.88}>
                <Image source={{ uri: photo.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
              </TouchableOpacity>
            ))}
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
    </>
  );
}

// ── Section styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  section:       { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle:  { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },
  countPill:     { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  countPillText: { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  addBtnText:    { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  scrollPad:     { paddingRight: 16, gap: 10 },
  outfitCard:    { width: 100, height: 130, borderRadius: 14, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  outfitName:    { fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.95)', lineHeight: 13 },
  activePill:    { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  activePillText:{ fontSize: 9, fontFamily: 'Satoshi-Bold', color: '#fff' },
  rarityPill:    { position: 'absolute', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rarityText:    { fontSize: 9, fontFamily: 'Satoshi-Bold' },
  galleryThumb:  { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A1630' },
  galError:      { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  emptyCard:     { borderRadius: 16, borderWidth: 1, paddingVertical: 22, paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  emptyIcon:     { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle:    { fontSize: 14, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  emptySub:      { fontSize: 12, fontFamily: 'Satoshi-Regular', textAlign: 'center', fontStyle: 'italic', lineHeight: 17 },
});

// ── Story card styles ─────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  card:      { width: CARD_W, height: CARD_H, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1C1840', position: 'relative' },
  grad:      { position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%' },
  moodDot:   { position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 3.5 },
  globeBadge:{ position: 'absolute', top: 9, left: 9, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  videoBadge:{ position: 'absolute', top: 9, left: 9, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(107,91,149,0.55)', alignItems: 'center', justifyContent: 'center' },
  menuBtn:   { position: 'absolute', top: 5, right: 3, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  bottom:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, gap: 5 },
  title:     { fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.97)', lineHeight: 14 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText:  { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.75)', marginRight: 3 },
});

// ── Action sheet styles ───────────────────────────────────────────────────────

const ss = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position:       'absolute',
    bottom:         0,
    left:           0,
    right:          0,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    borderWidth:    1,
    paddingTop:     6,
    paddingHorizontal: 20,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 12 }, android: { elevation: 16 } }),
  },
  previewRow:   { flexDirection: 'row', gap: 14, paddingVertical: 18, alignItems: 'flex-start' },
  previewThumb: { width: 66, height: 82, borderRadius: 12, overflow: 'hidden', flexShrink: 0 },
  previewTitle: { fontSize: 15, fontFamily: 'Satoshi-Bold', lineHeight: 20, marginBottom: 6 },
  statsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  statChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(200,184,232,0.08)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statChipText: { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.80)' },
  pubBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  pubText:      { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  divider:      { height: 1, marginBottom: 8 },
  action:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  actionIcon:   { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionText:   { flex: 1, fontSize: 15, fontFamily: 'Satoshi-Medium' },
  cancelBtn:    { borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 6, borderWidth: 1 },
  cancelText:   { fontSize: 14, fontFamily: 'Satoshi-Bold' },
});
