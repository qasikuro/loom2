export const Images = {
  character_default: require('./character_default.png'),
  story_bg1: require('./story_bg1.png'),
  story_bg2: require('./story_bg2.png'),
  story_bg3: require('./story_bg3.png'),
  splash: require('./splash.png'),
  icon: require('./icon.png'),
} as const;

export type ImageKey = keyof typeof Images;
