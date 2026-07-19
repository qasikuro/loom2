# Threat Model

## Project Overview

Sky Journal is a publicly deployed mobile-first social journaling application built from a pnpm monorepo. The production attack surface is centered on `artifacts/api-server` (Express + Clerk JWT auth + PostgreSQL via Drizzle), the Expo client in `artifacts/sky-journal`, and the admin console in `artifacts/admin`. The system stores private journal entries, semi-public social profiles, public stories and outfits, direct messages, moderation data, and reward state.

Production assumptions for this repo:
- `NODE_ENV` is `production` in deployed environments.
- Replit terminates TLS for deployed traffic.
- `artifacts/mockup-sandbox` is development-only and should be ignored unless future scans show production reachability.
- The deployment is public, so internet attackers can reach every public and authenticated HTTP endpoint.

## Assets

- **User accounts and Clerk identities** — a valid Clerk session lets a caller act as a user across all protected API routes.
- **Private user content** — journal entries, drafts, messages, notifications, gallery photos, and profile metadata must remain scoped to the owning user.
- **Public community content** — stories, outfits, guides, follows, stickers, and discovery data must resist tampering, moderation bypass, and impersonation.
- **Administrative authority** — admin status enables bans, content deletion, event grants, and access to moderation/reporting data.
- **Reward and entitlement state** — titles, cosmetics, balances, and unlock progress must only change through server-enforced rules.
- **Uploaded media and object storage references** — image paths and file-serving logic must not expose arbitrary files or unsafe object access.
- **Secrets and third-party credentials** — Clerk keys, database credentials, object storage access, and Anthropic credentials must stay server-side.

## Trust Boundaries

- **Client → API** — the Expo app and admin SPA are untrusted. Every profile field, identifier, visibility flag, and entitlement claim must be validated server-side.
- **API → PostgreSQL** — the API has broad write access to user, admin, moderation, and reward data. Authorization mistakes here become durable state corruption.
- **API → Clerk** — Clerk assertions define authenticated identity; the app must not grant higher privilege based only on frontend state.
- **API → object storage / local upload fallback** — file names and media paths cross into filesystem and bucket access logic.
- **Authenticated user → admin** — this is the highest-risk privilege boundary in the application.
- **Authenticated user → moderated/banned user** — bans are meant to change what an already-authenticated account may still do.
- **Public / authenticated / admin surfaces** — public endpoints expose limited configuration and content; authenticated routes expose user state; admin routes expose moderation and full-user management.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/index.ts`, `artifacts/admin/src/App.tsx`, `artifacts/sky-journal/context/AppContext.tsx`.
- **Highest-risk server areas:** `src/middleware/auth.ts`, `src/routes/admin.ts`, `src/routes/character.ts`, `src/routes/social.ts`, `src/routes/stories.ts`, `src/routes/messages.ts`, `src/routes/upload.ts`, `src/routes/stream.ts`.
- **Public surfaces:** `/api/health*`, `/api/images/:filename`, `/api/admin/config`, `/api/events/active` plus deployment-hosted client bundles.
- **Authenticated surfaces:** most `/api/*` social, profile, upload, reward, campfire, message, notification, and report routes.
- **Admin surfaces:** `/api/admin/*`, `/api/admin/events/*`, `/api/admin/profile-effects/*`.
- **Usually ignore unless reachability changes:** `artifacts/mockup-sandbox`, tests, generated preview-only servers, and scanner findings in generated web-serving code already constrained by root-path checks.

## Threat Categories

### Spoofing

The main spoofing risks are forged user identity, forged elevated status, and forged public-facing profile signals. The system must accept identity only from verified Clerk tokens, and user-editable profile fields must not be treated as proof of earned or privileged status. Public profile metadata shown to other users must come from server-controlled entitlement state when the field represents trust or achievement.

### Tampering

Clients can update large parts of profile, story, outfit, and social state. Server-side rules must enforce ownership on every mutation and must reject client attempts to set fields that should only be derived from trusted workflows, such as rewards, moderation state, and admin-only flags. Object references and uploaded media paths must also be normalized before storage or reuse.

### Information Disclosure

The app stores private journals, messages, notification state, and user metadata. Every read and delete path must scope records to the authenticated owner, and public profile/story views must expose only content intended for community visibility. Error responses and logs must not leak secrets or unnecessary internal details.

### Denial of Service

The API is publicly reachable and supports image upload, AI-backed admin features, SSE streams, and chat-like message flows. Expensive endpoints need bounded input sizes, timeouts, and abuse resistance. Rate limits exist globally, but sensitive flows should still be reviewed for per-feature abuse paths if traffic or moderation pressure increases.

### Elevation of Privilege

The most important guarantees in this project are at the authenticated-user/admin boundary and the active-user/banned-user boundary. No authenticated user should be able to self-bootstrap into admin after deployment without an out-of-band trust check, and a banned account must be blocked consistently by shared authz middleware rather than hidden only from discovery queries. Reward, title, and other entitlement-bearing fields must also be writable only through server-validated unlock flows.
