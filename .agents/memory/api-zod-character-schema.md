---
name: ApiCharacterSchema partial fix
description: The generated character Zod schema required id:number but the DB uses userId (text) — without .partial() every character fetch silently fell back to DEFAULT_CHARACTER.
---

## Rule
`ApiCharacterSchema` in `lib/api-zod/src/index.ts` must use `.partial().passthrough()`, not just `.passthrough()`.

## Why
The auto-generated `GetCharacterResponse` schema includes `id: zod.number()`. The `character` DB table has no numeric `id` — its primary key is `userId` (text). Without `.partial()`, every `GET /character` response fails Zod validation inside `parseOrDefault`, returns `null`, and `loadData` falls back to `DEFAULT_CHARACTER`, silently overwriting the user's real saved name, avatar, username, etc. on every sign-in.

Journal entries were unaffected because their `id` is a string UUID matching `id: zod.string()` in the list schema.

## How to apply
Any time the OpenAPI spec is regenerated (`orval`), immediately audit `GetCharacterResponse` in the generated output. If it adds required fields that the real server response doesn't include, override them with `.partial()` in the hand-written `index.ts` layer. Never rely on the raw generated schema for an endpoint whose DB primary key type doesn't match the spec.
