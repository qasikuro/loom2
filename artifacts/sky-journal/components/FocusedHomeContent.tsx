import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { resolveUri } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { DiscoverPost, Story } from '@/context/mappers';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
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
  latestStory: Story | null;
  friendStories: DiscoverPost[];
  friendCount: number;
};

const SHORTCUTS = [
  { label: 'Lumi', icon: 'star', route: '/(tabs)/drift' },
  { label: 'Chats', icon: 'message-circle', route: '/messages' },
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
  latestStory,
  friendStories,
  friendCount,
}: FocusedHomeContentProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const storyImageUri = latestStory?.thumbnailUri || latestStory?.panels[0]?.imageUri;
  const storyImage = storyImageUri
    ? { uri: resolveUri(storyImageUri) ?? storyImageUri }
    : Images.create_chapter;
  const friendCardWidth = Math.max(88, Math.min(116, (screenWidth - 58) / 3.5));

  function openRoute(path: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path as never);
  }

  return (
    <View style={s.content}>
      <View style={s.header}>
        <View style={s.greetingBlock}>
          <Text style={[s.greeting, { color: colors.mutedForeground }]}>{greeting},</Text>
          <Text style={[s.name, { color: accent }]} numberOfLines={1}>{characterName}</Text>
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

      <View style={[s.createCard, { borderColor: `${accent}65` }]}>
        <Image source={latestStory ? storyImage : Images.create_chapter} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={latestStory
            ? [`${colors.background}38`, `${colors.background}9A`, `${colors.background}F2`]
            : [`${colors.background}E8`, `${accent}35`, `${colors.background}F2`]}
          locations={latestStory ? [0, 0.48, 1] : [0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {!latestStory && <View style={[s.createGlow, { backgroundColor: `${accent}28` }]} />}
        <Text style={[s.eyebrow, { color: accent }]}>
          {latestStory ? 'YOUR STORY' : 'MAKE SOMETHING YOURS'}
        </Text>
        <Text style={[s.createTitle, { color: colors.foreground }]}>
          {latestStory ? 'Continue your story' : 'Create a story'}
        </Text>
        <Text style={[s.createDescription, { color: colors.mutedForeground }]}>
          {latestStory
            ? `${latestStory.chapterTitle || t('feature.home.untitled')} · ${latestStory.panels.length} ${latestStory.panels.length === 1 ? 'panel' : 'panels'}`
            : 'Start with manga or write every word yourself.'}
        </Text>
        {latestStory && (
          <TouchableOpacity
            testID="home-continue-story"
            accessibilityRole="button"
            accessibilityLabel={`Continue your story, ${latestStory.chapterTitle || 'Untitled story'}`}
            style={[s.modeButton, s.continueStoryButton, { backgroundColor: colors.primary }]}
            onPress={() => openRoute(`/story/${latestStory.id}`)}
            activeOpacity={0.84}
          >
            <Icon name="book-open" size={17} color="#FFFFFF" />
            <Text style={s.modeButtonText}>Continue</Text>
            <Icon name="arrow-right" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        {latestStory && (
          <Text style={[s.createSecondaryLabel, { color: colors.mutedForeground }]}>
            OR CREATE A NEW STORY
          </Text>
        )}
        <View style={s.modeRow}>
          <TouchableOpacity
            testID="home-create-manga"
            accessibilityRole="button"
            accessibilityLabel={latestStory ? 'Create another story with Manga' : 'Create a story with Manga'}
            style={[s.modeButton, { backgroundColor: colors.primary }]}
            onPress={() => openRoute('/quick-moment')}
            activeOpacity={0.84}
          >
            <Icon name="image" size={17} color="#FFFFFF" />
            <Text style={s.modeButtonText}>{latestStory ? 'New Manga' : 'Create with Manga'}</Text>
            <Icon name="arrow-right" size={15} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            testID="home-write-manually"
            accessibilityRole="button"
            accessibilityLabel="Write a story manually"
            style={[s.modeButton, s.manualButton, { borderColor: `${accent}55` }]}
            onPress={() => openRoute('/chapter-editor')}
            activeOpacity={0.84}
          >
            <Icon name="edit-2" size={17} color={accent} />
            <Text style={[s.modeButtonText, { color: colors.foreground }]}>Write manually</Text>
            <Icon name="arrow-right" size={15} color={accent} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        testID="home-character-profile"
        accessibilityRole="button"
        accessibilityLabel="Give your character a story and create an outfit on your profile"
        style={[s.characterCard, { borderColor: `${accent}65` }]}
        onPress={() => openRoute('/(tabs)/profile')}
        activeOpacity={0.86}
      >
        <LinearGradient
          colors={[`${accent}32`, `${colors.background}EF`, `${colors.background}B0`]}
          start={{ x: 0.9, y: 0.2 }}
          end={{ x: 0.05, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
        <Image
          source={characterImage}
          style={s.characterImage}
          contentFit="contain"
          contentPosition="right center"
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
          <View style={[s.characterArrow, { backgroundColor: colors.foreground }]}>
            <Icon name="arrow-right" size={20} color={colors.background} />
          </View>
        </View>
      </TouchableOpacity>

      <View style={s.friendsSection}>
        <View style={s.friendsHeader}>
          <View style={s.friendsTitleBlock}>
            <Icon name="users" size={20} color={accent} />
            <Text style={[s.friendsTitle, { color: colors.foreground }]}>Friends’ creations</Text>
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
                      height: friendCardWidth * 1.24,
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
  content: { gap: 14, paddingBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 58 },
  greetingBlock: { flex: 1, minWidth: 0, justifyContent: 'center' },
  greeting: { fontSize: 15, fontFamily: 'Satoshi-Medium', lineHeight: 20 },
  name: { fontSize: 29, fontFamily: 'Satoshi-Black', lineHeight: 33, letterSpacing: -0.5 },
  headerButton: {
    width: 40, height: 40, borderRadius: 15, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute', top: 7, right: 7, width: 8, height: 8,
    borderRadius: 4, backgroundColor: '#FF5C72', borderWidth: 1, borderColor: '#100A28',
  },
  avatarRing: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  shortcutRow: { flexDirection: 'row', gap: 8 },
  shortcut: {
    flex: 1, minWidth: 0, minHeight: 82, borderRadius: 17, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 3, paddingVertical: 8,
  },
  shortcutIcon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 10, lineHeight: 13, fontFamily: 'Satoshi-Medium' },
  createCard: {
    borderWidth: 1, borderRadius: 22, padding: 15, overflow: 'hidden',
    backgroundColor: 'rgba(20,12,45,0.94)',
  },
  createGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -92, top: -90 },
  eyebrow: { fontSize: 9, lineHeight: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4, marginBottom: 4 },
  createTitle: { fontSize: 24, lineHeight: 29, fontFamily: 'Satoshi-Black', letterSpacing: -0.4 },
  createDescription: { fontSize: 12, lineHeight: 17, fontFamily: 'Satoshi-Regular', marginTop: 2, marginBottom: 13 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeButton: {
    flex: 1, minHeight: 50, borderRadius: 15, paddingHorizontal: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  manualButton: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1 },
  modeButtonText: { flex: 1, fontSize: 11.5, fontFamily: 'Satoshi-Bold', color: '#FFFFFF' },
  storyCard: {
    minHeight: 154, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(205,185,255,0.28)',
    overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: 'rgba(21,14,44,0.95)',
  },
  storyCopy: { paddingHorizontal: 15, paddingBottom: 14, paddingTop: 62, alignItems: 'flex-start' },
  storyEyebrow: { color: 'rgba(255,255,255,0.76)', fontSize: 9, lineHeight: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 1.1, marginBottom: 3 },
  storyTitle: { maxWidth: '82%', color: '#FFFFFF', fontSize: 20, lineHeight: 24, fontFamily: 'Satoshi-Black' },
  storyMeta: { marginTop: 2, marginBottom: 10, color: 'rgba(255,255,255,0.78)', fontSize: 11, lineHeight: 15, fontFamily: 'Satoshi-Medium' },
  continueButton: {
    minHeight: 37, paddingHorizontal: 15, borderRadius: 13,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  continueButtonText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Satoshi-Bold' },
  moreIndicator: {
    position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,6,24,0.52)',
  },
  characterCard: {
    minHeight: 158, borderRadius: 22, borderWidth: 1, overflow: 'hidden',
    backgroundColor: 'rgba(23,14,47,0.95)',
  },
  characterImage: { position: 'absolute', right: 0, bottom: -8, width: '52%', height: '108%' },
  characterCopy: { width: '72%', minHeight: 158, padding: 14, alignItems: 'flex-start', justifyContent: 'center' },
  characterIcon: {
    width: 34, height: 34, borderRadius: 11, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  characterTitle: { fontSize: 19, lineHeight: 23, fontFamily: 'Satoshi-Black', letterSpacing: -0.25 },
  characterDescription: { maxWidth: 224, fontSize: 11.5, lineHeight: 16, fontFamily: 'Satoshi-Regular', marginTop: 5 },
  characterArrow: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center',
    justifyContent: 'center', marginTop: 10,
  },
  friendsSection: { gap: 11, marginTop: 1 },
  friendsHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  friendsTitleBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  friendsTitle: { fontSize: 17, lineHeight: 22, fontFamily: 'Satoshi-Black', letterSpacing: -0.25 },
  friendCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  friendCountText: { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingLeft: 5 },
  seeAllText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  friendCards: { flexDirection: 'row', gap: 8 },
  friendCard: { borderRadius: 17, borderWidth: 1, overflow: 'hidden', justifyContent: 'flex-end' },
  friendCardCopy: { paddingHorizontal: 8, paddingBottom: 9, paddingTop: 34 },
  friendCardTitle: { color: '#FFFFFF', fontSize: 10.5, lineHeight: 13, fontFamily: 'Satoshi-Bold' },
  friendAuthor: { color: 'rgba(255,255,255,0.72)', fontSize: 9, lineHeight: 12, fontFamily: 'Satoshi-Medium', marginTop: 2 },
  friendLikes: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  friendLikesText: { color: '#FFFFFF', fontSize: 9, fontFamily: 'Satoshi-Medium' },
  emptyFriends: {
    minHeight: 76, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', gap: 11,
  },
  emptyFriendsIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyFriendsCopy: { flex: 1, minWidth: 0 },
  emptyFriendsTitle: { fontSize: 12, fontFamily: 'Satoshi-Bold', marginBottom: 2 },
  emptyFriendsText: { fontSize: 10.5, lineHeight: 14, fontFamily: 'Satoshi-Regular' },
});