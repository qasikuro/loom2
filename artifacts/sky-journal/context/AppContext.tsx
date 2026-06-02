import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToastGlobal } from '@/components/Toast';
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// ── API base URL (baked in at build time via app.config.ts) ───────────────────

function resolveApiBase(): string {
  const extra  = (Constants.expoConfig as any)?.extra;
  const envUrl = extra?.apiUrl;
  if (envUrl) return envUrl as string;
  return '/api';
}

const API_BASE = resolveApiBase();

// ── Resolve a possibly-relative API image path to an absolute URI ─────────────
// Stored paths look like "/api/images/<file>". On native Expo there is no
// implicit base, so we must prefix the domain root. HTTPS / data / blob URIs
// pass through unchanged.
//
// IMPORTANT: API_BASE ends in "/api" (e.g. "https://domain/api") but stored
// paths already start with "/api/images/…". Strip the trailing "/api" from the
// base before concatenating to avoid the double-prefix bug.
function resolveUri(uri: string | null | undefined): string | undefined {
  if (!uri) return undefined;
  if (/^https?:/.test(uri) || uri.startsWith('data:') || uri.startsWith('blob:')) return uri;
  // Strip trailing /api so "/api/images/…" paths are not doubled.
  const domainBase = API_BASE.replace(/\/api$/, '');
  return `${domainBase}${uri}`;
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

export interface ProfileLink {
  label:     string;
  url:       string;
  platform?: string;
}

export interface GuideAvailability {
  days:      number[];   // 0 = Sun … 6 = Sat
  timeFrom:  string;    // "HH:MM" 24-h
  timeTo:    string;    // "HH:MM" 24-h
  timezone?: string;    // IANA timezone e.g. "Asia/Singapore"
}

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

export interface Character {
  name:              string;
  bio:               string;
  mood:              string;
  traits:            string[];
  isPublic:          boolean;
  username?:         string;
  avatarUri?:        string;
  activeOutfitId?:   string | null;
  birthday?:         string;
  country?:          string;
  role?:             string;
  timezone?:         string;
  pushToken?:        string;
  links?:            ProfileLink[];
  // Constellation Guides
  isGuide?:          boolean;
  guideBio?:         string;
  guideTopics?:      string[];
  guideAvailability?: GuideAvailability | null;
}

export type BubbleStyle = 'rounded' | 'sharp' | 'oval';

export interface PanelOverlay {
  id:          string;
  type:        'bubble' | 'text' | 'sticker';
  content:     string;
  xPct:        number;       // 0-1 of panel width
  yPct:        number;       // 0-1 of panel height
  fontFamily?: string;
  fontSize?:   number;
  bubbleStyle?:BubbleStyle;
  color?:      string;       // text / bubble bg color key
}

export interface StoryPanel {
  id:               string;
  imageUri?:        string;
  bgPreset?:        string;       // 'bg1' | 'bg2' | 'bg3' | 'char'
  text:             string;       // narration / caption text (legacy)
  bubbleText?:      string;       // legacy speech-bubble text
  overlays?:        PanelOverlay[];
  imageAspectRatio?: number;      // width/height — set from CropImageModal at save time
}

export interface StoryPage {
  id:        string;
  layoutKey: string;
  panels:    StoryPanel[];
}

export interface Story {
  id:              string;
  date:            string;
  chapterTitle:    string;
  description:     string;
  panels:          StoryPanel[];
  mood:            string;
  location:        string;
  isPublic:        boolean;
  witnessedCount:  number;
  savedCount:      number;
  stickerCount:    number;
  pageLayoutKey?:  string;
  pages?:          StoryPage[];
}

export type JournalEntryType = 'diary' | 'friend' | 'moment';

export interface JournalEntry {
  id:           string;
  date:         string;
  type:         JournalEntryType;
  text:         string;
  mood:         string;
  imageUri?:    string;
  friendName?:  string;
  stickerCount?: number;
}

export interface Outfit {
  id:          string;
  date:        string;
  name:        string;
  description: string;
  story:       string;
  imageUri?:   string;
  tags:        string[];
  isPublic:    boolean;
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

export interface DiscoverPost {
  id:               string;
  authorUserId:     string;
  authorName:       string;
  authorHandle:     string;
  authorAvatarUri?: string | null;
  chapterTitle:     string;
  description?:     string;
  storySnippet:     string;
  imageUri?:        string;
  mood:             string;
  witnessedCount:   number;
  savedCount:       number;
  stickerCount:     number;
  timeAgo:          string;
  date:             string;
  chapterNumber:    number;
  vibe:             string;
  saved:            boolean;
  isFollowing:      boolean;
  panels?:          { text: string; imageUri?: string; overlays?: PanelOverlay[] }[];
  pages?:           StoryPage[];
  pageLayoutKey?:   string;
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

  reloadData:    () => Promise<void>;
  refreshFeed:   () => Promise<void>;
  clearUserData: () => Promise<void>;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CHARACTER: Character = {
  name:     'Sky Child',
  bio:      'A wandering light, chasing memories across the sky.',
  mood:     'Hopeful',
  traits:   ['Dreamer', 'Curious', 'Kind'],
  isPublic: true,
};

function relativeTimeDiscover(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  === 1) return 'yesterday';
  return `${days}d ago`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toAppCharacter(raw: any): Character {
  return {
    name:              raw.name          ?? DEFAULT_CHARACTER.name,
    bio:               raw.bio           ?? DEFAULT_CHARACTER.bio,
    mood:              raw.mood          ?? DEFAULT_CHARACTER.mood,
    traits:            Array.isArray(raw.traits) ? raw.traits : [],
    isPublic:          raw.isPublic      ?? raw.is_public      ?? true,
    username:          raw.username      ?? undefined,
    avatarUri:         raw.avatarUri     ?? undefined,
    activeOutfitId:    raw.activeOutfitId ?? raw.active_outfit_id ?? undefined,
    birthday:          raw.birthday      ?? undefined,
    country:           raw.country       ?? undefined,
    role:              raw.role          ?? undefined,
    timezone:          raw.timezone      ?? undefined,
    pushToken:         raw.pushToken     ?? raw.push_token ?? undefined,
    links:             Array.isArray(raw.links) ? raw.links : undefined,
    isGuide:           raw.isGuide          ?? false,
    guideBio:          raw.guideBio         ?? '',
    guideTopics:       Array.isArray(raw.guideTopics) ? raw.guideTopics : [],
    guideAvailability: raw.guideAvailability ?? null,
  };
}

function toAppJournalEntry(raw: any): JournalEntry {
  return {
    id:           raw.id,
    date:         typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString(),
    type:         raw.type as JournalEntryType,
    text:         raw.text,
    mood:         raw.mood,
    imageUri:     resolveUri(raw.imageUri ?? raw.image_uri),
    friendName:   raw.friendName ?? raw.friend_name ?? undefined,
    stickerCount: raw.stickerCount ?? 0,
  };
}

function toAppStory(raw: any): Story {
  return {
    id:             raw.id,
    date:           typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString(),
    chapterTitle:   raw.chapterTitle ?? raw.chapter_title,
    description:    raw.description ?? '',
    panels:         Array.isArray(raw.panels)
      ? raw.panels.map((p: any) => ({ ...p, imageUri: resolveUri(p.imageUri) }))
      : [],
    mood:           raw.mood,
    location:       raw.location ?? '',
    isPublic:       raw.isPublic ?? raw.is_public ?? false,
    witnessedCount: raw.witnessedCount ?? raw.witnessed_count ?? 0,
    savedCount:     raw.savedCount     ?? raw.saved_count     ?? 0,
    stickerCount:   raw.stickerCount   ?? 0,
    pageLayoutKey:  raw.pageLayoutKey  ?? raw.page_layout_key ?? undefined,
    pages:          Array.isArray(raw.pages) ? raw.pages : undefined,
  };
}

function toAppOutfit(raw: any): Outfit {
  return {
    id:          raw.id,
    date:        typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString(),
    name:        raw.name,
    description: raw.description ?? '',
    story:       raw.story ?? '',
    imageUri:    resolveUri(raw.imageUri ?? raw.image_uri),
    tags:        Array.isArray(raw.tags) ? raw.tags : [],
    isPublic:    raw.isPublic ?? raw.is_public ?? false,
  };
}

type RawDiscoverItem = Omit<DiscoverPost, 'saved' | 'isFollowing'>;

function toRawDiscoverPost(raw: any): RawDiscoverItem {
  return {
    id:               raw.id,
    authorUserId:     raw.authorUserId ?? '',
    authorName:       raw.authorName ?? 'Sky Child',
    authorHandle:     raw.authorUsername
      ? `@${raw.authorUsername}`
      : `@${(raw.authorName ?? 'sky').toLowerCase().replace(/\s+/g, '')}`,
    authorAvatarUri:  resolveUri(raw.authorAvatarUri) ?? null,
    chapterTitle:     raw.chapterTitle ?? '',
    storySnippet:     raw.storySnippet ?? '',
    imageUri:         resolveUri(raw.imageUri),
    mood:           raw.mood ?? 'Hopeful',
    witnessedCount: raw.witnessedCount ?? 0,
    savedCount:     raw.savedCount ?? 0,
    stickerCount:   raw.stickerCount ?? 0,
    timeAgo:        relativeTimeDiscover(raw.date ?? raw.createdAt ?? new Date().toISOString()),
    date:           raw.date ?? raw.createdAt ?? new Date().toISOString(),
    chapterNumber:  raw.chapterNumber ?? 1,
    vibe:           raw.mood ?? 'Hopeful',
    panels:         Array.isArray(raw.panels) ? raw.panels.map((p: any) => ({
      text:     p.text     ?? '',
      imageUri: resolveUri(p.imageUri),
      overlays: Array.isArray(p.overlays) ? p.overlays : undefined,
    })) : [],
    pages:          Array.isArray(raw.pages) ? raw.pages : undefined,
    pageLayoutKey:  raw.pageLayoutKey ?? undefined,
  };
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
        charRaw, entriesRaw, storiesRaw, outfitsRaw,
        galleryRaw, usageRaw, discoverRaw, followingRaw, notifRaw, friendsRaw, guidesRaw,
        rewardBalanceRaw, constellationRaw, shopRaw, savedIdsRaw,
      ] = await Promise.all([
        apiFetch<any>('/character').catch(() => null),
        apiFetch<any[]>('/journal-entries').catch(() => null),
        apiFetch<any[]>('/stories').catch(() => null),
        apiFetch<any[]>('/outfits').catch(() => null),
        apiFetch<any[]>('/gallery').catch(() => []),
        apiFetch<any>('/gallery/usage').catch(() => ({ count: 0, limit: 200 })),
        apiFetch<any[]>('/discover').catch(() => []),
        apiFetch<string[]>('/follows/following').catch(() => []),
        apiFetch<any[]>('/notifications').catch(() => []),
        apiFetch<FriendSummary[]>('/friends').catch(() => []),
        apiFetch<GuideProfile[]>('/guides?following=true').catch(() => []),
        apiFetch<RewardBalance>('/rewards').catch(() => null),
        apiFetch<ConstellationState>('/constellation').catch(() => null),
        apiFetch<{ catalog?: ShopItem[]; purchasedIds: string[]; activeCosmetics: Record<string, string> }>('/rewards/shop').catch(() => null),
        apiFetch<string[]>('/stories/saved/ids').catch(() => null),
      ]);

      // Process core data
      const char    = charRaw    ? toAppCharacter(charRaw)    : DEFAULT_CHARACTER;
      const entries = (entriesRaw  ?? []).map(toAppJournalEntry);
      const stors   = (storiesRaw  ?? []).map(toAppStory);
      const outs    = (outfitsRaw  ?? []).map(toAppOutfit);
      const gal     = (galleryRaw  ?? []).map((r: any): GalleryPhoto => ({
        id:        r.id,
        imageUri:  resolveUri(r.imageUri) ?? r.imageUri,
        caption:   r.caption ?? '',
        createdAt: r.createdAt,
      }));

      // Process social data
      const feed   = (discoverRaw  ?? []).map(toRawDiscoverPost);
      const follows = followingRaw ?? [];
      const guides  = (guidesRaw   ?? []) as GuideProfile[];

      // Process notifications
      const notifs = (notifRaw ?? []).map((r: any): ServerNotification => ({
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
        setShopCatalog(shopRaw.catalog as ShopItem[]);
      }
      setApiOnline(true);

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
            seasonalPreview: (shopRaw as any).seasonalPreview ?? [],
          })),
        );
      }
      await Promise.allSettled(cacheWrites);
    } catch {
      // Unexpected error — restore from cache rather than leaving a blank screen.
      if (!dataReadyRef.current) await loadFromCache();
      setApiOnline(false);
    } finally {
      dataReadyRef.current  = true;
      isLoadingRef.current  = false;
      setIsLoading(false);
    }
  }

  async function loadNotificationsData() {
    try {
      const raw = await apiFetch<any[]>('/notifications').catch(() => []);
      setServerNotifications(
        (raw ?? []).map(r => ({
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
        apiFetch<any[]>('/discover').catch(() => []),
        apiFetch<string[]>('/follows/following').catch(() => []),
        apiFetch<FriendSummary[]>('/friends').catch(() => []),
      ]);

      const feed    = (discoverRaw  ?? []).map(toRawDiscoverPost);
      const follows = followingRaw ?? [];

      setDiscoverFeedRaw(feed);
      setFollowingIds(follows);
      setFriends(friendsRaw ?? []);

      await Promise.allSettled([
        AsyncStorage.setItem('discover_v1',  JSON.stringify(feed)),
        AsyncStorage.setItem('following_v1', JSON.stringify(follows)),
      ]);
    } catch { /* silently skip */ }
  }

  // Silent foreground refresh — fetches fresh data without resetting state first
  // so there is no UI flash. Admin deletions/amendments take effect the moment
  // the user brings the app back to the foreground.
  async function softLoadData() {
    const token = await _getToken();
    if (!token) return;

    try {
      const [charRaw, entriesRaw, storiesRaw, outfitsRaw, galleryRaw, usageRaw] = await Promise.all([
        apiFetch<any>('/character'),
        apiFetch<any[]>('/journal-entries'),
        apiFetch<any[]>('/stories'),
        apiFetch<any[]>('/outfits'),
        apiFetch<any[]>('/gallery').catch(() => []),
        apiFetch<any>('/gallery/usage').catch(() => ({ count: 0, limit: 200 })),
      ]);

      const char    = toAppCharacter(charRaw);
      const entries = (entriesRaw ?? []).map(toAppJournalEntry);
      const stors   = (storiesRaw ?? []).map(toAppStory);
      const outs    = (outfitsRaw ?? []).map(toAppOutfit);
      const gal     = (galleryRaw ?? []).map((r: any): GalleryPhoto => ({
        id:        r.id,
        imageUri:  resolveUri(r.imageUri) ?? r.imageUri,
        caption:   r.caption ?? '',
        createdAt: r.createdAt,
      }));

      setCharacterState(char);
      setJournalEntries(entries);
      setStories(stors);
      setOutfits(outs);
      setGallery(gal);
      setGalleryUsage({ count: usageRaw?.count ?? gal.length, limit: usageRaw?.limit ?? 200 });
      setApiOnline(true);

      await Promise.allSettled([
        AsyncStorage.setItem('character_v2', JSON.stringify(char)),
        AsyncStorage.setItem('journal_v2',   JSON.stringify(entries)),
        AsyncStorage.setItem('stories_v1',   JSON.stringify(stors)),
        AsyncStorage.setItem('outfits_v1',   JSON.stringify(outs)),
      ]);

      loadSocialData();
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
    apiFetch('/character', {
      method: 'PUT',
      body:   JSON.stringify({
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
      }),
    }).catch(() => {
      showToastGlobal("Couldn't sync profile — saved locally", 'warning');
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
      showToastGlobal("Entry saved locally — couldn't sync to server", 'warning');
    }
  }, [fireToast, reloadRewards, reloadConstellation]);

  const deleteJournalEntry = useCallback((id: string) => {
    setJournalEntries(prev => {
      const updated = prev.filter(e => e.id !== id);
      AsyncStorage.setItem('journal_v2', JSON.stringify(updated));
      return updated;
    });
    apiFetch(`/journal-entries/${id}`, { method: 'DELETE' }).catch(() => {
      showToastGlobal("Couldn't delete entry", 'error');
    });
  }, []);

  // ── Stories ────────────────────────────────────────────────────────────────

  const addStory = useCallback(async (story: Story): Promise<boolean> => {
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
        '/stories', {
          method: 'POST',
          body:   JSON.stringify({
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
          }),
        },
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
      showToastGlobal("Story couldn't be published — please try again", 'error');
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
    apiFetch(`/stories/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify({
        chapterTitle:  updates.chapterTitle,
        description:   updates.description ?? '',
        panels:        updates.panels,
        mood:          updates.mood,
        location:      updates.location,
        isPublic:      updates.isPublic,
        pageLayoutKey: updates.pageLayoutKey ?? null,
        pages:         updates.pages ?? null,
      }),
    }).catch(() => {
      showToastGlobal("Couldn't save story changes", 'error');
    });
  }, []);

  const deleteStory = useCallback((id: string) => {
    setStories(prev => {
      const updated = prev.filter(s => s.id !== id);
      AsyncStorage.setItem('stories_v1', JSON.stringify(updated));
      return updated;
    });
    apiFetch(`/stories/${id}`, { method: 'DELETE' }).catch(() => {
      showToastGlobal("Couldn't delete story", 'error');
    });
  }, []);

  // ── Outfits ────────────────────────────────────────────────────────────────

  const addOutfit = useCallback((outfit: Outfit) => {
    setOutfits(prev => {
      const updated = [outfit, ...prev.filter(o => o.id !== outfit.id)];
      AsyncStorage.setItem('outfits_v1', JSON.stringify(updated));
      return updated;
    });
    apiFetch('/outfits', {
      method: 'POST',
      body:   JSON.stringify({
        id:          outfit.id,
        date:        outfit.date,
        name:        outfit.name,
        description: outfit.description,
        story:       outfit.story ?? '',
        imageUri:    outfit.imageUri ?? null,
        tags:        outfit.tags,
        isPublic:    outfit.isPublic,
      }),
    })
    .then(() => reloadConstellation().catch(() => null))
    .catch(() => {
      showToastGlobal("Outfit saved locally — couldn't sync to server", 'warning');
    });
  }, [reloadConstellation]);

  const updateOutfit = useCallback((id: string, updates: Partial<Omit<Outfit, 'id'>>) => {
    setOutfits(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, ...updates } : o);
      AsyncStorage.setItem('outfits_v1', JSON.stringify(updated)).catch(() => null);
      return updated;
    });
    apiFetch(`/outfits/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(updates),
    }).catch(() => {
      showToastGlobal("Couldn't save outfit changes", 'error');
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
      showToastGlobal("Couldn't delete outfit", 'error');
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
      apiFetch('/rewards/active-cosmetics', {
        method: 'PUT',
        body:   JSON.stringify({ activeCosmetics: next }),
      }).catch(() => null);
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
      apiFetch('/rewards/active-cosmetics', {
        method: 'PUT',
        body:   JSON.stringify({ activeCosmetics: next }),
      }).catch(() => null);
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
    apiFetch('/character/active-outfit', {
      method: 'PATCH',
      body:   JSON.stringify({ activeOutfitId: id }),
    }).catch(() => null);
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
    } catch (err: any) {
      if (err?.status === 429) {
        throw new Error('Gallery limit reached');
      }
      throw err;
    }
  }, []);

  const deleteGalleryPhoto = useCallback((id: string) => {
    setGallery(prev => prev.filter(p => p.id !== id));
    setGalleryUsage(prev => ({ ...prev, count: Math.max(0, prev.count - 1) }));
    apiFetch(`/gallery/${id}`, { method: 'DELETE' }).catch(() => null);
  }, []);

  // ── Discover / Save ────────────────────────────────────────────────────────

  const toggleSavePost = useCallback((id: string) => {
    setSavedStoryIds(prev => {
      const next     = new Set(prev);
      const wasSaved = next.has(id);
      if (wasSaved) next.delete(id); else next.add(id);
      AsyncStorage.setItem('saved_stories_v1', JSON.stringify([...next])).catch(() => null);
      apiFetch(`/stories/${id}/save`, { method: wasSaved ? 'DELETE' : 'POST' }).catch(() => null);
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
    });
  }, []);

  // ── Rewards ────────────────────────────────────────────────────────────────

  const dismissReward = useCallback((id: string) => {
    setRewards(prev => prev.filter(r => r.id !== id));
  }, []);

  const showRewardToast = fireToast;

  const markServerNotificationsRead = useCallback(() => {
    setServerNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    apiFetch('/notifications/read-all', { method: 'PUT' }).catch(() => null);
  }, []);

  const deleteServerNotification = useCallback((id: string) => {
    setServerNotifications(prev => prev.filter(n => n.id !== id));
    apiFetch(`/notifications/${id}`, { method: 'DELETE' }).catch(() => null);
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
