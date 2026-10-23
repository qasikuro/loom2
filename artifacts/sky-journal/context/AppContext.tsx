import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { accountCacheKey } from '@/utils/accountCache';
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
import { setAuthTokenGetter as setApiClientAuthTokenGetter } from '@workspace/api-client-react';
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

type TokenGetter = () => Promise<string | null>;

// Survive Expo Go HMR: every hot-reload re-evaluates this module and would
// reset a plain `let _getToken = ...` back to the no-op.  The useEffect in
// _layout.tsx only re-fires when isLoaded/isSignedIn/getToken change, so the
// getter stays null after an HMR that doesn't touch those deps — causing all
// PUT/POST requests to be sent without auth → 401 → silent data loss.
// globalThis persists across module re-evaluations, so we use it as a stable
// registry that survives HMR without needing a full component remount.
const _TOKEN_GETTER_KEY = '__skyJournalTokenGetter';
if (!(globalThis as Record<string, unknown>)[_TOKEN_GETTER_KEY]) {
  (globalThis as Record<string, unknown>)[_TOKEN_GETTER_KEY] = async () => null;
}

export function setAuthTokenGetter(fn: TokenGetter) {
  (globalThis as Record<string, unknown>)[_TOKEN_GETTER_KEY] = fn;
  setApiClientAuthTokenGetter(fn);
}

