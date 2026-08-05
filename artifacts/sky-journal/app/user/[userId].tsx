import { Icon } from '@/components/Icon';
import { BadgeTray, type BadgeItem } from '@/components/profile/BadgeTray';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
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
import { SHADOW } from '@/constants/colors';
import { ReportSheet } from '@/components/ReportSheet';
import { WeatherWidget } from '@/components/WeatherWidget';

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

const ROLES = [
  { key: 'Collector', emoji: '🎁', color: '#C8A84B' },
  { key: 'Trader',    emoji: '🤝', color: '#78A8C8' },
  { key: 'Veteran',   emoji: '⭐', color: '#D4956A' },
  { key: 'Uber',      emoji: '👑', color: '#9B78E8' },
  { key: 'Solo',      emoji: '🌙', color: '#6080C0' },
];

const PARTICLE_XS    = [0.08, 0.19, 0.33, 0.47, 0.60, 0.72, 0.85, 0.93, 0.15, 0.55];
const PARTICLE_SIZES = [14,   10,   18,   12,   16,   9,    20,   11,   13,   15];

// ── Animated banner effects ───────────────────────────────────────────────────
function AuraBanner({
  mood,
  bannerH,
  isFounder,
  isBeta,
  children,
}: {
  mood: string;
  bannerH: number;
  isFounder?: boolean;
  isBeta?: boolean;
  children: React.ReactNode;
}) {
  const aura = MOOD_AURA[mood] ?? DEFAULT_AURA;
  const { width: W } = useWindowDimensions();

  // Orb breath animation
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  // Secondary drift
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [drift]);

  // Particles
  const particleAnims = useRef(
    PARTICLE_XS.map(() => ({ y: new Animated.Value(0), op: new Animated.Value(0) }))
  ).current;

  useEffect(() => {
    const H = bannerH + 40;
    const loops = particleAnims.slice(0, aura.count).map((p, i) => {
      p.y.setValue(-(i * (H / aura.count)));
      p.op.setValue(0);
      const loop = Animated.loop(Animated.sequence([
        Animated.delay(i * (aura.speed / aura.count)),
        Animated.parallel([
          Animated.timing(p.y,  { toValue: -H - 20, duration: aura.speed * 1.6, easing: Easing.linear, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.op, { toValue: 0.65, duration: aura.speed * 0.18, useNativeDriver: true }),
            Animated.timing(p.op, { toValue: 0.65, duration: aura.speed * 0.64, useNativeDriver: true }),
            Animated.timing(p.op, { toValue: 0,    duration: aura.speed * 0.18, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(p.y,  { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(p.op, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ]));
      loop.start();
      return loop;
    });
    return () => loops.forEach(l => l.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, bannerH]);

  const orbAScale   = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const orbAOpacity = breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.18, 0.42, 0.18] });
  const orbBScale   = drift.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.18] });
  const orbBOpacity = drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.10, 0.28, 0.10] });
  const orbBX       = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const orbCOpacity = breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, 0.30, 0.12] });
  const orbCX       = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  return (
    <View style={[styles.banner, { height: bannerH, overflow: 'hidden' }]}>
      {/* Mood gradient base */}
      <LinearGradient
        colors={aura.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />
      {/* Founder golden tint overlay */}
      {isFounder && (
        <LinearGradient
          colors={['#C8A84B33', '#8A682018', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
        />
      )}
      {/* Beta purple tint overlay */}
      {isBeta && !isFounder && (
        <LinearGradient
          colors={['#9B78E833', '#3A187820', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
        />
      )}

      {/* Animated orb A — large, left, breathes */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 10, left: -60,
          width: W * 0.70, height: W * 0.70, borderRadius: W * 0.35,
          backgroundColor: aura.orbs[0],
          transform: [{ scale: orbAScale }],
          opacity: orbAOpacity,
        }}
      />

      {/* Animated orb B — mid, right, drifts */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', bottom: 20, right: -30,
          width: W * 0.55, height: W * 0.55, borderRadius: W * 0.275,
          backgroundColor: aura.orbs[1] + '30',
          transform: [{ scale: orbBScale }, { translateX: orbBX }],
          opacity: orbBOpacity,
        }}
      />

      {/* Animated orb C — small, top right, drifts opposite */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 40, right: 30,
          width: 110, height: 110, borderRadius: 55,
          backgroundColor: aura.orbs[2],
          transform: [{ translateX: orbCX }],
          opacity: orbCOpacity,
        }}
      />

      {/* Floating particles */}
      {particleAnims.slice(0, aura.count).map((p, i) => (
        <Animated.Text
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 20,
            left: PARTICLE_XS[i % PARTICLE_XS.length] * W,
            fontSize: PARTICLE_SIZES[i % PARTICLE_SIZES.length],
            color: aura.accent,
            opacity: p.op,
            transform: [{ translateY: p.y }],
          }}
        >
          {aura.particle}
        </Animated.Text>
      ))}

      {children}
    </View>
  );
}

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
}: {
  mood: string;
  profile: PublicProfile;
  isFounder: boolean;
  isBeta:    boolean;
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

  const ringScale   = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, isFounder ? 1.06 : 1.10] });
  const ringOpacity = breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [isFounder ? 0.55 : 0.30, 1, isFounder ? 0.55 : 0.30] });
  const haloOpacity = breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, isFounder ? 0.55 : isBeta ? 0.50 : 0.38, 0.12] });
  const haloScale   = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, isFounder ? 1.28 : 1.20] });
  const spin        = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pulseScale  = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
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
      <View style={styles.avatarInBanner}>
        {/* Outer shimmer halo */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: 172, height: 172, borderRadius: 86,
          backgroundColor: founderGold + '14',
          transform: [{ scale: haloScale }],
          opacity: haloOpacity,
        }} />
        {/* Spark dots container (sized to match outer ring) */}
        <View pointerEvents="none" style={{ position: 'absolute', width: 152, height: 152, left: -10, top: -10 }}>
          <FounderSparks radius={76} color={founderGold} />
        </View>
        {/* Slow-spinning outer ring — thick gold */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: 148, height: 148, borderRadius: 74,
          borderWidth: 2.5,
          borderColor: founderGold,
          transform: [{ rotate: spin }],
          opacity: 0.75,
        }} />
        {/* Breathing solid ring — inner */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: 118, height: 118, borderRadius: 59,
          borderWidth: 3,
          borderColor: founderDeep,
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }} />
        {/* Pulse ring — energy burst */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: 118, height: 118, borderRadius: 59,
          borderWidth: 1.5,
          borderColor: founderGold,
          transform: [{ scale: pulseScale }],
          opacity: pulseOp,
        }} />
        {/* Avatar circle */}
        <View style={[styles.avatarCircle, { borderColor: founderGold, borderWidth: 3, backgroundColor: '#1A1408' }]}>
          {avatarSource ? (
            <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <Text style={[styles.avatarInitial, { color: founderGold }]}>{initial}</Text>
          )}
        </View>
      </View>
    );
  }

  if (isBeta) {
    return (
      <View style={styles.avatarInBanner}>
        {/* Outer halo */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: 165, height: 165, borderRadius: 82.5,
          backgroundColor: betaPurple + '18',
          transform: [{ scale: haloScale }],
          opacity: haloOpacity,
        }} />
        {/* Fast-spinning outer ring — purple dashed */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: 148, height: 148, borderRadius: 74,
          borderWidth: 2,
          borderColor: betaPurple + 'CC',
          borderStyle: 'dashed',
          transform: [{ rotate: spin }],
        }} />
        {/* Steady solid middle ring */}
        <View pointerEvents="none" style={{
          position: 'absolute',
          width: 130, height: 130, borderRadius: 65,
          borderWidth: 1.5,
          borderColor: betaDark + '99',
        }} />
        {/* Breathing solid inner ring */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: 118, height: 118, borderRadius: 59,
          borderWidth: 2.5,
          borderColor: betaPurple,
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }} />
        {/* Pulse ring */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          width: 118, height: 118, borderRadius: 59,
          borderWidth: 1.5,
          borderColor: betaPurple,
          transform: [{ scale: pulseScale }],
          opacity: pulseOp,
        }} />
        {/* Avatar circle */}
        <View style={[styles.avatarCircle, { borderColor: betaPurple, borderWidth: 3, backgroundColor: '#120A20' }]}>
          {avatarSource ? (
            <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <Text style={[styles.avatarInitial, { color: betaPurple }]}>{initial}</Text>
          )}
        </View>
      </View>
    );
  }

  // ── Normal user ring
  return (
    <View style={styles.avatarInBanner}>
      {/* Outer halo pulse */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 148, height: 148, borderRadius: 74,
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
          width: 128, height: 128, borderRadius: 64,
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
          width: 118, height: 118, borderRadius: 59,
          borderWidth: 2,
          borderColor: aura.accent,
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }}
      />
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
    </View>
  );
}

