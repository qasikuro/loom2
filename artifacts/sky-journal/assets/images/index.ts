export const Images = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  character_default: require('./character_default.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  story_bg1: require('./story_bg1.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  story_bg2: require('./story_bg2.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  story_bg3: require('./story_bg3.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  splash: require('./gamejo_splash.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  icon: require('./gamejo_logo.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  logo: require('./gamejo_logo.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  logo_full: require('./gamejo_logo_full.png'),
} as const;

export type ImageKey = keyof typeof Images;
