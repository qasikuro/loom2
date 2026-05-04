import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type LogType = 'memory' | 'friend' | 'moment';

export interface Character {
  id: string;
  name: string;
  bio: string;
  mood: string;
  traits: string[];
  storiesCount: number;
  outfitsCount: number;
  memoriesCount: number;
  followersCount: number;
  followingCount: number;
  joinedDate: string;
}

export interface StoryPanel {
  id: string;
  imageUri?: string;
  text: string;
}

export interface LogEntry {
  id: string;
  date: string;
  chapterTitle: string;
  panels: StoryPanel[];
  mood: string;
  location: string;
  isPublic: boolean;
  witnessedCount: number;
  savedCount: number;
  vibeTag?: string;
  logType: LogType;
  friendTags?: string[];
}

export interface Friend {
  id: string;
  name: string;
  timesMet: number;
  lastSeen: string;
  notes: string[];
}

export interface DiscoverPost {
  id: string;
  authorName: string;
  authorHandle: string;
  chapterTitle: string;
  storySnippet: string;
  imageKey: string;
  mood: string;
  witnessedCount: number;
  savedCount: number;
  timeAgo: string;
  chapterNumber: number;
  vibe: string;
  saved: boolean;
  panels?: { text: string; imageKey: string }[];
}

export interface Reward {
  id: string;
  message: string;
  subMessage?: string;
  count?: number;
  icon: string;
  isRising?: boolean;
}

interface AppContextValue {
  character: Character;
  setCharacter: (c: Character) => void;
  logs: LogEntry[];
  addLog: (log: LogEntry) => void;
  deleteLog: (id: string) => void;
  discoverPosts: DiscoverPost[];
  toggleSavePost: (id: string) => void;
  rewards: Reward[];
  dismissReward: (id: string) => void;
  friends: Friend[];
  addOrUpdateFriend: (name: string, note?: string) => void;
  searchLogs: (query: string) => LogEntry[];
  searchFriends: (query: string) => Friend[];
}

const DEFAULT_CHARACTER: Character = {
  id: '1',
  name: 'Aster',
  bio: 'A wandering light, chasing memories across the sky.',
  mood: 'Hopeful',
  traits: ['Dreamer', 'Curious', 'Kind', 'Loner'],
  storiesCount: 12,
  outfitsCount: 8,
  memoriesCount: 24,
  followersCount: 312,
  followingCount: 28,
  joinedDate: 'May 2024',
};

const SAMPLE_FRIENDS: Friend[] = [
  {
    id: 'f1',
    name: 'Lumière',
    timesMet: 3,
    lastSeen: '2025-03-10T00:00:00Z',
    notes: ['Met at Dawn Prairie', 'Played music together near the temple', 'Shared candles at Eden'],
  },
  {
    id: 'f2',
    name: 'Yoru',
    timesMet: 1,
    lastSeen: '2025-02-18T00:00:00Z',
    notes: ['Brief encounter in Hidden Forest — they were quiet but kind'],
  },
  {
    id: 'f3',
    name: 'Noctis',
    timesMet: 2,
    lastSeen: '2025-04-01T00:00:00Z',
    notes: ['Found them wandering in the rain at Valley', 'Flew together — no words needed'],
  },
];

