import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// ── API base URL (baked in at build time via app.config.ts) ───────────────────

function resolveApiBase(): string {
  const extra  = (Constants.expoConfig as any)?.extra;
  const envUrl = extra?.apiUrl;
  if (envUrl) return envUrl as string;
  // Fallback: relative URL works when the app is served as a web bundle
  // from the same origin as the proxy (e.g. Expo Web preview in Replit).
  return '/api';
}

const API_BASE = resolveApiBase();

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${options?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Models ────────────────────────────────────────────────────────────────────

export interface Character {
  name:     string;
  bio:      string;
  mood:     string;
  traits:   string[];
  isPublic: boolean;
}

export interface StoryPanel {
  id:       string;
  imageUri?: string;
  text:     string;
}

export interface Story {
  id:             string;
  date:           string;
  chapterTitle:   string;
  panels:         StoryPanel[];
  mood:           string;
  location:       string;
  isPublic:       boolean;
  witnessedCount: number;
  savedCount:     number;
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
  imageUri?:   string;
  tags:        string[];
  isPublic:    boolean;
}

export interface DiscoverPost {
  id:             string;
  authorName:     string;
  authorHandle:   string;
  chapterTitle:   string;
  storySnippet:   string;
  imageUri?:      string;
  mood:           string;
  witnessedCount: number;
  savedCount:     number;
  timeAgo:        string;
  chapterNumber:  number;
  vibe:           string;
  saved:          boolean;
  panels?:        { text: string; imageUri?: string }[];
}

export interface Reward {
  id:          string;
  message:     string;
  subMessage?: string;
  count?:      number;
  icon:        string;
  isRising?:   boolean;
}

// ── Context value ─────────────────────────────────────────────────────────────

interface AppContextValue {
  isLoading: boolean;
  apiOnline: boolean;

  character:    Character;
  setCharacter: (c: Character) => void;

  stories:     Story[];
  addStory:    (s: Story) => void;
  deleteStory: (id: string) => void;

  journalEntries:     JournalEntry[];
  addJournalEntry:    (e: JournalEntry) => void;
  deleteJournalEntry: (id: string) => void;

  outfits:     Outfit[];
  addOutfit:   (o: Outfit) => void;
  deleteOutfit:(id: string) => void;

  discoverPosts:  DiscoverPost[];
  toggleSavePost: (id: string) => void;

  rewards:       Reward[];
  dismissReward: (id: string) => void;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CHARACTER: Character = {
  name:     'Aster',
  bio:      'A wandering light, chasing memories across the sky.',
  mood:     'Hopeful',
  traits:   ['Dreamer', 'Curious', 'Kind', 'Loner'],
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
    name:     raw.name     ?? DEFAULT_CHARACTER.name,
    bio:      raw.bio      ?? DEFAULT_CHARACTER.bio,
    mood:     raw.mood     ?? DEFAULT_CHARACTER.mood,
    traits:   Array.isArray(raw.traits) ? raw.traits : [],
    isPublic: raw.isPublic ?? raw.is_public ?? true,
  };
}

function toAppJournalEntry(raw: any): JournalEntry {
  return {
    id:         raw.id,
    date:       typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString(),
    type:       raw.type as JournalEntryType,
    text:       raw.text,
    mood:       raw.mood,
    imageUri:   raw.imageUri  ?? raw.image_uri  ?? undefined,
    friendName: raw.friendName ?? raw.friend_name ?? undefined,
  };
}

function toAppStory(raw: any): Story {
  return {
    id:             raw.id,
    date:           typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString(),
    chapterTitle:   raw.chapterTitle ?? raw.chapter_title,
    panels:         Array.isArray(raw.panels) ? raw.panels : [],
    mood:           raw.mood,
    location:       raw.location ?? '',
    isPublic:       raw.isPublic ?? raw.is_public ?? false,
    witnessedCount: raw.witnessedCount ?? raw.witnessed_count ?? 0,
    savedCount:     raw.savedCount     ?? raw.saved_count     ?? 0,
  };
}

function toAppOutfit(raw: any): Outfit {
  return {
    id:          raw.id,
    date:        typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString(),
    name:        raw.name,
    description: raw.description ?? '',
    imageUri:    raw.imageUri ?? raw.image_uri ?? undefined,
    tags:        Array.isArray(raw.tags) ? raw.tags : [],
    isPublic:    raw.isPublic ?? raw.is_public ?? false,
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

  const discoverPosts = useMemo((): DiscoverPost[] =>
    stories.map(s => ({
      id:             s.id,
      authorName:     character.name,
      authorHandle:   `@${character.name.toLowerCase().replace(/\s+/g, '')}`,
      chapterTitle:   s.chapterTitle,
      storySnippet:   s.panels[0]?.text ?? '',
      imageUri:       s.panels[0]?.imageUri,
      mood:           s.mood,
      witnessedCount: s.witnessedCount,
      savedCount:     s.savedCount,
      timeAgo:        relativeTimeDiscover(s.date),
      chapterNumber:  1,
      vibe:           s.mood,
      saved:          savedStoryIds.has(s.id),
      panels:         s.panels.map(p => ({ text: p.text, imageUri: p.imageUri })),
    })),
  [stories, character, savedStoryIds]);

  // Keep a ref so mutation callbacks always have the latest values without stale closures
  const stateRef = useRef({ journalEntries, stories, outfits, character });
  useEffect(() => { stateRef.current = { journalEntries, stories, outfits, character }; });

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setIsLoading(true);

    // Try API first
    try {
      const [charRaw, entriesRaw, storiesRaw, outfitsRaw] = await Promise.all([
        apiFetch<any>('/character'),
        apiFetch<any[]>('/journal-entries'),
        apiFetch<any[]>('/stories'),
        apiFetch<any[]>('/outfits'),
      ]);

      const char    = toAppCharacter(charRaw);
      const entries = (entriesRaw  ?? []).map(toAppJournalEntry);
      const stors   = (storiesRaw  ?? []).map(toAppStory);
      const outs    = (outfitsRaw  ?? []).map(toAppOutfit);

      setCharacterState(char);
      setJournalEntries(entries);
      setStories(stors);
      setOutfits(outs);
      setApiOnline(true);

      // Update local cache for offline use
      await Promise.allSettled([
        AsyncStorage.setItem('character_v2',  JSON.stringify(char)),
        AsyncStorage.setItem('journal_v2',    JSON.stringify(entries)),
        AsyncStorage.setItem('stories_v1',    JSON.stringify(stors)),
        AsyncStorage.setItem('outfits_v1',    JSON.stringify(outs)),
      ]);
    } catch {
      // API unreachable — fall back to AsyncStorage cache
      setApiOnline(false);
      try {
        const [c, s, j, o] = await Promise.all([
          AsyncStorage.getItem('character_v2'),
          AsyncStorage.getItem('stories_v1'),
          AsyncStorage.getItem('journal_v2'),
          AsyncStorage.getItem('outfits_v1'),
        ]);
        if (c) setCharacterState(JSON.parse(c));
        if (s) setStories(JSON.parse(s));
        if (j) setJournalEntries(JSON.parse(j));
        if (o) setOutfits(JSON.parse(o));
      } catch { /* use defaults */ }
    } finally {
      setIsLoading(false);
    }
  }

  // ── Character ──────────────────────────────────────────────────────────────

  const setCharacter = useCallback((c: Character) => {
    setCharacterState(c);
    AsyncStorage.setItem('character_v2', JSON.stringify(c));
    // Fire-and-forget API sync
    apiFetch('/character', {
      method: 'PUT',
      body:   JSON.stringify(c),
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

  const addStory = useCallback((story: Story) => {
    setStories(prev => {
      const updated = [story, ...prev.filter(s => s.id !== story.id)];
      AsyncStorage.setItem('stories_v1', JSON.stringify(updated));
      return updated;
    });
    apiFetch('/stories', {
      method: 'POST',
      body:   JSON.stringify({
        id:           story.id,
        date:         story.date,
        chapterTitle: story.chapterTitle,
        panels:       story.panels,
        mood:         story.mood,
        location:     story.location,
        isPublic:     story.isPublic,
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
        imageUri:    outfit.imageUri ?? null,
        tags:        outfit.tags,
        isPublic:    outfit.isPublic,
      }),
    }).catch(() => null);
  }, []);

  const deleteOutfit = useCallback((id: string) => {
    setOutfits(prev => {
      const updated = prev.filter(o => o.id !== id);
      AsyncStorage.setItem('outfits_v1', JSON.stringify(updated));
      return updated;
    });
    apiFetch(`/outfits/${id}`, { method: 'DELETE' }).catch(() => null);
  }, []);

  // ── Discover / Rewards ─────────────────────────────────────────────────────

  const toggleSavePost = useCallback((id: string) => {
    setSavedStoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const dismissReward = useCallback((id: string) => {
    setRewards(prev => prev.filter(r => r.id !== id));
  }, []);

  return (
    <AppContext.Provider value={{
      isLoading, apiOnline,
      character, setCharacter,
      stories, addStory, deleteStory,
      journalEntries, addJournalEntry, deleteJournalEntry,
      outfits, addOutfit, deleteOutfit,
      discoverPosts, toggleSavePost,
      rewards, dismissReward,
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
