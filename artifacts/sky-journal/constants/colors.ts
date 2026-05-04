const colors = {
  light: {
    text: '#C8B8E8',
    tint: '#8B7AB5',
    background: '#0F0D1E',
    foreground: '#EDE8FF',
    card: '#1C1840',
    cardForeground: '#EDE8FF',
    primary: '#8B7AB5',
    primaryForeground: '#FFFFFF',
    secondary: '#251E48',
    secondaryForeground: '#EDE8FF',
    muted: 'rgba(255,255,255,0.07)',
    mutedForeground: 'rgba(200,184,232,0.55)',
    accent: '#C8A84B',
    accentForeground: '#EDE8FF',
    destructive: '#E05568',
    destructiveForeground: '#FFFFFF',
    border: 'rgba(200,184,232,0.12)',
    input: 'rgba(255,255,255,0.07)',
    night: '#0F0D1E',
    skyBlue: '#B8D4F0',
    lavender: '#C8B8E8',
    gold: '#C8A84B',
    glowPurple: 'rgba(139,122,181,0.25)',
    glowGold: 'rgba(200,168,75,0.28)',
    overlay: 'rgba(10,8,28,0.6)',
    tabBar: '#1A1738',
  },
  radius: 18,
};

export default colors;

/** Reusable card shadow tokens */
export const SHADOW = {
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 2,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 9,
    elevation: 4,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.65,
    shadowRadius: 16,
    elevation: 8,
  },
  lg: {
    shadowColor: '#8B7AB5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 14,
  },
} as const;
