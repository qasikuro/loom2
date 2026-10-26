import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { SkyLoadingMark } from '@/components/SkyLoading';
import { ChatStickerAnimation, type StickerAnimType } from '@/components/ChatStickerAnimation';
import { ChatMessagePhoto, ChatPhotoDraft, ChatPhotoViewer } from '@/components/ChatPhoto';
import * as ImagePicker from 'expo-image-picker';
import { ImageUploadError, persistImageUri } from '@/utils/persistImage';
import type { ChatMessageInput } from '@workspace/api-client-react';
import { ApiError, apiFetch, useApp } from '@/context/AppContext';
import { showToastGlobal } from '@/components/Toast';
import { safeBack } from '@/utils/navigation';
import {
  fetchDmConversation,
  forgetDmConversation,
  getDmConversationCache,
  markDmConversationOpened,
  rememberDmConversation,
  wasDmConversationOpened,
  type DmCachedMessage,
} from '@/utils/dmConversationCache';
import { useSound } from '@/context/SoundContext';
import { useSSE } from '@/hooks/useSSE';
import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { SecureImage as Image } from '@/components/SecureImage';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Platform,
  type ImageSourcePropType,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ScreenKeyboardProvider } from '@/components/ScreenKeyboardProvider';
import { restoreFailedChatDraft } from '@/utils/chatDraft';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { ChatLumiCompanion } from '@/features/lumi/chat/ChatLumiCompanion';
import { getChatEmote, type ChatEmoteId } from '@/features/lumi/chat/chatEmotes';
import { useLumiActivity } from '@/features/lumi/home/useLumiActivity';
import {
  acceptSharedReaction, MAX_SHARED_REACTION_EVENTS, mergeConfirmedChatMessage, parseSharedReaction,
  seedSharedReactionHistory, sharedReactionContent,
  type SharedLumiEvent, type SharedReactionTracker,
} from '@/features/lumi/chat/sharedChatReactions';

// ── Constants ─────────────────────────────────────────────────────────────────
const NIGHT   = '#080618';

const PURPLE  = '#6B4EE8';
const PURPLE2 = '#3B2A8C';
const BORDER  = 'rgba(200,184,232,0.10)';
const MUTED   = 'rgba(200,184,232,0.45)';

// ── Types ─────────────────────────────────────────────────────────────────────
type Message = DmCachedMessage;

type ListItem =
  | { type: 'date'; date: string; key: string }
  | { type: 'msg';  msg: Message; key: string };

// ── Sticker registry ──────────────────────────────────────────────────────────

export interface StickerDef {
  id:         string;
  emoji:      string;
  artwork:    ImageSourcePropType;
  label:      string;
  color:      string;
  anim:       StickerAnimType;
  haptic:     'light' | 'medium' | 'heavy';
  ownLabel:   string;
  otherLabel: string;
}

// Static requires let Metro package transparent PNGs into native builds and OTAs.
/* eslint-disable @typescript-eslint/no-require-imports */
export const STICKERS: StickerDef[] = [
  { id: 'bomb',     emoji: '💥', artwork: require('../../assets/chat-stickers/01_boom.png'),      label: 'BOOM!',    color: '#FF7487', anim: 'explode',   haptic: 'heavy',  ownLabel: 'you threw a bomb',       otherLabel: 'threw a bomb 💥'       },
  { id: 'stone',    emoji: '✦',  artwork: require('../../assets/chat-stickers/02_bonk.png'),      label: 'BONK!',    color: '#CE9668', anim: 'throw',     haptic: 'medium', ownLabel: 'you threw a stone',      otherLabel: 'threw a stone 🪨'      },
  { id: 'mirror',   emoji: '✧',  artwork: require('../../assets/chat-stickers/03_shatter.png'),   label: 'SHATTER!', color: '#78B8EF', anim: 'shatter',   haptic: 'heavy',  ownLabel: 'you broke the mirror',   otherLabel: 'broke the mirror ✦'    },
  { id: 'kiss',     emoji: '♥',  artwork: require('../../assets/chat-stickers/04_mwah.png'),      label: 'MWAH!',    color: '#F16FA4', anim: 'hearts',    haptic: 'light',  ownLabel: 'you sent a kiss',        otherLabel: 'sent you a kiss 💕'    },
  { id: 'stars',    emoji: '✦',  artwork: require('../../assets/chat-stickers/05_dazzled.png'),   label: 'DAZZLED!', color: '#E6A839', anim: 'starburst', haptic: 'light',  ownLabel: 'you scattered stars',    otherLabel: 'scattered stars ✦'     },
  { id: 'fire',     emoji: '✧',  artwork: require('../../assets/chat-stickers/06_fire.png'),      label: 'FIRE!',    color: '#F2764E', anim: 'fire',      haptic: 'medium', ownLabel: 'you lit a fire',         otherLabel: 'lit a fire 🔥'         },
  { id: 'snow',     emoji: '❄',  artwork: require('../../assets/chat-stickers/07_brr.png'),       label: 'BRR~',     color: '#67AEE7', anim: 'snow',      haptic: 'light',  ownLabel: 'you cast a blizzard',    otherLabel: 'cast a blizzard ❄️'    },
  { id: 'confetti', emoji: '✦',  artwork: require('../../assets/chat-stickers/08_yay.png'),       label: 'YAY!',     color: '#D573CE', anim: 'confetti',  haptic: 'medium', ownLabel: 'you celebrated',         otherLabel: 'celebrated 🎉'         },
  { id: 'candle',   emoji: '✧',  artwork: require('../../assets/chat-stickers/09_candle.png'),    label: 'CANDLE',   color: '#DEA746', anim: 'glow',      haptic: 'light',  ownLabel: 'you offered a candle',   otherLabel: 'offered a candle 🕯️'  },
  { id: 'spark',    emoji: '✦',  artwork: require('../../assets/chat-stickers/10_spark.png'),     label: 'SPARK',    color: '#A982EB', anim: 'sparkle',   haptic: 'light',  ownLabel: 'you sent a spark',       otherLabel: 'sent a spark ✦'        },
  { id: 'lantern',  emoji: '✧',  artwork: require('../../assets/chat-stickers/11_lantern.png'),  label: 'LANTERN',  color: '#6EA9E0', anim: 'float',     haptic: 'light',  ownLabel: 'you lit a lantern',      otherLabel: 'lit a lantern 🌙'      },
  { id: 'hush',     emoji: '·',  artwork: require('../../assets/chat-stickers/12_hush.png'),     label: 'HUSH~',    color: '#A48DD8', anim: 'fade',      haptic: 'light',  ownLabel: 'you fell silent',        otherLabel: 'fell silent 🤫'        },
  { id: 'donkey',   emoji: '♫',  artwork: require('../../assets/chat-stickers/13_hee_haw.png'),  label: 'HEE-HAW!', color: '#C9956D', anim: 'donkey',    haptic: 'heavy',  ownLabel: 'you sent the donkey',    otherLabel: 'sent the donkey 🫏'    },
  { id: 'wolf',     emoji: '✦',  artwork: require('../../assets/chat-stickers/14_awoo.png'),    label: 'AWOO~',    color: '#729ADB', anim: 'wolf',      haptic: 'medium', ownLabel: 'you howled at the moon', otherLabel: 'howled at the moon 🌕' },
];
/* eslint-enable @typescript-eslint/no-require-imports */

