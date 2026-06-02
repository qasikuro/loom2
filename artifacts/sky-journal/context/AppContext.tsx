import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToastGlobal } from '@/components/Toast';
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
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import type {
  ProfileLink,
  GuideAvailability,
  BubbleStyle,
  PanelOverlay,
  StoryPanel,
  StoryPage,
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
export type {
  ProfileLink,
  GuideAvailability,
  BubbleStyle,
  PanelOverlay,
  StoryPanel,
  StoryPage,
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

// ── API base URL (baked in at build time via app.config.ts) ───────────────────

function resolveApiBase(): string {
  const extra  = (Constants.expoConfig as any)?.extra;
  const envUrl = extra?.apiUrl;
  if (envUrl) return envUrl as string;
  return '/api';
}

const API_BASE = resolveApiBase();

// Bind resolveUri to the runtime API_BASE so call-sites stay zero-arg.
function resolveUri(uri: string | null | undefined): string | undefined {
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

async function readFetchTimestamps(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(FETCH_TIMESTAMPS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch { return {}; }
}

async function writeFetchTimestamps(updates: Record<string, number>): Promise<void> {
  try {
    const existing = await readFetchTimestamps();
    await AsyncStorage.setItem(FETCH_TIMESTAMPS_KEY, JSON.stringify({ ...existing, ...updates }));
  } catch { /* silent */ }
}

function isFetchStale(timestamps: Record<string, number>, key: string): boolean {
  const ttl = RESOURCE_TTL_MS[key] ?? 2 * 60_000;
  return Date.now() - (timestamps[key] ?? 0) > ttl;
}

// ── Auth token getter (injected from Clerk context in _layout) ────────────────

type TokenGetter = () => Promise<string | null>;

let _getToken: TokenGetter = async () => null;

export function setAuthTokenGetter(fn: TokenGetter) {
  _getToken = fn;
}

export async function getAuthToken(): Promise<string | null> {
  return _getToken();
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
      ...(options?.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${options?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
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
  type:      'new_story' | 'new_outfit' | 'witness' | 'save';
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

  friends:       FriendSummary[];
  followingIds:  string[];
  followUser:    (targetUserId: string) => void;
  unfollowUser:  (targetUserId: string) => void;
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
  unreadCampfireRooms:  { id: string; name: string; mood: string }[];
  markCampfireRoomRead: (roomId: string) => Promise<void>;

  dmUnread:         number;
  unreadDmThreads:  { partnerId: string; partnerName: string; partnerHandle: string | null }[];
  markDmThreadRead: (partnerId: string) => void;

  shopCatalog:       ShopItem[];
  purchasedIds:      string[];
  markPurchased:     (itemId: string) => void;
  activeCosmetics:   Record<string, string>;
  setActiveCosmetic: (itemId: string) => void;

  journalLoadError:  boolean;
  storiesLoadError:  boolean;
  outfitsLoadError:  boolean;
  discoverLoadError: boolean;

  reloadData:    () => Promise<void>;
  refreshFeed:   () => Promise<void>;
  clearUserData: () => Promise<void>;
}

// ── Defaults / Helpers — imported from './mappers' at the top of this file ────
// DEFAULT_CHARACTER, toAppCharacter, toAppJournalEntry, toAppStory,
// toAppOutfit, toRawDiscoverPost — all bound via _resolveUri(…, API_BASE).

type RawDiscoverItem = Omit<DiscoverPost, 'saved' | 'isFollowing'>;

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
  const [isLoading, setIsLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(false);

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

  const [journalLoadError,  setJournalLoadError]  = useState(false);
  const [storiesLoadError,  setStoriesLoadError]  = useState(false);
  const [outfitsLoadError,  setOutfitsLoadError]  = useState(false);
  const [discoverLoadError, setDiscoverLoadError] = useState(false);

  const [discoverFeedRaw, setDiscoverFeedRaw]         = useState<RawDiscoverItem[]>([]);
  const [followingIds, setFollowingIds]               = useState<string[]>([]);
  const [friends, setFriends]                         = useState<FriendSummary[]>([]);
  const [serverNotifications, setServerNotifications] = useState<ServerNotification[]>([]);
  const [myGuides, setMyGuides]                       = useState<GuideProfile[]>([]);

  const [campfireUnread, setCampfireUnread]           = useState(0);
  const [unreadCampfireRooms, setUnreadCampfireRooms] = useState<{ id: string; name: string; mood: string }[]>([]);
  const [dmUnread,        setDmUnread]        = useState(0);
  const [unreadDmThreads, setUnreadDmThreads] = useState<{ partnerId: string; partnerName: string; partnerHandle: string | null }[]>([]);
  const campfireToastShownRef = useRef<Set<string>>(new Set());

  const discoverPosts = useMemo((): DiscoverPost[] =>
    discoverFeedRaw.map(p => ({
      ...p,
      saved:       savedStoryIds.has(p.id),
      isFollowing: followingIds.includes(p.authorUserId),
    })),
  [discoverFeedRaw, savedStoryIds, followingIds]);

  const stateRef     = useRef({ journalEntries, stories, outfits, character });
  useEffect(() => { stateRef.current = { journalEntries, stories, outfits, character }; });

  // Guards against concurrent loads and ensures skeletons only flash on true cold start
  const isLoadingRef = useRef(false);
  const dataReadyRef = useRef(false);

  // Tracks previously known unlocked stars so we can diff on each constellation reload.
  // null = no baseline yet (initial load) → never fire toasts until we have a baseline.
  const prevUnlockedStarsRef = useRef<string[] | null>(null);

  // ── Load active outfit id from AsyncStorage ────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem('active_outfit_v1').then(v => {
      if (v) setActiveOutfitIdState(v);
    }).catch(() => null);
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────

  // On mount: restore from cache immediately so the UI isn't blank
  useEffect(() => { loadFromCache(); }, []);

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

  async function loadFromCache() {
    try {
      const [c, j, s, o, d, f, sv, ac, rb] = await Promise.all([
        AsyncStorage.getItem('character_v2'),
        AsyncStorage.getItem('journal_v2'),
        AsyncStorage.getItem('stories_v1'),
        AsyncStorage.getItem('outfits_v1'),
        AsyncStorage.getItem('discover_v1'),
        AsyncStorage.getItem('following_v1'),
        AsyncStorage.getItem('saved_stories_v1'),
        AsyncStorage.getItem('active_cosmetics_v1'),
        AsyncStorage.getItem('reward_balance_v1'),
      ]);
      if (c)  setCharacterState(JSON.parse(c));
      if (j)  setJournalEntries(JSON.parse(j));
      if (s)  setStories(JSON.parse(s));
      if (o)  setOutfits(JSON.parse(o));
      if (d)  setDiscoverFeedRaw(JSON.parse(d));
      if (f)  setFollowingIds(JSON.parse(f));
      if (sv) { try { setSavedStoryIds(new Set(JSON.parse(sv))); } catch { /* ignore */ } }
      if (ac) { try { setActiveCosmeticsState(JSON.parse(ac)); } catch { /* ignore */ } }
      if (rb) { try { setRewardBalance(JSON.parse(rb)); } catch { /* ignore */ } }
    } catch { /* use defaults */ } finally {
      dataReadyRef.current = true;
      setIsLoading(false);
    }
  }

  // ── Clear all user data (call on sign-out) ────────────────────────────────

  const ALL_CACHE_KEYS = [
    'character_v2', 'journal_v2', 'stories_v1', 'outfits_v1',
    'discover_v1', 'following_v1', 'saved_stories_v1', 'collection_v1',
    'shop_catalog_v1', 'reward_balance_v1',
    FETCH_TIMESTAMPS_KEY,
    // active_outfit_v1 is intentionally NOT cleared on logout so the outfit
    // preference survives a logout/login cycle. loadData() validates the saved
    // ID against the freshly loaded outfit list before applying it.
  ];

  const clearUserData = useCallback(async () => {
    // Reset in-memory state immediately so the UI goes blank on sign-out.
    setCharacterState(DEFAULT_CHARACTER);
    setJournalEntries([]);
    setStories([]);
    setOutfits([]);
    setGallery([]);
    setGalleryUsage({ count: 0, limit: 200 });
    setDiscoverFeedRaw([]);
    setFollowingIds([]);
    setActiveOutfitIdState(null);
    setServerNotifications([]);
    setSavedStoryIds(new Set());
    setRewardBalance(null);
    setConstellation(null);
    setPurchasedIds([]);
    setActiveCosmeticsState({});
    setApiOnline(false);
    // Purge all user-specific caches so a different user signing in on the same
    // device cannot see a previous user's balance, purchases, or social data.
    // active_outfit_v1 is intentionally NOT cleared — the preference is non-sensitive
    // and is validated against the freshly loaded outfit list on next sign-in.
    AsyncStorage.multiRemove(ALL_CACHE_KEYS).catch(() => null);
    AsyncStorage.removeItem('active_cosmetics_v1').catch(() => null);
    // Reset load guards so the next sign-in triggers a full reload
    dataReadyRef.current = false;
    isLoadingRef.current = false;
  }, []);

  // Called by AuthTokenBridge once a valid Clerk token is available.
  // Uses waitForToken() to avoid the old "fire all → 401 ×6 → wait 1500ms → retry" race.
  async function loadData() {
    // Prevent two concurrent loads (e.g. rapid sign-out / sign-in)
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    // Only show the skeleton spinner on a true cold start (no cache data yet).
    // Returning users see their cached content while the API refreshes silently.
    if (!dataReadyRef.current) setIsLoading(true);

    try {
      // Block until Clerk has a valid token — avoids all the wasted 401 round trips.
      const token = await waitForToken(6000);
      if (!token) {
        // Offline or auth failure — show cached data and bail out.
        if (!dataReadyRef.current) await loadFromCache();
        setApiOnline(false);
        return;
      }

      // Fire EVERYTHING in one parallel batch: core + social + notifications.
      // Previously social was a second sequential wave, doubling the wait for Discover.
      const [
        _charFetch, _entriesFetch, _storiesFetch, _outfitsFetch,
        _galleryFetch, _usageFetch, _discoverFetch, _followingFetch, _notifFetch, _friendsFetch, guidesRaw,
        _rewardsFetch, _constellationFetch, _shopFetch, savedIdsRaw,
      ] = await Promise.all([
        apiFetch<unknown>('/character').catch(() => null),
        apiFetch<unknown>('/journal-entries').catch(() => null),
        apiFetch<unknown>('/stories').catch(() => null),
        apiFetch<unknown>('/outfits').catch(() => null),
        apiFetch<unknown>('/gallery').catch(() => null),
        apiFetch<unknown>('/gallery/usage').catch(() => null),
        apiFetch<unknown>('/discover').catch(() => null),
        apiFetch<unknown>('/follows/following').catch(() => null),
        apiFetch<unknown>('/notifications').catch(() => null),
        apiFetch<unknown>('/friends').catch(() => null),
        apiFetch<GuideProfile[]>('/guides?following=true').catch(() => []),
        apiFetch<unknown>('/rewards').catch(() => null),
        apiFetch<unknown>('/constellation').catch(() => null),
        apiFetch<unknown>('/rewards/shop').catch(() => null),
        apiFetch<string[]>('/stories/saved/ids').catch(() => null),
      ]);

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
      const char    = charRaw    ? toAppCharacter(charRaw, API_BASE)                     : DEFAULT_CHARACTER;
      const entries = entriesRaw ? entriesRaw.map(r => toAppJournalEntry(r, API_BASE)) : [];
      const stors   = storiesRaw ? storiesRaw.map(r => toAppStory(r, API_BASE))        : [];
      const outs    = outfitsRaw ? outfitsRaw.map(r => toAppOutfit(r, API_BASE))       : [];
      const gal     = (galleryRaw  ?? []).map((r: RawGalleryPhoto): GalleryPhoto => ({
        id:        r.id,
        imageUri:  resolveUri(r.imageUri ?? undefined) ?? r.imageUri ?? '',
        caption:   r.caption ?? '',
        createdAt: r.createdAt,
      }));

      // Process social data
      const feed   = (discoverRaw  ?? []).map(r => toRawDiscoverPost(r, API_BASE));
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

      // Commit all state at once — single React render pass
      setCharacterState(char);
      setJournalEntries(entries);
      setStories(stors);
      setOutfits(outs);
      setGallery(gal);
      setGalleryUsage({ count: usageRaw?.count ?? gal.length, limit: usageRaw?.limit ?? 200 });
      setDiscoverFeedRaw(feed);
      setFollowingIds(follows);
      setFriends(friendsRaw ?? []);
      setServerNotifications(notifs);
      setMyGuides(guides);
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
          AsyncStorage.setItem('active_cosmetics_v1', JSON.stringify(sanitised)).catch(() => null);
        }
      }
      if (shopRaw?.catalog && Array.isArray(shopRaw.catalog)) {
        setShopCatalog(shopRaw.catalog);
      }
      setApiOnline(true);
      setJournalLoadError(entriesRaw === null);
      setStoriesLoadError(storiesRaw === null);
      setOutfitsLoadError(outfitsRaw === null);
      setDiscoverLoadError(discoverRaw === null);

      // Restore active outfit across sessions.
      if (outs.length > 0) {
        const savedId = await AsyncStorage.getItem('active_outfit_v1');
        const validId = savedId && outs.some(o => o.id === savedId) ? savedId : outs[0].id;
        setActiveOutfitIdState(validId);
        AsyncStorage.setItem('active_outfit_v1', validId).catch(() => null);
      }

      // Sync saved-story IDs from server (authoritative); fall back to AsyncStorage cache.
      if (Array.isArray(savedIdsRaw)) {
        const ids = new Set<string>(savedIdsRaw);
        setSavedStoryIds(ids);
        AsyncStorage.setItem('saved_stories_v1', JSON.stringify([...ids])).catch(() => null);
      } else {
        AsyncStorage.getItem('saved_stories_v1').then(raw => {
          if (raw) { try { setSavedStoryIds(new Set(JSON.parse(raw))); } catch { /* ignore */ } }
        }).catch(() => null);
      }

      // Persist all fresh data to cache in parallel
      const cacheWrites: Promise<void>[] = [
        AsyncStorage.setItem('character_v2',  JSON.stringify(char)),
        AsyncStorage.setItem('journal_v2',    JSON.stringify(entries)),
        AsyncStorage.setItem('stories_v1',    JSON.stringify(stors)),
        AsyncStorage.setItem('outfits_v1',    JSON.stringify(outs)),
        AsyncStorage.setItem('discover_v1',   JSON.stringify(feed)),
        AsyncStorage.setItem('following_v1',  JSON.stringify(follows)),
      ];
      if (rewardBalanceRaw) {
        cacheWrites.push(AsyncStorage.setItem('reward_balance_v1', JSON.stringify(rewardBalanceRaw)));
      }
      if (shopRaw?.catalog && Array.isArray(shopRaw.catalog)) {
        cacheWrites.push(
          AsyncStorage.setItem('shop_catalog_v1', JSON.stringify({
            catalog:         shopRaw.catalog,
            seasonalPreview: shopRaw.seasonalPreview ?? [],
          })),
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
        writeFetchTimestamps(tsUpdates).catch(() => null);
      }
    } catch {
      // Unexpected error — restore from cache rather than leaving a blank screen.
      if (!dataReadyRef.current) await loadFromCache();
      setApiOnline(false);
      setJournalLoadError(true);
      setStoriesLoadError(true);
      setOutfitsLoadError(true);
      setDiscoverLoadError(true);
    } finally {
      dataReadyRef.current  = true;
      isLoadingRef.current  = false;
      setIsLoading(false);
    }
  }

  async function loadNotificationsData() {
    try {
      const raw = await apiFetch<RawNotification[]>('/notifications').catch(() => [] as RawNotification[]);
      setServerNotifications(
        (raw ?? []).map((r: RawNotification) => ({
          id:        r.id,
          actorId:   r.actorId,
          actorName: r.actorName,
          type:      r.type as ServerNotification['type'],
          refId:     r.refId,
          title:     r.title,
          isRead:    r.isRead,
          createdAt: r.createdAt,
        })),
      );
    } catch { /* silently skip */ }
  }

  async function fetchFriends() {
    try {
      const data = await apiFetch<FriendSummary[]>('/friends');
      setFriends(data ?? []);
    } catch { /* silently skip */ }
  }

  async function loadSocialData() {
    try {
      const [discoverRaw, followingRaw, friendsRaw] = await Promise.all([
        apiFetch<RawDiscoverApiItem[]>('/discover').catch(() => null),
        // catch(() => null) so a failed fetch is distinguishable from a genuine
        // empty following list — only a non-null result advances the timestamp.
        apiFetch<string[]>('/follows/following').catch(() => null),
        apiFetch<FriendSummary[]>('/friends').catch(() => []),
      ]);

      setDiscoverLoadError(discoverRaw === null);

      const feed    = (discoverRaw  ?? []).map(r => toRawDiscoverPost(r, API_BASE));
      const follows = followingRaw ?? [];

      setDiscoverFeedRaw(feed);
      setFollowingIds(follows);
      setFriends(friendsRaw ?? []);

      const now = Date.now();
      const cacheWrites: Promise<void>[] = [];
      const tsUpdates: Record<string, number> = {};

      if (discoverRaw !== null) {
        cacheWrites.push(AsyncStorage.setItem('discover_v1', JSON.stringify(feed)));
        tsUpdates.discover = now;
      }
      if (followingRaw !== null) {
        cacheWrites.push(AsyncStorage.setItem('following_v1', JSON.stringify(follows)));
        tsUpdates.following = now;
      }

      if (cacheWrites.length > 0) await Promise.allSettled(cacheWrites);
      if (Object.keys(tsUpdates).length > 0) writeFetchTimestamps(tsUpdates).catch(() => null);
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
    const token = await _getToken();
    if (!token) return;

    try {
      const timestamps = await readFetchTimestamps();

      const needsChar    = isFetchStale(timestamps, 'character');
      const needsJournal = isFetchStale(timestamps, 'journal-entries');
      const needsStories = isFetchStale(timestamps, 'stories');
      const needsOutfits = isFetchStale(timestamps, 'outfits');
      // Treat gallery + usage as a unit — their TTLs match and they depend on each other
      const needsGallery = isFetchStale(timestamps, 'gallery');
      const needsSocial  = isFetchStale(timestamps, 'discover') || isFetchStale(timestamps, 'following');

      // Nothing is stale — skip all network calls entirely
      if (!needsChar && !needsJournal && !needsStories && !needsOutfits && !needsGallery && !needsSocial) return;

      const [_charFetch, _entriesFetch, _storiesFetch, _outfitsFetch, _galleryFetch, _usageFetch] = await Promise.all([
        needsChar    ? apiFetch<unknown>('/character')                       : Promise.resolve(null),
        needsJournal ? apiFetch<unknown>('/journal-entries')                 : Promise.resolve(null),
        needsStories ? apiFetch<unknown>('/stories')                         : Promise.resolve(null),
        needsOutfits ? apiFetch<unknown>('/outfits')                         : Promise.resolve(null),
        needsGallery ? apiFetch<unknown>('/gallery').catch(() => null)       : Promise.resolve(null),
        needsGallery ? apiFetch<unknown>('/gallery/usage').catch(() => null) : Promise.resolve(null),
      ]);

      const now = Date.now();
      const tsUpdates: Record<string, number> = {};
      const cacheWrites: Promise<void>[] = [];

      if (needsChar) {
        const charRaw = parseOrDefault(ApiCharacterSchema, _charFetch, null, '/character') as RawCharacterResponse | null;
        if (charRaw !== null) {
          const char = toAppCharacter(charRaw, API_BASE);
          setCharacterState(char);
          cacheWrites.push(AsyncStorage.setItem('character_v2', JSON.stringify(char)));
          tsUpdates.character = now;
        }
      }

      if (needsJournal) {
        const entriesRaw = parseOrDefault(ApiJournalEntriesSchema, _entriesFetch, null, '/journal-entries') as RawJournalEntryResponse[] | null;
        if (entriesRaw !== null) {
          const entries = entriesRaw.map(r => toAppJournalEntry(r, API_BASE));
          setJournalEntries(entries);
          cacheWrites.push(AsyncStorage.setItem('journal_v2', JSON.stringify(entries)));
          tsUpdates['journal-entries'] = now;
        }
      }

      if (needsStories) {
        const storiesRaw = parseOrDefault(ApiStoriesSchema, _storiesFetch, null, '/stories') as RawStoryResponse[] | null;
        if (storiesRaw !== null) {
          const stors = storiesRaw.map(r => toAppStory(r, API_BASE));
          setStories(stors);
          cacheWrites.push(AsyncStorage.setItem('stories_v1', JSON.stringify(stors)));
          tsUpdates.stories = now;
        }
      }

      if (needsOutfits) {
        const outfitsRaw = parseOrDefault(ApiOutfitsSchema, _outfitsFetch, null, '/outfits') as RawOutfitResponse[] | null;
        if (outfitsRaw !== null) {
          const outs = outfitsRaw.map(r => toAppOutfit(r, API_BASE));
          setOutfits(outs);
          cacheWrites.push(AsyncStorage.setItem('outfits_v1', JSON.stringify(outs)));
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
        writeFetchTimestamps(tsUpdates).catch(() => null);
      }

      setApiOnline(true);

      // loadSocialData() writes its own timestamps on success
      if (needsSocial) loadSocialData();
    } catch { /* silently fail — keep showing cached data */ }
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

      const newUnread: { id: string; name: string; mood: string }[] = [];
      for (const room of rooms) {
        if (!room.lastMessage) continue;
        const seenRaw = await AsyncStorage.getItem(`campfire_seen_${room.id}`);
        if (!seenRaw) continue; // never visited → don't count as unread
        const lastSeen = new Date(seenRaw).getTime();
        const lastMsg  = new Date(room.lastMessage.createdAt).getTime();
        if (lastMsg > lastSeen) {
          newUnread.push({ id: room.id, name: room.name, mood: room.mood });
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
    await AsyncStorage.setItem(`campfire_seen_${roomId}`, new Date().toISOString());
    campfireToastShownRef.current.delete(roomId);
    setUnreadCampfireRooms(prev => {
      const next = prev.filter(r => r.id !== roomId);
      setCampfireUnread(next.length);
      return next;
    });
  }, []);

  // ── DM unread polling ─────────────────────────────────────────────────────
  // Polls /api/messages threads to find conversations with unread messages.
  const pollDmUnread = useCallback(async () => {
    try {
      const threads = await apiFetch<{
        partnerId: string; partnerName: string; partnerHandle: string | null;
        lastMessage: string; lastAt: string; unread: boolean;
      }[]>('/messages');
      if (!threads || !Array.isArray(threads)) return;
      const unreadThreads = threads.filter(t => t.unread).map(t => ({
        partnerId:    t.partnerId,
        partnerName:  t.partnerName,
        partnerHandle:t.partnerHandle,
      }));
      setUnreadDmThreads(unreadThreads);
      setDmUnread(unreadThreads.length);
    } catch { /* silent */ }
  }, []);

  const markDmThreadRead = useCallback((partnerId: string) => {
    setUnreadDmThreads(prev => {
      const next = prev.filter(t => t.partnerId !== partnerId);
      setDmUnread(next.length);
      return next;
    });
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
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
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
    AsyncStorage.setItem('character_v2', JSON.stringify(c));
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
    });
    apiFetch('/character', { method: 'PUT', body: characterBody }).catch(() => {
      showToastGlobal("Couldn't sync profile — saved locally", 'warning', () => {
        apiFetch('/character', { method: 'PUT', body: characterBody }).catch(() => null);
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
  }, [drainStarUnlockQueue]);

  // ── Reload helpers — defined before mutations so callbacks can call them ────

  const reloadRewards = useCallback(async () => {
    try {
      const data = await apiFetch<RewardBalance>('/rewards');
      setRewardBalance(data);
      AsyncStorage.setItem('reward_balance_v1', JSON.stringify(data)).catch(() => null);
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
    setJournalEntries(prev => {
      const updated = [entry, ...prev.filter(e => e.id !== entry.id)];
      AsyncStorage.setItem('journal_v2', JSON.stringify(updated));
      return updated;
    });
    try {
      const res = await apiFetch<{ rewardGranted: boolean; rewardAmounts?: { stars?: number; aura?: number; shards?: number } }>(
        '/journal-entries', {
          method: 'POST',
          body:   JSON.stringify({
            id:         entry.id,
            date:       entry.date,
            type:       entry.type,
            text:       entry.text,
            mood:       entry.mood,
            imageUri:   entry.imageUri   ?? null,
            friendName: entry.friendName ?? null,
          }),
        },
      );
      if (res?.rewardGranted && res.rewardAmounts) {
        fireToast('Journal entry', res.rewardAmounts);
        reloadRewards().catch(() => null);
      }
      // Always sync constellation so memory count & star progress update immediately
      reloadConstellation().catch(() => null);
    } catch {
      const retryBody = JSON.stringify({
        id:         entry.id,
        date:       entry.date,
        type:       entry.type,
        text:       entry.text,
        mood:       entry.mood,
        imageUri:   entry.imageUri   ?? null,
        friendName: entry.friendName ?? null,
      });
      showToastGlobal("Entry saved locally — couldn't sync to server", 'warning', () => {
        apiFetch('/journal-entries', { method: 'POST', body: retryBody }).catch(() => null);
      });
    }
  }, [fireToast, reloadRewards, reloadConstellation]);

  const deleteJournalEntry = useCallback((id: string) => {
    setJournalEntries(prev => {
      const updated = prev.filter(e => e.id !== id);
      AsyncStorage.setItem('journal_v2', JSON.stringify(updated));
      return updated;
    });
    apiFetch(`/journal-entries/${id}`, { method: 'DELETE' }).catch(() => {
      showToastGlobal("Couldn't delete entry", 'error', () => {
        apiFetch(`/journal-entries/${id}`, { method: 'DELETE' }).catch(() => null);
      });
    });
  }, []);

  // ── Stories ────────────────────────────────────────────────────────────────

  const addStory = useCallback(async (story: Story): Promise<boolean> => {
    const storyPostBody = JSON.stringify({
      id:            story.id,
      date:          story.date,
      chapterTitle:  story.chapterTitle,
      description:   story.description ?? '',
      panels:        story.panels,
      mood:          story.mood,
      location:      story.location,
      isPublic:      story.isPublic,
      pageLayoutKey: story.pageLayoutKey ?? null,
      pages:         story.pages ?? null,
    });

    // Optimistic local update
    setStories(prev => {
      const updated = [story, ...prev.filter(s => s.id !== story.id)];
      const slim = updated.map(s => ({
        ...s,
        panels: s.panels.map(p => ({ ...p, imageUri: undefined })),
      }));
      AsyncStorage.setItem('stories_v1', JSON.stringify(slim)).catch(() => null);
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
      loadSocialData();
      return true;
    } catch {
      // Revert optimistic update so it doesn't linger
      setStories(prev => {
        const reverted = prev.filter(s => s.id !== story.id);
        const slim = reverted.map(s => ({
          ...s,
          panels: s.panels.map(p => ({ ...p, imageUri: undefined })),
        }));
        AsyncStorage.setItem('stories_v1', JSON.stringify(slim)).catch(() => null);
        return reverted;
      });
      // Retry: re-add to local state and re-post to API
      showToastGlobal("Story couldn't be published — please try again", 'error', () => {
        setStories(prev => {
          if (prev.some(s => s.id === story.id)) return prev;
          const updated = [story, ...prev];
          const slim = updated.map(s => ({ ...s, panels: s.panels.map(p => ({ ...p, imageUri: undefined })) }));
          AsyncStorage.setItem('stories_v1', JSON.stringify(slim)).catch(() => null);
          return updated;
        });
        apiFetch('/stories', { method: 'POST', body: storyPostBody })
          .then(() => loadSocialData())
          .catch(() => showToastGlobal("Story still couldn't be published", 'error'));
      });
      return false;
    }
  }, [fireToast, reloadRewards, reloadConstellation]);

  const updateStory = useCallback((id: string, updates: Partial<Omit<Story, 'id'>>) => {
    setStories(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, ...updates } : s);
      const slim = updated.map(s => ({ ...s, panels: s.panels.map(p => ({ ...p, imageUri: undefined })) }));
      AsyncStorage.setItem('stories_v1', JSON.stringify(slim)).catch(() => null);
      return updated;
    });
    const storyPatchBody = JSON.stringify({
      chapterTitle:  updates.chapterTitle,
      description:   updates.description ?? '',
      panels:        updates.panels,
      mood:          updates.mood,
      location:      updates.location,
      isPublic:      updates.isPublic,
      pageLayoutKey: updates.pageLayoutKey ?? null,
      pages:         updates.pages ?? null,
    });
    apiFetch(`/stories/${id}`, { method: 'PATCH', body: storyPatchBody }).catch(() => {
      showToastGlobal("Couldn't save story changes", 'error', () => {
        apiFetch(`/stories/${id}`, { method: 'PATCH', body: storyPatchBody }).catch(() => null);
      });
    });
  }, []);

  const deleteStory = useCallback((id: string) => {
    setStories(prev => {
      const updated = prev.filter(s => s.id !== id);
      AsyncStorage.setItem('stories_v1', JSON.stringify(updated));
      return updated;
    });
    apiFetch(`/stories/${id}`, { method: 'DELETE' }).catch(() => {
      showToastGlobal("Couldn't delete story", 'error', () => {
        apiFetch(`/stories/${id}`, { method: 'DELETE' }).catch(() => null);
      });
    });
  }, []);

  // ── Outfits ────────────────────────────────────────────────────────────────

  const addOutfit = useCallback((outfit: Outfit) => {
    setOutfits(prev => {
      const updated = [outfit, ...prev.filter(o => o.id !== outfit.id)];
      AsyncStorage.setItem('outfits_v1', JSON.stringify(updated));
      return updated;
    });
    const outfitBody = JSON.stringify({
      id:          outfit.id,
      date:        outfit.date,
      name:        outfit.name,
      description: outfit.description,
      story:       outfit.story ?? '',
      imageUri:    outfit.imageUri ?? null,
      tags:        outfit.tags,
      isPublic:    outfit.isPublic,
    });
    apiFetch('/outfits', { method: 'POST', body: outfitBody })
    .then(() => reloadConstellation().catch(() => null))
    .catch(() => {
      showToastGlobal("Outfit saved locally — couldn't sync to server", 'warning', () => {
        apiFetch('/outfits', { method: 'POST', body: outfitBody }).catch(() => null);
      });
    });
  }, [reloadConstellation]);

  const updateOutfit = useCallback((id: string, updates: Partial<Omit<Outfit, 'id'>>) => {
    setOutfits(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, ...updates } : o);
      AsyncStorage.setItem('outfits_v1', JSON.stringify(updated)).catch(() => null);
      return updated;
    });
    const outfitUpdateBody = JSON.stringify(updates);
    apiFetch(`/outfits/${id}`, { method: 'PATCH', body: outfitUpdateBody }).catch(() => {
      showToastGlobal("Couldn't save outfit changes", 'error', () => {
        apiFetch(`/outfits/${id}`, { method: 'PATCH', body: outfitUpdateBody }).catch(() => null);
      });
    });
  }, []);

  const deleteOutfit = useCallback((id: string) => {
    setOutfits(prev => {
      const updated = prev.filter(o => o.id !== id);
      AsyncStorage.setItem('outfits_v1', JSON.stringify(updated));
      return updated;
    });
    setActiveOutfitIdState(prev => {
      if (prev === id) {
        AsyncStorage.removeItem('active_outfit_v1').catch(() => null);
        return null;
      }
      return prev;
    });
    apiFetch(`/outfits/${id}`, { method: 'DELETE' }).catch(() => {
      showToastGlobal("Couldn't delete outfit", 'error', () => {
        apiFetch(`/outfits/${id}`, { method: 'DELETE' }).catch(() => null);
      });
    });
  }, []);

  const markPurchased = useCallback((itemId: string) => {
    setPurchasedIds(prev => prev.includes(itemId) ? prev : [...prev, itemId]);
    // Auto-activate first purchase in a category
    const category = COSMETIC_CATEGORY_MAP[itemId];
    if (!category) return;
    setActiveCosmeticsState(prev => {
      if (prev[category]) return prev; // already have an active item in this category
      const next = { ...prev, [category]: itemId };
      AsyncStorage.setItem('active_cosmetics_v1', JSON.stringify(next)).catch(() => null);
      // Persist to server (fire-and-forget)
      const cosmeticsBody = JSON.stringify({ activeCosmetics: next });
      apiFetch('/rewards/active-cosmetics', { method: 'PUT', body: cosmeticsBody }).catch(() => {
        showToastGlobal("Couldn't save cosmetic preference", 'warning', () => {
          apiFetch('/rewards/active-cosmetics', { method: 'PUT', body: cosmeticsBody }).catch(() => null);
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
      AsyncStorage.setItem('active_cosmetics_v1', JSON.stringify(next)).catch(() => null);
      // Persist to server (fire-and-forget)
      const cosmeticsToggleBody = JSON.stringify({ activeCosmetics: next });
      apiFetch('/rewards/active-cosmetics', { method: 'PUT', body: cosmeticsToggleBody }).catch(() => {
        showToastGlobal("Couldn't save cosmetic preference", 'warning', () => {
          apiFetch('/rewards/active-cosmetics', { method: 'PUT', body: cosmeticsToggleBody }).catch(() => null);
        });
      });
      return next;
    });
  }, []);

  const setActiveOutfitId = useCallback((id: string | null) => {
    setActiveOutfitIdState(id);
    if (id) {
      AsyncStorage.setItem('active_outfit_v1', id).catch(() => null);
    } else {
      AsyncStorage.removeItem('active_outfit_v1').catch(() => null);
    }
    // Sync to server so other users can see the selected outfit
    const outfitSyncBody = JSON.stringify({ activeOutfitId: id });
    apiFetch('/character/active-outfit', { method: 'PATCH', body: outfitSyncBody }).catch(() => {
      showToastGlobal("Couldn't sync outfit choice", 'warning', () => {
        apiFetch('/character/active-outfit', { method: 'PATCH', body: outfitSyncBody }).catch(() => null);
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
        throw new Error('Gallery limit reached');
      }
      throw err;
    }
  }, []);

  const deleteGalleryPhoto = useCallback((id: string) => {
    setGallery(prev => prev.filter(p => p.id !== id));
    setGalleryUsage(prev => ({ ...prev, count: Math.max(0, prev.count - 1) }));
    apiFetch(`/gallery/${id}`, { method: 'DELETE' }).catch(() => {
      showToastGlobal("Couldn't remove photo", 'error', () => {
        apiFetch(`/gallery/${id}`, { method: 'DELETE' }).catch(() => null);
      });
    });
  }, []);

  // ── Discover / Save ────────────────────────────────────────────────────────

  const toggleSavePost = useCallback((id: string) => {
    setSavedStoryIds(prev => {
      const next     = new Set(prev);
      const wasSaved = next.has(id);
      if (wasSaved) next.delete(id); else next.add(id);
      AsyncStorage.setItem('saved_stories_v1', JSON.stringify([...next])).catch(() => null);
      const saveMethod = wasSaved ? 'DELETE' : 'POST';
      apiFetch(`/stories/${id}/save`, { method: saveMethod }).catch(() => {
        showToastGlobal("Couldn't save story", 'warning', () => {
          apiFetch(`/stories/${id}/save`, { method: saveMethod }).catch(() => null);
        });
      });
      return next;
    });
  }, []);

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
  }, []);

  const refreshFeed = useCallback(async () => {
    await loadSocialData();
  }, []);

  return (
    <AppContext.Provider value={{
      isLoading, apiOnline,
      journalLoadError, storiesLoadError, outfitsLoadError, discoverLoadError,
      character, setCharacter,
      stories, addStory, updateStory, deleteStory,
      journalEntries, addJournalEntry, deleteJournalEntry,
      outfits, addOutfit, updateOutfit, deleteOutfit, activeOutfitId, setActiveOutfitId,
      gallery, galleryUsage, addGalleryPhoto, deleteGalleryPhoto,
      discoverPosts, savedStoryIds, toggleSavePost,
      friends, followingIds, followUser, unfollowUser, myGuides,
      rewards, dismissReward, showRewardToast,
      rewardBalance, constellation, reloadRewards, reloadConstellation,
      shopCatalog, purchasedIds, markPurchased, activeCosmetics, setActiveCosmetic,
      serverNotifications, markServerNotificationsRead, deleteServerNotification,
      campfireUnread, unreadCampfireRooms, markCampfireRoomRead,
      dmUnread, unreadDmThreads, markDmThreadRead,
      reloadData,
      refreshFeed,
      clearUserData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
