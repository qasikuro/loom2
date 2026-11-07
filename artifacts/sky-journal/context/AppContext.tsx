import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { accountCacheKey } from '@/utils/accountCache';
import { clearDmAccountCache, forgetDmConversation } from '@/utils/dmConversationCache';
import { useAppSSE } from '@/hooks/useSSE';
import { TOKEN_GETTER_KEY as _TOKEN_GETTER_KEY, readAuthToken, type TokenGetter } from '@/utils/authToken';
import { publishReelStartup } from '@/utils/reelStartup';
import { clearLumiCreations, publishLumiCreation } from '@/features/lumi/home/events';
import { enqueueMutation, drainMutationQueue, clearMutation } from '@/utils/mutationQueue';
import { registerCustomEffects, type EffectDef } from '@/components/ProfileEffect';
import { showToastGlobal } from '@/components/Toast';
import i18n from '@/i18n';
import {
  ApiCharacterSchema,
  ApiJournalEntriesSchema,
  ApiOutfitsSchema,
  ApiStoriesSchema,
  ApiGallerySchema,
  ApiGalleryUsageSchema,
  ApiNotificationsSchema,
  ApiDiscoverSchema,
  ApiRewardBalanceSchema,
  ApiShopSchema,
  ApiConstellationSchema,
  ApiFriendsSchema,
  ApiFollowingSchema,
} from '@workspace/api-zod';
import {
  replyToStoryReaction,
  setAuthTokenGetter as setApiClientAuthTokenGetter,
  type ReplyToStoryReactionBodyStickerType,
} from '@workspace/api-client-react';
import { getApiBase } from '@/utils/apiBase';
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// ── Pure mapper functions (no RN/Expo deps — testable in plain Node.js) ──────
import {
  resolveUri as _resolveUri,
  toAppCharacter,
  toAppJournalEntry,
  toAppStory,
  toAppOutfit,
  toRawDiscoverPost,
  DEFAULT_CHARACTER,
} from './mappers';
import {
  handleDeleteJournalEntry,
  handleDeleteStory,
  handleDeleteOutfit,
  handleUpdateStory,
} from './mutations';
import type {
  GuideAvailability,
  Character,
  JournalEntry,
  Story,
  StoryMusic,
  Outfit,
  DiscoverPost,
  RawCharacterResponse,
  RawJournalEntryResponse,
  RawStoryResponse,
  RawOutfitResponse,
  RawDiscoverApiItem,
} from './mappers';
export type {
  BadgeItem,
  ProfileLink,
  GuideAvailability,
  BubbleStyle,
  PanelOverlay,
  StoryPanel,
  StoryPage,
  StoryMusic,
  Character,
  JournalEntryType,
  JournalEntry,
  Story,
  Outfit,
  DiscoverPost,
  RawCharacterResponse,
  RawJournalEntryResponse,
  RawStoryPanel,
  RawStoryResponse,
  RawOutfitResponse,
  RawDiscoverApiItem,
} from './mappers';

// ── API base URL ───────────────────────────────────────────────────────────────

const API_BASE = getApiBase();

// Bind resolveUri to the runtime API_BASE so call-sites stay zero-arg.
export function resolveUri(uri: string | null | undefined): string | undefined {
  return _resolveUri(uri, API_BASE);
}

// ── Fetch-staleness tracking ──────────────────────────────────────────────────
// softLoadData() uses these TTLs to skip endpoints whose cached data is still
// fresh, removing unnecessary fetches and the brief "old → new" flicker on
// fast app resume.  loadData() (forced refresh) always bypasses these checks.

const FETCH_TIMESTAMPS_KEY = 'fetch_timestamps_v1';

const RESOURCE_TTL_MS: Record<string, number> = {
  character:         5 * 60_000,
  'journal-entries': 2 * 60_000,
  stories:           2 * 60_000,
  outfits:           2 * 60_000,
  gallery:           5 * 60_000,
  discover:          2 * 60_000,
  following:         5 * 60_000,
};

