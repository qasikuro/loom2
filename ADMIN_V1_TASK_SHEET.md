# GameJo Admin V1 Task Sheet

## Scope and operating rules

This sheet covers the non-game admin and platform work for the current V1 stage.

### Hard boundaries

- The Game section is excluded from this plan.
- Do not add a game API, game-data provider, game schema, game synchronization, game search, game discovery, game metadata, game page, game UI, game environment variable, or game refactor.
- If a non-game feature appears to require a change to the game system, stop and report the dependency instead of changing it.
- Use the existing GameJo backend, PostgreSQL/Neon database, storage, authentication, and Expo-compatible push infrastructure.
- Use Resend for email.
- Do not add a new paid provider without identifying the requirement and receiving approval.
- Do not use mock data in production.

### Current administrator model

- Keep the existing Clerk sign-in flow unchanged.
- Keep the existing `isAdmin` access check unchanged.
- There is currently one administrator.
- Do not add roles, permissions, admin-user management, moderator accounts, or a new admin authorization flow in this V1.
- All important admin actions should still be audited using the existing authenticated admin identity.

### Working method

Tasks are completed sequentially. Each task must include:

1. A scoped implementation plan before editing
2. Backend/API work where required
3. Admin UI work where required
4. Database migration work where required
5. Real-data handling only
6. Tests and verification
7. A diff review confirming that no game-related files changed
8. A checkpoint before the next task begins

---

# Current implementation baseline

## Already present

These areas have real foundations and should be hardened or extended rather than rebuilt:

- Clerk sign-in and admin access gate
- Dashboard aggregate statistics
- User list, search, detail, and current admin actions
- Story and outfit content moderation
- Sticker moderation
- Reports review and resolution
- Campfire message moderation action
- Events CRUD and event reward grant flow
- Badges CRUD, image upload, grant, and revoke
- Profile effects CRUD and AI-assisted configuration generation
- Push notification broadcasts
- Basic application settings and feature toggles

## Partially complete or unavailable

- Dashboard historical telemetry is not connected.
- Live activity is not connected.
- Content pipeline/upload processing status is not connected.
- Many navigation items still use honest placeholder screens.
- There is no durable admin audit-log workspace.
- There is no support ticket system.
- There is no basic analytics pipeline beyond current aggregate stats.
- Operations health checks are not connected to all services.
- Existing admin access is single-level and intentionally remains unchanged for V1.

---

# V1 implementation tasks

## Task 1 — Baseline, scope lock, and verification harness

**Priority:** P0  
**Status:** Ready to start  
**Dependencies:** None

### Work

- Record the current admin behavior and supported API endpoints.
- Confirm the existing Clerk admin flow remains unchanged.
- Confirm the current administrator can still access all existing admin tools.
- Establish the no-game change boundary for every task.
- Run the existing typecheck, lint, build, and workflow checks.
- Add a repeatable admin verification checklist.
- Identify database migrations needed by later tasks without applying unrelated changes.

### Explicit non-goals

- No roles or permissions.
- No changes to Clerk authentication.
- No game-related work.
- No visual redesign.

### Done when

- The current admin can sign in and access the current console.
- Baseline checks pass.
- The remaining tasks have clear file/API/database boundaries.

---

## Task 2 — Durable admin audit logs

**Priority:** P0  
**Status:** Not started  
**Dependencies:** Task 1

### Work

- Add an audit-log table using the existing PostgreSQL database.
- Create a reusable audit service.
- Record:
  - Existing admin user ID
  - Action name
  - Target type and target ID
  - Reason or operator note
  - Timestamp
  - Success/failure result
  - Request or correlation ID where available
  - Before/after values for important settings and status changes
- Add audit records to existing mutations:
  - User ban, unban, suspend, and delete
  - Content hide, restore, delete, and feature actions
  - Report decisions
  - Badge, effect, and event changes
  - Notification broadcasts
  - Settings changes
- Add Admin Activity and Audit Logs screens.
- Add pagination and filters by action, target, date, and result.

### Explicit non-goals

- No new role system.
- No admin-user management.
- No security threat-intelligence dashboard.

### Done when

- Every important admin mutation creates a durable audit record.
- Audit records remain available after server restart.
- The audit UI displays real records and never simulated activity.

---

## Task 3 — Users and user detail

**Priority:** P0  
**Status:** Partially implemented; hardening required  
**Dependencies:** Tasks 1–2

### Work

- Keep the existing user list and detail flow.
- Add reliable search and server-side filters for:
  - New users
  - Beta users
  - Founders
  - Banned/suspended users
- Add stable pagination and sorting.
- Improve the user detail view with:
  - Profile data
  - Content counts
  - Report history
  - Moderation history
  - Reward/badge history
  - Last activity where existing data supports it
- Harden ban, suspend, unban, and delete operations.
- Require confirmation and a reason for destructive actions.
- Audit every user mutation.
- Preserve protection against deleting or disabling the current administrator.

### Explicit non-goals

- No multi-admin roles.
- No admin invitation flow.
- No changes to user-facing authentication.

### Done when

