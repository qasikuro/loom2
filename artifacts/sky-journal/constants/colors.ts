const colors = {
  light: {
    text:                '#C8B8E8',
    tint:                '#7856FF',
    background:          '#080714',
    foreground:          '#FFFFFF',
    card:                '#130F28',
    cardForeground:      '#FFFFFF',
    primary:             '#7856FF',
    primaryForeground:   '#FFFFFF',
    secondary:           '#1C1840',
    secondaryForeground: '#FFFFFF',
    muted:               'rgba(255,255,255,0.05)',
    mutedForeground:     'rgba(255,255,255,0.45)',
    accent:              '#F0C040',
    accentForeground:    '#FFFFFF',
    destructive:         '#E05568',
    destructiveForeground: '#FFFFFF',
    border:              'rgba(255,255,255,0.09)',
    input:               'rgba(255,255,255,0.06)',
    night:               '#080714',
    skyBlue:             '#B8D4F0',
    lavender:            '#C8B8E8',
    gold:                '#F0C040',
    glowPurple:          'rgba(120,86,255,0.28)',
    glowGold:            'rgba(240,192,64,0.28)',
    overlay:             'rgba(8,7,20,0.7)',
    tabBar:              '#0E0B1E',
  },
  radius: 20,
};

export default colors;

/** Reusable card shadow tokens */
export const SHADOW = {
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 2,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 8,
  },
  lg: {
    shadowColor: '#7856FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 14,
  },
} as const;
