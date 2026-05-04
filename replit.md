# Sky Journal

A dreamy, minimalist mobile app inspired by Sky: Children of the Light. Three focused areas: a private journal, a public manga story creator, and a character customisation page with outfit log.

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
- `expo-image-picker` for panel/outfit/journal image selection
- `@react-native-async-storage/async-storage` for persistence
- `@tanstack/react-query` for data management
- `react-native-keyboard-controller` for keyboard handling

### Navigation Structure
```
app/
  _layout.tsx                — Root stack (fonts, providers, modal routes)
  (tabs)/
    _layout.tsx              — Tab bar: Home | Journal | + | Discover | Character
    index.tsx                — Home: sky hero, quick actions, recent entries
    log.tsx                  — Journal: private diary entries (always private)
    create.tsx               — Create: direct manga panel builder (public stories)
    discover.tsx             — Discover: soft social feed
    profile.tsx              — Character: name/bio/traits + outfit log
  story/
    [id].tsx                 — Immersive manga story reader
  create-journal-entry.tsx   — Modal: private journal entry form
  create-outfit.tsx          — Modal: outfit log form with image picker
```

### Three Core Areas

#### 1. Journal (`log.tsx` + `create-journal-entry.tsx`)
- Always private — no visibility toggle
- Simple entries: text + mood + optional photo
- Daily writing prompt rotates each day
- Clean JournalCard component (italic text + mood badge + optional thumbnail)

#### 2. Stories (`create.tsx` + `story/[id].tsx`)
- Public by default — can be toggled private
- Manga-style multi-panel chapters (up to 12 panels)
- Each panel: full-bleed image + narration text overlay
- Story reader: immersive full-screen manga viewer with "Witness" instead of like

#### 3. Character (`profile.tsx` + `create-outfit.tsx`)
- Editable name + bio (inline tap-to-edit)
- Attribute trait chips (add/remove, autocomplete suggestions)
- Profile visibility toggle: public or private
- Outfit Log: grid of dated outfit cards, each with photo, name, vibe tags, visibility

### Data Model (`context/AppContext.tsx`)
```typescript
JournalEntry { id, date, text, mood, imageUri? }            // always private
Story        { id, date, chapterTitle, panels[], mood,
               location, isPublic, witnessedCount, savedCount }
StoryPanel   { id, imageUri?, text }
Outfit       { id, date, name, description, imageUri?,
               tags[], isPublic }
Character    { name, bio, mood, traits[], isPublic }
DiscoverPost { authorName, chapterTitle, panels[], vibe, ... }
```

AsyncStorage keys: `character_v2`, `stories_v1`, `journal_v1`, `outfits_v1`

### Key Components
- `components/MangaPanelEditor.tsx` — Per-panel editor (image + narration)
- `components/JournalCard.tsx` — Private diary entry card
- `components/DiscoverCard.tsx` — Discover feed card
- `components/MoodBadge.tsx` — Mood indicator with icon + color
- `components/TraitTag.tsx` — Character trait pill
- `components/RewardBanner.tsx` — Reward notification ("Witnessed", "Saved")
- `components/GradientSky.tsx` — Time-aware sky gradient

### Design System (`constants/colors.ts`)
- Palette: lavender `#C8B8E8`, sky blue `#B8D4F0`, warm gold `#C8A84B`
- Background: soft cream `#F8F4EE`
- Primary: muted purple `#6B5B95`
- Night sky: deep navy `#1A1630`
- Time-aware sky gradient: dawn / day / dusk / night

### Social Philosophy
- No likes — replaced with "Witnessed" and "Saved"
- No follower counts — soft ambient feedback only
- No algorithmic pressure — calm aesthetic discovery

## Generated Assets
- `assets/images/icon.png` — App icon (dreamy Sky Kid character)
- `assets/images/splash.png` — Splash screen (floating island scene)
- `assets/images/character_default.png` — Default character avatar
- `assets/images/story_bg1/2/3.png` — Sample story panel backgrounds
