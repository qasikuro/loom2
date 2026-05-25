import { Icon } from '@/components/Icon';
import { MoodBadge } from '@/components/MoodBadge';
import { useAuth, useUser } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { persistImageUri } from '@/utils/persistImage';

import { Images } from '@/assets/images';
import { apiFetch, useApp, type GalleryPhoto, type Outfit, type Story } from '@/context/AppContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeatherWidget } from '@/components/WeatherWidget';

// ── Helpers ────────────────────────────────────────────────────────────────────

const BG_MAP: Record<string, any> = {
  bg1: Images.story_bg1, bg2: Images.story_bg2,
  bg3: Images.story_bg3, char: Images.character_default,
};
function getCover(story: Story) {
  const p = story.panels[0];
  if (!p) return null;
  if (p.imageUri) return { uri: p.imageUri };
  if (p.bgPreset && BG_MAP[p.bgPreset]) return BG_MAP[p.bgPreset];
  return null;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

// ── Social platforms ────────────────────────────────────────────────────────────
interface SocialPlatform {
  key:    string;
  label:  string;
  icon:   string;
  color:  string;
  prefix: string;
  placeholder: string;
}
const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'instagram', label: 'Instagram', icon: '📸', color: '#E1306C', prefix: 'https://instagram.com/',       placeholder: 'your_handle' },
  { key: 'tiktok',    label: 'TikTok',    icon: '🎵', color: '#010101', prefix: 'https://tiktok.com/@',        placeholder: 'yourhandle' },
  { key: 'twitter',   label: 'X / Twitter', icon: '✕', color: '#1A8CD8', prefix: 'https://x.com/',            placeholder: 'yourhandle' },
  { key: 'youtube',   label: 'YouTube',   icon: '▶',  color: '#FF0000', prefix: 'https://youtube.com/@',      placeholder: 'yourchannel' },
  { key: 'pinterest', label: 'Pinterest', icon: '📌', color: '#E60023', prefix: 'https://pinterest.com/',      placeholder: 'yourprofile' },
  { key: 'twitch',    label: 'Twitch',    icon: '🎮', color: '#9146FF', prefix: 'https://twitch.tv/',         placeholder: 'yourchannel' },
  { key: 'spotify',   label: 'Spotify',   icon: '🎧', color: '#1DB954', prefix: 'https://open.spotify.com/user/', placeholder: 'userid' },
  { key: 'snapchat',  label: 'Snapchat',  icon: '👻', color: '#FFCC00', prefix: 'https://snapchat.com/add/',  placeholder: 'yourhandle' },
  { key: 'discord',   label: 'Discord',   icon: '💬', color: '#5865F2', prefix: 'https://discord.gg/',        placeholder: 'invite-code' },
  { key: 'bereal',    label: 'BeReal',    icon: '📷', color: '#3D3D3D', prefix: 'https://bere.al/',           placeholder: 'yourhandle' },
  { key: 'other',     label: 'Other',     icon: '🔗', color: '#6B5B95', prefix: '',                           placeholder: 'https://...' },
];

function getPlatform(key: string | undefined) {
  return SOCIAL_PLATFORMS.find(p => p.key === key) ?? null;
}
function extractHandle(url: string, prefix: string): string {
  if (!prefix || !url.startsWith(prefix)) return url;
  return url.slice(prefix.length).replace(/^@/, '').replace(/\/$/, '');
}

const ATTRIBUTE_SUGGESTIONS = [
  'Dreamer', 'Curious', 'Kind', 'Loner', 'Brave', 'Gentle',
  'Wanderer', 'Silent', 'Joyful', 'Nostalgic', 'Hopeful', 'Mystic',
  'Observer', 'Poet', 'Seeker', 'Free Spirit',
];

const ROLES = [
  { key: 'Collector', emoji: '🎁', color: '#C8A84B', hint: 'Gathers moments & items' },
  { key: 'Trader',    emoji: '🤝', color: '#78A8C8', hint: 'Connects & exchanges' },
  { key: 'Veteran',   emoji: '⭐', color: '#D4956A', hint: 'Long-time wanderer' },
  { key: 'Uber',      emoji: '👑', color: '#9B78E8', hint: 'Sky legend' },
  { key: 'Solo',      emoji: '🌙', color: '#6080C0', hint: 'Lone spirit' },
] as const;

const MOOD_COLORS: Record<string, string> = {
  Peaceful: '#5B9BB5', Joyful: '#D4A849', Melancholy: '#5D7BA5',
  Nostalgic: '#A5785D', Hopeful: '#6BA57A', Dreamy: '#9B7AB5',
  Romantic: '#B86098', Chaotic: '#B85830', Soft: '#7B6BAA',
  Adventurous: '#3A9060',
};

// ── Mood aura palette map ──────────────────────────────────────────────────────
type AuraData = {
  gradient: [string, string, string];
  overlay:  [string, string, string];
  accent:   string;
  particle: string;
  speed:    number;
  count:    number;
};
const MOOD_AURA: Record<string, AuraData> = {
  Hopeful:     { gradient: ['#131A0E','#1A2614','#20301A'], overlay: ['#1C2A16','#243020','#2A3826'], accent: '#C8A84B', particle: '✦', speed: 3800, count: 6  },
  Peaceful:    { gradient: ['#0C1A24','#10202E','#162838'], overlay: ['#122232','#18283A','#1E2E42'], accent: '#78A8C8', particle: '✧', speed: 5200, count: 5  },
  Lonely:      { gradient: ['#0C0C1E','#101226','#141830'], overlay: ['#14162C','#181C34','#1C2238'], accent: '#7090C0', particle: '·', speed: 7000, count: 4  },
  Dreamy:      { gradient: ['#120A2A','#1A1240','#221852'], overlay: ['#1C1640','#241E52','#2A2460'], accent: '#B89AE8', particle: '⋆', speed: 5500, count: 8  },
  Romantic:    { gradient: ['#1C0A12','#260E1E','#30142A'], overlay: ['#261430','#301A3A','#381E44'], accent: '#D878B0', particle: '◦', speed: 4200, count: 6  },
  Soft:        { gradient: ['#140A1E','#1C102E','#22163A'], overlay: ['#1E1438','#261A44','#2C204C'], accent: '#C8A0D8', particle: '○', speed: 6000, count: 5  },
  Chaotic:     { gradient: ['#1C0804','#280C06','#34100A'], overlay: ['#281008','#341408','#3E180C'], accent: '#E8784A', particle: '✸', speed: 1800, count: 10 },
  Joyful:      { gradient: ['#081408','#0E1E0E','#16281A'], overlay: ['#102014','#181E10','#1C2A1A'], accent: '#70C888', particle: '★', speed: 3000, count: 7  },
  Adventurous: { gradient: ['#0A160A','#101C0E','#162416'], overlay: ['#142018','#1A2818','#202E22'], accent: '#6AC888', particle: '↑', speed: 2500, count: 8  },
  Grateful:    { gradient: ['#1A0C18','#221020','#2A162C'], overlay: ['#221430','#2C1A38','#321E40'], accent: '#D878B0', particle: '✿', speed: 4500, count: 6  },
};
const DEFAULT_AURA: AuraData = {
  gradient: ['#1D1A2E','#272450','#2E2A58'],
  overlay:  ['#22203A','#2C2A5A','#342E62'],
  accent: '#9B78E8', particle: '✦', speed: 4500, count: 6,
};
const PARTICLE_XS    = [0.07, 0.20, 0.34, 0.50, 0.63, 0.76, 0.87, 0.94, 0.13, 0.57];
const PARTICLE_SIZES = [16,   11,   20,   14,   12,   18,   10,   22,   15,   13];

// ── Mood orbs inline picker ────────────────────────────────────────────────────
const MOOD_ORBS = [
  { key: 'Hopeful',  accent: '#C8A84B' }, { key: 'Peaceful', accent: '#78A8C8' },
  { key: 'Dreamy',   accent: '#B89AE8' }, { key: 'Lonely',   accent: '#7090C0' },
  { key: 'Soft',     accent: '#C8A0D8' }, { key: 'Romantic', accent: '#D878B0' },
  { key: 'Chaotic',  accent: '#E8784A' }, { key: 'Joyful',   accent: '#70C888' },
];
function MoodOrbPicker({ currentMood, onSelect }: { currentMood: string; onSelect: (m: string) => void }) {
  const scales = useRef(MOOD_ORBS.map(() => new Animated.Value(1))).current;
  function select(key: string, idx: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(scales[idx], { toValue: 1.4, tension: 300, friction: 5, useNativeDriver: true }),
      Animated.spring(scales[idx], { toValue: 1,   tension: 180, friction: 6, useNativeDriver: true }),
    ]).start();
    onSelect(key);
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 2, flexWrap: 'wrap' }}>
      <Text style={{ fontSize: 9, color: 'rgba(200,184,232,0.40)', fontFamily: 'Satoshi-Bold', letterSpacing: 1.3, marginRight: 1 }}>
        VIBE
      </Text>
      {MOOD_ORBS.map(({ key, accent }, idx) => {
        const sel = currentMood === key;
        return (
          <Animated.View key={key} style={{ transform: [{ scale: scales[idx] }] }}>
            <TouchableOpacity
              style={{
                width: sel ? 26 : 20, height: sel ? 26 : 20, borderRadius: 13,
                backgroundColor: accent, opacity: sel ? 1 : 0.30,
                borderWidth: sel ? 2 : 0, borderColor: 'rgba(255,255,255,0.80)',
              }}
              onPress={() => select(key, idx)}
              activeOpacity={0.75}
            />
          </Animated.View>
        );
      })}
      <Text style={{ fontSize: 11, color: 'rgba(200,184,232,0.65)', fontFamily: 'Satoshi-Medium', marginLeft: 2, fontStyle: 'italic' }}>
        {currentMood}
      </Text>
    </View>
  );
}

// ── Breathing avatar ring ──────────────────────────────────────────────────────
function BreathingAvatarRing({ mood }: { mood: string }) {
  const aura    = MOOD_AURA[mood] ?? DEFAULT_AURA;
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);
  const scale   = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.18, 0.80, 0.18] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: -7, left: -7, right: -7, bottom: -7,
        borderRadius: 48, borderWidth: 2.5, borderColor: aura.accent,
        transform: [{ scale }], opacity,
      }}
    />
  );
}

