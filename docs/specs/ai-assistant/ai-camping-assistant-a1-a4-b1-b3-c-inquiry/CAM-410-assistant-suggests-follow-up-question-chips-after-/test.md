---
linear: CAM-410
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: Blocked
version: v1
updated: 2026-07-18
---
# Test — Assistant suggests follow-up question chips after every answer (CAM-410)

## Adversarial seam verdict — 3 Critical defects (filed, not fixed here)

QA ran a targeted adversarial pass on the untrusted-suggestions seam per
security.md §6 ("model output is untrusted") and BR-5's promise ("the answer
shown to the camper never contains the raw suggestions block"). Three
concrete completion shapes break that promise, all sharing ONE root cause in
`lib/ai/openrouter-client.ts`'s `extractSuggestions`: `SUGGESTIONS_BLOCK_REGEX`
is a single, non-`g`, non-greedy `.exec()` — it strips only the FIRST
`<suggestions>...</suggestions>` span it finds. Any shape where that span is
not the one true well-formed block leaves raw delimiter markup in the text
the camper reads:

1. **Duplicate block** — the model emits the `<suggestions>` block twice; only
   the first is stripped, the second survives verbatim in `answer`.
2. **Truncated block** (no closing tag — plausible in NORMAL operation, not
   just adversarially: `MAX_TOKENS=680` caps the whole completion, answer +
   suggestions together) — no match at all, so the entire raw
   `<suggestions>[...` fragment is shown unstripped (also violates EC-5's
   "the camper never sees JSON or delimiter markup" on a parse failure).
3. **Forged nested closing tag inside a candidate string** (the sharpest
   finding — a genuine delimiter-escape/prompt-injection-class bypass on the
   OUTPUT sanitization boundary) — the regex's non-greedy match stops at the
   attacker-controlled inner `</suggestions>`, so a raw JSON tail + a raw
   closing tag leak into `answer`, AND the legitimately-generated suggestion
   is silently lost entirely (the captured group is invalid JSON).

