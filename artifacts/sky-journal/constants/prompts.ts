export type PromptMood = 'Soft' | 'Dreamy' | 'Chaotic' | 'Peaceful' | 'Hopeful' | 'Lonely' | 'Romantic' | 'Adventurous' | 'general';

export interface DailyPrompt {
  text: string;
  mood: PromptMood;
}

export const PROMPTS: DailyPrompt[] = [
  // Soft
  { text: 'What small thing brought you comfort today?', mood: 'Soft' },
  { text: 'Describe a texture that felt like home.', mood: 'Soft' },
  { text: 'What are you carrying that you could gently set down?', mood: 'Soft' },
  { text: 'Write about a moment of unexpected kindness — given or received.', mood: 'Soft' },
  { text: 'What does your heart feel heavy about right now?', mood: 'Soft' },
  { text: 'Describe the softest part of your day.', mood: 'Soft' },
  { text: 'What would you tell yourself if you were someone who loved you?', mood: 'Soft' },
  { text: 'What fear felt a little smaller today?', mood: 'Soft' },

  // Dreamy
  { text: 'If you could live inside any dream you\'ve had, which one would it be?', mood: 'Dreamy' },
  { text: 'Describe a world that lives only in your imagination.', mood: 'Dreamy' },
  { text: 'What does your ideal morning feel like — in perfect, impossible detail?', mood: 'Dreamy' },
  { text: 'Write about a memory that feels more like a dream now.', mood: 'Dreamy' },
  { text: 'What colour is your mood today? Describe its texture, its smell.', mood: 'Dreamy' },
  { text: 'Describe a smell that takes you somewhere far away.', mood: 'Dreamy' },
  { text: 'If the sky could speak, what would it say to you tonight?', mood: 'Dreamy' },
  { text: 'Write down the last dream you remember, even just fragments.', mood: 'Dreamy' },

  // Chaotic
  { text: 'What is swirling in your head right now? Just let it out.', mood: 'Chaotic' },
  { text: 'Something changed today. What was it?', mood: 'Chaotic' },
  { text: 'Name three things you want to burn and three things you want to build.', mood: 'Chaotic' },
  { text: 'Write the angriest, most honest sentence you\'ve been holding back.', mood: 'Chaotic' },
  { text: 'What truth are you afraid to say out loud?', mood: 'Chaotic' },
  { text: 'What are you avoiding thinking about?', mood: 'Chaotic' },
  { text: 'Write about a moment where everything felt like too much.', mood: 'Chaotic' },
  { text: 'What are you becoming — even when it feels messy?', mood: 'Chaotic' },

  // Peaceful
  { text: 'Describe the sky outside your window right now.', mood: 'Peaceful' },
  { text: 'What would your perfect quiet evening look like?', mood: 'Peaceful' },
  { text: 'What does silence feel like to you today?', mood: 'Peaceful' },
  { text: 'Write about a place where you feel completely yourself.', mood: 'Peaceful' },
  { text: 'What are you grateful for that you rarely mention?', mood: 'Peaceful' },
  { text: 'Describe a moment of stillness you found today — even a small one.', mood: 'Peaceful' },
  { text: 'What does home feel like to you?', mood: 'Peaceful' },
  { text: 'Write about something ordinary that felt extraordinary today.', mood: 'Peaceful' },

  // Hopeful
  { text: 'What would make tomorrow feel magical?', mood: 'Hopeful' },
  { text: 'What are you learning about yourself lately?', mood: 'Hopeful' },
  { text: 'What do you want more of in your life?', mood: 'Hopeful' },
  { text: 'What does the version of you from a year ago need to hear?', mood: 'Hopeful' },
  { text: 'Name something you did today that took courage.', mood: 'Hopeful' },
  { text: 'What are you becoming — slowly, quietly, beautifully?', mood: 'Hopeful' },
  { text: 'What story would you tell about today in ten years?', mood: 'Hopeful' },
  { text: 'What chapter of your life are you writing right now?', mood: 'Hopeful' },

  // Lonely
  { text: 'Who do you wish you could call right now?', mood: 'Lonely' },
  { text: 'Write a letter to someone you miss.', mood: 'Lonely' },
  { text: 'What kind of company does your heart want today?', mood: 'Lonely' },
  { text: 'Describe a moment you felt truly seen by someone.', mood: 'Lonely' },
  { text: 'What would it feel like to stop waiting for someone to notice?', mood: 'Lonely' },
  { text: 'Write about a connection that shaped who you are.', mood: 'Lonely' },

  // Romantic
  { text: 'Describe the way light falls in your favourite place.', mood: 'Romantic' },
  { text: 'Write about someone who makes ordinary moments feel significant.', mood: 'Romantic' },
  { text: 'What would you create if no one was watching?', mood: 'Romantic' },
  { text: 'Write about a song that felt like it was written for you.', mood: 'Romantic' },
  { text: 'Describe a kindness that stayed with you long after it happened.', mood: 'Romantic' },

  // Adventurous
  { text: 'What would you do if you knew you couldn\'t fail?', mood: 'Adventurous' },
  { text: 'Write about a decision that changed your direction.', mood: 'Adventurous' },
  { text: 'What are you still curious about, even after everything?', mood: 'Adventurous' },
  { text: 'Describe a moment where you surprised yourself.', mood: 'Adventurous' },
  { text: 'What is the next small brave thing you could do?', mood: 'Adventurous' },

  // General
  { text: 'What made you feel alive today?', mood: 'general' },
  { text: 'Write the first three words that come to mind right now.', mood: 'general' },
  { text: 'What sound best captures your mood today?', mood: 'general' },
  { text: 'What do you want to remember about this exact moment?', mood: 'general' },
  { text: 'Describe a moment of unexpected beauty you noticed today.', mood: 'general' },
  { text: 'What are you made of today?', mood: 'general' },
  { text: 'Write one sentence that is completely, uncomplicatedly true.', mood: 'general' },
  { text: 'What does your body need that your mind keeps ignoring?', mood: 'general' },
  { text: 'What do you want to let go of before the day ends?', mood: 'general' },
];

const MOOD_ALIASES: Record<string, PromptMood> = {
  Joyful:     'Hopeful',
  Grateful:   'Soft',
  Romantic:   'Romantic',
  Adventurous:'Adventurous',
  Lonely:     'Lonely',
  Soft:       'Soft',
  Dreamy:     'Dreamy',
  Chaotic:    'Chaotic',
  Peaceful:   'Peaceful',
  Hopeful:    'Hopeful',
};

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff  = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

export function getDailyPrompt(userMood?: string | null): DailyPrompt {
  const today = new Date();
  const seed  = dayOfYear(today);

  const moodKey = userMood ? MOOD_ALIASES[userMood] : undefined;

  let pool: DailyPrompt[];
  if (moodKey && seed % 3 !== 0) {
    const moodPool = PROMPTS.filter(p => p.mood === moodKey);
    pool = moodPool.length >= 3 ? moodPool : [...moodPool, ...PROMPTS.filter(p => p.mood === 'general')];
  } else {
    pool = PROMPTS;
  }

  return pool[seed % pool.length]!;
}