async function readFetchTimestamps(userId: string): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(accountCacheKey(userId, FETCH_TIMESTAMPS_KEY));
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch { return {}; }
}

async function writeFetchTimestamps(userId: string, updates: Record<string, number>): Promise<void> {
  try {
    const existing = await readFetchTimestamps(userId);
    await AsyncStorage.setItem(accountCacheKey(userId, FETCH_TIMESTAMPS_KEY), JSON.stringify({ ...existing, ...updates }));
  } catch { /* silent */ }
}

function isFetchStale(timestamps: Record<string, number>, key: string): boolean {
  const ttl = RESOURCE_TTL_MS[key] ?? 2 * 60_000;
  return Date.now() - (timestamps[key] ?? 0) > ttl;
}

// ── Auth token getter (injected from Clerk context in _layout) ────────────────


// Survive Expo Go HMR: every hot-reload re-evaluates this module and would
// reset a plain `let _getToken = ...` back to the no-op.  The useEffect in
// _layout.tsx only re-fires when isLoaded/isSignedIn/getToken change, so the
// getter stays null after an HMR that doesn't touch those deps — causing all
// PUT/POST requests to be sent without auth → 401 → silent data loss.
// globalThis persists across module re-evaluations, so we use it as a stable
// registry that survives HMR without needing a full component remount.
if (!(globalThis as Record<string, unknown>)[_TOKEN_GETTER_KEY]) {
  (globalThis as Record<string, unknown>)[_TOKEN_GETTER_KEY] = async () => null;
}

export function setAuthTokenGetter(fn: TokenGetter) {
  (globalThis as Record<string, unknown>)[_TOKEN_GETTER_KEY] = fn;
  setApiClientAuthTokenGetter(fn);
}

function _getToken(): Promise<string | null> {
  return readAuthToken();
}

export async function getAuthToken(): Promise<string | null> {
  return _getToken();
}

