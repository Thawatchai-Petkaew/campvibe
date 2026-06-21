# Changelog

All notable changes to CampVibe are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

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
