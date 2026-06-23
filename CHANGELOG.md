# Changelog

All notable changes to CampVibe are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

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
