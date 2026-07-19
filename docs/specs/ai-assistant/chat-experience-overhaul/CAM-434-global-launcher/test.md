---
linear: CAM-434
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: test
owner: qa-engineer
status: Green — 0 open defects, ready for security
version: v1
updated: 2026-07-19
---
# Test — chat launcher on every page / global mount (CAM-434)

## Test strategy note (read first)

`components/ai-chat/*` are `"use client"` components with no jsdom/RTL harness in this repo
(`vitest.config.ts` `environment: 'node'`) — source-inspection Prove-It tests are this repo's
established precedent (`cam-272`, `cam-411`, `cam-426`, `cam-429`, `cam-432`). This is an
**independent QA verify** of a frontend-authored diff (PR #503, branch
`feature/cam-434-global-launcher`) — not accepted on the frontend self-report alone: I
hand-verified Prove-It red-then-green on the entire shipped 7-assertion test file against the
actual pre-fix (PR #501-merged / `59d4ca3`) source, audited the 1 updated pinned test
(`cam-272`) for legitimacy, and independently confirmed the route-hide guard + no-double-mount
by reading the shipped `app/layout.tsx`/`app/page.tsx`/`AiChatLauncher.tsx` diff directly.

## AC→test matrix

| AC | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (launcher renders on any consumer route other than Home, from root layout) | H | unit (source-inspection) | `cam-434-global-launcher.test.ts` | pass |
| AC-2 (Home shows exactly one instance — Home-specific mount removed) | H | unit (source-inspection) | `cam-434-global-launcher.test.ts` + updated `cam-272-ai-chat-components.test.ts` pin | pass |
| AC-3 (panel + ambient canvas stay `next/dynamic(ssr:false)`, mount only after first tap — no new bundle cost) | H | unit (source-inspection) | `cam-434-global-launcher.test.ts` + unchanged pre-existing `cam-272` lazy-load assertions | pass |
| AC-4 (no launcher on `/status` or `/status/map`, token-gated ops tooling) | M | unit (source-inspection) | `cam-434-global-launcher.test.ts` | pass |
| AC-5 (no launcher on `/coming-soon`, no-navigation holding page) | M | unit (source-inspection) | `cam-434-global-launcher.test.ts` | pass |
| BR-1 (mounts exactly once, inside `LanguageProvider` so `useLanguage()` is in scope; not re-mounted per route) | H | unit (source-inspection, ordering check on layout markup) | `cam-434-global-launcher.test.ts` | pass |
| BR-3 (route-hide list stays small/explicit — `/coming-soon` + `/status`(+sub-paths) only, not a general config table) | M | unit (source-inspection) | `cam-434-global-launcher.test.ts` | pass |
| EC-1 (no `Navbar`/`HostOnboardingFab` route → launcher still renders `fixed bottom-10 right-6`, no collision) | L | unit (source-inspection, position is a fixed literal independent of any other component's DOM) | pre-existing, unchanged `cam-272-ai-chat-components.test.ts` (`bottom-10 right-6` pin) | pass |
| EC-2 (panel/canvas never enter the tree until first tap) | M | unit (source-inspection) | `cam-434-global-launcher.test.ts` (`{open && <AiChatPanel`) — same guard, unchanged since CAM-272 | pass |

Type mix: 9/9 rows unit/source-inspection (0% integ/e2e) — consistent with the established
precedent for this component family (no jsdom harness in this repo; see strategy note above),
not a deviation this story introduces.

## Independent verification performed (beyond reading the diff)

1. **Double-mount check** — `grep -rln "AiChatLauncher"` across the whole repo (excluding
   `node_modules`/`.next`/`.claude`): only `app/layout.tsx` (the new single mount),
   `components/HostOnboardingFab.tsx` and `components/ai-chat/AiChatPanel.tsx` (doc-comment
   references only, no JSX usage), and the test files. Confirms exactly one runtime mount point.
2. **Guard logic re-derivation** — read `isHiddenRoute()` directly: `pathname === "/coming-soon"
   || pathname === "/status" || pathname.startsWith("/status/")`. Covers `/status`, `/status/map`,
   and any future `/status/*` sub-route; does not over-match (e.g. `/status-page` would NOT match
   `startsWith("/status/")` nor the exact `"/status"`, correctly excluded from the hide-list).
3. **Provider-scope check** — confirmed via string-index ordering in `layoutSrc` that
   `<AiChatLauncher />` sits between `<LanguageProvider>` and `</LanguageProvider>`, so
   `useLanguage()` resolves at render (BR-1).
4. **`/status` + `/coming-soon` route inventory** — confirmed both routes exist
   (`app/status/page.tsx`, `app/status/map/page.tsx`, `app/coming-soon/page.tsx`) and neither
   independently renders its own `<AiChatLauncher>` — the guard is the only thing suppressing it.

## Pinned-test audit — 1 updated stale pin, legitimate not weakened

Re-read the diff against `git diff 59d4ca3 HEAD -- __tests__/cam-272-ai-chat-components.test.ts`:

1. **`cam-272-ai-chat-components.test.ts`** — old assertion pinned `app/page.tsx mounts the
   launcher unconditionally on Home` (`pageSrc.toContain("<AiChatLauncher")` +
   `not.toMatch(/\{.*&&\s*<AiChatLauncher/)`); replaced with `layoutSrc.toContain("<AiChatLauncher")`
   + `pageSrc.not.toContain("<AiChatLauncher")`. **Legitimate** — this story's whole point (AC-1/
   AC-2) is moving the mount point from `page.tsx` to `layout.tsx`; the describe block's own title
   was updated from "the launcher always renders on Home" to "the launcher always renders (root
   layout, every page)" — same BR-1 concern (never gated on a disabled flag), same negative check
   preserved (`not.toMatch(/if\s*\(.*disabled.*\)\s*return null/)`), only the mount-location pin
   correctly follows the diff. No coverage was removed — the disabled-flag check and the
   `data-testid` check in the same describe block are untouched.

