# Changelog

All notable changes to CampVibe are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## v0.10.1 — 2026-06-25

### Fixed

- **Walking-agent flicker on /status/map, fully resolved (follow-up to CAM-176):** Agent position is owned by the animation engine (imperative per-frame DOM writes), but the React component also declared `left/top/zIndex` in its inline style — so every genuine live-feed update (a change to an agent's counts, activity, or task) re-applied the static home position and snapped a walking agent back home for one paint frame. Removed the three position properties from the React style prop so the engine is the sole owner of position; the first-paint position is now seeded once imperatively in the `rootRef` callback. v0.10.0's CAM-176 fix only covered no-op polls (identical payloads); this covers real data updates, which is the case that was still flickering. 10 regression tests guard the contract (re-adding position to the style prop turns them red).

### No schema change

No Prisma schema or database migration in this release. Frontend only.

### Rollback

Revert the merge commit on `main` via PR (UI-only change, no migration — trivially reversible), or redeploy the previous prod deployment.

## v0.10.0 — 2026-06-25

### /status/map delivery dashboard — gift, board accuracy, freshness

- **Delivery gift on the campfire (CAM-171):** A view-once "ส่งมอบสำเร็จ" gift card appears on the /status/map campfire when a story reaches Done; clicking it opens a modal listing the delivered tickets.
- **Gift modal in the scene's glass style (CAM-173, CAM-174):** The modal and its delivery cards use the /status/map scene glass treatment (matching the Backlog/Overview panels); HTML entities in titles are decoded so quotes render correctly.
- **Board lanes derived by role + gate (CAM-175):** A shared `boardColumnOf` helper buckets stories into Backlog / To Do / In Progress / In Review / Done by status type + current role + label — QA and Security stories, and any story awaiting your approval, now show in the In Review (ตรวจสอบ) lane on both /status and /status/map. Backlog vs To Do semantics documented in the orchestrator manual.
- **Faster status freshness (CAM-175):** /status/map reconcile fallback cut from 60s to 15s and the pulse poll from 2.5s to 1.5s, so the board reflects a change within ~1.5s (≤15s worst case) instead of ~60s.
- **No more walking-agent flicker (CAM-176):** The wander/rest effect no longer re-runs on a no-op reconcile — a poll that does not change agent activity no longer resets a walking agent. Two-layer fix: skip the state update on an unchanged payload, and key the wander effect on an activity signature instead of the agents array reference.
- **Interactive gate-watcher codified:** The orchestrator operating manual now documents that an interactive session must poll `linear-sync gates` to detect a human approval (the webhook only auto-resumes the headless action).

### No schema change

No Prisma schema or database migration in this release. Frontend / delivery-dashboard and docs only.

## v0.8.2 — 2026-06-22

### Image Resilience IR-1 (CAM-132, CAM-133)

- **ImageWithFallback (CAM-132):** New component — renders a branded placeholder (bg-muted + ImageOff icon) when a src is missing or fails to load; replaces black cells and browser broken-image icons across all gallery/card surfaces.
- **Adaptive hero gallery grid (CAM-133):** 1/2/3/4/5+ image count branches — eliminates undefined-src cells that caused layout holes and broken tiles in the campground detail gallery.
- **Lightbox index clamp (CAM-133):** Index clamped on open and navigation; "N of M" counter is always correct (fixes off-by-one "2 of 1" regression).
- **Adoption:** ImageWithFallback adopted across 9 render sites — gallery main + thumbnail, campground card, map popup, bookings list, dashboard thumbnail, upload previews.

### No schema change

No Prisma schema or database migration in this release. Frontend-only change.

### Rollback plan

Revert the merge commit on `main` (`git revert 3e4bbdca`) via a PR. No database rollback required.

---

## v0.8.1 — 2026-06-22

### Security + Tooling (CAM-129, CAM-130, CAM-131)

- **CAM-131:** Rate-limit on `/api/wishlist` writes → 429 (brute-force guard).
- **CAM-129/130:** `linear-sync.mjs` audit flags stub feature/epic.md + covers parented child stories; QA self-verify runs lint.

### No schema change

No Prisma schema or database migration in this release.

### Rollback plan

Revert the merge commit on `main` (`git revert d4a6adb6`) via a PR. No database rollback required.

---

## v0.8.0 — 2026-06-22

### Design System Overhaul + Wishlist (CAM-127, CAM-128)

See git tag v0.8.0 and PR history for full detail. 31 PRs, 0 migrations.

### Rollback plan

Revert the merge commit on `main` (`git revert cfd10548`) via a PR. No database rollback required.

---

## v0.7.0 — 2026-06-22

### FE Quality Epic (F0–F6, CAM-105–CAM-111)

- **F0 (CAM-105):** ThemeProvider + dark/light toggle (ThemeToggle component) + `/preview` route. `/preview` acts as the live-code marker for prod smoke checks.
- **F1 (CAM-106):** Base layer — token adoption for UI overlays (dialog, sheet, command, alert-dialog, tabs) + skeleton components.
- **F2 (CAM-107):** Listing surface — full design-token + dark-mode + responsive + a11y pass. Fixed SearchModal tap-target sizing and focus-ring.
- **F3 (CAM-108):** Detail surface — token + dark + responsive + a11y. Fixed gallery i18n key, counter i18n, and alt text.
- **F4 (CAM-109):** Forms/operator — token + dark + responsive + a11y + AlertDialog pattern. Fixed aria-labels, i18n sort/pagination on campsites table.
- **F5 (CAM-110):** Account/misc (bookings, profile, wishlist, dashboard settings) — token + dark + responsive + a11y + AlertDialog.
- **F6 (CAM-111):** Palette guard — repo-wide token sweep across all remaining surfaces. Added `scripts/check-palette.mjs` + CI enforcement step. Added `__tests__/f6-palette-guard.test.ts` regression suite.

### Status Dashboard (ST1–ST3 + polish, CAM-115–CAM-118)

- **ST1 (CAM-117):** Trail distribution widget using real derived data (`lib/status-derive.ts`). Responsive layout.
- **ST2 (CAM-116):** Multi-role workload panel with real data, responsive.
- **ST3 (CAM-115):** `linear-sync.mjs` handoff command + Telegram notify on handoff/done events.
- **Polish (CAM-117/CAM-118):** Canonicalized role tags + trail passed-state derivation; Tabs active-segment AA contrast fix; LocationPicker subtitle AA contrast fix.

### UI Contrast Fixes

- Restored visible hover contrast on dropdown/select menus in light mode (CAM-118 related).
- Restored visible contrast on theme-mode toggle button in light mode.

### No schema change

No Prisma schema or database migration in this release. Pure code/CSS/config/scripts.

### Rollback plan

Revert the merge commit on `main` (`git revert 299e9aa6`) via a PR. No database rollback required.

---

## v0.6.0 and earlier

See git tags and commit history.
