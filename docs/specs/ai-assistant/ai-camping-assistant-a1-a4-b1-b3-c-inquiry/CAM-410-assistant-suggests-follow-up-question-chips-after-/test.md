---
linear: CAM-410
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v2
updated: 2026-07-18
---
# Test — Assistant suggests follow-up question chips after every answer (CAM-410)

## Adversarial seam verdict — 3 Critical defects FOUND, FIXED by backend (d4186ed), RE-VERIFIED GREEN

QA ran a targeted adversarial pass on the untrusted-suggestions seam per
security.md §6 ("model output is untrusted") and BR-5's promise ("the answer
shown to the camper never contains the raw suggestions block"). Three
concrete completion shapes broke that promise, all sharing ONE root cause in
`lib/ai/openrouter-client.ts`'s `extractSuggestions`: the original
`SUGGESTIONS_BLOCK_REGEX` was a single, non-`g`, non-greedy `.exec()` — it
stripped only the FIRST `<suggestions>...</suggestions>` span found. Any
shape where that span was not the one true well-formed block left raw
delimiter markup in the text the camper reads:

1. **Duplicate block** — the model emits the `<suggestions>` block twice; only
   the first was stripped, the second survived verbatim in `answer`.
2. **Truncated block** (no closing tag — plausible in NORMAL operation, not
   just adversarially: `MAX_TOKENS=680` caps the whole completion, answer +
   suggestions together) — no match at all, so the entire raw
   `<suggestions>[...` fragment was shown unstripped (also violated EC-5's
   "the camper never sees JSON or delimiter markup" on a parse failure).
3. **Forged nested closing tag inside a candidate string** (the sharpest
   finding — a genuine delimiter-escape/prompt-injection-class bypass on the
   OUTPUT sanitization boundary) — the regex's non-greedy match stopped at the
   attacker-controlled inner `</suggestions>`, so a raw JSON tail + a raw
   closing tag leaked into `answer`, AND the legitimately-generated suggestion
   was silently lost entirely (the captured group was invalid JSON).

**Backend fix (commit `d4186ed`, `lib/ai/openrouter-client.ts`):** resolves
the block boundary by JSON-VALIDITY, not "whichever closing tag comes first
textually" — collects every `</suggestions>` position after the first open
tag and tries each in order until one yields a parseable JSON array (a forged
nested closing tag fails to parse there and is skipped in favor of the real
one); no closing tag at all strips from the open tag to end-of-string; a
global cleanup pass strips any further stray pair/tag remnant; a candidate
whose own text still carries a suggestions-tag delimiter is dropped outright
(smuggling guard). All 3 original `it.fails()` reproductions in
`__tests__/cam-410-adversarial-seam.test.ts` were flipped by backend to plain
`it()` asserts — confirmed **NOT weakened** (identical assertions to QA's
originals) and re-verified green.

