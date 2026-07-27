---
linear: CAM-581
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: story
owner: qa-engineer
status: in-progress
version: v1
updated: 2026-07-27
---
# Clear the two scale-guard findings and make the rule blocking (CAM-581)

<!-- QA guard-hardening story. Test/tooling surface + 2 single-line component fixes only. -->

## Story
As the **platform** (maintainer-facing, no end-user-visible change besides 2 narrow geometry fixes), I want the CAM-565 M4 backlog (`components/Navbar.tsx:160`, `components/ui/filter-chip.tsx:45`) inspected against a real 150%-text-scale render, resolved (fixed or proven false-positive), and M4 flipped to blocking with a backlog of 0, so that the scale guard actually enforces the CAM-560-shaped defect going forward instead of sitting in report mode indefinitely.
Why: CAM-565 shipped M4 report-only specifically because nobody had reviewed the 2 real hits yet (BR-2, `.claude/rules/ops.md`'s "report → clear to 0 → blocking" rule). A rule left permanently in report mode is a rule nobody has to satisfy — precisely how the original CAM-560 overlap shipped past the guard that predated M4.
Scope: inspect both findings in a real Chromium browser at a phone width and 150% root font-size (`html { font-size: 24px !important; }`, the established technique from `e2e/regression/cam-560-category-label-overlap.spec.ts`); resolve each (fix the component, or tighten M4's heuristic when the finding is a false positive); flip M4 from report-only to blocking repo-wide once the backlog is provably 0; prove M4's teeth both ways (fires on a reconstructed violation, quiet on the clean tree).
Depends on: CAM-565 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-565-scale-guard/story.md`, added M4 report-only + named this exact 2-item backlog) · CAM-560 (real-browser 150% technique) · CAM-558 (touch-floor 44px, re-verified here since filter-chip.tsx's box changes)

## AC
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | `components/Navbar.tsx:160`'s search-bar guest-count container, rendered in a real Chromium browser at 768-1024px width (its only visible range: `hidden md:flex`), 150% root font-size, EN+TH copy, guest counts 1/10/99, and a maximally long province+district string | The container is measured for overlap/clip against its icon sibling | No overlap and no visible clip found in any case tested — the guest span's own `truncate` plus the two preceding `flex-1` siblings (flex-basis 0%) absorbing all compression first mean this container's rendered width never drops below its natural content width | No file change to `Navbar.tsx`; M4 tightened instead (see BR-2) | EC-1 |
| AC-2 | `components/ui/filter-chip.tsx:45`'s pill variant, given a real, validation-legal 50-character zone name (the `zoneCreateSchema` max, `lib/validations/zone.ts`) rendered inside its real `flex flex-wrap` container (`spot-management-section.tsx`'s zone-filter row) at 320px width, 150% root font-size | The pill is measured for overlap/clip/vertical spill | Pre-fix: the label wraps to 2 lines and spills ~13px past the pill's fixed `h-11` rounded-full box (a genuine defect). Post-fix (`truncate` added): the pill stays single-line, ellipsizes, 0px vertical spill, and never extends past the modal's own clipped boundary | `components/ui/filter-chip.tsx`'s pill className gains `truncate`; the touch target stays ≥44px in both dimensions | EC-2 |
| AC-3 | The whole `app/` + `components/` tree, scanned for the M4 shape after both resolutions | `node scripts/check-scale.mjs` / `npm run check:ds` runs | `M4-min-width-literal-not-shrink-safe` backlog = 0; no report-mode or text-scale-risk lines print for M4 | `runScaleGuard().blocking` and the (removed) report-only bucket both contribute 0 M4 entries | — (covered by AC-1/AC-2 directly) |
| AC-4 | M4, once its backlog is confirmed 0 | `npm run check:ds` runs | M4 now behaves like M3: BLOCKING repo-wide, not report-only | Exit code 0 today (backlog is 0); a *future* line matching the M4 shape (no truncate escape, no shrink-0) will FAIL the gate | EC-3 |
| AC-5 | A reconstructed fixture line carrying the exact CAM-560 pre-fix shape (literal-px min-width, no `shrink-0`, no `truncate` escape) | `isMinWidthScaleRisk(line)` runs | Returns `true` — M4 still has teeth after the rule tightening | Unit assertion only, no file changes | AC-3 |

## Rules
- BR-1 150% is the contract for "an increased text scale" (unchanged from CAM-565 BR-1) — this story does not revisit that figure.
- BR-2 M4's heuristic gains ONE new escape, in addition to `shrink-0`: a literal-px min-width is also SAFE when the flagged line, or the line immediately following it, carries `truncate` (Tailwind's `overflow:hidden` + `text-overflow:ellipsis` + `white-space:nowrap`). Reasoning: `truncate` makes a compressed box degrade to an ellipsis instead of visually spilling into a sibling or wrapping past its own fixed height — the exact failure mode M4 exists to catch. This is a co-occurrence widening (same-line OR the very next line, per BR-5's own "never a bare grep" style, `.claude/rules/code.md`'s CAM-221 lesson), not a wildcard: it does not fire on lines that merely mention `truncate` elsewhere in the file. Proven false-positive on Navbar.tsx:160 (AC-1) — the check-scale.mjs regression suite's `flags:`/`is silent on` fixtures do not use `truncate` anywhere, so this addition changes zero existing outcomes there (proves AC-1/AC-5).
- BR-3 filter-chip.tsx:45's fix is `truncate`, not `shrink-0`. Measured directly (real browser, `spot-management-section.tsx`'s live `flex flex-wrap` zone row): `shrink-0` makes the pill grow to ~517px natural width, overflowing `ModalContent`'s own `overflow-hidden` clip boundary and getting hard-clipped mid-character — worse than the pre-fix 13px vertical spill. `truncate` keeps the pill within its compressed width, ellipsizes, and reports 0px vertical overflow. `shrink-0` is the right fix ONLY for a horizontal-scroll strip (CategoryBar's `overflow-x-auto`); it is the wrong fix for a `flex-wrap` chip row inside a clipped container (proves AC-2).
- BR-4 M4 promotes from report-only(repo-wide) to **blocking(repo-wide)** — the same treatment M3 already has, per `.claude/rules/ops.md`'s rollout rule, now that the named backlog is provably 0 (proves AC-3/AC-4).
- BR-5 CAM-565's own regression test (`__tests__/cam-565-scale-guard-text-scale.test.ts`) hard-codes the pre-resolution 2-item backlog as its EC-1 canary ("forces the change to be reviewed rather than silently absorbed"). Clearing the backlog to 0 is this story's explicit deliverable, so that exact-locations assertion is updated in place (from `["Navbar.tsx:160", "filter-chip.tsx:45"]` to `[]`) as the intended, disclosed consequence of BR-2/BR-4 — not a silent drop; the assertion's *purpose* (catch an unreviewed backlog change) is satisfied by this very story being the reviewed change.

## Edge cases
- EC-1 IF a future edit removes the `truncate` escape from Navbar.tsx's guest-count child span THEN `isMinWidthScaleRisk` (now blocking) fails the build the next time that div's content is squeezed past 140px — no longer silently report-only (BR-2/BR-4).
- EC-2 IF a future host types a zone name at the 50-char validation max THEN the pill ellipsizes (post-fix) instead of wrapping/spilling past its box, at any text scale (BR-3).
- EC-3 IF a new file introduces the exact M4 shape (literal-px min-width, no `shrink-0`, no `truncate` escape, flex-ish, not a symmetric icon box) THEN `npm run check:ds` exits 1 — M4 is no longer report-only (BR-4, proven both-directions in `__tests__/cam-581-scale-guard-blocking.test.ts`).

## Data
- No schema/DB change. Touched: `scripts/check-scale.mjs` (M4 escape + blocking promotion), `scripts/check-ds.mjs` (wiring: M4 moves out of the report-only print block into the same blocking-repo-wide row M3 uses), `components/ui/filter-chip.tsx` (line 45 only: `+ truncate`), `__tests__/cam-581-scale-guard-blocking.test.ts` (new), `__tests__/cam-565-scale-guard-text-scale.test.ts` (BR-5: one assertion updated to `[]`). `components/Navbar.tsx` is NOT touched (AC-1: false positive). Migration: none.

## Seams & refs
- Reuse: `scripts/check-scale.mjs` stays the single owner of M1-M4 + `runScaleGuard()`; no parallel script. `truncate` reuses the exact Tailwind utility Navbar's own guest-label span already relies on (`components/Navbar.tsx:161`) — not a new pattern.
- Refs: `.claude/rules/ops.md` "report → clear to 0 → blocking" rollout rule · CAM-565 story.md (the named backlog this story clears) · CAM-560 story.md (150%-scale real-browser technique, reused verbatim) · CAM-558 story.md EC-5 (44px touch-floor re-check after filter-chip.tsx's box change).

## Out of scope
- Any change to `components/ai-chat/**`, `DESIGN.md`, `app/globals.css`, `lib/**`, `prisma/**` — untouched, per this dispatch's file surface.
- Widening M1/M2's own blocking scope — unrelated, governed by its own backlog.
- A generic Playwright sweep of every route at 150% — the existing per-component e2e techniques (CAM-558/560) already cover the real-browser side; this story adds a static-fixture unit test only, per the established M1-M4 pattern.

## Self-verify
- AC-1 → real-browser measurement (Playwright/Chromium against localhost:3000, 150% root font-size, multiple widths/guests/languages) — no overlap/clip found; documented in the PR body; no automated regression test added for a proven-safe shape (the existing e2e Navbar coverage is unaffected).
- AC-2 → real-browser measurement before/after the `truncate` fix (same technique); `e2e/regression/cam-558-touch-targets.spec.ts`-style manual re-check that the pill's box stays ≥44px both dimensions post-fix.
- AC-3/AC-4/AC-5 → `__tests__/cam-581-scale-guard-blocking.test.ts` (new): M4 fires on a fresh violation fixture, is quiet on the current `Navbar.tsx`/`filter-chip.tsx` source read live off disk, and `runScaleGuard()`'s M4 backlog (blocking + report) is exactly 0 repo-wide.
- Story-specific: `npx vitest run __tests__/cam-552-mobile-scale.test.ts __tests__/cam-560-category-label-overlap.test.ts __tests__/cam-558-touch-floor.test.ts __tests__/cam-565-scale-guard-text-scale.test.ts __tests__/cam-581-scale-guard-blocking.test.ts` all green · `npm run check:ds` → `EXIT=0`, M4 row shows `blocking(repo-wide)` backlog=0 · `npm run typecheck` clean · `npm run lint` 0 errors · full `npx vitest run` as the LAST act.
- Gate = `/quality-gate` · Done = every AC verified on localhost before merge into `dev`.

## Changelog
- v1 (2026-07-27) — created; both CAM-565 findings inspected at 150% real-browser scale; Navbar.tsx:160 proven false-positive (M4 tightened with a `truncate` escape); filter-chip.tsx:45 fixed (`truncate` added, not `shrink-0` — measured worse); M4 flipped to blocking repo-wide, backlog 0.
