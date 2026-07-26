---
linear: CAM-565
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: story
owner: qa-engineer
status: in-progress
version: v1
updated: 2026-07-27
---
# The scale guard checks geometry at one text size only (CAM-565)

<!-- QA guard-hardening story. Test/tooling surface only — no production code (components/**, app/**, lib/**) touched. -->

## Story
As the **platform** (maintainer-facing, no end-user-visible change), I want the CAM-552 responsive-scale guard (`scripts/check-scale.mjs`) to also detect the one className shape that only breaks at an increased text scale, so that a defect shaped like CAM-560's (category labels overlapping only at ~150% text scale) fails red before merge instead of shipping past a green guard.
Why: CAM-552 added `check:scale` and made M1/M2/M3 (scoped) blocking. Days later the owner reported category labels visibly overlapping on their phone (`ลานกางเต็นท์` running into `แคมป์ด้วยรถ`). CAM-560 root-caused it: an explicit `min-w-[56px] md:min-w-[64px]` (CAM-552's own floor) overriding a flex item's content-based default `min-width: auto`, with no `shrink-0` to stop the browser compressing the tab below its label's content width. Measured honestly (CAM-560 story.md): at default zoom in headless Chromium this was a ~15px near-miss, not an overlap — it only reproduced at a realistic ~150% root font-size (a real phone "Larger text" setting), because the literal-px floor never scales with that setting while the label's rem-based content does. `check:scale` never covered this className shape at all (M1/M2/M3 check height/type-size tokens, not min-width), so the guard passed, CI was green, and the defect shipped.
Scope: `scripts/check-scale.mjs` gains a 4th static rule, M4 (`min-width-literal-not-shrink-safe`), that flags a literal-px bracket `min-w-[Npx]`/`md:min-w-[Npx]` with no `shrink-0` on a flex-ish line, skipping symmetric icon boxes. Ships **report-only, repo-wide** (a brand-new detector — rollout rule in `.claude/rules/ops.md`: report → clear to 0 → blocking; the backlog is real and counted, not tuned away). `scripts/check-ds.mjs`'s summary wiring is updated to print it. Both-directions proof lives in a new fixture-line unit test (`__tests__/cam-565-scale-guard-text-scale.test.ts`), the same pattern `__tests__/cam-552-mobile-scale.test.ts` already uses for M1/M2/M3 — reconstructing the pre-CAM-560 condition as a string, not reverting the committed `components/CategoryBar.tsx`. Does **not** add a new Playwright spec (see `## Rules` BR-4 for the reasoning) and does **not** fix the 2 real findings the new rule surfaces (`components/Navbar.tsx`, `components/ui/filter-chip.tsx`) — see `## Out of scope`.
Depends on: CAM-552 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-552-mobile-scale/story.md`, wrote M1/M2/M3 + the fixture-line test pattern this story reuses) · CAM-560 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-560-category-labels/story.md`, root-caused the defect + already added the real-browser 150%-scale technique this story's rationale relies on) · CAM-558 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-558-touch-floor/story.md`, EC-5, second real-browser use of the same 150% technique)

## AC
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The exact pre-CAM-560 `CategoryBar.tsx` tab className (literal-px `min-w`, no `shrink-0`), reconstructed as a fixture string, is passed to the new matcher | `isMinWidthScaleRisk(line)` runs | The call returns `true` — RED, proving the rule can catch the real historical defect | No file changes; a pure function call in a unit test | AC-2 |
| AC-2 | The same fixture string, with `shrink-0` added back (the CAM-560 fix) | `isMinWidthScaleRisk(line)` runs | Returns `false` — GREEN | Same | AC-1 |
| AC-3 | The current, real `components/CategoryBar.tsx` on disk (already fixed) | `runScaleGuard()` scans the whole repo | Zero M4 findings attributed to `components/CategoryBar.tsx` | `result.textScaleRisk` and `result.blocking` both contain 0 entries for that file | — (already covered by AC-2 on the live file, not just the fixture) |
| AC-4 | The whole `app/` + `components/` tree, scanned for the M4 shape today | `node scripts/check-scale.mjs` / `npm run check:ds` runs | Exactly 2 report-mode findings print, named by file:line, with a "review against a real 150% render" note — not 0 (not silently clean) and not hidden | `result.textScaleRisk` = `["components/Navbar.tsx:160", "components/ui/filter-chip.tsx:45"]`; `result.blocking` for M4 = `[]` | EC-1 |
| AC-5 | M4's 2 real findings | `npm run check:ds` (the pre-merge gate) runs | Exit code stays 0 — the new rule does not block this or any other PR | `totalViolations` in `check-ds.mjs` sums only `blocking` arrays; M4 landing in its own `textScaleRisk` bucket contributes 0 | EC-2 |

## Rules
- BR-1 150% is the contract for "an increased text scale," not a range. Reasoning: it is the exact figure that reproduced CAM-560's defect (a real phone "Larger text" accessibility setting), it is the figure CAM-558's EC-5 and CAM-560's own Prove-It test already standardized on (`html { font-size: 24px !important; }`, 24/16=1.5), and this rule is a STATIC arithmetic check (see BR-3) — it does not render at any scale at all, it recognizes a className SHAPE whose safety depends on scale existing in the first place. Adding a second number (e.g. 200%, WCAG's browser-zoom resize target) is not warranted here: browser zoom scales the viewport too, which is a different mechanism from an OS/browser root-font-size-only override, and no evidence today shows a shape that is safe at 150% but not at 200%. Revisit only if a real defect surfaces there (proves AC-1/AC-2).
- BR-2 M4 ships **report-only, repo-wide** — not scoped-blocking like M1/M2, and not repo-wide-blocking like M3. It is a brand-new detector; nobody has reviewed the 2 real hits yet, so a blocking claim would be unproven. Promoting it to blocking is a follow-up story that clears the named backlog first (`.claude/rules/ops.md`) (proves AC-4/AC-5).
- BR-3 M4's findings land in their own `runScaleGuard()` return key, `textScaleRisk` — never mixed into the existing `report` array. `report`'s current meaning ("M1/M2 findings outside CAM-552's cleared surface") is asserted on directly by the pre-existing `__tests__/cam-552-mobile-scale.test.ts` ("the report-mode backlog... every f.rule matches /^M[12]-/"), which is outside this story's file surface. A shared bucket would have forced editing that file to keep it true; a dedicated bucket keeps `report`'s existing contract intact with zero edits to a file this dispatch does not own (verified: `npx vitest run __tests__/cam-552-mobile-scale.test.ts` passes unedited) (proves AC-5).
- BR-4 No new Playwright spec is added. `check-scale.mjs`'s whole architecture is static arithmetic on parsed classNames, never a browser render (see the file's own new "Why M4 is static, not a browser re-render" doc comment) — M4's both-directions proof is fully achievable with a fixture-line unit test (BR-1's reasoning is encoded in the rule; AC-1/AC-2 prove it fires/is silent). The real-browser side of the underlying mechanism (actual pixel overlap at 150%) already exists and is green today: `e2e/regression/cam-560-category-label-overlap.spec.ts`'s "PROVE-IT" test and `e2e/regression/cam-558-touch-targets.spec.ts`'s EC-5. Duplicating that browser run here would be non-lean; this story's own self-verify does not execute Playwright (no dev-server/DB is configured in this worktree) (proves AC-1/AC-2).
- BR-5 The heuristic requires co-occurrence on the SAME line: a literal-px `min-w-[Npx]` AND a `flex`/`inline-flex`/`flex-*` token AND no `shrink-0` AND not a symmetric icon box (`size-N`, or matching `w-N`/`h-N`) AND not a comment line (CAM-221 lesson: never a bare grep). This is why a table (`min-w-[640px]`, no flex), a `<SelectContent>` popover width, and `ThemeToggle.tsx`'s square icon button (`min-h-[44px] min-w-[44px]`, no `flex` token on that line) are correctly silent, while `components/Navbar.tsx:160` and `components/ui/filter-chip.tsx:45` are correctly flagged (proves AC-4).

## Edge cases
- EC-1 IF a future edit adds or removes an M4 finding anywhere in the repo THEN `__tests__/cam-565-scale-guard-text-scale.test.ts`'s exact-locations assertion (`["components/Navbar.tsx:160", "components/ui/filter-chip.tsx:45"]`) fails, forcing the change to be reviewed rather than silently absorbed into a growing or shrinking backlog (BR-2).
- EC-2 IF M4's backlog is non-zero (it is: 2) THEN `check:ds`'s exit code must still be 0 for every other passing check — verified by actually running `npm run check:ds` and reading `EXIT=0` (BR-2/BR-3).

## Data
- No schema/DB change. No production code changed (`components/**`, `app/**`, `lib/**`, `prisma/**` untouched). Files touched: `scripts/check-scale.mjs`, `scripts/check-ds.mjs` (guard + wiring), `__tests__/cam-565-scale-guard-text-scale.test.ts` (new), this `story.md`. Migration: none.

## Seams & refs
- Reuse: `scripts/check-scale.mjs` is the single owner of the M1-M4 rules and `runScaleGuard()`; `scripts/check-ds.mjs` is the single caller that folds them into the pre-merge gate — no parallel scale-checking script created. The fixture-line-test convention (`isX(line) === true/false`, both directions) is `__tests__/cam-552-mobile-scale.test.ts`'s own established pattern, reused verbatim rather than invented. The 150%-scale real-browser technique (`page.addStyleTag({ content: "html { font-size: 24px !important; }" })`) already lives in `e2e/regression/cam-560-category-label-overlap.spec.ts` and `e2e/regression/cam-558-touch-targets.spec.ts` — not reinvented here (BR-4).
- Refs: `DESIGN.md` §2.0 "Responsive scale" (CAM-552) · `.claude/rules/ops.md` "report → clear to 0 → blocking" rollout rule · CAM-560 story.md's Self-verify section (the exact 150%/near-miss measurement this rule's rationale cites).

## Out of scope
- Fixing the 2 real M4 findings (`components/Navbar.tsx:160`'s search-bar guest-label container, `components/ui/filter-chip.tsx:45`'s pill variant) — both are `components/**`, outside this dispatch's allowed file surface, and neither is proven broken by a real 150% render yet (M4 is a static heuristic, "worth reviewing," not a confirmed defect). On inspection: `Navbar.tsx:160`'s at-risk child span already carries `truncate` (clips to an ellipsis instead of spilling into a sibling, unlike CAM-560's un-truncated label) so it is lower-risk than it looks; `filter-chip.tsx`'s pill variant is used inside `flex flex-wrap` rows (`FilterModal.tsx`, `SearchModal.tsx`), which wrap to a new line under pressure rather than force compression the way CategoryBar's `overflow-x-auto` non-wrapping row does. Both notes are informational only, not a fix. → follow-up ticket, if the owner wants it pursued: audit + fix these two, then clear M4's backlog to 0.
- Promoting M4 to blocking anywhere — brand new rule, unproven at scale, per BR-2. → the same follow-up ticket, once the backlog above is 0.
- A generic, app-wide Playwright sweep that renders every route at 150% and checks arbitrary sibling geometry — a much larger, higher-risk lift than this story's file surface allows; BR-4 explains why the existing per-component e2e technique (CAM-558/CAM-560) already covers the real-browser side without it.
- Widening M1/M2's existing blocking scope — unrelated to this story, already governed by its own named backlog in `.claude/rules/ops.md`.

## Self-verify
- AC-1/AC-2 → unit (`__tests__/cam-565-scale-guard-text-scale.test.ts`, "PROVE-IT (red)"/"PROVE-IT (green)" cases) — both directions on the reconstructed real historical string, not a synthetic invention.
- AC-3 → unit, same file, `isMinWidthScaleRisk` run against every line of the live `components/CategoryBar.tsx` read off disk.
- AC-4 → unit, same file, `runScaleGuard().textScaleRisk` filtered to M4, asserted equal to the exact 2 locations; cross-checked by hand against a real `node scripts/check-scale.mjs` run (pasted below).
- AC-5 → real run: `npm run check:ds` → `EXIT=0`, `check:ds — PASS (0 violations)`, with the M4 backlog printed, not hidden.
- Story-specific: `npx vitest run __tests__/cam-552-mobile-scale.test.ts __tests__/cam-560-category-label-overlap.test.ts __tests__/cam-558-touch-floor.test.ts __tests__/cam-565-scale-guard-text-scale.test.ts` all green, unedited outside the new file (137 + 20 = 157 tests) · `npm run typecheck` clean · `npm run lint` 0 errors · full `npx vitest run` as the LAST act.
- Gate = `/quality-gate` · Done = every AC verified on localhost before merge into `dev`.

## Real backlog (from an actual `node scripts/check-scale.mjs` run, 2026-07-27)
```
ok   (0 blocking)      M4-min-width-literal-not-shrink-safe  [report-only(repo-wide, new)]  backlog=2

check:scale — 2 text-scale-risk finding(s) (CAM-565, M4), NOT blocking yet:
    components/Navbar.tsx:160  [M4-min-width-literal-not-shrink-safe]  <div className="pl-6 pr-2 py-2 flex items-center gap-3 min-w-[140px]">
    components/ui/filter-chip.tsx:45  [M4-min-width-literal-not-shrink-safe]  "inline-flex items-center gap-2 h-11 min-w-[44px] px-4 md:px-5 rounded-full border type-label transition-color
  Review each against a real 150% text-scale render before clearing this backlog.
```
Neither item is fixed here (see `## Out of scope`); both are named, counted, and carry an inspection note above, per `.claude/rules/ops.md`'s "never tune a guard to pass the current code" rule.

## Changelog
- v1 (2026-07-27) — created; M4 added report-only; both-directions proof written; real backlog (2) measured and reported.
