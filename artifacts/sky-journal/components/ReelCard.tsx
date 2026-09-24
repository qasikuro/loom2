import { Icon } from '@/components/Icon';
import { BadgeTray } from '@/components/profile/BadgeTray';
import type { DiscoverPost } from '@/context/AppContext';
import * as Haptics from 'expo-haptics';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  post: DiscoverPost;
  height: number;
  topInset: number;
  playing: boolean;
  muted: boolean;
  onOpen: () => void;
  onAuthorPress: () => void;
  onMuteToggle: () => void;
  onShare: () => void;
  onLike: () => void;
  onSave: () => void;
  onReport: () => void;
}

function ReelAction({ name, label, active, count, onPress }: {
  name: string; label: string; active?: boolean; count?: number; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.action}
      onPress={() => { void Haptics.selectionAsync(); onPress(); }}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
    >
      <View style={[styles.actionIcon, active && styles.actionIconActive]}>
        <Icon name={name} size={23} color={active ? '#D9C2FF' : '#FFFFFF'} />
      </View>
      <Text style={styles.actionText}>{label}{count !== undefined ? ` · ${count}` : ''}</Text>
    </TouchableOpacity>
  );
}

export function ReelCard({
  post, height, topInset, playing, muted, onOpen, onAuthorPress,
  onMuteToggle, onShare, onLike, onSave, onReport,
}: Props) {
  const { t } = useTranslation();
  const isVideo = post.contentType === 'video' && !!post.videoUri;
  const imageUri = isVideo ? post.thumbnailUri : (post.panels?.[0]?.imageUri ?? post.imageUri);
  const elapsed = Date.now() - new Date(post.date).getTime();
  const mins = Math.floor(elapsed / 60_000);
  const hours = Math.floor(elapsed / 3_600_000);
  const days = Math.floor(elapsed / 86_400_000);
  const timeLabel = !Number.isFinite(elapsed) || elapsed < 0 ? t(isVideo ? 'reels.video' : 'reels.story')
    : mins < 1 ? t('common.justNow')
    : mins < 60 ? t('common.minsAgo', { n: mins })
    : hours < 24 ? t('common.hoursAgo', { n: hours })
    : days === 1 ? t('common.yesterday')
    : t('common.daysAgo', { n: days });
  return (
    <View style={[styles.card, { height }]}>
      {imageUri ? (
        <>
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={24} />
          <View style={styles.backdropTint} />
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" />
        </>
      ) : (
        <LinearGradient colors={['#1D1442', '#27194C', '#100B22']} style={StyleSheet.absoluteFill} />
      )}
      {isVideo && playing && (
        <Video
          source={{ uri: post.videoUri! }}
          shouldPlay
          isLooping
          isMuted={muted}
          resizeMode={ResizeMode.CONTAIN}
          style={StyleSheet.absoluteFill}
          useNativeControls={false}
        />
      )}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={onOpen}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={t(isVideo ? 'reels.watchNamed' : 'reels.readNamed', { title: post.chapterTitle })}
      />
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
        <TouchableOpacity onPress={onAuthorPress} style={styles.authorTap} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel={t('reels.viewProfile', { name: post.authorName })}>
          <View style={styles.avatar}>
            {post.authorAvatarUri
              ? <Image source={{ uri: post.authorAvatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              : <Text style={styles.avatarInitial}>{post.authorName.charAt(0).toUpperCase()}</Text>}
          </View>
          <View style={styles.authorText}>
            <Text style={styles.authorName} numberOfLines={1}>{post.authorName}</Text>
            <Text style={styles.time}>{timeLabel}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chapterPill} onPress={onOpen} accessibilityLabel={t('reels.openChapter', { n: post.chapterNumber })}>
          <Text style={styles.chapterText}>{isVideo ? t('reels.videoUpper') : t('reels.chapterShort', { n: post.chapterNumber })}</Text>
          <Icon name="chevron-right" size={13} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isVideo && (
        <TouchableOpacity
          style={styles.muteButton}
          onPress={onMuteToggle}
          accessibilityRole="button"
          accessibilityLabel={t(muted ? 'reels.unmute' : 'reels.mute')}
        >
          <Icon name={muted ? 'volume-x' : 'volume-2'} size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <ReelAction name="heart" label={t(post.liked ? 'reels.liked' : 'reels.like')} count={post.likeCount} active={post.liked} onPress={onLike} />
        <ReelAction name="share-2" label={t('reels.share')} onPress={onShare} />
        <ReelAction name="bookmark" label={t(post.saved ? 'reels.saved' : 'reels.save')} active={post.saved} onPress={onSave} />
        <ReelAction name="flag" label={t('reels.report')} onPress={onReport} />
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
        <TouchableOpacity style={styles.openLink} onPress={onOpen} accessibilityRole="button" accessibilityLabel={t(isVideo ? 'reels.watchFull' : 'reels.readFull')}>
          <Text style={styles.openText}>{t(isVideo ? 'reels.watchVideo' : 'reels.readStory')}</Text>
          <Icon name="arrow-right" size={15} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.bottomRule} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', overflow: 'hidden', backgroundColor: '#100B22' },
  backdropTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,6,24,0.34)' },
  topShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 260 },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 355 },
  authorRow: { position: 'absolute', left: 19, right: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.84)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#574384' },
  avatarInitial: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Satoshi-Bold' },
  authorText: { flex: 1 },
  authorName: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Satoshi-Bold', textShadowColor: '#000', textShadowRadius: 4 },
  time: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontFamily: 'Satoshi-Medium', marginTop: 2 },
  chapterPill: { backgroundColor: 'rgba(8,6,24,0.66)', paddingHorizontal: 10, height: 31, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chapterText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 0.5 },
  muteButton: { position: 'absolute', right: 20, top: '43%', backgroundColor: 'rgba(8,6,24,0.58)', padding: 11, borderRadius: 22 },
  actions: { position: 'absolute', right: 14, bottom: 106, alignItems: 'center', gap: 12 },
  action: { alignItems: 'center', width: 76 },
  actionIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(12,9,30,0.63)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.19)' },
  actionIconActive: { backgroundColor: 'rgba(145,100,226,0.72)', borderColor: '#D9C2FF' },
  actionText: { fontSize: 10, fontFamily: 'Satoshi-Bold', color: '#FFFFFF', textShadowColor: '#000', textShadowRadius: 3, marginTop: 3 },
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