// ── Mood chip ─────────────────────────────────────────────────────────────────
function MoodChip({ mood }: { mood: string }) {
  const aura = MOOD_AURA[mood] ?? DEFAULT_AURA;
  return (
    <View style={[styles.moodChip, { backgroundColor: aura.accent + '18', borderColor: aura.accent + '40' }]}>
      <View style={[styles.moodDot, { backgroundColor: aura.accent }]} />
      <Text style={[styles.moodChipText, { color: aura.accent }]}>{mood}</Text>
    </View>
  );
}

const MOOD_COLORS: Record<string, string> = {
  Peaceful: '#8B7AB5', Joyful: '#D4A849', Melancholy: '#5D7BA5',
  Nostalgic: '#A5785D', Hopeful: '#6BA57A', Dreamy: '#9B7AB5',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fmtDate(_iso: string) {
  const d = new Date(_iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

interface ProfileLink {
  label:     string;
  url:       string;
  platform?: string;
}

function fmtBirthday(bd: string): string {
  try {
    const d = new Date(bd);
    if (isNaN(d.getTime())) return bd;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return bd; }
}

function platformEmoji(p?: string): string {
  const lc = p?.toLowerCase() ?? '';
  if (lc.includes('discord'))                            return '🎮';
  if (lc.includes('instagram'))                          return '📷';
  if (lc.includes('twitter') || lc.includes('x.com'))   return '𝕏';
  if (lc.includes('youtube'))                            return '📺';
  if (lc.includes('tiktok'))                             return '🎵';
  if (lc.includes('twitch'))                             return '💜';
  if (lc.includes('github'))                             return '🐙';
  return '🔗';
}

interface ActiveOutfit {
  id:          string;
  name:        string;
  description: string;
  story:       string;
  imageUri:    string | null;
  tags:        string[];
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
  isFollowing:      boolean;
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
  savedCount:     number;
  date:           string;
}

interface PublicOutfit {
  id:          string;
  name:        string;
  description: string;
  story:       string;
  imageUri:    string | null;
  tags:        string[];
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
  const { t }               = useTranslation();
  const insets              = useSafeAreaInsets();
  const { userId: meId }    = useAuth();
  const { followingIds, followUser, unfollowUser, blockedIds, blockUser, unblockUser } = useApp();

  const [profile,      setProfile]      = useState<PublicProfile | null>(null);
  const [stories,      setStories]      = useState<PublicStory[]>([]);
  const [outfits,      setOutfits]      = useState<PublicOutfit[]>([]);
  const [books,        setBooks]        = useState<PublicBook[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [storiesError, setStoriesError] = useState(false);
  const [outfitsError, setOutfitsError] = useState(false);
  const [booksError,   setBooksError]   = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const scaleAnim = useRef(new Animated.Value(0.97)).current;

  const isFollowing = followingIds.includes(userId ?? '');
  const isSelf      = meId === userId;
  const isBlocked   = blockedIds.includes(userId ?? '');

  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 80  : insets.bottom + 40;
  const bannerH   = topPad + 230;

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
      const stors = await apiFetch<PublicStory[]>(`/users/${userId}/stories`);
      setStories(stors);
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
    if (!userId) return;
    (async () => {
      const [profResult, storsResult, outsResult, booksResult] = await Promise.allSettled([
        apiFetch<PublicProfile>(`/users/${userId}`),
        apiFetch<PublicStory[]>(`/users/${userId}/stories`),
        apiFetch<PublicOutfit[]>(`/users/${userId}/outfits`),
        apiFetch<PublicBook[]>(`/users/${userId}/books`),
      ]);

      if (profResult.status === 'rejected') {
        const err = profResult.reason;
        const isBlocked = err instanceof ApiError && err.status === 403;
        setError(isBlocked ? 'This profile is unavailable.' : 'Could not load this profile.');
        setLoading(false);
        return;
      }

      setProfile(profResult.value);
      setStories(storsResult.status === 'fulfilled' ? storsResult.value : []);
      setStoriesError(storsResult.status === 'rejected');
      setOutfits(outsResult.status === 'fulfilled' ? outsResult.value : []);
      setOutfitsError(outsResult.status === 'rejected');
      setBooks(booksResult.status === 'fulfilled' ? booksResult.value : []);
      setBooksError(booksResult.status === 'rejected');
      setLoading(false);
      runEnterAnimation();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function handleFollow() {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isFollowing) unfollowUser(profile.userId);
    else             followUser(profile.userId);
  }

  function handleMore() {
    if (!profile || !userId) return;
    const blockOption = isBlocked
      ? {
          text: 'Unblock user',
          onPress: () => {
            Alert.alert(
              'Unblock user',
              `${profile.name} will be able to send you messages again.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Unblock',
                  onPress: () => unblockUser(userId),
                },
              ],
            );
          },
        }
      : {
          text: 'Block user',
          style: 'destructive' as const,
          onPress: () => {
            Alert.alert(
              'Block user',
              `${profile.name} will no longer be able to message you, and their posts will be hidden from your feed. Any existing follows will be removed.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
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
        { text: 'Report', onPress: () => setReportVisible(true) },
        blockOption,
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  const mood           = profile?.mood ?? 'Dreamy';
  const aura           = MOOD_AURA[mood] ?? DEFAULT_AURA;
  const _moodColor     = MOOD_COLORS[mood] ?? aura.accent;
  const userRole       = profile ? ROLES.find(r => r.key === profile.role) : undefined;
  const weatherQuery   = profile?.country ?? null;
  const totalWitnessed = stories.reduce((s, st) => s + st.witnessedCount, 0);
  const isTopExplorer  = totalWitnessed >= 10 || stories.length >= 3;
  const isFounder      = (profile?.badges ?? []).some(b => b.slug === 'founder');
  const isBeta         = (profile?.badges ?? []).some(b => b.slug === 'beta_tester');
  const founderBadge   = isFounder ? (profile?.badges ?? []).find(b => b.slug === 'founder') : null;
  const betaBadge      = isBeta    ? (profile?.badges ?? []).find(b => b.slug === 'beta_tester') : null;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Icon name="alert-circle" size={36} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
          {error ?? 'Profile not found.'}
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>

        {/* ── ANIMATED AURA BANNER ────────────────────────────────── */}
        <AuraBanner mood={mood} bannerH={bannerH} isFounder={isFounder} isBeta={isBeta}>
          {/* Back button */}
          <TouchableOpacity
            style={[styles.topBtn, { top: topPad + 10, left: 16, backgroundColor: 'rgba(0,0,0,0.45)' }]}
            onPress={() => safeBack()}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon name="arrow-left" size={17} color="rgba(220,210,255,0.92)" />
          </TouchableOpacity>

          {/* More / report / block button */}
          <TouchableOpacity
            style={[styles.topBtn, { top: topPad + 10, right: 16, backgroundColor: 'rgba(0,0,0,0.45)' }]}
            onPress={handleMore}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon name="more-horizontal" size={17} color="rgba(220,210,255,0.92)" />
          </TouchableOpacity>

          {/* Top Explorer badge */}
          {isTopExplorer && (
            <View style={[styles.explorerBadge, {
              top: topPad + 10,
              right: isSelf ? 60 : 62,
              backgroundColor: 'rgba(232,184,48,0.18)',
              borderColor: 'rgba(232,184,48,0.40)',
            }]}>
              <Text style={{ fontSize: 12 }}>🏆</Text>
              <Text style={[styles.explorerBadgeText, { color: '#E8B830' }]}>Top Explorer</Text>
            </View>
          )}

          {/* Mood label floating in banner */}
          <View style={[styles.moodFloat, { top: topPad + 14 }]}>
            <MoodChip mood={mood} />
          </View>

          {/* Avatar with animated aura rings */}
          <AnimatedAvatarRing mood={mood} profile={profile} isFounder={isFounder} isBeta={isBeta} />
        </AuraBanner>

        {/* ── FLOATING PROFILE CARD ───────────────────────────────── */}
        <Animated.View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.card,
              borderColor: isFounder ? '#C8A84B55' : isBeta ? '#9B78E855' : colors.border,
            },
            SHADOW.md,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
          ]}
        >
          {/* Name + badge */}
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]}>{profile.name}</Text>
            {isFounder && (
              <View style={[styles.verifiedBadge, { backgroundColor: '#C8A84B22', borderColor: '#C8A84B55' }]}>
                <Text style={{ fontSize: 11, color: '#C8A84B' }}>✦</Text>
              </View>
            )}
            {isBeta && !isFounder && (
              <View style={[styles.verifiedBadge, { backgroundColor: '#9B78E822', borderColor: '#9B78E855' }]}>
                <Text style={{ fontSize: 11 }}>⚗️</Text>
              </View>
            )}
            <View style={[styles.nameBadge, { backgroundColor: aura.accent + '20', borderColor: aura.accent + '40' }]}>
              <Text style={{ fontSize: 12 }}>{aura.particle}</Text>
            </View>
            {!isSelf && (
              <TouchableOpacity
                style={[
                  styles.followPill,
                  isFollowing
                    ? { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}40` }
                    : { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={handleFollow}
                activeOpacity={0.82}
              >
                <Text style={[styles.followPillText, { color: isFollowing ? colors.primary : '#fff' }]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* @handle + online status */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {profile.username ? (
              <Text style={[styles.handle, { color: aura.accent }]}>@{profile.username}</Text>
            ) : null}
            {profile.showOnlineStatus && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: profile.isOnline ? 'rgba(80,200,120,0.12)' : 'rgba(200,184,232,0.08)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: profile.isOnline ? 'rgba(80,200,120,0.30)' : 'rgba(200,184,232,0.15)' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: profile.isOnline ? '#4EC87A' : 'rgba(200,184,232,0.40)' }} />
                <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Medium', color: profile.isOnline ? '#4EC87A' : 'rgba(200,184,232,0.50)' }}>
                  {profile.isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            )}
          </View>

          {/* Active title */}
          {profile.activeTitle ? (
            <Text style={{ fontSize: 11, color: '#C8A84B', fontFamily: 'Satoshi-Bold', letterSpacing: 0.3, marginTop: 3 }}>
              ✦ {profile.activeTitle}
            </Text>
          ) : null}

          {/* Dynamic badges */}
          {(profile.badges ?? []).length > 0 && (
            <View style={{ marginTop: 6 }}>
              <BadgeTray badges={profile.badges ?? []} />
            </View>
          )}

          {/* Level + XP progress */}
          {(() => {
            const xp        = profile.stars ?? 0;
            const level     = Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
            const xpPct     = (xp % XP_PER_LEVEL) / XP_PER_LEVEL;
            return (
              <View style={{ marginTop: 6, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: aura.accent + '22', borderWidth: 1, borderColor: aura.accent + '44' }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: aura.accent, letterSpacing: 0.4 }}>Lv {level}</Text>
                  </View>
                  <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.45)' }}>
                    {xp % XP_PER_LEVEL} / {XP_PER_LEVEL} XP
                  </Text>
                </View>
                <View style={{ height: 3, borderRadius: 2, backgroundColor: aura.accent + '22', overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${Math.round(xpPct * 100)}%` as `${number}%`, borderRadius: 2, backgroundColor: aura.accent + 'AA' }} />
                </View>
              </View>
            );
          })()}

          {/* Today's intention (only shown if set today) */}
          {profile.intention && profile.intentionDate && (() => {
            const d = new Date();
            const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return profile.intentionDate === today;
          })() ? (
            <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,184,232,0.60)', marginTop: 4 }} numberOfLines={2}>
              ◌ {profile.intention}
            </Text>
          ) : null}

          {/* Vibe chip — mood shown in the card */}
          <View style={{ marginTop: 2 }}>
            <MoodChip mood={mood} />
          </View>

          {/* ── Meta row: role + weather/time ─────────────────── */}
          {(userRole || profile.timezone || weatherQuery) ? (
            <View style={styles.metaRow}>
              {userRole ? (
                <View style={[styles.roleBadge, { backgroundColor: userRole.color + '20', borderColor: userRole.color + '45' }]}>
                  <Text style={{ fontSize: 13 }}>{userRole.emoji}</Text>
                  <Text style={[styles.roleBadgeText, { color: userRole.color }]}>{userRole.key}</Text>
                </View>
              ) : null}
              <WeatherWidget
                query={weatherQuery}
                timezone={profile.timezone}
                accentColor={aura.accent}
                compact
              />
            </View>
          ) : null}

          {/* Trait chips horizontal scroll */}
          {profile.traits.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.traitsScroll}
              contentContainerStyle={styles.traitsRow}
            >
              {profile.traits.map(tr => (
                <View
                  key={tr}
                  style={[styles.traitChip, { backgroundColor: aura.accent + '14', borderColor: aura.accent + '30' }]}
                >
                  <Text style={[styles.traitText, { color: aura.accent }]}>{tr}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Birthday inline */}
          {profile.birthday ? (
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.60)', marginTop: 1 }}>
              🎂 {fmtBirthday(profile.birthday)}
            </Text>
          ) : null}

          {/* Country */}
          {profile.country ? (
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.55)', marginTop: 1 }}>
              📍 {profile.country}
            </Text>
          ) : null}

          {/* Bio */}
          {profile.bio ? (
            <Text style={[styles.bio, { color: colors.mutedForeground }]} numberOfLines={5}>
              {profile.bio}
            </Text>
          ) : null}

          {/* ── Social links ───────────────────────────────────── */}
          {profile.links && profile.links.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.linksRow}
            >
              {profile.links.map((link, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.linkPill, { backgroundColor: aura.accent + '10', borderColor: aura.accent + '35' }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Linking.openURL(link.url).catch(() => null);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 12 }}>{platformEmoji(link.platform)}</Text>
                  <Text style={[styles.linkPillText, { color: aura.accent }]} numberOfLines={1}>
                    {link.label}
                  </Text>
                  <Icon name="external-link" size={9} color={aura.accent + '80'} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          {/* Stats row — icon + colored number + label */}
          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>📖</Text>
              <Text style={[styles.statNum, { color: '#78A8D4' }]}>{stories.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>STORIES</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>🧥</Text>
              <Text style={[styles.statNum, { color: '#C8A84B' }]}>{outfits.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>OUTFITS</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>💗</Text>
              <Text style={[styles.statNum, { color: '#D878B0' }]}>{totalWitnessed}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>LIKES</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>{isFounder ? '👑' : isBeta ? '⚗️' : '✦'}</Text>
              <Text style={[styles.statNum, { color: isFounder ? '#C8A84B' : isBeta ? '#9B78E8' : colors.foreground }]}>
                {Math.floor((profile.stars ?? 0) / XP_PER_LEVEL) + 1}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>LEVEL</Text>
            </View>
          </View>

          {/* ── Founder / Beta spotlight card ──────────────────── */}
          {(isFounder || isBeta) && (() => {
            const badge       = isFounder ? founderBadge : betaBadge;
            const cardColor   = isFounder ? '#C8A84B' : '#9B78E8';
            const cardDark    = isFounder ? '#6B4A14' : '#3A1878';
            const icon        = isFounder ? '👑'       : '⚗️';
            const title       = isFounder ? 'Founder'  : 'Beta Pioneer';
            const description = isFounder
              ? 'Joined before launch. Thank you for believing in GameJo. ✨'
              : 'Helped shape GameJo during its early days. Thank you! 💜';
            return (
              <View style={[styles.spotlightBadgeCard, {
                backgroundColor: cardDark + '33',
                borderColor:     cardColor + '55',
              }]}>
                <LinearGradient
                  colors={[cardColor + '22', 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
                {/* Icon or badge image */}
                <View style={[styles.spotlightBadgeIcon, { backgroundColor: cardColor + '22', borderColor: cardColor + '55' }]}>
                  {badge?.imageUrl ? (
                    <Image source={{ uri: badge.imageUrl }} style={{ width: 44, height: 44 }} contentFit="contain" />
                  ) : (
                    <Text style={{ fontSize: 26 }}>{icon}</Text>
                  )}
                </View>
                {/* Text */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.spotlightBadgeTitle, { color: cardColor }]}>{title}</Text>
                  <Text style={[styles.spotlightBadgeDesc, { color: cardColor + 'BB' }]}>{description}</Text>
                </View>
              </View>
            );
          })()}

          {/* Message button — only visible when viewing someone else's profile */}
          {!isSelf && (
            <TouchableOpacity
              style={[styles.messageBtn, { borderColor: aura.accent + '55', backgroundColor: aura.accent + '10' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                router.push({ pathname: '/messages/[userId]', params: { userId: profile.userId, name: profile.name } } as any);
              }}
              activeOpacity={0.8}
            >
              <Icon name="message-circle" size={15} color={aura.accent} />
              <Text style={[styles.messageBtnText, { color: aura.accent }]}>Send Message</Text>
            </TouchableOpacity>
          )}

          {/* Notification toggle — shown when following someone else */}
          {!isSelf && isFollowing && (
            <View style={[styles.notifyRow, { borderTopColor: colors.border }]}>
              <Icon name="bell" size={14} color={aura.accent} />
              <Text style={[styles.notifyRowText, { color: colors.mutedForeground }]} numberOfLines={2}>
                You'll see new posts from {profile.name} in your Discover feed
              </Text>
              <Switch
                value
                onValueChange={() => {}}
                trackColor={{ false: colors.border, true: aura.accent + '90' }}
                thumbColor={aura.accent}
                style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
              />
            </View>
          )}
        </Animated.View>

        {/* ── BODY ─────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.body,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* (notification toggle moved into profile card) */}

          {/* ── CURRENT OUTFIT spotlight ─────────────────────────── */}
          {profile.activeOutfit && (
            <TouchableOpacity
              style={[styles.spotlightCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.sm]}
              onPress={() => {
                router.push({
                  pathname: '/user-outfit',
                  params: {
                    outfitName:     profile.activeOutfit!.name,
                    outfitDesc:     profile.activeOutfit!.description ?? '',
                    outfitStory:    profile.activeOutfit!.story ?? '',
                    outfitImage:    profile.activeOutfit!.imageUri ?? '',
                    outfitTags:     JSON.stringify(profile.activeOutfit!.tags),
                    outfitDate:     '',
                    authorUserId:   profile.userId,
                    authorName:     profile.name,
                    authorHandle:   profile.username ?? '',
                    authorBio:      profile.bio ?? '',
                    authorMood:     profile.mood ?? '',
                    authorTraits:   JSON.stringify(profile.traits),
                    allOutfitsJson: JSON.stringify([
                      { name: profile.activeOutfit!.name, description: profile.activeOutfit!.description ?? '', story: profile.activeOutfit!.story ?? '', imageUri: profile.activeOutfit!.imageUri ?? '', tags: profile.activeOutfit!.tags, date: '' },
                      ...outfits.map(o => ({ name: o.name, description: o.description, story: o.story, imageUri: o.imageUri ?? '', tags: o.tags, date: o.date })),
                    ]),
                    initialIndex:   '0',
                  },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any);
              }}
              activeOpacity={0.86}
            >
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Current Outfit</Text>
              <View style={styles.spotlightRow}>
                {/* Left: outfit image */}
                <View style={[styles.spotlightImgWrap, { backgroundColor: aura.accent + '18' }]}>
                  {profile.activeOutfit.imageUri ? (
                    <Image
                      source={{ uri: profile.activeOutfit.imageUri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <LinearGradient
                      colors={[aura.accent + '50', aura.accent + '18']}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(8,6,22,0.85)']}
                    style={[StyleSheet.absoluteFill, styles.spotlightImgGrad]}
                  >
                    <Text style={styles.spotlightImgName} numberOfLines={2}>{profile.activeOutfit.name}</Text>
                  </LinearGradient>
                </View>
                {/* Right: info */}
                <View style={styles.spotlightInfo}>
                  <Text style={[styles.spotlightAboutLabel, { color: colors.mutedForeground + '88' }]}>About this look</Text>
                  <Text style={[styles.spotlightDesc, { color: colors.mutedForeground }]} numberOfLines={3}>
                    {profile.activeOutfit.description || profile.activeOutfit.name}
                  </Text>
                  <View style={styles.spotlightTags}>
                    {(profile.activeOutfit.tags ?? []).slice(0, 3).map(tag => (
                      <View key={tag} style={[styles.spotlightTag, { backgroundColor: aura.accent + '14', borderColor: aura.accent + '28' }]}>
                        <Text style={[styles.spotlightTagText, { color: aura.accent }]}>{tag}</Text>
                      </View>
                    ))}
                    {(profile.activeOutfit.tags ?? []).length === 0 && (
                      <View style={[styles.spotlightTag, { backgroundColor: colors.gold + '14', borderColor: colors.gold + '28' }]}>
                        <Text style={[styles.spotlightTagText, { color: colors.gold }]}>Outfit</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* ── OTHER OUTFITS horizontal row ──────────────────────── */}
          {outfitsError && (
            <View style={[styles.inlineError, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.inlineErrorTitle, { color: colors.foreground }]}>Outfits unavailable</Text>
                <Text style={[styles.inlineErrorSub, { color: colors.mutedForeground }]}>Couldn't load outfits right now</Text>
              </View>
              <TouchableOpacity
                style={[styles.inlineRetryBtn, { backgroundColor: aura.accent + '18', borderColor: aura.accent + '40' }]}
                onPress={loadOutfits}
                activeOpacity={0.75}
              >
                <Icon name="refresh-cw" size={12} color={aura.accent} />
                <Text style={[styles.inlineRetryText, { color: aura.accent }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {!outfitsError && outfits.length > 0 && (
            <View style={styles.hSection}>
              <View style={styles.hSectionHeader}>
                <Text style={[styles.hSectionTitle, { color: colors.foreground }]}>Other Outfits</Text>
                <Text style={[styles.hSectionCount, { color: colors.mutedForeground }]}>{outfits.length}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScrollContent}
              >
                {outfits.map((outfit, oIdx) => (
                  <TouchableOpacity
                    key={outfit.id}
                    style={[styles.hOutfitCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const _allList = [
                        ...(profile.activeOutfit ? [{ name: profile.activeOutfit.name, description: profile.activeOutfit.description ?? '', story: profile.activeOutfit.story ?? '', imageUri: profile.activeOutfit.imageUri ?? '', tags: profile.activeOutfit.tags, date: '' }] : []),
                        ...outfits.map(o => ({ name: o.name, description: o.description, story: o.story, imageUri: o.imageUri ?? '', tags: o.tags, date: o.date })),
                      ];
                      router.push({
                        pathname: '/user-outfit',
                        params: {
                          outfitName:     outfit.name,
                          outfitDesc:     outfit.description ?? '',
                          outfitStory:    outfit.story ?? '',
                          outfitImage:    outfit.imageUri ?? '',
                          outfitTags:     JSON.stringify(outfit.tags),
                          outfitDate:     outfit.date,
                          authorUserId:   profile.userId,
                          authorName:     profile.name,
                          authorHandle:   profile.username ?? '',
                          authorBio:      profile.bio ?? '',
                          authorMood:     profile.mood ?? '',
                          authorTraits:   JSON.stringify(profile.traits),
                          allOutfitsJson: JSON.stringify(_allList),
                          initialIndex:   String(profile.activeOutfit ? oIdx + 1 : oIdx),
                        },
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      } as any);
                    }}
                    activeOpacity={0.85}
                  >
                    {outfit.imageUri ? (
                      <Image
                        source={{ uri: outfit.imageUri }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <LinearGradient
                        colors={[aura.accent + '50', aura.accent + '18']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <LinearGradient
                      colors={['transparent', 'rgba(8,6,22,0.90)']}
                      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}
                    >
                      <Text style={styles.hOutfitName} numberOfLines={2}>{outfit.name}</Text>
                    </LinearGradient>
                    {outfit.tags.length > 0 && (
                      <View style={[styles.hTagPill, { backgroundColor: 'rgba(8,6,22,0.72)' }]}>
                        <Text style={styles.hTagPillText}>{outfit.tags[0]}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── BOOKS horizontal row ──────────────────────────────── */}
          {booksError && (
            <View style={[styles.inlineError, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.inlineErrorTitle, { color: colors.foreground }]}>Books unavailable</Text>
                <Text style={[styles.inlineErrorSub, { color: colors.mutedForeground }]}>Couldn't load books right now</Text>
              </View>
              <TouchableOpacity
                style={[styles.inlineRetryBtn, { backgroundColor: aura.accent + '18', borderColor: aura.accent + '40' }]}
                onPress={loadBooks}
                activeOpacity={0.75}
              >
                <Icon name="refresh-cw" size={12} color={aura.accent} />
                <Text style={[styles.inlineRetryText, { color: aura.accent }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {!booksError && books.length > 0 && (
            <View style={styles.hSection}>
              <View style={styles.hSectionHeader}>
                <Text style={[styles.hSectionTitle, { color: colors.foreground }]}>Books</Text>
                <Text style={[styles.hSectionCount, { color: colors.mutedForeground }]}>{books.length}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScrollContent}
              >
                {books.map(book => (
                  <TouchableOpacity
                    key={book.id}
                    style={[styles.hBookCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onPress={() => router.push({ pathname: '/book-public', params: { bookId: book.id } } as any)}
                    activeOpacity={0.86}
                  >
                    {book.coverImageUri ? (
                      <Image
                        source={{ uri: book.coverImageUri }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <LinearGradient
                        colors={[aura.accent + '60', aura.accent + '20']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <LinearGradient
                      colors={['transparent', 'rgba(8,6,22,0.92)']}
                      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}
                    >
                      <Text style={styles.hBookTitle} numberOfLines={2}>{book.title}</Text>
                      <View style={styles.hBookMeta}>
                        <Icon name="book-open" size={9} color="rgba(200,184,232,0.75)" />
                        <Text style={styles.hBookChapters}>
                          {book.chapterCount} {book.chapterCount === 1 ? 'ch' : 'chs'}
                        </Text>
                      </View>
                    </LinearGradient>
                    {book.genre ? (
                      <View style={[styles.hTagPill, { backgroundColor: 'rgba(8,6,22,0.72)' }]}>
                        <Text style={styles.hTagPillText}>{book.genre}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── STORIES horizontal row ─────────────────────────────── */}
          {storiesError && (
            <View style={[styles.inlineError, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.inlineErrorTitle, { color: colors.foreground }]}>Stories unavailable</Text>
                <Text style={[styles.inlineErrorSub, { color: colors.mutedForeground }]}>Couldn't load stories right now</Text>
              </View>
              <TouchableOpacity
                style={[styles.inlineRetryBtn, { backgroundColor: aura.accent + '18', borderColor: aura.accent + '40' }]}
                onPress={loadStories}
                activeOpacity={0.75}
              >
                <Icon name="refresh-cw" size={12} color={aura.accent} />
                <Text style={[styles.inlineRetryText, { color: aura.accent }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {!storiesError && stories.length > 0 && (
            <View style={styles.hSection}>
              <View style={styles.hSectionHeader}>
                <Text style={[styles.hSectionTitle, { color: colors.foreground }]}>Stories</Text>
                <Text style={[styles.hSectionCount, { color: colors.mutedForeground }]}>{stories.length}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScrollContent}
              >
                {stories.map(story => {
                  const mc         = MOOD_COLORS[story.mood] ?? aura.accent;
                  const firstPanel = story.panels[0];
                  return (
                    <TouchableOpacity
                      key={story.id}
                      style={[styles.hStoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onPress={() => router.push({ pathname: '/story/[id]', params: { id: story.id, source: 'discover' } } as any)}
                      activeOpacity={0.86}
                    >
                      {firstPanel?.imageUri ? (
                        <Image
                          source={{ uri: firstPanel.imageUri }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <LinearGradient
                          colors={[mc + '55', mc + '18']}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(8,6,22,0.88)']}
                        style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}
                      >
                        <Text style={styles.hStoryTitle} numberOfLines={2}>{story.chapterTitle}</Text>
                        <View style={styles.hStoryMeta}>
                          <View style={styles.hStoryWitness}>
                            <Icon name="eye" size={10} color="rgba(200,184,232,0.75)" />
                            <Text style={styles.hStoryWitnessText}>{story.witnessedCount}</Text>
                          </View>
                          <View style={[styles.hMoodPill, { backgroundColor: mc + '28' }]}>
                            <Text style={[styles.hMoodPillText, { color: mc }]}>{story.mood}</Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Empty state when everything is empty (and no errors showing) */}
          {stories.length === 0 && outfits.length === 0 && books.length === 0 && !profile.activeOutfit && !storiesError && !outfitsError && !booksError && (
            <View style={[styles.emptyState, { borderColor: aura.accent + '18' }]}>
              <Text style={{ fontSize: 24 }}>{aura.particle}</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {profile.name} hasn't shared anything yet
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

      </ScrollView>

      <ReportSheet
        visible={reportVisible}
        targetType="user"
        targetId={userId ?? ''}
        targetLabel={profile?.name}
        onClose={() => setReportVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
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
    position: 'absolute',
    bottom: 32, left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 104, height: 104, borderRadius: 52,
    borderWidth: 2.5, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1630',
  },
  avatarInitial: { fontSize: 34, fontFamily: 'Satoshi-Bold' },

  // ── Floating profile card
  profileCard: {
    marginTop: -44,
    marginHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: { fontSize: 19, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
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
    marginLeft: 'auto',
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 18, borderWidth: 1,
  },
  followPillText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  handle: { fontSize: 13, fontFamily: 'Satoshi-Medium', marginTop: 1 },
  bio: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic', lineHeight: 17,
    marginTop: 2,
  },

  traitsScroll: { marginTop: 8, marginHorizontal: -16 },
  traitsRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 2 },
  traitChip: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 16, borderWidth: 1,
  },
  traitText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 5,
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
    flexDirection: 'row', gap: 7, paddingRight: 4, marginTop: 4,
  },
  linkPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1,
  },
  linkPillText: { fontSize: 12, fontFamily: 'Satoshi-Medium', maxWidth: 100 },

  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginHorizontal: -16,
    marginTop: 10,
    paddingVertical: 12,
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