const SAMPLE_POSTS: DiscoverPost[] = [
  {
    id: 'p1',
    authorName: 'Lumière',
    authorHandle: '@lumiere.sky',
    chapterTitle: 'A silent wish',
    storySnippet: 'I sat under the stars and made a wish...',
    imageKey: 'story_bg1',
    mood: 'Lonely',
    witnessedCount: 215,
    savedCount: 45,
    timeAgo: '2h ago',
    chapterNumber: 3,
    vibe: 'Lonely',
    saved: false,
    panels: [
      { text: 'I sat under the stars and made a wish...', imageKey: 'story_bg1' },
      { text: 'The light that carried it was soft and small,\nlike a firefly on a summer night.', imageKey: 'story_bg3' },
      { text: 'I wonder if it reached you.', imageKey: 'story_bg1' },
    ],
  },
  {
    id: 'p2',
    authorName: 'Yoru',
    authorHandle: '@yoru.wanderer',
    chapterTitle: 'New journey begins',
    storySnippet: 'Every adventure starts with a single step forward.',
    imageKey: 'story_bg2',
    mood: 'Hopeful',
    witnessedCount: 178,
    savedCount: 32,
    timeAgo: '5h ago',
    chapterNumber: 1,
    vibe: 'Soft',
    saved: false,
    panels: [
      { text: 'Every adventure starts with a single step forward.', imageKey: 'story_bg2' },
      { text: 'I did not know where the path led.\nBut the sky was open,\nand my heart was lighter than air.', imageKey: 'story_bg2' },
    ],
  },
  {
    id: 'p3',
    authorName: 'Noctis',
    authorHandle: '@noctis.echo',
    chapterTitle: 'Whispers in the Wind',
    storySnippet: 'The wind carries memories of the ones who came before.',
    imageKey: 'story_bg3',
    mood: 'Peaceful',
    witnessedCount: 412,
    savedCount: 78,
    timeAgo: '1d ago',
    chapterNumber: 2,
    vibe: 'Romantic',
    saved: false,
    panels: [
      { text: 'The wind carries memories\nof the ones who came before.', imageKey: 'story_bg3' },
      { text: 'I listen to them\nwhen the world gets too quiet.', imageKey: 'story_bg1' },
      { text: 'And I keep walking,\ntoward a place I belong.', imageKey: 'story_bg2' },
    ],
  },
  {
    id: 'p4',
    authorName: 'Sol',
    authorHandle: '@sol.bright',
    chapterTitle: 'Golden Hour',
    storySnippet: 'When the sky turns gold, I think of you.',
    imageKey: 'story_bg2',
    mood: 'Romantic',
    witnessedCount: 89,
    savedCount: 21,
    timeAgo: '2d ago',
    chapterNumber: 4,
    vibe: 'Romantic',
    saved: false,
    panels: [
      { text: 'When the sky turns gold,\nI think of you.', imageKey: 'story_bg2' },
      { text: 'And the promise we made\nbeneath the lanterns.', imageKey: 'story_bg3' },
    ],
  },
  {
    id: 'p5',
    authorName: 'Mira',
    authorHandle: '@mira.bloom',
    chapterTitle: 'Lost in the meadow',
    storySnippet: 'Some places exist only in memories.',
    imageKey: 'story_bg1',
    mood: 'Soft',
    witnessedCount: 334,
    savedCount: 67,
    timeAgo: '3d ago',
    chapterNumber: 1,
    vibe: 'Soft',
    saved: false,
    panels: [
      { text: 'Some places exist only in memories.', imageKey: 'story_bg1' },
      { text: 'I return there in dreams,\nchasing butterflies of light.', imageKey: 'story_bg2' },
      { text: 'Maybe that is enough.', imageKey: 'story_bg3' },
    ],
  },
  {
    id: 'p6',
    authorName: 'Kael',
    authorHandle: '@kael.storm',
    chapterTitle: 'The forgotten path',
    storySnippet: 'I kept walking toward a place I belong.',
    imageKey: 'story_bg3',
    mood: 'Chaotic',
    witnessedCount: 254,
    savedCount: 44,
    timeAgo: '4d ago',
    chapterNumber: 1,
    vibe: 'Chaotic',
    saved: false,
    panels: [
      { text: 'I kept walking\ntoward a place I belong.', imageKey: 'story_bg3' },
      { text: 'Even if it no longer exists.', imageKey: 'story_bg1' },
    ],
  },
];

