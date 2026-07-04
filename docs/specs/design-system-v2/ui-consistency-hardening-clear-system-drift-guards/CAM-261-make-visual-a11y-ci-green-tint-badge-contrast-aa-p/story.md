---
linear: CAM-261
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-04
---
# Make visual-a11y CI green — tint-badge contrast (AA) + /preview a11y + commit baselines (CAM-261)

## Story
As a **platform owner**, I want the advisory `visual-a11y` CI job to pass (green) instead of failing on every PR, so that it can catch a real UI regression again instead of being permanently red on pre-existing debt.
Why: surfaced during the Badge normalization PR (#273); the job has been red since CAM-230 introduced it, on debt unrelated to any single PR — a genuine regression is currently invisible in the noise.
Scope: fix the 3 debt groups the job reports today (tint-badge contrast, `/preview` a11y, missing baselines). No feature/logic change; the job stays advisory (`continue-on-error: true`), never promoted to a blocking gate.
Depends on: CAM-230 (introduced the job) · CAM-231 (home Select accessible-name fix — same pattern reused here)

## AC
<!-- Then = user-visible (screen text = verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin (EC-n/AC-n); — needs a reason. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Badge variant destructive/success/warning/info rendered as a tint (`bg-x/N text-x`) on `/preview` | axe scans the page | No visible change beyond a slightly lighter tint fill; badge text/border hues unchanged (no user-facing copy) | axe reports 0 critical/serious `color-contrast` violations on every tint badge, ≥4.5:1 in both light/dark and against both page + card surfaces | EC-1 |
| AC-2 | `/preview` page (design kitchen-sink) | axe scans the page | No visible change; the 3 example dropdowns and the color-swatch grid render identically to before | axe reports 0 critical/serious violations on `/preview` (`select-name` + `aria-prohibited-attr` resolved) | EC-2 |
| AC-3 | `visual-a11y` CI job runs on the Linux runner with no Linux-native baseline committed | CI executes `npx playwright test` | No visible change (CI-internal); the job no longer hard-fails on "screenshot doesn't exist" | The job reports green; screenshot comparison runs for real once a Linux baseline is committed, report-only otherwise | EC-3 |

## Rules
- BR-1 Tint-badge text/background pairs must resolve to ≥4.5:1 contrast (WCAG AA, small text — Badge is `text-xs`/12px, below the large-text exemption) on both the page background and the `card` background, in both light and dark mode — token-only (opacity of the existing `bg-x`/`text-x` tokens; no new color value added to `app/globals.css`). (proves AC-1)
- BR-2 Every `SelectTrigger` and any non-text-supporting element that needs an accessible name gets `aria-label`; an element whose implicit ARIA role does not support `aria-label` (e.g. a generic `<div>`) gets an explicit supporting `role` (e.g. `role="img"`) instead of being left unlabeled. (proves AC-2)
- BR-3 The visual-regression screenshot assertion must never hard-fail solely because a platform-specific baseline is absent; it falls back to a report-only capture and only asserts for real once a baseline exists for that OS/project. (proves AC-3)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF the tint badge renders on a `card` surface (in dark mode, lighter than the page background — the measured worst case) THEN contrast still holds ≥4.5:1 (verified against both `--background` and `--card`, both modes) (BR-1)
- EC-2 IF a `Select` is in its `disabled` state THEN the trigger still reports an accessible name (disabled elements remain in the accessibility tree, axe still evaluates them) (BR-2)
- EC-3 IF a maintainer later commits a real Linux baseline (per the bootstrap steps in `e2e/README.md`) THEN the job automatically switches from report-only back to a real pixel comparison with no code change required (BR-3)

## Data
- No entities/fields touched · migration: none (UI utility classes + CI workflow env + one e2e spec + 3 locale keys only)

## Seams & refs
- Reuse: `components/ui/badge.tsx` (`badgeVariants` — the single source for tint styling; no parallel badge implementation) · `components/SortDropdown.tsx` (the `aria-label={t.sort.sortBy}` pattern reused verbatim for `/preview`'s example Selects) · Refs: CAM-230 (the job), CAM-231 (Select accessible-name precedent)

## Out of scope
- Promoting `visual-a11y` to a blocking/required check → stays advisory per CAM-230 (report-mode-to-zero discipline); a follow-up ticket if ever promoted
- A working DB connection for the CI job's `/` a11y scan (no Postgres service is provisioned in this job) → follow-up ticket if the home-page scan needs real data instead of erroring gracefully
- A broader tint-badge visual redesign (e.g. a solid-chip style instead of a wash) if the AA-safe 2%/10% tint reads as too subtle → follow-up ticket, Designer's call

## Self-verify
- AC-1 → unit-equivalent (contrast measured with a real-browser `color-mix` probe against the actual `app/globals.css` tokens, both modes × both surfaces, before/after values recorded) + e2e (`preview.a11y.spec.ts` axe scan, `continue-on-error`)
- AC-2 → e2e (`preview.a11y.spec.ts` axe scan)
- AC-3 → owner-verify (CI-only — provable only by this PR's own `visual-a11y` job run; cannot be reproduced locally on macOS, which cannot generate a Linux baseline)
- Story-specific: no ownership/migration/disallowed-transition surface (pure UI classes + CI config + i18n keys)
- Gate = /quality-gate · Done = every AC verified; AC-1/AC-2 verifiable on the real Staging URL, AC-3 verified via this PR's own CI run (CI-internal, not a Staging-URL-observable behavior)

## Changelog
- v1 (2026-07-04) — created