// ── Typed API error — carries HTTP status + optional Retry-After seconds ──────
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Parsed value of the Retry-After response header (seconds), if present. */
    public readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = await _getToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      // X-App-Token-Status lets the server log whether the client had a token.
      // Visible in deployment logs as hasAuth + this header — confirms APK side.
      'X-App-Token-Status': token ? 'present' : 'missing',
      ...(options?.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const retryAfterRaw = res.headers.get('Retry-After');
    const retryAfter = retryAfterRaw ? parseInt(retryAfterRaw, 10) : null;
    throw new ApiError(
      `API ${options?.method ?? 'GET'} ${path} → ${res.status}: ${text}`,
      res.status,
      Number.isFinite(retryAfter) ? retryAfter : null,
    );
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Models ────────────────────────────────────────────────────────────────────
// ProfileLink, GuideAvailability, BubbleStyle, PanelOverlay, StoryPanel,
// StoryPage, Character, JournalEntryType, JournalEntry, Story, Outfit,
// DiscoverPost — all re-exported from './mappers' at the top of this file.

export interface GuideProfile {
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
  traits?:           string[];
  role?:             string | null;
  country?:          string | null;
  isFollowing:       boolean;
  isAvailableNow:    boolean;
}

export interface GalleryPhoto {
  id:        string;
  imageUri:  string;
  caption:   string;
  createdAt: string;
}

export interface GalleryUsage {
  count: number;
  limit: number;
}

export interface Reward {
  id:          string;
  message:     string;
  subMessage?: string;
  count?:      number;
  icon:        string;
  isRising?:   boolean;
  stars?:      number;
  aura?:       number;
  shards?:     number;
  starUnlock?: string; // star key, e.g. 'quiet' | 'creative' | etc.
}

// Star metadata — used by AppContext (toast firing) and RewardBanner (display)
export const STAR_META: Record<string, { name: string; color: string; icon: string }> = {
  social:   { name: 'Luminary Bond',   color: '#78C8A8', icon: '⬡' },
  memory:   { name: 'Memory Keeper',   color: '#9878C8', icon: '◇' },
  quiet:    { name: 'Quiet Star',      color: '#7890C8', icon: '◐' },
  creative: { name: 'Story Weaver',    color: '#C87AA8', icon: '◈' },
  helping:  { name: 'Guiding Hand',    color: '#C8A84B', icon: '✦' },
  seasonal: { name: 'Celestial Bloom', color: '#68B8B0', icon: '✿' },
};

export interface RewardBalance {
  stars:        number;
  auraEnergy:   number;
  memoryShards: number;
  lifetimeStars: number;
}

// ── Cosmetic item → category map (mirrors server SHOP_CATALOG) ───────────────
export const COSMETIC_CATEGORY_MAP: Record<string, 'frame' | 'accent' | 'theme' | 'effect' | 'card_frame'> = {
  'card_frame_founder_regalia': 'card_frame',
  // Permanent
  'frame_starlight':    'frame',
  'frame_moonveil':     'frame',
  'frame_moonlight':    'frame',
  'frame_fire':         'frame',
  'frame_celestial_wings': 'frame',
  'frame_ember_fox_ears':  'frame',
  'frame_moonhare_ears':   'frame',
  'frame_frost_lynx_ears': 'frame',
  'frame_baby_dragon':    'frame',
  'frame_moon_bunny':     'frame',
  'frame_shadow_keeper':  'frame',
  'frame_forest_spirit':  'frame',
  'frame_star_guardian':  'frame',
  'accent_aura':        'accent',
  'theme_locket':       'theme',
  'theme_aurora':       'theme',
  // Spring
  'frame_blossom':      'frame',
  'accent_petal':       'accent',
  // Summer
  'frame_solstice':     'frame',
  'accent_twilight':    'accent',
  // Autumn
  'frame_harvest':      'frame',
  'accent_ember':       'accent',
  // Winter
  'theme_aurora_winter': 'theme',
  'frame_frost':        'frame',
  // Profile effects
  'effect_butterfly':   'effect',
  'effect_hearts':      'effect',
  'effect_fireflies':   'effect',
  'effect_blossom':     'effect',
  'effect_fire':        'effect',
  'effect_leaves':      'effect',
  'effect_aurora_clouds': 'effect',
  'effect_moonlit_muse': 'effect',
  'effect_cosmic_arrival': 'effect',
};

export interface ShopItem {
  id:              string;
  name:            string;
  description:     string;
  icon:            string;
  category:        'frame' | 'accent' | 'theme' | 'effect' | 'card_frame';
  founderOnly?:    boolean;
  cost:            { stars?: number; aura?: number; shards?: number };
  seasonal?:       boolean;
  seasonalLabel?:  string;
  seasonalMonths?: number[];
  // Server sets this to false for out-of-season items in seasonalPreview
  availableNow?:   boolean;
}

export interface ConstellationState {
  socialCount:     number;
  memoryCount:     number;
  quietStreak:     number;
  helpingCount:    number;
  creativeCount:   number;
  seasonalCount:   number;
  unlockedStars:   string[];
  starUnlockDates: Record<string, string>;
  activeTitle:     string | null;
  newlyUnlocked?:  string[]; // populated by API on each sync; used to fire celebration banners
}

export interface ServerNotification {
  id:        string;
  actorId:   string;
  actorName: string;
  type:      'new_story' | 'new_chapter' | 'new_outfit' | 'witness' | 'save' | 'follow' | 'friend_request' | 'friend_accepted' | 'message' | 'resonate' | 'badge_granted' | 'badge_removed' | 'guide_session_rescheduled' | 'guide_session_cancelled' | 'content_comment' | 'content_reply';
  refId:     string;
  title:     string;
  isRead:    boolean;
  createdAt: string;
}

export interface FriendSummary {
  userId:    string;
  name:      string;
  username?: string | null;
  bio:       string;
  mood:      string;
  traits:    string[];
  avatarUri?: string | null;
  isPublic:  boolean;
  isOnline?: boolean;
  lastSeenAt?: string | null;
}

/** Canonical inbox rows shared by the drawer, inbox, and unread badge. */
export interface DmThread {
  partnerId: string;
  partnerName: string;
  partnerHandle: string | null;
  partnerAvatar: string | null;
  partnerDeleted?: boolean;
  lastMessage: string;
  lastAt: string;
  unread: boolean;
}

// ── Raw API response shapes ────────────────────────────────────────────────────
// Explicit typed interfaces for every API boundary — replace all `any` params
// in mapper functions and `apiFetch<any>` call sites.

// RawCharacterResponse, RawJournalEntryResponse, RawStoryPanel, RawStoryResponse,
// RawOutfitResponse, RawDiscoverApiItem — all re-exported from './mappers' at
// the top of this file.

interface RawGalleryPhoto {
  id: string;
  imageUri?: string | null;
  caption?: string | null;
  createdAt: string;
}

interface RawGalleryUsage {
  count: number;
  limit: number;
}

interface RawNotification {
  id: string;
  actorId: string;
  actorName: string;
  type: string;
  refId: string;
  title: string;
  isRead: boolean;
  createdAt: string;
}

interface RawShopResponse {
  catalog?: ShopItem[];
  seasonalPreview?: unknown[];
  purchasedIds: string[];
  activeCosmetics: Record<string, string>;
}

// ── Context value ─────────────────────────────────────────────────────────────

interface AppContextValue {
  isLoading: boolean;
  apiOnline: boolean;
  hasCheckedApi: boolean;
  creationDataReady: boolean;

  character:    Character;
  setCharacter: (c: Character) => void;

  stories:      Story[];
  addStory:     (s: Story) => Promise<boolean>;
  updateStory:  (id: string, updates: Partial<Omit<Story, 'id'>>) => void;
  deleteStory:  (id: string) => void;

  journalEntries:     JournalEntry[];
  addJournalEntry:    (e: JournalEntry) => void;
  deleteJournalEntry: (id: string) => void;

  outfits:           Outfit[];
  addOutfit:         (o: Outfit) => void;
  updateOutfit:      (id: string, updates: Partial<Omit<Outfit, 'id'>>) => void;
  deleteOutfit:      (id: string) => void;
  activeOutfitId:    string | null;
  setActiveOutfitId: (id: string | null) => void;

  gallery:          GalleryPhoto[];
  galleryUsage:     GalleryUsage;
  addGalleryPhoto:  (imageUri: string, caption?: string) => Promise<void>;
  deleteGalleryPhoto: (id: string) => void;

  discoverPosts:  DiscoverPost[];
  savedStoryIds:  ReadonlySet<string>;
  toggleSavePost: (id: string) => void;
  toggleLikePost: (id: string) => Promise<void>;

  friends:       FriendSummary[];
  refreshFriends: () => Promise<void>;
  refreshSocialRelationships: () => Promise<void>;
  followingIds:  string[];
  blockedIds:    string[];
  followUser:    (targetUserId: string) => void;
  unfollowUser:  (targetUserId: string) => void;
  blockUser:     (targetUserId: string) => Promise<boolean>;
  unblockUser:   (targetUserId: string) => Promise<boolean>;
  myGuides:      GuideProfile[];

  rewards:       Reward[];
  dismissReward: (id: string) => void;
  showRewardToast: (label: string, amounts: { stars?: number; aura?: number; shards?: number }) => void;

  rewardBalance:      RewardBalance | null;
  constellation:      ConstellationState | null;
  reloadRewards:      () => Promise<void>;
  reloadConstellation: () => Promise<void>;

  serverNotifications:         ServerNotification[];
  refreshServerNotifications:  () => Promise<void>;
  markServerNotificationsRead: () => void;
  deleteServerNotification:    (id: string) => void;
  sendNotificationReaction:    (notificationId: string, storyId: string, stickerType: ReplyToStoryReactionBodyStickerType) => Promise<void>;

  campfireUnread:       number;
  unreadCampfireRooms:  { id: string; name: string; mood: string; lastAt: string }[];
  markCampfireRoomRead: (roomId: string) => Promise<void>;
  campfireBadgeSeenAt:  string | null;

  dmUnread:         number;
  dmThreads: DmThread[];
  dmThreadsLoading: boolean;
  dmThreadsError: string | null;
  refreshDmThreads: () => Promise<void>;
  unreadDmThreads:  { partnerId: string; partnerName: string; partnerHandle: string | null; lastAt: string }[];
  markDmThreadRead: (partnerId: string) => void;
  dmBadgeSeenAt:    string | null;
  markAllUnreadSeen: () => void;

  shopCatalog:       ShopItem[];
  purchasedIds:      string[];
  markPurchased:     (itemId: string) => void;
  activeCosmetics:   Record<string, string>;
  setActiveCosmetic: (itemId: string) => void;

  journalLoadError:     boolean;
  storiesLoadError:     boolean;
  outfitsLoadError:     boolean;
  discoverLoadError:    boolean;
  hasCorruptedJournals:  boolean;
  hasCorruptedStories:   boolean;
  hasCorruptedDiscover:  boolean;

  discoverMoodFilter:    string | null;
  setDiscoverMoodFilter: (mood: string | null) => void;

  reloadData:    () => Promise<void>;
  refreshFeed:   () => Promise<void>;
  clearUserData: () => Promise<void>;

  isRefreshing: boolean;
}

// ── Defaults / Helpers — imported from './mappers' at the top of this file ────
// DEFAULT_CHARACTER, toAppCharacter, toAppJournalEntry, toAppStory,
// toAppOutfit, toRawDiscoverPost — all bound via _resolveUri(…, API_BASE).

type RawDiscoverItem = Omit<DiscoverPost, 'saved' | 'isFollowing'>;

// ── Per-item corruption guards ────────────────────────────────────────────────
// These run client-side as a safety net after server-side filtering.
// Any item missing required fields is dropped and the corruption flag is set.

function isValidStoryRecord(r: RawStoryResponse): boolean {
  if (typeof r.id !== 'string' || r.id.length === 0) return false;
  if (typeof r.date !== 'string') return false;
  const title = r.chapterTitle ?? r.chapter_title ?? '';
  if (typeof title !== 'string' || title.trim().length === 0) return false;
  // Video posts have no panels — allow them through
  if (r.contentType === 'video') return true;
  return Array.isArray(r.panels) && r.panels.length > 0;
}

function isValidJournalRecord(r: RawJournalEntryResponse): boolean {
  return (
    typeof r.id === 'string' && r.id.length > 0 &&
    typeof r.text === 'string' && r.text.length > 0 &&
    typeof r.date === 'string' &&
    (r.type === 'diary' || r.type === 'friend' || r.type === 'moment')
  );
}

function isValidDiscoverPost(r: RawDiscoverApiItem): boolean {
  if (typeof r.id !== 'string' || r.id.trim().length === 0) return false;
  if (r.contentType === 'video') {
    return typeof r.videoUri === 'string' && r.videoUri.trim().length > 0;
  }
  const hasImage = [r.imageUri, r.thumbnailUri].some(uri => typeof uri === 'string' && uri.trim().length > 0);
  const hasText = typeof r.storySnippet === 'string' && r.storySnippet.trim().length > 0;
  const hasPanel = Array.isArray(r.panels) && r.panels.some(p => p !== null && typeof p === 'object' && (
    (typeof p.text === 'string' && p.text.trim().length > 0) ||
    (typeof p.imageUri === 'string' && p.imageUri.trim().length > 0)
  ));
  const hasPage = Array.isArray(r.pages) && r.pages.some(page => page !== null && typeof page === 'object');
  return hasImage || hasText || hasPanel || hasPage;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
