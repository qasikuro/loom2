import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

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
    storySnippet: "I kept walking toward a place I belong.",
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
  { id: 'r1', message: 'People experienced\nyour story today', count: 18, icon: 'eye', isRising: false },
  { id: 'r2', message: 'Your story was saved\nby someone', count: 6, icon: 'bookmark', isRising: false },
  { id: 'r3', message: "You were discovered\nin 'Soft' vibe", icon: 'feather', isRising: false },
  { id: 'r4', message: 'Rising Star', subMessage: 'Your story is inspiring\nmore travelers!', icon: 'star', isRising: true },
];

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [character, setCharacterState] = useState<Character>(DEFAULT_CHARACTER);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<DiscoverPost[]>(SAMPLE_POSTS);
  const [rewards, setRewards] = useState<Reward[]>(INITIAL_REWARDS);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [savedChar, savedLogs] = await Promise.all([
        AsyncStorage.getItem('character'),
        AsyncStorage.getItem('logs_v2'),
      ]);
      if (savedChar) setCharacterState(JSON.parse(savedChar));
      if (savedLogs) setLogs(JSON.parse(savedLogs));
    } catch {}
  }

  function setCharacter(c: Character) {
    setCharacterState(c);
    AsyncStorage.setItem('character', JSON.stringify(c));
  }

  function addLog(log: LogEntry) {
    const updated = [log, ...logs];
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

  return (
    <AppContext.Provider value={{ character, setCharacter, logs, addLog, deleteLog, discoverPosts, toggleSavePost, rewards, dismissReward }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
