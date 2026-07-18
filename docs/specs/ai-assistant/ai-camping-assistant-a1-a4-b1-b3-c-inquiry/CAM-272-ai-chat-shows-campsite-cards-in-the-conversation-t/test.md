---
linear: CAM-272
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: Blocked
version: v1
updated: 2026-07-18
---
# Test — AI chat shows campsite cards in the conversation, tap through to the camp page (AI-3) (CAM-272)

## Contract reconciliation verdict — MISMATCH (Critical, filed as a defect, not fixed here)

CAM-272 was built against an **assumed** shape for CAM-271's `200 { answer, cards }`
response. Tracing the real path — `runAssistantTurn` → `searchCampsites` →
`campCardSelect` (`lib/read-models/camp-card.ts`, real `Prisma.Decimal` /
`Date` columns) → `app/api/ai/chat/route.ts`'s `NextResponse.json` — against
the client's assumed contract (`AiChatCardResponse` / `isAiChatCardResponse`,
`lib/api-client.ts`) surfaces one **Critical** mismatch:

- `campCardSelect` selects `priceLow` (`Decimal(12,2)`) and `avgRating`
  (`Decimal(2,1)`). `app/api/ai/chat/route.ts` forwards `result.cards`
  straight into `NextResponse.json` with **no `serializeDecimals()` call**
  (the convention `app/api/bookings/route.ts` / `app/api/campsites/route.ts`
  both use, `lib/serialize.ts`). `Prisma.Decimal`'s own `toJSON()`
  (decimal.js) returns a **string**, so the real wire response ships
  `priceLow` as a JSON string (`"1500"`), never a `number`.
- The client's `isAiChatCardResponse` requires `typeof v.priceLow === 'number'`.
  Every real campsite that has a price is silently dropped from `cards[]` by
  `parseAiChatSuccessBody`'s filter, and the conversation renders the AC-4
  zero-result copy even when the server found real matching campsites. This
  breaks AC-2 (in-chat cards) for effectively every real search — only a
  free camp (`priceLow: null`) survives today.
