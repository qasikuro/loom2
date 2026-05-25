import AsyncStorage from '@react-native-async-storage/async-storage';
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
// implicit base, so we must prefix API_BASE. HTTPS / data / blob URIs pass through.
function resolveUri(uri: string | null | undefined): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith('/')) return `${API_BASE}${uri}`;
  return uri;
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

export interface Character {
  name:           string;
  bio:            string;
  mood:           string;
  traits:         string[];
  isPublic:       boolean;
  username?:      string;
  avatarUri?:     string;
  activeOutfitId?: string | null;
  birthday?:      string;
  country?:       string;
  role?:          string;
  timezone?:      string;
  pushToken?:     string;
  links?:         ProfileLink[];
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
  pageLayoutKey?:  string;
  pages?:          StoryPage[];
}

export type JournalEntryType = 'diary' | 'friend' | 'moment';

export interface JournalEntry {
  id:          string;
  date:        string;
  type:        JournalEntryType;
  text:        string;
  mood:        string;
  imageUri?:   string;
  friendName?: string;
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

  rewards:       Reward[];
  dismissReward: (id: string) => void;

  serverNotifications:         ServerNotification[];
  markServerNotificationsRead: () => void;
  deleteServerNotification:    (id: string) => void;

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
    name:          raw.name          ?? DEFAULT_CHARACTER.name,
    bio:           raw.bio           ?? DEFAULT_CHARACTER.bio,
    mood:          raw.mood          ?? DEFAULT_CHARACTER.mood,
    traits:        Array.isArray(raw.traits) ? raw.traits : [],
    isPublic:      raw.isPublic      ?? raw.is_public      ?? true,
    username:      raw.username      ?? undefined,
    avatarUri:     raw.avatarUri     ?? undefined,
    activeOutfitId: raw.activeOutfitId ?? raw.active_outfit_id ?? undefined,
    birthday:      raw.birthday      ?? undefined,
    country:       raw.country       ?? undefined,
    role:          raw.role          ?? undefined,
    timezone:      raw.timezone      ?? undefined,
    pushToken:     raw.pushToken     ?? raw.push_token ?? undefined,
    links:         Array.isArray(raw.links) ? raw.links : undefined,
  };
}

