import { Icon } from '@/components/Icon';
import { StorigamActivityIndicator } from '@/components/SkyLoading';
import { BadgeTray, type BadgeItem } from '@/components/profile/BadgeTray';
import { ProfileBadges } from '@/components/profile/ProfileBadges';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { prepareNativeOutfitAudio } from '@/utils/prepareNativeOutfitAudio';
import { useTranslation } from 'react-i18next';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DiscoverVideoPlayerModal } from '@/components/DiscoverVideoPlayerModal';
import type { DiscoverPost, StoryMusic } from '@/context/mappers';
import { SecureImage as Image } from '@/components/SecureImage';
import {
  Alert,
  Animated,
  Easing,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@clerk/expo';
import { apiFetch, ApiError, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { SHADOW } from '@/constants/colors';
import { ReportSheet } from '@/components/ReportSheet';
import { WeatherWidget } from '@/components/WeatherWidget';
import { FrameRing } from '@/components/profile/CharacterAuraHeader';
import AuroraCloudBackdrop from '@/components/profile/AuroraCloudBackdrop';
import { ProfileEffect } from '@/components/ProfileEffect';
import FounderAuroraCardFrame from '@/components/profile/FounderAuroraCardFrame';
import { FounderProfileIntro } from '@/components/profile/FounderProfileIntro';
import { MoonlitMuseIntro } from '@/components/profile/MoonlitMuseIntro';
import { CosmicProfileArrivalOverlay } from '@/components/profile/CosmicProfileArrivalOverlay';
import { ProfileCollapseBar, useProfileCollapse } from '@/components/profile/ProfileCollapseBar';
import { AvatarFlightOverlay, PROFILE_AVATAR_RENDER_BOUNDS, useAvatarAnchor } from '@/components/profile/ProfileAvatarFlight';

// ── Mood aura data ────────────────────────────────────────────────────────────
type AuraData = {
  gradient:  [string, string, string];
  accent:    string;
  particle:  string;
  speed:     number;
  count:     number;
  orbs:      [string, string, string];
};
const MOOD_AURA: Record<string, AuraData> = {
  Hopeful:     { gradient: ['#101808','#182414','#1E2E18'], accent: '#C8A84B', particle: '✦', speed: 3800, count: 6,  orbs: ['#C8A84B22','#A09030','#C8A84B11'] },
  Peaceful:    { gradient: ['#080E18','#0E1820','#14222C'], accent: '#78A8C8', particle: '✧', speed: 5200, count: 5,  orbs: ['#78A8C822','#5080A0','#78A8C811'] },
  Lonely:      { gradient: ['#06061A','#0C0E24','#10142C'], accent: '#7090C0', particle: '·', speed: 7000, count: 4,  orbs: ['#7090C018','#506090','#7090C00E'] },
  Dreamy:      { gradient: ['#0A0620','#140E38','#1A1248'], accent: '#B89AE8', particle: '⋆', speed: 5500, count: 8,  orbs: ['#B89AE822','#8060C0','#B89AE811'] },
  Romantic:    { gradient: ['#12060C','#1C0A18','#24102A'], accent: '#D878B0', particle: '◦', speed: 4200, count: 6,  orbs: ['#D878B022','#A05090','#D878B011'] },
  Soft:        { gradient: ['#0E0816','#16102C','#1C1438'], accent: '#C8A0D8', particle: '○', speed: 6000, count: 5,  orbs: ['#C8A0D820','#9070B0','#C8A0D810'] },
  Chaotic:     { gradient: ['#140402','#200806','#2C0E08'], accent: '#E8784A', particle: '✸', speed: 1800, count: 10, orbs: ['#E8784A22','#C05020','#E8784A11'] },
  Joyful:      { gradient: ['#060E06','#0E180E','#142018'], accent: '#70C888', particle: '★', speed: 3000, count: 7,  orbs: ['#70C88822','#40A060','#70C88811'] },
  Adventurous: { gradient: ['#080E08','#10180C','#182014'], accent: '#6AC888', particle: '↑', speed: 2500, count: 8,  orbs: ['#6AC88822','#408040','#6AC88811'] },
  Grateful:    { gradient: ['#120A10','#1C1018','#241420'], accent: '#D878B0', particle: '✿', speed: 4500, count: 6,  orbs: ['#D878B020','#A05890','#D878B010'] },
  Nostalgic:   { gradient: ['#120A06','#1E1008','#280E0A'], accent: '#D4A05A', particle: '◇', speed: 5000, count: 5,  orbs: ['#D4A05A20','#A07030','#D4A05A10'] },
  Melancholy:  { gradient: ['#060A14','#0A1020','#10182C'], accent: '#5D7BA5', particle: '◦', speed: 6500, count: 4,  orbs: ['#5D7BA518','#3A5080','#5D7BA50E'] },
};
const DEFAULT_AURA: AuraData = {
  gradient: ['#0E0C20','#181448','#201C52'],
  accent:   '#9B78E8',
  particle: '✦',
  speed:    4500,
  count:    6,
  orbs:     ['#9B78E820','#6040C0','#9B78E810'],
};

const PUBLIC_PROFILE_AVATAR_SIZE = 104;
const PUBLIC_PROFILE_FRAME_SIZE = 112;
const PUBLIC_PROFILE_HALO_SIZE = 128;
const PUBLIC_PROFILE_OUTER_RING_SIZE = 120;
const PUBLIC_PROFILE_MID_RING_SIZE = 112;
const PUBLIC_PROFILE_INNER_RING_SIZE = 108;

const ROLES = [
  { key: 'Collector', emoji: '🎁', color: '#C8A84B' },
  { key: 'Trader',    emoji: '🤝', color: '#78A8C8' },
  { key: 'Veteran',   emoji: '⭐', color: '#D4956A' },
  { key: 'Uber',      emoji: '👑', color: '#9B78E8' },
  { key: 'Solo',      emoji: '🌙', color: '#6080C0' },
];

// ── Crown spark dots for founder ring ────────────────────────────────────────
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
function FounderSparks({ radius, color }: { radius: number; color: string }) {
  return (
    <>
      {SPARK_ANGLES.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x   = radius * Math.cos(rad);
        const y   = radius * Math.sin(rad);
        const size = i % 2 === 0 ? 7 : 4.5;
        return (
          <View
            key={angle}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: size, height: size, borderRadius: size / 2,
              backgroundColor: color,
              left: radius + x - size / 2,
              top:  radius + y - size / 2,
              shadowColor: color,
              shadowOpacity: 0.9,
              shadowRadius: 4,
              elevation: 4,
            }}
          />
        );
      })}
    </>
  );
}