**QA re-verify (round 2):** pulled `d4186ed`, re-ran the 3 original repros
(green, unweakened), then tried 5 NEW adversarial shapes against the hardened
boundary logic — a legitimate candidate with literal JSON-ish brackets, a
legitimate candidate that itself legitimately contains `"</suggestions>"`
text inside a properly-quoted JSON string literal, two-block combinations
where either the FIRST or the SECOND block is the malformed one, and a
compound payload nesting a forged block inside a candidate between two real
ones. **All 5 HELD — zero raw markup leak in any case** (see
`## Adversarial seam verdict — Round 2` below for the one documented,
non-security cost). **Verdict: seam held.** `status: In Progress` (ready for
security's pass, per the dispatch's `next`).

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | describe/test | test file | status |
|---|---|---|---|---|---|
| AC-1 (chips render 1-3 sanitized suggestions under the answer; `suggestions[]` stored) | H | unit | `runAssistantTurn — CAM-410 suggestions extraction (no-tool path) > [normal]`; `appendOutcome — AC-1`; `AC-1/AC-6` group render block | `cam-410-suggestions.test.ts`, `cam-410-chip-render.test.ts` | ✅ pass |
| AC-1/BR-5 (answer NEVER carries the raw block) — adversarial: duplicate/truncated/forged-nested shapes + round-2 (bracket-text/quoted-tag-text/mixed-malformed/compound) | H | unit | `QA DEFECT #1/#2/#3` (FIXED by backend, flipped to plain `it()`) + `QA ROUND-2` (5 new cases, all held) | `cam-410-adversarial-seam.test.ts` | ✅ pass — **seam held** |
| AC-2/BR-7 (tap sends the exact sanitized text, no prefix/edit, same path as welcome pills) | H | unit (structural) | `AC-2/BR-7` describe block + panel wiring check | `cam-410-chip-render.test.ts` | ✅ pass |
| AC-3/BR-7 (only the newest answer's chips show; older answer's chips gone on next turn) | M | unit + unit (structural) | `appendOutcome — AC-3`; `showSuggestions={!sending && index === entries.length - 1}` | `cam-410-suggestions.test.ts`, `cam-410-chip-render.test.ts` | ✅ pass |
| AC-4/EC-1/EC-6 (no usable suggestions -> `suggestions=[]`, no chip area, answer unchanged) | M | unit + integration | EC-1 tests (no block / empty array); route EC-6 regression guard; `parseAiChatSuccessBody` absent/empty-key tests; chip-group `length > 0` gate | `cam-410-suggestions.test.ts`, `cam-410-route-suggestions.test.ts`, `cam-410-chip-render.test.ts` | ✅ pass |
| AC-5/EC-3 (in-flight turn OR rate-limited/disabled/error notice -> NO chips) | H | unit (structural, **QA gap closed**) | new `AC-5/EC-3 — chips are structurally absent…` describe (rate-limited/disabled/error/typing branches isolated + asserted chip-free) | `cam-410-chip-render.test.ts` | ✅ pass (gap closed) |
| AC-6/BR-8 (labelled group `role="group"` + `aria-label`=`คำถามแนะนำ`, keyboard-focusable `<Button>`) | M | unit (structural) + i18n | `AC-1/AC-6` group block; `cam-272-ai-chat-i18n.test.ts` new verbatim TH+EN assertions (**QA gap closed** — was only structurally checked, never literal-copy-asserted) | `cam-410-chip-render.test.ts`, `cam-272-ai-chat-i18n.test.ts` | ✅ pass |
| BR-1 (additive optional `suggestions` field, absent means no chips, byte-stable pre-CAM-410 shape) | H | integration | route EC-6 key-set test; BR-1 `[]`-omits-key test | `cam-410-route-suggestions.test.ts` | ✅ pass |
| BR-2 (bounds: max 3, ≤60 chars, drop blank, dedupe first-wins) | H | unit | EC-4 tests (over-count/over-length/dup) + new blank-mixed gap test (**QA gap closed** — previously only unit-tested in isolation via `sanitizeSuggestion`, not through the full `extractSuggestions` pipeline) | `cam-410-suggestions.test.ts` | ✅ pass |
| BR-3 (untrusted model output sanitized to inert plain text) | H | unit | `sanitizeSuggestion` describe (markdown/HTML/delimiter/control-char) + EC-2 | `cam-410-suggestions.test.ts` | ✅ pass |
| BR-4 (same completion, no second call; parse/sanitize failure -> `[]`, never a turn error) | H | unit | malformed-JSON-WITH-closing-tag test; post-tool-call path test (both paths carry suggestions); truncated/no-closing-tag now fixed (DEFECT #2) | `cam-410-suggestions.test.ts`, `cam-410-adversarial-seam.test.ts` | ✅ pass |
| BR-6 (`MAX_TOKENS` 600→680, only spend-guard change) | M | unit | `[security] BR-6: … max_tokens raised to 680` | `cam-410-suggestions.test.ts` | ✅ pass |
| EC-2 (markdown/HTML/delimiter injection in a suggestion sanitized) | H | unit | `[security] EC-2` | `cam-410-suggestions.test.ts` | ✅ pass |
| EC-5 (malformed/truncated block -> `[]`, camper never sees JSON/markup) | H | unit | malformed-JSON test (closing tag present); truncated/no-closing-tag shape now fixed (was DEFECT #2, `QA DEFECT #2 (FIXED)`) | `cam-410-suggestions.test.ts`, `cam-410-adversarial-seam.test.ts` | ✅ pass |

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
| BR-4/BR-5/EC-5 (answer cleanliness) | ✅ single well-formed block strips cleanly, incl. block mid-answer with prose after | ✅ no block at all → answer unchanged | ⚪ N/A | ✅ malformed JSON (with or without a closing tag) → `[]` + block stripped, FIXED | ✅ duplicate / truncated / forged-nested / round-2 compound shapes all HELD (no leak) post-fix |
| Client re-bounding (`normalizeSuggestions`, `lib/api-client.ts`) | ✅ 1-3 valid kept | ✅ absent/`[]`/non-array → `[]` | ✅ over-count (5→3) / over-length (dropped) | ✅ blank+dup mixed / non-string entries mixed — ALL independently re-bound regardless of what the wire sent | ⚪ N/A |

## Mock-boundary audit (qa.md §6 — never mock the layer under test)
- `cam-410-suggestions.test.ts` / `cam-410-adversarial-seam.test.ts` — mock **`fetch` only** (`vi.stubGlobal`); the REAL `runAssistantTurn`, REAL `extractSuggestions`, REAL `sanitizeSuggestion` all execute unmocked. Zero real spend, no real OpenRouter call (mirrors `cam-270-openrouter-client.test.ts`'s established pattern).
- `cam-410-route-suggestions.test.ts` — mocks `runAssistantTurn` only (mirrors `cam-271-ai-chat-route.test.ts`); the REAL `POST` handler, REAL rate-limit store run unmocked.
- `cam-410-suggestions.test.ts`'s `parseAiChatSuccessBody` block — calls the REAL client parser directly with hostile literal payloads (no network layer involved at all — this is the seam-invariant / client re-bounding-defense proof the dispatch asked for, proven independently of the server's own sanitizer).
- `cam-410-chip-render.test.ts` — source-inspection (no jsdom in this repo's `vitest.config.ts`, `environment: 'node'`; same established convention as `cam-272-ai-chat-components.test.ts`/`cam-409-ai-chat-card-carousel.test.ts`).

## Adversarial seam verdict — Round 2 (re-verify against the fix, 5 new shapes, all HELD)

After pulling backend's fix (`d4186ed`), QA tried 5 additional adversarial completion shapes against the new JSON-validity-driven boundary logic in `extractSuggestions` — deliberately targeting the exact combinations the coordinator asked for (a candidate with literal JSON-ish brackets, a legitimate candidate whose own text contains `</suggestions>` inside a properly-quoted JSON string literal, and both orderings of "one block malformed, the other well-formed"), plus one compound case QA added on top (a forged nested block sitting between two real candidates). All reproduced against the REAL `runAssistantTurn` (`cam-410-adversarial-seam.test.ts`, `QA ROUND-2` describe block):

| # | Shape | `answer` result | `suggestions` result | Verdict |
|---|---|---|---|---|
| R1 | Legit candidate containing literal `[`/`]` bracket text (not a tag) | clean, no markup | both candidates kept verbatim | ✅ held |
| R2 | Legit candidate whose OWN text contains `"</suggestions>"` (properly JSON-quoted, not an attack) | clean, no markup | the smuggling-shaped candidate is dropped (defense-in-depth over-triggers on legit text containing that substring — acceptable per BR-3, sibling survives) | ✅ held (no leak); minor false-positive drop noted, not a leak |
| R3 | 2 separate blocks: FIRST malformed / SECOND well-formed | clean, no markup (`'ans  end'`) | `[]` — legit 2nd block's content lost | ✅ held (no leak); **functional cost noted below** |
| R4 | 2 separate blocks: FIRST well-formed / SECOND malformed | clean, no markup | 1st block's legit suggestion recovered (`["q1"]`) | ✅ held, best-case recovery |
| R5 (compound) | Forged nested block INSIDE a candidate, sitting between two real candidates | clean, no markup | both real candidates recovered (`["real1","real2"]`), forged one dropped | ✅ held — the toughest case constructed still resolves correctly |

**Verdict: seam held.** Zero raw-markup leak into the visible answer across all 5 new shapes (in addition to the original 3, now green). **One documented, non-security cost (R2/R3):** when an EARLIER `<suggestions>` block/candidate is malformed or coincidentally matches the smuggling guard, a LATER, otherwise-legitimate well-formed suggestion can be lost entirely (fails closed to `suggestions: []`, never a leak). This is explicitly allowed by BR-4 ("a parse or sanitize failure yields `suggestions = []` ... never a turn error") and requires an already off-spec model output (the system prompt asks for exactly one block) to trigger — **Info-level observation, not a defect**, no sub-ticket filed.

## Prove-It (red↔green evidence)
1. **QA gap-closing tests** (blank-mixed-in-array, chip-absence-on-notice-branches, TH/EN copy verbatim) assert real, already-implemented logic paths — confirmed by direct code reading against `lib/ai/openrouter-client.ts`/`AiChatMessageList.tsx`; each is pinned to a specific branch/string that would break the test immediately if the guarding logic were removed (e.g. the notice-branch tests fail the instant "suggestion" text appears inside the rate-limited/disabled/error source slice).
2. **Adversarial defects, ORIGINAL discovery (`cam-410-adversarial-seam.test.ts`)** — for each of the 3 `it.fails()` reproductions: temporarily removed the `.fails` wrapper, re-ran, confirmed a genuine hard failure with the exact expected-vs-actual diff below, then restored `.fails()`:
   - Defect #1: `expected 'ans  middle <suggestions>["q2"]</suggestions> end' not to contain '<suggestions>'` — real failure.
   - Defect #2: `expected 'สวัสดีครับ พบแคมป์ 2 แห่ง <suggestions>[...' not to contain '<suggestions>'` — real failure.
   - Defect #3: `expected 'ok","ok คำถาม"]</suggestions>' not to contain '</suggestions>'` — real failure.
   Confirmed all 3 were real production defects, not test-authoring mistakes.
3. **Fix re-verify** — pulled `d4186ed`; backend flipped the 3 `it.fails()` wrappers to plain `it()` (confirmed **not weakened**: identical assertion bodies to QA's originals, diffed against the commit before accepting); re-ran → all 3 green for real. Added the 5 ROUND-2 cases above as fresh, never-before-red assertions of the NEW logic — each is a genuine new adversarial probe (not a copy of an already-proven case), so passing them is real evidence the hardened boundary logic holds, not a tautology.

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

## Defects (filed by QA, FIXED by backend d4186ed — kept for the record, not re-opened)

| # | Severity | Failing AC/BR/EC | Description | Repro | File(s) | Fix owner | Status |
|---|---|---|---|---|---|---|---|
| 1 | Critical | BR-5 | A model completion that emits the `<suggestions>` block TWICE (glitch or malformed output) had its raw SECOND block survive verbatim in `answer` — the original `SUGGESTIONS_BLOCK_REGEX.exec()` was a single, non-`g` match that only stripped the first occurrence. | `cam-410-adversarial-seam.test.ts` DEFECT #1 | `lib/ai/openrouter-client.ts` | backend | ✅ FIXED, re-verified green |
| 2 | Critical | BR-5, EC-5 | A completion truncated mid-`<suggestions>`-block (NO closing tag — realistically triggerable by `MAX_TOKENS=680` capping the whole completion) was not matched at all, so the ENTIRE raw content — including the literal open tag + partial JSON — was shown unstripped. | `cam-410-adversarial-seam.test.ts` DEFECT #2 | `lib/ai/openrouter-client.ts` | backend | ✅ FIXED, re-verified green |
| 3 | Critical (security) | BR-3, BR-5 | A suggestion candidate string carrying a forged nested `<suggestions>`/`</suggestions>` pair broke the non-greedy regex — a delimiter-escape/prompt-injection-class bypass on the OUTPUT sanitization boundary, leaking raw markup AND dropping the legit suggestion array entirely. | `cam-410-adversarial-seam.test.ts` DEFECT #3 | `lib/ai/openrouter-client.ts` | backend | ✅ FIXED, re-verified green |

**Fix applied (`d4186ed`):** resolves the block boundary by JSON-VALIDITY (tries every `</suggestions>` occurrence in order until one yields a parseable JSON array; a forged nested one fails to parse and is skipped) + an unclosed-tag fallback (strip to end-of-string) + a global cleanup pass for stray pairs/tags + a per-candidate smuggling-delimiter drop. QA re-verified all 3 flips were **not weakened** (identical assertions) and ran 5 additional adversarial shapes against the new logic (`## Adversarial seam verdict — Round 2` above) — all held.

## Localhost / owner-verify rows (cannot be verified headlessly)
1. Visual chip rendering + wrap behavior for 3 long (~60-char) Thai suggestions on a real mobile viewport (design.md `w-96`/`85dvh` panel).
2. Real screen-reader announcement of the `คำถามแนะนำ` group + reachable chip buttons (VoiceOver/NVDA) — structural a11y (role/aria-label/native `<button>`) is proven here; live announcement behavior is browser-only.
3. Re-verify on localhost (dev DB, `OPENROUTER_API_KEY` live) that a real model response never shows raw `<suggestions>` markup even under a long answer near the 680-token ceiling (cannot be forced deterministically without live spend) — the fix is now in place; this remains a real-model spot-check, not a blocker.

## Full suite (last act, run after all QA-added tests, post-fix re-verify)
`npx vitest run` → **190 test files: 187 passed, 3 failed**; **6923 tests: 6920 passed, 3 failed**. The 3 failed tests are **pre-existing, environment-dependent, verified NOT introduced by this diff** (identical root causes CAM-409's `test.md` already documented for this worktree, re-confirmed on this pull):
- `__tests__/delivery-client.test.ts` (1 test) — per the dispatch contract, known env-dependent (`DELIVERY_DATABASE_URL` not set locally); ignored per instruction.
- `__tests__/f5-account-misc.test.ts` + `__tests__/f6-palette-guard.test.ts` (1 test each) — both assert `git diff staging --name-only` excludes `app/status/page.tsx`. Confirmed: this worktree's local `staging` ref is behind `origin/staging`; against `origin/staging` the assertion holds. Confirmed the real story diff (`git diff origin/dev --name-only`) touches only this story's files — no `app/status/page.tsx`.

No `it.fails()`/expected-fail remain in the CAM-410 suite — all 3 original defects are plain green asserts, plus 5 new Round-2 asserts, plus the pre-existing gap-closing tests, all green.

`npx eslint __tests__/cam-410-adversarial-seam.test.ts` → **0 errors, 0 warnings**. `npx tsc --noEmit` → **0 errors**.

## Links
`story.md` (AC/BR/EC) · `.claude/rules/qa.md` · `.claude/rules/security.md` §6 (AI/LLM untrusted model output) · CAM-272 `test.md` (Prove-It `it.fails()` convention this file follows) · CAM-409 `test.md` (source-inspection + local-staging-ref precedent)

## Changelog
- v1 (2026-07-18) — created. Full AC/BR/EC walk across both the server (CAM-410 server dispatch) and FE (chip render dispatch) halves. Closed 3 real test gaps (blank-item-mixed-in-array through the full pipeline, chip-absence-on-notice-branches structural proof, TH+EN verbatim copy assertion for `suggestedQuestionsLabel`). Found 3 Critical defects sharing one root cause in `extractSuggestions`'s single non-greedy regex match (duplicate block, truncated/no-closing-tag block, forged-nested-delimiter-tag candidate) — all violate BR-5's "answer never contains raw markup" promise; #3 is a genuine delimiter-escape/prompt-injection-class bypass on the output sanitization boundary. `status: Blocked` pending the fix.
- v2 (2026-07-18) — re-verify pass after backend's fix (`d4186ed`). Confirmed the 3 original `it.fails()` reproductions were flipped to plain `it()` asserts WITHOUT weakening (diffed identical). Tried 5 new adversarial shapes against the hardened JSON-validity-driven boundary logic (bracket-text candidate, quoted-tag-text candidate, first-malformed/second-well-formed, first-well-formed/second-malformed, compound nested-forged-between-real-candidates) — **all held, zero markup leak**; one Info-level non-security functional-degradation note recorded (not filed as a defect). Also fixed a real markdown table column-count bug in this file's own AC→test matrix (6 data columns vs a 5-column header — caught by the IDE's markdownlint hook mid-edit). Full suite re-run: 190 files/187 passed + 3 pre-existing env fails (unchanged), 0 new failures. `status: In Progress`, ready for security's pass.