export function getSticker(id: string): StickerDef {
  return STICKERS.find(s => s.id === id) ?? STICKERS[9];
}

// ── Haptic helpers ────────────────────────────────────────────────────────────
async function fireHaptic(def: StickerDef) {
  switch (def.haptic) {
    case 'heavy':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise(r => setTimeout(r, 80));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    case 'medium':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise(r => setTimeout(r, 60));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    default:
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string, t: (key: string) => string) {
  const d   = new Date(iso);
  const now = new Date();
  const dt  = now.getTime() - d.getTime();
  if (dt < 86400000 && d.getDay() === now.getDay()) return t('social.today');
  if (dt < 172800000) return t('social.yesterday');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Star background decoration ────────────────────────────────────────────────
const STARS = Array.from({ length: 28 }, (_, i) => ({
  key: `s${i}`,
  left: `${Math.random() * 98}%` as `${number}%`,
  top:  `${Math.random() * 90}%` as `${number}%`,
  size: Math.random() < 0.18 ? 2.2 : 1.2,
  opacity: 0.12 + Math.random() * 0.3,
}));

// ── Sticker bubble (in chat history) ─────────────────────────────────────────
function StickerBubble({ msg, partnerInitial, avatarUri, primaryColor, textColor, onLongPress }: {
  msg: Message; partnerInitial: string; avatarUri?: string; primaryColor: string; textColor: string;
  onLongPress?: () => void;
}) {
  const { t } = useTranslation();
  const def    = getSticker(msg.expression!);
  const scaleA = useRef(new Animated.Value(0.3)).current;
  const opA    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleA, { toValue: 1, tension: 150, friction: 7, useNativeDriver: true }),
      Animated.timing(opA, { toValue: 1, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = t(`social.sticker_${def.id}_${msg.isOwn ? 'own' : 'other'}`);

  const cardInner = (
    <View style={[styles.stickerCard, { borderColor: `${def.color}68`, backgroundColor: `${def.color}12` }]}>
      <Image source={def.artwork} style={styles.stickerArtwork} contentFit="contain" transition={140} />
      <View style={styles.stickerTimestamp}>
        <Text style={[styles.stickerCardTime, { color: textColor }]}>{fmtTime(msg.createdAt)}</Text>
      </View>
    </View>
  );

  if (msg.isOwn) {
    return (
      <View style={styles.exprRowOwn}>
        <Animated.View style={{ opacity: opA, transform: [{ scale: scaleA }] }}>
          <TouchableOpacity
            onLongPress={onLongPress}
            delayLongPress={350}
            activeOpacity={0.85}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${t(`social.sticker_${def.id}_label`)}. ${label}, ${fmtTime(msg.createdAt)}`}
            accessibilityHint={t('social.holdForOptions', { defaultValue: 'Hold for message options.' })}
          >
            {cardInner}
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.exprRowOther}>
      <View style={[styles.bubbleAvatarSm, { backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}30`, overflow: 'hidden' }]}>
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <Text style={[styles.bubbleAvatarSmText, { color: primaryColor }]}>{partnerInitial}</Text>
        }
      </View>
      <Animated.View style={{ opacity: opA, transform: [{ scale: scaleA }] }}>
        {cardInner}
      </Animated.View>
    </View>
  );
}

type DmRowColors = {
  own: string;
  other: string;
  otherBorder: string;
  otherText: string;
  sub: string;
};

type DmMessageCellProps = {
  item: ListItem;
  partnerInitial: string;
  avatarUri?: string;
  name?: string;
  contentWidth: number;
  colors: DmRowColors;
  onDelete: (message: Message) => void;
  onOpenPhoto: (uri: string) => void;
};