const INITIAL_REWARDS: Reward[] = [
  { id: 'r1', message: 'People experienced\nyour story today', count: 18, icon: 'eye' },
  { id: 'r2', message: 'Your story was saved\nby someone', count: 6, icon: 'bookmark' },
  { id: 'r3', message: "You were discovered\nin 'Soft' vibe", icon: 'feather' },
  { id: 'r4', message: 'Rising Star', subMessage: 'Your story is inspiring\nmore travelers!', icon: 'star', isRising: true },
];

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [character, setCharacterState] = useState<Character>(DEFAULT_CHARACTER);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<DiscoverPost[]>(SAMPLE_POSTS);
  const [rewards, setRewards] = useState<Reward[]>(INITIAL_REWARDS);
  const [friends, setFriends] = useState<Friend[]>(SAMPLE_FRIENDS);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [savedChar, savedLogs, savedFriends] = await Promise.all([
        AsyncStorage.getItem('character'),
        AsyncStorage.getItem('logs_v2'),
        AsyncStorage.getItem('friends_v1'),
      ]);
      if (savedChar) setCharacterState(JSON.parse(savedChar));
      if (savedLogs) setLogs(JSON.parse(savedLogs));
      if (savedFriends) setFriends(JSON.parse(savedFriends));
    } catch {}
  }

  function setCharacter(c: Character) {
    setCharacterState(c);
    AsyncStorage.setItem('character', JSON.stringify(c));
  }

  function addLog(log: LogEntry) {
    const entry: LogEntry = { ...log, logType: log.logType ?? 'memory' };
    const updated = [entry, ...logs];
    setLogs(updated);
    AsyncStorage.setItem('logs_v2', JSON.stringify(updated));
    setCharacterState(prev => ({ ...prev, storiesCount: prev.storiesCount + 1, memoriesCount: prev.memoriesCount + 1 }));
  }

  function deleteLog(id: string) {
    const updated = logs.filter(l => l.id !== id);
    setLogs(updated);
    AsyncStorage.setItem('logs_v2', JSON.stringify(updated));
  }

  function toggleSavePost(id: string) {
    setDiscoverPosts(prev =>
      prev.map(p => p.id === id ? { ...p, saved: !p.saved, savedCount: p.saved ? p.savedCount - 1 : p.savedCount + 1 } : p)
    );
  }

  function dismissReward(id: string) {
    setRewards(prev => prev.filter(r => r.id !== id));
  }

  function addOrUpdateFriend(name: string, note?: string) {
    setFriends(prev => {
      const existing = prev.find(f => f.name.toLowerCase() === name.toLowerCase());
      let updated: Friend[];
      if (existing) {
        updated = prev.map(f =>
          f.id === existing.id
            ? {
                ...f,
                timesMet: f.timesMet + 1,
                lastSeen: new Date().toISOString(),
                notes: note ? [...f.notes, note] : f.notes,
              }
            : f
        );
      } else {
        const newFriend: Friend = {
          id: Date.now().toString(),
          name,
          timesMet: 1,
          lastSeen: new Date().toISOString(),
          notes: note ? [note] : [],
        };
        updated = [newFriend, ...prev];
      }
      AsyncStorage.setItem('friends_v1', JSON.stringify(updated));
      return updated;
    });
  }

  function searchLogs(query: string): LogEntry[] {
    if (!query.trim()) return logs;
    const q = query.toLowerCase();
    return logs.filter(l => {
      const titleMatch = l.chapterTitle.toLowerCase().includes(q);
      const textMatch = l.panels.some(p => p.text.toLowerCase().includes(q));
      const moodMatch = l.mood.toLowerCase().includes(q);
      const locationMatch = l.location.toLowerCase().includes(q);
      const friendMatch = l.friendTags?.some(f => f.toLowerCase().includes(q));
      return titleMatch || textMatch || moodMatch || locationMatch || friendMatch;
    });
  }

  function searchFriends(query: string): Friend[] {
    if (!query.trim()) return friends;
    const q = query.toLowerCase();
    return friends.filter(f => f.name.toLowerCase().includes(q));
  }

  return (
    <AppContext.Provider value={{
      character, setCharacter,
      logs, addLog, deleteLog,
      discoverPosts, toggleSavePost,
      rewards, dismissReward,
      friends, addOrUpdateFriend,
      searchLogs, searchFriends,
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