- User filters return real server-side results.
- Every user action updates the UI from the server response.
- Destructive actions are confirmed, reasoned, audited, and test-covered.

---

## Task 4 — Non-game content management

**Priority:** P0  
**Status:** Partially implemented; expansion required  
**Dependencies:** Tasks 1–3

### Work

- Harden story and outfit moderation.
- Add non-game media views only where the existing storage/media system supports them:
  - Images
  - Videos
  - Upload status
  - Processing status
- Add content filters for:
  - Author
  - Visibility
  - Hidden state
  - Date range
  - Report status
- Add content detail preview with:
  - Author
  - Creation date
  - Reports
  - Visibility state
  - Moderation history
- Support hide, restore, delete, and feature actions where the underlying content model supports them.
- Use soft deletion or a recovery path where practical.
- Ensure stored media is cleaned up when content is permanently removed.
- Audit every moderation mutation.

### Explicit non-goals

- No game content changes.
- No game media changes.
- No new video-processing provider.
- No automated media moderation yet.

### Done when

- Every displayed content action is backed by a real API.
- No UI-only content action claims success without a server response.
- Existing non-game media ownership and storage rules are preserved.

---

## Task 5 — Reports and human moderation workflow

**Priority:** P0  
**Status:** Reports are partially implemented; unified workflow required  
**Dependencies:** Tasks 2–4

### Work

- Build a single human moderation queue from existing reports and supported moderation signals.
- Support report states:
  - Pending
  - In review
  - Resolved
  - Dismissed
- Display:
  - Reporter
  - Reported user
  - Content or message
  - Reason
  - Details
  - Previous actions
  - Related reports
- Add admin notes.
- Support human decisions:
  - Approve/close
  - Hide
  - Restore
  - Delete
  - Warn
  - Ban/suspend
- Notify affected users using existing in-app and push infrastructure.
- Audit every decision.
- Add filters for status, target type, age, and priority.

### Explicit non-goals

- No AI auto-moderation decisions.
- No image scanning.
- No video scanning.
- No automated bans.
- No appeals system in V1.
- No confidence-score dashboard.

### Done when

- A report can be followed from creation through final decision.
- Every decision has an admin, timestamp, reason, and audit record.
- The affected user receives the appropriate real notification.

---

## Task 6 — Notifications V1 and Resend email

**Priority:** P1  
**Status:** Push broadcast foundation exists; reliability work required  
**Dependencies:** Tasks 1–3

### Work

- Keep the existing push notification implementation.
- Support:
  - All users
  - Beta users
  - Selected users
- Add basic scheduling.
- Track:
  - Intended recipients
  - Queued
  - Sent
  - Failed
  - Token expired
- Remove or disable expired Expo tokens.
- Prevent duplicate sends with idempotency keys.
- Respect existing user notification preferences.
- Use Resend for administrative email notifications where required.
- Add email configuration through environment variables.
- Add preview and test-send behavior where safe.
- Audit broadcasts and administrative emails.

### Explicit non-goals

- No CRM system.
- No complex marketing automation.
- No advanced campaign builder.
- No new email provider.

### Done when

- A real notification can be sent to each supported audience.
- Failures are visible and retryable.
- Duplicate sends are prevented.
- Production credentials are environment-driven.

---

## Task 7 — Support V1

**Priority:** P1  
**Status:** Not started  
**Dependencies:** Tasks 1–2

### Work

- Add support ticket storage using PostgreSQL.
- Support:
  - User
  - Category
  - Priority
  - Subject
  - Message
  - Status
  - Admin response
  - Internal notes
  - Created/updated timestamps
- Add ticket list, detail, filters, and search.
- Add status flow:
  - Open
  - In progress
  - Waiting for user
  - Resolved
  - Closed
- Notify users through existing notification and Resend infrastructure where appropriate.
- Audit status changes and admin responses.

### Explicit non-goals

- No Zendesk replacement.
- No external support provider.
- No complex SLA or enterprise ticketing system.

### Done when

- A user issue can be tracked from creation to resolution.
- Admin responses and status changes are persisted and auditable.

---

## Task 8 — Operations, dashboard health, and emergency controls

**Priority:** P1  
**Status:** Dashboard shell exists; real health data required  
**Dependencies:** Tasks 1–2 and existing backend health routes

### Work

- Connect dashboard system status to real checks for:
  - API
  - Database
  - Storage
  - Authentication
  - Email
  - Existing push infrastructure
- Display clear states:
  - Healthy
  - Degraded
  - Failed
  - Not configured
  - Not monitored
- Add upload monitoring using existing upload/storage data:
  - Pending
  - Processing
  - Complete
  - Failed
- Add “Needs your attention” items from real reports, failed uploads, and service failures.
- Add maintenance mode control.
- Add basic emergency feature controls:
  - Registration
  - Chat
  - Image uploads
  - Video uploads
  - AI features
- Audit every operational setting change.

### Explicit non-goals

- No Datadog-style observability platform.
- No new monitoring provider.
- No game API health check implementation.

### Done when

