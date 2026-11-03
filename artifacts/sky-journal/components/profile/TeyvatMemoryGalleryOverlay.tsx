import { Icon } from '@/components/Icon';
import { SecureImage as Image } from '@/components/SecureImage';
import { useSecureMediaUri } from '@/hooks/useSecureMediaUri';
import { Button as KindnessButton } from '@workspace/storigam-kindness/components/native/button';
import { nativeTheme } from '@workspace/storigam-kindness/lib/native-theme';
import { LinearGradient } from 'expo-linear-gradient';
import { ResizeMode, VideoSurface as Video } from '@/components/VideoSurface';
import { Audio } from '@/utils/audioCompat';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createTeyvatViewerSession } from './teyvatViewerSession';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type TeyvatMemoryCategory = 'story' | 'outfit' | 'tutorial' | 'photo';

export interface TeyvatMemoryGalleryItem {
  id: string;
  category: TeyvatMemoryCategory | (string & {});
  title: string;
  subtitle?: string;
  imageUri?: string | null;
  mediaType?: 'image' | 'video';
  videoUri?: string | null;
  fallbackIcon?: string;
  onSelect?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  editLabel?: string;
  onViewAsOthers?: () => void;
  viewAsOthersLabel?: string;
  deleteLabel?: string;
  confirmDeleteLabel?: string;
}

export interface TeyvatMemoryGalleryOverlayProps {
  visible: boolean;
  items: TeyvatMemoryGalleryItem[];
  initialFilter?: 'all' | 'stories' | 'outfits';
  onClose: () => void;
  renderBox: (mode: 'closed' | 'open') => React.ReactNode;
}

type FilterId = 'all' | 'stories' | 'outfits';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stories', label: 'Stories' },
  { id: 'outfits', label: 'Outfits' },
];

function matchesFilter(item: TeyvatMemoryGalleryItem, filter: FilterId) {
  if (filter === 'all') return true;
  const category = item.category.toLowerCase();
  if (filter === 'stories') return category === 'story' || category === 'stories';
  if (filter === 'outfits') return category === 'outfit' || category === 'outfits';
  return false;
}

function categoryLabel(category: string) {
  const normalized = category.toLowerCase();
  if (normalized === 'story' || normalized === 'stories') return 'Story';
  if (normalized === 'outfit' || normalized === 'outfits') return 'Outfit';
  if (normalized === 'tutorial' || normalized === 'tutorials') return 'Tutorial';
  return 'Memory';
}

function categoryIcon(category: string) {
  const normalized = category.toLowerCase();
  if (normalized === 'story' || normalized === 'stories') return 'book-open';
  if (normalized === 'outfit' || normalized === 'outfits') return 'grid';
  if (normalized === 'tutorial' || normalized === 'tutorials') return 'book';
  return 'image';
}

