---
linear: CAM-411
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — Assistant gets a name, avatar and camp-friend personality (CAM-411)

## Verdict — PASS, no defects found

Independent QA verify (LIGHT-MEDIUM) of the already-committed CAM-411 diff
(847672b, PR #477): walked every AC/BR/EC against the tests, ran an
independent empirical + axe pass on a live instance of THIS branch (own
worktree dev server, port 3200 — never the owner's port-3000 process), did
two Prove-It red→green passes on the highest-risk area (system-prompt
tone-line placement + uniqueness), verified the sibling CAM-405/CAM-270
prompt-safety regression guards are untouched and still green, and ran the
full suite as the last act. No Critical/Important defect found.

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-6 (BR-4) — system-prompt tone line reaches the model, ordered before the injection-guard sentence, exactly once | H (prompt-safety/security-adjacent) | unit (real mocked-fetch, not source-inspection) | `cam-411-assistant-personality.test.ts` (`AC-6/BR-4` describe) | ✅ pass + Prove-It'd (2x, see below) |
| Regression guard — CAM-405 output-style rules + delimiter/injection-defense sentence still exactly once | H | unit (real mocked-fetch) | `cam-270-openrouter-client.test.ts` (untouched by this diff) | ✅ pass, confirmed untouched-green |
| AC-1 — header: Flame avatar + `น้องกองไฟ` over `ผู้ช่วยหาที่กางเต็นท์`, aria-label composes both | M | unit (structural) + own empirical (real browser) | `cam-411-assistant-personality.test.ts` (`AC-1`), `cam-272-ai-chat-components.test.ts` (updated) | ✅ pass, empirically confirmed |
| AC-2/BR-5 — welcome: avatar hero, name-voiced greeting, `ลองถามแบบนี้ดู` label above 3 pills bumped to h-11/44px | M | unit (structural) + own empirical (real browser, boundingBox) | `cam-411-assistant-personality.test.ts` (`AC-2/BR-5`) | ✅ pass, empirically confirmed 44px |
| AC-3/BR-3/EC-1 — avatar beside every assistant-side row (answer/typing/rate-limited/disabled/error), motion-safe entrance | M | unit (structural) | `cam-411-assistant-personality.test.ts` (`AC-3/BR-3/EC-1`) | ✅ pass (5/5 rows counted) |
| AC-4 — zero-result copy is name-voiced | M | unit | `cam-411-assistant-personality.test.ts`, `cam-272-ai-chat-i18n.test.ts` (updated) | ✅ pass |
| AC-5 — launcher: Flame mark, `คุยกับน้องกองไฟ` accessible name | M | unit (structural) + own empirical (real browser) | `cam-411-assistant-personality.test.ts` (`AC-5`) | ✅ pass, empirically confirmed (TH+EN) |
| EC-2 — notice bubbles keep avatar; `disabled` name-voiced, `error`/`rateLimited` unchanged | L | unit | `cam-411-assistant-personality.test.ts` (`EC-2`) | ✅ pass |
| Structural — no emoji, no raw Thai glyph in JSX literal, token-only (no hex/px) | L | unit (structural) | `cam-411-assistant-personality.test.ts` (`Icons/copy`) | ✅ pass |

## Coverage matrix per AC (5-bucket)
| AC/BR | normal | null/empty | boundary | error/validation | concurrent/ordering |
|---|---|---|---|---|---|
| AC-6/BR-4 | ✅ tone line present, real fetch body inspected | ⚪ N/A | ⚪ N/A | ⚪ N/A (model instruction, not user input) | ✅ ordering asserted (tone line index < guard-sentence index) + exactly-once (no duplication across turns) |
| AC-1/AC-5 (i18n/a11y) | ✅ TH verbatim + aria-label compose | ⚪ N/A | ⚪ N/A | ⚪ N/A | ⚪ N/A |
| AC-2/BR-5 (tap target) | ✅ 44px via `size="default"` | ⚪ N/A | ✅ boundary: exactly 44px measured live (not ≥45, not 40) | ⚪ N/A | ⚪ N/A |
| AC-3/EC-1 (motion) | ✅ motion-safe classes present | ⚪ N/A | ⚪ N/A | ⚪ N/A (EC-1 = reduced-motion is the null-case here) | ✅ EC-1 confirmed live: `emulateMedia({reducedMotion:'reduce'})` → welcome content visible immediately, no animation gating |
| EC-2 | ✅ 5/5 notice rows carry avatar | ⚪ N/A | ⚪ N/A | ⚪ N/A | ⚪ N/A |

## Independent empirical + axe pass (own worktree instance, port 3200 — never touched the owner's port-3000 process)
Ran `npm run dev -- -p 3200` against THIS branch's own worktree checkout, confirmed
via `lsof` that port 3000 was already occupied by a foreign process (left
untouched) before choosing 3200. Wrote a **temporary** Playwright spec
(`e2e/tmp-cam-411-axe.spec.ts`, deleted after the run — not part of this
diff) and ran it with `--project=chromium` (config's `reuseExistingServer`
skipped the prod build/start entirely since 3000 already answered, so no
build/deploy risk):

- Opened `/`, set `campvibe_lang=th`, clicked `btn--ai-chat-launcher` →
  confirmed accessible name `คุยกับน้องกองไฟ` (TH) and, on a second run without
  the locale override, `Chat with Kongfai` (EN) — **both languages confirmed
  live**, matching AC-1/AC-5.
- Confirmed panel `aria-label` composes to exactly `น้องกองไฟ ผู้ช่วยหาที่กางเต็นท์`.
- Confirmed welcome copy renders verbatim: `สวัสดี เราน้องกองไฟเอง อยากได้ที่กางเต็นท์แบบไหน ลองเล่าให้ฟังได้เลย`
  and `ลองถามแบบนี้ดู`.
- Confirmed every `img--ai-chat-avatar` node (>0 found) carries `aria-hidden="true"`.
- **Measured (not source-inspected) the welcome pill's real `boundingBox().height` = 44px** —
  confirms BR-5's tap-target bump is real, not just class-name-present.
- **axe scan** (`@axe-core/playwright`, `wcag2a`+`wcag2aa`+`best-practice`,
  scoped to `[data-testid="dialog--ai-chat-panel"]`) on the open welcome
  state: **0 critical/serious violations**.
- Reduced-motion pass (`emulateMedia({reducedMotion:'reduce'})`): panel opens,
  welcome content visible immediately — confirms EC-1's "instant appear"
  behavior live, not just via the `motion-safe:` class-name grep.
- No message was sent in the live browser (composer/suggestion pills were
  never clicked) — per the dispatch's "no paid calls, mock everywhere," the
  actual model-call path (AC-3's answer bubble, AC-6's tone line reaching a
  real network call) is verified only via the existing mocked-`fetch` unit
  tests, never a live OpenRouter call.
- Cleanup: temp spec deleted, port-3200 dev server killed, `git status`
  confirmed clean before continuing.

**Not verified live (owner-verify, per story.md `## Self-verify`):** AC-6's
actual model tone (a real completion reading warm/plain in production) —
requires a live model call, explicitly out of this dispatch's scope.

## Prove-It (red↔green evidence — prompt-safety, highest risk area)
1. **Order regression** — temporarily moved the tone line to AFTER the
   injection-guard sentence in `buildSystemPrompt()` → the "placed before the
   injection-guard sentence" test went red
   (`expected 432 to be less than 213`) → reverted (`git status` clean) →
   green again (45/45 across the CAM-411 + CAM-270 openrouter files).
2. **Duplication regression** — temporarily inserted a second `น้องกองไฟ`
   occurrence into the prompt array → the "tone line appears exactly once"
   test went red (`expected 2 to be 1`) → reverted → green again.
Both prove the AC-6/BR-4 guards have real teeth, not passive string checks.

## Grep-pin check on cam-272 test updates (no weakened asserts)
Diffed `__tests__/cam-272-ai-chat-components.test.ts` and
`__tests__/cam-272-ai-chat-i18n.test.ts` against `dev`: every changed
assertion still asserts an **exact** string/value — the panel aria-label
test moved from `t.aiChat.title` to the composed `` `${t.aiChat.name} ${t.aiChat.role}` ``
(a real behavior change per BR-1, not a loosened check), and every i18n
assertion still does `expect(th.X).toBe("<exact new copy>")` (never
downgraded to `.toContain`/`.toMatch`/a substring). Cross-checked every new
Thai string against `locales/translations.json`'s diff — verbatim match,
including the design.md copy table, no em-dash separators.

## Pills/chips 44px + no double-style drift (explicit check requested)
Two DISTINCT pill populations both reach 44px, via two different (both
correct) mechanisms — not the same element double-bumped:
- **Welcome pills** (`btn--ai-chat-suggestion`): `size="default"` natively
  gives `h-11` (Button component, confirmed in `components/ui/button.tsx`).
  This is the CAM-411 change (was `size="sm"`/h-9).
- **In-answer follow-up chips** (`btn--ai-chat-suggestion-chip`, CAM-410,
  untouched by this diff — out of CAM-411's stated scope): `size="sm"`
  (h-9) + an explicit `className="h-11 ..."` override; confirmed `cn()` uses
  `tailwind-merge`, which deduplicates the conflicting height utility and
  keeps `h-11` — no stacked/duplicate class, clean single 44px result.
`npm run check:ds` (R7 "Button inline height" guard) passes with 0
violations, independently confirming no drift. The two populations differ
slightly in horizontal padding (`px-4` vs `px-3`, inherited from their
different `size`) — a pre-existing CAM-410 cosmetic shape, out of this
story's scope, **Info only, not filed as a defect**.

## Mock-boundary audit
`cam-411-assistant-personality.test.ts`'s AC-6/BR-4 tests mock only
`global.fetch` (the outer network boundary) — the real `runAssistantTurn` /
`buildSystemPrompt` logic executes unmocked. All other tests in the file are
source-inspection (`readFileSync` on the shipped `.tsx`), the same
established convention as the sibling `cam-272-ai-chat-components.test.ts`
(see that file's own precedent, and CAM-272's `test.md` "Why the 0%s are
honest" section).

## Coverage (metric honesty)
Measured via (diff-scoped, not whole-repo), full 13-file relevant suite:
```
npx vitest run --coverage \
  __tests__/cam-411-assistant-personality.test.ts __tests__/cam-272-ai-chat-components.test.ts \
  __tests__/cam-272-ai-chat-i18n.test.ts __tests__/cam-272-ai-chat-conversation.test.ts \
  __tests__/cam-270-openrouter-client.test.ts __tests__/cam-271-ai-chat-route.test.ts \
  __tests__/cam-408-*.test.ts __tests__/cam-404-*.test.ts __tests__/cam-409-*.test.ts __tests__/cam-410-*.test.ts \
  --coverage.include='components/ai-chat/AiChatAvatar.tsx' --coverage.include='components/ai-chat/AiChatLauncher.tsx' \
  --coverage.include='components/ai-chat/AiChatPanel.tsx' --coverage.include='components/ai-chat/AiChatMessageList.tsx' \
  --coverage.include='lib/ai/openrouter-client.ts'
```

| File | Stmts | Branch | Funcs | Lines | Note |
|---|---|---|---|---|---|
| `lib/ai/openrouter-client.ts` (CAM-411's actual new code: 1 tone-line array entry + its own placement/uniqueness) | **97.85%** | **90.9%** | **100%** | **100%** | real execution via mocked-fetch `runAssistantTurn()` calls — well above the 80% floor |
| `components/ai-chat/{AiChatAvatar,AiChatLauncher,AiChatPanel,AiChatMessageList}.tsx` | 0% | 0% | 0% | 0% | **structural property of source-inspection testing, not undertested** — identical, pre-existing, documented precedent (CAM-272's own `test.md`); this repo's `vitest.config.ts` runs `environment: 'node'`, no jsdom/render harness for this component family (confirmed since CAM-272, unchanged) |

**Why the 0%s are honest, not a gap:** V8 instruments executed bytecode; a
`fs.readFileSync` source-inspection test never executes the component, so it
reports 0% regardless of how thoroughly the wiring is proven. The floor for
this layer is the AC→test matrix above (9/9 rows pass) + the two Prove-It
red/green demonstrations + my own independent empirical/axe pass against a
live render of these exact files (§ above) — which is the layer v8 cannot
measure but that genuinely exercises the components. Combined, this matches
(not regresses) the coverage-honesty bar this feature family has held since
CAM-272.

## Localhost / browser-only owner-verify rows (unchanged from CAM-272, per story.md `## Self-verify`)
1. AC-6 — a real model completion actually reads warm/plain-language in
   production (requires a live OpenRouter call; explicitly out of this
   dispatch's "no paid calls" scope).
2. Composite tint / graphics contrast of the `Flame` mark on `bg-primary/10`
   at ≥3:1 — my own axe pass found 0 critical/serious violations on the open
   panel, which covers this; re-confirm at G4 on the real Staging URL per
   design.md's own note.

## Defects
None found. No sub-ticket opened.

## Full suite (last act, run after the independent verify pass)
`npx vitest run` → **190 test files passed, 1 failed (191 total)**; **6952
tests passed, 1 failed (6953 total)**. The 1 failure is the
**pre-flagged, known, environment-dependent** `__tests__/delivery-client.test.ts`
(env-dependent per the dispatch contract — ignored, not chased).

Note: on the first run, 2 additional failures appeared
(`cam-215-sec-a-access-control`-style stale-ref noise in
`f5-account-misc.test.ts` / `f6-palette-guard.test.ts`, both asserting
`app/status/page.tsx` is absent from `git diff staging --name-only`) — traced
to this worktree's local `staging` ref being 13 days stale (`d8720f2`,
2026-07-05) vs `origin/staging` (`f88939d`, 2026-07-18); confirmed
`git diff origin/staging --name-only` never contained `app/status/page.tsx`
(0 hits) — i.e. **not a CAM-411 defect**, a local-ref hygiene artifact. Ran
`git fetch origin staging:staging` (a safe fast-forward, `staging` was not
checked out in any worktree) to resolve it for a clean final run.

`npm run lint` (scoped to every CAM-411-touched file) → **0 errors**, 2
pre-existing-pattern warnings (`Unused eslint-disable directive` in
`cam-411-assistant-personality.test.ts:164` and the sibling
`cam-272-ai-chat-components.test.ts:307` — identical copy-pasted convention,
Suggestion severity, not a new warning class). `npm run typecheck` → 0
errors. `npm run check:palette` → PASS (0 violations). `npm run check:ds` →
PASS (0 violations, R7 button-height guard included).

## Links
`story.md` (AC/BR/EC) · `design.md` (personality brief, copy table, Design Gate self-check) · `.claude/rules/qa.md` · CAM-272 `test.md` (source-inspection coverage-honesty precedent + mock-boundary convention this file follows)

## Changelog
- v1 (2026-07-18) — created; independent LIGHT-MEDIUM verify of the already-committed CAM-411 diff (847672b). All 9 AC/EC rows pass; 2 Prove-It red→green passes on the prompt-safety guard; independent empirical + axe pass (0 critical/serious) on a live instance of this branch; grep-pin check confirms no weakened cam-272 asserts; 44px pill check confirms no double-style drift (2 distinct populations, correct via `tailwind-merge`); full suite green modulo the 1 pre-flagged known-env failure. No defects found.