// ── Animated avatar ring ──────────────────────────────────────────────────────
function AnimatedAvatarRing({
  mood,
  profile,
  isFounder,
  isBeta,
  activeFrame,
  decorationOpacity,
}: {
  mood: string;
  profile: PublicProfile;
  isFounder: boolean;
  isBeta:    boolean;
  activeFrame?: string | null;
  decorationOpacity?: Animated.AnimatedInterpolation<number>;
}) {
  const aura    = MOOD_AURA[mood] ?? DEFAULT_AURA;
  const breathe = useRef(new Animated.Value(0)).current;
  const rotate  = useRef(new Animated.Value(0)).current;
  const pulse   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breatheLoop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: isFounder ? 2000 : isBeta ? 1600 : 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: isFounder ? 2000 : isBeta ? 1600 : 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    breatheLoop.start();
    return () => breatheLoop.stop();
  }, [breathe, isFounder, isBeta]);

  useEffect(() => {
    const rotateLoop = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: isFounder ? 18000 : isBeta ? 5000 : 12000, easing: Easing.linear, useNativeDriver: true })
    );
    rotateLoop.start();
    return () => rotateLoop.stop();
  }, [rotate, isFounder, isBeta]);

  useEffect(() => {
    if (!isFounder && !isBeta) return;
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
    ]));
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulse, isFounder, isBeta]);

  const ringScale   = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, isFounder ? 1.04 : 1.06] });
  const ringOpacity = breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [isFounder ? 0.55 : 0.30, 1, isFounder ? 0.55 : 0.30] });
  const haloOpacity = breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, isFounder ? 0.55 : isBeta ? 0.50 : 0.38, 0.12] });
  const haloScale   = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, isFounder ? 1.08 : 1.06] });
  const spin        = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pulseScale  = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const pulseOp     = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.55, 0] });
  const avatarSource = profile.avatarUri ? { uri: profile.avatarUri } : null;
  const initial = (profile.name ?? '?').charAt(0).toUpperCase();

  // ── Founder color palette
  const founderGold   = '#C8A84B';
  const founderDeep   = '#8A6820';
  // ── Beta color palette
  const betaPurple    = '#9B78E8';
  const betaDark      = '#5A3AB0';

  if (isFounder) {
    return (
      <Animated.View style={[styles.avatarInBanner, null]}>
        {/* Outer shimmer halo */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_HALO_SIZE, height: PUBLIC_PROFILE_HALO_SIZE, borderRadius: PUBLIC_PROFILE_HALO_SIZE / 2,
          backgroundColor: founderGold + '14',
          transform: [{ scale: haloScale }],
          opacity: haloOpacity,
        }} />
        {/* Spark dots container (sized to match outer ring) */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: PUBLIC_PROFILE_HALO_SIZE - 6,
            height: PUBLIC_PROFILE_HALO_SIZE - 6,
            left: (PUBLIC_PROFILE_AVATAR_SIZE - (PUBLIC_PROFILE_HALO_SIZE - 6)) / 2,
            top: (PUBLIC_PROFILE_AVATAR_SIZE - (PUBLIC_PROFILE_HALO_SIZE - 6)) / 2,
          }}
        >
          <FounderSparks radius={(PUBLIC_PROFILE_HALO_SIZE - 6) / 2} color={founderGold} />
        </View>
        {/* Slow-spinning outer ring — thick gold */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_OUTER_RING_SIZE, height: PUBLIC_PROFILE_OUTER_RING_SIZE, borderRadius: PUBLIC_PROFILE_OUTER_RING_SIZE / 2,
          borderWidth: 2.5,
          borderColor: founderGold,
          transform: [{ rotate: spin }],
          opacity: 0.75,
        }} />
        {/* Breathing solid ring — inner */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_INNER_RING_SIZE, height: PUBLIC_PROFILE_INNER_RING_SIZE, borderRadius: PUBLIC_PROFILE_INNER_RING_SIZE / 2,
          borderWidth: 3,
          borderColor: founderDeep,
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }} />
        {/* Pulse ring — energy burst */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_INNER_RING_SIZE, height: PUBLIC_PROFILE_INNER_RING_SIZE, borderRadius: PUBLIC_PROFILE_INNER_RING_SIZE / 2,
          borderWidth: 1.5,
          borderColor: founderGold,
          transform: [{ scale: pulseScale }],
          opacity: pulseOp,
        }} />
        {activeFrame && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, decorationOpacity != null && { opacity: decorationOpacity }]}><FrameRing frameId={activeFrame} size={PUBLIC_PROFILE_FRAME_SIZE} layer="wings" /></Animated.View>}
        {/* Avatar circle */}
        <View style={[styles.avatarCircle, { borderColor: founderGold, borderWidth: 3, backgroundColor: '#1A1408' }]}>
          {avatarSource ? (
            <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <Text style={[styles.avatarInitial, { color: founderGold }]}>{initial}</Text>
          )}
        </View>
        {activeFrame && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, decorationOpacity != null && { opacity: decorationOpacity }]}><FrameRing frameId={activeFrame} size={PUBLIC_PROFILE_FRAME_SIZE} layer="ornament" /></Animated.View>}
      </Animated.View>
    );
  }

  if (isBeta) {
    return (
      <Animated.View style={[styles.avatarInBanner, null]}>
        {/* Outer halo */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_HALO_SIZE, height: PUBLIC_PROFILE_HALO_SIZE, borderRadius: PUBLIC_PROFILE_HALO_SIZE / 2,
          backgroundColor: betaPurple + '18',
          transform: [{ scale: haloScale }],
          opacity: haloOpacity,
        }} />
        {/* Fast-spinning outer ring — purple dashed */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_OUTER_RING_SIZE, height: PUBLIC_PROFILE_OUTER_RING_SIZE, borderRadius: PUBLIC_PROFILE_OUTER_RING_SIZE / 2,
          borderWidth: 2,
          borderColor: betaPurple + 'CC',
          borderStyle: 'dashed',
          transform: [{ rotate: spin }],
        }} />
        {/* Steady solid middle ring */}
        <View pointerEvents="none" style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_MID_RING_SIZE, height: PUBLIC_PROFILE_MID_RING_SIZE, borderRadius: PUBLIC_PROFILE_MID_RING_SIZE / 2,
          borderWidth: 1.5,
          borderColor: betaDark + '99',
        }} />
        {/* Breathing solid inner ring */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_INNER_RING_SIZE, height: PUBLIC_PROFILE_INNER_RING_SIZE, borderRadius: PUBLIC_PROFILE_INNER_RING_SIZE / 2,
          borderWidth: 2.5,
          borderColor: betaPurple,
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }} />
        {/* Pulse ring */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_INNER_RING_SIZE, height: PUBLIC_PROFILE_INNER_RING_SIZE, borderRadius: PUBLIC_PROFILE_INNER_RING_SIZE / 2,
          borderWidth: 1.5,
          borderColor: betaPurple,
          transform: [{ scale: pulseScale }],
          opacity: pulseOp,
        }} />
        {activeFrame && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, decorationOpacity != null && { opacity: decorationOpacity }]}><FrameRing frameId={activeFrame} size={PUBLIC_PROFILE_FRAME_SIZE} layer="wings" /></Animated.View>}
        {/* Avatar circle */}
        <View style={[styles.avatarCircle, { borderColor: betaPurple, borderWidth: 3, backgroundColor: '#120A20' }]}>
          {avatarSource ? (
            <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <Text style={[styles.avatarInitial, { color: betaPurple }]}>{initial}</Text>
          )}
        </View>
        {activeFrame && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, decorationOpacity != null && { opacity: decorationOpacity }]}><FrameRing frameId={activeFrame} size={PUBLIC_PROFILE_FRAME_SIZE} layer="ornament" /></Animated.View>}
      </Animated.View>
    );
  }

  // ── Normal user ring
  return (
    <Animated.View style={[styles.avatarInBanner, null]}>
      {/* Outer halo pulse */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_HALO_SIZE, height: PUBLIC_PROFILE_HALO_SIZE, borderRadius: PUBLIC_PROFILE_HALO_SIZE / 2,
          backgroundColor: aura.accent + '18',
          transform: [{ scale: haloScale }],
          opacity: haloOpacity,
        }}
      />
      {/* Rotating dashed ring */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_OUTER_RING_SIZE, height: PUBLIC_PROFILE_OUTER_RING_SIZE, borderRadius: PUBLIC_PROFILE_OUTER_RING_SIZE / 2,
          borderWidth: 1.5,
          borderColor: aura.accent + 'AA',
          borderStyle: 'dashed',
          transform: [{ rotate: spin }],
        }}
      />
      {/* Breathing solid ring */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: PUBLIC_PROFILE_INNER_RING_SIZE, height: PUBLIC_PROFILE_INNER_RING_SIZE, borderRadius: PUBLIC_PROFILE_INNER_RING_SIZE / 2,
          borderWidth: 2,
          borderColor: aura.accent,
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }}
      />
      {activeFrame && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, decorationOpacity != null && { opacity: decorationOpacity }]}><FrameRing frameId={activeFrame} size={PUBLIC_PROFILE_FRAME_SIZE} layer="wings" /></Animated.View>}
      {/* Avatar circle */}
      <View style={[styles.avatarCircle, { borderColor: aura.accent + '80' }]}>
        {avatarSource ? (
          <Image
            source={avatarSource}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <Text style={[styles.avatarInitial, { color: aura.accent }]}>{initial}</Text>
        )}
      </View>
      {activeFrame && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, decorationOpacity != null && { opacity: decorationOpacity }]}><FrameRing frameId={activeFrame} size={PUBLIC_PROFILE_FRAME_SIZE} layer="ornament" /></Animated.View>}
    </Animated.View>
  );
}

