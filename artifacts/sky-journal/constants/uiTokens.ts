/**
 * Shared layout and type rhythm for polished, readable mobile surfaces.
 * Keep product colors and branded font choices in the theme and screen styles.
 */
export const UI = {
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    control: 14,
    card: 20,
    sheet: 28,
    pill: 999,
  },
  type: {
    supporting: 13,
    body: 15,
    cardTitle: 17,
    screenTitle: 26,
  },
  minTapTarget: 44,
} as const;
