export interface TitleDef {
  id:          string;
  name:        string;
  flavour:     string;
  unlockHint:  string;
  category:    'milestone' | 'activity';
  emoji:       string;
  color:       string;
  condition: {
    type: 'witness_count' | 'story_count' | 'journal_count' | 'constellation_stars' | 'always';
    value: number;
  };
}

export const TITLE_CATALOGUE: TitleDef[] = [
  // ── Milestone titles (earned via witness milestones) ────────────────────────
  {
    id:         'witnessed',
    name:       'Witnessed',
    flavour:    'A sky child whose story has been seen',
    unlockHint: 'Receive your first witness',
    category:   'milestone',
    emoji:      '👁️',
    color:      '#B8D4F0',
    condition:  { type: 'witness_count', value: 1 },
  },
  {
    id:         'resonant',
    name:       'Resonant',
    flavour:    'Your voice carries across the sky',
    unlockHint: 'Receive 10 witnesses',
    category:   'milestone',
    emoji:      '✦',
    color:      '#C8A84B',
    condition:  { type: 'witness_count', value: 10 },
  },
  {
    id:         'storyteller',
    name:       'Storyteller',
    flavour:    'A keeper of tales the sky remembers',
    unlockHint: 'Receive 50 witnesses',
    category:   'milestone',
    emoji:      '📖',
    color:      '#B890D0',
    condition:  { type: 'witness_count', value: 50 },
  },
  {
    id:         'illuminated',
    name:       'Illuminated',
    flavour:    'You shine as a beacon in the darkness',
    unlockHint: 'Receive 100 witnesses',
    category:   'milestone',
    emoji:      '💫',
    color:      '#E8D060',
    condition:  { type: 'witness_count', value: 100 },
  },
  {
    id:         'legend',
    name:       'Legend',
    flavour:    'A name whispered among the stars forever',
    unlockHint: 'Receive 500 witnesses',
    category:   'milestone',
    emoji:      '⭐',
    color:      '#F0B040',
    condition:  { type: 'witness_count', value: 500 },
  },
  {
    id:         'guiding_light',
    name:       'Guiding Light',
    flavour:    'Others follow the trail you light',
    unlockHint: 'Unlock 5 constellation stars',
    category:   'milestone',
    emoji:      '🌟',
    color:      '#68C8A8',
    condition:  { type: 'constellation_stars', value: 5 },
  },
  // ── Activity titles (earned via creating) ───────────────────────────────────
  {
    id:         'sky_child',
    name:       'Sky Child',
    flavour:    'Every journey begins beneath the same sky',
    unlockHint: 'Always available',
    category:   'activity',
    emoji:      '☁️',
    color:      '#C8B8E8',
    condition:  { type: 'always', value: 0 },
  },
  {
    id:         'wanderer',
    name:       'Wanderer',
    flavour:    'You stepped into the story and began to write',
    unlockHint: 'Write your first story',
    category:   'activity',
    emoji:      '🌙',
    color:      '#90A8D8',
    condition:  { type: 'story_count', value: 1 },
  },
  {
    id:         'moonlighter',
    name:       'Moonlighter',
    flavour:    'Five chapters, five glimpses of your world',
    unlockHint: 'Write 5 stories',
    category:   'activity',
    emoji:      '🌕',
    color:      '#D8C880',
    condition:  { type: 'story_count', value: 5 },
  },
  {
    id:         'storyweaver',
    name:       'Storyweaver',
    flavour:    'You weave dreams into the fabric of the sky',
    unlockHint: 'Write 10 stories',
    category:   'activity',
    emoji:      '🕸️',
    color:      '#D890C0',
    condition:  { type: 'story_count', value: 10 },
  },
  {
    id:         'chronicle_keeper',
    name:       'Chronicle Keeper',
    flavour:    'Every day deserves to be remembered',
    unlockHint: 'Write 7 journal entries',
    category:   'activity',
    emoji:      '📓',
    color:      '#80C8A0',
    condition:  { type: 'journal_count', value: 7 },
  },
  {
    id:         'memory_keeper',
    name:       'Memory Keeper',
    flavour:    'You hold more memories than the stars can count',
    unlockHint: 'Write 20 journal entries',
    category:   'activity',
    emoji:      '🪐',
    color:      '#A088E0',
    condition:  { type: 'journal_count', value: 20 },
  },
];

/**
 * Compute how many witnesses a user has in total across all their stories.
 */
export function getTotalWitnessed(stories: { witnessedCount: number }[]): number {
  return stories.reduce((sum, s) => sum + (s.witnessedCount ?? 0), 0);
}

/**
 * Returns true if the given title is earned based on the user's current stats.
 */
export function isTitleEarned(
  title: TitleDef,
  stats: {
    totalWitnessed:    number;
    storyCount:        number;
    journalCount:      number;
    constellationStars: number;
  },
): boolean {
  switch (title.condition.type) {
    case 'always':             return true;
    case 'witness_count':      return stats.totalWitnessed    >= title.condition.value;
    case 'story_count':        return stats.storyCount        >= title.condition.value;
    case 'journal_count':      return stats.journalCount      >= title.condition.value;
    case 'constellation_stars':return stats.constellationStars >= title.condition.value;
    default:                   return false;
  }
}
