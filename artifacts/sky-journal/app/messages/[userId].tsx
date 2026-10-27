import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { SkyLoadingMark } from '@/components/SkyLoading';
import { ChatStickerAnimation, type StickerAnimType } from '@/components/ChatStickerAnimation';
import { ChatMessagePhoto, ChatPhotoDraft, ChatPhotoViewer } from '@/components/ChatPhoto';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { ImageUploadError, persistImageUri } from '@/utils/persistImage';
import { useClearConversation, useRemoveFriend, type ChatMessageInput } from '@workspace/api-client-react';
import { ApiError, apiFetch, useApp } from '@/context/AppContext';
import { showToastGlobal } from '@/components/Toast';
import { safeBack } from '@/utils/navigation';
import {
  fetchDmConversation,
  forgetDmConversation,
  getDmOutbox,
  getDmConversationCache,
  hydrateDmConversationCache,
  hydrateDmOutbox,
  markDmConversationOpened,
  rememberDmConversation,
  saveDmOutbox,
  wasDmConversationOpened,
  type DmOutboxItem,
  type DmCachedMessage,
} from '@/utils/dmConversationCache';
import { mergeChatMessages, upsertChatMessages } from '@/utils/chatMessageHistory';
import { nextDmRetry } from '@/utils/dmRetryPolicy';
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
  ActivityIndicator,
  AppState,
  Alert,
  Animated,
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
  acceptSharedReaction, MAX_SHARED_REACTION_EVENTS, parseSharedReaction,
  seedSharedReactionHistory, sharedReactionContent,
  type SharedLumiEvent, type SharedReactionTracker,
} from '@/features/lumi/chat/sharedChatReactions';

// ── Constants ─────────────────────────────────────────────────────────────────
const NIGHT   = '#080618';

const PURPLE  = '#6B4EE8';
const PURPLE2 = '#3B2A8C';
const BORDER  = 'rgba(200,184,232,0.10)';
const MUTED   = 'rgba(200,184,232,0.45)';
const CHAT_PAGE_SIZE = 50;

// ── Types ─────────────────────────────────────────────────────────────────────
type Message = DmCachedMessage;

type ListItem =
  | { type: 'date'; date: string; key: string }
  | { type: 'msg';  msg: Message; key: string };

// ── Sticker registry ──────────────────────────────────────────────────────────

