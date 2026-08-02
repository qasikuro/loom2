# GameJo Admin Panel — Gap Analysis
*Generated: August 2, 2026*

---

## What's Already Built ✅

| Section | What Exists |
|---|---|
| **Dashboard** | Total users, new signups (30d), banned users, admin count, total stories/outfits/journals/stickers, pending reports, quick-links |
| **User Management** | Search, paginated list, view profile drawer, ban/unban, promote/demote admin, delete user (cascade), gallery limit adjustment |
| **Content Moderation** | Stories + outfits list, filter by author/date, preview panels, hide/unhide from public feed, delete, sticker activity log |
| **Events** | Full CRUD, theme/schedule, AI reward generator (Claude), grant rewards to all users, push notification on grant |
| **Profile Effects** | Full CRUD, live animation preview, rarity/cost, active toggle, AI animation config generator |
| **Reports** | Moderation queue, filter by status, resolve/dismiss/delete |

---

## What's Missing ❌

### 1. Dashboard Gaps (Small)
| Missing | Notes |
|---|---|
| Daily active users (DAU) | Needs session tracking in DB |
| Stories created today | Simple query, just not shown |
| Characters created today | Simple query |
| Server status indicator | Health check endpoint exists at /api/healthz |

---

### 2. User Management Gaps (Medium)
| Missing | Notes |
|---|---|
| Suspend for X days | Has permanent ban only; timed suspension needs a `bannedUntil` column |
| Give/remove beta access | Needs a `betaTester` flag (Clerk metadata or DB) |
| Verify creator badge | Needs a `verified` flag + badge display in app |
| Reset user data | Delete all content but keep account |
| Warning history log | Per-user list of admin actions taken |

---

### 3. Stories Admin Gaps (Small-Medium)
| Missing | Notes |
|---|---|
| Feature a story | Pin to top of Discover feed |
| Pin stories | Similar to feature but persistent |
| Restore deleted story | Needs soft-delete (currently hard delete) |
| Search by tags | Tags exist in DB but admin search doesn't use them |

---

### 4. 🎵 Music Library — COMPLETELY MISSING (Large)
The app has music but there is no admin UI or management system.
| Feature Needed |
|---|
| Upload audio files (MP3/OGG) |
| Add tracks from external API (search, preview, click to add) |
| Enable/disable tracks per user visibility |
| Mark tracks as "featured" |
| Create and manage playlists |
| Categorize by genre: Gaming, Fantasy, Horror, Calm, Emotional, Seasonal |
| Track play counts / popularity stats |

**Backend needed:** `music_tracks` table, `playlists` table, upload to object storage, audio streaming endpoint.

---

### 5. 🛍️ Shop Admin — MISSING (Medium)
The shop exists in the app (cosmetics, outfits) but there is no admin UI to manage it.
| Feature Needed |
|---|
| Add/edit/delete cosmetics (stickers, frames, effects) |
| Add/edit/delete outfits |
| Add badges and avatars |
| Set star prices |
| Schedule a release date (show countdown in app) |
| Toggle item availability |

**Backend needed:** Most schema exists; needs `scheduledAt` + `isAvailable` columns, admin CRUD routes.

---

### 6. 📣 Push Notifications Admin — MISSING (Medium)
The push infrastructure exists (`/api/push`) but there's no admin UI for broadcast messaging.
| Feature Needed |
|---|
| Compose notification (title + body + optional deep-link) |
| Send to: Everyone / Specific country / Beta testers only / New users (< 7 days) |
| Scheduled sends |
| Notification history log |

**Backend needed:** Segment-based query (country/role), scheduler, send log table.

---

### 7. 📊 Analytics — COMPLETELY MISSING (Large)
| Chart/Metric Needed |
|---|
| User retention (Day 1 / Day 7 / Day 30) |
| DAU / MAU over time (line chart) |
| Session length distribution |
| Top 10 most-read stories |
| Top 10 most-played songs |
| Most-used outfits/cosmetics |
| Most-visited app screens |
| New signups per day (bar chart) |

**Backend needed:** Session/event logging table or integration with an analytics service (PostHog, Mixpanel, or custom). This is the most complex section.

---

### 8. 📝 CMS (Content Management) — COMPLETELY MISSING (Medium)
| Feature Needed |
|---|
| Home screen banners (image + title + tap action) |
| Welcome/onboarding text |
| FAQ editor |
| Community rules editor |
| Featured content slots (story/user of the week) |
| News/announcements feed |