function toAppJournalEntry(raw: any): JournalEntry {
  return {
    id:         raw.id,
    date:       typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString(),
    type:       raw.type as JournalEntryType,
    text:       raw.text,
    mood:       raw.mood,
    imageUri:   resolveUri(raw.imageUri ?? raw.image_uri),
    friendName: raw.friendName ?? raw.friend_name ?? undefined,
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
  const [activeOutfitId, setActiveOutfitIdState] = useState<string | null>(null);

  const [gallery, setGallery]           = useState<GalleryPhoto[]>([]);
  const [galleryUsage, setGalleryUsage] = useState<GalleryUsage>({ count: 0, limit: 200 });

  const [discoverFeedRaw, setDiscoverFeedRaw]         = useState<RawDiscoverItem[]>([]);
  const [followingIds, setFollowingIds]               = useState<string[]>([]);
  const [friends, setFriends]                         = useState<FriendSummary[]>([]);
  const [serverNotifications, setServerNotifications] = useState<ServerNotification[]>([]);

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
  // Replaces the old "fire all requests → all 401 → wait 1500 ms → retry" pattern.
  async function waitForToken(maxMs = 6000): Promise<string | null> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      const t = await _getToken();
      if (t) return t;
      await new Promise<void>(r => setTimeout(r, 100));
    }
    return null;
  }

  async function loadFromCache() {
    try {
      const [c, j, s, o, d, f, sv] = await Promise.all([
        AsyncStorage.getItem('character_v2'),
        AsyncStorage.getItem('journal_v2'),
        AsyncStorage.getItem('stories_v1'),
        AsyncStorage.getItem('outfits_v1'),
        AsyncStorage.getItem('discover_v1'),
        AsyncStorage.getItem('following_v1'),
        AsyncStorage.getItem('saved_stories_v1'),
      ]);
      if (c)  setCharacterState(JSON.parse(c));
      if (j)  setJournalEntries(JSON.parse(j));
      if (s)  setStories(JSON.parse(s));
      if (o)  setOutfits(JSON.parse(o));
      if (d)  setDiscoverFeedRaw(JSON.parse(d));
      if (f)  setFollowingIds(JSON.parse(f));
      if (sv) { try { setSavedStoryIds(new Set(JSON.parse(sv))); } catch { /* ignore */ } }
    } catch { /* use defaults */ } finally {
      dataReadyRef.current = true;
      setIsLoading(false);
    }
  }

  // ── Clear all user data (call on sign-out) ────────────────────────────────

  const ALL_CACHE_KEYS = [
    'character_v2', 'journal_v2', 'stories_v1', 'outfits_v1',
    'discover_v1', 'following_v1', 'saved_stories_v1',
    // active_outfit_v1 is intentionally NOT cleared on logout so the outfit
    // preference survives a logout/login cycle. loadData() validates the saved
    // ID against the freshly loaded outfit list before applying it.
  ];

  const clearUserData = useCallback(async () => {
    // Reset in-memory state immediately so the UI goes blank on sign-out.
    // We intentionally keep the AsyncStorage cache intact — if the same user
    // signs back in, loadFromCache() will show their data instantly while the
    // API call completes, eliminating the white-screen lag.
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
    setApiOnline(false);
    // Reset load guards so the next sign-in can trigger a full reload
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
        galleryRaw, usageRaw, discoverRaw, followingRaw, notifRaw, friendsRaw,
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
      const feed    = (discoverRaw  ?? []).map(toRawDiscoverPost);
      const follows = followingRaw ?? [];

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
      setApiOnline(true);

      // Restore active outfit across sessions.
      if (outs.length > 0) {
        const savedId = await AsyncStorage.getItem('active_outfit_v1');
        const validId = savedId && outs.some(o => o.id === savedId) ? savedId : outs[0].id;
        setActiveOutfitIdState(validId);
        AsyncStorage.setItem('active_outfit_v1', validId).catch(() => null);
      }

      // Restore saved-story IDs that were bookmarked in previous sessions.
      AsyncStorage.getItem('saved_stories_v1').then(raw => {
        if (raw) { try { setSavedStoryIds(new Set(JSON.parse(raw))); } catch { /* ignore */ } }
      }).catch(() => null);

      // Persist all fresh data to cache in parallel
      await Promise.allSettled([
        AsyncStorage.setItem('character_v2',  JSON.stringify(char)),
        AsyncStorage.setItem('journal_v2',    JSON.stringify(entries)),
        AsyncStorage.setItem('stories_v1',    JSON.stringify(stors)),
        AsyncStorage.setItem('outfits_v1',    JSON.stringify(outs)),
        AsyncStorage.setItem('discover_v1',   JSON.stringify(feed)),
        AsyncStorage.setItem('following_v1',  JSON.stringify(follows)),
      ]);
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

  // Re-fetch from the API every time the app comes to the foreground so that
  // admin amendments (removed stories, account changes) are reflected without
  // requiring a full sign-out / sign-in cycle.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        softLoadData();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // ── Character ──────────────────────────────────────────────────────────────

  const setCharacter = useCallback((c: Character) => {
    setCharacterState(c);
    AsyncStorage.setItem('character_v2', JSON.stringify(c));
    apiFetch('/character', {
      method: 'PUT',
      body:   JSON.stringify({
        name:           c.name,
        bio:            c.bio,
        mood:           c.mood,
        traits:         c.traits,
        isPublic:       c.isPublic,
        username:       c.username       ?? null,
        avatarUri:      c.avatarUri      ?? null,
        activeOutfitId: c.activeOutfitId ?? null,
        birthday:       c.birthday       ?? null,
        country:        c.country        ?? null,
        role:           c.role           ?? null,
        timezone:       c.timezone       ?? null,
        pushToken:      c.pushToken      ?? null,
        links:          c.links          ?? null,
      }),
    }).catch(() => null);
  }, []);

  // ── Journal entries ────────────────────────────────────────────────────────

  const addJournalEntry = useCallback((entry: JournalEntry) => {
    setJournalEntries(prev => {
      const updated = [entry, ...prev.filter(e => e.id !== entry.id)];
      AsyncStorage.setItem('journal_v2', JSON.stringify(updated));
      return updated;
    });
    apiFetch('/journal-entries', {
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
    }).catch(() => null);
  }, []);

  const deleteJournalEntry = useCallback((id: string) => {
    setJournalEntries(prev => {
      const updated = prev.filter(e => e.id !== id);
      AsyncStorage.setItem('journal_v2', JSON.stringify(updated));
      return updated;
    });
    apiFetch(`/journal-entries/${id}`, { method: 'DELETE' }).catch(() => null);
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
      await apiFetch('/stories', {
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
      });
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
      return false;
    }
  }, []);

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
    }).catch(() => null);
  }, []);

  const deleteStory = useCallback((id: string) => {
    setStories(prev => {
      const updated = prev.filter(s => s.id !== id);
      AsyncStorage.setItem('stories_v1', JSON.stringify(updated));
      return updated;
    });
    apiFetch(`/stories/${id}`, { method: 'DELETE' }).catch(() => null);
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
    }).catch(() => null);
  }, []);

  const updateOutfit = useCallback((id: string, updates: Partial<Omit<Outfit, 'id'>>) => {
    setOutfits(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, ...updates } : o);
      AsyncStorage.setItem('outfits_v1', JSON.stringify(updated)).catch(() => null);
      return updated;
    });
    apiFetch(`/outfits/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(updates),
    }).catch(() => null);
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
    apiFetch(`/outfits/${id}`, { method: 'DELETE' }).catch(() => null);
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
      const next    = new Set(prev);
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
    apiFetch(`/follows/${targetUserId}`, { method: 'POST' })
      .then(() => fetchFriends())
      .catch(() => {
        setFollowingIds(prev => prev.filter(id => id !== targetUserId));
      });
  }, []);

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
      friends, followingIds, followUser, unfollowUser,
      rewards, dismissReward,
      serverNotifications, markServerNotificationsRead, deleteServerNotification,
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
