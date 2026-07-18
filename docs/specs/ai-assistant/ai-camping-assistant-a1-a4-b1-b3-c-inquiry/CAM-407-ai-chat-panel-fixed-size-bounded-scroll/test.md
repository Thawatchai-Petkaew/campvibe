---
linear: CAM-407
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — AI chat panel keeps a fixed size, bounded scroll, composer never overlaps (CAM-407)

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 | M | unit (structural) | `__tests__/cam-272-ai-chat-components.test.ts` (`CAM-407` describe, 2 cases: `sm:h-[min(37.5rem,80dvh)]` present + `sm:h-auto` absent; `sm:w-96` present) | ✅ pass |
| AC-1 | M | e2e (independent, ad-hoc Playwright, mocked `/api/ai/chat`) | Panel first-open bounding box measured on an isolated dev server (port 3007) | ✅ pass — 384×600 |
| AC-2 | H | unit (structural) | same describe, 2 cases: header/composer `shrink-0`; `ScrollArea` `min-h-0 flex-1` | ✅ pass |
| AC-2 / EC-1 | H | e2e (independent, ad-hoc Playwright) | 8-turn mocked conversation → scroll-region `scrollHeight` vs `clientHeight` + composer-vs-viewport no-overlap + scroll-to-bottom clip check | ✅ pass — bounded + no overlap |
| AC-3 | L | unit (structural) | same describe, 1 case: card row `w-full max-w-full`, text bubble keeps `max-w-[85%]` | ✅ pass |

## Validation cases
No new form/BR-n validation (layout-only fix; BR-1..3 are structural/CSS rules, not input validation). Regression guard: `sm:h-auto` and the old bare `max-w-[85%]` wrap around cards must never return — asserted as an explicit `not.toContain` in the CAM-407 describe block.

## Independent empirical verification (QA reproduction, real Chromium, zero spend)
Ran on an isolated dev server (`localhost:3007`, separate from the owner's main dev server), with `/api/ai/chat` intercepted via Playwright `page.route` — **no request ever reached the real handler**, so this is zero-spend regardless of `OPENROUTER_API_KEY` state. 8 simulated turns (8 user messages + 8 assistant cards) drove real overflow content.

| Measurement | Value | Verdict |
|---|---|---|
| Panel bbox, first open (before any message) | 384×600 px | matches design.md desktop dims (AC-1) |
| Panel bbox, after 8 turns | 384×600 px | unchanged — panel does not grow (AC-1) |
| ScrollArea viewport bbox | 382×432 px | bounded flex box (AC-2) |
| Viewport `scrollHeight` vs `clientHeight` | 4612 vs 432 | content overflows — real bounded scroll region, not auto-grow (EC-1) |
| Scroll viewport bottom vs composer top | 706 vs 723 (px) | viewport box sits fully above composer — **no container overlap** (AC-2) |
| Last card bbox after `scrollTop = scrollHeight` | bottom = 690 px (≤ viewport bottom 706) | last card stays clipped inside the scroll box, never spills onto the composer (EC-1) |

This independently reproduces the builder's self-verify claim (384×600 / 432px-bounded viewport / no composer overlap in a multi-card conversation) using a fresh script and fresh browser session, not a re-run of the builder's own test.

## Coverage
Vitest v8 coverage on the two touched files (`AiChatPanel.tsx`, `AiChatMessageList.tsx`) reports **0%** — this is a pre-existing characteristic of the whole CAM-272/407 suite (all 54 tests in this file are source-inspection/`[structural]` — they `readFileSync` the component source and regex-assert class strings, never `render()` the component, so v8's runtime-execution coverage instrument never fires). This is not a gap introduced by CAM-407; the same 0%-instrumented pattern holds for the other ~49 CAM-272 tests in the same file. Real behavior is instead proven by the independent Playwright measurement above (a true render + mocked-network Prove-It), which is stronger evidence than a coverage percentage for a pure-CSS layout fix. Repo-wide coverage: not measured (out of scope for a spec-lite light-verify pass).

## Links
`story.md` (AC/BR) · `.claude/rules/qa.md`

## Changelog
- v1 (2026-07-18) — created (QA light-verify pass, independent empirical reproduction)
