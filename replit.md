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

### Authentication
All routes (except `/api/images/*` static files and `/api/health`) are protected by Clerk JWT middleware (`@clerk/express`). Clients must send `Authorization: Bearer <token>` on every request. The token is obtained from Clerk via `useAuth().getToken()` in the Expo app.

### Per-user Data Isolation
Every table has a `user_id text NOT NULL` column. All queries filter by the authenticated user's Clerk `userId`. Each user sees only their own data — journal entries, stories, outfits, and character profile are completely isolated.

### REST API routes
All routes require a valid Clerk JWT.

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/character` | Get character profile (auto-created if missing for user) |
| PUT    | `/api/character` | Update character profile (includes optional `username`) |
| GET    | `/api/users/check-username?username=` | Check if a username is available |
| GET    | `/api/users/search?q=` | Search public profiles by username or name |
| GET    | `/api/journal-entries` | List user's journal entries, newest first |
| POST   | `/api/journal-entries` | Create journal entry (accepts client UUID) |
| DELETE | `/api/journal-entries/:id` | Delete journal entry (own entries only) |
| GET    | `/api/stories` | List user's stories, newest first |
| POST   | `/api/stories` | Create story with panels (accepts client UUID) |
| GET    | `/api/stories/:id` | Get single story (own stories only) |
| DELETE | `/api/stories/:id` | Delete story (own stories only) |
| POST   | `/api/stories/:id/witness` | Increment witnessed count |
| GET    | `/api/outfits` | List user's outfits, newest first |
| POST   | `/api/outfits` | Create outfit (accepts client UUID) |
| DELETE | `/api/outfits/:id` | Delete outfit (own outfits only) |
| POST   | `/api/upload` | Upload image (base64 → file, requires auth) |
| POST   | `/api/follows/:targetUserId` | Follow a user |
| DELETE | `/api/follows/:targetUserId` | Unfollow a user |
| GET    | `/api/follows/following` | Get list of user IDs I follow |
| GET    | `/api/discover` | Ranked discovery feed (public stories from other users) |

#### Discovery Algorithm (`/api/discover`)
Score per story = `(isFollowing × 4) + (moodMatch × 2) + min(2, engagement/25) + max(0, 1 − days_old/30)`
- Returns top 50 scored stories from the last 200 public stories (excluding own)
- Joined with character table for author name/username

### Database schema (Drizzle ORM, PostgreSQL)
- `character` — user_id (text PK), **username** (text UNIQUE nullable), name, bio, mood, traits (jsonb), is_public, updated_at
- `follows` — follower_id (text), following_id (text), created_at — composite PK (follower_id, following_id)
- `journal_entries` — id (uuid PK), user_id (text, indexed), type (diary|friend|moment), text, mood, image_uri, friend_name, date, created_at
- `stories` — id (uuid PK), user_id (text, indexed), chapter_title, mood, location, is_public, witnessed_count, saved_count, panels (jsonb), date, created_at
- `outfits` — id (uuid PK), user_id (text, indexed), name, description, image_uri, tags (jsonb), is_public, date, created_at

To push schema changes: `cd lib/db && pnpm run push`

### Middleware
- `artifacts/api-server/src/middleware/auth.ts` — `clerkAuth` (applied globally in app.ts), `requireAuth` (per-route guard), `getUserId` (extract userId from verified token)

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
  _layout.tsx                — Root stack (ClerkProvider, fonts, providers, AuthTokenBridge, modal routes)
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

### Auth Token Flow
- `app/_layout.tsx` contains `AuthTokenBridge` component (inside `AppProvider`)
- `AuthTokenBridge` watches Clerk's `isLoaded` + `isSignedIn` state
- Once Clerk is loaded and user is signed in, it calls `setAuthTokenGetter(fn)` (module-level in `AppContext`) to register the token getter
- It then calls `reloadData()` to fetch fresh user-specific data from the API with a valid JWT
- All API calls in `AppContext.apiFetch` automatically include `Authorization: Bearer <token>`
- On sign-out, the token getter is reset to return null

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
- Editable **@username** handle (inline, validated: `^[a-z0-9_]{3,20}$`, checks availability via API before saving)
- Attribute trait chips (add/remove, autocomplete suggestions)
- Profile visibility toggle: public or private
- Outfit Log: grid of dated outfit cards, each with photo, name, vibe tags, visibility

#### 4. Discover (`discover.tsx`)
- **For You** tab: ranked API feed from `/api/discover` (followed authors, mood match, engagement, recency)
- **New** tab: same feed sorted by date
- **Vibes** tab: filter by mood category (Soft, Lonely, Romantic, Chaotic, Peaceful, Adventurous, Dreamy, Hopeful)
- **People** tab: debounced search for other users (`/api/users/search`), with Follow/Following toggle button per result
- Follow/unfollow is optimistic (local state updates immediately, API synced in background)
- Discover feed live counts from real public stories; vibes show actual post counts

### Data Model (`context/AppContext.tsx`)
```typescript
JournalEntry { id, date, type, text, mood, imageUri?, friendName? } // always private
Story        { id, date, chapterTitle, panels[], mood,
               location, isPublic, witnessedCount, savedCount }