- Dashboard status cards are backed by real checks.
- Unavailable data remains explicitly marked unavailable.
- Emergency settings take effect through the existing backend.

---

## Task 9 — Basic analytics

**Priority:** P1  
**Status:** Existing aggregate stats only; analytics pipeline required  
**Dependencies:** Tasks 1–4

### Work

- Define a small set of non-game analytics events.
- Capture and persist or aggregate:
  - Total users
  - New users
  - DAU
  - WAU
  - Stories created
  - Outfits created
  - Upload counts
  - Basic feature usage
- Add date-range filters.
- Add data freshness timestamps.
- Add dashboard cards and simple charts.
- Clearly label delayed or unavailable data.
- Use existing interfaces for any required cross-domain reference without changing the referenced system.

### Explicit non-goals

- No advanced cohort analytics.
- No D7/D30 retention in the first implementation.
- No A/B testing.
- No revenue analytics.
- No new analytics provider without approval.

### Done when

- Every displayed number comes from real backend data.
- Metrics have documented definitions.
- The UI never displays invented values.

---

## Task 10 — Rewards, community, and basic settings

**Priority:** P1  
**Status:** Rewards and events foundations exist; expansion required  
**Dependencies:** Tasks 1–3

### Work

- Keep existing badge, founder, beta, event, and profile-effect systems.
- Harden reward actions:
  - Grant
  - Revoke
  - Eligibility
  - Active/inactive state
  - Audit history
- Add basic community controls:
  - Existing events
  - Featured content
  - Basic announcements
  - Basic trending controls where existing data supports them
- Add basic settings:
  - Notification settings
  - Moderation settings supported by existing data
  - Legal/privacy configuration supported by existing infrastructure
- Ensure all setting and reward mutations are audited.

### Explicit non-goals

- No game rewards or game-data changes.
- No complex reward economy.
- No enterprise community-management engine.
- No recommendation-engine controls.

### Done when

- Existing rewards and event tools are reliable and auditable.
- Basic community actions use real content and real APIs.
- Settings changes are persisted and reversible where practical.

---

## Task 11 — Production verification and release gate

**Priority:** P0 release gate  
**Status:** Not started  
**Dependencies:** Tasks 1–10

### Work

- Add backend authorization tests for all current admin endpoints.
- Add mutation tests for:
  - Users
  - Content
  - Reports
  - Moderation
  - Notifications
  - Support
  - Operations
  - Rewards
  - Settings
- Add admin end-to-end tests for the most important workflows.
- Verify:
  - Clerk production configuration
  - Resend configuration
  - Database migrations
  - Storage access
  - Push notification behavior
  - Error handling
  - Backup and rollback procedures
- Run typecheck, lint, build, and workflow verification.
- Review the final diff for:
  - Game-system changes
  - Mock data
  - Hardcoded credentials
  - Unaudited mutations
  - UI actions without backend support

### Done when

- All required checks pass.
- No production screen depends on mock records.
- Every admin mutation is authenticated, real, and auditable.
- No game-related implementation has changed.

---

# Remaining pipeline after V1

These items are intentionally deferred and are not part of the current task sheet execution.

## Deferred security work

- Multiple admin roles
- Granular permissions
- Admin invitation and removal
- Two-factor authentication policy
- Advanced login/security event dashboard
- Privilege escalation threat monitoring

## Deferred moderation work

- AI-assisted moderation
- Image scanning
- Video scanning
- Automated moderation decisions
- Confidence scoring
- Automated bans
- Appeals workflow
- Advanced moderation analytics

## Deferred analytics work

- D1/D7/D30 retention
- Cohort analysis
- Advanced funnels
- A/B testing
- Revenue analytics
- Recommendation analytics

## Deferred operations work

- Full observability platform
- Distributed tracing
- Advanced alert routing
- Queue orchestration
- Automated incident response
- Large-scale processing dashboards

## Deferred communication and support work

- Sophisticated CRM campaigns
- Complex segmentation
- Enterprise support workflows
- SLA automation
- External support-provider integration

## Permanently excluded from this V1 sheet

- Game API work
- Game data providers
- Game schemas
- Game synchronization
- Game discovery
- Game search
- Game pages
- Game metadata
- Existing game-related UI changes
- Game API keys or environment variables

---

# Priority summary

| Priority | Tasks | Goal |
|---|---:|---|
| P0 | 1–5, 11 | Establish control, auditability, users, content, and human moderation |
| P1 | 6–10 | Add basic operations, notifications, support, analytics, rewards, community, and settings |
| Deferred | Pipeline below V1 | Add only after the core admin is stable and real usage justifies it |

# Estimated active Replit Agent compute

- Tasks 1–5: approximately 4–7 hours
- Tasks 6–10: approximately 4–6 hours
- Task 11 release verification: approximately 1–3 hours
- **Total V1 estimate: approximately 8–14 hours of active compute**

This estimate excludes all game work and assumes the existing services remain sufficient. If a requirement cannot be met with the current backend, storage, authentication, Resend, or Expo push infrastructure, implementation must pause for a decision instead of introducing a new provider automatically.