// ── Mood chip ─────────────────────────────────────────────────────────────────
function MoodChip({ mood, accentOverride }: { mood: string; accentOverride?: string }) {
  const { t } = useTranslation();
  const aura = MOOD_AURA[mood] ?? DEFAULT_AURA;
  const accent = accentOverride ?? aura.accent;
  return (
    <View style={[styles.moodChip, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
      <View style={[styles.moodDot, { backgroundColor: accent }]} />
      <Text style={[styles.moodChipText, { color: accent }]}>{t(`publicProfile.moods.${mood}`, { defaultValue: mood })}</Text>
    </View>
  );
}

const MOOD_COLORS: Record<string, string> = {
  Peaceful: '#8B7AB5', Joyful: '#D4A849', Melancholy: '#5D7BA5',
  Nostalgic: '#A5785D', Hopeful: '#6BA57A', Dreamy: '#9B7AB5',
};

interface ProfileLink {
  label:     string;
  url:       string;
  platform?: string;
}

function fmtBirthday(bd: string, locale: string): string {
  try {
    const d = new Date(bd);
    if (isNaN(d.getTime())) return bd;
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch { return bd; }
}

interface ActiveOutfit {
  id:          string;
  name:        string;
  description: string;
  story:       string;
  imageUri:    string | null;
  tags:        string[];
  music?:      import('@/context/mappers').StoryMusic | null;
}

interface PublicProfile {
  userId:           string;
  name:             string;
  username:         string | null;
  bio:              string;
  traits:           string[];
  mood:             string;
  role:             string | null;
  timezone:         string | null;
  country:          string | null;
  birthday:         string | null;
  links:            ProfileLink[];
  avatarUri:        string | null;
  activeOutfitId:   string | null;
  activeOutfit:     ActiveOutfit | null;
  activeFrame?:     string | null;
  activeEffect?:    string | null;
  activeCardFrame?: string | null;
  isFollowing:      boolean;
  profileLiked:     boolean;
  profileLikeCount: number;
  activeTitle:      string | null;
  intention:        string | null;
  intentionDate:    string | null;
  stars:            number; // lifetimeStars — never decreases
  isFounder?:       boolean;
  isBetaTester?:    boolean;
  badges?:          BadgeItem[];
  isOnline?:        boolean;
  showOnlineStatus?: boolean;
}

const XP_PER_LEVEL = 300;

interface PublicStory {
  id:             string;
  chapterTitle:   string;
  mood:           string;
  location:       string;
  panels:         { text?: string; imageUri?: string }[];
  witnessedCount: number;
  likeCount:      number;
  savedCount:     number;
  date:           string;
  contentType?:   'story' | 'video';
  videoUri?:      string | null;
  thumbnailUri?:  string | null;
  music?:         StoryMusic | null;
}

interface PublicOutfit {
  id:          string;
  name:        string;
  description: string;
  story:       string;
  imageUri:    string | null;
  tags:        string[];
  music?:      import('@/context/mappers').StoryMusic | null;
  date:        string;
}

interface PublicBook {
  id:            string;
  title:         string;
  subtitle:      string | null;
  genre:         string | null;
  coverImageUri: string | null;
  chapterCount:  number;
}

export default function UserProfileScreen() {
  const { userId }          = useLocalSearchParams<{ userId: string }>();
  const colors              = useColors();
  const { isDark }           = useTheme();
  const { t, i18n }         = useTranslation();
  const insets              = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { userId: meId }    = useAuth();
  const { followingIds, followUser, unfollowUser, blockedIds, blockUser, unblockUser } = useApp();

  const [profile,      setProfile]      = useState<PublicProfile | null>(null);
  const [stories,      setStories]      = useState<PublicStory[]>([]);
  const [videos,       setVideos]       = useState<PublicStory[]>([]);
  const [videoPost,    setVideoPost]    = useState<DiscoverPost | null>(null);
  const [outfits,      setOutfits]      = useState<PublicOutfit[]>([]);
  const [books,        setBooks]        = useState<PublicBook[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [storiesError, setStoriesError] = useState(false);
  const [outfitsError, setOutfitsError] = useState(false);
  const [booksError,   setBooksError]   = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [founderIntroVisible, setFounderIntroVisible] = useState(false);
  const [moonlitMuseIntroVisible, setMoonlitMuseIntroVisible] = useState(false);
  const [cosmicArrivalVisible, setCosmicArrivalVisible] = useState(false);
  const profileLikeBusy = useRef(false);
  const [likingProfile, setLikingProfile] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const scaleAnim = useRef(new Animated.Value(0.97)).current;

  const isFollowing = followingIds.includes(userId ?? '');
  const isSelf      = meId === userId;
  const isBlocked   = blockedIds.includes(userId ?? '');

  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 80  : insets.bottom + 40;
  const [profileCollapseAt, setProfileCollapseAt] = useState(160);
  // Travel completes when the info card reaches the sticky bar's bottom edge (layout-time only).
  const handlePanelsLayout = useCallback((y: number) => {
    const next = Math.max(90, Math.round(y - (topPad + 56) - 8));
    setProfileCollapseAt(prev => (Math.abs(prev - next) > 1 ? next : prev));
  }, [topPad]);
  const compactBarAt = Math.max(0, profileCollapseAt - 36);
  const { scrollY, compactVisible, onScroll, offsetRef } = useProfileCollapse(compactBarAt);
  const { rootRef, slotRef, anchor, measure } = useAvatarAnchor(offsetRef);
  // Keep the expanded identity visible until the sticky identity starts fading in.
  const infoOpacity = useMemo(() => scrollY.interpolate({ inputRange: [0, Math.max(1, profileCollapseAt - 20)], outputRange: [1, 0], extrapolate: 'clamp' }), [scrollY, profileCollapseAt]);
  const infoTy = useMemo(() => scrollY.interpolate({ inputRange: [0, profileCollapseAt], outputRange: [0, -14], extrapolate: 'clamp' }), [scrollY, profileCollapseAt]);
  type GalleryFilter = 'all' | 'videos' | 'outfits' | 'stories' | 'books';
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>('all');

  function runEnterAnimation() {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 450,
        useNativeDriver: true, easing: Easing.out(Easing.quad),
      }),
      Animated.spring(slideAnim, {
        toValue: 0, tension: 50, friction: 9, useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1, tension: 55, friction: 9, useNativeDriver: true,
      }),
    ]).start();
  }

  async function loadStories() {
    setStoriesError(false);
    try {
      const [stors, vids] = await Promise.all([
        apiFetch<PublicStory[]>(`/users/${userId}/stories`),
        apiFetch<PublicStory[]>(`/users/${userId}/stories?type=video`),
      ]);
      setStories(stors);
      setVideos(vids);
    } catch {
      setStoriesError(true);
    }
  }

  async function loadOutfits() {
    setOutfitsError(false);
    try {
      const outs = await apiFetch<PublicOutfit[]>(`/users/${userId}/outfits`);
      setOutfits(outs);
    } catch {
      setOutfitsError(true);
    }
  }

  async function loadBooks() {
    setBooksError(false);
    try {
      const bks = await apiFetch<PublicBook[]>(`/users/${userId}/books`);
      setBooks(bks);
    } catch {
      setBooksError(true);
    }
  }

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void prepareNativeOutfitAudio().catch(() => null);
  }, []);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);
    setStories([]);
    setVideos([]);
    setVideoPost(null);
    setOutfits([]);
    setBooks([]);
    setFounderIntroVisible(false);
    setMoonlitMuseIntroVisible(false);
    setCosmicArrivalVisible(false);
    (async () => {
      const [profResult, storsResult, outsResult, booksResult, videosResult] = await Promise.allSettled([
        apiFetch<PublicProfile>(`/users/${userId}`),
        apiFetch<PublicStory[]>(`/users/${userId}/stories`),
        apiFetch<PublicOutfit[]>(`/users/${userId}/outfits`),
        apiFetch<PublicBook[]>(`/users/${userId}/books`),
        apiFetch<PublicStory[]>(`/users/${userId}/stories?type=video`),
      ]);
      if (cancelled) return;

      if (profResult.status === 'rejected') {
        const err = profResult.reason;
        const isBlocked = err instanceof ApiError && err.status === 403;
        setError(isBlocked && String(err.message).includes('private')
          ? 'This profile is private. Only friends can view it.'
          : isBlocked ? 'publicProfile.errorUnavailable' : 'publicProfile.errorLoad');
        setLoading(false);
        return;
      }

      setProfile(profResult.value);
      const profileHasFounderBadge = profResult.value.badges?.some(badge => badge.slug === 'founder') ?? false;
      const hasMoonlitMuse = profResult.value.activeEffect === 'effect_moonlit_muse';
      const hasCosmicArrival = profResult.value.activeEffect === 'effect_cosmic_arrival';
      const showCosmicArrival = hasCosmicArrival && meId !== userId;
      setMoonlitMuseIntroVisible(hasMoonlitMuse);
      setCosmicArrivalVisible(showCosmicArrival);
      setFounderIntroVisible((Boolean(profResult.value.isFounder) || profileHasFounderBadge) && !hasMoonlitMuse && !showCosmicArrival);
      setStories(storsResult.status === 'fulfilled' ? storsResult.value : []);
      setVideos(videosResult.status === 'fulfilled' ? videosResult.value : []);
      setStoriesError(storsResult.status === 'rejected' || videosResult.status === 'rejected');
      setOutfits(outsResult.status === 'fulfilled' ? outsResult.value : []);
      setOutfitsError(outsResult.status === 'rejected');
      setBooks(booksResult.status === 'fulfilled' ? booksResult.value : []);
      setBooksError(booksResult.status === 'rejected');
      setLoading(false);
      runEnterAnimation();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { cancelled = true; };
  }, [userId, meId]));

  function handleFollow() {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isFollowing) unfollowUser(profile.userId);
    else             followUser(profile.userId);
  }

  async function handleLikeProfile() {
    if (!profile || isSelf || profileLikeBusy.current) return;
    profileLikeBusy.current = true;
    setLikingProfile(true);
    const previous = { liked: profile.profileLiked, count: profile.profileLikeCount };
    const nextLiked = !previous.liked;
    setProfile(current => current && ({
      ...current,
      profileLiked: nextLiked,
      profileLikeCount: Math.max(0, current.profileLikeCount + (nextLiked ? 1 : -1)),
    }));
    void Haptics.selectionAsync();
    try {
      const result = await apiFetch<{ profileLiked: boolean; profileLikeCount: number }>(
        `/users/${profile.userId}/like`,
        { method: nextLiked ? 'POST' : 'DELETE' },
      );
      setProfile(current => current && ({
        ...current,
        profileLiked: result.profileLiked,
        profileLikeCount: result.profileLikeCount,
      }));
    } catch {
      setProfile(current => current && ({
        ...current,
        profileLiked: previous.liked,
        profileLikeCount: previous.count,
      }));
      Alert.alert(t('likes.failedTitle'), t('likes.failedBody'));
    } finally {
      profileLikeBusy.current = false;
      setLikingProfile(false);
    }
  }

  function handleMore() {
    if (!profile || !userId) return;
    const blockOption = isBlocked
      ? {
          text: t('publicProfile.unblockUser'),
          onPress: () => {
            Alert.alert(
              t('publicProfile.unblockUser'),
              t('publicProfile.unblockBody', { name: profile.name }),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('publicProfile.unblock'),
                  onPress: () => unblockUser(userId),
                },
              ],
            );
          },
        }
      : {
          text: t('publicProfile.blockUser'),
          style: 'destructive' as const,
          onPress: () => {
            Alert.alert(
              t('publicProfile.blockUser'),
              t('publicProfile.blockBody', { name: profile.name }),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('publicProfile.block'),
                  style: 'destructive',
                  onPress: () => {
                    blockUser(userId).catch(() => null);
                    safeBack();
                  },
                },
              ],
            );
          },
        };
    Alert.alert(
      profile.name,
      undefined,
      [
        { text: t('publicProfile.report'), onPress: () => setReportVisible(true) },
        blockOption,
        { text: t('common.cancel'), style: 'cancel' },
      ],
    );
  }

  const mood           = profile?.mood ?? 'Dreamy';
  const aura           = MOOD_AURA[mood] ?? DEFAULT_AURA;
  const _moodColor     = MOOD_COLORS[mood] ?? aura.accent;
  const userRole       = profile ? ROLES.find(r => r.key === profile.role) : undefined;
  const weatherQuery   = profile?.country ?? null;
  const totalWitnessed = stories.reduce((s, st) => s + st.witnessedCount, 0);
  const totalLikes = (profile?.profileLikeCount ?? 0) + stories.reduce((sum, story) => sum + (story.likeCount ?? 0), 0);
  const isTopExplorer  = totalWitnessed >= 10 || stories.length >= 3;
  const profileBadges = profile?.badges ?? [];
  const hasDynamicFounderBadge = profileBadges.some(badge => badge.slug === 'founder');
  const hasDynamicBetaBadge = profileBadges.some(badge => badge.slug === 'beta_tester');
  const isFounder = Boolean(profile?.isFounder) || hasDynamicFounderBadge;
  const hasRegalia = profile?.activeCardFrame === 'card_frame_founder_regalia'
    || (profile?.activeCardFrame === undefined && profile?.isFounder === true);
  const isBeta = Boolean(profile?.isBetaTester) || hasDynamicBetaBadge;
  const founderBadge = hasDynamicFounderBadge ? profileBadges.find(badge => badge.slug === 'founder') : null;
  const betaBadge = hasDynamicBetaBadge ? profileBadges.find(badge => badge.slug === 'beta_tester') : null;
  const showLegacyFounderBadge = Boolean(profile?.isFounder) && !hasDynamicFounderBadge;
  const showLegacyBetaBadge = Boolean(profile?.isBetaTester) && !hasDynamicBetaBadge;
  const regaliaTheme = isDark
    ? {
        panel: '#100D20',
        inset: '#17132A',
        insetAlt: '#1B1730',
        border: 'rgba(221,184,108,0.25)',
        divider: 'rgba(221,184,108,0.22)',
        gold: '#E4C16F',
        xpTrack: '#302844',
        xpFill: '#C6A6FF',
      }
    : {
        panel: '#FFFEFC',
        inset: '#F8F5EF',
        insetAlt: '#F3EFE7',
        border: '#D7C5A1',
        divider: '#E2D7C2',
        gold: '#895B16',
        xpTrack: '#E8E0D2',
        xpFill: '#7656B4',
      };
  const regaliaAccent = hasRegalia && !isDark ? colors.tint : aura.accent;

  const xpTotal = profile?.stars ?? 0;
  const level = Math.max(1, Math.floor(xpTotal / XP_PER_LEVEL) + 1);
  const xpInLevel = xpTotal % XP_PER_LEVEL;
  const xpPct = xpInLevel / XP_PER_LEVEL;
  const intentionToday = (() => {
    if (!profile?.intentionDate) return false;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return profile.intentionDate === today;
  })();
  const galleryTabs: { key: GalleryFilter; label: string }[] = [
    { key: 'all', label: t('reels.filterAll') },
    ...(videos.length ? [{ key: 'videos' as const, label: t('reels.filterVideos') }] : []),
    ...(outfits.length || profile?.activeOutfit ? [{ key: 'outfits' as const, label: t('components.profile.stats.outfits') }] : []),
    ...(stories.length ? [{ key: 'stories' as const, label: t('reels.filterStories') }] : []),
    ...(books.length ? [{ key: 'books' as const, label: t('publicProfile.books') }] : []),
  ];
  const showKind = (k: GalleryFilter) => galleryFilter === 'all' || galleryFilter === k;
  const contentW = Math.min(windowWidth, 720);
  const GRID_GAP = 6;
  const tileW = Math.floor((contentW - 32 - GRID_GAP * 2) / 3);
  const outfitList = [
    ...(profile?.activeOutfit ? [{ ...profile.activeOutfit, date: '' }] : []),
    ...outfits.filter(outfit => outfit.id !== profile?.activeOutfit?.id),
  ];
  function openOutfitAt(index: number) {
    if (!profile) return;
    const outfit = outfitList[index];
    if (!outfit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/user-outfit',
      params: {
        outfitName: outfit.name, outfitId: outfit.id,
        outfitDesc: outfit.description ?? '', outfitStory: outfit.story ?? '',
        outfitImage: outfit.imageUri ?? '', outfitTags: JSON.stringify(outfit.tags ?? []),
        outfitMusic: outfit.music ? JSON.stringify(outfit.music) : '', outfitDate: outfit.date ?? '',
        authorUserId: profile.userId, authorName: profile.name, authorHandle: profile.username ?? '',
        authorBio: profile.bio ?? '', authorAvatarUri: profile.avatarUri ?? '', authorIsSelf: String(isSelf),
        authorMood: profile.mood ?? '', authorTraits: JSON.stringify(profile.traits),
        allOutfitsJson: JSON.stringify(outfitList.map(o => ({ id: o.id, name: o.name, description: o.description ?? '', story: o.story ?? '', imageUri: o.imageUri ?? '', tags: o.tags ?? [], music: o.music ?? null, date: o.date ?? '' }))),
        initialIndex: String(index),
      },
    } as never);
  }
  type GalleryItem = { key: string; kind: GalleryFilter; title: string; image: string | null; icon: string; current?: boolean; disabled?: boolean; testID?: string; onPress: () => void };
  const galleryItems: GalleryItem[] = !profile ? [] : [
    ...(showKind('videos') ? videos.map(v => ({
      key: `v-${v.id}`, kind: 'videos' as const, title: v.chapterTitle, image: v.thumbnailUri ?? null, icon: 'play',
      disabled: !v.videoUri, testID: `profile-video-${v.id}`,
      onPress: () => setVideoPost({
        id: v.id, authorUserId: profile.userId, authorName: profile.name,
        authorHandle: profile.username ?? '', authorAvatarUri: profile.avatarUri,
        chapterTitle: v.chapterTitle, storySnippet: '', mood: v.mood,
        witnessedCount: v.witnessedCount, likeCount: v.likeCount ?? 0, liked: false,
        savedCount: v.savedCount, stickerCount: 0, timeAgo: '', date: v.date,
        chapterNumber: 0, vibe: '', saved: false, isFollowing,
        contentType: 'video', videoUri: v.videoUri, thumbnailUri: v.thumbnailUri, music: v.music,
      }),
    })) : []),
    ...(showKind('outfits') ? outfitList.map((o, i) => ({
      key: `o-${o.id}-${i}`, kind: 'outfits' as const, title: o.name, image: o.imageUri ?? null, icon: 'layers',
      current: Boolean(profile.activeOutfit) && i === 0, testID: `public-gallery-outfit-${o.id}`,
      onPress: () => openOutfitAt(i),
    })) : []),
    ...(showKind('stories') && !storiesError ? stories.map(st => ({
      key: `s-${st.id}`, kind: 'stories' as const, title: st.chapterTitle, image: st.panels[0]?.imageUri ?? null, icon: 'book-open',
      testID: `public-gallery-story-${st.id}`,
      onPress: () => router.push({ pathname: '/story/[id]', params: { id: st.id, source: 'discover' } } as never),
    })) : []),
    ...(showKind('books') && !booksError ? books.map(bk => ({
      key: `b-${bk.id}`, kind: 'books' as const, title: bk.title, image: bk.coverImageUri, icon: 'book',
      testID: `public-gallery-book-${bk.id}`,
      onPress: () => router.push({ pathname: '/book-public', params: { bookId: bk.id } } as never),
    })) : []),
  ];
  function openSocials() {
    const links = profile?.links ?? [];
    const open = (url: string) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(url).catch(() => null); };
    if (links.length === 1) { open(links[0].url); return; }
    Alert.alert(t('components.about.socials'), undefined, [
      ...links.slice(0, 8).map(l => ({ text: l.label, onPress: () => open(l.url) })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <StorigamActivityIndicator size={36} color={colors.primary} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Icon name="alert-circle" size={36} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
          {error ? t(error) : t('publicProfile.notFound')}
        </Text>
        <TouchableOpacity
          style={[styles.backBtnErr, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => safeBack()}
        >
          <Text style={[styles.backBtnErrText, { color: colors.primary }]}>{t('common.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View ref={rootRef} collapsable={false} onLayout={measure} style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        // Android clipping can detach transformed overlays and image children
        // during fast direction changes on this profile screen.
        removeClippedSubviews={false}
        onScroll={onScroll}
        onLayout={measure}
        scrollEventThrottle={16}
        testID="public-profile-scroll"
        contentContainerStyle={{
          width: Math.min(windowWidth, 720),
          alignSelf: 'center',
          paddingBottom: bottomPad,
        }}
      >

        {/* ── QUIET IDENTITY HEADER ───────────────────────────────── */}
        <View style={[styles.quietHeader, { paddingTop: topPad + 8 }]}>
          <View pointerEvents="none" style={styles.quietBackdrop}>
            <LinearGradient
              colors={isDark ? [colors.background, `${aura.gradient[1]}`, colors.background] : [colors.background, `${aura.accent}10`, colors.background]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
            {/* Equipped effects remain visible, just restrained. */}
            {profile.activeEffect === 'effect_aurora_clouds' && <View style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}><AuroraCloudBackdrop /></View>}
            {profile.activeEffect && profile.activeEffect !== 'effect_aurora_clouds' && profile.activeEffect !== 'effect_moonlit_muse' && (
              <View style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}>
                <ProfileEffect effectId={profile.activeEffect === 'effect_cosmic_arrival' ? undefined : profile.activeEffect} />
              </View>
            )}
          </View>

          <View style={styles.quietTopRow}>
            <TouchableOpacity
              style={[styles.quietTopBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => safeBack()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.goBack')}
              testID="public-profile-back"
            >
              <Icon name="arrow-left" size={17} color={colors.foreground} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {isTopExplorer && (
              <View style={[styles.explorerPill, { borderColor: `${colors.gold}55`, backgroundColor: `${colors.gold}12` }]}>
                <Icon name="star" size={11} color={colors.gold} />
                <Text style={[styles.explorerBadgeText, { color: colors.gold }]} numberOfLines={1}>{t('publicProfile.topExplorer')}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.quietTopBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleMore}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('publicProfile.report')}
              testID="public-profile-more"
            >
              <Icon name="more-horizontal" size={17} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Measured slot — the real avatar flies from here into the compact bar. */}
          <View
            ref={slotRef}
            onLayout={measure}
            collapsable={false}
            style={styles.avatarSlot}
            testID="public-profile-avatar-slot"
          >
            {!anchor && (
              <AnimatedAvatarRing mood={mood} profile={profile} isFounder={isFounder} isBeta={isBeta} activeFrame={profile.activeFrame} />
            )}
          </View>

          <Animated.View style={[styles.identityBlock, { opacity: infoOpacity, transform: [{ translateY: infoTy }] }]}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>
                {profile.name}
              </Text>
              {isFounder && <Icon name="star" size={15} color={colors.gold} accessibilityLabel={t('publicProfile.founderTitle')} />}
              {isBeta && !isFounder && <Icon name="zap" size={14} color={colors.primary} accessibilityLabel={t('publicProfile.betaPioneerTitle')} />}
            </View>
            <View style={styles.publicIdentityRow}>
              {profile.username ? (
                <Text style={[styles.handle, { color: colors.mutedForeground }]} numberOfLines={1}>@{profile.username}</Text>
              ) : null}
              {profile.showOnlineStatus && (
                <View style={[styles.onlinePill, { borderColor: profile.isOnline ? 'rgba(80,200,120,0.40)' : colors.border }]}>
                  <View style={[styles.onlineDot, { backgroundColor: profile.isOnline ? (isDark ? '#4EC87A' : '#24804A') : colors.mutedForeground }]} />
                  <Text style={[styles.onlineText, { color: profile.isOnline ? (isDark ? '#4EC87A' : '#24804A') : colors.mutedForeground }]}>
                    {profile.isOnline ? t('publicProfile.online') : t('publicProfile.offline')}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.levelRow}>
              <View style={[styles.levelPill, { borderColor: `${colors.gold}66`, backgroundColor: `${colors.gold}12` }]}>
                <Icon name="moon" size={11} color={colors.gold} />
                <Text style={[styles.levelPillText, { color: colors.gold }]}>{t('publicProfile.levelShort')} {level}</Text>
              </View>
              {profile.activeTitle ? (
                <View style={[styles.levelPill, { borderColor: `${colors.gold}40`, backgroundColor: 'transparent', maxWidth: 190 }]}>
                  <Text style={[styles.levelPillText, { color: colors.gold }]} numberOfLines={1}>{profile.activeTitle}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.xpRow} accessibilityLabel={`${xpInLevel} of ${XP_PER_LEVEL} XP`}>
              <View style={[styles.xpTrack, { backgroundColor: colors.muted }]}>
                <View style={[styles.xpFill, { width: `${Math.round(xpPct * 100)}%` as `${number}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.xpText, { color: colors.mutedForeground }]}>{xpInLevel} / {XP_PER_LEVEL} XP</Text>
            </View>

            {profileBadges.length > 0 && (
              <View style={styles.publicBadgeRow}>
                <BadgeTray badges={profileBadges} />
              </View>
            )}
            {(showLegacyFounderBadge || showLegacyBetaBadge) && (
              <View style={styles.publicBadgeRow}>
                <ProfileBadges isFounder={showLegacyFounderBadge} isBetaTester={showLegacyBetaBadge} size={30} showLabel />
              </View>
            )}
          </Animated.View>

          {/* Actions: follow / like / message */}
          <View style={styles.actionRow}>
            {!isSelf && (
              <TouchableOpacity
                style={[styles.actionBtn, isFollowing
                  ? { backgroundColor: colors.card, borderColor: colors.border }
                  : { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={handleFollow}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityState={{ selected: isFollowing }}
                testID="public-profile-follow"
              >
                <Icon name={isFollowing ? 'user-check' : 'user-plus'} size={14} color={isFollowing ? colors.foreground : colors.primaryForeground} />
                <Text style={[styles.actionText, { color: isFollowing ? colors.foreground : colors.primaryForeground }]} numberOfLines={1}>
                  {isFollowing ? t('publicProfile.following') : t('publicProfile.follow')}
                </Text>
              </TouchableOpacity>
            )}
            {!isSelf && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: profile.profileLiked ? '#D878B080' : colors.border }]}
                onPress={() => { void handleLikeProfile(); }}
                disabled={likingProfile}
                accessibilityRole="button"
                accessibilityLabel={t(profile.profileLiked ? 'likes.unlikeProfile' : 'likes.likeProfile')}
                accessibilityState={{ selected: profile.profileLiked, disabled: likingProfile }}
                testID="public-profile-like"
              >
                <Icon name="heart" size={14} color={profile.profileLiked ? (isDark ? '#F4B1D5' : '#A83F73') : colors.foreground} />
                <Text style={[styles.actionText, { color: profile.profileLiked ? (isDark ? '#F4B1D5' : '#A83F73') : colors.foreground }]} numberOfLines={1}>
                  {profile.profileLikeCount ?? 0}
                </Text>
              </TouchableOpacity>
            )}
            {!isSelf && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/messages/[userId]', params: { userId: profile.userId, name: profile.name } } as never);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('publicProfile.sendMessage')}
                testID="public-profile-message"
              >
                <Icon name="message-circle" size={14} color={colors.foreground} />
              </TouchableOpacity>
            )}
            {isSelf && (
              <Text style={[styles.profileLikeCount, { color: colors.mutedForeground }]}>
                {t('likes.profileCount', { count: profile.profileLikeCount ?? 0 })}
              </Text>
            )}
          </View>
        </View>

        <Animated.View
          onLayout={e => handlePanelsLayout(e.nativeEvent.layout.y)}
          style={[
            styles.panelStack,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
          ]}
        >
          {/* Info card. The equipped Founder regalia frame wraps this whole group. */}
          <View
            testID="public-profile-info-card"
            style={hasRegalia
              ? [styles.regaliaCard, { backgroundColor: regaliaTheme.panel, borderColor: regaliaTheme.border }]
              : styles.infoGroup}
          >
          {(profile.bio || (profile.intention && intentionToday)) ? (
            <View style={[styles.panel, { backgroundColor: hasRegalia ? regaliaTheme.inset : colors.card, borderColor: hasRegalia ? regaliaTheme.divider : colors.border }]}>
              {profile.bio ? (
                <Text style={[styles.bio, { color: colors.foreground }]} numberOfLines={6}>{profile.bio}</Text>
              ) : null}
              {profile.intention && intentionToday ? (
                <Text style={[styles.intention, { color: colors.mutedForeground }]} numberOfLines={2}>{profile.intention}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Country / Role / Socials */}
          <View style={[styles.infoRow, windowWidth < 390 && styles.infoRowNarrow]}>
            {([
              { key: 'country', icon: 'map-pin', label: t('components.about.country'), value: profile.country || '-', accent: colors.lavender, onPress: undefined as undefined | (() => void) },
              { key: 'role', icon: 'user', label: t('components.about.role'), value: userRole ? t(`publicProfile.roles.${userRole.key.toLowerCase()}`) : '-', accent: colors.blush, onPress: undefined as undefined | (() => void) },
              {
                key: 'socials', icon: 'link', label: t('components.about.socials'),
                value: profile.links?.length ? (profile.links.length === 1 ? profile.links[0].label : t('components.about.socialLinks', { count: profile.links.length })) : '-',
                accent: colors.skyBlue,
                onPress: profile.links?.length ? openSocials : undefined,
              },
            ]).map(item => (
              <TouchableOpacity
                key={item.key}
                disabled={!item.onPress}
                onPress={item.onPress}
                activeOpacity={0.76}
                style={[
                  styles.infoTile,
                  windowWidth < 390 && (item.key === 'socials' ? styles.infoTileFull : styles.infoTileNarrow),
                  { backgroundColor: hasRegalia ? regaliaTheme.inset : colors.card, borderColor: hasRegalia ? regaliaTheme.divider : colors.border },
                ]}
                accessibilityRole={item.onPress ? 'button' : 'text'}
                accessibilityLabel={`${item.label}: ${item.value}`}
                testID={`public-profile-${item.key}`}
              >
                <View style={[styles.infoIcon, { backgroundColor: `${item.accent}22` }]}>
                  <Icon name={item.icon} size={14} color={item.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{item.label}</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={windowWidth < 390 ? 2 : 1}>{item.value}</Text>
                </View>
                {item.onPress ? <Icon name="chevron-right" size={12} color={colors.mutedForeground} /> : null}
              </TouchableOpacity>
            ))}
          </View>
          {(profile.timezone || weatherQuery || profile.birthday) ? (
            <View style={styles.metaRow}>
              <WeatherWidget query={weatherQuery} timezone={profile.timezone} accentColor={colors.primary} compact />
              {profile.birthday ? (
                <View style={[styles.metaPill, { borderColor: colors.border }]}>
                  <Icon name="gift" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.metaPillText, { color: colors.mutedForeground }]}>{fmtBirthday(profile.birthday, i18n.language)}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Vibe */}
          <View style={[styles.panel, { backgroundColor: hasRegalia ? regaliaTheme.inset : colors.card, borderColor: hasRegalia ? regaliaTheme.divider : colors.border }]}>
            <View style={styles.panelHeader}>
              <Icon name="star" size={15} color={colors.primary} />
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>{t('profile.mood')}</Text>
            </View>
            <View style={styles.vibeChips}>
              <MoodChip mood={mood} accentOverride={colors.primary} />
              {profile.traits.map(tr => (
                <View key={tr} style={[styles.traitChip, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}>
                  <Text style={[styles.traitText, { color: colors.foreground }]} numberOfLines={1}>{tr}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Stats */}
          <View style={[styles.statsRow, { borderColor: hasRegalia ? regaliaTheme.divider : colors.border, backgroundColor: hasRegalia ? regaliaTheme.inset : colors.card }]}>
            {([
              { icon: 'book-open', n: stories.length, label: t('publicProfile.stats.stories') },
              { icon: 'layers', n: outfits.length, label: t('components.profile.stats.outfits') },
              { icon: 'heart', n: totalLikes, label: t('publicProfile.stats.likes') },
              { icon: 'moon', n: level, label: t('publicProfile.stats.level') },
            ]).map((st, i) => (
              <React.Fragment key={st.label}>
                {i > 0 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
                <View style={styles.statItem}>
                  <Icon name={st.icon} size={13} color={i === 3 ? colors.gold : colors.mutedForeground} />
                  <Text style={[styles.statNum, { color: colors.foreground }]}>{st.n}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{st.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Founder / Beta spotlight (earned) */}
          {(isFounder || isBeta) && (() => {
            const badge = isFounder ? founderBadge : betaBadge;
            const cardColor = isFounder ? (hasRegalia ? regaliaTheme.gold : colors.gold) : colors.primary;
            return (
              <View style={[styles.panel, styles.spotlightRowPanel, { backgroundColor: hasRegalia ? regaliaTheme.insetAlt : colors.card, borderColor: `${cardColor}45` }]}>
                <View style={[styles.spotlightBadgeIcon, { backgroundColor: `${cardColor}16`, borderColor: `${cardColor}40` }]}>
                  <SpotlightBadgeMark imageUrl={badge?.imageUrl} isFounder={isFounder} color={cardColor} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.spotlightBadgeTitle, { color: cardColor }]}>{isFounder ? t('publicProfile.founderTitle') : t('publicProfile.betaPioneerTitle')}</Text>
                  <Text style={[styles.spotlightBadgeDesc, { color: colors.mutedForeground }]}>{isFounder ? t('publicProfile.founderDescription') : t('publicProfile.betaPioneerDescription')}</Text>
                </View>
              </View>
            );
          })()}

          {!isSelf && isFollowing && (
            <View style={[styles.panel, styles.notifyPanel, { backgroundColor: hasRegalia ? regaliaTheme.inset : colors.card, borderColor: hasRegalia ? regaliaTheme.divider : colors.border }]}>
              <Icon name="bell" size={14} color={colors.primary} />
              <Text style={[styles.notifyRowText, { color: colors.mutedForeground }]} numberOfLines={2}>
                {t('publicProfile.newPostsNotice', { name: profile.name })}
              </Text>
              <Switch
                value
                onValueChange={() => {}}
                trackColor={{ false: colors.border, true: `${colors.primary}90` }}
                thumbColor={colors.primary}
                style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
              />
            </View>
          )}

          {hasRegalia && <FounderAuroraCardFrame />}
          </View>

          {/* Gallery filter */}
          <View style={styles.galleryHead}>
            <Icon name="image" size={16} color={colors.primary} />
            <Text style={[styles.panelTitle, { color: colors.foreground, flex: 1 }]}>{t('profile.galleryUsage')}</Text>
          </View>
          <View style={[styles.galleryTabs, { backgroundColor: colors.muted }]}>
            {galleryTabs.map(tab => {
              const sel = galleryFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setGalleryFilter(tab.key)}
                  style={[styles.galleryTab, sel && { backgroundColor: colors.primary }]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: sel }}
                  testID={`public-gallery-tab-${tab.key}`}
                >
                  <Text style={[styles.galleryTabText, { color: sel ? colors.primaryForeground : colors.mutedForeground }]} numberOfLines={1}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* ── BODY ─────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.body,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {outfitsError && (
            <View style={[styles.inlineError, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.inlineErrorTitle, { color: colors.foreground }]}>{t('publicProfile.outfitsUnavailable')}</Text>
                <Text style={[styles.inlineErrorSub, { color: colors.mutedForeground }]}>{t('publicProfile.outfitsLoadError')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.inlineRetryBtn, { backgroundColor: aura.accent + '18', borderColor: aura.accent + '40' }]}
                onPress={loadOutfits}
                activeOpacity={0.75}
              >
                <Icon name="refresh-cw" size={12} color={aura.accent} />
                <Text style={[styles.inlineRetryText, { color: aura.accent }]}>{t('publicProfile.retry')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {booksError && (
            <View style={[styles.inlineError, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.inlineErrorTitle, { color: colors.foreground }]}>{t('publicProfile.booksUnavailable')}</Text>
                <Text style={[styles.inlineErrorSub, { color: colors.mutedForeground }]}>{t('publicProfile.booksLoadError')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.inlineRetryBtn, { backgroundColor: aura.accent + '18', borderColor: aura.accent + '40' }]}
                onPress={loadBooks}
                activeOpacity={0.75}
              >
                <Icon name="refresh-cw" size={12} color={aura.accent} />
                <Text style={[styles.inlineRetryText, { color: aura.accent }]}>{t('publicProfile.retry')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {storiesError && (
            <View style={[styles.inlineError, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.inlineErrorTitle, { color: colors.foreground }]}>{t('publicProfile.storiesUnavailable')}</Text>
                <Text style={[styles.inlineErrorSub, { color: colors.mutedForeground }]}>{t('publicProfile.storiesLoadError')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.inlineRetryBtn, { backgroundColor: aura.accent + '18', borderColor: aura.accent + '40' }]}
                onPress={loadStories}
                activeOpacity={0.75}
              >
                <Icon name="refresh-cw" size={12} color={aura.accent} />
                <Text style={[styles.inlineRetryText, { color: aura.accent }]}>{t('publicProfile.retry')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Single organized gallery ───────────────────────────── */}
          {galleryItems.length > 0 && (
            <View style={[styles.galleryGrid, { gap: GRID_GAP }]} testID="public-gallery-grid">
              {galleryItems.map(item => (
                <TouchableOpacity
                  key={item.key}
                  testID={item.testID}
                  disabled={item.disabled}
                  onPress={item.onPress}
                  activeOpacity={0.86}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  style={[styles.galleryTile, { width: tileW, height: tileW * 1.3, backgroundColor: colors.card, borderColor: item.current ? `${colors.gold}80` : colors.border }]}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit={item.kind === 'outfits' ? 'contain' : 'cover'} cachePolicy="memory-disk" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.galleryTileEmpty, { backgroundColor: `${colors.primary}14` }]}>
                      <Icon name={item.icon} size={20} color={colors.mutedForeground} />
                    </View>
                  )}
                  <LinearGradient colors={['transparent', 'rgba(8,8,20,0.82)']} style={styles.galleryTileShade}>
                    <Text style={styles.galleryTileTitle} numberOfLines={2}>{item.title}</Text>
                  </LinearGradient>
                  <View style={styles.galleryTileKind}>
                    <Icon name={item.current ? 'star' : item.icon} size={10} color={item.current ? '#E4C16F' : '#FFFFFF'} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Empty state when everything is empty (and no errors showing) */}
          {stories.length === 0 && videos.length === 0 && outfits.length === 0 && books.length === 0 && !profile.activeOutfit && !storiesError && !outfitsError && !booksError && (
            <View style={[styles.emptyState, { borderColor: aura.accent + '18' }]}>
              <Icon name="image" size={22} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {t('publicProfile.emptyContent', { name: profile.name })}
              </Text>
            </View>
          )}

          {/* Report link */}
          {!isSelf && (
            <TouchableOpacity
              style={styles.reportLink}
              onPress={() => setReportVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="flag" size={11} color="rgba(180,100,100,0.55)" />
              <Text style={styles.reportLinkText}>{t('discover.reportProfile')}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

      </Animated.ScrollView>

      {profile && (
        <ProfileCollapseBar
          scrollY={scrollY}
          collapseAt={compactBarAt}
          compactVisible={compactVisible}
          topInset={topPad}
          name={profile.name}
          avatarSlotOnly={!!anchor}
          levelLabel={`${t('publicProfile.levelShort')} ${level}`}
          goldColor={colors.gold}
          subtitle={profile.username ? `@${profile.username}` : null}
          avatarUri={profile.avatarUri ?? profile.activeOutfit?.imageUri}
          backgroundColor={colors.background}
          foregroundColor={colors.foreground}
          mutedColor={colors.mutedForeground}
          borderColor={colors.border}
          leftAction={
            <TouchableOpacity
              style={styles.compactAction}
              onPress={() => safeBack()}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t('common.goBack')}
              hitSlop={8}
            >
              <Icon name="arrow-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
          }
          rightActions={
            <>
              {!isSelf && (
                <TouchableOpacity
                  style={styles.compactAction}
                  onPress={() => router.push({ pathname: '/messages/[userId]', params: { userId: profile.userId, name: profile.name } } as never)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={t('publicProfile.sendMessage')}
                  hitSlop={8}
                >
                  <Icon name="message-circle" size={18} color={colors.foreground} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.compactAction}
                onPress={handleMore}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('publicProfile.report')}
                hitSlop={8}
              >
                <Icon name="more-horizontal" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </>
          }
        />
      )}

      <AvatarFlightOverlay
        anchor={anchor}
        scrollY={scrollY}
        range={profileCollapseAt}
        topInset={topPad}
        hasLeftAction
        boxSize={PROFILE_AVATAR_RENDER_BOUNDS}
        avatarSize={PUBLIC_PROFILE_AVATAR_SIZE}
        hidden={founderIntroVisible || moonlitMuseIntroVisible}
      >
        {decorationOpacity => (
          <AnimatedAvatarRing
            mood={mood}
            profile={profile}
            isFounder={isFounder}
            isBeta={isBeta}
            activeFrame={profile.activeFrame}
            decorationOpacity={decorationOpacity}
          />
        )}
      </AvatarFlightOverlay>

      <DiscoverVideoPlayerModal post={videoPost} onClose={() => setVideoPost(null)} />
      <ReportSheet
        visible={reportVisible}
        targetType="user"
        targetId={userId ?? ''}
        targetLabel={profile?.name}
        onClose={() => setReportVisible(false)}
      />
      {founderIntroVisible && (
        <FounderProfileIntro
          title={t('publicProfile.founderTitle')}
          closeLabel={t('common.cancel')}
          onComplete={() => setFounderIntroVisible(false)}
        />
      )}
      {moonlitMuseIntroVisible && (
        <MoonlitMuseIntro
          closeLabel={t('common.cancel')}
          onComplete={() => setMoonlitMuseIntroVisible(false)}
        />
      )}
      {cosmicArrivalVisible && (
        <CosmicProfileArrivalOverlay onComplete={() => setCosmicArrivalVisible(false)} />
      )}
    </View>
  );
}

function SpotlightBadgeMark({ imageUrl, isFounder, color }: {
  imageUrl?: string | null;
  isFounder: boolean;
  color: string;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showBadgeImage = Boolean(imageUrl && failedUri !== imageUrl);
  return (
    <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={isFounder ? 'star' : 'zap'} size={22} color={color} />
      {showBadgeImage && imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory-disk"
          onError={() => setFailedUri(imageUrl)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  compactAction: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  errorText: { fontSize: 14, fontFamily: 'Satoshi-Regular', textAlign: 'center' },
  backBtnErr: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, marginTop: 4,
  },
  backBtnErrText: { fontSize: 14, fontFamily: 'Satoshi-Medium' },

  // ── Banner
  banner: { width: '100%', position: 'relative' },

  topBtn: {
    position: 'absolute',
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.14)',
  },
  explorerBadge: {
    position: 'absolute',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  explorerBadgeText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },

  // Mood chip floating in banner
  moodFloat: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
  },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1.5, marginTop: 6,
  },
  roleBadgeText: { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },

  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  moodDot: { width: 7, height: 7, borderRadius: 3.5 },
  moodChipText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },

  // Avatar inside banner
  avatarInBanner: {
    width: PUBLIC_PROFILE_HALO_SIZE, height: PUBLIC_PROFILE_HALO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  quietHeader: { paddingHorizontal: 16, paddingBottom: 6, alignItems: 'center' },
  quietBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, height: 300, overflow: 'hidden' },
  quietTopRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  quietTopBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  explorerPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, minHeight: 28, maxWidth: 170 },
  avatarSlot: { width: PUBLIC_PROFILE_HALO_SIZE, height: PUBLIC_PROFILE_HALO_SIZE, alignItems: 'center', justifyContent: 'center', marginTop: 2, overflow: 'visible' },
  identityBlock: { width: '100%', alignItems: 'center', gap: 5, marginTop: 4 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  onlineText: { fontSize: 10.5, fontFamily: 'Satoshi-Medium' },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 2 },
  levelPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, minHeight: 28 },
  levelPillText: { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },
  xpRow: { width: '100%', maxWidth: 300, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  xpTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  xpFill: { height: 4, borderRadius: 2 },
  xpText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, minWidth: 44, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  actionText: { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  panelStack: { paddingHorizontal: 14, paddingTop: 10, gap: 10 },
  infoGroup: { gap: 10 },
  regaliaCard: { gap: 10, borderRadius: 22, borderWidth: 1.25, paddingHorizontal: 16, paddingVertical: 18, marginTop: 30, marginBottom: 34, marginHorizontal: 6 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  galleryTile: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  galleryTileEmpty: { alignItems: 'center', justifyContent: 'center' },
  galleryTileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 7, paddingTop: 18, paddingBottom: 6 },
  galleryTileTitle: { color: '#F4F1FA', fontSize: 11, lineHeight: 14, fontFamily: 'Satoshi-Bold' },
  galleryTileKind: { position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,8,20,0.55)' },
  panel: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 8, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle: { fontSize: 16, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  intention: { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  infoRow: { flexDirection: 'row', gap: 8 },
  infoRowNarrow: { flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  infoTile: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, borderWidth: 1, paddingHorizontal: 6, minHeight: 54 },
  infoTileNarrow: { flex: 0, flexBasis: '48%', maxWidth: '48%' },
  infoTileFull: { flex: 0, flexBasis: '100%', maxWidth: '100%' },
  infoIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 8.5, fontFamily: 'Satoshi-Bold', letterSpacing: 0.35, textTransform: 'uppercase' },
  infoValue: { fontSize: 11, fontFamily: 'Satoshi-Bold', marginTop: 1 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, minHeight: 26 },
  metaPillText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  vibeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  spotlightRowPanel: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifyPanel: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  galleryHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  galleryTabs: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  galleryTab: { flex: 1, minHeight: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  galleryTabText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  avatarCircle: {
    width: PUBLIC_PROFILE_AVATAR_SIZE,
    height: PUBLIC_PROFILE_AVATAR_SIZE,
    borderRadius: PUBLIC_PROFILE_AVATAR_SIZE / 2,
    borderWidth: 2.5, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1630',
  },
  avatarInitial: { fontSize: 34, fontFamily: 'Satoshi-Bold' },

  // ── Floating profile card
  profileCard: {
    marginTop: -40,
    marginHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    gap: 3,
  },
  regaliaNameRow: { minHeight: 34, gap: 8 },
  regaliaName: { fontSize: 22, letterSpacing: -0.45 },
  regaliaIdentityRow: { marginTop: 4, minHeight: 25 },
  regaliaXpPanel: {
    marginTop: 8,
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 15,
    borderWidth: 1,
  },
  publicIdentityRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  publicBadgeRow: { alignSelf: 'center', marginTop: 5, alignItems: 'center' },
  publicXpPanel: { width: '100%', maxWidth: 340, alignSelf: 'center', marginTop: 6, gap: 5 },
  publicMoodRow: { alignSelf: 'center', marginTop: 3 },
  regaliaMoodRow: { marginTop: 7 },
  regaliaDivider: {
    height: 1,
    marginTop: 10,
    marginBottom: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regaliaDividerGem: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  regaliaStatsRow: {
    marginHorizontal: 0,
    marginTop: 5,
    paddingHorizontal: 5,
    paddingVertical: 11,
    borderRadius: 17,
    borderWidth: 1,
  },
  regaliaSpotlightCard: {
    marginHorizontal: 0,
    marginTop: 9,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderWidth: 1,
    borderRadius: 18,
  },
  regaliaBadgeIcon: { borderRadius: 18, borderWidth: 1.5 },
  regaliaActionBtn: {
    marginHorizontal: 0,
    marginTop: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 15,
  },
  regaliaNotifyRow: {
    marginHorizontal: 0,
    marginTop: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 15,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  name: { flexShrink: 1, minWidth: 0, maxWidth: '88%', fontSize: 24, lineHeight: 29, fontFamily: 'Satoshi-Bold', letterSpacing: -0.5, textAlign: 'center' },
  profileLikesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, marginBottom: 3 },
  profileLikeButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(155,120,232,0.35)',
    backgroundColor: 'rgba(155,120,232,0.10)',
  },
  profileLikeButtonActive: { backgroundColor: 'rgba(244,177,213,0.14)', borderColor: 'rgba(244,177,213,0.4)' },
  profileLikeText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  profileLikeCount: { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  nameBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1,
  },
  verifiedBadge: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 5,
  },
  followPill: {
    marginLeft: 4,
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 18, borderWidth: 1,
  },
  followPillText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  handle: { fontSize: 13, fontFamily: 'Satoshi-Medium', marginTop: 1, textAlign: 'center' },
  bio: { fontSize: 14, lineHeight: 20, fontFamily: 'Satoshi-Medium' },

  traitsScroll: { marginTop: 8, marginHorizontal: -16 },
  traitsRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 2 },
  traitChip: {
    paddingHorizontal: 11, paddingVertical: 5, maxWidth: 180,
    borderRadius: 16, borderWidth: 1,
  },
  traitText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },

  metaRow: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 7, marginTop: 5,
  },
  detailsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6,
  },
  detailPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1,
  },
  detailPillEmoji: { fontSize: 12 },
  detailPillText:  { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  linksRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 7, paddingRight: 4, marginTop: 4,
  },
  linkPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1,
  },
  linkPillText: { fontSize: 12, fontFamily: 'Satoshi-Medium', maxWidth: 100 },

  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
  },
  statItem:    { flex: 1, alignItems: 'center', gap: 2 },
  statIcon:    { fontSize: 22, lineHeight: 26 },
  statNum:     { fontSize: 16, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  statLabel:   { fontSize: 10, fontFamily: 'Satoshi-Regular' },
  statDivider: { width: 1, marginVertical: 4 },

  // ── Founder / Beta badge spotlight card
  spotlightBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  spotlightBadgeIcon: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  spotlightBadgeTitle: {
    fontSize: 15, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2,
  },
  spotlightBadgeDesc: {
    fontSize: 11, fontFamily: 'Satoshi-Regular',
    lineHeight: 16, marginTop: 2,
  },

  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: -16,
    marginTop: 0,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  messageBtnText: { fontSize: 13, fontFamily: 'Satoshi-Bold' },

  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  notifyRowText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    lineHeight: 17,
  },

  // ── Body
  body: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },

  notifyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    padding: 13, borderRadius: 16, borderWidth: 1,
  },
  notifyText: { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 18 },

  // Spotlight card (current outfit)
  spotlightCard: {
    borderRadius: 20, borderWidth: 1, padding: 14,
  },
  sectionLabel: {
    fontSize: 10, fontFamily: 'Satoshi-Bold',
    letterSpacing: 1.4, textTransform: 'uppercase',
    marginBottom: 10,
  },
  spotlightRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  spotlightImgWrap: {
    width: 120, height: 144,
    borderRadius: 14, overflow: 'hidden',
  },
  spotlightImgGrad: { justifyContent: 'flex-end', padding: 8 },
  spotlightImgName: {
    fontSize: 11, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)', lineHeight: 14,
  },
  spotlightInfo: { flex: 1, gap: 6, paddingTop: 2 },
  spotlightAboutLabel: {
    fontSize: 9, fontFamily: 'Satoshi-Bold',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  spotlightDesc: {
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic', lineHeight: 19,
  },
  spotlightTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  spotlightTag: {
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 9, borderWidth: 1,
  },
  spotlightTagText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },

  // Horizontal sections
  hSection: { gap: 10 },
  hSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hSectionTitle: { fontSize: 15, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  hSectionCount: { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  hScrollContent: { gap: 10, paddingRight: 16 },

  hOutfitCard: {
    width: 100, height: 130,
    borderRadius: 14, overflow: 'hidden', borderWidth: 1,
    position: 'relative',
  },
  hOutfitName: {
    fontSize: 10, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)', lineHeight: 13,
  },
  hTagPill: {
    position: 'absolute', top: 7, left: 7,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  hTagPillText: {
    fontSize: 9, fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,200,255,0.9)',
  },

  hBookCard: {
    width: 110, height: 155,
    borderRadius: 14, overflow: 'hidden', borderWidth: 1,
    position: 'relative',
  },
  hBookTitle: {
    fontSize: 11, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)', lineHeight: 14,
    marginBottom: 3,
  },
  hBookMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hBookChapters: {
    fontSize: 10, fontFamily: 'Satoshi-Bold',
    color: 'rgba(200,184,232,0.8)',
  },

  hStoryCard: {
    width: 130, height: 168,
    borderRadius: 14, overflow: 'hidden', borderWidth: 1,
    position: 'relative',
  },
  hStoryTitle: {
    fontSize: 11, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)', lineHeight: 14,
    marginBottom: 5,
  },
  hStoryMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hStoryWitness: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hStoryWitnessText: {
    fontSize: 10, fontFamily: 'Satoshi-Bold',
    color: 'rgba(200,184,232,0.8)',
  },
  hMoodPill: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  hMoodPillText: { fontSize: 9, fontFamily: 'Satoshi-Bold' },

  emptyState: {
    alignItems: 'center', gap: 10,
    paddingVertical: 40, borderRadius: 16,
    borderWidth: 1, borderStyle: 'dashed',
  },
  emptyText: { fontSize: 13, fontFamily: 'Satoshi-Regular', textAlign: 'center' },

  // Inline section error
  inlineError: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  inlineErrorTitle: { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  inlineErrorSub:   { fontSize: 11, fontFamily: 'Satoshi-Regular' },
  inlineRetryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 12, borderWidth: 1,
  },
  inlineRetryText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  reportLink: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center', paddingVertical: 4, marginTop: 8,
  },
  reportLinkText: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(180,100,100,0.55)',
  },
});
