// Pure mapper functions — no React Native / Expo dependencies so they can be
// unit-tested in a plain Node.js / vitest environment.

// ── Shared app-level types ─────────────────────────────────────────────────────

export interface ProfileLink {
  label:     string;
  url:       string;
  platform?: string;
}

export interface GuideAvailability {
  days:      number[];
  timeFrom:  string;
  timeTo:    string;
  timezone?: string;
}

export type BubbleStyle = 'rounded' | 'sharp' | 'oval';

export interface PanelOverlay {
  id:           string;
  type:         'bubble' | 'text' | 'sticker';
  content:      string;
  xPct:         number;
  yPct:         number;
  fontFamily?:  string;
  fontSize?:    number;
  bubbleStyle?: BubbleStyle;
  color?:       string;
}

export interface StoryPanel {
  id:                string;
  imageUri?:         string;
  bgPreset?:         string;
  text:              string;
  bubbleText?:       string;
  overlays?:         PanelOverlay[];
  imageAspectRatio?: number;
}

export interface StoryPage {
  id:        string;
  layoutKey: string;
  panels:    StoryPanel[];
}

export interface Character {
  name:               string;
  bio:                string;
  mood:               string;
  traits:             string[];
  isPublic:           boolean;
  username?:          string;
  avatarUri?:         string;
  activeOutfitId?:    string | null;
  birthday?:          string;
  country?:           string;
  role?:              string;
  timezone?:          string;
  pushToken?:         string;
  links?:             ProfileLink[];
  isGuide?:              boolean;
  guideBio?:             string;
  guideTopics?:          string[];
  guideAvailability?:    GuideAvailability | null;
  constellationType?:    string | null;
}

export type JournalEntryType = 'diary' | 'friend' | 'moment';

export interface JournalEntry {
  id:            string;
  date:          string;
  type:          JournalEntryType;
  text:          string;
  mood:          string;
  imageUri?:     string;
  friendName?:   string;
  stickerCount?: number;
}