No other file in `__tests__/` references the old Home-only mount assumption (confirmed by grep
across `docs/specs/ai-assistant/` — CAM-429/430/431/432/411 all reference `AiChatLauncher.tsx`
for unrelated concerns: position, fire-tone, avatar, panel header — none assert *where* it
mounts except `cam-272`, now correctly updated).

## Prove-It — hand-verified red-then-green (independent re-derivation)

1. `git checkout 59d4ca3 -- app/layout.tsx app/page.tsx components/ai-chat/AiChatLauncher.tsx`
   (restores the pre-CAM-434, Home-only-mount source into the working tree, no branch switch).
2. Ran `npx vitest run __tests__/cam-434-global-launcher.test.ts
   __tests__/cam-272-ai-chat-components.test.ts` → **2 files failed, 7 of 62 tests red**, exactly
   the assertions tied to this diff (layout import/mount, provider-scope ordering, page.tsx
   no-longer-mounting, the 3 route-hide-guard assertions, `usePathname` import) — the remaining
   55 tests (BR-4 plain-text safety, `data-testid`, position/fire-tone/aura, lazy-panel wiring
   unrelated to route-hide, etc.) correctly stayed green since they don't depend on this diff.
3. `git checkout HEAD -- app/layout.tsx app/page.tsx components/ai-chat/AiChatLauncher.tsx`
   (`git status --short` confirmed clean, zero diff vs HEAD) and re-ran the same two files:
   **2 files passed, 62/62 tests green**.

Production files are byte-identical to the shipped commit after the proof; no line was left
mutated in `app/*`/`components/ai-chat/*`.

## Coverage

- **v8-instrumented (`npx vitest run --coverage --coverage.include=...`), scoped to the 3 touched
  production files (`app/layout.tsx`, `app/page.tsx`, `components/ai-chat/AiChatLauncher.tsx`):
  0% / not meaningfully measurable** — `environment: 'node'` has no jsdom/render harness, and
  these tests read the files via `fs.readFileSync` (never `import`ed/executed), so V8 never
  instruments them. Confirmed this is **not a regression this story introduces**: re-ran the same
  scoped coverage command against the pre-CAM-434 commit (`59d4ca3`) for the same 2 pre-existing
  files (`AiChatLauncher.tsx`, `page.tsx`) — identical 0% baseline. This is the same repo-wide,
  pre-existing characteristic documented in `CAM-272`, `CAM-411`, `CAM-429`, `CAM-432`'s `test.md`
  for every `"use client"` `ai-chat` component tested this way — an architecture/harness change,
  out of scope per `.claude/rules/qa.md` §"NOT for".
- **AC/BR/EC-level coverage: 100%** of this story's scope (matrix above) — every AC row (AC-1..
  AC-5), every BR rule (BR-1, BR-3; BR-2 is the unchanged lazy-load contract, verified still
  intact), every EC edge case (EC-1, EC-2) has at least one passing, Prove-It-verified assertion.
