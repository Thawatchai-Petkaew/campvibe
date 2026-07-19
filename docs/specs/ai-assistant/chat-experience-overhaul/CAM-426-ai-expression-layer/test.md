---
linear: CAM-426
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: test
owner: qa-engineer
status: Green — 0 open defects, ready for security
version: v1
updated: 2026-07-19
---
# Test — AI Expression Layer · น้องกองไฟ camping glass surface (CAM-426)

## Test strategy note (read first)

No `story.md`/AC-n table exists for CAM-426 — it is a **design-artifact-driven G2 exception**
(self-approved under the owner's CAM-426 autonomy delegation, `design.md` §11); the design
doc's §10 "Frontend build checklist" is the acceptance surface. Only checklist items **1, 2,
3, 4, 6, 7** (partial) are in THIS diff's scope — items 8/9 (`AiChatCampCard`/`AiChatDetailCard`,
gaps G4/G5) are explicitly out of scope per the shipped test file's own header comment and are
NOT built here (confirmed: `git log --follow` shows `AiChatCampCard.tsx` untouched since CAM-272).

`components/ai-chat/*` are `"use client"` components with no jsdom/RTL harness in this repo
for this class (`vitest.config` `environment: 'node'`, `HTMLCanvasElement.getContext` also
unavailable) — source-inspection Prove-It tests are this repo's established precedent
(`cam-272-ai-chat-components.test.ts`, `cam-411-assistant-personality.test.ts`,
`cam-425-centered-loading-and-single-thread.test.ts`). QA independently re-verified the shipped
suite (not accepted on frontend's self-report alone): hand-verified Prove-It red-then-green on
the entire new 34-assertion test file against the actual pre-fix source, audited the 2 updated
pinned tests (`cam-272`, `cam-411`) for legitimacy, and independently reproduced the
"pre-existing delivery-client failure" claim.

## AC (design.md §10 checklist item) -> test matrix

| Item / area | risk | type | test file | status |
|---|---|---|---|---|
| §1: all 7 `--ai-*` tokens declared in `:root` (light) + `.dark` (2x each) + mapped to `@theme inline` utilities (`bg-ai-*`/`shadow-ai-glow`) | H | unit (source-inspection) | `cam-426-ai-expression-layer.test.ts` | pass |
| §1(d)/§11: `.ai-aurora` backdrop + 3 named loops (`ai-aurora-drift`/`ai-flame-glow`/`ai-materialize`) exist gated inside `prefers-reduced-motion: no-preference`; ALL turn `animation: none` inside the `reduce` block | H | unit (source-inspection) | `cam-426-ai-expression-layer.test.ts` | pass |
| §2: `DESIGN.md` §2.1 sanctioned-exception prose recorded (scope + closed token set + readability constraint) | M | unit (source-inspection) | `cam-426-ai-expression-layer.test.ts` | pass |
| §3 a11y: `AiAmbientCanvas` is `aria-hidden="true"` + `role="presentation"` + `pointer-events-none` (carries no information) | H | unit (source-inspection) | `cam-426-ai-expression-layer.test.ts` | pass |
| §3 motion-gate: loop runs only under `no-preference`, re-checks on the `change` event, renders one static dim frame (no rAF) under reduce | H | unit (source-inspection) + **owner-verify** (visual, browser-only) | `cam-426-ai-expression-layer.test.ts` | pass |
| §3 perf: pause on `visibilitychange`/`document.hidden`; ~30fps delta-accumulator throttle (no per-frame alloc — arrays pre-seeded); DPR capped at 2; particle counts halved on narrow viewport / `hardwareConcurrency<=4` | H | unit (source-inspection) + **owner-verify** (INP, browser-only) | `cam-426-ai-expression-layer.test.ts` | pass |
| §3 token-read: colors read via `getComputedStyle(document.documentElement)` for `--ai-ember/-firefly/-star` (no hex/oklch literal in the `.tsx`); re-read on `.dark` class change via `MutationObserver` | H | unit (source-inspection) | `cam-426-ai-expression-layer.test.ts` | pass |
| §3 budget: `AiAmbientCanvas` mounted only via `next/dynamic(ssr:false)` from the panel — never in the critical first-load chunk | M | unit (source-inspection) | `cam-426-ai-expression-layer.test.ts` | pass |
| §9 `AiChatPanel`: shell = `bg-ai-surface shadow-ai-glow backdrop-blur-xl` (old `bg-popover shadow-2xl` gone as a live className); no `shadow-xl` anywhere in the 4 ai-chat surface files (check:ds R2) | H | unit (source-inspection) | `cam-426-ai-expression-layer.test.ts` | pass |
| §3 placement: `.ai-aurora`+`AiAmbientCanvas` stacked `-z-10`/`aria-hidden`; readable content in a `relative z-10` wrapper above it | M | unit (source-inspection) | `cam-426-ai-expression-layer.test.ts` | pass |
| §9 `AiChatAvatar`: flame recolors `text-primary` -> `text-ai-ember` + `fill-current` + `ai-flame-glow` pulse; chip bg stays `bg-primary/10` (unchanged) | M | unit (source-inspection) | `cam-426-ai-expression-layer.test.ts` + `cam-411-assistant-personality.test.ts` (updated) | pass |
| §9 `AiChatMessageList`: all 4 assistant-side rows (answer/typing/rate-limited/disabled) recolor `bg-muted` -> `bg-ai-tint`; user bubble unchanged (`bg-primary`/`text-primary-foreground`, still distinguished by side+fill+avatar) | H | unit (source-inspection) | `cam-426-ai-expression-layer.test.ts` + `cam-272-ai-chat-components.test.ts` (updated) | pass |
| Regression: CAM-425 centered resuming loader (`AiChatAvatar size="lg"` + `role=status`/`aria-live=polite`/`aria-busy`) NOT reverted by this diff | M | re-confirmed by source read (`AiChatMessageList.tsx` lines 90-107 unchanged in substance) | n/a (no dedicated CAM-426 test; behavior untouched) | pass (by inspection) |
| §10 self-verify: `check:palette` green, `check:ds` green (R1-R8, 0 violations) | H | tooling (real run) | `scripts/check-palette.mjs` / `scripts/check-ds.mjs` | pass |
| §9/§10 out of scope: `AiChatCampCard`/`AiChatDetailCard` (§4/§5, gaps G4/G5) — not built, not claimed built | — | n/a | — | correctly deferred |

## Readability / AA contrast — source math + owner-verify (design.md's own honesty note)

`design.md` §1 marks contrast "NOT tool-measured here... axe-verify required" — QA cannot run a
real browser/axe in this harness (`environment: 'node'`). Did the arithmetic that IS checkable
from source: light `--foreground` L=0.148 vs `--ai-tint` L=0.965 (delta 0.817); dark
`--foreground` L=0.987 vs `--ai-tint` L=0.305 (delta 0.682) — both deltas are far past the
~0.35-0.4 OKLCH-lightness-delta zone that reliably clears WCAG AA 4.5:1 for body text, consistent
with the design doc's own "AA by token parity" claim. This is a proxy, not a WCAG contrast-ratio
computation (which needs OKLCH->sRGB relative-luminance conversion) — real axe verification is
an owner-verify row below, not claimed Done here.

## Prove-It — hand-verified red-then-green (independent re-derivation)

1. `git checkout f803036^ -- app/globals.css DESIGN.md components/ai-chat/AiChatAvatar.tsx components/ai-chat/AiChatMessageList.tsx components/ai-chat/AiChatPanel.tsx && rm components/ai-chat/AiAmbientCanvas.tsx` (pre-fix state for all 5 touched/new production files, git-tracked, not a stash).
2. Ran `cam-426-ai-expression-layer.test.ts`: whole suite failed at collection (`ENOENT` — `AiAmbientCanvas.tsx` doesn't exist pre-fix), 0 tests collected — expected, since the file itself is new.
3. Restored `AiAmbientCanvas.tsx` only (still testing against the OLD panel/avatar/list/globals/DESIGN.md) and re-ran: **14 of 25 collected assertions went red** (token/utility assertions, panel glass-surface assertions, avatar ember/glow assertions, `bg-ai-tint` assertions, `shadow-xl` guard) — exactly the ones tied to the reverted files.
4. Restored all 5 files via `git checkout HEAD --` (confirmed `git status --short` clean, no residual diff) and re-ran the full suite: **216/216 files, 7314/7314 tests pass**.

Production files are byte-identical to the shipped commit after every proof; no line was left mutated.

## Pinned-test audit — `cam-272`/`cam-411` updates, legitimate not weakened

Both diffs were re-read against `git diff origin/dev...HEAD`:

1. **`cam-272-ai-chat-components.test.ts`** — one string pin changed from
   `className="max-w-[85%] rounded-2xl bg-muted` to `...bg-ai-tint` with an inline comment citing
   CAM-426/DESIGN.md §2.1. **Legitimate** — this is exactly the "design-system refactor changes
   the canonical class" precedent (qa.md, CAM-224/226/229): the assertion still pins the FULL
   class string post-change, nothing was loosened to a substring or removed.
2. **`cam-411-assistant-personality.test.ts`** — the old `expect(avatarSrc).toContain("text-primary")`
   assertion was removed and replaced with a NEW, more specific test asserting
   `text-ai-ember` + `ai-flame-glow` + `fill-current` together. **Legitimate and net-stronger** —
   coverage did not disappear, it moved to a more specific 3-part assertion in a dedicated test.

No test coverage was net-removed in either file.

## Pre-existing-failure claim — independently reproduced

Frontend reported the delivery-Prisma-client failures as pre-existing/environment-dependent.
Verified, not accepted on claim alone:

- Ran the full suite fresh in this worktree: **3 test files** failed —
  `delivery-client.test.ts` (2 individual test failures), `cam-215-sec-a-access-control.test.ts`
  and `delivery-tickets-api.test.ts` (fail at collection, 0 tests each) — identical root cause:
  `Cannot find package '@/prisma/delivery/generated/delivery-client'`.
- **Confirmed environment-only, not code:** none of these 3 files (nor `lib/delivery/*`) appear
  anywhere in `git diff --stat origin/dev...HEAD` — this diff never touches the delivery-ticket
  schema/client at all. The generated client directory (`prisma/delivery/generated/`) is
  gitignored and only materializes via `npm run delivery:generate` (part of `postinstall`/`build`),
  which this worktree checkout had not yet run.
- Ran `npm run delivery:generate` (a gitignored-artifact regeneration, not a code change) and
  re-ran the full suite: **216/216 files, 7314/7314 tests pass, 0 failed** — confirms no latent
  code defect, only a missing per-worktree generate step (same class of gap CAM-425's QA pass
  documented on this same delivery-client fixture one story ago).
- **Verdict: pre-existing failures confirmed = yes.** Not introduced by this diff.

## Coverage

- **v8-instrumented (`npx vitest run --coverage`), scoped to `components/ai-chat/**`: 0%** for
  every touched/new file (`AiAmbientCanvas.tsx`, `AiChatAvatar.tsx`, `AiChatMessageList.tsx`,
  `AiChatPanel.tsx`) — honestly reported, not fabricated. This is a **repo-wide, pre-existing
  characteristic** of every client component under `components/ai-chat/*` (confirmed: the
  unrelated, untouched `AiChatCampCard.tsx`/`AiChatCardCarousel.tsx`/`use-ai-chat.ts` also show
  0% in the same run) — `environment: 'node'` has no jsdom/render harness, so `fs.readFileSync`-
  based source-inspection tests execute zero lines of the component under test. Not a CAM-426
  regression; matches the exact gap CAM-425's test.md documented one story prior.
  `components/**` + `lib/**` overall: 43.75% stmts (mixed with pure-logic `lib/*` files that DO
  execute normally under this test strategy).
- **Checklist-item-level coverage: 100%** of the items in this diff's scope (matrix above);
  items 8/9 (camp card/detail card) are correctly out of scope, not silently skipped.
- Full suite (real run, last act, after the environment fix):
  `npx vitest run` -> **216/216 files, 7314/7314 tests pass**, 0 failed.
  `npx tsc --noEmit`: clean (0 errors). `npm run lint`: 0 errors, 254 pre-existing warnings
  (none in the 4 touched ai-chat files or the new/updated test files).
  `npm run check:ds`: PASS (0 violations, R1-R8). `npm run check:palette`: PASS (0 violations).

## Owner-verify / staging-G4 rows (browser-only — cannot be proven headless)

| # | Row | Why headless can't prove it |
|---|---|---|
| 1 | Light + dark visual: the campfire-night ambient (aurora + fireflies + stars + embers) reads as dimmed/soft behind the glass panel in BOTH themes, matching design.md §0's "all dimmed and soft" POV, on `/preview` or the live panel | Canvas rendering + OKLCH-to-screen color + `backdrop-blur` compositing are real-GPU/real-browser concerns; `environment: 'node'` has no canvas backend (`getContext` unimplemented) |
| 2 | AA contrast: `text-foreground` on `bg-ai-tint` (assistant bubble) and on `bg-ai-surface` (panel chrome) passes WCAG 2.1 AA in BOTH themes — run axe or a contrast tool against the real rendered panel | Exact WCAG contrast ratio needs OKLCH->sRGB relative-luminance + a real DOM; QA's OKLCH-lightness-delta math above is a strong proxy, not a certified axe pass |
| 3 | Ambient feel / non-competing-with-text: opening the panel and reading a full assistant answer, the fireflies/embers/stars never visually interfere with the text (readability-wins-over-glow, design.md §0/§6) | Subjective-but-specified visual judgment over a live, animated composite — no headless equivalent |
| 4 | Perf: INP is not degraded with the ambient canvas running (design.md §3 budget note: "not measured yet") | Requires a real browser performance trace; the throttle/cap/hidden-pause are the coded guardrails, not a measured number |
| 5 | `prefers-reduced-motion: reduce` (OS-level) actually freezes the aurora/flame/canvas in a real browser, matching the source-verified CSS/JS gating | Media-query evaluation + actual paint state is real-browser territory |

## Defects found

**0.** No defect opened this pass. Prove-It re-derivation (14/25 assertions correctly red
pre-fix on the reverted files, 0/25 collected pre-file-creation, 216/216 green post-fix), the
`cam-272`/`cam-411` pinned-test audit, and the pre-existing-failure repro found no behavioral
discrepancy against the design.md §10 checklist scope, and no coverage was silently dropped.

## Links

`docs/specs/ai-assistant/chat-experience-overhaul/CAM-426-ai-expression-layer/design.md` ·
`.claude/rules/qa.md` · `DESIGN.md` §2.1 · `__tests__/cam-426-ai-expression-layer.test.ts` ·
`__tests__/cam-272-ai-chat-components.test.ts` · `__tests__/cam-411-assistant-personality.test.ts` ·
`components/ai-chat/AiAmbientCanvas.tsx` · `components/ai-chat/AiChatPanel.tsx` ·
`components/ai-chat/AiChatAvatar.tsx` · `components/ai-chat/AiChatMessageList.tsx` ·
`docs/specs/ai-assistant/chat-experience-overhaul/CAM-425-chat-loading-centered-single-thread/test.md`
(source-inspection + pre-existing-failure repro precedent)

## Changelog

- v1 (2026-07-19) — QA verify of the shipped suite (34 new assertions + 2 updated pinned tests,
  frontend-authored in the same commit as the code). Hand-verified Prove-It red-then-green
  (0/25 collected pre-file-creation -> 14/25 red on the reverted-but-present files -> 216/216
  green post-fix). Audited the `cam-272`/`cam-411` pinned-test updates — legitimately updated
  (stronger, more specific assertions), not weakened. Independently reproduced the pre-existing
  delivery-client-family failure (3 files, same root cause, confirmed environment-only via
  `npm run delivery:generate`) -> full suite green. Did the OKLCH-lightness-delta contrast math
  from source as a proxy for the design doc's own "AA by token parity, axe-verify required"
  claim. 0 defects found. 5 browser-only rows named as explicit owner-verify/G4 rows (canvas
  render, AA contrast, ambient feel, INP, reduced-motion). Status: green, ready for
  `next: security`.