export function TeyvatMemoryGalleryOverlay({
  visible,
  items,
  initialFilter = 'all',
  onClose,
  renderBox,
}: TeyvatMemoryGalleryOverlayProps) {
  const colors = nativeTheme.dark;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [filter, setFilter] = useState<FilterId>(initialFilter);
  const wasVisible = useRef(false);
  const [selection, setSelection] = useState<{ item: TeyvatMemoryGalleryItem; session: number } | null>(null);
  const selected = selection?.item;
  const selectedVideoUri = selected?.mediaType === 'video' ? selected.videoUri : null;
  const selectedVideoPosterUri = selected?.mediaType === 'video' ? selected.imageUri : null;
  const { uri: playableVideoUri, renew: renewVideoUri, error: videoUriError } = useSecureMediaUri(
    selectedVideoUri,
    { waitForAuthorization: true },
  );
  const { uri: playablePosterUri } = useSecureMediaUri(
    selectedVideoPosterUri,
    { waitForAuthorization: true },
  );
  const [videoReady, setVideoReady] = useState(false);
  const [videoPlaybackError, setVideoPlaybackError] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contentWidth, setContentWidth] = useState(width);
  const viewerSession = useRef(createTeyvatViewerSession()).current;
  const entranceAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;
  const boxReveal = useRef(new Animated.Value(0)).current;
  const galleryReveal = useRef(new Animated.Value(1)).current;
  const memoryReveal = useRef(new Animated.Value(0)).current;
  const activeFilter = visible && !wasVisible.current ? initialFilter : filter;
  const columns = contentWidth >= 1000 ? 6 : contentWidth >= 720 ? 5 : contentWidth >= 340 ? 4 : 3;
  const gap = 8;
  const sidePadding = contentWidth >= 700 ? 24 : 16;
  const tileWidth = Math.max(
    64,
    Math.floor((contentWidth - sidePadding * 2 - gap * (columns - 1)) / columns),
  );
  const filteredItems = useMemo(
    () => items.filter(item => matchesFilter(item, activeFilter)),
    [items, activeFilter],
  );
  const selectedSession = selection?.session;
  useEffect(() => {
    setVideoReady(false);
    setVideoPlaybackError(false);
    setVideoMuted(false);
    setConfirmDeleteId(null);
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    return () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    };
  }, [selected?.id, visible]);
  useEffect(() => {
    if (!visible || !selectedVideoUri) return;
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    }).catch(() => null);
  }, [selectedVideoUri, visible]);
  useLayoutEffect(() => {
    // Do not accept another grid press until the previous native layer is gone.
    if (!selection) viewerSession.commitClosed();
  }, [selection, viewerSession]);
  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      viewerSession.reset();
      setSelection(null);
      return;
    }
    wasVisible.current = true;
    viewerSession.reset();
    setFilter(initialFilter);
    setSelection(null);
    dragY.setValue(0);
    boxReveal.setValue(0);
    galleryReveal.setValue(0);
    memoryReveal.setValue(0);
    const reveal = Animated.parallel([
      Animated.spring(boxReveal, {
        toValue: 1,
        stiffness: 125,
        damping: 17,
        mass: 0.82,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(galleryReveal, {
        toValue: 1,
        duration: 300,
        delay: 45,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]);
    reveal.start();
    return () => reveal.stop();
  }, [boxReveal, dragY, galleryReveal, initialFilter, memoryReveal, viewerSession, visible]);
  useLayoutEffect(() => {
    if (selectedSession === undefined) return;
    dragY.setValue(0);
    memoryReveal.setValue(0);
    backdropOpacity.setValue(0);
    const reveal = Animated.parallel([
      Animated.timing(memoryReveal, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]);
    entranceAnimation.current = reveal;
    reveal.start();
    return () => {
      reveal.stop();
      if (entranceAnimation.current === reveal) entranceAnimation.current = null;
    };
  }, [backdropOpacity, dragY, memoryReveal, selectedSession]);

  const changeFilter = (nextFilter: FilterId) => {
    if (nextFilter === activeFilter) return;
    setFilter(nextFilter);
  };
  const closeSelected = useCallback((swipe = false) => {
    if (selectedSession === undefined || !viewerSession.beginClose(selectedSession)) return;
    // The entrance and exit must never compete for the same native values.
    entranceAnimation.current?.stop();
    dragY.stopAnimation();
    Animated.parallel([
      Animated.timing(memoryReveal, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(dragY, { toValue: swipe ? height : 18, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      // Even an interrupted exit must remove its layer, not strand an invisible
      // touch shield. A stale callback cannot dismiss a newer viewing session.
      if (viewerSession.finishClose(selectedSession)) setSelection(null);
    });
  }, [backdropOpacity, dragY, height, memoryReveal, selectedSession, viewerSession]);
  const handleDeleteSelected = useCallback(() => {
    if (!selected?.onDelete) return;
    if (confirmDeleteId !== selected.id) {
      setConfirmDeleteId(selected.id);
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      deleteTimer.current = setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    setConfirmDeleteId(null);
    selected.onDelete();
    closeSelected();
  }, [closeSelected, confirmDeleteId, selected]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          viewerSession.isOpen() && gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.15,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          entranceAnimation.current?.stop();
          memoryReveal.setValue(1);
          backdropOpacity.setValue(1);
        },
        onPanResponderMove: (_event, gesture) => {
          if (viewerSession.isOpen() && gesture.dy > 0) {
            dragY.setValue(gesture.dy);
            backdropOpacity.setValue(Math.max(0.3, 1 - gesture.dy / Math.max(height * 0.75, 1)));
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          if (!viewerSession.isOpen()) return;
          if (gesture.dy > Math.min(72, height * 0.1) || gesture.vy > 0.55) {
            closeSelected(true);
          } else {
            Animated.parallel([
              Animated.timing(memoryReveal, { toValue: 1, duration: 150, useNativeDriver: true }),
              Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 3 }),
              Animated.timing(backdropOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
            ]).start();
          }
        },
        onPanResponderTerminate: () => {
          if (!viewerSession.isOpen()) return;
          Animated.parallel([
            Animated.timing(memoryReveal, { toValue: 1, duration: 150, useNativeDriver: true }),
            Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 3 }),
            Animated.timing(backdropOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        },
      }),
    [backdropOpacity, closeSelected, dragY, height, memoryReveal, viewerSession],
  );

  const selectItem = useCallback((item: TeyvatMemoryGalleryItem) => {
    const session = viewerSession.open();
    if (session === null) return;
    item.onSelect?.();
    setSelection({ item, session });
  }, [viewerSession]);

  const renderItem = useCallback<ListRenderItem<TeyvatMemoryGalleryItem>>(({ item }) => (
    <TouchableOpacity
      style={[
        styles.tile,
        {
          width: tileWidth,
          height: tileWidth,
          marginBottom: gap,
          backgroundColor: colors.muted,
          borderColor: 'rgba(220,197,255,0.16)',
        },
      ]}
      activeOpacity={0.88}
      onPress={() => selectItem(item)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${categoryLabel(item.category)}${item.mediaType === 'video' ? ' video' : ''}: ${item.title}`}
      testID={`teyvat-memory-item-${item.id}`}
    >
      {item.imageUri ? (
        <Image
          source={{ uri: item.imageUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={140}
        />
      ) : (
        <LinearGradient
          colors={['rgba(177,119,255,0.34)', 'rgba(77,54,126,0.62)', 'rgba(22,17,46,0.96)']}
          style={[StyleSheet.absoluteFill, styles.fallback]}
        >
          <Icon name={item.fallbackIcon || categoryIcon(item.category)} size={25} color="#E5C5FF" />
        </LinearGradient>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(10,7,26,0.22)', 'rgba(9,6,22,0.91)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {item.mediaType === 'video' && (
        <View style={styles.videoBadge} pointerEvents="none">
          <Icon name="play" size={12} color="#FFF" />
        </View>
      )}
    </TouchableOpacity>
  ), [colors.muted, selectItem, tileWidth]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => (selected ? closeSelected() : onClose())}
    >
      <View
        style={[styles.screen, { backgroundColor: '#100B20', width, height }]}
        onLayout={event => {
          const nextWidth = event.nativeEvent.layout.width;
          if (Math.abs(nextWidth - contentWidth) > 1) setContentWidth(nextWidth);
        }}
      >
        <LinearGradient
          colors={['#211735', '#130E25', '#0D0A1A']}
          locations={[0, 0.44, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerTitles}>
            <Text style={styles.eyebrow}>A PERSONAL ARCHIVE</Text>
            <Text style={styles.heading}>Memories in Teyvat</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.78}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close memory gallery and return to profile"
            testID="teyvat-memory-gallery-close"
          >
            <Icon name="x" size={19} color="#F7EFFC" />
          </TouchableOpacity>
        </View>

        <Animated.View
          pointerEvents={selected ? 'none' : 'auto'}
          accessibilityElementsHidden={!!selected}
          importantForAccessibility={selected ? 'no-hide-descendants' : 'auto'}
          style={[
            styles.listWrap,
            {
              opacity: galleryReveal,
              transform: [{ translateY: galleryReveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          <FlatList
            key={`memory-grid-${columns}`}
            style={styles.flatList}
            data={filteredItems}
            numColumns={columns}
            initialNumToRender={columns * 3}
            maxToRenderPerBatch={columns * 2}
            updateCellsBatchingPeriod={50}
            windowSize={5}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingHorizontal: sidePadding, paddingBottom: insets.bottom + 28 },
              filteredItems.length === 0 && styles.emptyList,
            ]}
            columnWrapperStyle={styles.gridRow}
            ListHeaderComponent={
              <View>
                <View style={styles.boxStage}>
                  <LinearGradient
                    colors={['rgba(197,119,255,0.18)', 'rgba(99,70,155,0.07)', 'transparent']}
                    style={styles.boxGlow}
                    pointerEvents="none"
                  />
                  <View style={styles.boxAura} pointerEvents="none" />
                  <View style={styles.boxContent} accessibilityLabel="Open memory box">
                    <Animated.View
                      style={{
                        width: '100%',
                        height: '100%',
                        opacity: boxReveal,
                        transform: [
                          { translateY: boxReveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                          { scale: boxReveal.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
                        ],
                      }}
                    >
                      {renderBox('open')}
                    </Animated.View>
                  </View>
                  <View style={styles.archiveCaption}>
                    <Text style={styles.archiveCount}>{filteredItems.length} {filteredItems.length === 1 ? 'moment' : 'moments'}</Text>
                    <Text style={styles.archiveHint}>Collected along the way</Text>
                  </View>
                </View>
                <View style={styles.sectionRow}>
                  <View>
                    <Text style={styles.sectionTitle}>The collection</Text>
                    <Text style={styles.sectionSubtitle}>Small moments, kept close</Text>
                  </View>
                  <Text style={styles.resultCount}>{filteredItems.length.toString().padStart(2, '0')}</Text>
                </View>
                <View style={styles.filterRail} accessibilityRole="tablist">
                  {FILTERS.map(tab => {
                    const active = activeFilter === tab.id;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        style={[styles.filter, active && styles.filterActive]}
                        onPress={() => changeFilter(tab.id)}
                        activeOpacity={0.82}
                        accessibilityRole="tab"
                        accessibilityLabel={`${tab.label} memories`}
                        accessibilityState={{ selected: active }}
                        testID={`teyvat-memory-filter-${tab.id}`}
                      >
                        <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{tab.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {filteredItems.length > 0 && (
                  <Text style={styles.gridNote}>TAP A MEMORY TO REVISIT IT</Text>
                )}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyMark}>
                  <Icon name="image" size={22} color="#D0A8F8" />
                </View>
                <Text style={styles.emptyTitle}>Nothing gathered here yet</Text>
                <Text style={styles.emptyBody}>Other memories in this archive will appear in this collection.</Text>
              </View>
            }
            testID="teyvat-memory-gallery-grid"
          />
        </Animated.View>

        {selected && (
          <Animated.View
            style={[
              styles.lightbox,
              { opacity: backdropOpacity, transform: [{ translateY: dragY }] },
            ]}
            {...panResponder.panHandlers}
            testID="teyvat-memory-lightbox"
          >
            <TouchableOpacity
              style={[styles.lightboxBack, { top: insets.top + 12 }]}
              onPress={() => closeSelected()}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Return to memory gallery"
              testID="teyvat-memory-lightbox-back"
            >
              <Icon name="chevron-down" size={19} color="#FFF8FF" />
            </TouchableOpacity>
            <View style={[styles.lightboxMeta, { top: insets.top + 12 }]} pointerEvents="none">
              <Text style={styles.lightboxCategory}>{categoryLabel(selected.category)}</Text>
              <Text style={styles.lightboxTitle} numberOfLines={2}>{selected.title}</Text>
              {!!selected.subtitle && <Text style={styles.lightboxSubtitle} numberOfLines={2}>{selected.subtitle}</Text>}
            </View>
            <Animated.View
              style={[
                styles.lightboxMedia,
                {
                  opacity: memoryReveal,
                  transform: [
                    { translateY: memoryReveal.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
                    { scale: memoryReveal.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
                  ],
                },
              ]}
            >
              {selected.mediaType === 'video' ? (
                selected.videoUri ? (
                  playableVideoUri && !videoUriError && !videoPlaybackError ? (
                    <View style={[styles.videoFrame, { maxHeight: height * 0.68 }]}>
                      <Video
                        key={`teyvat-video-${selected.id}-${playableVideoUri}`}
                        source={{ uri: playableVideoUri }}
                        posterSource={playablePosterUri ? { uri: playablePosterUri } : undefined}
                        usePoster={!!playablePosterUri}
                        style={styles.videoSurface}
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay
                        isLooping
                        isMuted={videoMuted}
                        volume={1}
                        useNativeControls
                        onLoadStart={() => setVideoReady(false)}
                        onReadyForDisplay={() => setVideoReady(true)}
                        onError={() => {
                          setVideoReady(false);
                          setVideoPlaybackError(true);
                        }}
                        accessibilityLabel={`${selected.title} video`}
                      />
                      <TouchableOpacity
                        style={styles.videoSoundButton}
                        onPress={() => setVideoMuted(value => !value)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={videoMuted ? 'Turn video sound on' : 'Mute video'}
                        accessibilityState={{ selected: videoMuted }}
                        testID="teyvat-video-sound-toggle"
                      >
                        <Icon name={videoMuted ? 'volume-x' : 'volume-2'} size={17} color="#FFFFFF" />
                      </TouchableOpacity>
                      {!videoReady && (
                        <View style={styles.videoLoading} pointerEvents="none">
                          <ActivityIndicator color={colors.primary} />
                          <Text style={[styles.videoUnavailableText, { color: colors.foreground }]}>Preparing video…</Text>
                        </View>
                      )}
                    </View>
                  ) : videoUriError || videoPlaybackError ? (
                    <TouchableOpacity
                      style={styles.videoRetry}
                      activeOpacity={0.8}
                      onPress={() => {
                        setVideoPlaybackError(false);
                        void renewVideoUri();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Retry loading video"
                      testID="teyvat-video-retry"
                    >
                      <Icon name="refresh-cw" size={25} color={colors.primary} />
                      <Text style={[styles.videoUnavailableText, { color: colors.foreground }]}>Video didn’t load. Tap to retry.</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.videoRetry} accessibilityLabel="Preparing video">
                      <ActivityIndicator color={colors.primary} />
                      <Text style={[styles.videoUnavailableText, { color: colors.foreground }]}>Preparing video…</Text>
                    </View>
                  )
                ) : (
                  <View style={styles.lightboxFallback} accessibilityLabel="Video unavailable">
                    <Icon name="film" size={42} color={colors.primary} />
                    <Text style={[styles.videoUnavailableText, { color: colors.foreground }]}>Video unavailable</Text>
                  </View>
                )
              ) : selected.imageUri ? (
                <Image
                  source={{ uri: selected.imageUri }}
                  style={[styles.lightboxImage, { maxHeight: height * 0.68 }]}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  priority="high"
                  recyclingKey={`teyvat-lightbox-${selected.id}`}
                  transition={0}
                  accessibilityLabel={selected.title}
                />
              ) : (
                <View style={styles.lightboxFallback}>
                  <Icon name={selected.fallbackIcon || categoryIcon(selected.category)} size={42} color={colors.primary} />
                </View>
              )}
            </Animated.View>
            {(selected.onViewAsOthers || selected.onEdit || selected.onDelete) && (
                    <View style={[styles.memoryActions, { bottom: insets.bottom + colors.spacing * 13.5, gap: colors.spacing * 2 }]}>
                {selected.onViewAsOthers && (
                  <View style={styles.memoryActionWrap} testID="teyvat-view-as-others">
                    <KindnessButton
                      mode="dark"
                      variant="secondary"
                      label={selected.viewAsOthersLabel || 'See how others view it'}
                      labelStyle={[styles.memoryActionText, { color: colors.secondaryForeground, paddingLeft: 18 }]}
                      style={[
                        styles.memoryAction,
                        {
                          minHeight: colors.spacing * 11,
                          paddingHorizontal: colors.spacing * 3,
                          borderRadius: colors.spacing * 4,
                          backgroundColor: colors.secondary,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={selected.onViewAsOthers}
                      accessibilityLabel={selected.viewAsOthersLabel || 'See how others view this outfit'}
                    />
                    <View style={[styles.memoryActionIcon, { left: colors.spacing * 3 }]} pointerEvents="none">
                      <Icon name="eye" size={15} color={colors.primary} />
                    </View>
                  </View>
                )}
                {selected.onEdit && (
                  <View style={styles.memoryActionWrap} testID="teyvat-memory-edit">
                    <KindnessButton
                      mode="dark"
                      variant="secondary"
                      label={selected.editLabel || 'Edit'}
                      labelStyle={[styles.memoryActionText, { color: colors.primary, paddingLeft: 18 }]}
                      style={[
                        styles.memoryAction,
                        {
                          minHeight: colors.spacing * 11,
                          paddingHorizontal: colors.spacing * 3,
                          borderRadius: colors.spacing * 4,
                          backgroundColor: colors.secondary,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={selected.onEdit}
                      accessibilityLabel={selected.editLabel || `Edit ${categoryLabel(selected.category)}`}
                    />
                    <View style={[styles.memoryActionIcon, { left: colors.spacing * 3 }]} pointerEvents="none">
                      <Icon name="edit-2" size={15} color={colors.primary} />
                    </View>
                  </View>
                )}
                {selected.onDelete && (
                  <View style={styles.memoryActionWrap} testID="teyvat-memory-delete">
                    <KindnessButton
                      mode="dark"
                      variant="outline"
                      label={confirmDeleteId === selected.id
                        ? selected.confirmDeleteLabel || 'Confirm delete'
                        : selected.deleteLabel || 'Delete'}
                      labelStyle={[styles.memoryActionText, { color: colors.destructiveForeground, paddingLeft: 18 }]}
                      style={[
                        styles.memoryAction,
                        {
                          minHeight: colors.spacing * 11,
                          paddingHorizontal: colors.spacing * 3,
                          borderRadius: colors.spacing * 4,
                          backgroundColor: colors.destructive,
                          borderColor: confirmDeleteId === selected.id ? colors.foreground : colors.destructive,
                        },
                      ]}
                      onPress={handleDeleteSelected}
                      accessibilityLabel={confirmDeleteId === selected.id
                        ? selected.confirmDeleteLabel || 'Confirm delete'
                        : selected.deleteLabel || `Delete ${categoryLabel(selected.category)}`}
                    />
                    <View style={[styles.memoryActionIcon, { left: colors.spacing * 3 }]} pointerEvents="none">
                      <Icon name="trash-2" size={15} color={colors.destructiveForeground} />
                    </View>
                  </View>
                )}
              </View>
            )}
            <View style={[styles.swipeHint, { bottom: insets.bottom + 20 }]} pointerEvents="none">
              <View style={styles.swipeLine} />
              <Text style={styles.swipeText}>SWIPE DOWN TO RETURN</Text>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  header: {
    minHeight: 82,
    paddingHorizontal: 21,
    paddingBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitles: { flex: 1 },
  eyebrow: {
    color: '#C9A9E9',
    fontSize: 9,
    letterSpacing: 2.1,
    fontFamily: 'Satoshi-Bold',
    marginBottom: 4,
  },
  heading: { color: '#FBF5FF', fontSize: 23, lineHeight: 29, fontFamily: 'Satoshi-Bold', letterSpacing: -0.6 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(228,205,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(228,205,255,0.17)',
    marginLeft: 12,
  },
  listContent: { flexGrow: 1, paddingTop: 2 },
  listWrap: { flex: 1 },
  flatList: { flex: 1 },
  boxStage: {
    height: 214,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(207,164,255,0.18)',
    backgroundColor: 'rgba(37,25,58,0.72)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  boxGlow: { ...StyleSheet.absoluteFill },
  boxAura: {
    position: 'absolute',
    width: 184,
    height: 120,
    borderRadius: 90,
    backgroundColor: 'rgba(179,101,241,0.11)',
    transform: [{ translateY: -6 }],
  },
  boxContent: { width: '100%', height: 166, alignItems: 'center', justifyContent: 'center' },
  archiveCaption: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  archiveCount: { color: '#F1D9FF', fontSize: 12, fontFamily: 'Satoshi-Bold' },
  archiveHint: { color: 'rgba(231,214,246,0.52)', fontSize: 10, fontFamily: 'Satoshi-Medium', letterSpacing: 0.2 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: { color: '#FBF5FF', fontSize: 17, fontFamily: 'Satoshi-Bold', letterSpacing: -0.25 },
  sectionSubtitle: { color: 'rgba(229,213,241,0.58)', fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 3 },
  resultCount: { color: '#CFA8F5', fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 1.2 },
  filterRail: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 15,
    backgroundColor: 'rgba(38,29,57,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(215,188,244,0.08)',
    marginBottom: 15,
  },
  filter: {
    minHeight: 38,
    flex: 1,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterActive: {
    backgroundColor: '#A976EC',
    shadowColor: '#A976EC',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  filterLabel: { color: 'rgba(231,216,245,0.61)', fontSize: 11, fontFamily: 'Satoshi-Bold' },
  filterLabelActive: { color: '#FFF9FF' },
  gridNote: { color: 'rgba(218,197,236,0.38)', fontSize: 8, letterSpacing: 1.5, fontFamily: 'Satoshi-Bold', marginBottom: 11 },
  gridRow: { gap: 10, justifyContent: 'flex-start' },
  tile: { borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  videoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,6,22,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(238,219,255,0.3)',
  },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  emptyList: { flexGrow: 1 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 204,
    marginHorizontal: 2,
    marginTop: 3,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(207,164,255,0.13)',
    backgroundColor: 'rgba(35,25,52,0.56)',
  },
  emptyMark: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(174,119,229,0.14)',
    marginBottom: 14,
  },
  emptyTitle: { color: '#F7EEFF', fontSize: 14, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  emptyBody: {
    color: 'rgba(228,211,242,0.58)',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: 'Satoshi-Regular',
    textAlign: 'center',
    marginTop: 7,
    maxWidth: 230,
  },
  lightbox: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
    backgroundColor: 'rgba(9,6,20,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxBack: {
    position: 'absolute',
    left: 18,
    zIndex: 3,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(238,219,255,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(238,219,255,0.17)',
  },
  lightboxMeta: {
    position: 'absolute',
    left: 76,
    right: 22,
  },
  lightboxCategory: { color: '#CBA5ED', fontSize: 9, letterSpacing: 1.5, fontFamily: 'Satoshi-Bold', textTransform: 'uppercase' },
  lightboxTitle: { color: '#FFF8FF', fontSize: 18, lineHeight: 23, fontFamily: 'Satoshi-Bold', marginTop: 3 },
  lightboxSubtitle: { color: 'rgba(235,219,247,0.63)', fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 3 },
  lightboxImage: {
    width: '100%',
    height: '68%',
    marginTop: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(238,219,255,0.18)',
    backgroundColor: 'rgba(33,23,53,0.92)',
  },
  lightboxMedia: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  lightboxFallback: {
    width: 126,
    height: 126,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(173,114,224,0.19)',
    marginTop: 44,
  },
  videoUnavailableText: {
    fontSize: 11,
    fontFamily: nativeTheme.dark.fontFamily.bold,
    marginTop: 10,
  },
  videoFrame: {
    width: '100%',
    height: '68%',
    marginTop: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: nativeTheme.dark.spacing * 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: nativeTheme.dark.border,
    backgroundColor: nativeTheme.dark.card,
  },
  videoSurface: { width: '100%', height: '100%' },
  videoSoundButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 3,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,8,28,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  videoLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${nativeTheme.dark.background}CC`,
  },
  videoRetry: {
    width: 160,
    minHeight: 126,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: nativeTheme.dark.spacing * 6,
    backgroundColor: nativeTheme.dark.secondary,
    marginTop: 44,
  },
  memoryActions: {
    position: 'absolute',
    left: 18,
    right: 18,
    zIndex: 4,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  memoryActionWrap: { flex: 1, position: 'relative' },
  memoryAction: {
    flex: 1,
    minHeight: nativeTheme.dark.spacing * 11,
    paddingHorizontal: nativeTheme.dark.spacing * 3,
    borderRadius: nativeTheme.dark.spacing * 4,
  },
  memoryActionIcon: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  memoryActionText: {
    fontSize: 10.5,
    lineHeight: 13,
    textAlign: 'center',
    fontFamily: nativeTheme.dark.fontFamily.bold,
  },
  swipeHint: { position: 'absolute', alignItems: 'center', gap: 8 },
  swipeLine: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(235,213,250,0.58)' },
  swipeText: { color: 'rgba(228,211,241,0.53)', fontSize: 8, letterSpacing: 1.6, fontFamily: 'Satoshi-Bold' },
});
