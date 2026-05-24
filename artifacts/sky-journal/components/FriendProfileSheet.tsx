import { Icon } from '@/components/Icon';
import { MoodBadge } from '@/components/MoodBadge';
import { apiFetch, useApp, type ProfileLink } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
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

export interface FriendSummary {
  userId:    string;
  name:      string;
  username?: string | null;
  bio:       string;
  mood:      string;
  traits:    string[];
  avatarUri?: string | null;
  birthday?: string | null;
  country?:  string | null;
  links?:    ProfileLink[];
  isPublic:  boolean;
}

interface Props {
  friend:   FriendSummary | null;
  visible:  boolean;
  onClose:  () => void;
}

const MOOD_COLORS: Record<string, string> = {
  Hopeful:     '#6BA57A', Peaceful: '#5B9BB5', Lonely:   '#5D7BA5',
  Romantic:    '#B86098', Chaotic:  '#B85830', Dreamy:   '#9B7AB5',
  Soft:        '#7B6BAA', Adventurous: '#3A9060',
};

function getMoodColor(mood: string) {
  return MOOD_COLORS[mood] ?? '#6B5B95';
}

function fmtBirthday(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  } catch {
    return raw;
  }
}

export function FriendProfileSheet({ friend, visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { followingIds, followUser, unfollowUser } = useApp();

  const translateY = useRef(new Animated.Value(600)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  const [storyCount, setStoryCount]   = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  const isFollowing = friend ? followingIds.includes(friend.userId) : false;
  const initial     = friend ? friend.name.charAt(0).toUpperCase() : '?';
  const moodColor   = friend ? getMoodColor(friend.mood) : '#6B5B95';

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 58, friction: 12, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      ]).start();

      if (friend) {
        setStoryCount(null);
        setLoadingCount(true);
        apiFetch<any[]>(`/users/${friend.userId}/stories`)
          .then(rows => setStoryCount(rows.length))
          .catch(() => setStoryCount(null))
          .finally(() => setLoadingCount(false));
      }
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 600, duration: 260, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.timing(opacity,    { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, friend]);

  if (!friend) return null;

  const bottomPad = Platform.OS === 'web' ? 32 : insets.bottom + 20;
  const bdFmt     = fmtBirthday(friend.birthday);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: bottomPad, backgroundColor: colors.card, borderColor: colors.border },
          { transform: [{ translateY }] },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: `${colors.primary}30` }]} />

        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.muted }]}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="x" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 0 }}>
          {/* ── Hero banner ── */}
          <LinearGradient
            colors={[`${moodColor}30`, `${moodColor}10`, 'transparent']}
            style={styles.heroBanner}
          >
            {/* Avatar */}
            <View style={styles.avatarRing}>
              {friend.avatarUri ? (
                <Image
                  source={{ uri: friend.avatarUri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <LinearGradient
                  colors={[`${moodColor}60`, `${moodColor}25`]}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {!friend.avatarUri && (
                <Text style={[styles.avatarInitial, { color: moodColor }]}>{initial}</Text>
              )}
            </View>

            {/* Name + handle */}
            <View style={styles.heroText}>
              <Text style={[styles.friendName, { color: colors.foreground }]}>{friend.name}</Text>
              {friend.username ? (
                <Text style={[styles.friendHandle, { color: colors.mutedForeground }]}>@{friend.username}</Text>
              ) : null}
              <MoodBadge mood={friend.mood} size="sm" />
            </View>
          </LinearGradient>

          <View style={styles.body}>
            {/* Bio */}
            {!!friend.bio && (
              <Text style={[styles.bio, { color: colors.foreground }]}>{friend.bio}</Text>
            )}

            {/* Traits */}
            {friend.traits.length > 0 && (
              <View style={styles.traitsRow}>
                {friend.traits.map(trait => (
                  <View key={trait} style={[styles.traitChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}28` }]}>
                    <Text style={[styles.traitText, { color: colors.primary }]}>{trait}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Details grid */}
            {(bdFmt || friend.country) && (
              <View style={[styles.detailsCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                {bdFmt && (
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconWrap, { backgroundColor: `${colors.primary}15` }]}>
                      <Icon name="gift" size={13} color={colors.primary} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Birthday</Text>
                      <Text style={[styles.detailValue, { color: colors.foreground }]}>{bdFmt}</Text>
                    </View>
                  </View>
                )}
                {friend.country && (
                  <View style={[styles.detailRow, bdFmt && { borderTopWidth: 0.75, borderTopColor: colors.border, paddingTop: 10 }]}>
                    <View style={[styles.detailIconWrap, { backgroundColor: `${colors.primary}15` }]}>
                      <Icon name="map-pin" size={13} color={colors.primary} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Country</Text>
                      <Text style={[styles.detailValue, { color: colors.foreground }]}>{friend.country}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Links */}
            {(friend.links ?? []).length > 0 && (
              <View style={[styles.linksCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Links</Text>
                {(friend.links ?? []).map((link, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.linkRow,
                      i > 0 && { borderTopWidth: 0.75, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 },
                    ]}
                    onPress={() => Linking.openURL(link.url).catch(() => {})}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.detailIconWrap, { backgroundColor: `${colors.primary}15` }]}>
                      <Icon name="external-link" size={13} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailValue, { color: colors.foreground }]}>{link.label}</Text>
                      <Text style={[styles.linkUrl, { color: colors.mutedForeground }]} numberOfLines={1}>{link.url}</Text>
                    </View>
                    <Icon name="chevron-right" size={13} color={`${colors.primary}60`} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Icon name="layers" size={16} color={colors.primary} />
                <Text style={[styles.statNum, { color: colors.foreground }]}>
                  {loadingCount ? '—' : (storyCount ?? '—')}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Stories</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Icon name="globe" size={16} color={colors.primary} />
                <Text style={[styles.statNum, { color: colors.foreground }]}>
                  {friend.isPublic ? 'Public' : 'Private'}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Profile</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  isFollowing
                    ? { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}35` }
                    : { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => {
                  if (isFollowing) unfollowUser(friend.userId);
                  else followUser(friend.userId);
                }}
                activeOpacity={0.82}
              >
                <Icon
                  name={isFollowing ? 'user-check' : 'user-plus'}
                  size={14}
                  color={isFollowing ? colors.primary : '#fff'}
                />
                <Text style={[styles.followBtnText, { color: isFollowing ? colors.primary : '#fff' }]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>

              {friend.isPublic && (
                <TouchableOpacity
                  style={[styles.storiesBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  onPress={() => {
                    onClose();
                    router.push('/(tabs)/discover' as any);
                  }}
                  activeOpacity={0.82}
                >
                  <Icon name="book-open" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.storiesBtnText, { color: colors.mutedForeground }]}>See stories</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 14, right: 16,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },

  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  avatarRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: 'rgba(107,91,149,0.4)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: { fontSize: 28, fontFamily: 'Satoshi-Bold' },
  heroText:      { flex: 1, gap: 4 },
  friendName:    { fontSize: 20, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4 },
  friendHandle:  { fontSize: 13, fontFamily: 'Satoshi-Regular' },

  body: { paddingHorizontal: 20, paddingTop: 4, gap: 14 },

  bio: {
    fontSize: 14, fontFamily: 'Satoshi-Regular',
    lineHeight: 22, opacity: 0.88,
  },

  traitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  traitChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  traitText: { fontSize: 12, fontFamily: 'Satoshi-Medium' },

  detailsCard: {
    borderRadius: 14, borderWidth: 0.75,
    padding: 12, gap: 0,
  },
  detailRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  detailContent: { flex: 1 },
  detailLabel:   { fontSize: 10, fontFamily: 'Satoshi-Medium', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 1 },
  detailValue:   { fontSize: 14, fontFamily: 'Satoshi-Medium' },

  linksCard: {
    borderRadius: 14, borderWidth: 0.75,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 10, fontFamily: 'Satoshi-Bold',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8,
  },
  linkRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkUrl:  { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 1 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, borderRadius: 14, borderWidth: 0.75,
    paddingVertical: 12, alignItems: 'center', gap: 4,
  },
  statNum:   { fontSize: 17, fontFamily: 'Satoshi-Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Satoshi-Regular' },

  actionsRow: { flexDirection: 'row', gap: 10, paddingBottom: 8 },
  followBtn: {
    flex: 1, height: 46, borderRadius: 13, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  followBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  storiesBtn: {
    flex: 1, height: 46, borderRadius: 13, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  storiesBtnText: { fontSize: 14, fontFamily: 'Satoshi-Medium' },
});