export interface StickerDef {
  id:         NonNullable<ChatMessageInput['expression']>;
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

function outboxMessage(
  accountId: string,
  partnerId: string,
  item: DmOutboxItem,
  deliveryState: NonNullable<Message['deliveryState']>,
): Message {
  return {
    id: item.clientMessageId,
    fromUserId: accountId,
    toUserId: partnerId,
    content: item.content,
    imageUri: item.imageUri ?? item.localPhotoUri ?? null,
    expression: item.expression,
    isRead: false,
    createdAt: item.createdAt,
    isOwn: true,
    deliveryState,
  };
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
function StickerBubble({ msg, partnerInitial, avatarUri, primaryColor, textColor, onLongPress, onRetry }: {
  msg: Message; partnerInitial: string; avatarUri?: string; primaryColor: string; textColor: string;
  onLongPress?: () => void;
  onRetry?: (messageId: string) => void;
}) {
  const { t } = useTranslation();
  const def    = getSticker(msg.expression!);
  // Virtualized history rows must not replay their entrance every time they
  // remount during scrolling. New-message effects use the existing overlay.
  const scaleA = useRef(new Animated.Value(1)).current;
  const opA    = useRef(new Animated.Value(1)).current;

  const label = t(`social.sticker_${def.id}_${msg.isOwn ? 'own' : 'other'}`);

  const cardInner = (
    <View style={[styles.stickerCard, { borderColor: `${def.color}68`, backgroundColor: `${def.color}12` }]}>
      <Image source={def.artwork} style={styles.stickerArtwork} contentFit="contain" transition={0} />
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
            onPress={msg.deliveryState === 'failed' ? () => onRetry?.(msg.id) : undefined}
            delayLongPress={350}
            activeOpacity={0.85}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${t(`social.sticker_${def.id}_label`)}. ${label}, ${fmtTime(msg.createdAt)}`}
            accessibilityHint={t('social.holdForOptions', { defaultValue: 'Hold for message options.' })}
          >
            {cardInner}
          </TouchableOpacity>
        </Animated.View>
        {msg.deliveryState && (
          <Text style={[styles.deliveryStatus, { color: msg.deliveryState === 'failed' ? '#FF9A9A' : textColor }]}>
            {msg.deliveryState === 'failed' ? 'Not sent · Tap to retry' : msg.deliveryState === 'queued' ? 'Waiting for connection…' : 'Sending…'}
          </Text>
        )}
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
  dateLine: string;
  datePill: string;
  dateText: string;
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
  onRetry: (messageId: string) => void;
};

const DmMessageCell = React.memo(function DmMessageCell({
  item, partnerInitial, avatarUri, name, contentWidth, colors, onDelete, onOpenPhoto, onRetry,
}: DmMessageCellProps) {
  if (item.type === 'date') {
    return (
      <View style={styles.dateSep}>
        <View style={[styles.dateLine, { backgroundColor: colors.dateLine }]} />
        <View style={[styles.datePill, { backgroundColor: colors.datePill, borderColor: colors.otherBorder }]}>
          <Text style={[styles.dateText, { color: colors.dateText }]}>{item.date}</Text>
        </View>
        <View style={[styles.dateLine, { backgroundColor: colors.dateLine }]} />
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
        onRetry={onRetry}
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
        onPress={msg.deliveryState === 'failed'
          ? () => onRetry(msg.id)
          : msg.imageUri ? () => onOpenPhoto(msg.imageUri!) : undefined}
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
        {msg.deliveryState && (
          <Text style={[styles.deliveryStatus, { color: msg.deliveryState === 'failed' ? '#FFB0B0' : msg.isOwn ? 'rgba(255,255,255,0.72)' : colors.sub }]}>
            {msg.deliveryState === 'failed' ? 'Not sent · Tap to retry' : msg.deliveryState === 'queued' ? 'Waiting for connection…' : 'Sending…'}
          </Text>
        )}
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
    && previous.onOpenPhoto === next.onOpenPhoto
    && previous.onRetry === next.onRetry;
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const { userId: accountId } = useAuth();
  const { userId: partnerId } = useLocalSearchParams<{ userId: string }>();
  // Keyboard-controller provider scoped to this screen's content only.
  return (
    <ScreenKeyboardProvider>
      <MessagesScreenContent key={JSON.stringify([accountId, partnerId])} />
    </ScreenKeyboardProvider>
  );
}

function MessagesScreenContent() {
  const { t } = useTranslation();
  const { userId, name, handle, avatarUri, isGuide, deleted } = useLocalSearchParams<{
    userId:     string;
    name?:      string;
    handle?:    string;
    avatarUri?: string;
    isGuide?:   string;
    deleted?:   string;
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
    dateLine: isDark ? 'rgba(200,184,232,0.10)' : c.border,
    datePill: isDark ? 'rgba(200,184,232,0.07)' : c.card,
    dateText: isDark ? MUTED : c.mutedForeground,
    bar: c.card,
    field: c.input,
    border: c.border,
  }), [
    isDark, c.background, c.night, c.card, c.secondary, c.muted,
    c.lavender, c.foreground, c.mutedForeground, c.primary, c.input, c.border,
  ]);
  const { width: windowWidth } = useWindowDimensions();
  const {
    markDmThreadRead, blockedIds, blockUser, unblockUser, dmThreads, refreshDmThreads,
    friends, refreshFriends, refreshSocialRelationships,
  } = useApp();
  const clearConversationMutation = useClearConversation();
  const removeFriendMutation = useRemoveFriend();
  const [blockStateOverride, setBlockStateOverride] = React.useState<boolean | null>(null);
  const [deletedPartnerEvent, setDeletedPartner] = React.useState(false);
  const deletedPartner = deletedPartnerEvent || deleted === 'true'
    || dmThreads.some(thread => thread.partnerId === userId && thread.partnerDeleted === true);
  const { playStickerSound } = useSound();
  const { userId: myUserId } = useAuth();

  const initialMessages = useMemo(
    () => getDmConversationCache(myUserId, userId),
    [myUserId, userId],
  );
  const initialOutbox = useMemo(
    () => getDmOutbox(myUserId, userId),
    [myUserId, userId],
  );
  const [messages,      setMessages]      = useState<Message[]>(initialMessages);
  // The screen and composer render immediately; network freshness is background work.
  const [loading,       setLoading]       = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [sending,       setSending]       = useState(false);
  const [reactionEvents, setReactionEvents] = useState<SharedLumiEvent[]>([]);
  const [reactionPlaybackEpoch, setReactionPlaybackEpoch] = useState(0);
  const reactionTrackerRef = useRef<SharedReactionTracker>({ seen: initialMessages.map(m => m.id) });
  const reactionHistoryReadyRef = useRef(false);
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
    setLoading(false);
    setHasOlderMessages(false);
    setLoadingOlderMessages(false);
    loadingOlderRef.current = false;
    olderHistoryLoadedRef.current = false;
    serverSnapshotReadyRef.current = false;
    localCacheReadyRef.current = initialMessages.length > 0;
    conversationEpochRef.current++;
    serverMessageIdsRef.current = new Set();
    outboxRef.current = initialOutbox;
    retryingMessageIdsRef.current.clear();
    lastMsgIdRef.current = initialMessages.at(-1)?.id ?? null;
    setError(null);
    setPhotoUri(null);
    setViewingPhoto(null);
    setPickingPhoto(false);
    setSending(false);
    reactionTrackerRef.current = { seen: initialMessages.map(m => m.id) };
    reactionHistoryReadyRef.current = false;
    recentReactionsRef.current.clear();
    setReactionEvents([]);
    uploadedPhotoRef.current = null;
    return () => {
      photoIdentityRef.current = '';
      for (const controller of sendControllersRef.current.values()) controller.abort();
      sendControllersRef.current.clear();
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
  const loadingOlderRef = useRef(false);
  const olderHistoryLoadedRef = useRef(false);
  const serverSnapshotReadyRef = useRef(false);
  const localCacheReadyRef = useRef(initialMessages.length > 0);
  const conversationEpochRef = useRef(0);
  const serverMessageIdsRef = useRef(new Set<string>());
  const outboxRef = useRef<DmOutboxItem[]>(initialOutbox);
  const retryingMessageIdsRef = useRef(new Set<string>());
  const sendControllersRef = useRef(new Map<string, AbortController>());
  const prevSseRef      = useRef(false);
  const typingTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 8);
  const contentWidth = Math.min(windowWidth, 680);

  const partnerDisplayName = deletedPartner
    ? t('social.deletedAccount', { defaultValue: 'Deleted account' })
    : name ?? t('social.guide');
  const partnerDisplayAvatar = deletedPartner ? '' : avatarUri;
  const partnerSubtitle = deletedPartner
    ? null
    : isGuide === 'true'
      ? t('social.guide')
      : handle ? `@${handle}` : null;

  const isBlocked = blockStateOverride ?? blockedIds.includes(userId ?? '');
  const isFriend = friends.some(friend => friend.userId === userId);
  const inboxPreview = dmThreads.find(thread => thread.partnerId === userId)?.lastMessage ?? '';

  useEffect(() => {
    setBlockStateOverride(null);
    setDeletedPartner(false);
    void refreshDmThreads();
  }, [userId, refreshDmThreads]);

  useEffect(() => {
    if (myUserId && userId && (localCacheReadyRef.current || serverSnapshotReadyRef.current)) {
      rememberDmConversation(myUserId, userId, messages);
    }
  }, [messages, myUserId, userId]);

  const handleClearConversation = useCallback(() => {
    if (!userId) return;
    Alert.alert(
      t('social.deleteChat', { defaultValue: 'Delete chat' }),
      t('social.clearConversationBody'),
      [
        { text: t('social.cancel'), style: 'cancel' },
        {
          text: t('social.deleteChat', { defaultValue: 'Delete chat' }),
          style: 'destructive',
          onPress: async () => {
            if (retryingMessageIdsRef.current.size) {
              showToastGlobal('Wait for sending messages to finish before deleting this chat.', 'warning');
              return;
            }
            try {
              const paused = outboxRef.current.map(item => ({ ...item, retryAt: Number.MAX_SAFE_INTEGER }));
              outboxRef.current = paused;
              await saveDmOutbox(myUserId, userId, paused);
              await clearConversationMutation.mutateAsync({ partnerId: userId });
              conversationEpochRef.current++;
              forgetDmConversation(myUserId, userId);
              outboxRef.current = [];
              setMessages([]);
              void refreshDmThreads();
              Alert.alert(
                t('social.deleteChat', { defaultValue: 'Delete chat' }),
                'This conversation was removed from your chat list. The other participant still has their copy.',
              );
            } catch {
              Alert.alert(t('social.error'), t('social.clearError'));
            }
          },
        },
      ],
    );
  }, [t, userId, myUserId, clearConversationMutation, refreshDmThreads]);

  function handleMoreMenu() {
    if (!userId) return;
    const partnerName = partnerDisplayName;
    const blockOption = isBlocked
      ? {
          text: t('social.unblockUser'),
          onPress: async () => {
            if (await unblockUser(userId)) setBlockStateOverride(false);
          },
        }
      : {
          text: t('social.blockUser'),
          style: 'destructive' as const,
          onPress: () => {
            Alert.alert(
              t('publicProfile.blockUser', { defaultValue: t('social.blockUser') }),
              `${t('publicProfile.blockBody', { name: partnerName, defaultValue: `${partnerName} will no longer be able to message you.` })}\n\n${t('social.blockHistoryNotice', { defaultValue: 'Your existing chat history will stay available until you delete it.' })}`,
              [
                { text: t('social.cancel'), style: 'cancel' },
                {
                  text: t('publicProfile.block', { defaultValue: t('social.blockUser') }),
                  style: 'destructive',
                  onPress: async () => {
                    if (await blockUser(userId)) setBlockStateOverride(true);
                  },
                },
              ],
            );
          },
        };
    const removeFriendOption = isFriend && !deletedPartner
      ? {
          text: t('social.removeFriend', { defaultValue: 'Remove friend' }),
          style: 'destructive' as const,
          onPress: () => Alert.alert(
            t('social.removeFriend', { defaultValue: 'Remove friend' }),
            t('social.removeFriendBody', { defaultValue: 'This removes the friend connection only. It will not block them or delete your chat.' }),
            [
              { text: t('social.cancel'), style: 'cancel' },
              {
                text: t('social.removeFriend', { defaultValue: 'Remove friend' }),
                style: 'destructive',
                onPress: async () => {
                  try {
                    await removeFriendMutation.mutateAsync({ targetUserId: userId });
                    await refreshFriends();
                    Alert.alert(t('social.removeFriend', { defaultValue: 'Remove friend' }), t('social.removeFriendSuccess', { defaultValue: 'Friend removed. Your chat history is unchanged.' }));
                  } catch {
                    Alert.alert(t('social.error'), t('social.tryAgain'));
                  }
                },
              },
            ],
          ),
        }
      : null;
    Alert.alert(
      partnerName,
      undefined,
      [
        ...(removeFriendOption ? [removeFriendOption] : []),
        { text: t('social.deleteChat', { defaultValue: 'Delete chat' }), onPress: handleClearConversation },
        ...(!deletedPartner ? [blockOption] : []),
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
    const epoch = conversationEpochRef.current;
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
        () => apiFetch<Message[]>(`/messages/${userId}?limit=${CHAT_PAGE_SIZE}`),
      );
      if (identity !== photoIdentityRef.current || epoch !== conversationEpochRef.current) return;
      setError(null);
      const msgs = [...(data ?? [])];
      serverSnapshotReadyRef.current = true;
      serverMessageIdsRef.current = new Set(msgs.map(message => message.id));
      if (!olderHistoryLoadedRef.current) setHasOlderMessages(msgs.length === CHAT_PAGE_SIZE);
      if (!reactionHistoryReadyRef.current) {
        seedSharedReactionHistory(reactionTrackerRef.current, msgs);
        reactionHistoryReadyRef.current = true;
      } else {
        msgs.forEach(recordSharedReaction);
      }
      // A request started before a confirmed message must not erase that live
      // row when its older snapshot returns (SSE and POST can race a GET).
      const fetchedIds = new Set(msgs.map(message => message.id));
      const liveReactions = [...recentReactionsRef.current.values()]
        .filter(item => item.receivedAt >= startedAt && !fetchedIds.has(item.message.id))
        .map(item => item.message);
      const liveMessages = [...liveReactions];
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
        const recentMessages = previous.filter(message =>
          !fetchedIds.has(message.id)
          && (message.deliveryState || Date.parse(message.createdAt) >= startedAt),
        );
        return mergeChatMessages(
          previous,
          [...msgs, ...liveMessages, ...recentMessages],
          olderHistoryLoadedRef.current,
        );
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

  useEffect(() => {
    if (!myUserId || !userId) return;
    let active = true;
    const identity = photoIdentity;

    void hydrateDmConversationCache(myUserId, userId).then(cached => {
      if (!active || identity !== photoIdentityRef.current) return;
      localCacheReadyRef.current = true;
      if (serverSnapshotReadyRef.current || cached.length === 0) return;
      setMessages(previous => upsertChatMessages(previous, cached));
      setHasOlderMessages(cached.length === CHAT_PAGE_SIZE);
    });

    void hydrateDmOutbox(myUserId, userId).then(async stored => {
      if (!active || identity !== photoIdentityRef.current) return;
      const remaining = stored.filter(item => !serverMessageIdsRef.current.has(item.clientMessageId));
      outboxRef.current = remaining;
      if (remaining.length !== stored.length) {
        try { await saveDmOutbox(myUserId, userId, remaining); } catch { /* replay remains idempotent */ }
      }
      if (!active || identity !== photoIdentityRef.current) return;
      const pending = remaining.map(item => outboxMessage(
        myUserId,
        userId,
        item,
        item.retryAt >= Number.MAX_SAFE_INTEGER ? 'failed' : 'queued',
      ));
      if (pending.length) setMessages(previous => upsertChatMessages(previous, pending));
    }).catch(() => {
      if (active && identity === photoIdentityRef.current) {
        showToastGlobal('Queued messages could not be restored. Reopen this chat before sending.', 'warning');
      }
    });

    return () => { active = false; };
  }, [myUserId, userId, photoIdentity]);

  const loadOlderMessages = useCallback(async () => {
    const oldest = messages.find(message => !message.deliveryState);
    if (!oldest || !userId || !myUserId || !hasOlderMessages || loadingOlderRef.current) return;
    const identity = photoIdentityRef.current;
    loadingOlderRef.current = true;
    setLoadingOlderMessages(true);
    try {
      const query = new URLSearchParams({
        limit: String(CHAT_PAGE_SIZE),
        before: oldest.createdAt,
        beforeId: oldest.id,
      });
      const older = await apiFetch<Message[]>(`/messages/${userId}?${query.toString()}`);
      if (identity !== photoIdentityRef.current) return;
      setMessages(previous => mergeChatMessages(previous, [...older, ...previous]));
      if (older.length > 0) olderHistoryLoadedRef.current = true;
      setHasOlderMessages(older.length === CHAT_PAGE_SIZE);
    } catch {
      if (identity === photoIdentityRef.current) {
        showToastGlobal(t('social.loadMessagesError'), 'warning');
      }
    } finally {
      if (identity === photoIdentityRef.current) {
        loadingOlderRef.current = false;
        setLoadingOlderMessages(false);
      }
    }
  }, [messages, userId, myUserId, hasOlderMessages, t]);

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
        messageId?: string; forEveryone?: boolean; partnerId?: string; blocked?: boolean;
      };

      if (ev?.type === 'partner_account_deleted' && ev.partnerId === userId) {
        setDeletedPartner(true);
        resetSharedPlayback();
        void load();
        return;
      }

      if (ev?.type === 'block_relationship_changed' && ev.partnerId === userId) {
        setBlockStateOverride(ev.blocked === true);
        void refreshSocialRelationships();
        return;
      }

      if (ev?.type === 'friend_removed' && ev.partnerId === userId) {
        void refreshSocialRelationships();
        return;
      }

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
        conversationEpochRef.current++;
        resetSharedPlayback();
        forgetDmConversation(myUserId, userId);
        outboxRef.current = [];
        setMessages([]);
        return;
      }

      if (ev?.type === 'typing' && ev.fromUserId === userId) {
        setPartnerTyping(true);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setPartnerTyping(false), 4000);
      }
    }, [userId, myUserId, photoIdentity, markDmThreadRead, queueSticker, recordSharedReaction, resetSharedPlayback, load, refreshSocialRelationships]),
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

  const deliverQueuedMessage = useCallback(async (
    item: DmOutboxItem,
    options: { manual?: boolean; notify?: boolean } = {},
  ) => {
    const accountId = myUserId;
    const partnerId = userId;
    const identity = photoIdentityRef.current;
    if (!accountId || !partnerId || identity !== JSON.stringify([accountId, partnerId])) return;
    if ((isBlocked || deletedPartner) && !options.manual) return;
    if (!options.manual && item.retryAt > Date.now()) return;
    if (retryingMessageIdsRef.current.has(item.clientMessageId)) return;
    if (options.manual && (isBlocked || deletedPartner)) {
      showToastGlobal(isBlocked ? 'Unblock this person before retrying.' : 'This account is no longer available.', 'warning');
      return;
    }
    retryingMessageIdsRef.current.add(item.clientMessageId);
    setMessages(previous => upsertChatMessages(
      previous,
      [outboxMessage(accountId, partnerId, item, 'sending')],
    ));

    let prepared = item;
    try {
      if (!prepared.imageUri && prepared.localPhotoUri) {
        const uploaded = await persistImageUri(prepared.localPhotoUri);
        const path = uploaded.startsWith('/') ? uploaded : new URL(uploaded).pathname;
        if (!/^\/api\/images\/[\w.-]+$/.test(path)) throw new Error('Invalid uploaded photo');
        prepared = { ...prepared, imageUri: path };
        outboxRef.current = outboxRef.current.map(entry =>
          entry.clientMessageId === prepared.clientMessageId ? prepared : entry,
        );
        await saveDmOutbox(accountId, partnerId, outboxRef.current);
      }
      if (identity !== photoIdentityRef.current) return;
      const body: ChatMessageInput = {
        clientMessageId: prepared.clientMessageId,
        ...(prepared.content ? { content: prepared.content } : {}),
        ...(prepared.expression ? { expression: prepared.expression } : {}),
        ...(prepared.imageUri ? { imageUri: prepared.imageUri } : {}),
      };
      const controller = new AbortController();
      sendControllersRef.current.set(prepared.clientMessageId, controller);
      const timeout = setTimeout(() => controller.abort(), 15_000);
      let sent: Message;
      try {
        sent = await apiFetch<Message>(`/messages/${partnerId}${prepared.imageUri ? '/photos' : ''}`, {
          method: 'POST', signal: controller.signal,
          body: JSON.stringify(body),
        });
      } finally {
        clearTimeout(timeout);
        sendControllersRef.current.delete(prepared.clientMessageId);
      }
      if (!sent?.id || sent.fromUserId !== accountId || sent.toUserId !== partnerId) {
        throw new Error('Message was not confirmed');
      }
      if (identity !== photoIdentityRef.current) return;
      if (!outboxRef.current.some(entry => entry.clientMessageId === prepared.clientMessageId)) {
        // A clear from another device may race the POST response. Keep the
        // sender's copy hidden without touching the recipient's copy.
        void apiFetch(`/messages/${sent.id}?forEveryone=false`, { method: 'DELETE' }).catch(() => undefined);
        return;
      }
      const confirmed: Message = { ...sent, isOwn: true };
      outboxRef.current = outboxRef.current.filter(entry => entry.clientMessageId !== prepared.clientMessageId);
      // If secure storage fails here, a future replay still has the same
      // client UUID and the API returns this committed row instead of duplicating it.
      try { await saveDmOutbox(accountId, partnerId, outboxRef.current); } catch { /* idempotent replay is safe */ }
      setMessages(previous => upsertChatMessages(
        previous.filter(message => message.id !== prepared.clientMessageId), [confirmed],
      ));
      recordSharedReaction(confirmed);
      lastMsgIdRef.current = confirmed.id;
      if (prepared.localPhotoUri) {
        setPhotoUri(current => current === prepared.localPhotoUri ? null : current);
        if (uploadedPhotoRef.current?.uri === prepared.localPhotoUri) uploadedPhotoRef.current = null;
      }
    } catch (err) {
      if (identity !== photoIdentityRef.current) return;
      if (!outboxRef.current.some(entry => entry.clientMessageId === prepared.clientMessageId)) return;
      const status = err instanceof ApiError ? err.status : null;
      if (status === 410) {
        outboxRef.current = outboxRef.current.filter(entry => entry.clientMessageId !== prepared.clientMessageId);
        await saveDmOutbox(accountId, partnerId, outboxRef.current).catch(() => undefined);
        setMessages(previous => previous.filter(message => message.id !== prepared.clientMessageId));
        return;
      }
      const policy = nextDmRetry(
        prepared.attempts, Date.now(), status,
        err instanceof ApiError ? err.retryAfter : null, err instanceof ImageUploadError,
      );
      const permanent = policy.deliveryState === 'failed';
      const retryItem: DmOutboxItem = {
        ...prepared,
        attempts: prepared.attempts + 1,
        retryAt: policy.retryAt,
      };
      outboxRef.current = outboxRef.current.map(entry =>
        entry.clientMessageId === retryItem.clientMessageId ? retryItem : entry,
      );
      try { await saveDmOutbox(accountId, partnerId, outboxRef.current); } catch { /* preserve memory retry state */ }
      setMessages(previous => upsertChatMessages(
        previous,
        [outboxMessage(accountId, partnerId, retryItem, permanent ? 'failed' : 'queued')],
      ));
      if (options.notify) {
        if (err instanceof ApiError && err.status === 429) {
          const suffix = err.retryAfter != null && err.retryAfter >= 5 ? ` Try again in ${err.retryAfter}s.` : '';
          showToastGlobal(`${t('social.slowDown')}${suffix}`, 'warning');
        } else if (err instanceof ImageUploadError) {
          showToastGlobal(err.userMessage, 'warning');
        } else if (permanent) {
          showToastGlobal('Message was not sent. Tap it to retry.', 'warning');
        } else {
          showToastGlobal('Message saved and will retry when the connection returns.', 'warning');
        }
      }
    } finally {
      retryingMessageIdsRef.current.delete(item.clientMessageId);
    }
  }, [myUserId, userId, isBlocked, deletedPartner, recordSharedReaction, t]);

  const queueOutgoingMessage = useCallback(async (item: DmOutboxItem): Promise<boolean> => {
    if (!myUserId || !userId || photoIdentity !== photoIdentityRef.current) return false;
    let restored: DmOutboxItem[];
    try {
      restored = await hydrateDmOutbox(myUserId, userId);
    } catch {
      showToastGlobal('Could not restore queued messages. Reopen this chat before sending.', 'warning');
      return false;
    }
    if (photoIdentity !== photoIdentityRef.current) return false;
    const existing = [...new Map([...restored, ...outboxRef.current].map(entry => [entry.clientMessageId, entry])).values()];
    if (existing.some(entry => entry.clientMessageId === item.clientMessageId)) return true;
    const next = [...existing, item];
    outboxRef.current = next;
    setMessages(previous => upsertChatMessages(
      previous,
      [outboxMessage(myUserId, userId, item, 'sending')],
    ));
    try {
      await saveDmOutbox(myUserId, userId, next);
    } catch {
      outboxRef.current = outboxRef.current.filter(entry => entry.clientMessageId !== item.clientMessageId);
      setMessages(previous => previous.filter(message => message.id !== item.clientMessageId));
      showToastGlobal('Could not securely save this message for retry. Please try again.', 'warning');
      return false;
    }
    if (photoIdentity === photoIdentityRef.current) {
      void deliverQueuedMessage(item, { manual: true, notify: true });
    }
    return true;
  }, [myUserId, userId, photoIdentity, deliverQueuedMessage]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if ((!content && !photoUri) || sending || pickingPhoto || !userId || isBlocked || deletedPartner) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    jumpToNewest();
    const item: DmOutboxItem = {
      clientMessageId: Crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      content: content || null,
      imageUri: null,
      expression: null,
      localPhotoUri: photoUri,
      attempts: 0,
      retryAt: Date.now(),
    };
    try {
      const queued = await queueOutgoingMessage(item);
      if (queued) {
        setInput(current => current === input ? '' : current);
        setPhotoUri(current => current === photoUri ? null : current);
        uploadedPhotoRef.current = null;
      } else if (content) {
        setInput(current => restoreFailedChatDraft(current, content));
      }
    } finally {
      setSending(false);
    }
  }, [input, photoUri, sending, pickingPhoto, userId, jumpToNewest, isBlocked, deletedPartner, queueOutgoingMessage]);

  const retryMessage = useCallback((messageId: string) => {
    if (isBlocked || deletedPartner) {
      showToastGlobal(isBlocked ? 'Unblock this person before retrying.' : 'This account is no longer available.', 'warning');
      return;
    }
    const item = outboxRef.current.find(entry => entry.clientMessageId === messageId);
    if (!item) return;
    const retry = { ...item, retryAt: Date.now() };
    outboxRef.current = outboxRef.current.map(entry => entry.clientMessageId === messageId ? retry : entry);
    void saveDmOutbox(myUserId, userId, outboxRef.current).then(() =>
      deliverQueuedMessage(retry, { manual: true, notify: true }),
    ).catch(() => showToastGlobal('Could not save retry. Please try again.', 'warning'));
  }, [myUserId, userId, isBlocked, deletedPartner, deliverQueuedMessage]);

  const retryDueMessages = useCallback(() => {
    if (AppState.currentState !== 'active' || isBlocked || deletedPartner) return;
    const now = Date.now();
    for (const item of outboxRef.current) {
      if (item.retryAt <= now) void deliverQueuedMessage(item);
    }
  }, [isBlocked, deletedPartner, deliverQueuedMessage]);

  useFocusEffect(useCallback(() => {
    retryDueMessages();
    const timer = setInterval(retryDueMessages, 1800);
    return () => clearInterval(timer);
  }, [retryDueMessages]));

  useEffect(() => {
    if ((!isBlocked && !deletedPartner) || !outboxRef.current.length || !myUserId || !userId) return;
    const paused = outboxRef.current.map(item => ({ ...item, retryAt: Number.MAX_SAFE_INTEGER }));
    outboxRef.current = paused;
    void saveDmOutbox(myUserId, userId, paused).catch(() => undefined);
    setMessages(previous => upsertChatMessages(
      previous,
      paused.map(item => outboxMessage(myUserId, userId, item, 'failed')),
    ));
  }, [isBlocked, deletedPartner, myUserId, userId]);

  const handleSendLumiReaction = useCallback(async (id: ChatEmoteId): Promise<boolean> => {
    if (!myUserId || !userId || !getChatEmote(id) || isBlocked || deletedPartner || sending || pickingPhoto
      || !chatActiveRef.current || photoIdentity !== photoIdentityRef.current) return false;
    setSending(true);
    try {
      return await queueOutgoingMessage({
        clientMessageId: Crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        content: sharedReactionContent(id),
        imageUri: null,
        expression: null,
        attempts: 0,
        retryAt: Date.now(),
      });
    } finally {
      if (photoIdentity === photoIdentityRef.current) setSending(false);
    }
  }, [myUserId, userId, isBlocked, deletedPartner, sending, pickingPhoto, photoIdentity, queueOutgoingMessage]);

  const removeQueuedMessage = useCallback(async (messageId: string) => {
    const next = outboxRef.current.filter(item => item.clientMessageId !== messageId);
    outboxRef.current = next;
    await saveDmOutbox(myUserId, userId, next);
  }, [myUserId, userId]);

  const handleDeleteMsg = useCallback(async (msg: Message) => {
    if (!msg.isOwn) return;
    if (retryingMessageIdsRef.current.has(msg.id)) {
      showToastGlobal('This message is still sending. Try again when it finishes.', 'warning');
      return;
    }
    const deleteMessage = async (forEveryone: boolean) => {
      try {
        // Pause a queued item before the network operation so an offline delete
        // cannot race an automatic resend.
        const paused = outboxRef.current.map(item =>
          item.clientMessageId === msg.id ? { ...item, retryAt: Number.MAX_SAFE_INTEGER } : item);
        outboxRef.current = paused;
        await saveDmOutbox(myUserId, userId, paused);
        try {
          await apiFetch(`/messages/${msg.id}?forEveryone=${forEveryone}`, { method: 'DELETE' });
        } catch (err) {
          if (!(msg.deliveryState && err instanceof ApiError && err.status === 404)) throw err;
        }
        await removeQueuedMessage(msg.id);
        setMessages(previous => previous.filter(message => message.id !== msg.id));
      } catch {
        if (msg.deliveryState) setMessages(previous => upsertChatMessages(previous, [{ ...msg, deliveryState: 'failed' }]));
        showToastGlobal('Could not delete this message. Please try again.', 'warning');
      }
    };
    Alert.alert(
      t('social.deleteMessage'),
      t('social.deleteMessagePrompt'),
      [
        {
          text: t('social.deleteForMe'),
          onPress: () => void deleteMessage(false),
        },
        {
          text: t('social.deleteForEveryone'),
          style: 'destructive',
          onPress: () => void deleteMessage(true),
        },
        { text: t('social.cancel'), style: 'cancel' },
      ],
    );
  }, [myUserId, userId, t, removeQueuedMessage]);

  const handleSticker = useCallback(async (def: StickerDef) => {
    if (sending || !userId || isBlocked || deletedPartner) return;
    setShowPicker(false);
    setSending(true);
    playSticker(def);
    try {
      await queueOutgoingMessage({
        clientMessageId: Crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        content: null,
        imageUri: null,
        expression: def.id,
        attempts: 0,
        retryAt: Date.now(),
      });
    } finally {
      setSending(false);
    }
  }, [sending, userId, isBlocked, deletedPartner, playSticker, queueOutgoingMessage]);

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
  const partnerInitial = partnerDisplayName.charAt(0).toUpperCase();
  const handleOpenPhoto = useCallback((uri: string) => setViewingPhoto(uri), []);
  const renderMessageItem = useCallback(({ item }: { item: ListItem }) => {
    return (
      <DmMessageCell
        item={item}
        partnerInitial={partnerInitial}
        avatarUri={partnerDisplayAvatar}
        name={partnerDisplayName}
        contentWidth={contentWidth}
        colors={th}
        onDelete={handleDeleteMsg}
        onOpenPhoto={handleOpenPhoto}
        onRetry={retryMessage}
      />
    );
  }, [partnerDisplayAvatar, contentWidth, handleDeleteMsg, handleOpenPhoto, retryMessage, partnerDisplayName, partnerInitial, th]);
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
                {partnerDisplayAvatar
                  ? <Image source={{ uri: partnerDisplayAvatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  : <LinearGradient colors={['rgba(107,78,232,0.75)', 'rgba(60,100,240,0.55)']} style={StyleSheet.absoluteFill} />
                }
                {!partnerDisplayAvatar && <Text style={styles.partnerInitial}>{partnerInitial}</Text>}
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.partnerName, { color: th.ink }]} numberOfLines={1}>{partnerDisplayName}</Text>
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
      {error && messages.length === 0 && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={{ color: MUTED, fontFamily: 'Satoshi-Regular' }}>{error}</Text>
        </View>
      )}
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
            onEndReached={loadOlderMessages}
            onEndReachedThreshold={0.35}
            ListFooterComponent={loadingOlderMessages ? (
              <View style={styles.olderMessagesLoading}>
                <ActivityIndicator size="small" color={PURPLE} />
              </View>
            ) : null}
            ListHeaderComponent={partnerTyping ? (
              <View style={[styles.msgRow, styles.msgRowOther]}>
                <View style={[styles.bubbleAvatarSm, { backgroundColor: 'rgba(107,78,232,0.18)', borderColor: 'rgba(107,78,232,0.30)', overflow: 'hidden' }]}>
                  {partnerDisplayAvatar
                    ? <Image source={{ uri: partnerDisplayAvatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
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
              enabled={!loading && !isBlocked && !deletedPartner && !viewingPhoto && !pickingPhoto}
              busy={sending}
              partnerName={partnerDisplayName}
              events={reactionEvents}
              onSendReaction={handleSendLumiReaction}
              externalPickerOpen={showPicker}
              onOpenPalette={handleOpenLumiPalette} />
          </View>

          {/* ── Input bar ─────────────────────────────────── */}
          {isBlocked || deletedPartner ? (
            <View style={{ marginHorizontal: 16, marginBottom: bottomPad + 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: th.border, backgroundColor: th.field }}>
              <Text style={{ color: th.sub, textAlign: 'center', fontFamily: 'Satoshi-Medium', fontSize: 13, lineHeight: 19 }}>
                {deletedPartner
                  ? 'This account was deleted. Your retained conversation is read-only.'
                  : t('social.blockedChatReadOnly', { defaultValue: 'You blocked this user. Your existing chat is still here; unblock them to send messages.' })}
              </Text>
            </View>
          ) : (
          <>
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
          </>
          )}
          </View>
        </KeyboardAvoidingViewCompat>

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
  olderMessagesLoading: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },

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

  bubble:      { maxWidth: '82%', paddingHorizontal: 15, paddingTop: 10, paddingBottom: 8, borderRadius: 20, gap: 3, overflow: 'hidden' },
  bubblePhoto: { padding: 4, paddingTop: 4, paddingBottom: 6, borderRadius: 18, gap: 4 },
  photoCaption:{ paddingHorizontal: 8 },
  bubbleOwn:   { borderBottomRightRadius: 5 },
  bubbleOther: { borderBottomLeftRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: BORDER },
  bubbleText:  { fontSize: 16, fontFamily: 'Satoshi-Medium', lineHeight: 24, letterSpacing: 0.05 },
  bubbleTime:  { fontSize: 11, fontFamily: 'Satoshi-Regular', alignSelf: 'flex-end' },
  deliveryStatus: { fontSize: 10, fontFamily: 'Satoshi-Regular', alignSelf: 'flex-end', marginTop: 3 },

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
