# Sky Journal

A dreamy, minimalist mobile app inspired by Sky: Children of the Light. Three focused areas: a private journal, a public manga story creator, and a character customisation page with outfit log.

## Architecture

**Monorepo** managed by pnpm workspaces:
- `artifacts/sky-journal` — Expo React Native mobile app (iOS + Android)
- `artifacts/api-server` — Express API server (REST, routes: `/api/character`, `/api/journal-entries`, `/api/stories`, `/api/outfits`)
- `artifacts/mockup-sandbox` — Canvas/design preview server
- `lib/db` — Drizzle ORM + PostgreSQL (schema: character, journal_entries, stories, outfits)
- `lib/api-spec` — OpenAPI 3.1 contract (`openapi.yaml`); run `pnpm --filter @workspace/api-spec run codegen` to regenerate
- `lib/api-client-react` — Generated React Query hooks from OpenAPI
- `lib/api-zod` — Generated Zod schemas from OpenAPI

## Backend (`artifacts/api-server`)

### REST API routes
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/character` | Get character profile (auto-created if missing) |
| PUT    | `/api/character` | Update character profile |
| GET    | `/api/journal-entries` | List all journal entries, newest first |
| POST   | `/api/journal-entries` | Create journal entry (accepts client UUID) |
| DELETE | `/api/journal-entries/:id` | Delete journal entry |
| GET    | `/api/stories` | List all stories, newest first |
| POST   | `/api/stories` | Create story with panels (accepts client UUID) |
| GET    | `/api/stories/:id` | Get single story |
| DELETE | `/api/stories/:id` | Delete story |
| POST   | `/api/stories/:id/witness` | Increment witnessed count |
| GET    | `/api/outfits` | List all outfits, newest first |
| POST   | `/api/outfits` | Create outfit (accepts client UUID) |
| DELETE | `/api/outfits/:id` | Delete outfit |

### Database schema (Drizzle ORM, PostgreSQL)
- `character` — id (int PK=1), name, bio, mood, traits (jsonb), is_public, updated_at
- `journal_entries` — id (uuid), type (diary|friend|moment), text, mood, image_uri, friend_name, date, created_at
- `stories` — id (uuid), chapter_title, mood, location, is_public, witnessed_count, saved_count, panels (jsonb), date, created_at
- `outfits` — id (uuid), name, description, image_uri, tags (jsonb), is_public, date, created_at

To push schema changes: `cd lib/db && pnpm run push`

## Sky Journal App (`artifacts/sky-journal`)

### Tech Stack
- Expo SDK 54 + Expo Router (file-based navigation)
- React Native 0.81
- `@clerk/expo` for authentication (Replit-managed Clerk, email/password)
- `@expo-google-fonts/inter` for typography
- `expo-linear-gradient` for sky gradients
- `expo-image-picker` for panel/outfit/journal image selection
- `@react-native-async-storage/async-storage` for persistence
- `@tanstack/react-query` for data management
- `react-native-keyboard-controller` for keyboard handling

### Navigation Structure
```
app/
  _layout.tsx                — Root stack (ClerkProvider, fonts, providers, modal routes)
  (auth)/
    _layout.tsx              — Auth stack (unauthenticated routes)
    sign-in.tsx              — Sign-in screen (email + password, Sky Journal themed)
    sign-up.tsx              — Sign-up screen (email + password + email verification)
  (tabs)/
    _layout.tsx              — Tab bar: guards auth, redirects to sign-in if not logged in
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
JournalEntry { id, date, type, text, mood, imageUri?, friendName? } // always private
Story        { id, date, chapterTitle, panels[], mood,
               location, isPublic, witnessedCount, savedCount }
StoryPanel   { id, imageUri?, text }
Outfit       { id, date, name, description, imageUri?,
               tags[], isPublic }
Character    { name, bio, mood, traits[], isPublic }
DiscoverPost { authorName, chapterTitle, panels[], vibe, ... }
```

### Data Persistence Strategy
- **Primary**: REST API → PostgreSQL (via `artifacts/api-server`)
- **Fallback**: AsyncStorage (offline cache, auto-populated after each successful API fetch)
- **API URL**: Resolved at Expo bundle time from `REPLIT_DEV_DOMAIN` via `app.config.ts` → `Constants.expoConfig.extra.apiUrl`
- AsyncStorage cache keys: `character_v2`, `stories_v1`, `journal_v2`, `outfits_v1`
- All mutations: optimistic local update → fire-and-forget API sync in background

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