All 3 reproduced against the REAL `runAssistantTurn` (only `fetch` mocked —
zero spend) in `__tests__/cam-410-adversarial-seam.test.ts`, each wrapped in
`it.fails()` (same Prove-It convention as
`cam-272-ai-chat-contract-reconciliation.test.ts` Section B): the assertion
IS the spec's promise; it genuinely fails today, so `it.fails()` keeps the
suite green while the defect is open, and flips loudly to failing the moment
`extractSuggestions` is hardened (signal to update this file). See
`## Defects` below for severity/repro/fix-owner detail. **`status: Blocked`**
pending the fix — see Verify.

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (chips render 1-3 sanitized suggestions under the answer; `suggestions[]` stored) | H | unit | `runAssistantTurn — CAM-410 suggestions extraction (no-tool path) > [normal]`; `appendOutcome — AC-1`; `AC-1/AC-6` group render block | `cam-410-suggestions.test.ts`, `cam-410-chip-render.test.ts` | ✅ pass |
| AC-1/BR-5 (answer NEVER carries the raw block) — **adversarial: duplicate/truncated/forged-nested shapes** | H | unit | `QA DEFECT #1/#2/#3` (`it.fails`, Prove-It) | `cam-410-adversarial-seam.test.ts` | 🔴 **3 defects** (Critical) |
| AC-2/BR-7 (tap sends the exact sanitized text, no prefix/edit, same path as welcome pills) | H | unit (structural) | `AC-2/BR-7` describe block + panel wiring check | `cam-410-chip-render.test.ts` | ✅ pass |
| AC-3/BR-7 (only the newest answer's chips show; older answer's chips gone on next turn) | M | unit + unit (structural) | `appendOutcome — AC-3`; `showSuggestions={!sending && index === entries.length - 1}` | `cam-410-suggestions.test.ts`, `cam-410-chip-render.test.ts` | ✅ pass |
| AC-4/EC-1/EC-6 (no usable suggestions -> `suggestions=[]`, no chip area, answer unchanged) | M | unit + integration | EC-1 tests (no block / empty array); route EC-6 regression guard; `parseAiChatSuccessBody` absent/empty-key tests; chip-group `length > 0` gate | `cam-410-suggestions.test.ts`, `cam-410-route-suggestions.test.ts`, `cam-410-chip-render.test.ts` | ✅ pass |
| AC-5/EC-3 (in-flight turn OR rate-limited/disabled/error notice -> NO chips) | H | unit (structural, **QA gap closed**) | new `AC-5/EC-3 — chips are structurally absent…` describe (rate-limited/disabled/error/typing branches isolated + asserted chip-free) | `cam-410-chip-render.test.ts` | ✅ pass (gap closed) |
| AC-6/BR-8 (labelled group `role="group"` + `aria-label`=`คำถามแนะนำ`, keyboard-focusable `<Button>`) | M | unit (structural) + i18n | `AC-1/AC-6` group block; `cam-272-ai-chat-i18n.test.ts` new verbatim TH+EN assertions (**QA gap closed** — was only structurally checked, never literal-copy-asserted) | `cam-410-chip-render.test.ts`, `cam-272-ai-chat-i18n.test.ts` | ✅ pass |
| BR-1 (additive optional `suggestions` field, absent means no chips, byte-stable pre-CAM-410 shape) | H | integration | route EC-6 key-set test; BR-1 `[]`-omits-key test | `cam-410-route-suggestions.test.ts` | ✅ pass |
| BR-2 (bounds: max 3, ≤60 chars, drop blank, dedupe first-wins) | H | unit | EC-4 tests (over-count/over-length/dup) + new blank-mixed gap test (**QA gap closed** — previously only unit-tested in isolation via `sanitizeSuggestion`, not through the full `extractSuggestions` pipeline) | `cam-410-suggestions.test.ts` | ✅ pass |
| BR-3 (untrusted model output sanitized to inert plain text) | H | unit | `sanitizeSuggestion` describe (markdown/HTML/delimiter/control-char) + EC-2 | `cam-410-suggestions.test.ts` | ✅ pass (unit level) — **see adversarial verdict for the pipeline-level gap** |
| BR-4 (same completion, no second call; parse/sanitize failure -> `[]`, never a turn error) | H | unit | malformed-JSON-WITH-closing-tag test (passes); post-tool-call path test (both paths carry suggestions) | `cam-410-suggestions.test.ts` | ⚠️ partially covered — the **truncated (no closing tag)** shape is DEFECT #2, not merely untested |
| BR-6 (`MAX_TOKENS` 600→680, only spend-guard change) | M | unit | `[security] BR-6: … max_tokens raised to 680` | `cam-410-suggestions.test.ts` | ✅ pass |
| EC-2 (markdown/HTML/delimiter injection in a suggestion sanitized) | H | unit | `[security] EC-2` | `cam-410-suggestions.test.ts` | ✅ pass |
| EC-5 (malformed/truncated block -> `[]`, camper never sees JSON/markup) | H | unit | malformed-JSON test (closing tag present) passes; **truncated/no-closing-tag** shape = DEFECT #2 | `cam-410-suggestions.test.ts`, `cam-410-adversarial-seam.test.ts` | 🔴 defect (see #2) |

## Coverage matrix per AC/BR (5-bucket, qa.md §Coverage matrix)
| AC/BR | normal | null/empty | boundary | error/validation | concurrent/ordering |
|---|---|---|---|---|---|
| AC-1/BR-1 | ✅ 1-3 suggestions render + stored | ✅ absent field → no chips | ⚪ N/A | ⚪ N/A | ⚪ N/A |
| AC-3/BR-7 | ✅ newest-only | ⚪ N/A | ⚪ N/A | ⚪ N/A | ✅ append-after-append: older entry's suggestions untouched by a later append |
| AC-4/EC-1 | ⚪ (this IS the no-suggestion path) | ✅ absent/`[]`/all-dropped → `[]` | ⚪ N/A | ⚪ N/A | ⚪ N/A |
| AC-5/EC-3 | ⚪ N/A | ⚪ N/A | ⚪ N/A | ⚪ N/A | ✅ sending / notice-kind entries structurally excluded regardless of array contents |
| AC-6/BR-8 | ✅ group + TH/EN copy verbatim | ⚪ N/A | ⚪ N/A | ⚪ N/A | ⚪ N/A |
| BR-2 | ✅ 1-2 valid kept | ✅ blank/whitespace dropped (incl. mixed into a valid array — gap closed) | ✅ exactly 3 kept / 4th+ dropped; exactly 60 chars kept / 61 dropped | ⚪ N/A | ⚪ N/A |
| BR-3 (sanitize) | ✅ plain Thai passes through | ✅ empty → `null` | ✅ exactly-60/61-char boundary | ✅ markdown/HTML/delimiter stripped; control chars deleted | ⚪ N/A |
| BR-4/BR-5/EC-5 (answer cleanliness) | ✅ single well-formed block strips cleanly, incl. block mid-answer with prose after | ✅ no block at all → answer unchanged | ⚪ N/A | ✅ malformed JSON **with** a closing tag → `[]` + block stripped | 🔴 **defect**: duplicate / truncated / forged-nested shapes leak raw markup (adversarial "ordering/shape" cases — see verdict) |
| Client re-bounding (`normalizeSuggestions`, `lib/api-client.ts`) | ✅ 1-3 valid kept | ✅ absent/`[]`/non-array → `[]` | ✅ over-count (5→3) / over-length (dropped) | ✅ blank+dup mixed / non-string entries mixed — ALL independently re-bound regardless of what the wire sent | ⚪ N/A |