function _getToken(): Promise<string | null> {
  return ((globalThis as Record<string, unknown>)[_TOKEN_GETTER_KEY] as TokenGetter)();
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
export const COSMETIC_CATEGORY_MAP: Record<string, 'frame' | 'accent' | 'theme' | 'effect'> = {
  // Permanent
  'frame_starlight':    'frame',
  'frame_moonveil':     'frame',
  'frame_moonlight':    'frame',
  'frame_fire':         'frame',
  'frame_celestial_wings': 'frame',
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
};

export interface ShopItem {
  id:              string;
  name:            string;
  description:     string;
  icon:            string;
  category:        'frame' | 'accent' | 'theme' | 'effect';
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
  type:      'new_story' | 'new_chapter' | 'new_outfit' | 'witness' | 'save' | 'follow' | 'message' | 'resonate' | 'badge_granted' | 'badge_removed' | 'guide_session_rescheduled' | 'guide_session_cancelled';
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
  followingIds:  string[];
  blockedIds:    string[];
  followUser:    (targetUserId: string) => void;
  unfollowUser:  (targetUserId: string) => void;
  blockUser:     (targetUserId: string) => Promise<void>;
  unblockUser:   (targetUserId: string) => Promise<void>;
  myGuides:      GuideProfile[];

  rewards:       Reward[];
  dismissReward: (id: string) => void;
  showRewardToast: (label: string, amounts: { stars?: number; aura?: number; shards?: number }) => void;

  rewardBalance:      RewardBalance | null;
  constellation:      ConstellationState | null;
  reloadRewards:      () => Promise<void>;
  reloadConstellation: () => Promise<void>;

  serverNotifications:         ServerNotification[];
  markServerNotificationsRead: () => void;
  deleteServerNotification:    (id: string) => void;

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
  return (
    typeof r.id === 'string' && r.id.length > 0 &&
    typeof r.authorUserId === 'string' && r.authorUserId.length > 0 &&
    typeof r.chapterTitle === 'string' && r.chapterTitle.trim().length > 0 &&
    Array.isArray(r.panels) && r.panels.every(p => p !== null && typeof p === 'object')
  );
}

// ── Zod validation helper ─────────────────────────────────────────────────────
// Validates `raw` against a Zod schema (for OpenAPI-covered endpoints).
// On success: returns the original raw value — preserving server-side extras
//   not yet described in the spec (e.g. panel bgPreset/overlays in stories).
// On failure: logs a warning and returns `fallback` — callers MUST NOT map null.
type SafeSchema = { safeParse(d: unknown): { success: boolean; error?: { issues: unknown[] } } };
function parseOrDefault<F>(schema: SafeSchema, raw: unknown, fallback: F, endpoint: string): unknown | F {
  if (raw === null || raw === undefined) return fallback;
  const result = schema.safeParse(raw);
  if (!result.success) {
    console.warn(`[AppContext] ${endpoint} schema mismatch:`, result.error?.issues.slice(0, 3));
    return fallback;
  }
  return raw;
}

// ── Provider ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded: authLoaded, isSignedIn } = useAuth();
  const cacheUserIdRef = useRef<string | null>(null);
  cacheUserIdRef.current = authLoaded && isSignedIn ? userId : null;
  const lumiUserIdRef = useRef(userId);
  lumiUserIdRef.current = userId;
  const [creationDataAccountId, setCreationDataAccountId] = useState<string | null>(null);
  const creationDataReady = !!userId && creationDataAccountId === userId;
  useEffect(() => {
    setCreationDataAccountId(null);
    return () => { if (userId) clearLumiCreations(userId); };
  }, [userId]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(false);
  const [hasCheckedApi, setHasCheckedApi] = useState(false);

  const [character, setCharacterState]      = useState<Character>(DEFAULT_CHARACTER);
  const [stories, setStories]               = useState<Story[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [outfits, setOutfits]               = useState<Outfit[]>([]);
  const [savedStoryIds, setSavedStoryIds]   = useState<Set<string>>(new Set());
  const [rewards, setRewards]               = useState<Reward[]>([]);
  const [rewardBalance, setRewardBalance]   = useState<RewardBalance | null>(null);
  const [constellation, setConstellation]   = useState<ConstellationState | null>(null);
  const [activeOutfitId, setActiveOutfitIdState] = useState<string | null>(null);
  const [purchasedIds, setPurchasedIds]         = useState<string[]>([]);
  const [shopCatalog, setShopCatalog]           = useState<ShopItem[]>([]);
  const [activeCosmetics, setActiveCosmeticsState] = useState<Record<string, string>>({});

  const [gallery, setGallery]           = useState<GalleryPhoto[]>([]);
  const [galleryUsage, setGalleryUsage] = useState<GalleryUsage>({ count: 0, limit: 200 });

  const [journalLoadError,     setJournalLoadError]     = useState(false);
  const [storiesLoadError,     setStoriesLoadError]     = useState(false);
  const [outfitsLoadError,     setOutfitsLoadError]     = useState(false);
  const [discoverLoadError,    setDiscoverLoadError]    = useState(false);
  const [hasCorruptedJournals,  setHasCorruptedJournals]  = useState(false);
  const [hasCorruptedStories,   setHasCorruptedStories]   = useState(false);
  const [hasCorruptedDiscover,  setHasCorruptedDiscover]  = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [discoverMoodFilter, setDiscoverMoodFilter] = useState<string | null>(null);

  const [discoverFeedRaw, setDiscoverFeedRaw]         = useState<RawDiscoverItem[]>([]);
  const likeRequestsInFlight = useRef(new Set<string>());
  const [followingIds, setFollowingIds]               = useState<string[]>([]);
  const [blockedIds, setBlockedIds]                   = useState<string[]>([]);
  const [friends, setFriends]                         = useState<FriendSummary[]>([]);
  const [serverNotifications, setServerNotifications] = useState<ServerNotification[]>([]);
  const [myGuides, setMyGuides]                       = useState<GuideProfile[]>([]);

  const [campfireUnread, setCampfireUnread]           = useState(0);
  const [unreadCampfireRooms, setUnreadCampfireRooms] = useState<{ id: string; name: string; mood: string; lastAt: string }[]>([]);
  const [campfireBadgeSeenAt, setCampfireBadgeSeenAt] = useState<string | null>(null);
  const [dmUnread,        setDmUnread]        = useState(0);
  const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
  const [dmThreadsLoading, setDmThreadsLoading] = useState(false);
  const [dmThreadsError, setDmThreadsError] = useState<string | null>(null);
  const dmThreadsLoadedRef = useRef(false);
  const dmRequestRef = useRef<Promise<void> | null>(null);
  const dmEpochRef = useRef(0);
  const dmReadDuringRefreshRef = useRef(new Set<string>());
  const [unreadDmThreads, setUnreadDmThreads] = useState<{ partnerId: string; partnerName: string; partnerHandle: string | null; lastAt: string }[]>([]);
  const [dmBadgeSeenAt,   setDmBadgeSeenAt]   = useState<string | null>(null);
  const campfireToastShownRef = useRef<Set<string>>(new Set());

  const discoverPosts = useMemo((): DiscoverPost[] =>
    discoverFeedRaw
      .filter(p => !blockedIds.includes(p.authorUserId))
      .map(p => ({
        ...p,
        saved:       savedStoryIds.has(p.id),
        isFollowing: followingIds.includes(p.authorUserId),
      })),
  [discoverFeedRaw, savedStoryIds, followingIds, blockedIds]);

  const stateRef     = useRef({ journalEntries, stories, outfits, character });
  useEffect(() => { stateRef.current = { journalEntries, stories, outfits, character }; });

  // Guards against concurrent loads and ensures skeletons only flash on true cold start
  const isLoadingRef = useRef(false);
  const dataReadyRef = useRef(false);
  const hasCachedContentRef = useRef(false);
  const loadEpochRef = useRef(0);
  const cacheHydrationRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);
  const previousCacheIdentityRef = useRef<string | null | undefined>(undefined);

  // Tracks previously known unlocked stars so we can diff on each constellation reload.
  // null = no baseline yet (initial load) → never fire toasts until we have a baseline.
  const prevUnlockedStarsRef = useRef<string[] | null>(null);

  function getCacheItem(key: string, ownerId = cacheUserIdRef.current): Promise<string | null> {
    return ownerId ? AsyncStorage.getItem(accountCacheKey(ownerId, key)) : Promise.resolve(null);
  }
  function setCacheItem(key: string, value: string, ownerId = cacheUserIdRef.current): Promise<void> {
    return ownerId ? AsyncStorage.setItem(accountCacheKey(ownerId, key), value) : Promise.resolve();
  }
  function removeCacheItem(key: string, ownerId = cacheUserIdRef.current): Promise<void> {
    return ownerId ? AsyncStorage.removeItem(accountCacheKey(ownerId, key)) : Promise.resolve();
  }
  function writeAccountTimestamps(updates: Record<string, number>): Promise<void> {
    const ownerId = cacheUserIdRef.current;
    return ownerId ? writeFetchTimestamps(ownerId, updates) : Promise.resolve();
  }

  // Polls until Clerk returns a non-null token, up to maxMs.
  // Uses exponential backoff (0 → 50 → 150 → 350 → 500ms) so the common
  // case (token ready immediately after sign-in) returns in the first iteration.
  async function waitForToken(maxMs = 4000): Promise<string | null> {
    const deadline = Date.now() + maxMs;
    let delay = 0;
    while (Date.now() < deadline) {
      if (delay > 0) await new Promise<void>(r => setTimeout(r, delay));
      const t = await _getToken();
      if (t) return t;
      // Exponential backoff capped at 500 ms
      delay = delay === 0 ? 50 : Math.min(delay * 2 + 50, 500);
    }
    return null;
  }

  // M-5: Backup-key helpers. AsyncStorage processes setItem calls in queue
  // order, so the _bak write is always committed before the main key write
  // begins. If the process is killed mid-write on the main key, _bak holds
  // the complete, valid latest value that readCacheSafe can recover from.
  async function readCacheSafe(key: string, ownerId = cacheUserIdRef.current): Promise<string | null> {
    const value = await getCacheItem(key, ownerId);
    if (value === null) return null;
    try { JSON.parse(value); return value; } catch {
      return getCacheItem(`${key}_bak`, ownerId);
    }
  }
  function writeStoryCache(json: string): void {
    void setCacheItem('stories_v1_bak', json).catch(() => null);
    void setCacheItem('stories_v1', json).catch(() => null);
  }
  function writeJournalCache(json: string): void {
    void setCacheItem('journal_v2_bak', json).catch(() => null);
    void setCacheItem('journal_v2', json).catch(() => null);
  }
  function writeOutfitCache(json: string): void {
    void setCacheItem('outfits_v1_bak', json).catch(() => null);
    void setCacheItem('outfits_v1', json).catch(() => null);
  }

  async function loadFromCache(ownerId: string) {
    try {
      const [c, j, s, o, d, f, sv, ac, rb, cfSeen, dmSeen, galleryRaw, galleryUsageRaw, friendsRaw, notificationsRaw, guidesRaw, shopRaw, activeOutfitId, blockedRaw] = await Promise.all([
        getCacheItem('character_v2', ownerId),
        readCacheSafe('journal_v2', ownerId),         // M-5: falls back to _bak on corrupt
        readCacheSafe('stories_v1', ownerId),         // M-5: falls back to _bak on corrupt
        readCacheSafe('outfits_v1', ownerId),         // M-5: falls back to _bak on corrupt
        getCacheItem('discover_v1', ownerId),
        getCacheItem('following_v1', ownerId),
        getCacheItem('saved_stories_v1', ownerId),
        getCacheItem('active_cosmetics_v1', ownerId),
        getCacheItem('reward_balance_v1', ownerId),
        getCacheItem('campfire_badge_seen_at', ownerId),
        getCacheItem('dm_badge_seen_at', ownerId),
        getCacheItem('gallery_v1', ownerId),
        getCacheItem('gallery_usage_v1', ownerId),
        getCacheItem('friends_v1', ownerId),
        getCacheItem('notifications_v1', ownerId),
        getCacheItem('my_guides_v1', ownerId),
        getCacheItem('shop_catalog_v1', ownerId),
        getCacheItem('active_outfit_v1', ownerId),
        getCacheItem('blocked_users_v1', ownerId),
      ]);
      if (ownerId !== cacheUserIdRef.current) return;
      // M-5: Wrap each parse individually — one corrupted key must not
      // silently prevent all remaining cache entries from being restored.
      try { if (c) setCharacterState(JSON.parse(c)); } catch { /* use default */ }
      try { if (j) setJournalEntries(JSON.parse(j)); } catch { /* use default */ }
      try { if (s) setStories(JSON.parse(s)); } catch { /* use default */ }
      try { if (o) setOutfits(JSON.parse(o)); } catch { /* use default */ }
      try { if (d) setDiscoverFeedRaw(JSON.parse(d)); } catch { /* use default */ }
      try { if (f) setFollowingIds(JSON.parse(f)); } catch { /* use default */ }
      if (sv) { try { setSavedStoryIds(new Set(JSON.parse(sv))); } catch { /* ignore */ } }
      if (ac) { try { setActiveCosmeticsState(JSON.parse(ac)); } catch { /* ignore */ } }
      if (rb) { try { setRewardBalance(JSON.parse(rb)); } catch { /* ignore */ } }
      if (cfSeen) setCampfireBadgeSeenAt(cfSeen);
      if (dmSeen) setDmBadgeSeenAt(dmSeen);
      if (galleryRaw) { try { setGallery(JSON.parse(galleryRaw)); } catch { /* ignore */ } }
      if (galleryUsageRaw) { try { setGalleryUsage(JSON.parse(galleryUsageRaw)); } catch { /* ignore */ } }
      if (friendsRaw) { try { setFriends(JSON.parse(friendsRaw)); } catch { /* ignore */ } }
      if (notificationsRaw) { try { setServerNotifications(JSON.parse(notificationsRaw)); } catch { /* ignore */ } }
      if (guidesRaw) { try { setMyGuides(JSON.parse(guidesRaw)); } catch { /* ignore */ } }
      if (shopRaw) { try {
        const shop = JSON.parse(shopRaw) as { catalog?: ShopItem[]; purchasedIds?: string[] };
        if (Array.isArray(shop.catalog)) setShopCatalog(shop.catalog);
        if (Array.isArray(shop.purchasedIds)) setPurchasedIds(shop.purchasedIds);
      } catch { /* ignore */ } }
      if (activeOutfitId) setActiveOutfitIdState(activeOutfitId);
      if (blockedRaw) { try { setBlockedIds(JSON.parse(blockedRaw)); } catch { /* ignore */ } }
      hasCachedContentRef.current = [c, j, s, o, d, f, sv, ac, rb, galleryRaw, friendsRaw, notificationsRaw, guidesRaw, shopRaw, activeOutfitId, blockedRaw].some(Boolean);
    } catch {
      hasCachedContentRef.current = false;
    } finally {
      if (ownerId === cacheUserIdRef.current) {
        dataReadyRef.current = true;
        if (hasCachedContentRef.current) setIsLoading(false);
      }
    }
  }

  function ensureCacheLoaded(ownerId: string): Promise<void> {
    if (cacheHydrationRef.current?.userId === ownerId) return cacheHydrationRef.current.promise;
    const promise = loadFromCache(ownerId).finally(() => {
      if (cacheHydrationRef.current?.userId === ownerId) cacheHydrationRef.current = null;
    });
    cacheHydrationRef.current = { userId: ownerId, promise };
    return promise;
  }

  useEffect(() => {
    if (!authLoaded) return;
    const ownerId = isSignedIn ? userId : null;
    if (!ownerId) {
      setIsLoading(false);
      return;
    }
    void ensureCacheLoaded(ownerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ensureCacheLoaded is a local ref-backed helper; identity is the only trigger.
  }, [authLoaded, isSignedIn, userId]);

  // Older builds used global cache keys. They are never hydrated; remove them
  // when the user signs out so they cannot be mistaken for a current account.
  const LEGACY_UNSCOPED_CACHE_KEYS = [
    'character_v2', 'journal_v2', 'stories_v1', 'outfits_v1',
    'journal_v2_bak', 'stories_v1_bak', 'outfits_v1_bak', // M-5: backup keys
    'discover_v1', 'following_v1', 'saved_stories_v1', 'collection_v1',
    'shop_catalog_v1', 'reward_balance_v1', 'active_outfit_v1',
    'active_cosmetics_v1', 'gallery_v1', 'gallery_usage_v1', 'friends_v1',
    'notifications_v1', 'my_guides_v1', 'campfire_badge_seen_at',
    'dm_badge_seen_at', FETCH_TIMESTAMPS_KEY,
  ];

  const clearUserData = useCallback(async () => {
    // Clear the outgoing account's in-memory and on-device private data. The
    // new account must never inherit the previous account's offline content.
    const outgoingUserId = previousCacheIdentityRef.current;
    if (outgoingUserId) {
      const prefix = accountCacheKey(outgoingUserId, '');
      void AsyncStorage.getAllKeys().then(keys => {
        const accountKeys = keys.filter(key => key.startsWith(prefix));
        return accountKeys.length ? AsyncStorage.multiRemove(accountKeys) : undefined;
      }).catch(() => null);
    }
    setCharacterState(DEFAULT_CHARACTER);
    setJournalEntries([]);
    setStories([]);
    setOutfits([]);
    setGallery([]);
    setGalleryUsage({ count: 0, limit: 200 });
    setDiscoverFeedRaw([]);
    setFollowingIds([]);
    setFriends([]);
    setBlockedIds([]);
    dmEpochRef.current += 1;
    dmRequestRef.current = null;
    dmReadDuringRefreshRef.current = new Set();
    dmThreadsLoadedRef.current = false;
    setDmThreads([]);
    setDmThreadsError(null);
    setDmThreadsLoading(false);
    setUnreadDmThreads([]);
    setDmUnread(0);
    setDmBadgeSeenAt(null);
    setActiveOutfitIdState(null);
    setServerNotifications([]);
    setSavedStoryIds(new Set());
    setRewardBalance(null);
    setRewards([]);
    setConstellation(null);
    setPurchasedIds([]);
    setShopCatalog([]);
    setMyGuides([]);
    setActiveCosmeticsState({});
    setCampfireUnread(0);
    setUnreadCampfireRooms([]);
    setCampfireBadgeSeenAt(null);
    setApiOnline(false);
    setHasCheckedApi(false);
    // Drop old unscoped values. New caches are namespaced by Clerk user ID.
    AsyncStorage.multiRemove(LEGACY_UNSCOPED_CACHE_KEYS).catch(() => null);
    loadEpochRef.current += 1;
    cacheHydrationRef.current = null;
    hasCachedContentRef.current = false;
    dataReadyRef.current = !cacheUserIdRef.current;
    isLoadingRef.current = false;
    setIsLoading(!!cacheUserIdRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: mount-only; deps would trigger sign-out on unrelated re-renders
  }, []);

  useLayoutEffect(() => {
    if (!authLoaded) return;
    const nextIdentity = cacheUserIdRef.current;
    if (
      previousCacheIdentityRef.current !== undefined
      && previousCacheIdentityRef.current !== nextIdentity
    ) {
      void clearUserData();
    }
    previousCacheIdentityRef.current = nextIdentity;
  }, [authLoaded, isSignedIn, userId, clearUserData]);

  // Called by AuthTokenBridge once a valid Clerk token is available.
  // Uses waitForToken() to avoid the old "fire all → 401 ×6 → wait 1500ms → retry" race.
  async function loadData(retry = true) {
    // Prevent two concurrent loads (e.g. rapid sign-out / sign-in)
    if (isLoadingRef.current) return;
    const requestAccountId = cacheUserIdRef.current;
    if (!requestAccountId) {
      setIsLoading(false);
      return;
    }
    const requestEpoch = loadEpochRef.current;
    isLoadingRef.current = true;
    const creationRequestAccount = requestAccountId;
    setCreationDataAccountId(null);

    await ensureCacheLoaded(requestAccountId);
    if (
      requestEpoch !== loadEpochRef.current
      || requestAccountId !== cacheUserIdRef.current
    ) return;

    // Cached screens stay mounted while the refresh runs. A first-time account
    // keeps the app's compact loading state until its essential data arrives.
    if (!hasCachedContentRef.current) setIsLoading(true);

    try {
      // Block until Clerk has a valid token — avoids all the wasted 401 round trips.
      const token = await waitForToken(6000);
      if (!token) {
        // Token not available — could be offline OR the OAuth/Google setActive()
        // is still writing to the SecureStore token cache (takes longer than email
        // auth). Show cached data so the screen isn't blank and schedule ONE
        // automatic retry in 3 s; the second attempt is passed retry=false so it
        // cannot loop further.
        console.warn(`[AppContext] waitForToken timed out after 6 s (retry=${retry}). No Clerk token available.`);
        if (requestEpoch !== loadEpochRef.current || requestAccountId !== cacheUserIdRef.current) return;
        setApiOnline(false);
        if (retry) setTimeout(() => loadData(false), 3000);
        return;
      }
      let apiResponded = false;
      async function fetchOptional<T>(path: string): Promise<T | null> {
        try {
          const value = await apiFetch<T>(path);
          apiResponded = true;
          return value;
        } catch (error) {
          // HTTP errors (including expired auth) still prove the server replied;
          // only transport failures should produce the offline state.
          if (error instanceof ApiError) apiResponded = true;
          return null;
        }
      }
      // Core content is awaited separately so a slow social/config endpoint
      // cannot hold the first usable screen. Everything still runs in parallel.
      const coreFetchPromise = Promise.all([
        fetchOptional<unknown>('/character'),
        fetchOptional<unknown>('/journal-entries'),
        fetchOptional<unknown>('/stories'),
        fetchOptional<unknown>('/outfits'),
      ]);
      const discoverRequest = fetchOptional<unknown>('/discover');
      const blockRequest = fetchOptional<{ blockedId: string }[]>('/users/blocked');
      // Reels is the initial tab. Do not hold its video source behind a slow
      // gallery, shop, notifications, or even core-profile response. Reuse these
      // same promises below: this adds no requests.
      void publishReelStartup(
        discoverRequest,
        blockRequest,
        () => requestEpoch === loadEpochRef.current && requestAccountId === cacheUserIdRef.current,
        (raw, blocked) => {
          const valid = parseOrDefault(ApiDiscoverSchema, raw, null, '/discover') as RawDiscoverApiItem[] | null;
          if (valid === null) return;
          const records = valid.filter(isValidDiscoverPost);
          const feed = records.map(record => toRawDiscoverPost(record, API_BASE));
          setBlockedIds(blocked);
          setDiscoverFeedRaw(feed);
          setDiscoverLoadError(false);
          setHasCorruptedDiscover(records.length < valid.length);
          // The normal snapshot batch below still persists this response;
          // don't add disk writes while the first video is starting.
        },
      ).catch(error => console.warn('[AppContext] Early reel preparation failed', error));
      const secondaryFetchPromise = Promise.all([
        fetchOptional<unknown>('/gallery'),
        fetchOptional<unknown>('/gallery/usage'),
        discoverRequest,
        fetchOptional<unknown>('/follows/following'),
        fetchOptional<unknown>('/notifications'),
        fetchOptional<unknown>('/friends'),
        fetchOptional<GuideProfile[]>('/guides?following=true'),
        fetchOptional<unknown>('/rewards'),
        fetchOptional<unknown>('/constellation'),
        fetchOptional<unknown>('/rewards/shop'),
        fetchOptional<string[]>('/stories/saved/ids'),
        fetchOptional<{ effects: Array<{ id: string; config: EffectDef }> }>('/effects/catalog'),
        blockRequest,
      ]);
      const [_charFetch, _entriesFetch, _storiesFetch, _outfitsFetch] = await coreFetchPromise;
      if (
        requestEpoch !== loadEpochRef.current
        || requestAccountId !== cacheUserIdRef.current
      ) return;

      const earlyCharRaw = parseOrDefault(ApiCharacterSchema, _charFetch, null, '/character') as RawCharacterResponse | null;
      const earlyEntriesRaw = parseOrDefault(ApiJournalEntriesSchema, _entriesFetch, null, '/journal-entries') as RawJournalEntryResponse[] | null;
      const earlyStoriesRaw = parseOrDefault(ApiStoriesSchema, _storiesFetch, null, '/stories') as RawStoryResponse[] | null;
      const earlyOutfitsRaw = parseOrDefault(ApiOutfitsSchema, _outfitsFetch, null, '/outfits') as RawOutfitResponse[] | null;
      if (earlyCharRaw !== null) {
        setCharacterState(toAppCharacter(earlyCharRaw, API_BASE));
        void setCacheItem('character_v2', JSON.stringify(toAppCharacter(earlyCharRaw, API_BASE)), requestAccountId).catch(() => null);
      }
      if (earlyEntriesRaw !== null) {
        const earlyEntries = earlyEntriesRaw.filter(isValidJournalRecord).map(r => toAppJournalEntry(r, API_BASE));
        setJournalEntries(earlyEntries);
        void setCacheItem('journal_v2', JSON.stringify(earlyEntries), requestAccountId).catch(() => null);
      }
      if (earlyStoriesRaw !== null) {
        const earlyStories = earlyStoriesRaw.filter(isValidStoryRecord).map(r => toAppStory(r, API_BASE));
        setStories(earlyStories);
        void setCacheItem('stories_v1', JSON.stringify(earlyStories), requestAccountId).catch(() => null);
      }
      if (earlyOutfitsRaw !== null) {
        const earlyOutfits = earlyOutfitsRaw.map(r => toAppOutfit(r, API_BASE));
        setOutfits(earlyOutfits);
        void setCacheItem('outfits_v1', JSON.stringify(earlyOutfits), requestAccountId).catch(() => null);
      }
      setJournalLoadError(earlyEntriesRaw === null);
      setStoriesLoadError(earlyStoriesRaw === null);
      setOutfitsLoadError(earlyOutfitsRaw === null);
      hasCachedContentRef.current = hasCachedContentRef.current
        || earlyCharRaw !== null
        || earlyEntriesRaw !== null
        || earlyStoriesRaw !== null
        || earlyOutfitsRaw !== null;
      dataReadyRef.current = true;
      setIsLoading(false);

      const [
        _galleryFetch, _usageFetch, _discoverFetch, _followingFetch, _notifFetch, _friendsFetch, guidesRaw,
        _rewardsFetch, _constellationFetch, _shopFetch, savedIdsRaw, effectsCatalogRaw, _blockedFetch,
      ] = await secondaryFetchPromise;
      if (
        requestEpoch !== loadEpochRef.current
        || requestAccountId !== cacheUserIdRef.current
      ) return;

      // Validate all endpoints against generated Zod schemas.
      // Returns the original raw value on success (preserving server-side extras),
      // or null on mismatch — no malformed data reaches mapper functions.
      const charRaw          = parseOrDefault(ApiCharacterSchema,      _charFetch,          null, '/character')         as RawCharacterResponse    | null;
      const entriesRaw       = parseOrDefault(ApiJournalEntriesSchema, _entriesFetch,       null, '/journal-entries')    as RawJournalEntryResponse[] | null;
      const storiesRaw       = parseOrDefault(ApiStoriesSchema,        _storiesFetch,       null, '/stories')            as RawStoryResponse[]       | null;
      const outfitsRaw       = parseOrDefault(ApiOutfitsSchema,        _outfitsFetch,       null, '/outfits')            as RawOutfitResponse[]      | null;
      const galleryRaw       = parseOrDefault(ApiGallerySchema,        _galleryFetch,       null, '/gallery')            as RawGalleryPhoto[]        | null;
      const usageRaw         = parseOrDefault(ApiGalleryUsageSchema,   _usageFetch,         null, '/gallery/usage')      as RawGalleryUsage          | null;
      const discoverRaw      = parseOrDefault(ApiDiscoverSchema,       _discoverFetch,      null, '/discover')           as RawDiscoverApiItem[]     | null;
      const followingRaw     = parseOrDefault(ApiFollowingSchema,      _followingFetch,     null, '/follows/following')  as string[]                 | null;
      const notifRaw         = parseOrDefault(ApiNotificationsSchema,  _notifFetch,         null, '/notifications')      as RawNotification[]        | null;
      const friendsRaw       = parseOrDefault(ApiFriendsSchema,        _friendsFetch,       null, '/friends')            as FriendSummary[]          | null;
      const rewardBalanceRaw = parseOrDefault(ApiRewardBalanceSchema,  _rewardsFetch,       null, '/rewards')            as RewardBalance            | null;
      const constellationRaw = parseOrDefault(ApiConstellationSchema,  _constellationFetch, null, '/constellation')      as ConstellationState       | null;
      const shopRaw          = parseOrDefault(ApiShopSchema,           _shopFetch,          null, '/rewards/shop')       as RawShopResponse          | null;

      // Process core data — safe defaults already guaranteed by parseOrDefault above
      const char = charRaw ? toAppCharacter(charRaw, API_BASE) : DEFAULT_CHARACTER;

      const validEntryRecs    = entriesRaw ? entriesRaw.filter(isValidJournalRecord) : [];
      const validStoryRecs    = storiesRaw ? storiesRaw.filter(isValidStoryRecord)   : [];
      const journalsCorrupted = entriesRaw !== null && validEntryRecs.length < entriesRaw.length;
      const storiesCorrupted  = storiesRaw !== null && validStoryRecs.length < storiesRaw.length;
      if (journalsCorrupted) console.warn(`[AppContext] Dropped ${entriesRaw!.length - validEntryRecs.length} malformed journal entries client-side`);
      if (storiesCorrupted)  console.warn(`[AppContext] Dropped ${storiesRaw!.length - validStoryRecs.length} malformed stories client-side`);

      const entries = validEntryRecs.map(r => toAppJournalEntry(r, API_BASE));
      const stors   = validStoryRecs.map(r => toAppStory(r, API_BASE));
      const outs    = outfitsRaw ? outfitsRaw.map(r => toAppOutfit(r, API_BASE)) : [];
      const gal     = (galleryRaw  ?? []).map((r: RawGalleryPhoto): GalleryPhoto => ({
        id:        r.id,
        imageUri:  resolveUri(r.imageUri ?? undefined) ?? r.imageUri ?? '',
        caption:   r.caption ?? '',
        createdAt: r.createdAt,
      }));

      // Process social data
      const discoverRawValid = (discoverRaw ?? []).filter(isValidDiscoverPost);
      const discoverCorrupted = discoverRaw !== null && discoverRawValid.length < (discoverRaw ?? []).length;
      if (discoverCorrupted) console.warn(`[AppContext] Dropped ${(discoverRaw ?? []).length - discoverRawValid.length} malformed discover posts client-side`);
      const feed   = discoverRawValid.map(r => toRawDiscoverPost(r, API_BASE));
      const follows = followingRaw ?? [];
      const guides  = (guidesRaw   ?? []) as GuideProfile[];

      // Process notifications
      const notifs = (notifRaw ?? []).map((r: RawNotification): ServerNotification => ({
        id:        r.id,
        actorId:   r.actorId,
        actorName: r.actorName,
        type:      r.type as ServerNotification['type'],
        refId:     r.refId,
        title:     r.title,
        isRead:    r.isRead,
        createdAt: r.createdAt,
      }));

      // Commit state — only for endpoints whose fetch succeeded.
      // If an endpoint returned null (API down, 401, network error) we skip its
      // setter so existing cached state (loaded earlier by loadFromCache) remains
      // visible.  A transient server restart must never blank the user's screen.
      if (charRaw    !== null) setCharacterState(char);
      if (entriesRaw !== null) setJournalEntries(entries);
      if (storiesRaw !== null) setStories(stors);
      if (outfitsRaw !== null) setOutfits(outs);
      // Empty content means "nothing created" only after all three endpoints
      // were validated for this account, not after a missing/failed request.
      if (creationRequestAccount && creationRequestAccount === lumiUserIdRef.current &&
          entriesRaw !== null && storiesRaw !== null && outfitsRaw !== null) {
        setCreationDataAccountId(creationRequestAccount);
      }
      if (galleryRaw !== null) {
        setGallery(gal);
        setGalleryUsage({ count: usageRaw?.count ?? gal.length, limit: usageRaw?.limit ?? 200 });
      } else if (usageRaw !== null) {
        setGalleryUsage({ count: usageRaw.count, limit: usageRaw.limit });
      }
      if (discoverRaw  !== null) setDiscoverFeedRaw(feed);
      if (followingRaw !== null) setFollowingIds(follows);
      if (friendsRaw   !== null) setFriends(friendsRaw);
      // Load blocked user IDs so the discover feed can filter them out
      if (Array.isArray(_blockedFetch)) {
        setBlockedIds((_blockedFetch as { blockedId: string }[]).map(r => r.blockedId));
      }
      if (notifRaw     !== null) setServerNotifications(notifs);
      if (guidesRaw !== null) setMyGuides(guides);
      if (rewardBalanceRaw) setRewardBalance(rewardBalanceRaw);
      if (constellationRaw) {
        setConstellation(constellationRaw);
        // Establish the baseline — no toasts on initial load, only on subsequent reloads.
        prevUnlockedStarsRef.current = constellationRaw.unlockedStars ?? [];
      }
      if (shopRaw?.purchasedIds) {
        const ids = shopRaw.purchasedIds as string[];
        setPurchasedIds(ids);
        // Hydrate active cosmetics from server, sanitising against owned items
        if (shopRaw.activeCosmetics && typeof shopRaw.activeCosmetics === 'object') {
          const rawActive = shopRaw.activeCosmetics as Record<string, string>;
          const sanitised: Record<string, string> = {};
          for (const [cat, itemId] of Object.entries(rawActive)) {
            if (ids.includes(itemId)) sanitised[cat] = itemId;
          }
          setActiveCosmeticsState(sanitised);
          void setCacheItem('active_cosmetics_v1', JSON.stringify(sanitised), requestAccountId).catch(() => null);
        }
      }
      if (shopRaw?.catalog && Array.isArray(shopRaw.catalog)) {
        setShopCatalog(shopRaw.catalog);
      }

      // Register any custom AI-generated effects so ProfileEffect can render them
      if (effectsCatalogRaw?.effects && Array.isArray(effectsCatalogRaw.effects)) {
        const customMap: Record<string, EffectDef> = {};
        for (const e of effectsCatalogRaw.effects) {
          if (e.id && e.config) customMap[e.id] = e.config;
        }
        if (Object.keys(customMap).length > 0) registerCustomEffects(customMap);
      }

      // Transport errors are the only signal that the API is offline. HTTP
      // responses, including auth errors, still mean the server is reachable.
      const allCoreFailed = charRaw === null && entriesRaw === null && storiesRaw === null && outfitsRaw === null && discoverRaw === null;
      if (allCoreFailed) {
        console.warn('[AppContext] loadData: ALL core API calls returned null. Token was present but server may have rejected it (401) or network failed. Check adb logcat for [apiFetch] token=NULL lines above.');
        // Schedule ONE automatic retry — the server may have been briefly down
        // during a post-merge restart.  retry=false prevents further loops.
        if (retry) setTimeout(() => loadData(false), 3000);
      }

      setApiOnline(apiResponded);
      setHasCheckedApi(true);
      setJournalLoadError(entriesRaw === null);
      setStoriesLoadError(storiesRaw === null);
      setOutfitsLoadError(outfitsRaw === null);
      setDiscoverLoadError(discoverRaw === null);
      setHasCorruptedJournals(journalsCorrupted);
      setHasCorruptedStories(storiesCorrupted);
      setHasCorruptedDiscover(discoverCorrupted);

      // Restore active outfit across sessions.
      if (outs.length > 0) {
        const savedId = await getCacheItem('active_outfit_v1', requestAccountId);
        const validId = savedId && outs.some(o => o.id === savedId) ? savedId : outs[0].id;
        setActiveOutfitIdState(validId);
        void setCacheItem('active_outfit_v1', validId, requestAccountId).catch(() => null);
      }

      // Sync saved-story IDs from server (authoritative); fall back to AsyncStorage cache.
      if (Array.isArray(savedIdsRaw)) {
        const ids = new Set<string>(savedIdsRaw);
        setSavedStoryIds(ids);
        void setCacheItem('saved_stories_v1', JSON.stringify([...ids]), requestAccountId).catch(() => null);
      } else {
        getCacheItem('saved_stories_v1', requestAccountId).then(raw => {
          if (raw && requestAccountId === cacheUserIdRef.current) {
            try { setSavedStoryIds(new Set(JSON.parse(raw))); } catch { /* ignore */ }
          }
        }).catch(() => null);
      }

      // Persist fresh data to cache — only when the fetch succeeded.
      // Unconditional writes were the root cause of the "data not showing" bug:
      // a transient 401 / server restart caused loadData to overwrite good cached
      // data with DEFAULT_CHARACTER + empty arrays, permanently blanking the screen
      // until the user force-killed and reopened the app.
      const cacheWrites: Promise<void>[] = [];
      if (charRaw    !== null) cacheWrites.push(setCacheItem('character_v2', JSON.stringify(char), requestAccountId));
      if (entriesRaw !== null) {
        cacheWrites.push(setCacheItem('journal_v2_bak', JSON.stringify(entries), requestAccountId));  // M-5
        cacheWrites.push(setCacheItem('journal_v2', JSON.stringify(entries), requestAccountId));
      }
      if (storiesRaw !== null) {
        cacheWrites.push(setCacheItem('stories_v1_bak', JSON.stringify(stors), requestAccountId));   // M-5
        cacheWrites.push(setCacheItem('stories_v1', JSON.stringify(stors), requestAccountId));
      }
      if (outfitsRaw !== null) {
        cacheWrites.push(setCacheItem('outfits_v1_bak', JSON.stringify(outs), requestAccountId));   // M-5
        cacheWrites.push(setCacheItem('outfits_v1', JSON.stringify(outs), requestAccountId));
      }
      if (galleryRaw !== null) {
        cacheWrites.push(setCacheItem('gallery_v1', JSON.stringify(gal), requestAccountId));
        cacheWrites.push(setCacheItem('gallery_usage_v1', JSON.stringify({
          count: usageRaw?.count ?? gal.length,
          limit: usageRaw?.limit ?? 200,
        }), requestAccountId));
      }
      if (discoverRaw !== null) cacheWrites.push(setCacheItem('discover_v1', JSON.stringify(feed), requestAccountId));
      if (followingRaw !== null) cacheWrites.push(setCacheItem('following_v1', JSON.stringify(follows), requestAccountId));
      if (friendsRaw !== null) cacheWrites.push(setCacheItem('friends_v1', JSON.stringify(friendsRaw), requestAccountId));
      if (notifRaw !== null) cacheWrites.push(setCacheItem('notifications_v1', JSON.stringify(notifs), requestAccountId));
      if (guidesRaw !== null) cacheWrites.push(setCacheItem('my_guides_v1', JSON.stringify(guides), requestAccountId));
      if (Array.isArray(_blockedFetch)) {
        cacheWrites.push(setCacheItem(
          'blocked_users_v1',
          JSON.stringify((_blockedFetch as { blockedId: string }[]).map(r => r.blockedId)),
          requestAccountId,
        ));
      }
      if (rewardBalanceRaw) {
        cacheWrites.push(setCacheItem('reward_balance_v1', JSON.stringify(rewardBalanceRaw), requestAccountId));
      }
      if (shopRaw?.catalog && Array.isArray(shopRaw.catalog)) {
        cacheWrites.push(
          setCacheItem('shop_catalog_v1', JSON.stringify({
            catalog:         shopRaw.catalog,
            seasonalPreview: shopRaw.seasonalPreview ?? [],
            purchasedIds: shopRaw.purchasedIds ?? [],
          }), requestAccountId),
        );
      }
      await Promise.allSettled(cacheWrites);

      // Only advance a resource's timestamp when its data actually parsed
      // successfully.  Stamping failed/null resources would make softLoadData()
      // skip them on the next resume even though the data is stale or missing.
      const now = Date.now();
      const tsUpdates: Record<string, number> = {};
      if (charRaw    !== null) tsUpdates.character           = now;
      if (entriesRaw !== null) tsUpdates['journal-entries']  = now;
      if (storiesRaw !== null) tsUpdates.stories             = now;
      if (outfitsRaw !== null) tsUpdates.outfits             = now;
      if (galleryRaw !== null) tsUpdates.gallery             = now;
      if (discoverRaw !== null) tsUpdates.discover           = now;
      if (followingRaw !== null) tsUpdates.following         = now;
      if (Object.keys(tsUpdates).length > 0) {
        writeFetchTimestamps(requestAccountId, tsUpdates).catch(() => null);
      }
    } catch {
      // Unexpected error — restore from cache rather than leaving a blank screen.
      if (
        requestEpoch !== loadEpochRef.current
        || requestAccountId !== cacheUserIdRef.current
      ) return;
      setApiOnline(false);
      setHasCheckedApi(true);
      setJournalLoadError(true);
      setStoriesLoadError(true);
      setOutfitsLoadError(true);
      setDiscoverLoadError(true);
    } finally {
      if (
        requestEpoch === loadEpochRef.current
        && requestAccountId === cacheUserIdRef.current
      ) {
        dataReadyRef.current = true;
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    }
  }

  const fetchFriends = useCallback(async () => {
    const requestAccountId = cacheUserIdRef.current;
    if (!requestAccountId) return;
    try {
      const data = await apiFetch<FriendSummary[]>('/friends');
      if (data && requestAccountId === cacheUserIdRef.current) {
        setFriends(data);
        void AsyncStorage.setItem(accountCacheKey(requestAccountId, 'friends_v1'), JSON.stringify(data)).catch(() => null);
      }
    } catch { /* silently skip */ }
  }, []);

  async function loadSocialData() {
    const requestAccountId = cacheUserIdRef.current;
    if (!requestAccountId) return;
    const requestEpoch = loadEpochRef.current;
    let apiResponded = false;
    async function fetchSocial<T>(path: string): Promise<T | null> {
      try {
        const value = await apiFetch<T>(path);
        apiResponded = true;
        return value;
      } catch (error) {
        if (error instanceof ApiError) apiResponded = true;
        return null;
      }
    }
    try {
      const [discoverRaw, followingRaw, friendsRaw] = await Promise.all([
        fetchSocial<RawDiscoverApiItem[]>('/discover'),
        // catch(() => null) so a failed fetch is distinguishable from a genuine
        // empty following list — only a non-null result advances the timestamp.
        fetchSocial<string[]>('/follows/following'),
        fetchSocial<FriendSummary[]>('/friends'),
      ]);
      if (
        requestEpoch !== loadEpochRef.current
        || requestAccountId !== cacheUserIdRef.current
      ) return;

      setApiOnline(apiResponded);
      setHasCheckedApi(true);
      setDiscoverLoadError(discoverRaw === null);

      const discoverValid = (discoverRaw ?? []).filter(isValidDiscoverPost);
      const socialCorrupted = discoverRaw !== null && discoverValid.length < (discoverRaw ?? []).length;
      if (socialCorrupted) console.warn(`[AppContext] loadSocialData: dropped ${(discoverRaw ?? []).length - discoverValid.length} malformed discover posts`);
      setHasCorruptedDiscover(socialCorrupted);

      const feed    = discoverValid.map(r => toRawDiscoverPost(r, API_BASE));
      const follows = followingRaw ?? [];

      setDiscoverFeedRaw(feed);
      setFollowingIds(follows);
      if (friendsRaw !== null) setFriends(friendsRaw);

      const now = Date.now();
      const cacheWrites: Promise<void>[] = [];
      const tsUpdates: Record<string, number> = {};

      if (discoverRaw !== null) {
        cacheWrites.push(setCacheItem('discover_v1', JSON.stringify(feed)));
        tsUpdates.discover = now;
      }
      if (followingRaw !== null) {
        cacheWrites.push(setCacheItem('following_v1', JSON.stringify(follows)));
        tsUpdates.following = now;
      }
      if (friendsRaw !== null) cacheWrites.push(setCacheItem('friends_v1', JSON.stringify(friendsRaw)));

      if (cacheWrites.length > 0) await Promise.allSettled(cacheWrites);
      if (Object.keys(tsUpdates).length > 0) writeFetchTimestamps(requestAccountId, tsUpdates).catch(() => null);
    } catch { /* silently skip */ }
  }

  // Silent foreground refresh — fetches fresh data without resetting state first
  // so there is no UI flash. Admin deletions/amendments take effect the moment
  // the user brings the app back to the foreground.
  //
  // Staleness model: each resource has a TTL defined in RESOURCE_TTL_MS.
  // Resources whose cached data is still fresh are skipped entirely, avoiding
  // unnecessary network round-trips and the brief "old → new" flicker that
  // occurred when the entire batch was always re-fetched on resume.
  // Forced refresh paths (pull-to-refresh, explicit reloadData()) call
  // loadData() directly and always bypass these checks.
  async function softLoadData() {
    const requestAccountId = cacheUserIdRef.current;
    if (!requestAccountId) return;
    const requestEpoch = loadEpochRef.current;
    const token = await _getToken();
    if (!token) return;

    setIsRefreshing(true);
    try {
      const timestamps = await readFetchTimestamps(requestAccountId);

      const needsChar    = isFetchStale(timestamps, 'character');
      const needsJournal = isFetchStale(timestamps, 'journal-entries');
      const needsStories = isFetchStale(timestamps, 'stories');
      const needsOutfits = isFetchStale(timestamps, 'outfits');
      // Treat gallery + usage as a unit — their TTLs match and they depend on each other
      const needsGallery = isFetchStale(timestamps, 'gallery');
      const needsSocial  = isFetchStale(timestamps, 'discover') || isFetchStale(timestamps, 'following');

      // Nothing is stale — skip all network calls entirely
      if (!needsChar && !needsJournal && !needsStories && !needsOutfits && !needsGallery && !needsSocial) return;

      let apiResponded = false;
      async function fetchRefresh<T>(path: string): Promise<T | null> {
        try {
          const value = await apiFetch<T>(path);
          apiResponded = true;
          return value;
        } catch (error) {
          if (error instanceof ApiError) apiResponded = true;
          return null;
        }
      }
      const [_charFetch, _entriesFetch, _storiesFetch, _outfitsFetch, _galleryFetch, _usageFetch] = await Promise.all([
        needsChar    ? fetchRefresh<unknown>('/character')          : Promise.resolve(null),
        needsJournal ? fetchRefresh<unknown>('/journal-entries')    : Promise.resolve(null),
        needsStories ? fetchRefresh<unknown>('/stories')            : Promise.resolve(null),
        needsOutfits ? fetchRefresh<unknown>('/outfits')            : Promise.resolve(null),
        needsGallery ? fetchRefresh<unknown>('/gallery')            : Promise.resolve(null),
        needsGallery ? fetchRefresh<unknown>('/gallery/usage')      : Promise.resolve(null),
      ]);
      if (
        requestEpoch !== loadEpochRef.current
        || requestAccountId !== cacheUserIdRef.current
      ) return;
      setApiOnline(apiResponded);
      setHasCheckedApi(true);

      const now = Date.now();
      const tsUpdates: Record<string, number> = {};
      const cacheWrites: Promise<void>[] = [];

      if (needsChar) {
        const charRaw = parseOrDefault(ApiCharacterSchema, _charFetch, null, '/character') as RawCharacterResponse | null;
        if (charRaw !== null) {
          const char = toAppCharacter(charRaw, API_BASE);
          setCharacterState(char);
          cacheWrites.push(setCacheItem('character_v2', JSON.stringify(char), requestAccountId));
          tsUpdates.character = now;
        }
      }

      if (needsJournal) {
        const entriesRaw = parseOrDefault(ApiJournalEntriesSchema, _entriesFetch, null, '/journal-entries') as RawJournalEntryResponse[] | null;
        if (entriesRaw !== null) {
          const validRecs = entriesRaw.filter(isValidJournalRecord);
          if (validRecs.length < entriesRaw.length) {
            setHasCorruptedJournals(true);
            console.warn(`[AppContext] softLoad: dropped ${entriesRaw.length - validRecs.length} malformed journal entries`);
          }
          const entries = validRecs.map(r => toAppJournalEntry(r, API_BASE));
          setJournalEntries(entries);
          cacheWrites.push(setCacheItem('journal_v2_bak', JSON.stringify(entries), requestAccountId));  // M-5
          cacheWrites.push(setCacheItem('journal_v2', JSON.stringify(entries), requestAccountId));
          tsUpdates['journal-entries'] = now;
        }
      }

      if (needsStories) {
        const storiesRaw = parseOrDefault(ApiStoriesSchema, _storiesFetch, null, '/stories') as RawStoryResponse[] | null;
        if (storiesRaw !== null) {
          const validRecs = storiesRaw.filter(isValidStoryRecord);
          if (validRecs.length < storiesRaw.length) {
            setHasCorruptedStories(true);
            console.warn(`[AppContext] softLoad: dropped ${storiesRaw.length - validRecs.length} malformed stories`);
          }
          const stors = validRecs.map(r => toAppStory(r, API_BASE));
          setStories(stors);
          cacheWrites.push(setCacheItem('stories_v1_bak', JSON.stringify(stors), requestAccountId));  // M-5
          cacheWrites.push(setCacheItem('stories_v1', JSON.stringify(stors), requestAccountId));
          tsUpdates.stories = now;
        }
      }

      if (needsOutfits) {
        const outfitsRaw = parseOrDefault(ApiOutfitsSchema, _outfitsFetch, null, '/outfits') as RawOutfitResponse[] | null;
        if (outfitsRaw !== null) {
          const outs = outfitsRaw.map(r => toAppOutfit(r, API_BASE));
          setOutfits(outs);
          cacheWrites.push(setCacheItem('outfits_v1_bak', JSON.stringify(outs), requestAccountId));  // M-5
          cacheWrites.push(setCacheItem('outfits_v1', JSON.stringify(outs), requestAccountId));
          tsUpdates.outfits = now;
        }
      }

      if (needsGallery) {
        const galleryRaw = parseOrDefault(ApiGallerySchema,      _galleryFetch, null, '/gallery')       as RawGalleryPhoto[] | null;
        const usageRaw   = parseOrDefault(ApiGalleryUsageSchema, _usageFetch,   null, '/gallery/usage') as RawGalleryUsage   | null;
        if (galleryRaw !== null) {
          const gal = galleryRaw.map((r: RawGalleryPhoto): GalleryPhoto => ({
            id:        r.id,
            imageUri:  resolveUri(r.imageUri ?? undefined) ?? r.imageUri ?? '',
            caption:   r.caption ?? '',
            createdAt: r.createdAt,
          }));
          setGallery(gal);
          setGalleryUsage({ count: usageRaw?.count ?? gal.length, limit: usageRaw?.limit ?? 200 });
          tsUpdates.gallery = now;
        }
      }

      if (cacheWrites.length > 0) {
        await Promise.allSettled(cacheWrites);
      }

      if (Object.keys(tsUpdates).length > 0) {
        writeFetchTimestamps(requestAccountId, tsUpdates).catch(() => null);
      }

      setApiOnline(true);

      // loadSocialData() writes its own timestamps on success
      if (needsSocial) await loadSocialData();
    } catch { /* silently fail — keep showing cached data */ }
    finally { setIsRefreshing(false); }
  }

  // ── Campfire unread polling ───────────────────────────────────────────────────
  // Polls the campfire lobby to detect new messages in rooms the user has visited.
  // Uses AsyncStorage keys "campfire_seen_<roomId>" (ISO timestamp of last visit).
  // Fires a single toast per room per app session; badge persists until user taps in.

  const pollCampfireUnread = useCallback(async () => {
    try {
      const rooms = await apiFetch<{
        id: string; name: string; mood: string;
        lastMessage: { createdAt: string; authorName: string } | null;
      }[]>('/campfire');
      if (!rooms || !Array.isArray(rooms)) return;

      const newUnread: { id: string; name: string; mood: string; lastAt: string }[] = [];
      for (const room of rooms) {
        if (!room.lastMessage) continue;
        const seenRaw = await getCacheItem(`campfire_seen_${room.id}`);
        if (!seenRaw) continue; // never visited → don't count as unread
        const lastSeen = new Date(seenRaw).getTime();
        const lastMsg  = new Date(room.lastMessage.createdAt).getTime();
        if (lastMsg > lastSeen) {
          newUnread.push({ id: room.id, name: room.name, mood: room.mood, lastAt: room.lastMessage.createdAt });
          // Toast once per room per app session
          if (!campfireToastShownRef.current.has(room.id)) {
            campfireToastShownRef.current.add(room.id);
            const toastId = `campfire-${room.id}-${lastMsg}`;
            setRewards(prev => [
              { id: toastId, icon: '💬', message: `New whisper in ${room.name}`, subMessage: `${room.lastMessage!.authorName} spoke by the fire` },
              ...prev.slice(0, 4),
            ]);
            setTimeout(() => setRewards(prev => prev.filter(r => r.id !== toastId)), 5000);
          }
        }
      }
      setUnreadCampfireRooms(newUnread);
      setCampfireUnread(newUnread.length);
    } catch { /* silent */ }
  }, []);

  const markCampfireRoomRead = useCallback(async (roomId: string) => {
    await setCacheItem(`campfire_seen_${roomId}`, new Date().toISOString());
    campfireToastShownRef.current.delete(roomId);
    setUnreadCampfireRooms(prev => {
      const next = prev.filter(r => r.id !== roomId);
      setCampfireUnread(next.length);
      return next;
    });
  }, []);

  // ── DM unread polling ─────────────────────────────────────────────────────
  // Polls /api/messages threads to find conversations with unread messages.
  // The thread list is the canonical source for the notifications sheet; badge
  // suppression (dot vs. no dot) is handled separately via dmBadgeSeenAt.
  const pollDmUnread = useCallback(async () => {
    if (dmRequestRef.current) return dmRequestRef.current;
    const epoch = dmEpochRef.current;
    const readDuringRefresh = new Set<string>();
    dmReadDuringRefreshRef.current = readDuringRefresh;
    if (!dmThreadsLoadedRef.current) setDmThreadsLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const request = (async () => {
      try {
        const rows = await apiFetch<DmThread[]>('/messages', { signal: controller.signal });
        if (epoch !== dmEpochRef.current) return;
        if (!Array.isArray(rows)) throw new Error('Invalid inbox response');
        const threads = rows.map(thread => readDuringRefresh.has(thread.partnerId)
          ? { ...thread, unread: false } : thread)
          .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
        setDmThreads(previous => {
          const unchanged = previous.length === threads.length && previous.every((thread, index) => {
            const next = threads[index];
            return next
              && thread.partnerId === next.partnerId
              && thread.partnerName === next.partnerName
              && thread.partnerHandle === next.partnerHandle
              && thread.partnerAvatar === next.partnerAvatar
              && thread.lastMessage === next.lastMessage
              && thread.lastAt === next.lastAt
              && thread.unread === next.unread;
          });
          return unchanged ? previous : threads;
        });
        dmThreadsLoadedRef.current = true;
        setDmThreadsError(null);
        const unreadThreads = threads.filter(thread => thread.unread).map(thread => ({
          partnerId: thread.partnerId, partnerName: thread.partnerName,
          partnerHandle: thread.partnerHandle, lastAt: thread.lastAt,
        }));
        setUnreadDmThreads(previous => {
          const unchanged = previous.length === unreadThreads.length && previous.every((thread, index) => {
            const next = unreadThreads[index];
            return next
              && thread.partnerId === next.partnerId
              && thread.partnerName === next.partnerName
              && thread.partnerHandle === next.partnerHandle
              && thread.lastAt === next.lastAt;
          });
          return unchanged ? previous : unreadThreads;
        });
        setDmUnread(previous => previous === unreadThreads.length ? previous : unreadThreads.length);
      } catch (error) {
        if (epoch !== dmEpochRef.current) return;
        setDmThreadsError(error instanceof ApiError ? String(error.status) : 'network');
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setDmThreads([]);
          setUnreadDmThreads([]);
          setDmUnread(0);
          dmThreadsLoadedRef.current = true;
        }
      } finally {
        clearTimeout(timeout);
        if (epoch === dmEpochRef.current) {
          dmRequestRef.current = null;
          setDmThreadsLoading(false);
        }
      }
    })();
    dmRequestRef.current = request;
    return request;
  }, []);

  const markDmThreadRead = useCallback((partnerId: string) => {
    dmReadDuringRefreshRef.current.add(partnerId);
    setDmThreads(prev => {
      const target = prev.find(thread => thread.partnerId === partnerId && thread.unread);
      if (!target) return prev;
      return prev.map(thread => thread === target ? { ...thread, unread: false } : thread);
    });
    setUnreadDmThreads(prev => {
      const next = prev.filter(t => t.partnerId !== partnerId);
      if (next.length === prev.length) return prev;
      setDmUnread(count => count === next.length ? count : next.length);
      return next;
    });
  }, []);

  // Records when the user last opened the notifications panel — used purely
  // for bell-dot suppression. Does NOT touch the thread arrays or counts,
  // so the sheet can still display all unread items for the user to act on.
  // New campfire/DM activity arriving after this timestamp will re-light the dot.
  const markAllUnreadSeen = useCallback(() => {
    const now = new Date().toISOString();
    setCampfireBadgeSeenAt(now);
    void setCacheItem('campfire_badge_seen_at', now);
    setDmBadgeSeenAt(now);
    void setCacheItem('dm_badge_seen_at', now);
  }, []);

  // Re-fetch from the API every time the app comes to the foreground so that
  // admin amendments (removed stories, account changes) are reflected without
  // requiring a full sign-out / sign-in cycle.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        softLoadData();
        pollCampfireUnread();
        pollDmUnread();
        // H-1: Drain any mutations that failed their retry while the app was
        // backgrounded so profile/outfit/cosmetic saves are not silently lost.
        drainMutationQueue(apiFetch).catch(() => null);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: mount-only subscription; softLoadData/pollCampfireUnread are stable refs
  }, []);

  // Poll campfire for new messages every 90s once API is available
  useEffect(() => {
    if (!apiOnline) return;
    pollCampfireUnread();
    const id = setInterval(() => pollCampfireUnread(), 90_000);
    return () => clearInterval(id);
  }, [apiOnline, pollCampfireUnread]);

  // Poll DM threads for unread messages every 60s once API is available
  useEffect(() => {
    if (!apiOnline) return;
    pollDmUnread();
    const id = setInterval(() => pollDmUnread(), 60_000);
    return () => clearInterval(id);
  }, [apiOnline, pollDmUnread]);

  // ── Character ──────────────────────────────────────────────────────────────

  const setCharacter = useCallback((c: Character) => {
    setCharacterState(c);
    void setCacheItem('character_v2', JSON.stringify(c));
    // Stamp TTL as now so softLoadData treats local state as fresh and does NOT
    // immediately re-fetch — which would race the in-flight PUT and overwrite the
    // edit with stale DB data. Other devices will naturally re-fetch after 5 min.
    writeAccountTimestamps({ character: Date.now() }).catch(() => null);
    const characterBody = JSON.stringify({
      name:              c.name,
      bio:               c.bio,
      mood:              c.mood,
      traits:            c.traits,
      isPublic:          c.isPublic,
      username:          c.username          ?? null,
      avatarUri:         c.avatarUri         ?? null,
      activeOutfitId:    c.activeOutfitId    ?? null,
      birthday:          c.birthday          ?? null,
      country:           c.country           ?? null,
      role:              c.role              ?? null,
      timezone:          c.timezone          ?? null,
      pushToken:         c.pushToken         ?? null,
      links:             c.links             ?? null,
      isGuide:           c.isGuide           ?? false,
      guideBio:          c.guideBio          ?? '',
      guideTopics:       c.guideTopics       ?? [],
      guideAvailability: c.guideAvailability ?? null,
      intention:         c.intention         ?? null,
      intentionDate:     c.intentionDate     ?? null,
      showOnlineStatus:  c.showOnlineStatus  ?? true,
    });
    apiFetch('/character', { method: 'PUT', body: characterBody })
      .then(() => {
        // PUT succeeded — remove any older queued snapshot so the drain can't
        // replay a stale full-character body from a previous session and
        // silently overwrite this fresh DB value with e.g. name: "Sky Child".
        clearMutation('/character', 'PUT').catch(() => null);
      })
      .catch((err) => {
        console.warn('[setCharacter] PUT /character failed (will auto-retry):', err);
        // H-1: Auto-retry once immediately, then queue for next foreground drain.
        // Do NOT require a toast tap — profile edits must persist automatically.
        apiFetch('/character', { method: 'PUT', body: characterBody })
          .then(() => { clearMutation('/character', 'PUT').catch(() => null); })
          .catch((err2) => {
            console.warn('[setCharacter] PUT /character retry failed — queuing mutation:', err2);
            enqueueMutation('/character', 'PUT', characterBody).catch(() => null);
            showToastGlobal("Couldn't sync profile — will retry when online", 'warning');
          });
      });
  }, []);

  // ── Inline reward toast helper (defined early so mutations can use it) ──────

  // nextSlotRef tracks when the queue will next be free so regular currency toasts never overlap.
  const nextSlotRef = useRef(0);

  const fireToast = useCallback((label: string, amounts: { stars?: number; aura?: number; shards?: number }) => {
    const now  = Date.now();
    const wait = Math.max(0, nextSlotRef.current - now);
    nextSlotRef.current = now + wait + 3600; // 3.5 s shown + 100 ms gap
    const id = `toast-${now}-${Math.random()}`;
    const doAdd = () => {
      setRewards(prev => [...prev, {
        id, message: label, icon: 'star' as const,
        stars: amounts.stars, aura: amounts.aura, shards: amounts.shards,
      }]);
      setTimeout(() => setRewards(prev => prev.filter(r => r.id !== id)), 3500);
    };
    if (wait <= 0) { doAdd(); } else { setTimeout(doAdd, wait); }
  }, []);

  // ── Star-unlock sequential queue ─────────────────────────────────────────────
  // Star unlock banners are shown one at a time: each waits for the previous to
  // fully expire before appearing. This prevents stacking when multiple stars
  // unlock at once (e.g. after a long absence).
  const starUnlockQueueRef  = useRef<string[]>([]);
  const starUnlockActiveRef = useRef(false);

  const drainStarUnlockQueue = useCallback(() => {
    // Guard covers both "currently showing" AND "already scheduled but waiting
    // for a currency-toast slot" — set to true before any setTimeout so that
    // multiple simultaneous loop calls can't each schedule their own show().
    if (starUnlockActiveRef.current) return;
    const starKey = starUnlockQueueRef.current.shift();
    if (!starKey) return;                           // queue is empty

    // Claim the slot immediately so re-entrant calls bail out.
    starUnlockActiveRef.current = true;

    // Wait until any active currency toast has finished so the star unlock
    // banner becomes rewards[0] the instant it is inserted — meaning its
    // 6-second removal timer starts exactly when it becomes visible.
    const waitForSlot = Math.max(0, nextSlotRef.current - Date.now());

    const show = () => {
      // Reserve the display slot so currency toasts queue behind this banner.
      nextSlotRef.current = Date.now() + 6100;
      const id = `star-unlock-${starKey}-${Date.now()}`;
      setRewards(prev => [...prev, {
        id,
        message:    STAR_META[starKey]?.name ?? starKey,
        icon:       'star' as const,
        starUnlock: starKey,
      }]);
      // After 6 s display + 100 ms gap, release the slot and drain next item.
      setTimeout(() => {
        setRewards(prev => prev.filter(r => r.id !== id));
        starUnlockActiveRef.current = false;
        drainStarUnlockQueue();
      }, 6100);
    };

    if (waitForSlot <= 0) { show(); } else { setTimeout(show, waitForSlot); }
  }, []);

  // Fires a celebration banner for a newly-unlocked constellation star.
  // Stays on screen longer (6 s) than a regular currency toast.
  const fireStarUnlockToast = useCallback((starKey: string) => {
    starUnlockQueueRef.current.push(starKey);
    drainStarUnlockQueue();
    // Sensory confirmation: strong success haptic when a star unlocks
    import('expo-haptics').then(H => H.notificationAsync(H.NotificationFeedbackType.Success)).catch(() => {});
  }, [drainStarUnlockQueue]);

  // ── Reload helpers — defined before mutations so callbacks can call them ────

  const reloadRewards = useCallback(async () => {
    try {
      const data = await apiFetch<RewardBalance>('/rewards');
      setRewardBalance(data);
      setCacheItem('reward_balance_v1', JSON.stringify(data)).catch(() => null);
    } catch { /* silently skip */ }
  }, []);

  const reloadConstellation = useCallback(async () => {
    try {
      const data = await apiFetch<ConstellationState>('/constellation');
      setConstellation(data);

      // Diff against previous baseline and fire celebration banners for new stars.
      // If prevUnlockedStarsRef is null we have no baseline yet — skip toasts.
      const prev = prevUnlockedStarsRef.current;
      prevUnlockedStarsRef.current = data.unlockedStars ?? [];

      if (prev !== null) {
        // Prefer the server-computed diff (newlyUnlocked) if present; fall back to local diff.
        const newStars: string[] = data.newlyUnlocked?.length
          ? data.newlyUnlocked
          : (data.unlockedStars ?? []).filter(s => !prev.includes(s));

        for (const starKey of newStars) {
          fireStarUnlockToast(starKey);
        }
      }
    } catch { /* silently skip */ }
  }, [fireStarUnlockToast]);

  // ── Journal entries ────────────────────────────────────────────────────────

  const addJournalEntry = useCallback(async (entry: JournalEntry): Promise<void> => {
    // C-6: Reject local file:// URIs — they are never valid server URLs and
    // would cause broken images for every device that loads this entry.
    const safeImageUri = entry.imageUri?.startsWith('file://') ? null : (entry.imageUri ?? null);

    const safeEntry = { ...entry, imageUri: safeImageUri ?? undefined };

    setJournalEntries(prev => {
      const updated = [safeEntry, ...prev.filter(e => e.id !== entry.id)];
      writeJournalCache(JSON.stringify(updated));
      return updated;
    });
    writeAccountTimestamps({ 'journal-entries': 0 }).catch(() => null);
    try {
      const res = await apiFetch<{ rewardGranted: boolean; rewardAmounts?: { stars?: number; aura?: number; shards?: number } }>(
        '/journal-entries', {
          method: 'POST',
          body:   JSON.stringify({
            id:         safeEntry.id,
            date:       safeEntry.date,
            type:       safeEntry.type,
            text:       safeEntry.text,
            mood:       safeEntry.mood,
            imageUri:   safeImageUri,
            friendName: safeEntry.friendName ?? null,
          }),
        },
      );
      if (res?.rewardGranted && res.rewardAmounts) {
        fireToast('Journal entry', res.rewardAmounts);
        reloadRewards().catch(() => null);
      }
      // Always sync constellation so memory count & star progress update immediately
      reloadConstellation().catch(() => null);
      publishLumiCreation(userId, 'journal', safeEntry.id);
      import('@/utils/xpFlash').then(m => m.fireXPFlash('Memory grows in the night sky')).catch(() => {});
    } catch {
      // H-3: Revert the optimistic add — the entry must not persist locally as
      // "saved" when the server never received it (mirrors addStory's pattern).
      setJournalEntries(prev => {
        const reverted = prev.filter(e => e.id !== safeEntry.id);
        writeJournalCache(JSON.stringify(reverted));
        return reverted;
      });
      const retryBody = JSON.stringify({
        id:         safeEntry.id,
        date:       safeEntry.date,
        type:       safeEntry.type,
        text:       safeEntry.text,
        mood:       safeEntry.mood,
        imageUri:   safeImageUri,
        friendName: safeEntry.friendName ?? null,
      });
      showToastGlobal("Journal entry couldn't sync — tap to retry", 'error', () => {
        // Re-add optimistically then retry the API call
        setJournalEntries(prev => {
          if (prev.some(e => e.id === safeEntry.id)) return prev;
          const restored = [safeEntry, ...prev];
          writeJournalCache(JSON.stringify(restored));
          return restored;
        });
        apiFetch('/journal-entries', { method: 'POST', body: retryBody })
          .then(() => { publishLumiCreation(userId, 'journal', safeEntry.id); })
          .catch(() => null);
      });
    }
  }, [fireToast, reloadRewards, reloadConstellation, userId]);

  const deleteJournalEntry = useCallback((id: string) => {
    writeAccountTimestamps({ 'journal-entries': 0 }).catch(() => null);
    handleDeleteJournalEntry(
      id,
      stateRef.current.journalEntries,
      setJournalEntries,
      (json) => writeJournalCache(json),
      (path, opts) => apiFetch(path, opts),
      showToastGlobal,
    );
  }, []);

  // ── Stories ────────────────────────────────────────────────────────────────

  const addStory = useCallback(async (story: Story): Promise<boolean> => {
    // C-6: Strip local file:// URIs from panels and pages before any network or
    // persistence call.  Local URIs are device-specific and cannot be resolved
    // by the server or other clients, so publishing them produces permanently
    // broken images.
    function sanitizePanels(panels: Story['panels']) {
      return panels.map(p => ({
        ...p,
        imageUri: p.imageUri?.startsWith('file://') ? undefined : p.imageUri,
      }));
    }
    const sanitizedPanels = sanitizePanels(story.panels);
    const sanitizedPages  = story.pages?.map(page => ({
      ...page,
      panels: sanitizePanels(page.panels),
    }));

    const storyPostBody = JSON.stringify({
      id:            story.id,
      date:          story.date,
      chapterTitle:  story.chapterTitle,
      description:   story.description ?? '',
      panels:        sanitizedPanels,
      mood:          story.mood,
      location:      story.location,
      isPublic:      story.isPublic,
      pageLayoutKey: story.pageLayoutKey ?? null,
      pages:         sanitizedPages ?? null,
      music:         story.music ?? null,
    });

    // Optimistic local update
    writeAccountTimestamps({ stories: 0 }).catch(() => null);
    setStories(prev => {
      const updated = [story, ...prev.filter(s => s.id !== story.id)];
      const slim = updated.map(s => ({
        ...s,
        panels: s.panels.map(p => ({ ...p, imageUri: undefined })),
      }));
      writeStoryCache(JSON.stringify(slim));
      return updated;
    });

    try {
      const res = await apiFetch<{ rewardGranted?: boolean; rewardAmounts?: { stars?: number; aura?: number; shards?: number } }>(
        '/stories', { method: 'POST', body: storyPostBody },
      );
      if (res?.rewardGranted && res.rewardAmounts) {
        fireToast('Story created', res.rewardAmounts);
        reloadRewards().catch(() => null);
      }
      // Always sync constellation so creative count updates immediately
      reloadConstellation().catch(() => null);
      import('@/utils/xpFlash').then(m => m.fireXPFlash('Creative light brightens')).catch(() => {});
      loadSocialData();
      publishLumiCreation(userId, 'story', story.id);
      return true;
    } catch {
      // Revert optimistic update so it doesn't linger
      setStories(prev => {
        const reverted = prev.filter(s => s.id !== story.id);
        const slim = reverted.map(s => ({
          ...s,
          panels: s.panels.map(p => ({ ...p, imageUri: undefined })),
        }));
        writeStoryCache(JSON.stringify(slim));
        return reverted;
      });
      // Retry: re-add to local state and re-post to API
      showToastGlobal("Story couldn't be published — please try again", 'error', () => {
        setStories(prev => {
          if (prev.some(s => s.id === story.id)) return prev;
          const updated = [story, ...prev];
          const slim = updated.map(s => ({ ...s, panels: s.panels.map(p => ({ ...p, imageUri: undefined })) }));
          writeStoryCache(JSON.stringify(slim));
          return updated;
        });
        apiFetch('/stories', { method: 'POST', body: storyPostBody })
          .then(() => {
            publishLumiCreation(userId, 'story', story.id);
            loadSocialData();
          })
          .catch(() => showToastGlobal("Story still couldn't be published", 'error'));
      });
      return false;
    }
  }, [fireToast, reloadRewards, reloadConstellation, userId]);

  const updateStory = useCallback((id: string, updates: Partial<Omit<Story, 'id'>>) => {
    // M-4: Reset TTL so a second device opening within the window sees the edit.
    writeAccountTimestamps({ stories: 0 }).catch(() => null);
    const storyPatchBody = JSON.stringify({
      chapterTitle:  updates.chapterTitle,
      description:   updates.description ?? '',
      panels:        updates.panels,
      mood:          updates.mood,
      location:      updates.location,
      isPublic:      updates.isPublic,
      pageLayoutKey: updates.pageLayoutKey ?? null,
      pages:         updates.pages ?? null,
      music:         updates.music ?? null,
    });
    handleUpdateStory(
      id,
      updates,
      stateRef.current.stories,
      setStories,
      (json) => writeStoryCache(json),
      (path, opts) => apiFetch(path, opts),
      showToastGlobal,
      storyPatchBody,
    );
  }, []);

  const deleteStory = useCallback((id: string) => {
    writeAccountTimestamps({ stories: 0 }).catch(() => null);
    handleDeleteStory(
      id,
      stateRef.current.stories,
      setStories,
      (json) => writeStoryCache(json),
      (path, opts) => apiFetch(path, opts),
      showToastGlobal,
    );
  }, []);

  // ── Outfits ────────────────────────────────────────────────────────────────

  const addOutfit = useCallback((outfit: Outfit) => {
    // C-6: Strip local file:// URIs — they cannot be resolved by other devices.
    const safeImageUri = outfit.imageUri?.startsWith('file://') ? null : (outfit.imageUri ?? null);
    const safeOutfit   = { ...outfit, imageUri: safeImageUri ?? undefined };

    writeAccountTimestamps({ outfits: 0 }).catch(() => null);
    setOutfits(prev => {
      const updated = [safeOutfit, ...prev.filter(o => o.id !== outfit.id)];
      writeOutfitCache(JSON.stringify(updated));
      return updated;
    });
    const outfitBody = JSON.stringify({
      id:          safeOutfit.id,
      date:        safeOutfit.date,
      name:        safeOutfit.name,
      description: safeOutfit.description,
      story:       safeOutfit.story ?? '',
      imageUri:    safeImageUri,
      tags:        safeOutfit.tags,
      isPublic:    safeOutfit.isPublic,
      music:       safeOutfit.music ?? null,
    });
    apiFetch('/outfits', { method: 'POST', body: outfitBody })
    .then(() => {
      publishLumiCreation(userId, 'outfit', safeOutfit.id);
      reloadConstellation().catch(() => null);
      import('@/utils/xpFlash').then(m => m.fireXPFlash('Style memory recorded')).catch(() => {});
    })
    .catch(() => {
      // H-3: Revert the optimistic add so the outfit doesn't persist locally as
      // "saved" when the server never received it (mirrors addStory's pattern).
      setOutfits(prev => {
        const reverted = prev.filter(o => o.id !== safeOutfit.id);
        writeOutfitCache(JSON.stringify(reverted));
        return reverted;
      });
      showToastGlobal("Outfit couldn't be saved — tap to retry", 'error', () => {
        setOutfits(prev => {
          if (prev.some(o => o.id === safeOutfit.id)) return prev;
          const restored = [safeOutfit, ...prev];
          writeOutfitCache(JSON.stringify(restored));
          return restored;
        });
        apiFetch('/outfits', { method: 'POST', body: outfitBody })
          .then(() => { publishLumiCreation(userId, 'outfit', safeOutfit.id); })
          .catch(() => null);
      });
    });
  }, [reloadConstellation, userId]);

  const updateOutfit = useCallback((id: string, updates: Partial<Omit<Outfit, 'id'>>) => {
    // Capture only the outfit being edited for targeted restore.
    const originalOutfit = stateRef.current.outfits.find(o => o.id === id);
    setOutfits(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, ...updates } : o);
      writeOutfitCache(JSON.stringify(updated));
      return updated;
    });
    const outfitUpdateBody = JSON.stringify(updates);
    apiFetch(`/outfits/${id}`, { method: 'PATCH', body: outfitUpdateBody })
      .then(() => { clearMutation(`/outfits/${id}`, 'PATCH').catch(() => null); })
      .catch(() => {
        if (!originalOutfit) return;
        // Revert only the edited outfit — don't clobber concurrent changes to others.
        setOutfits(prev => {
          const reverted = prev.map(o => o.id === id ? originalOutfit : o);
          writeOutfitCache(JSON.stringify(reverted));
          return reverted;
        });
        showToastGlobal("Couldn't save outfit changes — tap to retry", 'error', () => {
          // Re-apply only this outfit's edit and retry the PATCH.
          setOutfits(prev => {
            const reapplied = prev.map(o => o.id === id ? { ...o, ...updates } : o);
            writeOutfitCache(JSON.stringify(reapplied));
            return reapplied;
          });
          apiFetch(`/outfits/${id}`, { method: 'PATCH', body: outfitUpdateBody })
            .then(() => { clearMutation(`/outfits/${id}`, 'PATCH').catch(() => null); })
            .catch(() => {
              // Retry also failed — revert the single outfit again and queue.
              setOutfits(prev => {
                const rereverted = prev.map(o => o.id === id ? originalOutfit : o);
                writeOutfitCache(JSON.stringify(rereverted));
                return rereverted;
              });
              enqueueMutation(`/outfits/${id}`, 'PATCH', outfitUpdateBody).catch(() => null);
            });
        });
      });
  }, []);

  const deleteOutfit = useCallback((id: string) => {
    writeAccountTimestamps({ outfits: 0 }).catch(() => null);
    handleDeleteOutfit(
      id,
      stateRef.current.outfits,
      activeOutfitId,
      setOutfits,
      (fn) => setActiveOutfitIdState(prev => {
        const next = fn(prev);
        if (next === null && prev !== null) removeCacheItem('active_outfit_v1').catch(() => null);
        if (next !== null && next !== prev)  setCacheItem('active_outfit_v1', next).catch(() => null);
        return next;
      }),
      (json) => writeOutfitCache(json),
      (path, opts) => apiFetch(path, opts),
      showToastGlobal,
    );
  }, [activeOutfitId]);

  const markPurchased = useCallback((itemId: string) => {
    setPurchasedIds(prev => prev.includes(itemId) ? prev : [...prev, itemId]);
    // Auto-activate first purchase in a category
    const category = COSMETIC_CATEGORY_MAP[itemId];
    if (!category) return;
    setActiveCosmeticsState(prev => {
      if (prev[category]) return prev; // already have an active item in this category
      const next = { ...prev, [category]: itemId };
      setCacheItem('active_cosmetics_v1', JSON.stringify(next)).catch(() => null);
      // Persist to server (fire-and-forget)
      const cosmeticsBody = JSON.stringify({ activeCosmetics: next });
      apiFetch('/rewards/active-cosmetics', { method: 'PUT', body: cosmeticsBody })
        .then(() => { clearMutation('/rewards/active-cosmetics', 'PUT').catch(() => null); })
        .catch(() => {
          showToastGlobal("Couldn't save cosmetic preference", 'warning', () => {
            // H-1: Queue if retry fails (markPurchased gap — mirrors setActiveCosmetic)
            apiFetch('/rewards/active-cosmetics', { method: 'PUT', body: cosmeticsBody })
              .then(() => { clearMutation('/rewards/active-cosmetics', 'PUT').catch(() => null); })
              .catch(() => enqueueMutation('/rewards/active-cosmetics', 'PUT', cosmeticsBody).catch(() => null));
          });
        });
      return next;
    });
  }, []);

  const setActiveCosmetic = useCallback((itemId: string) => {
    const category = COSMETIC_CATEGORY_MAP[itemId];
    if (!category) return;
    setActiveCosmeticsState(prev => {
      const next = { ...prev };
      if (next[category] === itemId) {
        delete next[category];
      } else {
        next[category] = itemId;
      }
      setCacheItem('active_cosmetics_v1', JSON.stringify(next)).catch(() => null);
      // Persist to server (fire-and-forget)
      const cosmeticsToggleBody = JSON.stringify({ activeCosmetics: next });
      apiFetch('/rewards/active-cosmetics', { method: 'PUT', body: cosmeticsToggleBody })
        .then(() => { clearMutation('/rewards/active-cosmetics', 'PUT').catch(() => null); })
        .catch(() => {
          showToastGlobal("Couldn't save cosmetic preference", 'warning', () => {
            // H-1: Queue if retry fails
            apiFetch('/rewards/active-cosmetics', { method: 'PUT', body: cosmeticsToggleBody })
              .then(() => { clearMutation('/rewards/active-cosmetics', 'PUT').catch(() => null); })
              .catch(() => enqueueMutation('/rewards/active-cosmetics', 'PUT', cosmeticsToggleBody).catch(() => null));
          });
        });
      return next;
    });
  }, []);

  const setActiveOutfitId = useCallback((id: string | null) => {
    setActiveOutfitIdState(id);
    if (id) {
      setCacheItem('active_outfit_v1', id).catch(() => null);
    } else {
      removeCacheItem('active_outfit_v1').catch(() => null);
    }
    // Sync to server so other users can see the selected outfit
    const outfitSyncBody = JSON.stringify({ activeOutfitId: id });
    apiFetch('/character/active-outfit', { method: 'PATCH', body: outfitSyncBody })
      .then(() => { clearMutation('/character/active-outfit', 'PATCH').catch(() => null); })
      .catch(() => {
        showToastGlobal("Couldn't sync outfit choice", 'warning', () => {
          // H-1: Queue if retry fails
          apiFetch('/character/active-outfit', { method: 'PATCH', body: outfitSyncBody })
            .then(() => { clearMutation('/character/active-outfit', 'PATCH').catch(() => null); })
            .catch(() => enqueueMutation('/character/active-outfit', 'PATCH', outfitSyncBody).catch(() => null));
        });
      });
  }, []);

  // ── Gallery ────────────────────────────────────────────────────────────────

  const addGalleryPhoto = useCallback(async (imageUri: string, caption = '') => {
    try {
      const created = await apiFetch<GalleryPhoto>('/gallery', {
        method: 'POST',
        body:   JSON.stringify({ imageUri, caption }),
      });
      const resolved = { ...created, imageUri: resolveUri(created.imageUri) ?? created.imageUri };
      setGallery(prev => [resolved, ...prev]);
      setGalleryUsage(prev => ({ ...prev, count: prev.count + 1 }));
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 429) {
        throw new Error('Gallery limit reached', { cause: err });
      }
      throw err;
    }
  }, []);

  const deleteGalleryPhoto = useCallback((id: string) => {
    let originalPhoto: GalleryPhoto | undefined;
    let originalIndex = -1;

    // Optimistic remove — capture snapshot for rollback
    setGallery(prev => {
      originalIndex = prev.findIndex(p => p.id === id);
      originalPhoto = prev.find(p => p.id === id);
      return prev.filter(p => p.id !== id);
    });
    setGalleryUsage(prev => ({ ...prev, count: Math.max(0, prev.count - 1) }));

    const doDelete = () =>
      apiFetch(`/gallery/${id}`, { method: 'DELETE' }).catch(() => {
        if (!originalPhoto) return;

        // Rollback: re-insert at original position and restore usage count
        setGallery(prev => {
          if (prev.some(p => p.id === id)) return prev;
          const insertAt = Math.min(Math.max(originalIndex, 0), prev.length);
          return [...prev.slice(0, insertAt), originalPhoto!, ...prev.slice(insertAt)];
        });
        setGalleryUsage(prev => ({ ...prev, count: prev.count + 1 }));

        showToastGlobal('Delete failed — tap to retry', 'error', () => {
          // Retry: optimistically remove again, then re-attempt the DELETE
          setGallery(prev => prev.filter(p => p.id !== id));
          setGalleryUsage(prev => ({ ...prev, count: Math.max(0, prev.count - 1) }));
          apiFetch(`/gallery/${id}`, { method: 'DELETE' }).catch(() => {
            if (!originalPhoto) return;
            setGallery(prev => {
              if (prev.some(p => p.id === id)) return prev;
              const insertAt = Math.min(Math.max(originalIndex, 0), prev.length);
              return [...prev.slice(0, insertAt), originalPhoto!, ...prev.slice(insertAt)];
            });
            setGalleryUsage(prev => ({ ...prev, count: prev.count + 1 }));
          });
        });
      });

    doDelete();
  }, []);

  // ── Discover / Save ────────────────────────────────────────────────────────

  const toggleSavePost = useCallback((id: string) => {
    setSavedStoryIds(prev => {
      const next     = new Set(prev);
      const wasSaved = next.has(id);
      if (wasSaved) next.delete(id); else next.add(id);
      setCacheItem('saved_stories_v1', JSON.stringify([...next])).catch(() => null);
      const saveMethod = wasSaved ? 'DELETE' : 'POST';
      apiFetch(`/stories/${id}/save`, { method: saveMethod }).catch(() => {
        showToastGlobal("Couldn't save story", 'warning', () => {
          apiFetch(`/stories/${id}/save`, { method: saveMethod }).catch(() => null);
        });
      });
      return next;
    });
  }, []);

  const toggleLikePost = useCallback(async (id: string) => {
    if (likeRequestsInFlight.current.has(id)) return;
    const current = discoverFeedRaw.find(post => post.id === id);
    if (!current) return;
    likeRequestsInFlight.current.add(id);
    const nextLiked = !current.liked;
    setDiscoverFeedRaw(prev => prev.map(post => post.id === id
      ? { ...post, liked: nextLiked, likeCount: Math.max(0, post.likeCount + (nextLiked ? 1 : -1)) }
      : post));
    try {
      const result = await apiFetch<{ liked: boolean; likeCount: number }>(
        `/${current.bookId ? 'chapters' : 'stories'}/${id}/like`, {
        method: nextLiked ? 'POST' : 'DELETE',
      });
      setDiscoverFeedRaw(prev => prev.map(post => post.id === id
        ? { ...post, liked: result.liked, likeCount: result.likeCount }
        : post));
    } catch {
      setDiscoverFeedRaw(prev => prev.map(post => post.id === id
        ? { ...post, liked: current.liked, likeCount: current.likeCount }
        : post));
      showToastGlobal(i18n.t('likes.updateFailed'), 'warning');
    } finally {
      likeRequestsInFlight.current.delete(id);
    }
  }, [discoverFeedRaw]);

  // ── Social: follow / unfollow ──────────────────────────────────────────────

  const followUser = useCallback((targetUserId: string) => {
    setFollowingIds(prev =>
      prev.includes(targetUserId) ? prev : [...prev, targetUserId],
    );
    apiFetch<{ rewardGranted?: boolean; rewardAmounts?: { stars?: number; aura?: number; shards?: number } }>(
      `/follows/${targetUserId}`, { method: 'POST' },
    )
      .then(res => {
        if (res?.rewardGranted && res.rewardAmounts) {
          fireToast('New connection', res.rewardAmounts);
          reloadRewards().catch(() => null);
        }
        // Always sync so social count updates immediately
        reloadConstellation().catch(() => null);
        fetchFriends();
      })
      .catch(() => {
        setFollowingIds(prev => prev.filter(id => id !== targetUserId));
        showToastGlobal("Couldn't follow user", 'warning', () => {
          setFollowingIds(prev => prev.includes(targetUserId) ? prev : [...prev, targetUserId]);
          apiFetch(`/follows/${targetUserId}`, { method: 'POST' }).catch(() => {
            setFollowingIds(prev => prev.filter(id => id !== targetUserId));
          });
        });
      });
  }, [fireToast, reloadRewards, reloadConstellation]);

  const unfollowUser = useCallback((targetUserId: string) => {
    setFollowingIds(prev => prev.filter(id => id !== targetUserId));
    setFriends(prev => prev.filter(f => f.userId !== targetUserId));
    apiFetch(`/follows/${targetUserId}`, { method: 'DELETE' }).catch(() => {
      setFollowingIds(prev =>
        prev.includes(targetUserId) ? prev : [...prev, targetUserId],
      );
      fetchFriends();
      showToastGlobal("Couldn't unfollow user", 'warning', () => {
        setFollowingIds(prev => prev.filter(id => id !== targetUserId));
        setFriends(prev => prev.filter(f => f.userId !== targetUserId));
        apiFetch(`/follows/${targetUserId}`, { method: 'DELETE' }).catch(() => null);
      });
    });
  }, []);

  // ── Block / Unblock ────────────────────────────────────────────────────────

  const blockUser = useCallback(async (targetUserId: string) => {
    // Optimistic: add to blocked list and remove from following/friends immediately
    setBlockedIds(prev => prev.includes(targetUserId) ? prev : [...prev, targetUserId]);
    setFollowingIds(prev => prev.filter(id => id !== targetUserId));
    setFriends(prev => prev.filter(f => f.userId !== targetUserId));
    try {
      await apiFetch(`/users/${targetUserId}/block`, { method: 'POST' });
    } catch {
      // Rollback optimistic update on failure
      setBlockedIds(prev => prev.filter(id => id !== targetUserId));
      showToastGlobal("Couldn't block user", 'warning', () => {
        blockUser(targetUserId).catch(() => null);
      });
    }
  }, []);

  const unblockUser = useCallback(async (targetUserId: string) => {
    // Optimistic: remove from blocked list immediately
    setBlockedIds(prev => prev.filter(id => id !== targetUserId));
    try {
      await apiFetch(`/users/${targetUserId}/block`, { method: 'DELETE' });
    } catch {
      // Rollback optimistic update on failure
      setBlockedIds(prev => prev.includes(targetUserId) ? prev : [...prev, targetUserId]);
      showToastGlobal("Couldn't unblock user", 'warning', () => {
        unblockUser(targetUserId).catch(() => null);
      });
    }
  }, []);

  // ── Rewards ────────────────────────────────────────────────────────────────

  const dismissReward = useCallback((id: string) => {
    setRewards(prev => prev.filter(r => r.id !== id));
  }, []);

  const showRewardToast = fireToast;

  const markServerNotificationsRead = useCallback(() => {
    setServerNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    apiFetch('/notifications/read-all', { method: 'PUT' }).catch(() => {
      showToastGlobal("Couldn't mark notifications read", 'warning', () => {
        apiFetch('/notifications/read-all', { method: 'PUT' }).catch(() => null);
      });
    });
  }, []);

  const deleteServerNotification = useCallback((id: string) => {
    setServerNotifications(prev => prev.filter(n => n.id !== id));
    apiFetch(`/notifications/${id}`, { method: 'DELETE' }).catch(() => {
      showToastGlobal("Couldn't remove notification", 'warning', () => {
        apiFetch(`/notifications/${id}`, { method: 'DELETE' }).catch(() => null);
      });
    });
  }, []);

  const reloadData = useCallback(async () => {
    await loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: loadData is stable (reads from refs internally); wrapping here to provide stable callback identity
  }, []);

  const refreshFeed = useCallback(async () => {
    // Startup already requests the same feed. A second request on initial tab
    // focus competes with the first video's media transfer and can race it.
    if (isLoadingRef.current) return;
    setIsRefreshing(true);
    try {
      await loadSocialData();
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const contextValue = useMemo<AppContextValue>(() => ({
    isLoading, apiOnline, hasCheckedApi, creationDataReady,
    journalLoadError, storiesLoadError, outfitsLoadError, discoverLoadError,
    hasCorruptedJournals, hasCorruptedStories, hasCorruptedDiscover,
    character, setCharacter,
    stories, addStory, updateStory, deleteStory,
    journalEntries, addJournalEntry, deleteJournalEntry,
    outfits, addOutfit, updateOutfit, deleteOutfit, activeOutfitId, setActiveOutfitId,
    gallery, galleryUsage, addGalleryPhoto, deleteGalleryPhoto,
    discoverPosts, savedStoryIds, toggleSavePost, toggleLikePost,
    friends, refreshFriends: fetchFriends, followingIds, blockedIds, followUser, unfollowUser, blockUser, unblockUser, myGuides,
    rewards, dismissReward, showRewardToast,
    rewardBalance, constellation, reloadRewards, reloadConstellation,
    shopCatalog, purchasedIds, markPurchased, activeCosmetics, setActiveCosmetic,
    serverNotifications, markServerNotificationsRead, deleteServerNotification,
    campfireUnread, unreadCampfireRooms, markCampfireRoomRead, campfireBadgeSeenAt,
    dmUnread: unreadDmThreads.filter(thread => !blockedIds.includes(thread.partnerId)).length,
    dmThreads, dmThreadsLoading, dmThreadsError, refreshDmThreads: pollDmUnread,
    unreadDmThreads, markDmThreadRead, dmBadgeSeenAt, markAllUnreadSeen,
    discoverMoodFilter, setDiscoverMoodFilter,
    reloadData,
    refreshFeed,
    clearUserData,
    isRefreshing,
  }), [
    isLoading, apiOnline, hasCheckedApi, creationDataReady,
    journalLoadError, storiesLoadError, outfitsLoadError, discoverLoadError,
    hasCorruptedJournals, hasCorruptedStories, hasCorruptedDiscover,
    character, setCharacter,
    stories, addStory, updateStory, deleteStory,
    journalEntries, addJournalEntry, deleteJournalEntry,
    outfits, addOutfit, updateOutfit, deleteOutfit, activeOutfitId, setActiveOutfitId,
    gallery, galleryUsage, addGalleryPhoto, deleteGalleryPhoto,
    discoverPosts, savedStoryIds, toggleSavePost, toggleLikePost,
    friends, fetchFriends, followingIds, blockedIds, followUser, unfollowUser, blockUser, unblockUser, myGuides,
    rewards, dismissReward, showRewardToast,
    rewardBalance, constellation, reloadRewards, reloadConstellation,
    shopCatalog, purchasedIds, markPurchased, activeCosmetics, setActiveCosmetic,
    serverNotifications, markServerNotificationsRead, deleteServerNotification,
    campfireUnread, unreadCampfireRooms, markCampfireRoomRead, campfireBadgeSeenAt,
    dmUnread, dmThreads, dmThreadsLoading, dmThreadsError, pollDmUnread,
    unreadDmThreads, markDmThreadRead, dmBadgeSeenAt, markAllUnreadSeen,
    discoverMoodFilter, setDiscoverMoodFilter,
    reloadData,
    refreshFeed,
    clearUserData,
    isRefreshing,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