StoryPanel   { id, imageUri?, text }
Outfit       { id, date, name, description, imageUri?,
               tags[], isPublic }
Character    { name, bio, mood, traits[], isPublic, username? }
DiscoverPost { authorUserId, authorName, authorHandle, chapterTitle,
               panels[], vibe, isFollowing, saved, ... }
```

### Data Persistence Strategy
- **Primary**: REST API → PostgreSQL (via `artifacts/api-server`)
- **Fallback**: AsyncStorage (offline cache, auto-populated after each successful API fetch)
- **API URL**: Resolved at Expo bundle time from `REPLIT_DEV_DOMAIN` via `app.config.ts` → `Constants.expoConfig.extra.apiUrl`
- AsyncStorage cache keys: `character_v2`, `stories_v1`, `journal_v2`, `outfits_v1`, `discover_v1`, `following_v1`
- Load order: AsyncStorage cache first (instant, no auth needed) → then API reload once Clerk token is ready
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

### Tab Bar (Native UI)
- Uses `ClassicTabLayout` with Feather icons for cross-platform compatibility (iOS + Android + Web)
- Floating pill style (borderRadius 28, left/right: 16) — positioned with `position: 'absolute'` + `left/right` rather than `marginHorizontal` for reliability
- BlurView background on iOS (borderRadius 28, overflow: hidden scoped to BlurView), solid `#FDFAF7` on Android
- **NO `overflow: hidden` on the tab bar itself** — allows centre button to visually float above the bar
- Centre Create button: purple circle, 52×52, `marginBottom: 18` to float it above the bar, with `tabBarLabel: () => null`
- Tab labels: Home, Journal, (none), Discover, Profile — "Profile" used instead of "Character" to prevent truncation on narrow screens
- **Feather icon font is explicitly pre-loaded** via `...Feather.font` in `useFonts()` in `_layout.tsx` — required to prevent blank-box icons in Expo Go

### Social Philosophy
- No likes — replaced with "Witnessed" and "Saved"
- No follower counts — soft ambient feedback only
- No algorithmic pressure — calm aesthetic discovery

## Admin Events System

### Database (`lib/db/src/schema/events.ts`)
- `events` table: id (uuid PK), title, description, theme (spring|summer|autumn|winter|special), status (draft|active|ended), startsAt, endsAt, inventory (jsonb), aiPrompt, createdBy, createdAt

### API routes (admin-only, `artifacts/api-server/src/routes/admin-events.ts`)
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/admin/events` | List all events |
| POST   | `/api/admin/events` | Create event |
| PUT    | `/api/admin/events/:id` | Update event |
| DELETE | `/api/admin/events/:id` | Delete event |
| POST   | `/api/admin/events/generate-inventory` | AI (Claude) generates themed inventory |
| POST   | `/api/admin/events/:id/grant` | Grant inventory to all users |

### AI inventory generation
- Uses Anthropic (same Claude integration as `drift.ts`)
- Prompt includes event title, description, theme + optional admin note
- Returns 4–7 inventory items: stars / aura / memory shards / cosmetic items
- Admin can edit generated items before saving

### Grant mechanics
- Currency (stars/aura/shards): upserted into `user_rewards` (increment existing balances)
- Cosmetic items: inserted into `user_purchases` with `onConflictDoNothing` (skip if already owned)
- Two-tap confirm guard in admin UI before irreversible grant

### Admin Events page (`artifacts/admin/src/pages/EventsPage.tsx`)
- List view grouped by status: Active → Drafts → Ended
- Create/Edit form: title, description, theme, date range, status, inventory editor
- "Generate with AI" button + optional extra context field
- Per-item inline editor (type selector, amount/id/name fields)
- "Grant to All Users" button with inline confirm → shows result summary

## Generated Assets
- `assets/images/icon.png` — App icon (dreamy Sky Kid character)
- `assets/images/splash.png` — Splash screen (floating island scene)
- `assets/images/character_default.png` — Default character avatar
- `assets/images/story_bg1/2/3.png` — Sample story panel backgrounds

## Important Notes
- `Alert.alert` does NOT work in Expo Web iframe — use inline two-tap confirm pattern everywhere
- Image upload: pick → base64 → POST /api/upload (50mb limit) → returns `{ path: '/api/images/filename' }`
- Pre-existing TS errors in `utils/persistImage.ts` (expo-file-system types) — not from our changes, safe to ignore
- Deprecation warnings (`shadow*`, `textShadow*`) are React Native Web warnings from third-party packages — not errors, cannot be fixed
- The remaining `props.pointerEvents is deprecated` warning in browser console comes from expo-linear-gradient internals — all our own code now uses `style={{ pointerEvents: 'none' }}`
- `topPad`: `Platform.OS === 'web' ? 48 : insets.top`
- Tab bar `pillBottom = Math.max(insets.bottom, 8) + 8` (sits 8 px above the home bar on iPhone X+)