## Mock-boundary audit (qa.md §6 — never mock the layer under test)
- `cam-410-suggestions.test.ts` / `cam-410-adversarial-seam.test.ts` — mock **`fetch` only** (`vi.stubGlobal`); the REAL `runAssistantTurn`, REAL `extractSuggestions`, REAL `sanitizeSuggestion` all execute unmocked. Zero real spend, no real OpenRouter call (mirrors `cam-270-openrouter-client.test.ts`'s established pattern).
- `cam-410-route-suggestions.test.ts` — mocks `runAssistantTurn` only (mirrors `cam-271-ai-chat-route.test.ts`); the REAL `POST` handler, REAL rate-limit store run unmocked.
- `cam-410-suggestions.test.ts`'s `parseAiChatSuccessBody` block — calls the REAL client parser directly with hostile literal payloads (no network layer involved at all — this is the seam-invariant / client re-bounding-defense proof the dispatch asked for, proven independently of the server's own sanitizer).
- `cam-410-chip-render.test.ts` — source-inspection (no jsdom in this repo's `vitest.config.ts`, `environment: 'node'`; same established convention as `cam-272-ai-chat-components.test.ts`/`cam-409-ai-chat-card-carousel.test.ts`).

## Prove-It (red↔green evidence)
1. **QA gap-closing tests** (blank-mixed-in-array, chip-absence-on-notice-branches, TH/EN copy verbatim) assert real, already-implemented logic paths — confirmed by direct code reading against `lib/ai/openrouter-client.ts`/`AiChatMessageList.tsx`; each is pinned to a specific branch/string that would break the test immediately if the guarding logic were removed (e.g. the notice-branch tests fail the instant "suggestion" text appears inside the rate-limited/disabled/error source slice).
2. **Adversarial defects (`cam-410-adversarial-seam.test.ts`)** — for each of the 3 `it.fails()` reproductions: temporarily removed the `.fails` wrapper, re-ran, confirmed a genuine hard failure with the exact expected-vs-actual diff below, then restored `.fails()`:
   - Defect #1: `expected 'ans  middle <suggestions>["q2"]</suggestions> end' not to contain '<suggestions>'` — real failure.
   - Defect #2: `expected 'สวัสดีครับ พบแคมป์ 2 แห่ง <suggestions>[...' not to contain '<suggestions>'` — real failure.
   - Defect #3: `expected 'ok","ok คำถาม"]</suggestions>' not to contain '</suggestions>'` — real failure.
   Confirms all 3 are real production defects, not test-authoring mistakes. Restored file re-verified: `3 expected fail` (suite green).

## Coverage (metric honesty)
Measured (diff-scoped, not whole-repo):
```
npx vitest run --coverage \
  --coverage.include='lib/ai/sanitize.ts' --coverage.include='lib/ai/openrouter-client.ts' \
  --coverage.include='lib/api-client.ts' --coverage.include='components/ai-chat/conversation.ts' \
  --coverage.include='app/api/ai/chat/route.ts' \
  __tests__/cam-410-suggestions.test.ts __tests__/cam-410-route-suggestions.test.ts \
  __tests__/cam-270-openrouter-client.test.ts __tests__/cam-270-sanitize.test.ts \
  __tests__/cam-271-ai-chat-route.test.ts __tests__/cam-272-ai-chat-conversation.test.ts \
  __tests__/cam-272-ai-chat-contract-reconciliation.test.ts
```

| File | Stmts | Branch | Funcs | Lines | Note |
|---|---|---|---|---|---|
| `app/api/ai/chat/route.ts` | 100% | 96.29% | 100% | 100% | real execution |
| `lib/ai/sanitize.ts` | 100% | 93.33% | 100% | 100% | real execution (incl. new `sanitizeSuggestion`) |
| `lib/ai/openrouter-client.ts` | 97.32% | 89.65% | 100% | 100% | real execution; uncovered lines are pre-existing tool-call-arg-parse branches, unrelated to CAM-410 |
| `lib/api-client.ts` — new CAM-410 section (`normalizeSuggestions`, `AI_CHAT_MAX_SUGGESTIONS`, `suggestions` handling in `parseAiChatSuccessBody`) | 100% (exercised by every `parseAiChatSuccessBody`/route test) | — | — | — | isolated by inspection; whole-file rollup (66.23%) is dragged down entirely by pre-existing, untouched `wishlistAPI`/`bookingAPI`/`operatorAPI` etc. (lines 127-155), not a CAM-410 gap |
| `components/ai-chat/{AiChatMessageList,AiChatPanel}.tsx` | 0% | 0% | 0% | 0% | **structural, not a gap** — this repo's `vitest.config.ts` runs `environment: 'node'` (no jsdom); the whole `ai-chat` FE test suite (CAM-272/409/410) uses source-inspection (`fs.readFileSync` + string assertion), the established, documented precedent (see CAM-272's `test.md` "Coverage (metric honesty)" for the same reasoning) |