**Backend needed:** `cms_content` table with `type` enum, rich-text or markdown editor in admin.

---

### 9. 🐛 Beta Testing / Feedback — MISSING (Medium)
| Feature Needed |
|---|
| View in-app bug reports and feedback submissions |
| Assign priority (P0–P3) |
| Mark as fixed / in progress / won't fix |
| Admin reply back to tester (push notification) |

**Backend needed:** `beta_feedback` table (or integrate with Linear/GitHub via Replit integrations).

---

### 10. ⚙️ Settings & Feature Flags — COMPLETELY MISSING (Medium)
| Feature Needed |
|---|
| Maintenance mode toggle (shows maintenance screen in app) |
| App minimum version enforcement |
| Feature flag toggles (Stories ON/OFF, Voice Rooms ON/OFF, etc.) |
| Rate limit configuration |

**Backend needed:** `app_settings` key-value table, `/api/config` endpoint the app polls on startup.

---

### 11. 📋 Logs — MISSING (Small-Medium)
| Feature Needed |
|---|
| Admin action audit log (who banned who, when) |
| API error log viewer |
| Login history per user |
| Push notification delivery log |

**Backend needed:** `admin_audit_log` table (insert on every sensitive action), log viewer in admin.

---

### 12. 🤖 AI / Auto-Moderation Queue — FUTURE
| Feature Needed |
|---|
| Auto-flag content (text + images) with AI before it reaches the feed |
| Manual review queue for flagged items |
| Approve / Reject / Escalate |

**Backend needed:** AI content scanning on story/comment publish, queue table. Consider Anthropic moderation API.

---

## Summary Table

| Section | Status | Priority | Est. Hours | Est. Cost ($65/hr) |
|---|---|---|---|---|
| Dashboard improvements | Partial | Low | 8h | $520 |
| User management improvements | Partial | Medium | 12h | $780 |
| Stories admin improvements | Partial | Medium | 10h | $650 |
| **Music Library** | ❌ Missing | **High** | 40h | $2,600 |
| **Shop Admin** | ❌ Missing | **High** | 20h | $1,300 |
| **Push Notifications Admin** | ❌ Missing | **High** | 16h | $1,040 |
| **Analytics** | ❌ Missing | Medium | 32h | $2,080 |
| **CMS** | ❌ Missing | Medium | 20h | $1,300 |
| **Beta Feedback** | ❌ Missing | Low | 16h | $1,040 |
| **Settings / Feature Flags** | ❌ Missing | **High** | 12h | $780 |
| **Audit Logs** | ❌ Missing | Medium | 14h | $910 |
| AI Moderation Queue | ❌ Future | Low | 24h | $1,560 |
| **TOTAL** | | | **224h** | **$14,560** |

---

## Recommended Build Order (3 Phases)

### Phase 1 — Operations Essentials (6–8 weeks, ~72h, ~$4,700)
These directly affect your ability to run the app safely today.
1. **Settings & Feature Flags** — turn features on/off without a new APK
2. **Push Notifications Admin** — communicate with users
3. **Shop Admin** — manage cosmetics and prices
4. **Audit Logs** — know what admins did
5. **Dashboard today-stats + server status**

### Phase 2 — Growth & Content (8–10 weeks, ~100h, ~$6,500)
These grow and enrich the user experience.
6. **Music Library** — biggest gap, highest user impact
7. **CMS** — banners, featured content, announcements
8. **User improvements** — suspension, verified creators, beta access
9. **Stories improvements** — feature/pin/restore/tag search

### Phase 3 — Intelligence (8–10 weeks, ~52h, ~$3,400)
These give you data and automation.
10. **Analytics** — retention, DAU, popular content
11. **Beta Feedback** — structured tester feedback
12. **AI Moderation Queue** — scale content safety

---

## Notes on Cost
- Estimates assume a **mid-level full-stack developer at $65/hr**
- Analytics cost goes up significantly if you integrate a third-party service vs. building custom
- Music Library cost includes backend (DB schema, object storage for audio, streaming) — the largest single item
- Feature flags can be done in ~1 day if kept simple (DB key-value); grows if you want per-user/per-country targeting
- If built by Replit Agent directly: the tool/compute cost is near zero; time is the main variable