const DmMessageCell = React.memo(function DmMessageCell({
  item, partnerInitial, avatarUri, name, contentWidth, colors, onDelete, onOpenPhoto,
}: DmMessageCellProps) {
  if (item.type === 'date') {
    return (
      <View style={styles.dateSep}>
        <View style={styles.dateLine} />
        <View style={styles.datePill}>
          <Text style={styles.dateText}>{item.date}</Text>
        </View>
        <View style={styles.dateLine} />
      </View>
    );
  }

  const msg = item.msg;
  const deleteMessage = () => onDelete(msg);
  if (msg.expression) {
    return (
      <StickerBubble
        msg={msg}
        partnerInitial={partnerInitial}
        avatarUri={avatarUri}
        primaryColor={PURPLE}
        textColor={colors.sub}
        onLongPress={deleteMessage}
      />
    );
  }
  return (
    <View style={[styles.msgRow, msg.isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
      {!msg.isOwn && (
        <View style={[styles.bubbleAvatarSm, { backgroundColor: 'rgba(107,78,232,0.18)', borderColor: 'rgba(107,78,232,0.30)', overflow: 'hidden' }]}>
          {avatarUri
            ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            : <Text style={[styles.bubbleAvatarSmText, { color: PURPLE }]}>{partnerInitial}</Text>}
        </View>
      )}
      <TouchableOpacity
        style={[
          styles.bubble,
          msg.isOwn ? styles.bubbleOwn : styles.bubbleOther,
          msg.isOwn ? { backgroundColor: colors.own } : { backgroundColor: colors.other, borderColor: colors.otherBorder },
          msg.imageUri && styles.bubblePhoto,
        ]}
        onLongPress={deleteMessage}
        onPress={msg.imageUri ? () => onOpenPhoto(msg.imageUri!) : undefined}
        accessibilityRole={msg.imageUri ? 'imagebutton' : undefined}
        accessible={!msg.imageUri}
        accessibilityLabel={msg.imageUri
          ? `${msg.isOwn ? 'You' : (name ?? 'Partner')} sent a photo${msg.content ? `: ${msg.content}` : ''}, ${fmtTime(msg.createdAt)}`
          : `${msg.isOwn ? 'You' : (name ?? 'Partner')}: ${msg.content ?? ''}, ${fmtTime(msg.createdAt)}`}
        accessibilityHint={msg.imageUri ? 'Opens the photo. Hold for message options.' : msg.isOwn ? 'Hold for message options.' : undefined}
        activeOpacity={0.85}
        delayLongPress={350}
      >
        {msg.imageUri && (
          <ChatMessagePhoto
            uri={msg.imageUri}
            width={Math.min(contentWidth * 0.62, 280)}
            onOpen={() => onOpenPhoto(msg.imageUri!)}
            onLongPress={deleteMessage}
          />
        )}
        {!!msg.content && (
          <Text maxFontSizeMultiplier={1.35} style={[styles.bubbleText, msg.imageUri && styles.photoCaption, { color: msg.isOwn ? '#FBF9FF' : colors.otherText }]}>
            {msg.content}
          </Text>
        )}
        <Text maxFontSizeMultiplier={1.2} style={[styles.bubbleTime, msg.imageUri && styles.photoCaption, { color: msg.isOwn ? 'rgba(255,255,255,0.68)' : colors.sub }]}>
          {fmtTime(msg.createdAt)}
        </Text>
      </TouchableOpacity>
    </View>
  );
}, (previous, next) => {
  const sameItem = previous.item.type === next.item.type
    && previous.item.key === next.item.key
    && (previous.item.type === 'date'
      ? next.item.type === 'date' && previous.item.date === next.item.date
      : next.item.type === 'msg' && previous.item.msg === next.item.msg);
  return sameItem
    && previous.partnerInitial === next.partnerInitial
    && previous.avatarUri === next.avatarUri
    && previous.name === next.name
    && previous.contentWidth === next.contentWidth
    && previous.colors === next.colors
    && previous.onDelete === next.onDelete
    && previous.onOpenPhoto === next.onOpenPhoto;
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  // Keyboard-controller provider scoped to this screen's content only.
  return (
    <ScreenKeyboardProvider>
      <MessagesScreenContent />
    </ScreenKeyboardProvider>
  );
}

function MessagesScreenContent() {
  const { t } = useTranslation();
  const { userId, name, handle, avatarUri, isGuide } = useLocalSearchParams<{
    userId:     string;
    name?:      string;
    handle?:    string;
    avatarUri?: string;
    isGuide?:   string;
  }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const c = useColors();
  const th = useMemo(() => ({
    bg: c.background,
    header: (isDark ? [c.night, c.card, c.secondary] : [c.card, c.background, c.muted]) as [string, string, string],
    star: c.lavender,
    ink: c.foreground,
    sub: c.mutedForeground,
    other: isDark ? c.secondary : c.card,
    otherBorder: c.border,
    otherText: c.foreground,
    own: isDark ? c.primary : PURPLE,
    bar: c.card,
    field: c.input,
    border: c.border,
  }), [
    isDark, c.background, c.night, c.card, c.secondary, c.muted,
    c.lavender, c.foreground, c.mutedForeground, c.primary, c.input, c.border,
  ]);
  const { width: windowWidth } = useWindowDimensions();
  const { markDmThreadRead, blockedIds, blockUser, unblockUser, dmThreads } = useApp();
  const { playStickerSound } = useSound();
  const { userId: myUserId } = useAuth();

  const initialMessages = useMemo(
    () => getDmConversationCache(myUserId, userId),
    [myUserId, userId],
  );
  const [messages,      setMessages]      = useState<Message[]>(initialMessages);
  const [loading,       setLoading]       = useState(initialMessages.length === 0);
  const [sending,       setSending]       = useState(false);
  const [reactionEvents, setReactionEvents] = useState<SharedLumiEvent[]>([]);
  const [reactionPlaybackEpoch, setReactionPlaybackEpoch] = useState(0);
  const reactionTrackerRef = useRef<SharedReactionTracker>({ seen: initialMessages.map(m => m.id) });
  const reactionHistoryReadyRef = useRef(false);
  const reactionSendRef = useRef<AbortController | null>(null);
  const recentReactionsRef = useRef(new Map<string, { message: Message; receivedAt: number }>());
  const chatActivity = useLumiActivity();
  const chatActiveRef = useRef(chatActivity.active);
  chatActiveRef.current = chatActivity.active;
  const [input,         setInput]         = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const uploadedPhotoRef = useRef<{ uri: string; path: string } | null>(null);
  const photoIdentity = JSON.stringify([myUserId, userId]);
  const photoIdentityRef = useRef(photoIdentity);
  photoIdentityRef.current = photoIdentity;
  useEffect(() => {
    photoIdentityRef.current = photoIdentity;
    setMessages(initialMessages);
    setLoading(initialMessages.length === 0);
    lastMsgIdRef.current = initialMessages.at(-1)?.id ?? null;
    setError(null);
    setPhotoUri(null);
    setViewingPhoto(null);
    setPickingPhoto(false);
    setSending(false);
    reactionSendRef.current?.abort();
    reactionSendRef.current = null;
    reactionTrackerRef.current = { seen: initialMessages.map(m => m.id) };
    reactionHistoryReadyRef.current = false;
    recentReactionsRef.current.clear();
    setReactionEvents([]);
    uploadedPhotoRef.current = null;
    return () => {
      photoIdentityRef.current = '';
      reactionSendRef.current?.abort();
      reactionSendRef.current = null;
    };
  }, [photoIdentity]);

  const recordSharedReaction = useCallback((message: Message) => {
    if (!myUserId || !userId || photoIdentity !== photoIdentityRef.current) return;
    const event = acceptSharedReaction(reactionTrackerRef.current, message, {
      viewerId: myUserId, partnerId: userId, active: chatActiveRef.current, now: Date.now(),
    });
    if (!event) return;
    recentReactionsRef.current.set(message.id, { message, receivedAt: Date.now() });
    if (recentReactionsRef.current.size > 32) {
      recentReactionsRef.current.delete(recentReactionsRef.current.keys().next().value!);
    }
    setReactionEvents(previous => [...previous, event].slice(-MAX_SHARED_REACTION_EVENTS));
  }, [myUserId, userId, photoIdentity]);

  const resetSharedPlayback = useCallback(() => {
    if (reactionSendRef.current) {
      reactionSendRef.current.abort();
      reactionSendRef.current = null;
      setSending(false);
    }
    recentReactionsRef.current.clear();
    setReactionEvents([]);
    setReactionPlaybackEpoch(previous => previous + 1);
  }, []);
  const [error,         setError]         = useState<string | null>(null);
  const [showPicker,    setShowPicker]    = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const [playingAnim, setPlayingAnim] = useState<{ type: StickerAnimType; emoji: string; artwork: ImageSourcePropType } | null>(null);

  const lastMsgIdRef    = useRef<string | null>(
    wasDmConversationOpened(myUserId, userId)
      ? initialMessages[initialMessages.length - 1]?.id ?? null
      : null,
  );
  const flatRef         = useRef<FlatList<ListItem>>(null);
  const prevSseRef      = useRef(false);
  const typingTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 8);
  const contentWidth = Math.min(windowWidth, 680);

  const partnerSubtitle = isGuide === 'true'
    ? t('social.guide')
    : handle ? `@${handle}` : null;

  const isBlocked = blockedIds.includes(userId ?? '');
  const inboxPreview = dmThreads.find(thread => thread.partnerId === userId)?.lastMessage ?? '';

  useEffect(() => {
    if (myUserId && userId) rememberDmConversation(myUserId, userId, messages);
  }, [messages, myUserId, userId]);

  const handleClearConversation = useCallback(() => {
    if (!userId) return;
    Alert.alert(
      t('social.clearConversation'),
      t('social.clearConversationBody'),
      [
        { text: t('social.cancel'), style: 'cancel' },
        {
          text: t('social.clear'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/messages/conversation/${userId}`, { method: 'DELETE' });
              forgetDmConversation(myUserId, userId);
              setMessages([]);
            } catch {
              Alert.alert(t('social.error'), t('social.clearError'));
            }
          },
        },
      ],
    );
  }, [t, userId, myUserId]);

  function handleMoreMenu() {
    if (!userId) return;
    const partnerName = name ?? t('social.thisUser');
    const blockOption = isBlocked
      ? { text: t('social.unblockUser'), onPress: () => unblockUser(userId) }
      : {
          text: t('social.blockUser'),
          style: 'destructive' as const,
          onPress: () => { blockUser(userId).catch(() => null); safeBack(); },
        };
    Alert.alert(
      partnerName,
      undefined,
      [
        { text: t('social.clearConversation'), onPress: handleClearConversation },
        blockOption,
        { text: t('social.cancel'), style: 'cancel' },
      ],
    );
  }

  const playSticker = useCallback((def: StickerDef) => {
    setPlayingAnim({ type: def.anim, emoji: def.emoji, artwork: def.artwork });
    fireHaptic(def);
    playStickerSound(def.id);
  }, [playStickerSound]);

  // Queue of sticker animations waiting to play (so back-to-back stickers each get their moment)
  const stickerQueueRef = useRef<StickerDef[]>([]);
  const animBusyRef     = useRef(false);

  const drainStickerQueue = useCallback(() => {
    if (animBusyRef.current || stickerQueueRef.current.length === 0) return;
    const next = stickerQueueRef.current.shift()!;
    animBusyRef.current = true;
    setPlayingAnim({ type: next.anim, emoji: next.emoji, artwork: next.artwork });
    fireHaptic(next);
    playStickerSound(next.id);
  }, [playStickerSound]);

  const queueSticker = useCallback((def: StickerDef) => {
    stickerQueueRef.current.push(def);
    drainStickerQueue();
  }, [drainStickerQueue]);

  // Called when the overlay animation finishes — play next in queue if any
  const handleAnimComplete = useCallback(() => {
    setPlayingAnim(null);
    animBusyRef.current = false;
    drainStickerQueue();
  }, [drainStickerQueue]);

  const load = useCallback(async () => {
    const identity = photoIdentity;
    if (identity !== photoIdentityRef.current) return;
    const startedAt = Date.now();
    if (!userId) {
      setError(t('social.conversationMissing'));
      setLoading(false);
      return;
    }
    try {
      const data = await fetchDmConversation(
        myUserId,
        userId,
        () => apiFetch<Message[]>(`/messages/${userId}`),
      );
      if (identity !== photoIdentityRef.current) return;
      const msgs = [...(data ?? [])];
      if (!reactionHistoryReadyRef.current) {
        seedSharedReactionHistory(reactionTrackerRef.current, msgs);
        reactionHistoryReadyRef.current = true;
      } else {
        msgs.forEach(recordSharedReaction);
      }
      // A request started before a confirmed reaction must not erase that live
      // message when its older snapshot returns (SSE and POST can race a GET).
      const fetchedIds = new Set(msgs.map(message => message.id));
      const live = [...recentReactionsRef.current.values()]
        .filter(item => item.receivedAt >= startedAt && !fetchedIds.has(item.message.id))
        .map(item => item.message);
      if (live.length) {
        msgs.push(...live);
        msgs.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      }
      const isFirstLoad = lastMsgIdRef.current === null;

      if (!isFirstLoad && msgs.length > 0) {
        // ── Poll cycle: animate every new incoming sticker, in order ─────────
        const lastKnownIdx = msgs.findIndex(m => m.id === lastMsgIdRef.current);
        if (lastKnownIdx !== -1) {
          const newMsgs = msgs.slice(lastKnownIdx + 1);
          newMsgs
            .filter(m => !m.isOwn && m.expression)
            .forEach(m => queueSticker(getSticker(m.expression!)));
        }
      } else if (isFirstLoad && msgs.length > 0) {
        // ── First open: animate the most recent UNREAD sticker if fresh (≤ 3 min) ─
        const freshCutoff = Date.now() - 3 * 60 * 1000;
        const freshUnread = [...msgs]
          .reverse()
          .find(m => !m.isOwn && m.expression && !m.isRead && new Date(m.createdAt).getTime() > freshCutoff);
        if (freshUnread?.expression) {
          // Small delay so the screen finishes loading before the animation fires
          setTimeout(() => queueSticker(getSticker(freshUnread.expression!)), 700);
        }
      }

      if (msgs.length > 0) lastMsgIdRef.current = msgs[msgs.length - 1].id;

      setMessages(previous => {
        const unchanged = previous.length === msgs.length
          && previous.every((message, index) => {
            const next = msgs[index];
            return next
              && message.id === next.id
              && message.fromUserId === next.fromUserId
              && message.toUserId === next.toUserId
              && message.content === next.content
              && message.imageUri === next.imageUri
              && message.expression === next.expression
              && message.isRead === next.isRead
              && message.createdAt === next.createdAt
              && message.isOwn === next.isOwn;
          });
        return unchanged ? previous : msgs;
      });
      markDmThreadRead(userId);
      markDmConversationOpened(myUserId, userId);
    } catch {
      if (identity !== photoIdentityRef.current) return;
      if (getDmConversationCache(myUserId, userId).length === 0) {
        setError(t('social.loadMessagesError'));
      }
    } finally {
      if (identity === photoIdentityRef.current) setLoading(false);
    }
  }, [userId, myUserId, markDmThreadRead, queueSticker, photoIdentity, recordSharedReaction]);

  useEffect(() => { load(); }, [load]);

  // ── SSE: live push for incoming messages ──────────────────────────────────
  // Subscribe to our own userId channel — the server emits to it when anyone
  // sends us a message, so we can append without polling.
  // M-8: Capture the SSE connection state so the fallback poll can back off
  // when real-time delivery is active, reducing redundant fetches and flicker.
  const { connected: sseConnected } = useSSE(
    myUserId ? [`messages:${myUserId}`] : [],
    useCallback((_channel: string, data: unknown) => {
      if (photoIdentity !== photoIdentityRef.current || !data || typeof data !== 'object') return;
      const ev = data as {
        type: string; id?: string; fromUserId?: string; toUserId?: string;
        content?: string | null; expression?: string | null; imageUri?: string | null;
        isRead?: boolean; createdAt?: string; isOwn?: boolean;
        messageId?: string; forEveryone?: boolean; partnerId?: string;
      };

      const ownSharedReaction = ev?.fromUserId === myUserId && ev.toUserId === userId
        && !!parseSharedReaction(ev.content) && !ev.imageUri && !ev.expression;
      if (ev?.type === 'new_message' && (ev.fromUserId === userId || ownSharedReaction) && ev.id) {
        const newMsg: Message = {
          id: ev.id, fromUserId: ev.fromUserId!, toUserId: ev.toUserId ?? '',
          content: ev.content ?? null, expression: ev.expression ?? null,
          imageUri: ev.imageUri ?? null,
          isRead: ev.isRead ?? false, createdAt: ev.createdAt!, isOwn: ev.fromUserId === myUserId,
        };
        recordSharedReaction(newMsg);
        setMessages(prev => {
          if (prev.find(m => m.id === ev.id)) return prev;
          lastMsgIdRef.current = ev.id!;
          if (ev.expression) queueSticker(getSticker(ev.expression));
          markDmThreadRead(userId ?? '');
          return [...prev, newMsg];
        });
        return;
      }

      if (ev?.type === 'message_deleted' && ev.messageId) {
        setMessages(prev => prev.filter(m => m.id !== ev.messageId));
        return;
      }

      if (ev?.type === 'conversation_cleared' && ev.partnerId === userId) {
        resetSharedPlayback();
        forgetDmConversation(myUserId, userId);
        setMessages([]);
        return;
      }

      if (ev?.type === 'typing' && ev.fromUserId === userId) {
        setPartnerTyping(true);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setPartnerTyping(false), 4000);
      }
    }, [userId, myUserId, photoIdentity, markDmThreadRead, queueSticker, recordSharedReaction, resetSharedPlayback]),
  );

  // Gap-fill: when SSE reconnects, fetch to fill the gap
  useEffect(() => {
    if (sseConnected && !prevSseRef.current) {
      load().catch(() => null);
    }
    prevSseRef.current = sseConnected;
  }, [sseConnected, load]);

  // M-8: Background poll as SSE fallback. Backs off to 2 min when SSE is
  // connected — SSE already handles real-time delivery, so 30 s polling is
  // redundant and causes UI flicker from simultaneous state updates.
  useFocusEffect(useCallback(() => {
    const ms = sseConnected ? 2 * 60_000 : 30_000;
    const interval = setInterval(() => { load().catch(() => null); }, ms);
    return () => clearInterval(interval);
  }, [load, sseConnected]));

  // Inverted list: offset 0 is the newest message, so the keyboard resizing the
  // list never needs a scrollToEnd — the bottom anchor holds by construction.
  const inputRef = useRef<TextInput>(null);
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const jumpToNewest = useCallback(() => {
    flatRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const pickPhoto = useCallback(async () => {
    if (pickingPhoto || sending || loading) return;
    const identity = photoIdentityRef.current;
    setPickingPhoto(true);
    setShowPicker(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.85,
      });
      if (identity !== photoIdentityRef.current) return;
      if (!result.canceled && result.assets[0]?.uri) {
        uploadedPhotoRef.current = null;
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      showToastGlobal('Could not open your photos. Check photo permissions and try again.', 'warning');
    } finally {
      if (identity === photoIdentityRef.current) setPickingPhoto(false);
    }
  }, [pickingPhoto, sending, loading]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if ((!content && !photoUri) || sending || loading || pickingPhoto || !userId) return;
    const identity = photoIdentityRef.current;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setSending(true);
    const sentPhoto = photoUri;
    jumpToNewest();
    const optimistic: Message = {
      id: `temp-${Date.now()}`, fromUserId: 'me', toUserId: userId,
      content: content || null, imageUri: photoUri, expression: null, isRead: false, createdAt: new Date().toISOString(), isOwn: true,
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const body: ChatMessageInput = { ...(content ? { content } : {}) };
      if (photoUri) {
        let path = uploadedPhotoRef.current?.uri === photoUri ? uploadedPhotoRef.current.path : null;
        if (!path) {
          const uploaded = await persistImageUri(photoUri);
          path = uploaded.startsWith('/') ? uploaded : new URL(uploaded).pathname;
          if (!/^\/api\/images\/[\w.-]+$/.test(path)) throw new Error('Invalid uploaded photo');
          if (identity !== photoIdentityRef.current) return;
          uploadedPhotoRef.current = { uri: photoUri, path };
        }
        body.imageUri = path;
      }
      if (identity !== photoIdentityRef.current) return;
      const sent = await apiFetch<Message>(`/messages/${userId}${photoUri ? '/photos' : ''}`, {
        method: 'POST', body: JSON.stringify(body),
      });
      if (!sent?.id) throw new Error('Message was not confirmed');
      if (identity !== photoIdentityRef.current) return;
      setMessages(prev => mergeConfirmedChatMessage(prev, sent, optimistic.id));
      // Only clear the draft photo if it is still the one that was sent.
      setPhotoUri(current => (current === sentPhoto ? null : current));
      if (uploadedPhotoRef.current?.uri === sentPhoto) uploadedPhotoRef.current = null;
      if (sent?.id) lastMsgIdRef.current = sent.id;
    } catch (err) {
      if (identity !== photoIdentityRef.current) return;
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      // Restore the failed text without clobbering a draft typed meanwhile.
      setInput(current => restoreFailedChatDraft(current, content));
      if (err instanceof ApiError && err.status === 429) {
        const suffix = (err.retryAfter != null && err.retryAfter >= 5)
          ? ` Try again in ${err.retryAfter}s.`
          : '';
        showToastGlobal(`${t('social.slowDown')}${suffix}`, 'warning');
      } else {
        showToastGlobal(err instanceof ImageUploadError ? err.userMessage : 'Could not send your message. Please try again.', 'warning');
      }
    } finally {
      if (identity === photoIdentityRef.current) setSending(false);
    }
  }, [input, photoUri, sending, loading, pickingPhoto, userId, t, jumpToNewest]);

  const handleSendLumiReaction = useCallback(async (id: ChatEmoteId): Promise<boolean> => {
    if (!myUserId || !userId || !getChatEmote(id) || isBlocked || sending || loading || pickingPhoto
      || reactionSendRef.current || !chatActiveRef.current
      || photoIdentity !== photoIdentityRef.current) return false;
    const controller = new AbortController();
    reactionSendRef.current = controller;
    setSending(true);
    try {
      const sent = await apiFetch<Message>(`/messages/${userId}`, {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ content: sharedReactionContent(id) } satisfies ChatMessageInput),
      });
      if (controller.signal.aborted || photoIdentity !== photoIdentityRef.current) return false;
      if (!sent?.id || sent.fromUserId !== myUserId || sent.toUserId !== userId
        || parseSharedReaction(sent.content) !== id) throw new Error('Reaction was not confirmed');
      // No optimistic performance: both clients animate the persisted message.
      // SSE can arrive before this response; both paths deduplicate by message ID.
      recordSharedReaction(sent);
      setMessages(previous => mergeConfirmedChatMessage(previous, { ...sent, isOwn: true }));
      lastMsgIdRef.current = sent.id;
      return true;
    } catch (err) {
      if (controller.signal.aborted || photoIdentity !== photoIdentityRef.current) return false;
      const retry = err instanceof ApiError && err.status === 429;
      const suffix = retry && err.retryAfter ? ` Try again in ${err.retryAfter}s.` : '';
      showToastGlobal(retry ? `${t('social.slowDown')}${suffix}` : 'Could not send the Lumi reaction. Please try again.', 'warning');
      return false;
    } finally {
      if (reactionSendRef.current === controller) {
        reactionSendRef.current = null;
        if (photoIdentity === photoIdentityRef.current) setSending(false);
      }
    }
  }, [myUserId, userId, isBlocked, sending, loading, pickingPhoto, photoIdentity, recordSharedReaction, t]);

  const handleDeleteMsg = useCallback(async (msg: Message) => {
    if (!msg.isOwn) return;
    Alert.alert(
      t('social.deleteMessage'),
      t('social.deleteMessagePrompt'),
      [
        {
          text: t('social.deleteForMe'),
          onPress: async () => {
            setMessages(prev => prev.filter(m => m.id !== msg.id));
            apiFetch(`/messages/${msg.id}?forEveryone=false`, { method: 'DELETE' }).catch(() => null);
          },
        },
        {
          text: t('social.deleteForEveryone'),
          style: 'destructive',
          onPress: async () => {
            setMessages(prev => prev.filter(m => m.id !== msg.id));
            apiFetch(`/messages/${msg.id}?forEveryone=true`, { method: 'DELETE' }).catch(() => null);
          },
        },
        { text: t('social.cancel'), style: 'cancel' },
      ],
    );
  }, []);

  const handleSticker = useCallback(async (def: StickerDef) => {
    if (sending || loading || !userId) return;
    setShowPicker(false);
    setSending(true);
    playSticker(def);
    const optimistic: Message = {
      id: `temp-${Date.now()}`, fromUserId: 'me', toUserId: userId,
      content: null, expression: def.id, isRead: false, createdAt: new Date().toISOString(), isOwn: true,
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const sent = await apiFetch<Message>(`/messages/${userId}`, {
        method: 'POST', body: JSON.stringify({ expression: def.id }),
      });
      setMessages(prev => prev.map(m => m.id === optimistic.id ? (sent ?? optimistic) : m));
      if (sent?.id) lastMsgIdRef.current = sent.id;
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      if (err instanceof ApiError && err.status === 429) {
        const suffix = (err.retryAfter != null && err.retryAfter >= 5)
          ? ` Try again in ${err.retryAfter}s.`
          : '';
        showToastGlobal(`${t('social.slowDown')}${suffix}`, 'warning');
      }
    } finally {
      setSending(false);
    }
  }, [sending, loading, userId, playSticker]);

  // Build flat list with date separators
  const listData = useMemo(() => {
    const items: ListItem[] = [];
    let lastDate = '';
    for (const msg of messages) {
      const date = fmtDate(msg.createdAt, t);
      if (date !== lastDate) {
        items.push({ type: 'date', date, key: `date-${date}-${msg.id}` });
        lastDate = date;
      }
      items.push({ type: 'msg', msg, key: msg.id });
    }
    // Newest-first for the inverted list; each date row follows its group so it
    // renders visually above that day's messages.
    return items.reverse();
  }, [messages, t]);
  const partnerInitial = (name ?? 'G').charAt(0).toUpperCase();
  const handleOpenPhoto = useCallback((uri: string) => setViewingPhoto(uri), []);
  const renderMessageItem = useCallback(({ item }: { item: ListItem }) => {
    return (
      <DmMessageCell
        item={item}
        partnerInitial={partnerInitial}
        avatarUri={avatarUri}
        name={name}
        contentWidth={contentWidth}
        colors={th}
        onDelete={handleDeleteMsg}
        onOpenPhoto={handleOpenPhoto}
      />
    );
  }, [avatarUri, contentWidth, handleDeleteMsg, handleOpenPhoto, name, partnerInitial, th]);
  const handleOpenLumiPalette = useCallback(() => setShowPicker(false), []);

  const stickerCellWidth = Math.max(52, Math.min(72, Math.floor((contentWidth - 44) / 5)));
  const pickerStickerSize = Math.min(54, stickerCellWidth - 8);

  return (
    <View style={[styles.root, { backgroundColor: th.bg }]}>
      {/* ── Static star background ─────────────────────────── */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {STARS.map(s => (
          <View key={s.key} style={{
            position: 'absolute', left: s.left, top: s.top,
            width: s.size, height: s.size, borderRadius: s.size / 2,
            backgroundColor: th.star, opacity: isDark ? s.opacity : s.opacity * 0.6,
          }} />
        ))}
      </View>

      {/* ── Header ──────────────────────────────────────────── */}
      <LinearGradient
        colors={th.header}
        style={[styles.header, { paddingTop: topPad }]}
      >
        {/* Nebula glow orbs */}
        <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(107,78,232,0.12)', top: -60, right: -30 }} />
          <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(60,140,240,0.08)', top: 10, left: 40 }} />
        </View>

        <View style={[styles.headerRow, { width: contentWidth, alignSelf: 'center' }]}>
          <BackButton color={th.ink} />

          <View style={styles.partnerInfo}>
            {/* Avatar with glow ring */}
            <View style={styles.avatarWrap}>
              <View style={styles.avatarGlow} />
              <View style={styles.partnerAvatar}>
                {avatarUri
                  ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  : <LinearGradient colors={['rgba(107,78,232,0.75)', 'rgba(60,100,240,0.55)']} style={StyleSheet.absoluteFill} />
                }
                {!avatarUri && <Text style={styles.partnerInitial}>{partnerInitial}</Text>}
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.partnerName, { color: th.ink }]} numberOfLines={1}>{name ?? t('social.guide')}</Text>
              {partnerSubtitle && (
                <Text style={[styles.partnerSubtitle, { color: th.sub }]} numberOfLines={1}>{partnerSubtitle}</Text>
              )}
            </View>
          </View>

          {/* Kebab / more menu — only for non-guides */}
          {isGuide !== 'true' && (
            <TouchableOpacity
              onPress={handleMoreMenu}
              accessibilityRole="button"
              accessibilityLabel={t('social.moreOptions', { defaultValue: 'Conversation options' })}
              style={styles.headerIconBtn}
            >
              <Icon name="more-vertical" size={20} color={th.sub} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ── Messages ─────────────────────────────────────────── */}
      {error && messages.length === 0 ? (
        <View style={styles.centerWrap}>
          <Text style={{ color: MUTED, fontFamily: 'Satoshi-Regular' }}>{error}</Text>
        </View>
      ) : (
        <KeyboardAvoidingViewCompat
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <FlatList<ListItem>
            ref={flatRef}
            inverted
            maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 60 }}
            data={listData}
            keyExtractor={item => item.key}
            contentContainerStyle={[styles.listPad, { width: contentWidth, alignSelf: 'center', paddingTop: 14, paddingBottom: 12 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={40}
            windowSize={7}
            ListHeaderComponent={partnerTyping ? (
              <View style={[styles.msgRow, styles.msgRowOther]}>
                <View style={[styles.bubbleAvatarSm, { backgroundColor: 'rgba(107,78,232,0.18)', borderColor: 'rgba(107,78,232,0.30)', overflow: 'hidden' }]}>
                  {avatarUri
                    ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    : <Text style={[styles.bubbleAvatarSmText, { color: PURPLE }]}>{partnerInitial}</Text>
                  }
                </View>
                <View style={[styles.bubble, styles.bubbleOther, { paddingVertical: 10, paddingHorizontal: 16 }]}>
                  <Text style={{ color: MUTED, fontSize: 18, letterSpacing: 4 }}>•••</Text>
                </View>
              </View>
            ) : null}
            ListEmptyComponent={<View style={styles.invertedEmpty}>{
              loading ? (
                <View style={styles.openingConversation}>
                  {!!inboxPreview && (
                    <View style={styles.openingPreview}>
                      <Text style={styles.openingPreviewText} numberOfLines={3}>{inboxPreview}</Text>
                    </View>
                  )}
                  <View style={styles.openingBubbleRow}>
                    <View style={styles.openingAvatarPlaceholder} />
                    <View style={[styles.openingBubblePlaceholder, { width: '64%' }]} />
                  </View>
                  <View style={[styles.openingBubbleRow, styles.openingBubbleOwn]}>
                    <View style={[styles.openingBubblePlaceholder, { width: '48%', height: 34 }]} />
                  </View>
                  <View style={styles.openingBubbleRow}>
                    <View style={styles.openingAvatarPlaceholder} />
                    <View style={[styles.openingBubblePlaceholder, { width: '54%', height: 54 }]} />
                  </View>
                  <View style={styles.openingStatus}>
                    <SkyLoadingMark size={18} color={PURPLE} />
                    <Text style={styles.openingStatusText}>{t('social.openingConversation')}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <LinearGradient
                    colors={[`${PURPLE}28`, `${PURPLE}10`]}
                    style={styles.emptyIcon}
                  >
                    <Text style={{ fontSize: 32 }}>✦</Text>
                  </LinearGradient>
                  <Text style={styles.emptyTitle}>{t('social.beginStory')}</Text>
                  <Text style={styles.emptyBody}>
                    {isGuide === 'true'
                      ? t('social.guideAwaits')
                      : t('social.funWhisper')}
                  </Text>
                </View>
              )
            }</View>}
            renderItem={renderMessageItem}
          />

          {/* ── Sticker picker sheet ────────────────────────── */}
          {showPicker && (
            <Reanimated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(110)}
              style={[styles.pickerSheet, { backgroundColor: th.bar, borderColor: th.border }]}
            >
              {/* Handle */}
              <View style={[styles.pickerHandle, { backgroundColor: th.sub }]} />
              <Text style={[styles.pickerTitle, { color: th.ink }]}>{t('social.expressions')}</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: 225 }} keyboardShouldPersistTaps="handled">
                <View style={styles.pickerGrid}>
                  {STICKERS.map(def => (
                    <TouchableOpacity
                      key={def.id}
                      style={[
                        styles.pickerCell,
                        { width: stickerCellWidth, borderColor: `${def.color}55`, backgroundColor: `${def.color}12` },
                      ]}
                      onPress={() => handleSticker(def)}
                      accessibilityRole="button"
                      accessibilityLabel={t(`social.sticker_${def.id}_label`, { defaultValue: def.label })}
                      activeOpacity={0.70}
                    >
                      <Image source={def.artwork} style={{ width: pickerStickerSize, height: pickerStickerSize }} contentFit="contain" />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Reanimated.View>
          )}

          {/* ── Shared Lumi companions (remount per conversation) ── */}
          <View style={[styles.dock, { backgroundColor: th.bar, borderColor: th.border }]} pointerEvents="box-none">
          <View style={{ width: contentWidth, alignSelf: 'center', paddingTop: 4 }} pointerEvents="box-none">
            <ChatLumiCompanion key={`${photoIdentity}:${reactionPlaybackEpoch}`}
              enabled={!loading && !isBlocked && !viewingPhoto && !pickingPhoto}
              busy={sending}
              partnerName={name}
              events={reactionEvents}
              onSendReaction={handleSendLumiReaction}
              externalPickerOpen={showPicker}
              onOpenPalette={handleOpenLumiPalette} />
          </View>

          {/* ── Input bar ─────────────────────────────────── */}
          {photoUri && <ChatPhotoDraft uri={photoUri} busy={sending} color={th.ink} onRemove={() => { setPhotoUri(null); uploadedPhotoRef.current = null; }} />}
           <View style={[styles.inputBar, { width: contentWidth, paddingBottom: kbOpen && Platform.OS !== 'web' ? 6 : bottomPad }]}>
            <TouchableOpacity
              style={[styles.stickerToggleBtn, { backgroundColor: isDark ? 'rgba(155,120,255,0.17)' : 'rgba(107,78,232,0.10)', borderColor: th.border }]} onPress={pickPhoto}
              hitSlop={4}
              disabled={loading || sending || pickingPhoto} accessibilityRole="button" accessibilityLabel="Attach a photo"
              accessibilityState={{ disabled: loading || sending || pickingPhoto, busy: pickingPhoto }}
              activeOpacity={0.75}
            >
              {pickingPhoto ? <SkyLoadingMark size={20} color={PURPLE} /> : <Icon name="image" size={21} color={PURPLE} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.stickerToggleBtn,
                { backgroundColor: isDark ? 'rgba(155,120,255,0.17)' : 'rgba(107,78,232,0.10)', borderColor: th.border },
                showPicker && { backgroundColor: PURPLE, borderColor: PURPLE },
              ]}
              onPress={() => { Haptics.selectionAsync(); setShowPicker(v => !v); }}
              hitSlop={4}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={t('social.expressions')}
              accessibilityState={{ expanded: showPicker, disabled: loading }}
              activeOpacity={0.75}
            >
              <Icon name="star" size={19} color={showPicker ? '#FFFFFF' : PURPLE} />
            </TouchableOpacity>

            <View style={[styles.inputWrap, { backgroundColor: th.field, borderColor: th.border }]}>
              <TextInput
                ref={inputRef}
                testID="chat-message-input"
                style={[styles.input, { color: th.ink }]}
                value={input}
                editable={!loading}
                onChangeText={t => {
                  setInput(t);
                  if (showPicker) setShowPicker(false);
                  if (t && userId) {
                    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                    typingTimerRef.current = setTimeout(() => {
                      apiFetch(`/messages/${userId}/typing`, { method: 'POST' }).catch(() => null);
                    }, 600);
                  }
                }}
                placeholder={t('social.sendWhisper')}
                placeholderTextColor={th.sub}
                maxFontSizeMultiplier={1.3}
                accessibilityLabel={t('social.sendWhisper')}
                multiline
                maxLength={2000}
                returnKeyType="send"
                blurOnSubmit={false}
                submitBehavior={Platform.OS === 'ios' ? 'newline' : 'submit'}
                onSubmitEditing={Platform.OS !== 'ios' ? handleSend : undefined}
              />
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && !photoUri && styles.sendBtnDisabled]}
              hitSlop={4}
              onPress={() => { const keep = inputRef.current?.isFocused() ?? false; void handleSend(); if (keep) inputRef.current?.focus(); }}
              accessibilityRole="button"
              accessibilityLabel={sending ? 'Sending message' : 'Send message'}
              accessibilityState={{ disabled: (!input.trim() && !photoUri) || sending || loading || pickingPhoto, busy: sending }}
              disabled={(!input.trim() && !photoUri) || sending || loading || pickingPhoto}
              activeOpacity={0.8}
            >
              {sending
                ? <SkyLoadingMark size={19} color="rgba(255,255,255,0.9)" />
                : (
                  <LinearGradient
                    colors={input.trim() || photoUri ? [PURPLE, PURPLE2] : ['#AA98E4', '#8976CF']}
                    style={StyleSheet.absoluteFill}
                  />
                )
              }
              {!sending && <Icon name="send" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
          </View>
        </KeyboardAvoidingViewCompat>
      )}

      {viewingPhoto && <ChatPhotoViewer uri={viewingPhoto} onClose={() => setViewingPhoto(null)} background={NIGHT} color="rgba(220,210,255,0.90)" />}

      {/* ── Full-screen sticker animation overlay ─────────── */}
      {playingAnim && (
        <ChatStickerAnimation
          type={playingAnim.type}
          mainEmoji={playingAnim.emoji}
          mainSticker={playingAnim.artwork}
          onComplete={handleAnimComplete}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT },

  // ── Header
  header:          { paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: BORDER },
  headerRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, minHeight: 52 },
  headerIconBtn:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  partnerInfo:     { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 },

  avatarWrap:    { position: 'relative', width: 40, height: 40 },
  avatarGlow:    {
    position: 'absolute', inset: -4,
    borderRadius: 24, borderWidth: 1.5,
    borderColor: 'rgba(107,78,232,0.45)',
  },
  partnerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(107,78,232,0.25)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  partnerInitial:  { fontSize: 20, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.95)' },
  partnerName:     { fontSize: 16, fontFamily: 'Satoshi-Bold', color: 'rgba(225,215,255,0.97)', letterSpacing: -0.2 },
  partnerSubtitle: { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.50)', marginTop: 1 },

  // ── Messages list
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listPad:    { paddingHorizontal: 12, flexGrow: 1, justifyContent: 'flex-start' },
  // FlatList already corrects the empty component's inversion.
  invertedEmpty: { flexGrow: 1, justifyContent: 'flex-end' },
  openingConversation: { flex: 1, paddingTop: 18, paddingHorizontal: 4, gap: 12 },
  openingPreview: {
    alignSelf: 'center', maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 16, backgroundColor: 'rgba(107,78,232,0.10)',
    borderWidth: 1, borderColor: 'rgba(107,78,232,0.18)',
  },
  openingPreviewText: { color: 'rgba(220,210,255,0.72)', fontSize: 13, lineHeight: 19, fontFamily: 'Satoshi-Regular', textAlign: 'center' },
  openingBubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 4 },
  openingBubbleOwn: { justifyContent: 'flex-end' },
  openingAvatarPlaceholder: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(200,184,232,0.10)' },
  openingBubblePlaceholder: {
    height: 44, borderRadius: 18, backgroundColor: 'rgba(200,184,232,0.08)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.07)',
  },
  openingStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 5 },
  openingStatusText: { color: MUTED, fontSize: 12, fontFamily: 'Satoshi-Medium' },

  // ── Empty state
  emptyWrap:  { alignItems: 'center', paddingTop: 70, paddingHorizontal: 40 },
  emptyIcon:  { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(107,78,232,0.20)' },
  emptyTitle: { fontSize: 18, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.90)', marginBottom: 10, textAlign: 'center', letterSpacing: -0.3 },
  emptyBody:  { fontSize: 15, fontFamily: 'Satoshi-Regular', textAlign: 'center', lineHeight: 21, color: MUTED },

  // ── Date separator
  dateSep:  { flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 8 },
  dateLine: { flex: 1, height: 1, backgroundColor: 'rgba(200,184,232,0.08)' },
  datePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(200,184,232,0.07)', borderWidth: 1, borderColor: 'rgba(200,184,232,0.10)' },
  dateText: { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.45)', letterSpacing: 0.5 },

  // ── Message bubbles
  msgRow:      { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-end', gap: 8 },
  msgRowOwn:   { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },

  bubbleAvatarSm:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 2, flexShrink: 0 },
  bubbleAvatarSmText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  bubble:      { maxWidth: '82%', paddingHorizontal: 14, paddingTop: 9, paddingBottom: 7, borderRadius: 20, gap: 3, overflow: 'hidden' },
  bubblePhoto: { padding: 4, paddingTop: 4, paddingBottom: 6, borderRadius: 18, gap: 4 },
  photoCaption:{ paddingHorizontal: 8 },
  bubbleOwn:   { borderBottomRightRadius: 5 },
  bubbleOther: { borderBottomLeftRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: BORDER },
  bubbleText:  { fontSize: 16, fontFamily: 'Satoshi-Medium', lineHeight: 23, letterSpacing: 0 },
  bubbleTime:  { fontSize: 11, fontFamily: 'Satoshi-Regular', alignSelf: 'flex-end' },

  // ── Sticker row + card
  exprRowOwn:   { flexDirection: 'row', justifyContent: 'flex-end',   marginBottom: 8, marginRight: 4 },
  exprRowOther: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 8, marginLeft: 4, alignItems: 'flex-end', gap: 8 },

  stickerCard: {
    flexDirection: 'column', alignItems: 'center', gap: 1,
    paddingHorizontal: 4, paddingTop: 4, paddingBottom: 3,
    borderRadius: 18, borderWidth: 1.25,
    width: 100, maxWidth: 124,
  },
  stickerArtwork:      { width: 88, height: 88 },
  stickerTimestamp:    { width: '100%', alignItems: 'flex-end', paddingHorizontal: 4 },
  stickerCardSubtitle: { fontSize: 10, fontFamily: 'Satoshi-Medium' },
  stickerCardTime:     { fontSize: 9, fontFamily: 'Satoshi-Medium', marginTop: 1 },

  // ── Sticker picker
  pickerSheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 10, paddingTop: 7, paddingBottom: 4,
    maxHeight: 252,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  pickerHandle: {
    width: 34, height: 3, borderRadius: 2,
    alignSelf: 'center', marginBottom: 7,
  },
  pickerTitle: {
    fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4,
    textTransform: 'uppercase', textAlign: 'center',
    marginBottom: 7,
  },
  pickerGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 5,
    justifyContent: 'center', paddingBottom: 3,
  },
  pickerCell: {
    width: 70, height: 66, alignItems: 'center', justifyContent: 'center',
    borderRadius: 17, borderWidth: 1,
  },
  // ── Input bar
  dock: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: BORDER },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 9, paddingTop: 6,
    alignSelf: 'center',
  },
  stickerToggleBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(107,78,232,0.10)',
    borderWidth: 1,
  },
  stickerToggleIcon: { fontSize: 18, lineHeight: 22 },
  inputWrap: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 21, borderWidth: 1, borderColor: BORDER,
    minHeight: 48, justifyContent: 'center',
  },
  input: {
    paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10,
    fontSize: 16, lineHeight: 22, fontFamily: 'Satoshi-Medium',
    color: 'rgba(220,210,255,0.92)', maxHeight: 120,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 1,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(107,78,232,0.35)',
  },
  sendBtnDisabled: { borderColor: 'rgba(107,78,232,0.22)' },
});