- Full suite (real run, last act after the Prove-It restore):
  `npx vitest run` → **228/228 files, 7454/7454 tests pass**, 0 failed.
  `npx tsc --noEmit`: clean (0 errors) — required regenerating the gitignored
  `prisma/delivery/generated/delivery-client` via `npm run delivery:generate` first (a
  per-worktree setup step for this fresh worktree, not a code fix; the generated dir is
  gitignored and unrelated to this diff — before regenerating, 22 type errors surfaced across
  5 files rooted in the single missing module, including the "known env-dependent"
  `delivery-client.test.ts`; all green/clean after regeneration, confirmed by re-running
  `delivery-client.test.ts` + `cam-434-global-launcher.test.ts` + `cam-272-ai-chat-components.test.ts`
  together — 3 files, 64/64 pass).
  `npm run lint`: 0 errors, 256 pre-existing warnings, none in the 3 touched files.
  `npm run check:ds`: PASS (0 violations, R1-R8). `npm run check:palette`: PASS (0 violations).

## Owner-verify / staging-G4 rows (browser-only — cannot be proven headless)

| # | Row | Why headless can't prove it |
|---|---|---|
| 1 | **Launcher now appears on non-Home routes** — visiting `/campgrounds`, `/bookings`, `/dashboard` (any consumer route) shows the same floating fire-mark FAB in the bottom-right corner as Home, with identical tap-to-open behavior | Rendered presence across real client-side navigations (App Router transitions) is real-browser territory; source confirms the single root-layout mount + `usePathname()` re-evaluates per route, but the actual visible FAB surviving a client nav to each named route is a real-render check |
| 2 | **Hidden on `/status` and `/coming-soon`** — visiting the token-gated `/status` dashboard, `/status/map` 3D board, and the pre-launch `/coming-soon` holding page shows NO floating chat FAB anywhere on screen | Source confirms `isHiddenRoute()` returns `null` before any markup for these paths; the actual absence of any floating element at those real URLs (no residual FAB from another component) is a real-render confirmation |
| 3 | **No visual/functional regression on Home** — Home still shows exactly one launcher FAB (not two, not zero), in the same position/style as before this change | Source confirms `page.tsx` no longer mounts it and `layout.tsx` is the sole mount; the rendered single-instance-not-duplicated result on the real Home page is browser-only |
| 4 | **No perceptible initial-load slowdown on a first visit to any route** (AC-3) | Bundle-size/timing claims require a real Lighthouse/PageSpeed run per `.claude/rules/performance.md`; not measured in this pass — source confirms the `next/dynamic(ssr:false)` contract is unchanged, so the panel/canvas import cost is unaffected, but the actual perceived load time is a real-browser measurement (state: not measured) |

## Defects found

**0 production defects.** The 1 pinned-test update (`cam-272`) was audited and is legitimate
(see audit above); no test-coverage gap was found in the shipped 7-assertion file — it covers
all 5 AC rows + both named BR rules (BR-1, BR-3) directly, and the 2 EC rows resolve to
pre-existing, unchanged guards (position literal independent of other DOM; the `{open &&
<AiChatPanel` lazy gate).

## Links

`docs/specs/ai-assistant/chat-experience-overhaul/CAM-434-global-launcher/story.md` ·
`.claude/rules/qa.md` · `__tests__/cam-434-global-launcher.test.ts` ·
`__tests__/cam-272-ai-chat-components.test.ts` ·
`app/layout.tsx` · `app/page.tsx` · `components/ai-chat/AiChatLauncher.tsx` ·
`docs/specs/ai-assistant/chat-experience-overhaul/CAM-432-fire-aura-flicker/test.md`
(source-inspection + coverage-honesty + Prove-It precedent this file follows)

## Changelog

- v1 (2026-07-19) — Independent QA verify of the shipped suite (PR #503, 7 new assertions +
  1 updated pin, frontend-authored). Hand-verified Prove-It red-then-green on the full shipped
  file (7/62 correctly red against the pre-CAM-434 source, 62/62 green after restore). Audited
  the 1 updated pinned test (`cam-272`) — legitimate, not weakened. Confirmed no double-mount via
  independent repo-wide grep; confirmed the route-hide guard's exact match semantics and
  provider-scope ordering by direct source read. Regenerated the gitignored delivery-client for
  this fresh worktree (unrelated to the diff) — resolved 22 cascading type errors rooted in one
  missing generated module, including the noted env-dependent `delivery-client.test.ts`. Full
  suite 228/228 files, 7454/7454 tests green; typecheck clean; lint 0 errors/256 pre-existing
  warnings (0 new); `check:ds`/`check:palette` both PASS. 0 production defects. 4 browser-only
  rows named as explicit owner-verify/G4 rows (non-Home appearance, hidden on /status +
  /coming-soon, Home single-instance, initial-load perf not measured). Status: green, ready for
  `next: security`.
