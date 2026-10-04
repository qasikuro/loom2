export interface StorigamSticker {
  /** Persist this key, never Metro's device-specific asset number. */
  id: string;
  label: string;
  source: number;
}

export const STORIGAM_STICKERS: readonly StorigamSticker[] = [
  { id: 'storigam-sticker:01_anger_mark', label: 'Anger mark', source: require('./01_anger_mark.png') },
  { id: 'storigam-sticker:01_exclamation', label: 'Surprise burst', source: require('./01_exclamation.png') },
  { id: 'storigam-sticker:01_gloom_lines', label: 'Gloom lines', source: require('./01_gloom_lines.png') },
  { id: 'storigam-sticker:01_impact_burst', label: 'Stress lines', source: require('./01_impact_burst.png') },
  { id: 'storigam-sticker:01_steam_puff', label: 'Steam puff', source: require('./01_steam_puff.png') },
  { id: 'storigam-sticker:01_stress_lines', label: 'Sweat drops', source: require('./01_stress_lines.png') },
  { id: 'storigam-sticker:01_surprise_burst', label: 'Exclamation burst', source: require('./01_surprise_burst.png') },
  { id: 'storigam-sticker:01_sweat_drop', label: 'Sweat drop', source: require('./01_sweat_drop.png') },
  { id: 'storigam-sticker:02_dust_cloud', label: 'Dust cloud', source: require('./02_dust_cloud.png') },
  { id: 'storigam-sticker:02_slash_marks', label: 'Slash marks', source: require('./02_slash_marks.png') },
  { id: 'storigam-sticker:02_sparkles', label: 'Sparkles', source: require('./02_sparkles.png') },
  { id: 'storigam-sticker:02_speed_lines', label: 'Speed accents', source: require('./02_speed_lines.png') },
  { id: 'storigam-sticker:02_spiral', label: 'Motion accents', source: require('./02_spiral.png') },
  { id: 'storigam-sticker:02_thought_cloud', label: 'Thought cloud', source: require('./02_thought_cloud.png') },
  { id: 'storigam-sticker:02_white_burst', label: 'White burst', source: require('./02_white_burst.png') },
  { id: 'storigam-sticker:02_yellow_burst', label: 'Yellow burst', source: require('./02_yellow_burst.png') },
  { id: 'storigam-sticker:03_black_thought', label: 'Sleep Zzz', source: require('./03_black_thought.png') },
  { id: 'storigam-sticker:03_crying_eyes', label: 'Broken heart', source: require('./03_crying_eyes.png') },
  { id: 'storigam-sticker:03_exclamation_marks', label: 'Exclamation accents', source: require('./03_exclamation_marks.png') },
  { id: 'storigam-sticker:03_hearts_blush', label: 'Love hearts', source: require('./03_hearts_blush.png') },
  { id: 'storigam-sticker:03_question_marks', label: 'Question accents', source: require('./03_question_marks.png') },
  { id: 'storigam-sticker:03_shock_rays', label: 'Idea lightbulb', source: require('./03_shock_rays.png') },
  { id: 'storigam-sticker:03_single_drop', label: 'Heart accent', source: require('./03_single_drop.png') },
  { id: 'storigam-sticker:03_sparkle_pair', label: 'Music notes', source: require('./03_sparkle_pair.png') },
  { id: 'storigam-sticker:04_black_burst', label: 'Rash!', source: require('./04_black_burst.png') },
  { id: 'storigam-sticker:04_broken_heart', label: 'Whoosh!', source: require('./04_broken_heart.png') },
  { id: 'storigam-sticker:04_idea_lightbulb', label: 'Gasp!', source: require('./04_idea_lightbulb.png') },
  { id: 'storigam-sticker:04_impact_lines', label: 'Hmph!', source: require('./04_impact_lines.png') },
  { id: 'storigam-sticker:04_love_hearts', label: 'Pow!', source: require('./04_love_hearts.png') },
  { id: 'storigam-sticker:04_motion_rays', label: 'Aww!', source: require('./04_motion_rays.png') },
  { id: 'storigam-sticker:04_music_notes', label: 'Bam!', source: require('./04_music_notes.png') },
  { id: 'storigam-sticker:04_sleep_zzz', label: 'Wow!', source: require('./04_sleep_zzz.png') },
];

const stickersById = new Map(STORIGAM_STICKERS.map(sticker => [sticker.id, sticker]));

export function getStorigamSticker(content: string): StorigamSticker | undefined {
  return stickersById.get(content);
}