// ── Character aura header ──────────────────────────────────────────────────────
function CharacterAuraHeader({ mood, paddingTop, children }: {
  mood: string; paddingTop: number; children: React.ReactNode;
}) {
  const aura   = MOOD_AURA[mood] ?? DEFAULT_AURA;
  const { width: screenW } = useWindowDimensions();
  const breatheAnim   = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(
    PARTICLE_XS.map(() => ({ y: new Animated.Value(0), op: new Animated.Value(0) }))
  ).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breatheAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breatheAnim, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breatheAnim]);

  useEffect(() => {
    const H = 280;
    const loops = particleAnims.slice(0, aura.count).map((p, i) => {
      p.y.setValue(-(i * (H / aura.count)));
      p.op.setValue(0);
      const loop = Animated.loop(Animated.sequence([
        Animated.delay(i * (aura.speed / aura.count)),
        Animated.parallel([
          Animated.timing(p.y,  { toValue: -H - 20, duration: aura.speed * 1.5, easing: Easing.linear, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.op, { toValue: 0.70, duration: aura.speed * 0.18, useNativeDriver: true }),
            Animated.timing(p.op, { toValue: 0.70, duration: aura.speed * 0.64, useNativeDriver: true }),
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
  }, [mood]);

  const glowOpacity    = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.06, 0.18, 0.06] });
  const glowScale      = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.80, 1.18] });
  const glow2Opacity   = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.03, 0.12, 0.03] });
  const cornerOpacity  = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.22, 0.08] });
  const corner2Opacity = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.05, 0.15, 0.05] });

  return (
    <View style={[styles.profileHeader, { paddingTop, overflow: 'hidden' }]}>
      {/* Dark atmospheric base */}
      <LinearGradient colors={aura.gradient} style={StyleSheet.absoluteFill} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} />

      {/* Outer soft halo (larger, lower opacity) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: paddingTop * 0.1,
          left: -screenW * 0.1,
          width: screenW * 1.2,
          height: screenW * 1.2,
          borderRadius: screenW * 0.6,
          backgroundColor: aura.accent,
          opacity: glow2Opacity,
          transform: [{ scale: glowScale }],
        }}
      />
      {/* Inner bright core glow */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: paddingTop * 0.4,
          left: screenW * 0.15,
          width: screenW * 0.70,
          height: screenW * 0.70,
          borderRadius: screenW * 0.35,
          backgroundColor: aura.accent,
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }}
      />
      {/* Top-right accent corner */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: -40, right: -40,
          width: 180, height: 180, borderRadius: 90,
          backgroundColor: aura.accent,
          opacity: cornerOpacity,
        }}
      />
      {/* Bottom-left counter-glow */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', bottom: -30, left: -30,
          width: 130, height: 130, borderRadius: 65,
          backgroundColor: aura.accent,
          opacity: corner2Opacity,
        }}
      />

      {particleAnims.slice(0, aura.count).map((p, i) => (
        <Animated.Text
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute', bottom: 28,
            left: PARTICLE_XS[i % PARTICLE_XS.length] * screenW,
            fontSize: PARTICLE_SIZES[i % PARTICLE_SIZES.length],
            color: aura.accent, opacity: p.op,
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

// ── Outfit grid card (individual, animated) ────────────────────────────────────

function OutfitGridCard({
  outfit,
  isActive,
  cardW,
  onPress,
}: {
  outfit:   Outfit;
  isActive: boolean;
  cardW:    number;
  onPress:  () => void;
}) {
  const colors = useColors();
  const scale  = useRef(new Animated.Value(1)).current;
  const cardH  = Math.round(cardW * 1.25);

  return (
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, tension: 200, friction: 8 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 8 }).start()}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.outfitGridCard,
          { width: cardW, height: cardH, borderColor: isActive ? colors.primary : colors.border },
          isActive && { borderWidth: 2 },
          { transform: [{ scale }] },
          SHADOW.xs,
        ]}
      >
        {outfit.imageUri ? (
          <Image source={{ uri: outfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.primary}14`, alignItems: 'center', justifyContent: 'center', gap: 4 }]}>
            <Icon name="camera" size={20} color={`${colors.primary}55`} />
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Medium', color: `${colors.primary}55` }}>Add photo</Text>
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={styles.outfitGridGrad}
        />
        {isActive && (
          <View style={[styles.outfitActiveBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.outfitActiveBadgeText}>✦</Text>
          </View>
        )}
        <Text style={styles.outfitGridName} numberOfLines={1}>{outfit.name}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Theme toggle ───────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { themeMode, setThemeMode } = useTheme();
  const colors = useColors();

  const OPTIONS: { mode: ThemeMode; icon: string; label: string }[] = [
    { mode: 'light',  icon: 'sun',     label: 'Light' },
    { mode: 'system', icon: 'monitor', label: 'Auto'  },
    { mode: 'dark',   icon: 'moon',    label: 'Dark'  },
  ];

  return (
    <View style={[styles.themeToggleRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      {OPTIONS.map(opt => {
        const active = themeMode === opt.mode;
        return (
          <TouchableOpacity
            key={opt.mode}
            style={[
              styles.themeOption,
              active && { backgroundColor: colors.card, borderColor: `${colors.primary}40` },
              !active && { borderColor: 'transparent' },
            ]}
            onPress={() => { Haptics.selectionAsync(); setThemeMode(opt.mode); }}
            activeOpacity={0.75}
          >
            <Icon name={opt.icon as any} size={14} color={active ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.themeOptionText, { color: active ? colors.primary : colors.mutedForeground }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function CharacterScreen() {
  const colors  = useColors();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const insets  = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { character, setCharacter, outfits, stories, activeOutfitId, setActiveOutfitId, deleteOutfit,
          gallery, galleryUsage, addGalleryPhoto, deleteGalleryPhoto } = useApp();
  const moodAccent = MOOD_COLORS[character.mood ?? 'Dreamy'] ?? '#9B7AB5';
  const { signOut } = useAuth();
  const { user }    = useUser();

  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 120;

  // Outfit grid card width: 2 cols, 20px side padding, 10px gap
  const gridGap  = 10;
  const gridPad  = 20;
  const cardW    = Math.floor((screenW - gridPad * 2 - gridGap) / 2);

  // ── Avatar glow animation ──────────────────────────────────────────────────
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(glowAnim, { toValue: 0, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const glowScale   = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0,  1.14] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });

  // ── Gallery state ──────────────────────────────────────────────────────────
  const galCols  = 3;
  const galGap   = 4;
  const galCardW = Math.floor((screenW - gridPad * 2 - galGap * (galCols - 1)) / galCols);

  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryError,     setGalleryError]     = useState<string | null>(null);
  const [selectedPhoto,    setSelectedPhoto]    = useState<GalleryPhoto | null>(null);
  const [deletingPhoto,    setDeletingPhoto]    = useState(false);
  const deletePhotoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleAddGalleryPhoto() {
    const remaining = galleryUsage.limit - galleryUsage.count;
    if (remaining <= 0) {
      setGalleryError(`Gallery full (${galleryUsage.limit} photos max)`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // 'limited' on iOS 14+ means user granted access to specific photos — picker still works
    if ((perm.status as string) === 'denied' || (perm.status as string) === 'restricted') {
      setGalleryError('Photo access denied — enable it in Settings to add photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    setGalleryUploading(true);
    setGalleryError(null);
    try {
      const results = await Promise.allSettled(
        result.assets.map(async (asset) => {
          const uri = await persistImageUri(asset.uri);
          if (!uri) throw new Error('Photo upload failed — check your connection and try again.');
          await addGalleryPhoto(uri, '');
        }),
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        setGalleryError(`${failed} photo${failed > 1 ? 's' : ''} failed to upload — check your connection.`);
      }
    } catch (err: any) {
      setGalleryError(err?.message ?? 'Upload failed');
    } finally {
      setGalleryUploading(false);
    }
  }

  function openPhoto(photo: GalleryPhoto) {
    setSelectedPhoto(photo);
    setDeletingPhoto(false);
  }
  function closePhoto() {
    setSelectedPhoto(null);
    setDeletingPhoto(false);
  }
  function handleDeletePhoto() {
    if (!selectedPhoto) return;
    if (deletingPhoto) {
      if (deletePhotoTimer.current) clearTimeout(deletePhotoTimer.current);
      deleteGalleryPhoto(selectedPhoto.id);
      closePhoto();
    } else {
      setDeletingPhoto(true);
      deletePhotoTimer.current = setTimeout(() => setDeletingPhoto(false), 3000);
    }
  }

  // ── Outfit modal state ─────────────────────────────────────────────────────
  const [selectedOutfitId,       setSelectedOutfitId]       = useState<string | null>(null);
  const [deletingOutfitInModal,  setDeletingOutfitInModal]  = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedOutfit = outfits.find(o => o.id === selectedOutfitId) ?? null;

  function openOutfit(id: string) {
    setSelectedOutfitId(id);
    setDeletingOutfitInModal(false);
  }
  function closeOutfit() {
    setSelectedOutfitId(null);
    setDeletingOutfitInModal(false);
  }
  function handleModalDelete() {
    if (!selectedOutfit) return;
    if (deletingOutfitInModal) {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      deleteOutfit(selectedOutfit.id);
      if (activeOutfitId === selectedOutfit.id) setActiveOutfitId(null);
      closeOutfit();
    } else {
      setDeletingOutfitInModal(true);
      deleteTimer.current = setTimeout(() => setDeletingOutfitInModal(false), 3000);
    }
  }
  function handleSetDisplay() {
    if (!selectedOutfit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (activeOutfitId === selectedOutfit.id) {
      setActiveOutfitId(null);
    } else {
      setActiveOutfitId(selectedOutfit.id);
    }
  }

  // ── Weather & ping state ───────────────────────────────────────────────────
  const [weatherQuery,    setWeatherQuery]    = useState<string | null>(null);
  const [pingState,       setPingState]       = useState<'idle'|'sending'|'sent'|'cooldown'>('idle');
  const [pingCooldownEnd, setPingCooldownEnd] = useState<number | null>(null);
  const [cooldownText,    setCooldownText]    = useState('');
  const bellAnim = useRef(new Animated.Value(0)).current;

  const PING_KEY      = 'ping_cooldown_v1';
  const PING_COOLDOWN = 60 * 60 * 1000;

  function shakeBell() {
    Animated.sequence([
      Animated.timing(bellAnim, { toValue:  1, duration: 70, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: -1, duration: 70, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue:  1, duration: 70, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue:  0, duration: 70, useNativeDriver: true }),
    ]).start();
  }

  async function handlePing() {
    shakeBell();
    setPingState('sending');
    try {
      await apiFetch<{ sent: number }>('/notify/ping-friends', { method: 'POST' });
      const now = Date.now();
      await AsyncStorage.setItem(PING_KEY, String(now));
      setPingCooldownEnd(now + PING_COOLDOWN);
      setPingState('sent');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setPingState('cooldown'), 3000);
    } catch {
      setPingState('idle');
    }
  }

  useEffect(() => {
    AsyncStorage.getItem(PING_KEY).then(stored => {
      if (!stored) return;
      const last = parseInt(stored, 10);
      const end  = last + PING_COOLDOWN;
      if (Date.now() < end) { setPingCooldownEnd(end); setPingState('cooldown'); }
    });
  }, []);

  useEffect(() => {
    if (!pingCooldownEnd) return;
    const tick = () => {
      const ms = pingCooldownEnd - Date.now();
      if (ms <= 0) { setPingState('idle'); setPingCooldownEnd(null); setCooldownText(''); return; }
      const m = Math.ceil(ms / 60000);
      const h = Math.floor(m / 60);
      setCooldownText(h > 0 ? `${h}h ${m % 60}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [pingCooldownEnd]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (character.country) setWeatherQuery(character.country);
      return;
    }
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (character.country) setWeatherQuery(character.country);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setWeatherQuery(`${loc.coords.latitude.toFixed(2)},${loc.coords.longitude.toFixed(2)}`);
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) {
          apiFetch('/character', {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ timezone: tz }),
          }).catch(() => null);
        }
      } catch {
        if (character.country) setWeatherQuery(character.country);
      }
    })();
  }, []);

  // ── Profile editing state ──────────────────────────────────────────────────
  const [confirmingSignOut,   setConfirmingSignOut]   = useState(false);
  const signOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSignOut() {
    if (confirmingSignOut) {
      if (signOutTimer.current) clearTimeout(signOutTimer.current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signOut();
      router.replace('/(auth)/sign-in' as any);
    } else {
      setConfirmingSignOut(true);
      signOutTimer.current = setTimeout(() => setConfirmingSignOut(false), 3000);
    }
  }

  const [editingName,      setEditingName]      = useState(false);
  const [editingBio,       setEditingBio]        = useState(false);
  const [editingUsername,  setEditingUsername]   = useState(false);
  const [nameVal,          setNameVal]           = useState(character.name);
  const [bioVal,           setBioVal]            = useState(character.bio);
  const [usernameVal,      setUsernameVal]       = useState(character.username ?? '');
  const [usernameError,    setUsernameError]     = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking]  = useState(false);
  const [addingTrait,      setAddingTrait]       = useState(false);
  const [newTrait,         setNewTrait]          = useState('');
  const [showSuggestions,  setShowSuggestions]  = useState(false);
  const [showMoodPicker,   setShowMoodPicker]   = useState(false);
  const [avatarUploading,  setAvatarUploading]  = useState(false);
  const [avatarError,      setAvatarError]      = useState<string | null>(null);

  // ── Settings drawer ────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerX = useRef(new Animated.Value(screenW * 0.82)).current;

  function openDrawer() {
    setDrawerOpen(true);
    Animated.spring(drawerX, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
  }
  function closeDrawer() {
    Animated.timing(drawerX, { toValue: screenW * 0.82, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setDrawerOpen(false));
  }

  // Birthday / country / links
  const [editingBirthday,  setEditingBirthday]  = useState(false);
  const [editingCountry,   setEditingCountry]   = useState(false);
  const [birthdayVal,      setBirthdayVal]      = useState(character.birthday ?? '');
  const [countryVal,       setCountryVal]       = useState(character.country ?? '');

  // Social links state
  const [linkMode,         setLinkMode]         = useState<'none' | 'picking' | 'entering'>('none');
  const [linkPlatform,     setLinkPlatform]     = useState<SocialPlatform | null>(null);
  const [linkHandle,       setLinkHandle]       = useState('');
  const [linkOtherLabel,   setLinkOtherLabel]   = useState('');
  const [linkEditIdx,      setLinkEditIdx]      = useState<number | null>(null);

  function saveBirthday() {
    setCharacter({ ...character, birthday: birthdayVal.trim() || undefined });
    setEditingBirthday(false);
  }
  function saveCountry() {
    setCharacter({ ...character, country: countryVal.trim() || undefined });
    setEditingCountry(false);
  }
  function openAddLink() {
    setLinkEditIdx(null);
    setLinkHandle('');
    setLinkOtherLabel('');
    setLinkPlatform(null);
    setLinkMode('picking');
  }
  function openEditLink(idx: number) {
    const link = (character.links ?? [])[idx];
    if (!link) return;
    const plat = getPlatform(link.platform) ?? SOCIAL_PLATFORMS.find(p => link.url.startsWith(p.prefix) && p.key !== 'other') ?? getPlatform('other')!;
    const handle = extractHandle(link.url, plat.prefix);
    setLinkEditIdx(idx);
    setLinkPlatform(plat);
    setLinkHandle(handle);
    setLinkOtherLabel(plat.key === 'other' ? link.label : '');
    setLinkMode('entering');
  }
  function selectPlatform(p: SocialPlatform) {
    setLinkPlatform(p);
    setLinkHandle('');
    setLinkOtherLabel('');
    setLinkMode('entering');
  }
  function saveLink() {
    if (!linkPlatform) return;
    const handle = linkHandle.trim().replace(/^@/, '');
    if (!handle) { cancelLink(); return; }
    const url   = linkPlatform.key === 'other' ? handle : `${linkPlatform.prefix}${handle}`;
    const label = linkPlatform.key === 'other' ? (linkOtherLabel.trim() || 'Link') : linkPlatform.label;
    const links = [...(character.links ?? [])];
    const newLink = { label, url, platform: linkPlatform.key };
    if (linkEditIdx !== null) {
      links[linkEditIdx] = newLink;
    } else {
      links.push(newLink);
    }
    setCharacter({ ...character, links });
    cancelLink();
  }
  function cancelLink() {
    setLinkMode('none');
    setLinkPlatform(null);
    setLinkHandle('');
    setLinkEditIdx(null);
  }
  function removeLink(idx: number) {
    const links = (character.links ?? []).filter((_, i) => i !== idx);
    setCharacter({ ...character, links });
    cancelLink();
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // allow 'limited' (iOS 14+ selective access); only block if explicitly denied
    if ((perm.status as string) === 'denied' || (perm.status as string) === 'restricted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const uri = await persistImageUri(result.assets[0].uri);
      if (uri) {
        setCharacter({ ...character, avatarUri: uri });
      } else {
        setAvatarError('Upload failed — check your connection');
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  function saveName() {
    if (nameVal.trim()) setCharacter({ ...character, name: nameVal.trim() });
    setEditingName(false);
  }
  function saveBio() {
    setCharacter({ ...character, bio: bioVal.trim() });
    setEditingBio(false);
  }
  async function saveUsername() {
    const val = usernameVal.trim().toLowerCase();
    setUsernameError(null);
    if (!val) {
      setCharacter({ ...character, username: undefined });
      setEditingUsername(false);
      return;
    }
    if (!USERNAME_REGEX.test(val)) {
      setUsernameError('3–20 chars, lowercase letters, numbers and _ only');
      return;
    }
    if (val === character.username) { setEditingUsername(false); return; }
    setUsernameChecking(true);
    try {
      const result = await apiFetch<{ available: boolean }>(`/users/check-username?username=${encodeURIComponent(val)}`);
      if (!result.available) { setUsernameError('That handle is already taken'); return; }
    } catch { /* ignore */ } finally { setUsernameChecking(false); }
    setCharacter({ ...character, username: val });
    setEditingUsername(false);
  }
  function addTrait(t: string) {
    const trimmed = t.trim();
    if (!trimmed || character.traits.includes(trimmed)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCharacter({ ...character, traits: [...character.traits, trimmed] });
    setNewTrait(''); setAddingTrait(false); setShowSuggestions(false);
  }
  function removeTrait(t: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCharacter({ ...character, traits: character.traits.filter(tr => tr !== t) });
  }
  function toggleVisibility() {
    Haptics.selectionAsync();
    setCharacter({ ...character, isPublic: !character.isPublic });
  }
  const suggestions = ATTRIBUTE_SUGGESTIONS.filter(
    s => !character.traits.includes(s) && s.toLowerCase().includes(newTrait.toLowerCase()),
  );

  const totalWitnessed = stories.reduce((sum, s) => sum + s.witnessedCount, 0);

  const bannerColors = isDark
    ? (['#281868', '#4228A8', '#5E44BC'] as const)
    : (['#DDD2FF', '#C8B4F8', '#B4A4EC'] as const);

  const activeOutfit = activeOutfitId ? outfits.find(o => o.id === activeOutfitId) : null;
  const avatarSource = character.avatarUri
    ? { uri: character.avatarUri }
    : activeOutfit?.imageUri
      ? { uri: activeOutfit.imageUri }
      : Images.character_default;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
        scrollEventThrottle={16}
      >
      {/* ── Profile header ───────────────────────────────────────── */}
      <CharacterAuraHeader mood={character.mood || 'Dreamy'} paddingTop={topPad + 8}>

          {/* Top controls: vis toggle left, settings + bell right */}
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={[styles.visPill, {
                backgroundColor: character.isPublic ? `${colors.primary}22` : 'rgba(255,255,255,0.08)',
                borderColor: character.isPublic ? `${colors.primary}45` : 'rgba(255,255,255,0.14)',
              }]}
              onPress={toggleVisibility}
            >
              <Icon name={character.isPublic ? 'globe' : 'lock'} size={11} color={character.isPublic ? colors.primary : 'rgba(200,184,232,0.7)'} />
              <Text style={[styles.visPillText, { color: character.isPublic ? colors.primary : 'rgba(200,184,232,0.7)' }]}>
                {character.isPublic ? 'Public' : 'Private'}
              </Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.headerIconBtn} onPress={openDrawer}>
              <Icon name="settings" size={14} color="rgba(200,184,232,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Profile row: avatar left + info right */}
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatarCircle, { borderColor: `${colors.primary}70` }]}>
                <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" />
              </View>
              <BreathingAvatarRing mood={character.mood || 'Dreamy'} />
              <TouchableOpacity
                style={[styles.avatarEditBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={pickAvatar}
                activeOpacity={0.75}
              >
                {avatarUploading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Icon name="camera" size={10} color={colors.primary} />
                }
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              {editingName ? (
                <View style={[styles.nameEditWrap, { borderBottomColor: colors.primary }]}>
                  <TextInput
                    style={[styles.nameEditInput, { color: '#FFFFFF' }]}
                    value={nameVal} onChangeText={setNameVal}
                    autoFocus returnKeyType="done"
                    onSubmitEditing={saveName} onBlur={saveName}
                  />
                </View>
              ) : (
                <TouchableOpacity style={styles.nameRow} onPress={() => setEditingName(true)}>
                  <Text style={styles.profileName}>{character.name}</Text>
                  <Icon name="edit-2" size={10} color="rgba(200,184,232,0.4)" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              )}

              {character.username ? (
                /* Username is permanent once set — show locked display */
                <View style={styles.usernameRow}>
                  <Text style={styles.profileHandle}>@{character.username}</Text>
                  <Icon name="lock" size={9} color="rgba(200,184,232,0.35)" style={{ marginLeft: 4 }} />
                </View>
              ) : editingUsername ? (
                <View style={[styles.usernameEditWrap, { borderColor: usernameError ? colors.destructive : colors.primary, backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                  <Text style={[styles.usernameAt, { color: usernameError ? colors.destructive : colors.primary }]}>@</Text>
                  <TextInput
                    style={[styles.usernameEditInput, { color: '#FFFFFF' }]}
                    value={usernameVal}
                    onChangeText={v => { setUsernameVal(v.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameError(null); }}
                    autoFocus autoCapitalize="none" autoCorrect={false}
                    returnKeyType="done" onSubmitEditing={saveUsername} onBlur={saveUsername}
                    placeholder="your_handle" placeholderTextColor="rgba(200,184,232,0.4)"
                    maxLength={20}
                  />
                  {usernameChecking && <ActivityIndicator size="small" color={colors.primary} />}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.usernameRow}
                  onPress={() => { setUsernameVal(''); setEditingUsername(true); setUsernameError(null); }}
                >
                  <Text style={[styles.profileHandle, { color: 'rgba(200,184,232,0.38)', fontStyle: 'italic' }]}>{t('profile.setUsername')}</Text>
                  <Icon name="edit-2" size={9} color="rgba(200,184,232,0.35)" style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              )}
              {usernameError && (
                <Text style={[styles.usernameError, { color: colors.destructive }]}>{usernameError}</Text>
              )}

              {editingBio ? (
                <TextInput
                  style={[styles.bioInput, { color: '#FFFFFF', borderColor: colors.primary, backgroundColor: 'rgba(255,255,255,0.08)' }]}
                  value={bioVal} onChangeText={setBioVal}
                  multiline autoFocus returnKeyType="done" onBlur={saveBio}
                />
              ) : (
                <TouchableOpacity onPress={() => setEditingBio(true)} activeOpacity={0.75}>
                  <Text style={[styles.profileBio, { color: character.bio ? 'rgba(200,184,232,0.78)' : 'rgba(200,184,232,0.32)' }]}>
                    {character.bio || t('profile.tapBio')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Inline mood orb picker */}
          <MoodOrbPicker
            currentMood={character.mood || 'Dreamy'}
            onSelect={m => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCharacter({ ...character, mood: m });
            }}
          />

          {/* Trait chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.traitChipsScroll} contentContainerStyle={styles.traitChipsRow}>
            {character.traits.map(tr => (
              <View key={tr} style={[styles.traitChip, { backgroundColor: 'rgba(120,86,255,0.18)', borderColor: 'rgba(120,86,255,0.38)' }]}>
                <Text style={[styles.traitText, { color: 'rgba(210,195,255,0.92)' }]}>{tr}</Text>
                <Text style={{ fontSize: 8, color: 'rgba(200,184,232,0.45)', marginLeft: 1 }}>✦</Text>
                <TouchableOpacity
                  onPress={() => removeTrait(tr)}
                  hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  style={[styles.traitRemove, { backgroundColor: 'rgba(120,86,255,0.22)' }]}
                >
                  <Icon name="x" size={9} color="rgba(200,184,232,0.7)" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.traitAddBtn, { borderColor: 'rgba(120,86,255,0.32)', backgroundColor: 'rgba(120,86,255,0.1)' }]}
              onPress={() => { setAddingTrait(true); setShowSuggestions(true); }}
            >
              <Icon name="plus" size={12} color="rgba(200,184,232,0.7)" />
              <Text style={[styles.traitAddText, { color: 'rgba(200,184,232,0.7)' }]}>{t('profile.addTrait')}</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Trait add input */}
          {addingTrait && (
            <View style={[styles.traitAddWrap, { borderColor: colors.primary, backgroundColor: 'rgba(120,86,255,0.1)', marginTop: 8 }]}>
              <TextInput
                style={[styles.traitInput, { color: '#FFFFFF' }]}
                value={newTrait}
                onChangeText={tr => { setNewTrait(tr); setShowSuggestions(true); }}
                placeholder={t('profile.traitPlaceholder')}
                placeholderTextColor="rgba(200,184,232,0.4)"
                autoFocus returnKeyType="done"
                onSubmitEditing={() => addTrait(newTrait)}
                onBlur={() => setTimeout(() => { if (!newTrait.trim()) { setAddingTrait(false); setShowSuggestions(false); } }, 200)}
              />
              <TouchableOpacity onPress={() => { setAddingTrait(false); setNewTrait(''); setShowSuggestions(false); }}>
                <Icon name="x" size={13} color="rgba(200,184,232,0.5)" />
              </TouchableOpacity>
            </View>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggRow}>
              <Text style={[styles.suggLabel, { color: 'rgba(200,184,232,0.55)' }]}>{t('profile.suggestions')}</Text>
              <View style={styles.suggChips}>
                {suggestions.slice(0, 8).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.suggChip, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(200,184,232,0.18)' }]}
                    onPress={() => addTrait(s)}
                  >
                    <Icon name="plus" size={10} color="rgba(200,184,232,0.5)" />
                    <Text style={[styles.suggText, { color: 'rgba(200,184,232,0.5)' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {avatarError ? (
            <Text style={{ color: '#DC2626', fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 6 }}>
              {avatarError}
            </Text>
          ) : null}
        </CharacterAuraHeader>

        {/* ── Stats row ────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statPill} onPress={() => router.push('/my-stories' as any)} activeOpacity={0.75}>
            <Text style={styles.statPillNum}>{stories.length}</Text>
            <Text style={styles.statPillLabel}>Stories</Text>
          </TouchableOpacity>
          <View style={styles.statPillDot} />
          <View style={styles.statPill}>
            <Text style={styles.statPillNum}>{outfits.length}</Text>
            <Text style={styles.statPillLabel}>Outfits</Text>
          </View>
          <View style={styles.statPillDot} />
          <View style={styles.statPill}>
            <Text style={styles.statPillNum}>{totalWitnessed}</Text>
            <Text style={styles.statPillLabel}>Witnessed</Text>
          </View>
        </View>

        {/* ── Weather strip ─────────────────────────────────────── */}
        {weatherQuery ? (
          <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
            <WeatherWidget query={weatherQuery} accentColor={moodAccent} />
          </View>
        ) : null}

        {/* ── Ping friends ──────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
          <View style={[styles.pingCard, { backgroundColor: colors.card, borderColor: `${moodAccent}30` }, SHADOW.xs]}>
            <View style={styles.pingLeft}>
              <View style={[styles.pingIconWrap, { backgroundColor: `${moodAccent}15` }]}>
                <Animated.View
                  style={{ transform: [{ rotate: bellAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-15deg', '0deg', '15deg'] }) }] }}
                >
                  <Icon name="bell" size={18} color={moodAccent} />
                </Animated.View>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.pingTitle, { color: colors.foreground }]}>
                  {pingState === 'sent' ? 'Friends summoned ✦' : 'Ping your sky friends'}
                </Text>
                <Text style={[styles.pingSub, { color: colors.mutedForeground }]}>
                  {pingState === 'cooldown'
                    ? `Next signal in ${cooldownText}`
                    : pingState === 'sent'
                    ? 'Your constellation has been called'
                    : 'Gently call your friends online'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.pingBtn,
                { backgroundColor: `${moodAccent}18`, borderColor: `${moodAccent}45` },
                (pingState === 'sending' || pingState === 'cooldown') && { opacity: 0.45 },
              ]}
              onPress={handlePing}
              disabled={pingState === 'sending' || pingState === 'cooldown'}
              activeOpacity={0.7}
            >
              {pingState === 'sending' ? (
                <ActivityIndicator size={14} color={moodAccent} />
              ) : (
                <Text style={[styles.pingBtnText, { color: moodAccent }]}>
                  {pingState === 'sent'       ? '✦ Sent'
                   : pingState === 'cooldown' ? '⏳ Wait'
                   : '✦ Signal'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Content ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>

          {/* ── About Me ──────────────────────────────────────── */}
          <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
            {/* Header row */}
            <View style={styles.aboutCardHeader}>
              <View style={[styles.aboutCardIcon, { backgroundColor: `${colors.primary}14` }]}>
                <Icon name="user" size={14} color={colors.primary} />
              </View>
              <Text style={[styles.aboutCardTitle, { color: colors.foreground }]}>About Me</Text>
            </View>

            {/* Birthday */}
            <TouchableOpacity
              style={[styles.aboutRow, { borderTopColor: colors.border }]}
              onPress={() => { setBirthdayVal(character.birthday ?? ''); setEditingBirthday(true); }}
              activeOpacity={0.75}
            >
              <View style={[styles.aboutRowLeft]}>
                <Text style={[styles.aboutRowLabel, { color: colors.mutedForeground }]}>BIRTHDAY</Text>
                {editingBirthday ? (
                  <TextInput
                    style={[styles.aboutRowInput, { color: colors.foreground, borderColor: colors.primary }]}
                    value={birthdayVal} onChangeText={setBirthdayVal}
                    autoFocus returnKeyType="done"
                    onSubmitEditing={saveBirthday} onBlur={saveBirthday}
                    placeholder="e.g. 17 April"
                    placeholderTextColor={`${colors.mutedForeground}70`}
                  />
                ) : (
                  <Text style={[styles.aboutRowVal, { color: character.birthday ? colors.foreground : colors.mutedForeground }]}>
                    {character.birthday || 'Add birthday'}
                  </Text>
                )}
              </View>
              {!editingBirthday && <Icon name="edit-2" size={12} color={`${colors.primary}55`} />}
            </TouchableOpacity>

            {/* Country */}
            <TouchableOpacity
              style={[styles.aboutRow, { borderTopColor: colors.border }]}
              onPress={() => { setCountryVal(character.country ?? ''); setEditingCountry(true); }}
              activeOpacity={0.75}
            >
              <View style={styles.aboutRowLeft}>
                <Text style={[styles.aboutRowLabel, { color: colors.mutedForeground }]}>COUNTRY</Text>
                {editingCountry ? (
                  <TextInput
                    style={[styles.aboutRowInput, { color: colors.foreground, borderColor: colors.primary }]}
                    value={countryVal} onChangeText={setCountryVal}
                    autoFocus returnKeyType="done"
                    onSubmitEditing={saveCountry} onBlur={saveCountry}
                    placeholder="Where are you from?"
                    placeholderTextColor={`${colors.mutedForeground}70`}
                  />
                ) : (
                  <Text style={[styles.aboutRowVal, { color: character.country ? colors.foreground : colors.mutedForeground }]}>
                    {character.country || 'Add location'}
                  </Text>
                )}
              </View>
              {!editingCountry && <Icon name="edit-2" size={12} color={`${colors.primary}55`} />}
            </TouchableOpacity>

            {/* Role */}
            <View style={[styles.aboutRow, { borderTopColor: colors.border, flexDirection: 'column', alignItems: 'flex-start', gap: 10, paddingVertical: 14 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Text style={[styles.aboutRowLabel, { color: colors.mutedForeground }]}>ROLE</Text>
                {character.role && (
                  <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: `${colors.mutedForeground}80` }}>
                    shown on your profile
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ROLES.map(r => {
                  const sel = character.role === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCharacter({ ...character, role: sel ? undefined : r.key });
                      }}
                      style={[
                        styles.roleChip,
                        sel
                          ? { backgroundColor: r.color + '22', borderColor: r.color + '70' }
                          : { borderColor: colors.border },
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
                      <View style={{ gap: 1 }}>
                        <Text style={[styles.roleChipLabel, { color: sel ? r.color : colors.foreground }]}>
                          {r.key}
                        </Text>
                        {sel && (
                          <Text style={[styles.roleChipHint, { color: r.color + 'AA' }]}>
                            {r.hint}
                          </Text>
                        )}
                      </View>
                      {sel && <View style={[styles.roleSelDot, { backgroundColor: r.color }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!character.role && (
                <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: `${colors.mutedForeground}60` }}>
                  Optional — tap a role to display it on your profile
                </Text>
              )}
            </View>

            {/* Socials header */}
            <View style={[styles.aboutRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.aboutRowLabel, { color: colors.mutedForeground, flex: 1 }]}>SOCIALS</Text>
              <TouchableOpacity
                style={[styles.aboutAddBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}
                onPress={openAddLink}
                activeOpacity={0.75}
              >
                <Icon name="plus" size={11} color={colors.primary} />
                <Text style={[styles.aboutAddBtnText, { color: colors.primary }]}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Social links */}
            {(character.links ?? []).map((link, idx) => {
              const plat = getPlatform((link as any).platform);
              return (
                <View key={idx} style={[styles.aboutLinkRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.aboutLinkIcon, { backgroundColor: `${plat?.color ?? colors.primary}22` }]}>
                    <Text style={{ fontSize: 16 }}>{plat?.icon ?? '🔗'}</Text>
                  </View>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => openEditLink(idx)} activeOpacity={0.75}>
                    <Text style={[styles.aboutLinkName, { color: colors.foreground }]}>{link.label}</Text>
                    <Text style={[styles.aboutLinkHandle, { color: colors.mutedForeground }]}>
                      @{extractHandle(link.url, plat?.prefix ?? '')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeLink(idx)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Icon name="x" size={13} color={`${colors.mutedForeground}70`} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Link picker / entry inline */}
            {linkMode === 'picking' && (
              <View style={[styles.aboutRow, { borderTopColor: colors.border, flexWrap: 'wrap', gap: 8 }]}>
                {SOCIAL_PLATFORMS.map(p => (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.platformChip, { borderColor: `${colors.border}`, backgroundColor: `${colors.primary}08` }]}
                    onPress={() => selectPlatform(p)}
                  >
                    <View style={[styles.platformChipIcon, { backgroundColor: p.color + '22' }]}>
                      <Text style={styles.socialIcon}>{p.icon}</Text>
                    </View>
                    <Text style={[styles.platformChipLabel, { color: colors.foreground }]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {linkMode === 'entering' && linkPlatform && (
              <View style={[styles.aboutRow, { borderTopColor: colors.border, flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.socialBadge, { backgroundColor: linkPlatform.color + '22' }]}>
                    <Text style={styles.socialIcon}>{linkPlatform.icon}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: colors.foreground }}>{linkPlatform.label}</Text>
                  <TouchableOpacity onPress={cancelLink} style={{ marginLeft: 'auto' }} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Icon name="x" size={14} color={`${colors.mutedForeground}80`} />
                  </TouchableOpacity>
                </View>
                {linkPlatform.key === 'other' && (
                  <TextInput
                    style={[styles.handleInput, { marginBottom: 4, color: colors.foreground, borderColor: `${colors.primary}50`, backgroundColor: `${colors.primary}08` }]}
                    value={linkOtherLabel} onChangeText={setLinkOtherLabel}
                    placeholder="Label (e.g. My Blog)"
                    placeholderTextColor={`${colors.mutedForeground}70`}
                    returnKeyType="next"
                  />
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {linkPlatform.key !== 'other' && (
                    <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Medium', color: colors.mutedForeground }}>@</Text>
                  )}
                  <TextInput
                    style={[styles.handleInput, { flex: 1, color: colors.foreground, borderColor: `${colors.primary}50`, backgroundColor: `${colors.primary}08` }]}
                    value={linkHandle} onChangeText={setLinkHandle}
                    placeholder={linkPlatform.placeholder}
                    placeholderTextColor={`${colors.mutedForeground}70`}
                    autoCapitalize="none" autoCorrect={false}
                    returnKeyType="done" onSubmitEditing={saveLink} autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.saveLinkBtn, { backgroundColor: linkPlatform.color + 'CC' }]}
                    onPress={saveLink}
                  >
                    <Icon name="check" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Current outfit compact card */}
          {activeOutfit && (
            <TouchableOpacity
              style={[styles.compactOutfitCard, { backgroundColor: '#27243E', borderColor: 'rgba(155,120,255,0.14)' }, SHADOW.xs]}
              onPress={() => openOutfit(activeOutfit.id)}
              activeOpacity={0.88}
            >
              <View style={styles.compactOutfitImg}>
                {activeOutfit.imageUri ? (
                  <Image source={{ uri: activeOutfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(155,120,255,0.15)' }]}>
                    <Icon name="camera" size={20} color="rgba(155,120,255,0.5)" />
                  </View>
                )}
              </View>
              <View style={{ flex: 1, paddingLeft: 12, gap: 4 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase' }}>Current Outfit</Text>
                <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#EDE8FF' }} numberOfLines={1}>{activeOutfit.name}</Text>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {(activeOutfit.tags ?? []).slice(0, 2).map(tag => (
                    <View key={tag} style={{ backgroundColor: 'rgba(155,120,255,0.22)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(190,165,255,0.95)' }}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Icon name="chevron-right" size={14} color="rgba(155,120,255,0.45)" />
            </TouchableOpacity>
          )}

          {/* ── My Stories ───────────────────────────────────── */}
          <View style={styles.hSection}>
            <View style={styles.hSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.hSectionTitle, { color: colors.foreground }]}>My Stories</Text>
                {stories.length > 0 && (
                  <View style={[styles.hCountPill, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}28` }]}>
                    <Text style={[styles.hCountPillText, { color: colors.primary }]}>{stories.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.hSectionAddBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}
                onPress={() => router.push('/my-stories' as any)}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="book-open" size={12} color={colors.primary} />
                <Text style={[styles.hSectionAddText, { color: colors.primary }]}>See all</Text>
              </TouchableOpacity>
            </View>
            {stories.length === 0 ? (
              <TouchableOpacity
                style={[styles.hEmptyCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}18` }]}
                onPress={() => router.push('/(tabs)/create' as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.hEmptyIconWrap, { backgroundColor: `${colors.primary}14` }]}>
                  <Icon name="book-open" size={20} color={`${colors.primary}70`} />
                </View>
                <Text style={[styles.hEmptyTitle, { color: colors.foreground }]}>No chapters yet</Text>
                <Text style={[styles.hEmptySubtitle, { color: colors.mutedForeground }]}>Tap to write your first sky chapter</Text>
              </TouchableOpacity>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollPad}>
                {stories.slice(0, 8).map(story => {
                  const cover = getCover(story);
                  return (
                    <TouchableOpacity
                      key={story.id}
                      style={[styles.hStoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => { Haptics.selectionAsync(); router.push(`/story/${story.id}` as any); }}
                      activeOpacity={0.85}
                    >
                      {cover ? (
                        <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <LinearGradient colors={['#2E2260', '#1A1040']} style={StyleSheet.absoluteFill}>
                          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                            <Icon name="star" size={18} color="rgba(200,184,232,0.25)" />
                          </View>
                        </LinearGradient>
                      )}
                      <LinearGradient colors={['transparent', 'rgba(8,6,22,0.90)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}>
                        <Text style={styles.hStoryTitle} numberOfLines={2}>{story.chapterTitle}</Text>
                        {story.witnessedCount > 0 && (
                          <View style={[styles.hViewCount, { backgroundColor: 'rgba(8,6,22,0.60)' }]}>
                            <Icon name="eye" size={9} color="rgba(220,200,255,0.85)" />
                            <Text style={styles.hViewCountText}>{story.witnessedCount}</Text>
                          </View>
                        )}
                      </LinearGradient>
                      {!story.isPublic && (
                        <View style={{ position: 'absolute', top: 7, right: 7, backgroundColor: 'rgba(8,6,22,0.65)', borderRadius: 6, padding: 3 }}>
                          <Icon name="lock" size={9} color="rgba(200,184,232,0.7)" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.hAddCard, { borderColor: `${colors.primary}28`, backgroundColor: `${colors.primary}08` }]}
                  onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/create' as any); }}
                  activeOpacity={0.75}
                >
                  <Icon name="plus" size={18} color={`${colors.primary}70`} />
                  <Text style={[styles.hAddText, { color: `${colors.primary}70` }]}>New</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>

          {/* ── Wardrobe ─────────────────────────────────────── */}
          <View style={styles.hSection}>
            <View style={styles.hSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.hSectionTitle, { color: colors.foreground }]}>{t('profile.wardrobe')}</Text>
                {outfits.length > 0 && (
                  <View style={[styles.hCountPill, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}28` }]}>
                    <Text style={[styles.hCountPillText, { color: colors.primary }]}>{outfits.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.hSectionAddBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}
                onPress={() => router.push('/create-outfit' as any)}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="plus" size={13} color={colors.primary} />
                <Text style={[styles.hSectionAddText, { color: colors.primary }]}>New outfit</Text>
              </TouchableOpacity>
            </View>
            {outfits.length === 0 ? (
              <TouchableOpacity
                style={[styles.hEmptyCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}18` }]}
                onPress={() => router.push('/create-outfit' as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.hEmptyIconWrap, { backgroundColor: `${colors.primary}14` }]}>
                  <Icon name="camera" size={20} color={`${colors.primary}70`} />
                </View>
                <Text style={[styles.hEmptyTitle, { color: colors.foreground }]}>No outfits yet</Text>
                <Text style={[styles.hEmptySubtitle, { color: colors.mutedForeground }]}>Log your first sky look</Text>
              </TouchableOpacity>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollPad}>
                {outfits.slice(0, 8).map(outfit => {
                  const isActive = outfit.id === activeOutfitId;
                  return (
                    <TouchableOpacity
                      key={outfit.id}
                      style={[styles.hOutfitCard, { backgroundColor: colors.card, borderColor: isActive ? colors.primary : colors.border }]}
                      onPress={() => openOutfit(outfit.id)}
                      activeOpacity={0.85}
                    >
                      {outfit.imageUri ? (
                        <Image source={{ uri: outfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.primary}14`, alignItems: 'center', justifyContent: 'center' }]}>
                          <Icon name="camera" size={22} color={`${colors.primary}50`} />
                        </View>
                      )}
                      <LinearGradient colors={['transparent', 'rgba(8,6,22,0.90)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}>
                        <Text style={styles.hOutfitName} numberOfLines={2}>{outfit.name}</Text>
                        {isActive && (
                          <View style={[styles.hActivePill, { backgroundColor: colors.primary }]}>
                            <Text style={styles.hActivePillText}>Worn</Text>
                          </View>
                        )}
                      </LinearGradient>
                      {(outfit.tags ?? []).length > 0 && (
                        <View style={[styles.hRarityPill, { backgroundColor: 'rgba(8,6,22,0.75)', top: 7, left: 7 }]}>
                          <Text style={[styles.hRarityText, { color: 'rgba(220,200,255,0.9)' }]}>{outfit.tags[0]}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* ── Gallery ──────────────────────────────────────── */}
          <View style={styles.hSection}>
            <View style={styles.hSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.hSectionTitle, { color: colors.foreground }]}>Gallery</Text>
                {gallery.length > 0 && (
                  <View style={[styles.hCountPill, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}28` }]}>
                    <Text style={[styles.hCountPillText, { color: colors.primary }]}>{gallery.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.hSectionAddBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}
                onPress={handleAddGalleryPhoto}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {galleryUploading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Icon name="plus" size={13} color={colors.primary} />
                }
                <Text style={[styles.hSectionAddText, { color: colors.primary }]}>Add photo</Text>
              </TouchableOpacity>
            </View>

            {gallery.length === 0 ? (
              <TouchableOpacity
                style={[styles.hEmptyCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}18` }]}
                onPress={handleAddGalleryPhoto}
                activeOpacity={0.75}
              >
                <View style={[styles.hEmptyIconWrap, { backgroundColor: `${colors.primary}14` }]}>
                  <Icon name="image" size={20} color={`${colors.primary}70`} />
                </View>
                <Text style={[styles.hEmptyTitle, { color: colors.foreground }]}>No photos yet</Text>
                <Text style={[styles.hEmptySubtitle, { color: colors.mutedForeground }]}>Tap to add your first sky memory</Text>
              </TouchableOpacity>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollPad}>
                {gallery.slice(0, 8).map(photo => (
                  <TouchableOpacity
                    key={photo.id}
                    style={styles.hGalleryThumb}
                    onPress={() => openPhoto(photo)}
                    activeOpacity={0.88}
                  >
                    <Image
                      source={{ uri: photo.imageUri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {galleryError && (
              <Text style={[styles.galError, { color: colors.destructive, marginTop: 6 }]}>{galleryError}</Text>
            )}
          </View>

        </View>

      </ScrollView>

      {/* ── Drawer backdrop ─────────────────────────────────────── */}
      {drawerOpen && (
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.52)', zIndex: 20 }]}
          onPress={closeDrawer}
        />
      )}

      {/* ── Settings drawer (slides from right) ─────────────────── */}
      <Animated.View
        style={[
          styles.settingsDrawer,
          { width: screenW * 0.82, paddingTop: topPad, backgroundColor: '#100E20' },
          { transform: [{ translateX: drawerX }] },
        ]}
        pointerEvents={drawerOpen ? 'auto' : 'none'}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

          {/* Drawer header — avatar + name */}
          <View style={styles.drawerHeader}>
            <View style={[styles.drawerAvatar, { borderColor: `${colors.primary}60` }]}>
              <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
            <Text style={styles.drawerName}>{character.name}</Text>
            {character.username && (
              <Text style={styles.drawerHandle}>@{character.username}</Text>
            )}
          </View>

          {/* ACCOUNT */}
          <Text style={styles.drawerSectionLabel}>ACCOUNT</Text>
          <View style={styles.drawerGroup}>
            <TouchableOpacity style={styles.drawerItem} onPress={toggleVisibility} activeOpacity={0.7}>
              <View style={styles.drawerItemIcon}><Icon name="lock" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={[styles.drawerItemLabel, { flex: 1 }]}>Privacy</Text>
              <View style={{ backgroundColor: character.isPublic ? 'rgba(107,91,149,0.30)' : 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: character.isPublic ? 'rgba(107,91,149,0.45)' : 'rgba(255,255,255,0.12)' }}>
                <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: character.isPublic ? colors.primary : 'rgba(200,184,232,0.55)' }}>
                  {character.isPublic ? 'Public' : 'Private'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* APPEARANCE */}
          <Text style={styles.drawerSectionLabel}>APPEARANCE</Text>
          <View style={[styles.drawerGroup, { paddingVertical: 4, paddingHorizontal: 8 }]}>
            <ThemeToggle />
          </View>

          {/* MY ACCOUNT */}
          <Text style={styles.drawerSectionLabel}>MY ACCOUNT</Text>
          <View style={styles.drawerGroup}>
            <View style={styles.drawerItem}>
              <View style={styles.drawerItemIcon}><Icon name="mail" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={[styles.drawerItemLabel, { flex: 1 }]} numberOfLines={1}>{user?.primaryEmailAddress?.emailAddress ?? '—'}</Text>
            </View>
            <View style={styles.drawerDivider} />
            <TouchableOpacity style={styles.drawerItem} activeOpacity={0.7}>
              <View style={styles.drawerItemIcon}><Icon name="mail" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={styles.drawerItemLabel}>Change Email</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
            <View style={styles.drawerDivider} />
            <TouchableOpacity style={styles.drawerItem} activeOpacity={0.7}>
              <View style={styles.drawerItemIcon}><Icon name="lock" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={styles.drawerItemLabel}>Change Password</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
            <View style={styles.drawerDivider} />
            <TouchableOpacity
              style={[styles.drawerItem, confirmingSignOut && { backgroundColor: '#EF444418' }]}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <View style={styles.drawerItemIcon}><Icon name="log-out" size={15} color="#EF4444" /></View>
              <Text style={[styles.drawerItemLabel, { color: '#EF4444' }]}>
                {confirmingSignOut ? 'Tap again to sign out' : 'Sign out'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* SUPPORT */}
          <Text style={styles.drawerSectionLabel}>SUPPORT</Text>
          <View style={styles.drawerGroup}>
            <TouchableOpacity style={styles.drawerItem} activeOpacity={0.7}>
              <View style={styles.drawerItemIcon}><Icon name="help-circle" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={styles.drawerItemLabel}>Help Center</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
            <View style={styles.drawerDivider} />
            <TouchableOpacity style={styles.drawerItem} activeOpacity={0.7}>
              <View style={styles.drawerItemIcon}><Icon name="message-square" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={styles.drawerItemLabel}>Send Feedback</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
            <View style={styles.drawerDivider} />
            <TouchableOpacity style={styles.drawerItem} activeOpacity={0.7}>
              <View style={styles.drawerItemIcon}><Icon name="info" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={styles.drawerItemLabel}>About</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.drawerVersion}>App version 1.0.0</Text>

        </ScrollView>
      </Animated.View>

      {/* ── Outfit Detail Modal ───────────────────────────────────── */}
      <Modal
        visible={!!selectedOutfit}
        transparent
        animationType="slide"
        onRequestClose={closeOutfit}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeOutfit} />
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {selectedOutfit && (
                <>
                  {/* Outfit image */}
                  <View style={[styles.modalImageWrap, { backgroundColor: `${colors.primary}14` }]}>
                    {selectedOutfit.imageUri ? (
                      <Image source={{ uri: selectedOutfit.imageUri }} style={styles.modalImage} contentFit="contain" />
                    ) : (
                      <View style={[styles.modalImage, { backgroundColor: `${colors.primary}14`, alignItems: 'center', justifyContent: 'center', gap: 10 }]}>
                        <Icon name="camera" size={36} color={`${colors.primary}50`} />
                        <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Medium', color: `${colors.primary}70`, textAlign: 'center', lineHeight: 20 }}>
                          No photo yet{'\n'}
                          <Text style={{ fontFamily: 'Satoshi-Regular', fontSize: 12, opacity: 0.7 }}>Tap "Edit outfit" below to add one</Text>
                        </Text>
                      </View>
                    )}
                    {selectedOutfit.id === activeOutfitId && (
                      <View style={[styles.modalActivePill, { backgroundColor: colors.primary }]}>
                        <Text style={styles.modalActivePillText}>{t('profile.displayOutfit')}</Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.modalBody, { paddingHorizontal: 20 }]}>
                    {/* Name + date */}
                    <View style={styles.modalNameRow}>
                      <Text style={[styles.modalOutfitName, { color: colors.foreground }]} numberOfLines={2}>
                        {selectedOutfit.name}
                      </Text>
                      <Text style={[styles.modalOutfitDate, { color: colors.mutedForeground }]}>
                        {fmtDate(selectedOutfit.date)}
                      </Text>
                    </View>

                    {/* Tags */}
                    {selectedOutfit.tags.length > 0 && (
                      <View style={styles.modalTags}>
                        {selectedOutfit.tags.map(tag => (
                          <View key={tag} style={[styles.modalTag, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}>
                            <Text style={[styles.modalTagText, { color: colors.primary }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Description */}
                    {selectedOutfit.description ? (
                      <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
                        {selectedOutfit.description}
                      </Text>
                    ) : null}

                    {/* Character Story */}
                    {!!(selectedOutfit as any).story && (
                      <View style={[styles.modalStoryCard, { backgroundColor: `${colors.primary}0A`, borderColor: `${colors.primary}22` }]}>
                        <View style={styles.modalStoryHeader}>
                          <Icon name="book-open" size={13} color={colors.primary} />
                          <Text style={[styles.modalStoryLabel, { color: colors.primary }]}>Character Story</Text>
                        </View>
                        <Text style={[styles.modalStoryText, { color: colors.foreground }]}>
                          {(selectedOutfit as any).story}
                        </Text>
                      </View>
                    )}

                    {/* Set display button */}
                    <TouchableOpacity
                      style={[styles.setDisplayBtn, {
                        backgroundColor: selectedOutfit.id === activeOutfitId ? `${colors.primary}18` : colors.primary,
                        borderColor:     selectedOutfit.id === activeOutfitId ? colors.primary : 'transparent',
                      }]}
                      onPress={handleSetDisplay}
                    >
                      <Icon
                        name={selectedOutfit.id === activeOutfitId ? 'star' : 'star'}
                        size={15}
                        color={selectedOutfit.id === activeOutfitId ? colors.primary : '#fff'}
                      />
                      <Text style={[styles.setDisplayBtnText, { color: selectedOutfit.id === activeOutfitId ? colors.primary : '#fff' }]}>
                        {selectedOutfit.id === activeOutfitId ? t('profile.removeDisplay') : t('profile.setDisplay')}
                      </Text>
                    </TouchableOpacity>

                    {/* Divider — Your Character */}
                    <View style={styles.charDivider}>
                      <View style={[styles.charDividerLine, { backgroundColor: colors.border }]} />
                      <Text style={[styles.charDividerLabel, { color: colors.mutedForeground }]}>{t('profile.yourCharacter')}</Text>
                      <View style={[styles.charDividerLine, { backgroundColor: colors.border }]} />
                    </View>

                    {/* Character info */}
                    <View style={styles.charRow}>
                      <View style={[styles.charAvatar, { borderColor: colors.primary, backgroundColor: colors.muted }]}>
                        <Image source={Images.character_default} style={styles.charAvatarImg} contentFit="cover" />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.charName, { color: colors.foreground }]}>{character.name}</Text>
                        {character.username && (
                          <Text style={[styles.charHandle, { color: colors.primary }]}>@{character.username}</Text>
                        )}
                        {character.bio ? (
                          <Text style={[styles.charBio, { color: colors.mutedForeground }]} numberOfLines={3}>
                            {character.bio}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Traits */}
                    {character.traits.length > 0 && (
                      <View style={styles.charTraits}>
                        {character.traits.map(t => (
                          <View key={t} style={[styles.charTraitChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}25` }]}>
                            <Text style={[styles.charTraitText, { color: colors.primary }]}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Mood */}
                    {character.mood && (
                      <View style={{ marginTop: 10 }}>
                        <MoodBadge mood={character.mood} />
                      </View>
                    )}

                    {/* Edit */}
                    <TouchableOpacity
                      style={[styles.deleteBtn, {
                        backgroundColor: `${colors.primary}12`,
                        borderColor:     colors.primary,
                        marginBottom: 8,
                      }]}
                      onPress={() => {
                        if (!selectedOutfit) return;
                        closeOutfit();
                        router.push({
                          pathname: '/create-outfit',
                          params: {
                            editId:          selectedOutfit.id,
                            editName:        selectedOutfit.name,
                            editDescription: selectedOutfit.description ?? '',
                            editStory:       (selectedOutfit as any).story ?? '',
                            editImageUri:    selectedOutfit.imageUri ?? '',
                            editTags:        JSON.stringify(selectedOutfit.tags ?? []),
                            editIsPublic:    selectedOutfit.isPublic ? 'true' : 'false',
                          },
                        } as any);
                      }}
                    >
                      <Icon name="edit-2" size={14} color={colors.primary} />
                      <Text style={[styles.deleteBtnText, { color: colors.primary }]}>
                        Edit outfit
                      </Text>
                    </TouchableOpacity>

                    {/* Delete */}
                    <TouchableOpacity
                      style={[styles.deleteBtn, {
                        backgroundColor: deletingOutfitInModal ? colors.destructive : `${colors.destructive}14`,
                        borderColor:     colors.destructive,
                      }]}
                      onPress={handleModalDelete}
                    >
                      <Icon name="trash-2" size={14} color={deletingOutfitInModal ? '#fff' : colors.destructive} />
                      <Text style={[styles.deleteBtnText, { color: deletingOutfitInModal ? '#fff' : colors.destructive }]}>
                        {deletingOutfitInModal ? 'Tap again to delete' : 'Delete outfit'}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ height: 12 }} />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Gallery photo lightbox ───────────────────────────── */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={closePhoto}
      >
        <View style={styles.galModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePhoto} />
          <View style={[styles.galModalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />

            {selectedPhoto && (
              <>
                <View style={[styles.galModalImageWrap, { backgroundColor: '#0A0820' }]}>
                  <Image
                    source={{ uri: selectedPhoto.imageUri }}
                    style={styles.galModalImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                </View>

                <View style={[styles.galModalBody, { paddingHorizontal: 20 }]}>
                  <Text style={[styles.galModalDate, { color: colors.mutedForeground }]}>
                    {new Date(selectedPhoto.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </Text>

                  {selectedPhoto.caption ? (
                    <Text style={[styles.galModalCaption, { color: colors.foreground }]}>
                      {selectedPhoto.caption}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.deleteBtn, {
                      backgroundColor: deletingPhoto ? colors.destructive : `${colors.destructive}14`,
                      borderColor: colors.destructive,
                      marginTop: 8,
                    }]}
                    onPress={handleDeletePhoto}
                  >
                    <Icon name="trash-2" size={14} color={deletingPhoto ? '#fff' : colors.destructive} />
                    <Text style={[styles.deleteBtnText, { color: deletingPhoto ? '#fff' : colors.destructive }]}>
                      {deletingPhoto ? 'Tap again to delete' : 'Delete photo'}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ height: 12 }} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Mood picker modal ────────────────────────────────── */}
      <Modal visible={showMoodPicker} transparent animationType="slide" onRequestClose={() => setShowMoodPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMoodPicker(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 4 }]}>Choose your mood</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Regular', color: colors.mutedForeground, fontStyle: 'italic', marginBottom: 16 }}>
                How are you feeling in the sky today?
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 24 }}>
                {Object.keys(MOOD_COLORS).map(mood => {
                  const isSelected = character.mood === mood;
                  const moodColor  = MOOD_COLORS[mood];
                  return (
                    <TouchableOpacity
                      key={mood}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 7,
                        paddingHorizontal: 14, paddingVertical: 9,
                        borderRadius: 20, borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? moodColor : `${moodColor}45`,
                        backgroundColor: isSelected ? `${moodColor}20` : `${moodColor}0A`,
                      }}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCharacter({ ...character, mood });
                        setShowMoodPicker(false);
                      }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: moodColor }} />
                      <Text style={{ fontSize: 14, fontFamily: isSelected ? 'Satoshi-Bold' : 'Satoshi-Regular', color: moodColor }}>
                        {mood}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Profile header (replaces banner + floating card)
  profileHeader: { paddingHorizontal: 20, paddingBottom: 24, overflow: 'hidden' },
  deco:   { position: 'absolute', fontSize: 13, color: 'rgba(200,184,232,0.42)', fontFamily: 'Satoshi-Bold' },
  decoSm: { position: 'absolute', fontSize: 8,  color: 'rgba(200,184,232,0.28)', fontFamily: 'Satoshi-Bold' },
  decoXs: { position: 'absolute', fontSize: 7,  color: 'rgba(200,184,232,0.20)', fontFamily: 'Satoshi-Bold' },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerIconBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  visPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  visPillText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },

  // Profile row (avatar left + info right)
  profileRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 4 },
  avatarWrap:   { position: 'relative', width: 82, height: 82 },
  avatarCircle: { width: 82, height: 82, borderRadius: 41, borderWidth: 2.5, overflow: 'hidden' },
  avatarEditBtn: { position: 'absolute', bottom: 1, right: 1, width: 22, height: 22, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  profileInfo:  { flex: 1, paddingTop: 3, gap: 3 },
  profileName:  { fontSize: 22, fontFamily: 'Satoshi-Bold', color: '#FFFFFF', letterSpacing: -0.4, lineHeight: 27 },
  profileHandle:{ fontSize: 13, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.72)' },
  profileBio:   { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 17 },

  // Stats row (inline, no card)
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 0,
  },
  statPill: { flex: 1, alignItems: 'center', gap: 3 },
  statPillNum: { fontSize: 20, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', letterSpacing: -0.5 },
  statPillLabel: { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(200,180,255,0.50)', letterSpacing: 0.4, textTransform: 'uppercase' },
  statPillDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(155,120,255,0.30)', marginHorizontal: 4 },

  // Trait chips scroll (used inside header)
  traitChipsScroll: { marginTop: 4, marginHorizontal: -20, marginBottom: 2 },
  traitChipsRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 6 },

  // Spotlight card (current outfit)
  spotlightCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  spotlightLabel: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  spotlightRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  spotlightImageWrap: {
    width: 120,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(120,86,255,0.22)',
  },
  spotlightName: {
    fontSize: 11,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)',
    lineHeight: 14,
  },
  spotlightInfo: {
    flex: 1,
    gap: 6,
    paddingTop: 2,
  },
  spotlightAboutLabel: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  spotlightDesc: {
    fontSize: 13,
    fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic',
    lineHeight: 19,
  },
  spotlightTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  spotlightTag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9,
    borderWidth: 1,
  },
  spotlightTagText: {
    fontSize: 11,
    fontFamily: 'Satoshi-Medium',
  },

  // Horizontal section (outfits/stories rows)
  hSection: {
    marginBottom: 24,
  },
  hSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  hSectionTitle: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.1,
  },
  hSectionLink: {
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
  },
  hSectionAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1,
  },
  hSectionAddText: {
    fontSize: 11, fontFamily: 'Satoshi-Bold',
  },
  hCountPill: {
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1,
  },
  hCountPillText: {
    fontSize: 10, fontFamily: 'Satoshi-Bold',
  },
  hScrollPad: {
    paddingRight: 16,
    gap: 10,
  },
  hOutfitCard: {
    width: 100,
    height: 130,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  hOutfitName: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)',
    lineHeight: 13,
  },
  hActivePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  hActivePillText: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
    color: '#fff',
  },
  hRarityPill: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hRarityText: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
  },
  hAddCard: {
    width: 80,
    height: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  hAddText: {
    fontSize: 11,
    fontFamily: 'Satoshi-Medium',
  },
  hStoryCard: {
    width: 110,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  hStoryTitle: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)',
    lineHeight: 13,
  },
  hViewCount: {
    position: 'absolute',
    top: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  hViewCountText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,200,255,0.9)',
  },

  // Name / Bio
  nameSection:     { alignItems: 'center', gap: 5, paddingHorizontal: 24, marginTop: 10, marginBottom: 4 },
  nameRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:            { fontSize: 24, fontFamily: 'Satoshi-Bold', letterSpacing: -0.5 },
  editHint:        { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  nameEditWrap:    { borderBottomWidth: 2, paddingBottom: 3, alignSelf: 'stretch', alignItems: 'center' },
  nameEditInput:   { fontSize: 22, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4, textAlign: 'center' },
  usernameRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  usernameText:    { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  usernamePlaceholder: { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  usernameEditWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  usernameAt:      { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  usernameEditInput: { flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular' },
  usernameError:   { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  bioRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  bio:             { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 18, textAlign: 'center' },
  bioInput:        { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 18, borderWidth: 1, borderRadius: 10, padding: 10, alignSelf: 'stretch' },
  moodRow:         { marginTop: 4 },

  // Body
  body: { paddingHorizontal: 16, paddingTop: 16 },

  // Stats
  statsCard:   { flexDirection: 'row', borderWidth: 1, borderRadius: 16, paddingVertical: 16, marginBottom: 12, marginTop: 14 },
  statItem:    { flex: 1, alignItems: 'center', gap: 4 },
  statNum:     { fontSize: 17, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  statLabel:   { fontSize: 10, fontFamily: 'Satoshi-Medium', letterSpacing: 0.4, textTransform: 'uppercase' },
  statDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },

  // Section card (stories / wardrobe nav)
  sectionCard:       { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 16, gap: 12 },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionCardLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionCardIcon:   { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionCardTitle:  { fontSize: 13, fontFamily: 'Satoshi-Bold', marginBottom: 1 },
  sectionCardSub:    { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  arrowCircle:       { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  thumbsRow:         { flexDirection: 'row', height: 96 },
  storyThumb:        { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1C1840', position: 'relative' },
  thumbGrad:         { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  thumbTitle:        { position: 'absolute', bottom: 6, left: 6, right: 6, fontSize: 9, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.92)', lineHeight: 12 },
  thumbMore:         { width: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  thumbMoreText:     { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  emptyHint:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 18 },
  emptyHintText:     { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },

  // Sections
  section:       { borderTopWidth: 1, paddingTop: 20, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:  { fontSize: 15, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  sectionSub:    { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', marginTop: 2 },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addBtnText:    { color: '#fff', fontSize: 12, fontFamily: 'Satoshi-Bold' },

  // Outfit empty state
  emptyOutfitCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 16 },
  emptyOutfitIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emptyOutfitTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  emptyOutfitSub:   { fontSize: 12, fontFamily: 'Satoshi-Regular' },

  // Outfit grid
  outfitGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
  outfitGridCard:  { borderRadius: 14, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  outfitGridGrad:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' },
  outfitActiveBadge:     { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  outfitActiveBadgeText: { fontSize: 12, color: '#fff' },
  outfitGridName:  { position: 'absolute', bottom: 8, left: 8, right: 8, fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.95)' },

  // Traits
  traitsWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  traitChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 3, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  traitText:   { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  traitRemove: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  traitAddWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  traitInput:  { fontSize: 12, fontFamily: 'Satoshi-Regular', minWidth: 80, maxWidth: 120 },
  traitAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed' },
  traitAddText: { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  suggRow:     { marginTop: 14, gap: 8 },
  suggLabel:   { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.2, textTransform: 'uppercase' },
  suggChips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  suggText:    { fontSize: 12, fontFamily: 'Satoshi-Regular' },

  // Theme toggle
  themeToggleRow: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4, marginBottom: 4 },
  themeOption:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  themeOptionText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  // Account
  accountCardWrap:      { paddingTop: 22, marginBottom: 8 },
  accountSectionLabel:  { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  accountCard:     { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  accountRow:      { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  accountIconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  accountInfo:     { flex: 1 },
  accountInfoLabel: { fontSize: 10, fontFamily: 'Satoshi-Regular', marginBottom: 2 },
  accountInfoVal:  { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  accountDivider:  { height: 1, marginHorizontal: 14 },
  signOutRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  signOutText:     { fontSize: 14, fontFamily: 'Satoshi-Bold', flex: 1 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', overflow: 'hidden' },
  modalHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(120,86,255,0.25)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  modalImageWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  modalImage:     { width: '100%', height: 220, alignItems: 'center', justifyContent: 'center' },
  modalActivePill: { position: 'absolute', bottom: 12, left: 16, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  modalActivePillText: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: 0.2 },
  modalBody:    { paddingVertical: 16, gap: 12 },
  modalNameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  modalOutfitName: { flex: 1, fontSize: 20, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4 },
  modalOutfitDate: { fontSize: 12, fontFamily: 'Satoshi-Regular', marginTop: 4, flexShrink: 0 },
  modalTags:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modalTag:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  modalTagText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  modalDesc:       { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 21 },
  modalStoryCard:  { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  modalStoryHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalStoryLabel: { fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 0.6, textTransform: 'uppercase' },
  modalStoryText:  { fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 22 },
  setDisplayBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 16, borderWidth: 1.5 },
  setDisplayBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  charDivider:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  charDividerLine:  { flex: 1, height: 1 },
  charDividerLabel: { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.5 },
  charRow:          { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  charAvatar:       { width: 52, height: 52, borderRadius: 26, borderWidth: 2, overflow: 'hidden', flexShrink: 0 },
  charAvatarImg:    { width: '100%', height: '100%' },
  charName:         { fontSize: 16, fontFamily: 'Satoshi-Bold' },
  charHandle:       { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  charBio:          { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 18, marginTop: 2 },
  charTraits:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  charTraitChip:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  charTraitText:    { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  deleteBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 14, borderWidth: 1, marginTop: 4 },
  deleteBtnText:    { fontSize: 14, fontFamily: 'Satoshi-Bold' },

  aboutIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  aboutLabel: { fontSize: 10, fontFamily: 'Satoshi-Medium', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 1 },
  aboutValue: { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  aboutInput: {
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    borderWidth: 1.5, borderRadius: 9,
    paddingHorizontal: 10, paddingVertical: 6,
    marginTop: 2,
  },
  linkAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1,
  },
  linkAddText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  linkItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 0.75,
    paddingHorizontal: 10, paddingVertical: 8,
  },

  // Social links
  socialLinkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 0.75,
    backgroundColor: 'rgba(155,120,255,0.07)',
    paddingHorizontal: 10, paddingVertical: 9,
  },
  socialBadge: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  socialIcon: { fontSize: 17, lineHeight: 20 },
  socialPlatformName: {
    fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', lineHeight: 16,
  },
  socialHandle: {
    fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.55)', marginTop: 1,
  },
  platformGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingTop: 2,
  },
  platformChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderRadius: 12,
    backgroundColor: 'rgba(155,120,255,0.06)',
    paddingHorizontal: 10, paddingVertical: 7,
    minWidth: '43%', flexGrow: 1,
  },
  platformChipIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  platformChipLabel: {
    fontSize: 12, fontFamily: 'Satoshi-Medium', color: '#EDE8FF',
  },
  handleInputCard: {
    borderWidth: 1, borderRadius: 14,
    backgroundColor: 'rgba(155,120,255,0.07)',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  handleInput: {
    fontSize: 13, fontFamily: 'Satoshi-Regular', color: '#EDE8FF',
    backgroundColor: 'rgba(155,120,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(155,120,255,0.28)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  saveLinkBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Gallery
  galGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  galThumb: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#1A1630' },
  galError: { fontSize: 12, fontFamily: 'Satoshi-Regular', marginBottom: 8 },

  // Gallery lightbox modal
  galModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  galModalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', overflow: 'hidden' },
  galModalImageWrap: { width: '100%', aspectRatio: 1, overflow: 'hidden' },
  galModalImage:   { width: '100%', height: '100%' },
  galModalBody:    { paddingVertical: 16, gap: 10 },
  galModalDate:    { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  galModalCaption: { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 21 },

  // About Me card
  aboutCard: {
    borderRadius: 18, borderWidth: 1,
    marginBottom: 20, overflow: 'hidden',
  },
  aboutCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  aboutCardIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  aboutCardTitle: {
    fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.1,
  },
  aboutRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 13, gap: 10,
  },
  aboutRowLeft: { flex: 1, gap: 3 },
  aboutRowLabel: { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4, textTransform: 'uppercase' },
  aboutRowVal: { fontSize: 14, fontFamily: 'Satoshi-Medium', lineHeight: 20 },
  aboutRowInput: {
    fontSize: 14, fontFamily: 'Satoshi-Medium',
    borderBottomWidth: 1, paddingVertical: 2, paddingHorizontal: 0,
  },
  aboutAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
  },
  aboutAddBtnText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  aboutLinkRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  aboutLinkIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  aboutLinkName: { fontSize: 13, fontFamily: 'Satoshi-Bold', lineHeight: 18 },
  aboutLinkHandle: { fontSize: 11, fontFamily: 'Satoshi-Regular', lineHeight: 16 },

  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5,
  },
  roleChipLabel: { fontSize: 13, fontFamily: 'Satoshi-Bold', letterSpacing: -0.1 },
  roleChipHint:  { fontSize: 10, fontFamily: 'Satoshi-Regular' },
  roleSelDot: { width: 5, height: 5, borderRadius: 2.5, marginLeft: 2 },

  pingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  pingLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pingIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  pingTitle:   { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  pingSub:     { fontSize: 11, fontFamily: 'Satoshi-Regular' },
  pingBtn:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
  pingBtnText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  // Horizontal section empty state card
  hEmptyCard: {
    borderRadius: 16, borderWidth: 1,
    paddingVertical: 22, paddingHorizontal: 20,
    alignItems: 'center', gap: 8,
  },
  hEmptyIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  hEmptyTitle: {
    fontSize: 14, fontFamily: 'Satoshi-Bold', textAlign: 'center',
  },
  hEmptySubtitle: {
    fontSize: 12, fontFamily: 'Satoshi-Regular', textAlign: 'center',
    fontStyle: 'italic', lineHeight: 17,
  },

  // Compact outfit card (main profile page)
  compactOutfitCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 12,
    marginBottom: 12,
  },
  compactOutfitImg: {
    width: 64, height: 72, borderRadius: 12, overflow: 'hidden',
    backgroundColor: 'rgba(155,120,255,0.12)',
  },

  // Gallery horizontal thumb
  hGalleryThumb: {
    width: 100, height: 100, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#1A1630',
  },

  // Settings drawer
  settingsDrawer: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    zIndex: 30, shadowColor: '#000', shadowOpacity: 0.5,
    shadowOffset: { width: -8, height: 0 }, shadowRadius: 24, elevation: 20,
  },
  drawerHeader: {
    alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: 'rgba(155,120,255,0.12)',
    gap: 6,
  },
  drawerAvatar: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, overflow: 'hidden',
    marginBottom: 4,
  },
  drawerName: {
    fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', letterSpacing: -0.3,
  },
  drawerHandle: {
    fontSize: 13, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.60)',
  },
  drawerSectionLabel: {
    fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 2,
    color: 'rgba(200,184,232,0.40)', textTransform: 'uppercase',
    paddingHorizontal: 16, marginTop: 20, marginBottom: 8,
  },
  drawerGroup: {
    marginHorizontal: 12, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(155,120,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  drawerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
    minHeight: 48,
  },
  drawerItemIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(155,120,255,0.12)',
  },
  drawerItemLabel: {
    fontSize: 13, fontFamily: 'Satoshi-Medium', color: '#EDE8FF',
  },
  drawerDivider: {
    height: 1, backgroundColor: 'rgba(155,120,255,0.10)', marginHorizontal: 14,
  },
  drawerVersion: {
    fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.30)',
    textAlign: 'center', marginTop: 28, marginBottom: 8,
  },
});
