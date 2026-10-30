import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { FriendAvatar } from '@/components/FriendAvatar';
import { Icon, type IconName } from '@/components/Icon';
import type {
  FriendSummary,
  Reward,
  ServerNotification,
} from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

type UnreadMessageThread = {
  partnerId: string;
  partnerName: string;
  partnerHandle: string | null;
  lastAt: string;
};

type UnreadCampfireRoom = {
  id: string;
  name: string;
  mood: string;
  lastAt: string;
};

type ActivitySummary = {
  title: string;
  createdAt: string;
  actorId?: string;
  actorName?: string;
};

interface NotificationsExperienceProps {
  visible: boolean;
  accent: string;
  serverNotifications: ServerNotification[];
  unreadDmThreads: UnreadMessageThread[];
  unreadCampfireRooms: UnreadCampfireRoom[];
  rewards: Reward[];
  friends: FriendSummary[];
  onClose: () => void;
  onVisible: () => void;
  onOpenNotification: (notification: ServerNotification) => void;
  onOpenMessage: (thread: UnreadMessageThread) => void;
  onOpenCampfire: (room: UnreadCampfireRoom) => void;
  onDeleteNotification: (id: string) => void;
  onDismissReward: (id: string) => void;
}

const MEMORY_ART = require('../../assets/images/notification-memory.jpg');

function notificationIcon(type: ServerNotification['type']): IconName {
  switch (type) {
    case 'guide_session_rescheduled':
    case 'guide_session_cancelled':
      return 'calendar';
    case 'witness':
      return 'eye';
    case 'save':
      return 'bookmark';
    case 'new_story':
    case 'new_chapter':
      return 'book-open';
    case 'resonate':
      return 'heart';
    case 'follow':
      return 'user-plus';
    case 'message':
      return 'message-circle';
    case 'new_outfit':
      return 'image';
    case 'badge_granted':
    case 'badge_removed':
    default:
      return 'sparkles';
  }
}

function activityDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  }

  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function ActivityRow({
  title,
  subtitle,
  timestamp,
  icon,
  accent,
  colors,
  avatarName,
  avatarUri,
  glyph,
  unread = false,
  dismissLabel,
  onPress,
  onDismiss,
}: {
  title: string;
  subtitle: string;
  timestamp?: string;
  icon: IconName;
  accent: string;
  colors: ReturnType<typeof useColors>;
  avatarName?: string;
  avatarUri?: string | null;
  glyph?: string | null;
  unread?: boolean;
  dismissLabel?: string;
  onPress?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <View
      style={[
        styles.activityRow,
        {
          backgroundColor: unread ? `${accent}12` : colors.card,
          borderColor: unread ? `${accent}35` : colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={title}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.activityMain,
          pressed && styles.pressed,
        ]}
      >
        {avatarName ? (
          <FriendAvatar
            name={avatarName}
            uri={avatarUri}
            size={42}
            borderColor={unread ? accent : colors.border}
            initialColor={colors.foreground}
          />
        ) : (
          <View
            style={[
              styles.activityIcon,
              { backgroundColor: `${accent}20` },
            ]}
          >
            {glyph ? (
              <Text style={[styles.activityGlyph, { color: accent }]}>{glyph}</Text>
            ) : (
              <Icon name={icon} size={19} color={accent} />
            )}
          </View>
        )}
        <View style={styles.activityCopy}>
          <Text
            style={[styles.activityTitle, { color: colors.foreground }]}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text
            style={[styles.activitySubtitle, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
        <View style={styles.activityMeta}>
          {timestamp ? (
            <Text style={[styles.activityTime, { color: colors.mutedForeground }]}>
              {timestamp}
            </Text>
          ) : null}
          {unread ? (
            <View style={[styles.unreadDot, { backgroundColor: accent }]} />
          ) : null}
        </View>
        {onPress ? <Icon name="chevron-right" size={17} color={colors.mutedForeground} /> : null}
      </Pressable>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          hitSlop={8}
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.dismissButton,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="x" size={15} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function NotificationsExperience({
  visible,
  accent,
  serverNotifications,
  unreadDmThreads,
  unreadCampfireRooms,
  rewards,
  friends,
  onClose,
  onVisible,
  onOpenNotification,
  onOpenMessage,
  onOpenCampfire,
  onDeleteNotification,
  onDismissReward,
}: NotificationsExperienceProps) {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const friendsById = useMemo(
    () => new Map(friends.map(friend => [friend.userId, friend])),
    [friends],
  );
  const orderedNotifications = useMemo(
    () => [...serverNotifications].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
    [serverNotifications],
  );
  const activitySummaries = useMemo<ActivitySummary[]>(() => [
    ...orderedNotifications.map(notification => ({
      title: notification.title,
      createdAt: notification.createdAt,
      actorId: notification.actorId,
      actorName: notification.actorName,
    })),
    ...unreadDmThreads.map(thread => ({
      title: t('feature.home.messageFrom', { name: thread.partnerName }),
      createdAt: thread.lastAt,
      actorId: thread.partnerId,
      actorName: thread.partnerName,
    })),
    ...unreadCampfireRooms.map(room => ({
      title: t('feature.home.newWhisper', { name: room.name }),
      createdAt: room.lastAt,
    })),
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [
    orderedNotifications,
    unreadDmThreads,
    unreadCampfireRooms,
    t,
  ]);

  const totalCount =
    serverNotifications.length +
    unreadDmThreads.length +
    unreadCampfireRooms.length +
    rewards.length;
  const latestActivity = activitySummaries[0];
  const heroTitle = latestActivity?.title ?? t('feature.home.allCaughtUp');
  const displayActors = activitySummaries
    .filter((activity): activity is ActivitySummary & { actorId: string; actorName: string } =>
      !!activity.actorId && !!activity.actorName,
    )
    .filter((activity, index, list) =>
      list.findIndex(candidate => candidate.actorId === activity.actorId) === index,
    )
    .slice(0, 3);
  const hasContent =
    serverNotifications.length > 0 ||
    unreadDmThreads.length > 0 ||
    unreadCampfireRooms.length > 0 ||
    rewards.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={onVisible}
    >
      <View
        style={[
          styles.screen,
          {
            paddingTop: topInset,
            paddingBottom: bottomInset,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          <View style={styles.topBar}>
            <View style={styles.topBarTitle}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {t('feature.home.notifications')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {t('feature.notificationCenter.activityCount', { count: totalCount })}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('feature.notificationCenter.close')}
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { borderColor: colors.border, backgroundColor: colors.card },
                pressed && styles.pressed,
              ]}
            >
              <Icon name="x" size={19} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={[styles.hero, { borderColor: colors.border }]}>
              <Image
                source={MEMORY_ART}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={180}
                cachePolicy="memory-disk"
                accessibilityLabel={t('feature.notificationCenter.eyebrow')}
              />
              <LinearGradient
                colors={[colors.overlay, colors.night]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.45, y: 1 }}
                style={styles.heroGradient}
              >
                <View style={styles.heroTop}>
                  <View
                    style={[
                      styles.heroMark,
                      { borderColor: `${colors.primaryForeground}35` },
                    ]}
                  >
                    <Icon name="sparkles" size={16} color={colors.accent} />
                  </View>
                  <Text style={[styles.heroEyebrow, { color: colors.primaryForeground }]}>
                    {t('feature.notificationCenter.eyebrow')}
                  </Text>
                </View>
                <Text
                  style={[styles.heroTitle, { color: colors.primaryForeground }]}
                  numberOfLines={2}
                >
                  {heroTitle}
                </Text>
                <View style={styles.heroBottom}>
                  <Text style={[styles.heroCount, { color: colors.primaryForeground }]}>
                    {t('feature.notificationCenter.activityCount', { count: totalCount })}
                  </Text>
                  <View style={styles.heroAvatars}>
                    {displayActors.map(activity => {
                      const friend = friendsById.get(activity.actorId);
                      return (
                        <FriendAvatar
                          key={activity.actorId}
                          name={activity.actorName}
                          uri={friend?.avatarUri}
                          size={31}
                          borderColor={colors.night}
                          initialColor={colors.primaryForeground}
                        />
                      );
                    })}
                  </View>
                </View>
              </LinearGradient>
            </View>

            {!hasContent ? (
              <View style={[styles.emptyState, { borderColor: colors.border }]}>
                <View style={[styles.emptyIcon, { backgroundColor: `${accent}18` }]}>
                  <Icon name="bell-off" size={23} color={accent} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {t('feature.home.allCaughtUp')}
                </Text>
                <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                  {t('feature.notificationCenter.emptyHint')}
                </Text>
              </View>
            ) : (
              <>
                {unreadDmThreads.length > 0 ? (
                  <ActivitySection
                    title={t('feature.notificationCenter.messages')}
                    count={unreadDmThreads.length}
                    accent={accent}
                    colors={colors}
                  >
                    {unreadDmThreads.map(thread => (
                      <ActivityRow
                        key={thread.partnerId}
                        title={t('feature.home.messageFrom', { name: thread.partnerName })}
                        subtitle={thread.partnerHandle ? `@${thread.partnerHandle}` : t('feature.home.tapRead')}
                        timestamp={activityDate(thread.lastAt, i18n.language)}
                        icon="message-circle"
                        avatarName={thread.partnerName}
                        avatarUri={friendsById.get(thread.partnerId)?.avatarUri}
                        accent={accent}
                        colors={colors}
                        unread
                        onPress={() => onOpenMessage(thread)}
                      />
                    ))}
                  </ActivitySection>
                ) : null}

                {unreadCampfireRooms.length > 0 ? (
                  <ActivitySection
                    title={t('feature.notificationCenter.campfire')}
                    count={unreadCampfireRooms.length}
                    accent={accent}
                    colors={colors}
                  >
                    {unreadCampfireRooms.map(room => (
                      <ActivityRow
                        key={room.id}
                        title={t('feature.home.newWhisper', { name: room.name })}
                        subtitle={t('feature.home.joinFire')}
                        timestamp={activityDate(room.lastAt, i18n.language)}
                        icon="message-circle"
                        accent={accent}
                        colors={colors}
                        unread
                        onPress={() => onOpenCampfire(room)}
                      />
                    ))}
                  </ActivitySection>
                ) : null}

                {orderedNotifications.length > 0 ? (
                  <ActivitySection
                    title={t('feature.notificationCenter.storyActivity')}
                    count={orderedNotifications.length}
                    accent={accent}
                    colors={colors}
                  >
                    {orderedNotifications.map(notification => {
                      const actor = friendsById.get(notification.actorId);
                      return (
                        <ActivityRow
                          key={notification.id}
                          title={notification.title}
                          subtitle={notification.actorName}
                          timestamp={activityDate(notification.createdAt, i18n.language)}
                          icon={notificationIcon(notification.type)}
                          avatarName={notification.actorName}
                          avatarUri={actor?.avatarUri}
                          accent={accent}
                          colors={colors}
                          unread={!notification.isRead}
                          dismissLabel={t('feature.notificationCenter.dismiss')}
                          onPress={() => onOpenNotification(notification)}
                          onDismiss={() => onDeleteNotification(notification.id)}
                        />
                      );
                    })}
                  </ActivitySection>
                ) : null}

                {rewards.length > 0 ? (
                  <ActivitySection
                    title={t('feature.notificationCenter.rewards')}
                    count={rewards.length}
                    accent={accent}
                    colors={colors}
                  >
                    {rewards.map(reward => (
                      <ActivityRow
                        key={reward.id}
                        title={reward.message}
                        subtitle={reward.subMessage ?? t('feature.notificationCenter.eyebrow')}
                        icon="sparkles"
                        glyph={reward.icon}
                        accent={accent}
                        colors={colors}
                        dismissLabel={t('feature.notificationCenter.dismiss')}
                        onDismiss={() => onDismissReward(reward.id)}
                      />
                    ))}
                  </ActivitySection>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ActivitySection({
  title,
  count,
  accent,
  colors,
  children,
}: {
  title: string;
  count: number;
  accent: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        <View style={[styles.sectionCount, { backgroundColor: `${accent}20` }]}>
          <Text style={[styles.sectionCountText, { color: accent }]}>{count}</Text>
        </View>
      </View>
      <View style={styles.sectionRows}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' },
  topBar: {
    minHeight: 76,
    paddingHorizontal: 21,
    paddingTop: 8,
    paddingBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  topBarTitle: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 24, letterSpacing: -0.5 },
  subtitle: { marginTop: 3, fontFamily: 'Satoshi-Regular', fontSize: 12 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: 19, paddingTop: 4, paddingBottom: 24, gap: 23 },
  hero: {
    height: 190,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroGradient: { flex: 1, justifyContent: 'space-between', padding: 17 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroMark: {
    width: 29,
    height: 29,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroEyebrow: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    maxWidth: 300,
    fontFamily: 'Satoshi-Bold',
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.35,
  },
  heroBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroCount: { fontFamily: 'Satoshi-Medium', fontSize: 11 },
  heroAvatars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  sectionTitle: { fontFamily: 'Satoshi-Bold', fontSize: 15, letterSpacing: -0.15 },
  sectionCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { fontFamily: 'Satoshi-Bold', fontSize: 10 },
  sectionRows: { gap: 8 },
  activityRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 7,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  activityMain: { flex: 1, minWidth: 0, minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  activityGlyph: { fontSize: 19, lineHeight: 23 },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { fontFamily: 'Satoshi-Bold', fontSize: 12.5, lineHeight: 17 },
  activitySubtitle: { marginTop: 3, fontFamily: 'Satoshi-Regular', fontSize: 10.5 },
  activityMeta: { alignItems: 'flex-end', justifyContent: 'center', gap: 6, paddingHorizontal: 5 },
  activityTime: { fontFamily: 'Satoshi-Regular', fontSize: 9 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  dismissButton: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  emptyState: {
    minHeight: 220,
    paddingHorizontal: 28,
    paddingVertical: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: { width: 54, height: 54, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  emptyTitle: { fontFamily: 'Satoshi-Bold', fontSize: 17, textAlign: 'center' },
  emptyHint: { maxWidth: 250, marginTop: 7, fontFamily: 'Satoshi-Regular', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  pressed: { opacity: 0.76 },
});
