import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { useAuth } from '@clerk/expo';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');

interface GuideAvailability {
  days:     number[];
  timeFrom: string;
  timeTo:   string;
}

interface GuideProfile {
  userId:            string;
  name:              string;
  username:          string | null;
  bio:               string;
  guideBio:          string;
  guideTopics:       string[];
  guideAvailability: GuideAvailability | null;
  peaceRating:       number;
  dreamersGuided:    number;
  followerCount:     number;
  avatarUri:         string | null;
  mood:              string;
  traits:            string[];
  role:              string | null;
  country:           string | null;
  isFollowing:       boolean;
  isAvailableNow:    boolean;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TOPIC_COLORS: Record<string, string> = {
  'Anxiety & Stress': '#E87898',
  'Motivation':       '#E8A850',
  'Self Growth':      '#68C890',
  'Relationships':    '#D878B0',
  'Loneliness':       '#7890C8',
  'Creativity':       '#B878E8',
  'Spirituality':     '#C8A84B',
  'Mental Health':    '#78B8D8',
  'Dreams & Goals':   '#9878D8',
  'Grief':            '#8890A8',
  'Social Skills':    '#78C8A8',
  'Mindfulness':      '#68B8B0',
};

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < full || (half && i === full);
        return (
          <Text key={i} style={{ fontSize: 18, color: filled ? '#C8A84B' : 'rgba(200,168,75,0.25)', lineHeight: 22 }}>
            {filled ? '★' : '☆'}
          </Text>
        );
      })}
      <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#C8A84B', marginLeft: 6 }}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}

