const colors = {
  light: {
    text: '#2A2040',
    tint: '#6B5B95',
    background: '#F7F3ED',
    foreground: '#1E1830',
    card: '#FFFFFF',
    cardForeground: '#1E1830',
    primary: '#6B5B95',
    primaryForeground: '#FFFFFF',
    secondary: '#EDE6F6',
    secondaryForeground: '#1E1830',
    muted: '#EDE8F5',
    mutedForeground: '#9A8EB4',
    accent: '#C8A84B',
    accentForeground: '#1E1830',
    destructive: '#DC4F5E',
    destructiveForeground: '#FFFFFF',
    border: '#E2D9EE',
    input: '#EDE8F5',
    night: '#1A1630',
    skyBlue: '#B8D4F0',
    lavender: '#C8B8E8',
    gold: '#C8A84B',
    glowPurple: 'rgba(107, 91, 149, 0.22)',
    glowGold: 'rgba(200, 168, 75, 0.28)',
    overlay: 'rgba(30, 24, 48, 0.45)',
    tabBar: '#FDFAF7',
  },
  radius: 18,
};

export default colors;

/** Reusable card shadow tokens */
export const SHADOW = {
  xs: {
    shadowColor: '#1E1830',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  sm: {
    shadowColor: '#1E1830',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  md: {
    shadowColor: '#1E1830',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  lg: {
    shadowColor: '#6B5B95',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
