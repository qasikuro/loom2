# Sky Journal

A dreamy, minimalist mobile app inspired by Sky: Children of the Light. A personal character journal where users create a "Sky Kid" character, build multi-panel manga stories, and discover others' stories in a calm, non-competitive feed.

## Architecture

**Monorepo** managed by pnpm workspaces:
- `artifacts/sky-journal` — Expo React Native mobile app (iOS + Android)
- `artifacts/api-server` — Express API server
- `artifacts/mockup-sandbox` — Canvas/design preview server

## Sky Journal App (`artifacts/sky-journal`)

### Tech Stack
- Expo SDK 54 + Expo Router (file-based navigation)
- React Native 0.81
- `@expo-google-fonts/inter` for typography
- `expo-linear-gradient` for sky gradients
- `expo-image-picker` for panel image selection
- `@react-native-async-storage/async-storage` for persistence
- `@tanstack/react-query` for data management
- `react-native-keyboard-controller` for keyboard handling

### Navigation Structure
```
app/
  _layout.tsx          — Root stack (fonts, providers)
  (tabs)/
    _layout.tsx        — Tab bar (Home, Log, Create, Discover, Profile)
    index.tsx          — Character Home Screen
    log.tsx            — Daily Journal (log entries list)
    create.tsx         — Manga Chapter Builder (multi-panel)
    discover.tsx       — Discover Feed (For You / Vibes / Stories)
    profile.tsx        — Profile / Character Page
  story/
    [id].tsx           — Immersive Manga Story Reader
```

### Key Components
- `components/MangaPanelEditor.tsx` — Per-panel editor (image + narration)
- `components/LogCard.tsx` — Journal entry card with panel thumbnails
- `components/DiscoverCard.tsx` — Discover feed card
- `components/MoodBadge.tsx` — Mood indicator with icon
- `components/TraitTag.tsx` — Character trait pill
- `components/RewardBanner.tsx` — Reward notification card
- `components/GradientSky.tsx` — Time-aware sky gradient

### Data Model (`context/AppContext.tsx`)
```typescript
StoryPanel { id, imageUri?, text }
LogEntry   { id, date, chapterTitle, panels[], mood, location, isPublic, witnessedCount, savedCount }
Character  { name, bio, mood, traits[], stats... }
DiscoverPost { authorName, chapterTitle, panels[], vibe, ... }
```

### Design System (`constants/colors.ts`)
- Palette: lavender `#C8B8E8`, sky blue `#B8D4F0`, warm gold `#F0D080`
- Background: soft cream `#F8F4EE`
- Primary: muted purple `#6B5B95`
- Night sky: deep navy `#1A1630`
- Time-aware sky gradient: dawn / day / dusk / night

### Core Features
1. **Character Home** — Sky Kid avatar with glow rings, traits, stats, time-aware sky background
2. **Manga Creator** — Build multi-panel stories (up to 12 panels), each with an image + narration
3. **Story Reader** — Full-screen immersive manga reading, panel-by-panel with text overlays
4. **Journal Log** — Personal timeline of all created chapters
5. **Discover** — Soft social feed with Vibes grid (Soft/Lonely/Romantic/Chaotic/Peaceful/Adventurous)
6. **Profile** — Character page with Stories/Outfits/Saved tabs
7. **Rewards** — "Witnessed", "Saved" instead of likes

### Social Philosophy
- No likes — replaced with "Witnessed" and "Saved"
- No follower counts — soft "Witnessed by X today" feedback
- No algorithmic pressure — calm aesthetic discovery

## Generated Assets
- `assets/images/icon.png` — App icon (dreamy Sky Kid character)
- `assets/images/splash.png` — Splash screen (floating island scene)
- `assets/images/character_default.png` — Default character avatar
- `assets/images/story_bg1/2/3.png` — Sample story panel backgrounds