export default function GuideProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const colors     = useColors();
  const insets     = useSafeAreaInsets();
  const { userId: myUserId } = useAuth();
  const { followingIds, followUser, unfollowUser } = useApp();
  const isOwnProfile = !!myUserId && myUserId === userId;

  const [guide,   setGuide]   = useState<GuideProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(28)).current;

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 80 : insets.bottom + 110;

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiFetch<GuideProfile>(`/guides/${userId}`)
      .then(g => {
        setGuide(g);
        setIsFollowing(followingIds.includes(g.userId) || g.isFollowing);
        Animated.parallel([
          Animated.timing(fadeIn,  { toValue: 1, duration: 440, useNativeDriver: true }),
          Animated.timing(slideUp, { toValue: 0, duration: 440, useNativeDriver: true }),
        ]).start();
      })
      .catch(() => setError('Could not load guide'))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleFollow = useCallback(() => {
    if (!guide) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFollowing(prev => {
      const next = !prev;
      if (next) followUser(guide.userId);
      else unfollowUser(guide.userId);
      return next;
    });
  }, [guide, followUser, unfollowUser]);

  const handleMessage = useCallback(() => {
    if (!guide) return;
    router.push({ pathname: '/messages/[userId]', params: { userId: guide.userId, name: guide.name } } as any);
  }, [guide]);

  if (loading) {
    return (
      <View style={[styles.loadWrap, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <BackButton />
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (error || !guide) {
    return (
      <View style={[styles.loadWrap, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <BackButton />
        <Text style={{ color: colors.mutedForeground, marginTop: 80, fontFamily: 'Satoshi-Regular', textAlign: 'center' }}>
          {error ?? 'Guide not found'}
        </Text>
      </View>
    );
  }

  const avail = guide.guideAvailability;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Hero header ────────────────────────────────────────── */}
      <LinearGradient
        colors={['#0B0820', '#130B34', '#1E1050']}
        style={[styles.hero, { paddingTop: topPad }]}
      >
        {/* Nebula blobs */}
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(120,70,255,0.18)', top: -60, right: -30, pointerEvents: 'none' }} />
        <View style={{ position: 'absolute', width: 130, height: 130, borderRadius: 65,  backgroundColor: 'rgba(60,140,240,0.12)', bottom: 10, left: -20, pointerEvents: 'none' }} />

        {/* Back button */}
        <View style={[styles.heroBackRow, { marginTop: 8 }]}>
          <BackButton color="rgba(210,200,255,0.8)" />
        </View>

        {/* Avatar + name */}
        <View style={styles.heroCenter}>
          <View style={styles.avatarWrap}>
            {guide.avatarUri ? (
              <Image source={{ uri: guide.avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <LinearGradient
                colors={['rgba(120,70,255,0.55)', 'rgba(60,140,240,0.40)']}
                style={StyleSheet.absoluteFill}
              />
            )}
            {!guide.avatarUri && (
              <Text style={styles.avatarInitial}>{guide.name.charAt(0).toUpperCase()}</Text>
            )}
            {/* Availability dot */}
            <View style={[
              styles.availDot,
              { backgroundColor: guide.isAvailableNow ? '#60D890' : 'rgba(150,150,170,0.6)' },
            ]} />
          </View>

          <Text style={styles.heroName}>{guide.name}</Text>
          {guide.username && (
            <Text style={styles.heroHandle}>@{guide.username}</Text>
          )}

          {/* Compact meta strip — availability · mood · role · country */}
          <View style={styles.heroMetaStrip}>
            <View style={[styles.availDotSmall, { backgroundColor: guide.isAvailableNow ? '#60D890' : '#909098' }]} />
            <Text style={styles.heroMetaStripText}>
              {guide.isAvailableNow ? 'Available' : 'Offline'}
              {guide.mood   ? `  ·  ${guide.mood}`    : ''}
              {guide.role    ? `  ·  ${guide.role}`    : ''}
              {guide.country ? `  ·  ${guide.country}` : ''}
            </Text>
          </View>

        </View>
      </LinearGradient>

      {/* ── Stats row ────────────────────────────────────────── */}
      <Animated.View style={[styles.statsRow, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        {[
          { value: guide.followerCount,        label: 'Followers' },
          { value: guide.guideTopics.length,   label: 'Topics'    },
          { value: avail ? avail.days.length : 0, label: 'Days/wk' },
        ].map((s, i) => (
          <View key={i} style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </Animated.View>

      {/* ── Scrollable content ───────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>

          {/* ── Guide bio ──────────────────────────────────── */}
          {!!guide.guideBio && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: 'rgba(120,70,255,0.14)' }]}>
                  <Icon name="message-circle" size={14} color="#9878D8" />
                </View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>About this Guide</Text>
              </View>
              <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>{guide.guideBio}</Text>
            </View>
          )}

          {/* ── Topics ────────────────────────────────────── */}
          {guide.guideTopics.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: 'rgba(200,168,75,0.14)' }]}>
                  <Icon name="tag" size={14} color="#C8A84B" />
                </View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Topics</Text>
              </View>
              <View style={styles.topicWrap}>
                {guide.guideTopics.map(topic => {
                  const col = TOPIC_COLORS[topic] ?? colors.primary;
                  return (
                    <View key={topic} style={[styles.topicChip, { backgroundColor: `${col}18`, borderColor: `${col}35` }]}>
                      <Text style={[styles.topicText, { color: col }]}>{topic}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Availability ──────────────────────────────── */}
          {avail && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: 'rgba(80,200,130,0.14)' }]}>
                  <Icon name="clock" size={14} color="#60D890" />
                </View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Weekly Availability</Text>
              </View>
              <View style={styles.dayRow}>
                {DAY_LABELS.map((d, i) => (
                  <View
                    key={d}
                    style={[
                      styles.dayPill,
                      avail.days.includes(i)
                        ? { backgroundColor: 'rgba(80,200,130,0.18)', borderColor: 'rgba(80,200,130,0.45)' }
                        : { backgroundColor: 'transparent', borderColor: colors.border },
                    ]}
                  >
                    <Text style={[
                      styles.dayLabel,
                      { color: avail.days.includes(i) ? '#70E8A0' : colors.mutedForeground },
                    ]}>{d}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
                {avail.timeFrom} – {avail.timeTo}
              </Text>
            </View>
          )}

          {/* ── Personal bio ──────────────────────────────── */}
          {!!guide.bio && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}14` }]}>
                  <Icon name="user" size={14} color={colors.primary} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>About</Text>
              </View>
              <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>{guide.bio}</Text>
            </View>
          )}

          {/* ── Traits ────────────────────────────────────── */}
          {guide.traits.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: 'rgba(200,168,75,0.14)' }]}>
                  <Icon name="heart" size={14} color="#C8A84B" />
                </View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Traits</Text>
              </View>
              <View style={styles.topicWrap}>
                {guide.traits.map(trait => (
                  <View key={trait} style={[styles.traitChip, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}28` }]}>
                    <Text style={[styles.traitText, { color: colors.foreground }]}>{trait}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── CTA buttons ───────────────────────────────── */}
          <View style={styles.ctaRow}>
            {isOwnProfile ? (
              <>
                <TouchableOpacity
                  style={[styles.followBtn, { backgroundColor: colors.primary }, SHADOW.sm]}
                  onPress={() => router.push('/(tabs)/profile')}
                  activeOpacity={0.85}
                >
                  <Icon name="user" size={15} color="#fff" />
                  <Text style={styles.followBtnText}>My Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.messageBtn, SHADOW.sm]}
                  onPress={() => router.push('/(tabs)/profile')}
                  activeOpacity={0.85}
                >
                  <Icon name="edit-2" size={15} color="#9878D8" />
                  <Text style={[styles.messageBtnText, { color: '#9878D8' }]}>Edit Guide</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.followBtn,
                    isFollowing
                      ? { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}40` }
                      : { backgroundColor: colors.primary, borderColor: colors.primary },
                    SHADOW.sm,
                  ]}
                  onPress={handleFollow}
                  activeOpacity={0.85}
                >
                  <Icon name={isFollowing ? 'user-check' : 'user-plus'} size={15} color={isFollowing ? colors.primary : '#fff'} />
                  <Text style={[styles.followBtnText, { color: isFollowing ? colors.primary : '#fff' }]}>
                    {isFollowing ? 'Following' : 'Follow Guide'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.messageBtn, SHADOW.sm]}
                  onPress={handleMessage}
                  activeOpacity={0.85}
                >
                  <Icon name="message-circle" size={15} color="#9878D8" />
                  <Text style={[styles.messageBtnText, { color: '#9878D8' }]}>Message</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  loadWrap:{ flex: 1, paddingHorizontal: 20 },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  heroBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroCenter: { alignItems: 'center' },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    backgroundColor: 'rgba(120,70,255,0.25)',
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 38,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,210,255,0.9)',
  },
  availDot: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#0B0820',
  },
  heroName: {
    fontSize: 22,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,210,255,0.96)',
    marginBottom: 4,
  },
  heroHandle: {
    fontSize: 13,
    fontFamily: 'Satoshi-Medium',
    color: 'rgba(200,184,232,0.55)',
    marginBottom: 10,
  },
  availDotSmall: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },

  // Compact meta strip (availability · mood · role · country)
  heroMetaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(200,184,232,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,184,232,0.14)',
  },
  heroMetaStripText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
    color: 'rgba(210,200,255,0.65)',
    letterSpacing: 0.1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -1,
    marginBottom: 4,
    backgroundColor: 'rgba(200,184,232,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(200,184,232,0.10)',
    paddingVertical: 14,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontFamily: 'Satoshi-Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 2 },

  // Cards
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  cardBody:  { fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 21 },

  // Topics
  topicWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  topicText: { fontSize: 13, fontFamily: 'Satoshi-Medium' },

  // Availability
  dayRow:  { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  dayPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  dayLabel:  { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  timeText:  { fontSize: 12, fontFamily: 'Satoshi-Regular', marginTop: 4 },

  // CTA
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 20,
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 15,
    borderRadius: 18,
    borderWidth: 0,
  },
  followBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff' },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 15,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(152,120,216,0.55)',
    backgroundColor: 'rgba(120,70,255,0.12)',
  },
  messageBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },

  // Trait chips
  traitChip: {
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  traitText: { fontSize: 12, fontFamily: 'Satoshi-Medium' },
});
