import { Icon } from '@/components/Icon';
import { BadgeTray } from '@/components/profile/BadgeTray';
import type { DiscoverPost } from '@/context/AppContext';
import * as Haptics from 'expo-haptics';
import { ReelVideo } from '@/components/ReelVideo';
import { SecureImage as Image } from '@/components/SecureImage';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors as useKindnessColors } from '@workspace/storigam-kindness/hooks/use-colors';
import type { NativeThemeColors } from '@workspace/storigam-kindness/lib/native-theme';
import React, { useEffect, useState } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  post: DiscoverPost;
  height: number;
  topInset: number;
  playing: boolean;
  prepareVideo: boolean;
  onVideoReady: (id: string, allowed: boolean) => void;
  muted: boolean;
  onOpen: (post: DiscoverPost) => void;
  onAuthorPress: (userId: string) => void;
  onMuteToggle: () => void;
  onShare: (post: DiscoverPost) => void;
  onComment: (post: DiscoverPost) => void;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onReport: (id: string) => void;
}

function ReelAction({ name, label, active, count, onPress, colors, reduceMotion, compact = false, haptics = true, top }: {
  name: string;
  label: string;
  active?: boolean;
  count?: number;
  onPress: () => void;
  colors: NativeThemeColors;
  reduceMotion: boolean;
  compact?: boolean;
  haptics?: boolean;
  top?: number;
}) {
  const pressScale = useSharedValue(1);
  const haloOpacity = useSharedValue(active ? 0.24 : 0);
  const haloScale = useSharedValue(active ? 1 : 0.78);
  const size = compact ? 38 : 48;
  const stageSize = size + 10;

  useEffect(() => {
    cancelAnimation(haloOpacity);
    cancelAnimation(haloScale);
    if (reduceMotion) {
      cancelAnimation(pressScale);
      pressScale.value = 1;
      haloOpacity.value = active ? 0.24 : 0;
      haloScale.value = active ? 1 : 0.78;
      return;
    }

    haloOpacity.value = withTiming(active ? 0.24 : 0, { duration: 180 });
    haloScale.value = withSpring(active ? 1 : 0.78, { damping: 12, stiffness: 240 });
    return () => {
      cancelAnimation(haloOpacity);
      cancelAnimation(haloScale);
    };
  }, [active, haloOpacity, haloScale, pressScale, reduceMotion]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  const pressIn = () => {
    if (reduceMotion) return;
    pressScale.value = withSpring(0.92, { damping: 12, stiffness: 280 });
  };

  const pressOut = () => {
    if (reduceMotion) return;
    pressScale.value = withSequence(
      withSpring(1.06, { damping: 8, stiffness: 320 }),
      withSpring(1, { damping: 11, stiffness: 250 }),
    );
  };

  return (
    <TouchableOpacity
      style={compact ? [styles.muteButton, top !== undefined && { top }] : styles.action}
      onPress={() => { if (haptics) void Haptics.selectionAsync(); onPress(); }}
      onPressIn={pressIn}
      onPressOut={pressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
    >
      <View style={[styles.iconStage, { width: stageSize, height: stageSize }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.actionHalo,
            {
              width: stageSize,
              height: stageSize,
              borderRadius: stageSize / 2,
              borderColor: colors.primary,
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            },
            haloStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.actionIcon,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: active ? colors.primary : colors.secondary,
              borderColor: active ? colors.ring : colors.border,
            },
            pressStyle,
          ]}
        >
          <Icon name={name} size={compact ? 18 : 23} color={active ? colors.primaryForeground : colors.secondaryForeground} />
        </Animated.View>
      </View>
      {!compact && (
        <Text style={[styles.actionText, { color: colors.foreground, fontFamily: colors.fontFamily.bold, textShadowColor: colors.background }]}>
          {label}{count !== undefined ? ` · ${count}` : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export const ReelCard = React.memo(function ReelCard({
  post, height, topInset, playing, prepareVideo, onVideoReady, muted, onOpen, onAuthorPress,
  onMuteToggle, onShare, onComment, onLike, onSave, onReport,
}: Props) {
  const { t } = useTranslation();
  const colors = useKindnessColors('dark');
  const isVideo = post.contentType === 'video' && !!post.videoUri;
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => { if (!playing) setPaused(false); }, [playing]);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => { if (mounted) setReduceMotion(enabled); })
      .catch(() => null);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  const imageUri = isVideo ? post.thumbnailUri : (post.panels?.[0]?.imageUri ?? post.imageUri);
  return (
    <View style={[styles.card, { height }]}>
      {imageUri ? (
        <>
          {!isVideo && <>
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={24} />
            <View style={styles.backdropTint} />
          </>}
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            contentFit={isVideo ? 'cover' : 'contain'}
            cachePolicy="memory-disk"
          />
        </>
      ) : (
        <LinearGradient colors={['#1D1442', '#27194C', '#100B22']} style={StyleSheet.absoluteFill} />
      )}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={() => { if (isVideo) setPaused(value => !value); else onOpen(post); }}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={isVideo
          ? t(paused ? 'reels.resumeVideo' : 'reels.pauseVideo', { defaultValue: paused ? 'Resume video' : 'Pause video' })
          : t('reels.readNamed', { title: post.chapterTitle })}
      />
      {isVideo && prepareVideo && <ReelVideo uri={post.videoUri!} playing={playing && !paused} muted={muted} onPrepared={allowed => onVideoReady(post.id, allowed)} />}
      {isVideo && playing && paused && (
        <View pointerEvents="none" style={styles.pauseIndicator}>
          <Icon name="play" size={35} color="white" />
        </View>
      )}
      <LinearGradient
        colors={['rgba(6,4,18,0.80)', 'rgba(6,4,18,0.12)', 'transparent']}
        locations={[0, 0.55, 1]}
        style={styles.topShade}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(7,5,20,0.22)', 'rgba(7,5,20,0.91)']}
        locations={[0, 0.42, 1]}
        style={styles.bottomShade}
        pointerEvents="none"
      />

      <View style={[styles.authorRow, { top: topInset + 102 }]}>
        <TouchableOpacity onPress={() => onAuthorPress(post.authorUserId)} style={styles.authorTap} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel={t('reels.viewProfile', { name: post.authorName })}>
          <View style={styles.avatar}>
            {post.authorAvatarUri
              ? <Image source={{ uri: post.authorAvatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              : <Text style={styles.avatarInitial}>{post.authorName.charAt(0).toUpperCase()}</Text>}
          </View>
          <View style={styles.authorText}>
            <Text style={styles.authorName} numberOfLines={1}>{post.authorName}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chapterPill} onPress={() => onOpen(post)} accessibilityLabel={t('reels.openChapter', { n: post.chapterNumber })}>
          <Text style={styles.chapterText}>{isVideo ? t('reels.videoUpper') : t('reels.chapterShort', { n: post.chapterNumber })}</Text>
          <Icon name="chevron-right" size={13} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isVideo && (
        <ReelAction
          name={muted ? 'volume-x' : 'volume-2'}
          label={t(muted ? 'reels.unmute' : 'reels.mute')}
          active={muted}
          onPress={onMuteToggle}
          colors={colors}
          reduceMotion={reduceMotion}
          compact
          haptics={false}
          top={topInset + 40}
        />
      )}

      <View style={styles.actions}>
        <ReelAction name="heart" label={t(post.liked ? 'reels.liked' : 'reels.like')} count={post.likeCount} active={post.liked} onPress={() => onLike(post.id)} colors={colors} reduceMotion={reduceMotion} />
        <ReelAction name="message-circle" label={t('reels.comments', { defaultValue: 'Comment' })} onPress={() => onComment(post)} colors={colors} reduceMotion={reduceMotion} />
        <ReelAction name="share-2" label={t('reels.share')} onPress={() => onShare(post)} colors={colors} reduceMotion={reduceMotion} />
        <ReelAction name="bookmark" label={t(post.saved ? 'reels.saved' : 'reels.save')} active={post.saved} onPress={() => onSave(post.id)} colors={colors} reduceMotion={reduceMotion} />
        <ReelAction name="flag" label={t('reels.report')} onPress={() => onReport(post.id)} colors={colors} reduceMotion={reduceMotion} />
      </View>

      <View style={styles.details} pointerEvents="box-none">
        <View style={styles.moodPill}>
          <Icon name="star" size={12} color="#E9D7FF" />
          <Text style={styles.moodText}>{post.vibe || post.mood || t('reels.story')}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{post.chapterTitle}</Text>
        <Text style={styles.byline} numberOfLines={1}>
          {post.authorHandle || post.authorName}
          {post.authorTitle ? `  ·  ${post.authorTitle}` : ''}
        </Text>
        {!!post.authorBadges?.length && <BadgeTray badges={post.authorBadges} />}
        {!!post.bookTitle && <Text style={styles.bookTitle} numberOfLines={1}>{post.bookTitle}</Text>}
        <TouchableOpacity style={styles.openLink} onPress={() => onOpen(post)} accessibilityRole="button" accessibilityLabel={t(isVideo ? 'reels.watchFull' : 'reels.readFull')}>
          <Text style={styles.openText}>{t(isVideo ? 'reels.watchFull' : 'reels.readStory')}</Text>
          <Icon name="arrow-right" size={15} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.bottomRule} pointerEvents="none" />
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: '100%', overflow: 'hidden', backgroundColor: '#100B22' },
  pauseIndicator: { position: 'absolute', top: '45%', alignSelf: 'center', padding: 18, borderRadius: 40, backgroundColor: 'rgba(8,6,24,0.58)' },
  backdropTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,6,24,0.34)' },
  topShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 260 },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 355 },
  authorRow: { position: 'absolute', left: 19, right: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.84)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#574384' },
  avatarInitial: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Satoshi-Bold' },
  authorText: { flex: 1 },
  authorName: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Satoshi-Bold', textShadowColor: '#000', textShadowRadius: 4 },
  chapterPill: { backgroundColor: 'rgba(8,6,24,0.66)', paddingHorizontal: 10, height: 31, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chapterText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 0.5 },
  muteButton: { position: 'absolute', right: 16, alignItems: 'center', justifyContent: 'center' },
  actions: { position: 'absolute', right: 14, bottom: 106, alignItems: 'center', gap: 12 },
  action: { alignItems: 'center', width: 76 },
  iconStage: { alignItems: 'center', justifyContent: 'center' },
  actionHalo: { position: 'absolute', borderWidth: 1, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 7 },
  actionIcon: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  actionText: { fontSize: 10, textShadowRadius: 3, marginTop: 3 },
  details: { position: 'absolute', left: 22, bottom: 26, right: 92, alignItems: 'flex-start' },
  moodPill: { backgroundColor: 'rgba(30,20,50,0.72)', borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 7 },
  moodText: { color: '#E9D7FF', fontSize: 11, fontFamily: 'Satoshi-Bold' },
  title: { color: '#FFFFFF', fontSize: 26, lineHeight: 31, letterSpacing: -0.7, fontFamily: 'Satoshi-Black', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  byline: { color: 'rgba(244,236,255,0.85)', fontSize: 12, fontFamily: 'Satoshi-Medium', marginTop: 3 },
  bookTitle: { color: '#DECAFF', fontSize: 11, fontFamily: 'Satoshi-Medium', marginTop: 4 },
  openLink: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13, paddingVertical: 4 },
  openText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Satoshi-Bold' },
  bottomRule: { position: 'absolute', left: 22, right: 22, bottom: 9, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.48)' },
});