- Proven with the **REAL** `POST` handler (only `runAssistantTurn` mocked —
  CAM-271's own outer-boundary-only pattern, no live key/spend) in
  `__tests__/cam-272-ai-chat-contract-reconciliation.test.ts`, confirmed
  against the real `next/server` `NextResponse.json` (not a manual
  simulation).

See `defects` below for severity/repro/fix-owner detail on this and two
related, lower-severity findings. **`status: Blocked`** — see Verify.

## AC→test matrix
<!-- risk = H/M/L (impact × likelihood — ISTQB). Ordered H first. -->
| AC | risk | type | describe/test | test file | status |
|---|---|---|---|---|---|
| AC-2 (BR-4 security, Critical) — priced-card contract (see verdict above) | H | integration | `Section A` (ground truth) + `Section B` (`it.fails`, Prove-It) | `__tests__/cam-272-ai-chat-contract-reconciliation.test.ts` | 🔴 defect (2 tests intentionally `it.fails`) |
| AC-2/BR-4 (security, Critical) — answer always plain text, no HTML/markdown, cards only from `cards[]` | H | unit (structural) | `BR-4 (Critical/security)` | `__tests__/cam-272-ai-chat-components.test.ts` | ✅ pass |
| EC-6 — injected markup in `answer` renders inert; malformed card entries dropped, never crash | H | unit | `EC-6` in `BR-4` block + `parseAiChatSuccessBody (EC-6)` | components.test.ts, conversation.test.ts | ✅ pass |
| AC-1 (BR-1/BR-2/BR-7) — welcome state, 3 pills, launcher always reachable incl. disabled, focus→composer on open | M | unit (structural) | `BR-1`, `BR-2`, `BR-7` blocks | `__tests__/cam-272-ai-chat-components.test.ts` | ✅ pass |
| AC-2 (BR-3/BR-6) — send disables composer, typing indicator (not skeleton), facade-only fetch | M | unit + unit (structural) | `BR-3`, `BR-6` blocks; `appendOutcome`/`buildOutgoingHistory` | components.test.ts, conversation.test.ts | ✅ pass |
| AC-3 (BR-4) — each card links to `/campgrounds/{slug}`, no write fires (QA gap closed) | M | unit (structural) | `AC-3 — each in-chat card is a link…` (NEW) | `__tests__/cam-272-ai-chat-components.test.ts` | ✅ pass |
| AC-4/EC-2 (BR-5) — `cards:[]` → zero-result copy, no cards | M | unit | `appendOutcome (AC-4/EC-2…)` | `__tests__/cam-272-ai-chat-conversation.test.ts` | ✅ pass |
| AC-5/EC-5 (BR-5) — non-2xx/network fail → error copy + `ลองใหม่` re-sends | M | unit + unit (structural) | `appendOutcome`/`entriesBeforeRetry`; `BR-5` block | conversation.test.ts, components.test.ts | ✅ pass |
| AC-6/EC-3 (BR-5) — 429 → rate-limited copy, no retry button | M | unit + unit (structural) | `appendOutcome`; `BR-5` block (no-retry assertion) | conversation.test.ts, components.test.ts | ✅ pass |
| AC-7/EC-4 (BR-1/BR-5) — 503 → disabled copy + composer disabled, launcher still renders | M | unit + unit (structural) | `isAssistantDisabled`; `BR-1`, `BR-3` blocks | conversation.test.ts, components.test.ts | ✅ pass |
| AC-8 (BR-7) — Esc/close/scrim closes, focus returns to launcher (QA gap closed) | M | unit (structural) + owner-verify | `AC-8 — Esc / close / tap-scrim…` (NEW) | `__tests__/cam-272-ai-chat-components.test.ts` | ✅ structural pass; focus-trap/-restore itself = owner-verify row (below) |
| EC-1 (BR-6) — empty/whitespace composer never sends | L | unit + unit (structural) | `isSendableQuestion`; `BR-6` block | conversation.test.ts, components.test.ts | ✅ pass |
| EC-7 (BR-3) — reduced motion disables typing dots + launcher scale + panel entrance | L | unit (structural) | `EC-7 — reduced motion…` | `__tests__/cam-272-ai-chat-components.test.ts` | ✅ pass |
| i18n — every `aiChat.*` key TH verbatim + EN parity, no em-dash | M | unit | full file | `__tests__/cam-272-ai-chat-i18n.test.ts` | ✅ pass |

## Coverage matrix per AC (5-bucket, qa.md §Coverage matrix)
| AC/BR | normal | null/empty | boundary | error/validation | concurrent/ordering |
|---|---|---|---|---|---|
| AC-1/BR-1/BR-2 | ✅ welcome heading + 3 pills render | ✅ shown only when `entries.length === 0` | ⚪ N/A | ⚪ N/A | ⚪ N/A (stateless per-open) |
| AC-2/BR-3/BR-4 | ✅ ok+cards renders answer+N cards | ✅ `cards:[]` → EC-2 | ⚪ N/A (10-card cap owned by CAM-271, UI renders whatever it gets) | ✅ malformed card dropped (EC-6); **contract defect** (priced card dropped — filed) | ⚪ N/A (one turn in flight at a time, `sending` gates re-entry) |
| AC-3/BR-4 | ✅ Link targets `/campgrounds/{slug}` | ⚪ N/A | ⚪ N/A | ⚪ N/A | ⚪ N/A |
| AC-4/EC-2/BR-5 | ⚪ (this IS the zero-result path) | ✅ `cards:[]` → zero-result copy | ⚪ N/A | ⚪ N/A | ⚪ N/A |
| AC-5/EC-5/BR-5 | ⚪ N/A | ⚪ N/A | ⚪ N/A | ✅ 400/502/network-fail → error+retry | ⚪ N/A |
| AC-6/EC-3/BR-5 | ⚪ N/A | ⚪ N/A | ⚪ N/A | ✅ 429 → rate-limited, no retry button | ⚪ N/A |
| AC-7/EC-4/BR-1/BR-5 | ⚪ N/A | ✅ 503 → disabled + composer disabled | ⚪ N/A | ⚪ N/A | ✅ persists once seen (`isAssistantDisabled`, mid-thread) |
| AC-8/BR-7 | ✅ close calls `onOpenChange(false)` | ⚪ N/A | ⚪ N/A | ⚪ N/A | ⚪ N/A — focus-trap/-restore itself is Radix-native, browser-only (owner-verify) |
| EC-1/BR-6 | ✅ real text (trimmed) sends | ✅ empty string rejected | ✅ whitespace-only rejected | ⚪ N/A (no user-facing error — silent guard by design) | ⚪ N/A |
| EC-7/BR-3 | ✅ `motion-safe:` gates dots/scale/entrance | ⚪ N/A | ⚪ N/A | ⚪ N/A | ⚪ N/A |

## Mock-boundary audit
Every test mocks only the OUTER boundary, never the logic under test (qa.md §6):
- `cam-272-ai-chat-contract-reconciliation.test.ts` (NEW) — mocks `@/lib/ai/openrouter-client`'s `runAssistantTurn` only (identical to CAM-271's own route test — zero real spend, no real HTTP/OpenRouter call). The REAL `POST` handler, REAL rate-limit store, REAL zod validation, REAL `parseAiChatSuccessBody`/`appendOutcome` all run unmocked. Cards are built with a REAL `Prisma.Decimal`/`Date` (mirroring `campCardSelect` exactly) — not a bare `{id:'c1'}` stub (which is precisely why CAM-271's own "100%-covered" route suite never caught this: its stub cards carry no Decimal fields at all).
- `cam-272-ai-chat-conversation.test.ts` — no mocks for `conversation.ts` (pure functions); `aiChatAPI.send`'s tests stub only `global.fetch`.
- `cam-272-ai-chat-components.test.ts` / `cam-272-ai-chat-i18n.test.ts` — source-inspection (see Coverage §Metric honesty below for why, and the precedent this follows).

## Prove-It (red↔green evidence)
1. **AC-8 no-override guard** (this file's own new assertion) — temporarily inserted `onEscapeKeyDown={(e) => e.preventDefault()}` into `AiChatPanel.tsx` → the new guard test went red (`expected … not to contain "onEscapeKeyDown"`) → reverted (`git diff` clean) → green (47/47 in the file). Demonstrates the guard has real teeth, not just a passive grep.
2. **Contract-reconciliation defect (Section B)** — removed the `it.fails()` wrapper (kept the assertions) and re-ran: both tests genuinely fail with the exact expected-vs-actual diff (`outcome.cards` length 0 vs 1; `zeroResult` true vs false) — confirmed the defect is real, not a test-authoring mistake, then restored `it.fails()` so the suite stays green while the fix is pending (see file header for the semantics: the moment the fix lands, these tests flip to hard-failing until updated).
3. **Branch-coverage completion** (`appendOutcome`'s defensive `default:`, mirrors CAM-271's own BR-6-default precedent) — added a QA test casting an out-of-union outcome kind; closed `conversation.ts` from 93.75%→100% branches.

## Coverage (metric honesty)
Measured via (diff-scoped, not whole-repo):
```
npx vitest run __tests__/cam-272-*.test.ts __tests__/cam-271-*.test.ts --coverage \
  --coverage.include='components/ai-chat/**' --coverage.include='lib/api-client.ts' \
  --coverage.include='components/CampgroundCard.tsx' --coverage.include='app/api/ai/chat/**' \
  --coverage.include='lib/validations/ai-chat.ts' --coverage.include='lib/ai/serialize-conversation.ts'
```

| File | Stmts | Branch | Funcs | Lines | Note |
|---|---|---|---|---|---|
| `app/api/ai/chat/route.ts` | 100% (18/18) | 100% (14/14) | 100% (2/2) | 100% | real execution via `POST()` |
| `lib/ai/serialize-conversation.ts` | 100% (6/6) | 100% (2/2) | 100% (2/2) | 100% | real execution |
| `lib/validations/ai-chat.ts` | 100% (6/6) | ⚪ (0/0) | 100% (2/2) | 100% | real execution |
| `lib/api-client.ts` — **new CAM-272 section only** (lines ≥158: `AiChatRequestMessage`/`AiChatCardResponse`/`AiChatOutcome`/`isAiChatCardResponse`/`parseAiChatSuccessBody`/`aiChatAPI.send`) | **100% (25/25)** | **100% (27/27)** | **100% (3/3)** | — | isolated by line-range cross-reference against `coverage-final.json` (verified: max uncovered line in the file is 154, new section starts at 158) |
| `lib/api-client.ts` — whole file (v8's default file-level rollup) | 55.17% | 77.14% | 15% | 50% | the shortfall is 100% PRE-EXISTING, unrelated code (`wishlistAPI`/`bookingAPI`/`reviewAPI`/`campgroundAPI`/`operatorAPI`) never touched by this diff and not exercised by this scoped test-file run (they pass under other test files in the full suite) — not a CAM-272 gap |
| `components/ai-chat/conversation.ts` | 100% (was 96%, closed via the branch-completion test above) | 100% | 100% | 100% | real execution (pure logic) |
| `components/ai-chat/{AiChatCampCard,AiChatLauncher,AiChatMessageList,AiChatPanel,use-ai-chat}` | 0% | 0%/varies | 0% | 0% | **structural property of source-inspection testing, not undertested** — see below |
| `components/CampgroundCard.tsx` | 0% | 0% | 0% | 0% | same reason |

**Why the 0%s are honest, not a gap:** this repo's `vitest.config.ts` runs `environment: 'node'` (no jsdom/render infra for this feature — confirmed: no `renderHook`/`render(...)` precedent exists for any hook/component in `__tests__/`, including the closest analog `cam-246-loading-foundation.test.ts`'s own `useMinimumLoading` hook, which ALSO falls back to source-inspection for the same documented reason). Every `.tsx`/`use-ai-chat.ts` assertion in `cam-272-ai-chat-components.test.ts` reads the component's shipped source as a **string** (`fs.readFileSync`) and asserts the exact wiring the AC/BR/EC rows require — V8 never sees these files execute, so it reports 0% regardless of how thoroughly the wiring is proven. This is the **identical, established precedent** documented in `docs/specs/booking-reliability/.../CAM-396-.../test.md`'s own "Coverage (metric honesty)" section (0% reported honestly, AC→test matrix + Prove-It substituted as the real behavioral floor) — not invented for this story. The floor for this layer is: the AC→test matrix above (14/14 rows pass or are explicitly owner-verify-flagged) + the Prove-It red/green demonstration (§ above) proving the guards have real teeth.

**Combined new-code floor:** every genuinely-executable new file/section (`route.ts`, `serialize-conversation.ts`, `validations/ai-chat.ts`, the new `lib/api-client.ts` section, `conversation.ts`) is **100%** across all 4 axes. The non-executable `.tsx` layer is covered structurally per the above, consistent with repo precedent — reported honestly, not fabricated.

## Localhost / browser-only owner-verify rows (staging G4, per qa.md — cannot be verified headlessly)
1. Radix `Dialog.Content`'s native **focus trap** actually holds Tab focus inside the panel (AC-1/BR-7).
2. Focus **returns to the launcher button** after Esc / close / tap-scrim (AC-8, Radix restore-to-trigger — no custom code implements this, so a source-grep proves only "not overridden," not "actually restores").
3. **Responsive layout**: mobile bottom-sheet (`h-[85dvh]`) vs desktop anchored card (`sm:right-6 sm:bottom-24 sm:w-96`) render correctly at real viewport sizes, no clipping.
4. `aria-live="polite"` + `role="log"` announcement of `ผู้ช่วยกำลังพิมพ์…` is actually announced without interrupting a real screen reader (VoiceOver/NVDA).
5. **FAB collision** — `AiChatLauncher` (`bottom-24 right-6`) vs `HostOnboardingFab` (`bottom-6 right-6`) — visually confirm no overlap for a logged-in non-host camper on Home (design.md §Seams).
6. `prefers-reduced-motion` actually disables the typing-dot pulse / launcher hover-press scale / panel slide-in in a real browser with the OS setting on.
7. Composite tint contrast (`text-warning` icon on `bg-muted`, `text-info` on `bg-muted`) — axe scan at build; design.md itself notes "not yet measured."
8. **Once Defect #1 is fixed** — re-verify on localhost (dev DB, a real search with `OPENROUTER_API_KEY` live) that a priced campsite's card actually renders in the chat (cannot be done headlessly without live spend, and is blocked until the fix lands).

## Defects (sub-tickets to open — QA does not fix; hand back to owning role)

| # | Severity | AC | Description | Repro | File(s) | Fix owner |
|---|---|---|---|---|---|---|
| 1 | **Critical** | AC-2 | `app/api/ai/chat/route.ts` never calls `serializeDecimals()` on `result.cards` before `NextResponse.json`. `Prisma.Decimal.toJSON()` serializes to a STRING, so `priceLow`/`avgRating` ship as strings on the wire. The client's `isAiChatCardResponse` (`lib/api-client.ts`) requires `typeof priceLow === 'number'`, so `parseAiChatSuccessBody` drops every real priced card — the chat shows the AC-4 zero-result copy even when the server found real matches. Confirmed via the real `NextResponse.json` (not a manual simulation) and the real `POST` handler. | 1. Mock `runAssistantTurn` to resolve `{ok:true, cards:[<a campCardSelect-shaped row with a Prisma.Decimal priceLow>]}`. 2. Call the real `POST /api/ai/chat` handler. 3. `res.json().cards[0].priceLow` is `"1500"` (string), not `1500`. 4. Feed that body through the real `parseAiChatSuccessBody` → `cards.length === 0`. See `__tests__/cam-272-ai-chat-contract-reconciliation.test.ts` (Section A ground truth; Section B `it.fails` reproduction). | `app/api/ai/chat/route.ts` (missing `serializeDecimals`) or `lib/api-client.ts`'s `isAiChatCardResponse` (accept numeric strings) — either closes it; the established convention (`lib/serialize.ts`) points at fixing the route. | backend |
| 2 | Important | design.md §"In-chat campsite card" | `AiChatCardResponse`/`AiChatCampCard` never surface `avgRating`/`reviewCount` (present in `campCardSelect` but not in the wire type, and not passed as props to `CampgroundCard`), so the in-chat card never shows a rating even for well-reviewed camps — contradicts design.md's "keeps the same visual language (…rating typography…)" line. Not a crash (defaults `reviewCount=0` hides the badge gracefully) and no AC explicitly tests it, so this is a design-conformance gap, not a correctness bug. | Inspect `lib/api-client.ts`'s `AiChatCardResponse` (no `avgRating`/`reviewCount` fields) and `components/ai-chat/AiChatCampCard.tsx` (doesn't pass them to `CampgroundCard`). | `lib/api-client.ts`, `components/ai-chat/AiChatCampCard.tsx`, `app/api/ai/chat/route.ts` | frontend (decide: widen the contract, or update design.md to drop the rating line) |
| 3 | Info | — | `campCardSelect`'s `images[].sortOrder` field ships to the client but `AiChatCardResponse.images` only declares `{url}[]` — harmless (never read), but a few unnecessary bytes per image on an over-fetched, unused field. Not filing a sub-ticket; noting for awareness only. | — | `lib/api-client.ts` | — (no action required) |

## Full suite (last act, run after all QA-added tests)
`npx vitest run` → **177 test files passed, 5 failed (182 total)**; **6707 tests passed, 4 failed, 2 expected fail (6713 total)**. The 5 failed files / 4 failed tests are **pre-existing, environment-dependent, verified NOT introduced by this diff**:
- `__tests__/delivery-client.test.ts` (2 tests) + `__tests__/cam-215-sec-a-access-control.test.ts` + `__tests__/delivery-tickets-api.test.ts` — this worktree never ran `prisma generate` for the delivery schema (`prisma/delivery/generated/` does not exist here, confirmed present in the main tree); same root cause as the known `delivery-client.test.ts` failure called out in the dispatch, extended here to its 2 siblings that import the same generated client.
- `__tests__/f5-account-misc.test.ts` + `__tests__/f6-palette-guard.test.ts` (1 test each) — `app/status/page.tsx` was touched by CAM-370 (already merged to `dev`, not yet promoted to `staging`); branch-divergence noise inherent to the Dev/Staging model, identical to the pattern CAM-271's own `test.md` documented.
The **2 expected-fail** are this file's own Section B Prove-It defect reproductions (§ above) — by design, not a suite problem.
`npx eslint` (scoped to every file this diff touches) → **0 errors**, 8 pre-existing warnings (none newly introduced — verified line-by-line against `git diff origin/dev...HEAD`). `npx tsc --noEmit` → 0 errors in any CAM-272 file (23 pre-existing errors, all in the unrelated `lib/delivery/**` family, same missing-generated-client root cause).

## Links
`story.md` (AC/BR/EC) · `design.md` (states/copy/a11y/security brief) · `.claude/rules/qa.md` · CAM-271 `test.md` (sibling contract + mocking precedent) · CAM-396 `test.md` (coverage-honesty precedent for source-inspection-only `.tsx` layers)

## Changelog
- v1 (2026-07-18) — created; full AC/EC walk + contract reconciliation against the real CAM-271 route. Closed 2 test gaps (AC-3 card-link, AC-8 no-override guard) + 1 branch-coverage gap (`appendOutcome` default). Found 1 Critical defect (priced-card drop, `route.ts` missing `serializeDecimals`) + 1 Important design-conformance gap (missing in-chat rating) + 1 Info note (harmless over-fetched field). `status: Blocked` pending Defect #1's fix.
