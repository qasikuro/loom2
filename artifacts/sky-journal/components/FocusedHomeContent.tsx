import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { resolveUri } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getResumableStoryDraft, type ResumableStoryDraft } from '@/utils/entryDraftStore';
import type { DiscoverPost } from '@/context/mappers';
import * as Haptics from 'expo-haptics';
import { SecureImage as Image } from '@/components/SecureImage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ImageSourcePropType,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

type FocusedHomeContentProps = {
  greeting: string;
  characterName: string;
  characterImage: ImageSourcePropType;
  accent: string;
  hasNotifications: boolean;
  onOpenNotifications: () => void;
  friendStories: DiscoverPost[];
  friendCount: number;
};

const SHORTCUTS = [
  { label: 'Lumi', icon: 'star', route: '/(tabs)/drift' },
  { label: 'Chats', icon: 'message-circle', route: '/friends' },
  { label: 'Guide', icon: 'users', route: '/create-guide-session' },
  { label: 'Journal', icon: 'book-open', route: '/(tabs)/log' },
] as const;

export function FocusedHomeContent({
  greeting,
  characterName,
  characterImage,
  accent,
  hasNotifications,
  onOpenNotifications,
  friendStories,
  friendCount,
}: FocusedHomeContentProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const [resumeDraft, setResumeDraft] = useState<ResumableStoryDraft | null>(null);
  const [draftCheckComplete, setDraftCheckComplete] = useState(false);
  // Let the next cover peek into view without reducing stories to tiny thumbnails.
  const friendCardWidth = Math.max(122, Math.min(142, (screenWidth - 48) * 0.39));

  useFocusEffect(useCallback(() => {
    let active = true;
    setDraftCheckComplete(false);
    getResumableStoryDraft()
      .then(draft => {
        if (!active) return;
        setResumeDraft(draft);
        setDraftCheckComplete(true);
      })
      .catch(() => {
        if (!active) return;
        setResumeDraft(null);
        setDraftCheckComplete(true);
      });
    return () => { active = false; };
  }, []));

  const storyImage = resumeDraft?.imageUri
    ? { uri: resolveUri(resumeDraft.imageUri) ?? resumeDraft.imageUri }
    : Images.create_chapter;

  function openRoute(path: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path as never);
  }

  return (
    <View style={s.content}>
      <View style={s.header}>
        <View style={s.greetingBlock}>
          <Text style={[s.greeting, { color: colors.mutedForeground }]}>{greeting},</Text>
          <Text style={[s.name, { color: accent }]} numberOfLines={2}>{characterName}</Text>
        </View>
        <TouchableOpacity
          testID="home-notifications"
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => {
            onOpenNotifications();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={[s.headerButton, { borderColor: colors.border, backgroundColor: colors.card }]}
          activeOpacity={0.8}
        >
          <Icon name="bell" size={18} color={colors.foreground} />
          {hasNotifications && <View style={s.notificationDot} />}
        </TouchableOpacity>
        <TouchableOpacity
          testID="home-character-avatar"
          accessibilityRole="button"
          accessibilityLabel="Open your character profile"
          onPress={() => openRoute('/(tabs)/profile')}
          style={[s.avatarRing, { borderColor: accent }]}
          activeOpacity={0.82}
        >
          <Image source={characterImage} style={StyleSheet.absoluteFill} contentFit="cover" />
        </TouchableOpacity>
      </View>

      <View style={s.shortcutRow}>
        {SHORTCUTS.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            testID={`home-shortcut-${item.label.toLowerCase()}`}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            style={[s.shortcut, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => openRoute(item.route)}
            activeOpacity={0.78}
          >
            <View style={[s.shortcutIcon, { backgroundColor: `${accent}${index % 2 ? '20' : '2A'}` }]}>
              <Icon name={item.icon as never} size={21} color={accent} />
            </View>
            <Text style={[s.shortcutLabel, { color: colors.foreground }]} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[s.createCard, { borderColor: `${accent}65`, backgroundColor: colors.card }]}>
        <Image source={storyImage} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={resumeDraft
            ? [`${colors.background}F5`, `${colors.background}C9`, `${colors.background}E8`]
            : [`${colors.background}F7`, `${colors.background}BD`, `${colors.background}E8`]}
          locations={[0, 0.58, 1]}
          start={{ x: 0, y: 0.25 }}
          end={{ x: 1, y: 0.85 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.createCopy}>
          <Text style={[s.eyebrow, { color: accent }]}>
            {resumeDraft ? 'PICK UP WHERE YOU LEFT OFF' : 'MAKE SOMETHING YOURS'}
          </Text>
          <Text style={[s.createTitle, { color: colors.foreground }]}>
            {resumeDraft ? 'Continue your story' : 'New story'}
          </Text>
          <Text style={[s.createDescription, { color: colors.mutedForeground }]} numberOfLines={2}>
            {resumeDraft ? resumeDraft.title : 'Choose how you would like to start.'}
          </Text>
        </View>
        <TouchableOpacity
          testID={resumeDraft ? 'home-continue-story' : 'home-new-story'}
          accessibilityRole="button"
          accessibilityLabel={resumeDraft ? `Continue your story, ${resumeDraft.title}` : 'Start a new story'}
          disabled={!draftCheckComplete}
          style={[
            s.storyActionButton,
            { backgroundColor: colors.primary, opacity: draftCheckComplete ? 1 : 0.65 },
          ]}
          onPress={() => {
            if (!draftCheckComplete) return;
            if (!resumeDraft) {
              openRoute('/(tabs)/create');
              return;
            }
            openRoute(
              resumeDraft.kind === 'manga'
                ? '/quick-moment?resumeDraft=1'
                : '/chapter-editor?resumeDraft=1',
            );
          }}
          activeOpacity={0.84}
        >
          <Icon name={resumeDraft ? 'book-open' : 'edit-2'} size={17} color={colors.primaryForeground} />
          <Text style={[s.storyActionText, { color: colors.primaryForeground }]}>{resumeDraft ? 'Continue' : 'New story'}</Text>
          <Icon name="arrow-right" size={16} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        testID="home-character-profile"
        accessibilityRole="button"
        accessibilityLabel="Give your character a story and create an outfit on your profile"
        style={[s.characterCard, { borderColor: `${accent}65`, backgroundColor: colors.card }]}
        onPress={() => openRoute('/(tabs)/profile')}
        activeOpacity={0.86}
      >
        <LinearGradient
          colors={[`${accent}2A`, colors.card, colors.card]}
          locations={[0, 0.62, 1]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Image
          source={characterImage}
          style={s.characterImage}
          contentFit="contain"
          contentPosition="right center"
        />
        <LinearGradient
          colors={[colors.card, `${colors.card}F5`, `${colors.card}00`]}
          locations={[0, 0.56, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 0.8, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={s.characterCopy}>
          <View style={[s.characterIcon, { borderColor: `${accent}70`, backgroundColor: `${accent}20` }]}>
            <Icon name="user" size={18} color={accent} />
          </View>
          <Text style={[s.characterTitle, { color: colors.foreground }]}>
            Give your character a story
          </Text>
          <Text style={[s.characterDescription, { color: colors.mutedForeground }]}>
            Shape their personality, traits, and lore. Make a new outfit on your profile.
          </Text>
          <View style={[s.characterArrow, { backgroundColor: `${accent}20`, borderColor: `${accent}65` }]}>
            <Icon name="arrow-right" size={18} color={accent} />
          </View>
        </View>
      </TouchableOpacity>

      <View style={s.friendsSection}>
        <View style={s.friendsHeader}>
          <View style={s.friendsTitleBlock}>
            <Icon name="users" size={18} color={accent} />
            <Text style={[s.friendsTitle, { color: colors.foreground }]} numberOfLines={1}>Friends’ creations</Text>
            {friendCount > 0 && (
              <View style={[s.friendCount, { backgroundColor: `${accent}20` }]}>
                <Text style={[s.friendCountText, { color: accent }]}>{friendCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            testID="home-friends-see-all"
            accessibilityRole="button"
            accessibilityLabel={t('feature.home.seeAll')}
            onPress={() => openRoute('/(tabs)/discover')}
            style={s.seeAll}
          >
            <Text style={[s.seeAllText, { color: accent }]}>{t('feature.home.seeAll')}</Text>
            <Icon name="arrow-right" size={14} color={accent} />
          </TouchableOpacity>
        </View>

        {friendStories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.friendCards}
          >
            {friendStories.slice(0, 6).map((post) => {
              const imageUri = post.imageUri ? resolveUri(post.imageUri) ?? post.imageUri : undefined;
              const likes = new Intl.NumberFormat(undefined, {
                notation: 'compact',
                maximumFractionDigits: 1,
              }).format(post.witnessedCount ?? 0);
              return (
                <TouchableOpacity
                  key={post.id}
                  testID={`home-friend-creation-${post.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${post.chapterTitle || t('feature.home.untitled')} by ${post.authorName}`}
                  style={[
                    s.friendCard,
                    {
                      width: friendCardWidth,
                      height: friendCardWidth * 1.34,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => openRoute(`/story/${post.id}`)}
                  activeOpacity={0.84}
                >
                  <Image
                    source={imageUri ? { uri: imageUri } : Images.create_chapter}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(7,5,20,0.94)']}
                    locations={[0.38, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={s.friendCardCopy}>
                    <Text style={s.friendCardTitle} numberOfLines={2}>
                      {post.chapterTitle || t('feature.home.untitled')}
                    </Text>
                    <Text style={s.friendAuthor} numberOfLines={1}>{post.authorName}</Text>
                    <View style={s.friendLikes}>
                      <Icon name="heart" size={13} color="#FF5C82" />
                      <Text style={s.friendLikesText}>{likes}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <TouchableOpacity
            testID="home-find-friends"
            accessibilityRole="button"
            onPress={() => openRoute('/friends')}
            style={[s.emptyFriends, { borderColor: colors.border, backgroundColor: colors.card }]}
            activeOpacity={0.82}
          >
            <View style={[s.emptyFriendsIcon, { backgroundColor: `${accent}20` }]}>
              <Icon name="user-plus" size={18} color={accent} />
            </View>
            <View style={s.emptyFriendsCopy}>
              <Text style={[s.emptyFriendsTitle, { color: colors.foreground }]}>Find your friends</Text>
              <Text style={[s.emptyFriendsText, { color: colors.mutedForeground }]}>
                Their new stories will show up here.
              </Text>
            </View>
            <Icon name="arrow-right" size={17} color={accent} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { gap: 17, paddingBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, marginBottom: 2 },
  greetingBlock: { flex: 1, minWidth: 0, justifyContent: 'center', paddingRight: 3 },
  greeting: { fontSize: 14, fontFamily: 'Satoshi-Medium', lineHeight: 19 },
  name: { fontSize: 27, fontFamily: 'Satoshi-Black', lineHeight: 31, letterSpacing: -0.65, flexShrink: 1 },
  headerButton: {
    width: 44, height: 44, borderRadius: 15, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notificationDot: {
    position: 'absolute', top: 8, right: 8, width: 8, height: 8,
    borderRadius: 4, backgroundColor: '#FF5C72', borderWidth: 1, borderColor: '#100A28',
  },
  avatarRing: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  shortcutRow: { flexDirection: 'row', gap: 7 },
  shortcut: {
    flex: 1, minWidth: 0, minHeight: 91, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 2, paddingVertical: 9,
  },
  shortcutIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 11, lineHeight: 15, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  createCard: {
    minHeight: 205, borderWidth: 1, borderRadius: 23, padding: 18, overflow: 'hidden',
  },
  createCopy: { flex: 1, justifyContent: 'center', paddingBottom: 15 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontFamily: 'Satoshi-Bold', letterSpacing: 1.3, marginBottom: 6 },
  createTitle: { fontSize: 25, lineHeight: 30, fontFamily: 'Satoshi-Black', letterSpacing: -0.55 },
  createDescription: { fontSize: 13, lineHeight: 18, fontFamily: 'Satoshi-Medium', marginTop: 5 },
  storyActionButton: {
    minHeight: 50, borderRadius: 15, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  storyActionText: { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Bold' },
  characterCard: {
    minHeight: 246, borderRadius: 23, borderWidth: 1, overflow: 'hidden',
  },
  characterImage: { position: 'absolute', right: 0, bottom: 0, width: '40%', height: '100%' },
  characterCopy: {
    width: '60%', minHeight: 246, paddingLeft: 17, paddingRight: 2, paddingVertical: 17,
    alignItems: 'flex-start', justifyContent: 'center',
  },
  characterIcon: {
    width: 33, height: 33, borderRadius: 11, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  characterTitle: { fontSize: 19, lineHeight: 23, fontFamily: 'Satoshi-Black', letterSpacing: -0.35 },
  characterDescription: { fontSize: 12, lineHeight: 17, fontFamily: 'Satoshi-Medium', marginTop: 7 },
  characterArrow: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center',
    justifyContent: 'center', marginTop: 13,
  },
  friendsSection: { gap: 10, marginTop: 5 },
  friendsHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  friendsTitleBlock: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 },
  friendsTitle: { fontSize: 16, lineHeight: 21, fontFamily: 'Satoshi-Black', letterSpacing: -0.35, flexShrink: 1 },
  friendCount: {
    minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 5, flexShrink: 0,
  },
  friendCountText: { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  seeAll: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 4, paddingLeft: 6, flexShrink: 0,
  },
  seeAllText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  friendCards: { flexDirection: 'row', gap: 10, paddingRight: 16 },
  friendCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', justifyContent: 'flex-end' },
  friendCardCopy: { paddingHorizontal: 10, paddingBottom: 11, paddingTop: 36 },
  friendCardTitle: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontFamily: 'Satoshi-Bold' },
  friendAuthor: { color: 'rgba(255,255,255,0.78)', fontSize: 10, lineHeight: 13, fontFamily: 'Satoshi-Medium', marginTop: 3 },
  friendLikes: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  friendLikesText: { color: '#FFFFFF', fontSize: 10, fontFamily: 'Satoshi-Medium' },
  emptyFriends: {
    minHeight: 86, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  emptyFriendsIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyFriendsCopy: { flex: 1, minWidth: 0 },
  emptyFriendsTitle: { fontSize: 13, fontFamily: 'Satoshi-Bold', marginBottom: 3 },
  emptyFriendsText: { fontSize: 11, lineHeight: 15, fontFamily: 'Satoshi-Medium' },
});