**Combined new-code floor:** every genuinely-executable new/touched unit (`sanitize.ts`, `openrouter-client.ts`'s extraction path, `route.ts`'s wire-body addition, `api-client.ts`'s new suggestions section) is ≥89% branch / ~97-100% statement — well above the 80% gate. The non-executable `.tsx` layer is covered structurally + by the Prove-It teeth demonstrated above, consistent with repo precedent.

## Defects (sub-tickets to open — QA does not fix; hand back to owning role)

| # | Severity | Failing AC/BR/EC | Description | Repro | File(s) | Fix owner |
|---|---|---|---|---|---|---|
| 1 | **Critical** | BR-5 | A model completion that emits the `<suggestions>` block TWICE (glitch or malformed output) has its raw SECOND block survive verbatim in `answer` — `SUGGESTIONS_BLOCK_REGEX.exec()` is a single, non-`g` match that only strips the first occurrence. | 1. Mock the completion content to `'ans <suggestions>["q1"]</suggestions> middle <suggestions>["q2"]</suggestions> end'`. 2. Call `runAssistantTurn`. 3. `result.answer === 'ans  middle <suggestions>["q2"]</suggestions> end'` — raw markup visible. Expected: answer contains no `<suggestions>`/`</suggestions>` anywhere. See `cam-410-adversarial-seam.test.ts` DEFECT #1 (`it.fails`). | `lib/ai/openrouter-client.ts` (`extractSuggestions`/`SUGGESTIONS_BLOCK_REGEX`) | backend |
| 2 | **Critical** | BR-5, EC-5 | A completion truncated mid-`<suggestions>`-block (NO closing tag — realistically triggerable by `MAX_TOKENS=680` capping the whole completion, not just adversarially) is not matched at all by the regex, so the ENTIRE raw content — including the literal `<suggestions>[...` open tag + partial JSON — is shown unstripped in the answer. Violates EC-5's explicit promise: "the camper never sees JSON or delimiter markup" even on a parse failure. | 1. Mock completion content to `'สวัสดีครับ พบแคมป์ 2 แห่ง <suggestions>["เอาที่ถูกกว่านี้ไหม", "ว่างเสาร'` (no closing tag). 2. Call `runAssistantTurn`. 3. `result.answer` still contains the literal `<suggestions>[...` fragment; `suggestions` key is absent (dropped, per BR-4) but the leak happened anyway. See `cam-410-adversarial-seam.test.ts` DEFECT #2 (`it.fails`). | `lib/ai/openrouter-client.ts` (`extractSuggestions` — needs an "unclosed tag -> strip from the open tag to end of string" fallback, not "no match -> no strip at all") | backend |
| 3 | **Critical (security)** | BR-3, BR-5 | A suggestion candidate string that itself contains a forged `<suggestions>`/`</suggestions>` pair (a delimiter-escape / prompt-injection-class payload from untrusted model output, security.md §6) breaks the non-greedy regex: it matches only up to the FIRST `</suggestions>` — the forged one INSIDE the candidate — so (a) a raw JSON tail + a raw closing tag leak into the visible `answer`, AND (b) the entire legitimately-generated suggestion array is silently lost (the captured group becomes invalid JSON, so `suggestions` drops to `[]` even though the model provided a good candidate alongside the forged one). This is the same delimiter-escape attack class `sanitize.ts`'s own header comment already defends against on the INPUT boundary — it is currently unguarded on this OUTPUT boundary. | 1. Mock completion content to `` `ok<suggestions>${JSON.stringify(['<suggestions>["evil"]</suggestions>', 'ok คำถาม'])}</suggestions>` `` . 2. Call `runAssistantTurn`. 3. `result.answer === 'ok,"ok คำถาม"]</suggestions>'` (raw leak) AND `'suggestions' in result === false` (the good candidate "ok คำถาม" is lost too). See `cam-410-adversarial-seam.test.ts` DEFECT #3 (`it.fails`). | `lib/ai/openrouter-client.ts` (`extractSuggestions`/`SUGGESTIONS_BLOCK_REGEX`) | backend (flag to security for the delimiter-escape framing) |

**Suggested fix direction (not prescriptive — backend's call):** match the block with a regex anchored to require the LAST `</suggestions>` in the string (or match greedily from the first open tag to the LAST close tag), AND add an explicit fallback for an unclosed open tag (strip from the first `<suggestions>` to end-of-string when no closing tag is found) so `answer` can never retain the open-tag literal even on truncation.

## Localhost / owner-verify rows (cannot be verified headlessly)
1. Visual chip rendering + wrap behavior for 3 long (~60-char) Thai suggestions on a real mobile viewport (design.md `w-96`/`85dvh` panel).
2. Real screen-reader announcement of the `คำถามแนะนำ` group + reachable chip buttons (VoiceOver/NVDA) — structural a11y (role/aria-label/native `<button>`) is proven here; live announcement behavior is browser-only.
3. **Once Defects #1-#3 are fixed** — re-verify on localhost (dev DB, `OPENROUTER_API_KEY` live) that a real model response never shows raw `<suggestions>` markup even under a long answer near the 680-token ceiling (cannot be forced deterministically without live spend).

## Full suite (last act, run after all QA-added tests)
`npx vitest run` → **190 test files: 187 passed, 3 failed**; **6918 tests: 6912 passed, 3 expected-fail (this story's own Defect #1-#3 Prove-It reproductions, by design), 3 failed**. The 3 failed tests are **pre-existing, environment-dependent, verified NOT introduced by this diff** (identical root causes to the ones CAM-409's `test.md` already documented for this worktree):
- `__tests__/delivery-client.test.ts` (1 test) — per the dispatch contract, known env-dependent (`DELIVERY_DATABASE_URL` not set locally); ignored per instruction.
- `__tests__/f5-account-misc.test.ts` + `__tests__/f6-palette-guard.test.ts` (1 test each) — both assert `git diff staging --name-only` excludes `app/status/page.tsx`. Confirmed: this worktree's local `staging` ref is 154 commits behind `origin/staging` (`git rev-list --left-right --count staging...origin/staging` → `0  154`); against `origin/staging` the assertion holds (`git diff origin/staging --name-only` does not include the file). Confirmed the real story diff (`git diff origin/dev --name-only`) touches only this story's 14 files — no `app/status/page.tsx`.

`npx eslint` (every file this diff touches, incl. all 4 new/changed test files) → **0 errors, 0 new warnings**. `npx tsc --noEmit` → **0 errors**.

## Links
`story.md` (AC/BR/EC) · `.claude/rules/qa.md` · `.claude/rules/security.md` §6 (AI/LLM untrusted model output) · CAM-272 `test.md` (Prove-It `it.fails()` convention this file follows) · CAM-409 `test.md` (source-inspection + local-staging-ref precedent)

## Changelog
- v1 (2026-07-18) — created. Full AC/BR/EC walk across both the server (CAM-410 server dispatch) and FE (chip render dispatch) halves. Closed 3 real test gaps (blank-item-mixed-in-array through the full pipeline, chip-absence-on-notice-branches structural proof, TH+EN verbatim copy assertion for `suggestedQuestionsLabel`). Found 3 Critical defects sharing one root cause in `extractSuggestions`'s single non-greedy regex match (duplicate block, truncated/no-closing-tag block, forged-nested-delimiter-tag candidate) — all violate BR-5's "answer never contains raw markup" promise; #3 is a genuine delimiter-escape/prompt-injection-class bypass on the output sanitization boundary. `status: Blocked` pending the fix.
