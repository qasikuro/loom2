/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#F7F4ED",
      "foreground": "#191727",
      "border": "#D6D0E1",
      "card": "#FCFBF8",
      "cardForeground": "#191727",
      "popover": "#FFFDFC",
      "popoverForeground": "#191727",
      "primary": "#5F3BBA",
      "primaryForeground": "#FFFFFF",
      "secondary": "#EAE5F2",
      "secondaryForeground": "#191727",
      "muted": "#ECE8F3",
      "mutedForeground": "#59566C",
      "accent": "#F4A8C8",
      "accentForeground": "#331A2A",
      "destructive": "#B42222",
      "destructiveForeground": "#FFFFFF",
      "input": "#D9D3E6",
      "ring": "#6B4BD0",
      "chart1": "#9B78FF",
      "chart2": "#F4A8C8",
      "chart3": "#E8B830",
      "chart4": "#6A9BCB",
      "chart5": "#68B8A4",
      "sidebar": "#F2EEE8",
      "sidebarForeground": "#191727",
      "sidebarBorder": "#D6CDE8",
      "sidebarPrimary": "#5F3BBA",
      "sidebarPrimaryForeground": "#FFFFFF",
      "sidebarAccent": "#E9E2F4",
      "sidebarAccentForeground": "#2A2140",
      "sidebarRing": "#6B4BD0"
    },
    "dark": {
      "background": "#0A0818",
      "foreground": "#EDE8FF",
      "border": "#342C49",
      "card": "#130F28",
      "cardForeground": "#EDE8FF",
      "popover": "#17122F",
      "popoverForeground": "#EDE8FF",
      "primary": "#9B78FF",
      "primaryForeground": "#FFFFFF",
      "secondary": "#1C1838",
      "secondaryForeground": "#EDE8FF",
      "muted": "#251F3A",
      "mutedForeground": "#C8B8E8",
      "accent": "#F4A8C8",
      "accentForeground": "#301726",
      "destructive": "#E05568",
      "destructiveForeground": "#FFFFFF",
      "input": "#39304E",
      "ring": "#B8A1FF",
      "chart1": "#9B78FF",
      "chart2": "#F4A8C8",
      "chart3": "#E8B830",
      "chart4": "#B8D4F0",
      "chart5": "#79CBB1",
      "sidebar": "#090718",
      "sidebarForeground": "#EDE8FF",
      "sidebarBorder": "#332A47",
      "sidebarPrimary": "#9B78FF",
      "sidebarPrimaryForeground": "#FFFFFF",
      "sidebarAccent": "#1C1838",
      "sidebarAccentForeground": "#EDE8FF",
      "sidebarRing": "#B8A1FF"
    }
  },
  "fontFamily": {
    "sans": [
      "Satoshi",
      "Inter",
      "sans-serif"
    ],
    "serif": [
      "Georgia",
      "serif"
    ],
    "mono": [
      "Menlo",
      "monospace"
    ]
  },
  "radius": "1.25rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