export interface Story {
  id:             string;
  date:           string;
  chapterTitle:   string;
  description:    string;
  panels:         StoryPanel[];
  mood:           string;
  location:       string;
  isPublic:       boolean;
  witnessedCount: number;
  savedCount:     number;
  stickerCount:   number;
  pageLayoutKey?: string;
  pages?:         StoryPage[];
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

export interface DiscoverPost {
  id:               string;
  authorUserId:     string;
  authorName:       string;
  authorHandle:     string;
  authorTitle?:     string | null;
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

// ── Raw server response shapes ─────────────────────────────────────────────────

export interface RawCharacterResponse {
  name?:               string;
  bio?:                string;
  mood?:               string;
  traits?:             unknown;
  isPublic?:           boolean;
  is_public?:          boolean;
  username?:           string;
  avatarUri?:          string;
  activeOutfitId?:     string;
  active_outfit_id?:   string;
  birthday?:           string;
  country?:            string;
  role?:               string;
  timezone?:           string;
  pushToken?:          string;
  push_token?:         string;
  links?:              unknown;
  isGuide?:              boolean;
  guideBio?:             string;
  guideTopics?:          unknown;
  guideAvailability?:    unknown;
  constellationType?:    string | null;
}

export interface RawJournalEntryResponse {
  id:            string;
  date:          string | Date;
  type:          string;
  text:          string;
  mood:          string;
  imageUri?:     string | null;
  image_uri?:    string | null;
  friendName?:   string | null;
  friend_name?:  string | null;
  stickerCount?: number;
}

export interface RawStoryPanel {
  id?:               string;
  text?:             string;
  imageUri?:         string | null;
  bgPreset?:         string;
  overlays?:         unknown[];
  imageAspectRatio?: number;
  bubbleText?:       string;
}

export interface RawStoryResponse {
  id:               string;
  date:             string | Date;
  chapterTitle?:    string;
  chapter_title?:   string;
  description?:     string;
  panels?:          RawStoryPanel[];
  mood:             string;
  location?:        string;
  isPublic?:        boolean;
  is_public?:       boolean;
  witnessedCount?:  number;
  witnessed_count?: number;
  savedCount?:      number;
  saved_count?:     number;
  stickerCount?:    number;
  pageLayoutKey?:   string;
  page_layout_key?: string;
  pages?:           unknown[];
}

export interface RawOutfitResponse {
  id:           string;
  date:         string | Date;
  name:         string;
  description?: string;
  story?:       string;
  imageUri?:    string | null;
  image_uri?:   string | null;
  tags?:        unknown;
  isPublic?:    boolean;
  is_public?:   boolean;
}

export interface RawDiscoverApiItem {
  id:               string;
  authorUserId?:    string;
  authorName?:      string;
  authorUsername?:  string;
  authorTitle?:     string | null;
  authorAvatarUri?: string | null;
  chapterTitle?:    string;
  description?:     string;
  storySnippet?:    string;
  imageUri?:        string | null;
  mood?:            string;
  witnessedCount?:  number;
  savedCount?:      number;
  stickerCount?:    number;
  date?:            string;
  createdAt?:       string;
  chapterNumber?:   number;
  panels?:          Array<{ text?: string; imageUri?: string | null; overlays?: unknown[] }>;
  pages?:           unknown[];
  pageLayoutKey?:   string;
}

// ── Defaults ───────────────────────────────────────────────────────────────────

export const DEFAULT_CHARACTER: Character = {
  name:     'Sky Child',
  bio:      'A wandering light, chasing memories across the sky.',
  mood:     'Hopeful',
  traits:   ['Dreamer', 'Curious', 'Kind'],
  isPublic: true,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Resolve a possibly-relative API image path to an absolute URI.
 * Accepts an optional `apiBase` for testability (defaults to '/api').
 */
export function resolveUri(
  uri: string | null | undefined,
  apiBase = '/api',
): string | undefined {
  if (!uri) return undefined;
  if (/^https?:/.test(uri) || uri.startsWith('data:') || uri.startsWith('blob:')) return uri;
  const domainBase = apiBase.replace(/\/api$/, '');
  return `${domainBase}${uri}`;
}

export function relativeTimeDiscover(dateStr: string): string {
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

// ── Mapper functions ───────────────────────────────────────────────────────────

export function toAppCharacter(raw: RawCharacterResponse, apiBase?: string): Character {
  return {
    name:              raw.name          ?? DEFAULT_CHARACTER.name,
    bio:               raw.bio           ?? DEFAULT_CHARACTER.bio,
    mood:              raw.mood          ?? DEFAULT_CHARACTER.mood,
    traits:            Array.isArray(raw.traits) ? (raw.traits as string[]) : [],
    isPublic:          raw.isPublic      ?? raw.is_public      ?? true,
    username:          raw.username      ?? undefined,
    avatarUri:         raw.avatarUri     ?? undefined,
    activeOutfitId:    raw.activeOutfitId ?? raw.active_outfit_id ?? undefined,
    birthday:          raw.birthday      ?? undefined,
    country:           raw.country       ?? undefined,
    role:              raw.role          ?? undefined,
    timezone:          raw.timezone      ?? undefined,
    pushToken:         raw.pushToken     ?? raw.push_token ?? undefined,
    links:             Array.isArray(raw.links) ? (raw.links as ProfileLink[]) : undefined,
    isGuide:              raw.isGuide          ?? false,
    guideBio:             raw.guideBio         ?? '',
    guideTopics:          Array.isArray(raw.guideTopics) ? (raw.guideTopics as string[]) : [],
    guideAvailability:    (raw.guideAvailability as GuideAvailability | null | undefined) ?? null,
    constellationType:    (raw.constellationType ?? null) as string | null,
  };
}

export function toAppJournalEntry(raw: RawJournalEntryResponse, apiBase?: string): JournalEntry {
  return {
    id:           raw.id,
    date:         typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString(),
    type:         raw.type as JournalEntryType,
    text:         raw.text,
    mood:         raw.mood,
    imageUri:     resolveUri(raw.imageUri ?? raw.image_uri, apiBase),
    friendName:   raw.friendName ?? raw.friend_name ?? undefined,
    stickerCount: raw.stickerCount ?? 0,
  };
}

export function toAppStory(raw: RawStoryResponse, apiBase?: string): Story {
  return {
    id:             raw.id,
    date:           typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString(),
    chapterTitle:   raw.chapterTitle ?? raw.chapter_title ?? '',
    description:    raw.description ?? '',
    panels:         Array.isArray(raw.panels)
      ? raw.panels.map((p: RawStoryPanel): StoryPanel => ({
          id:               p.id ?? '',
          text:             p.text ?? '',
          imageUri:         resolveUri(p.imageUri ?? undefined, apiBase),
          bgPreset:         p.bgPreset,
          overlays:         p.overlays as PanelOverlay[] | undefined,
          imageAspectRatio: p.imageAspectRatio,
          bubbleText:       p.bubbleText,
        }))
      : [],
    mood:           raw.mood,
    location:       raw.location ?? '',
    isPublic:       raw.isPublic ?? raw.is_public ?? false,
    witnessedCount: raw.witnessedCount ?? raw.witnessed_count ?? 0,
    savedCount:     raw.savedCount     ?? raw.saved_count     ?? 0,
    stickerCount:   raw.stickerCount   ?? 0,
    pageLayoutKey:  raw.pageLayoutKey  ?? raw.page_layout_key ?? undefined,
    pages:          Array.isArray(raw.pages) ? (raw.pages as StoryPage[]) : undefined,
  };
}

export function toAppOutfit(raw: RawOutfitResponse, apiBase?: string): Outfit {
  return {
    id:          raw.id,
    date:        typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString(),
    name:        raw.name,
    description: raw.description ?? '',
    story:       raw.story ?? '',
    imageUri:    resolveUri(raw.imageUri ?? raw.image_uri, apiBase),
    tags:        Array.isArray(raw.tags) ? raw.tags : [],
    isPublic:    raw.isPublic ?? raw.is_public ?? false,
  };
}

type RawDiscoverItem = Omit<DiscoverPost, 'saved' | 'isFollowing'>;

export function toRawDiscoverPost(raw: RawDiscoverApiItem, apiBase?: string): RawDiscoverItem {
  return {
    id:               raw.id,
    authorUserId:     raw.authorUserId ?? '',
    authorName:       raw.authorName ?? 'Sky Child',
    authorHandle:     raw.authorUsername
      ? `@${raw.authorUsername}`
      : `@${(raw.authorName ?? 'sky').toLowerCase().replace(/\s+/g, '')}`,
    authorTitle:      raw.authorTitle ?? null,
    authorAvatarUri:  resolveUri(raw.authorAvatarUri ?? undefined, apiBase) ?? null,
    chapterTitle:     raw.chapterTitle ?? '',
    storySnippet:     raw.storySnippet ?? '',
    imageUri:         resolveUri(raw.imageUri ?? undefined, apiBase),
    mood:             raw.mood ?? 'Hopeful',
    witnessedCount:   raw.witnessedCount ?? 0,
    savedCount:       raw.savedCount ?? 0,
    stickerCount:     raw.stickerCount ?? 0,
    timeAgo:          relativeTimeDiscover(raw.date ?? raw.createdAt ?? new Date().toISOString()),
    date:             raw.date ?? raw.createdAt ?? new Date().toISOString(),
    chapterNumber:    raw.chapterNumber ?? 1,
    vibe:             raw.mood ?? 'Hopeful',
    panels:           Array.isArray(raw.panels) ? raw.panels.map(p => ({
      text:     p.text     ?? '',
      imageUri: resolveUri(p.imageUri ?? undefined, apiBase),
      overlays: Array.isArray(p.overlays) ? (p.overlays as PanelOverlay[]) : undefined,
    })) : [],
    pages:            Array.isArray(raw.pages) ? (raw.pages as StoryPage[]) : undefined,
    pageLayoutKey:    raw.pageLayoutKey ?? undefined,
  };
}
