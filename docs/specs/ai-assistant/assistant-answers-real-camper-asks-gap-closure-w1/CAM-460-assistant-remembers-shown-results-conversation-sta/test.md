---
linear: CAM-460
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1
persona: Camper
artifact: test
owner: qa-engineer
status: Blocked — 1 code defect + 1 spec contradiction found, both require a decision before Done
version: v1
updated: 2026-07-24
---
# Test — Assistant remembers shown results (conversation state for follow-ups) (CAM-460)

## Test strategy note (read first)

Independent QA verify of a shipped diff (PR #543, branch `feature/cam-460-conversation-state`,
commits `54a5941` + `f05674d`) authored before this dispatch — not accepted on the authoring
agent's self-report alone. I re-derived the AC/BR/EC → test matrix from `story.md`/`tech.md`
BEFORE reading the 28 pinned tests, then diffed; audited `deriveShownState` against realistic
multi-turn fixtures (dedupe, interleaved non-search reply, partial/whole cards corruption);
audited the guest-forged-campId security chain end-to-end (against the ALREADY-gated
`getCampDetail`/`checkAvailability` tools, not re-deriving their own gate); audited all 5
sibling test edits for weakening; and closed 12 gap-fill tests + verified 1 drift-guard test.
Found **2 real issues**: a code defect (`sanitizeShownResultName` doesn't strip an unclosed
forged tag) and a spec contradiction (AC-2's price-superlative promise vs. the injected state
shape carrying no price) — both documented below with reproductions. All new tests Prove-It'd
red-then-green by hand (perturb → red → revert → green). `status = blocked` per qa.md's exit
criteria ("if any defect is open, do not hand off as green").

## Re-derivation diff (before reading the pinned suite)

My independent AC/BR/EC → test-case list matched the pinned suite's intent on every mechanism-
level row. Two things it could not (and, per BR-6/tech.md D5, was never meant to) prove — the
model's actual RESOLUTION behavior (AC-1/2/5/6 as lived experience) — are explicitly deferred by
the story's own Self-verify to the eval harness + owner-verify on localhost; this PR added no
`scripts/ai-eval/*` cases (confirmed: `case-schema.ts` has no `shownResults` field yet,
`golden-cases.json` still has 8 cases — matches tech.md D5's "flag for the eval owner", a SOFT,
not-yet-picked-up dependency). Gaps found and closed:

- **`deriveShownState` fixture depth** — the pinned suite covers ordinal projection, overwrite-
  on-newer-search, EC-7 (no cards / null blocks / malformed-whole-blocks), and USER-role
  isolation, but never: (a) `shownIds` dedup when the SAME camp reappears in a later search
  (Set vs. array semantics), (b) a later PLAIN-text reply (no cards) after a search — does it
  wrongly clear `lastResults`? (interleaved-question, AC-6-adjacent), (c) a cards block with ONE
  malformed entry mixed with valid ones (ordinals must come from the FILTERED survivors), (d) a
  corrupted LATEST block amid an otherwise-valid earlier search (does it fall back or wipe?).
  **Closed** — 4 new tests in `cam-460-conversation-state.test.ts`.
- **`sanitizeShownResultName` had zero DIRECT unit tests** — only 2 indirect assertions via the
  full `buildSystemPrompt` pipeline (forged closing tag, truncation). **Closed** — 7 direct unit
  tests (normal/null-empty/boundary/control-chars/any-tag/cross-fence/whitespace) + found a real
  defect while doing so (see Defects found).
- **The "forged campId flows through unauthorized" half of BR-4/D2's security argument had no
  test** — the ADVERSARIAL-NAME half was tested; the ID-authority half (does CAM-460's own code
  perform any DB check on a guest-forged id? it must not — the tool re-fetches) was implicit,
  never asserted. **Closed** — 1 new test in `cam-460-conversation-state.test.ts` (id flows
  verbatim) + a new dedicated file proving the consuming tools re-gate it (see below).
- **`MAX_SHOWN_RESULTS`/`SEARCH_CAMPSITES_MAX_RESULTS` co-location drift risk** — the source's
  own comment flags this as "DELIBERATELY... If the tool's cap ever changes, update this value
  too" — a comment is not a guard. **Closed** — 1 new drift-guard test.
- **AC-2 (superlative-over-shown-set by price) has no data to resolve against** — see Defects
  found #2; this is a spec/tech contradiction, not a missing test.

## AC→test matrix

<!-- risk = H/M/L. "mechanism" tests prove the CODE this story built; "behavior" is the model's
own resolution, provable only by eval (not yet added) + owner-verify per story.md Self-verify. -->
| AC | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (ordinal resolves — mechanism: derive + inject) | H | unit | `cam-460-conversation-state.test.ts` (`deriveShownState` ordinal projection + injection-block tests) | pass |
| AC-1 (ordinal resolves — BEHAVIOR: the model actually calls the right tool) | H | eval (not yet added, tech.md D5 soft dep) + owner-verify | `scripts/ai-eval/golden-cases.json` (future) | **not verifiable headless yet** |
| AC-2 (superlative-over-shown-set — mechanism: injection carries the shown set) | H | unit | `cam-460-conversation-state.test.ts` | pass (mechanism only) |
| AC-2 (superlative BY PRICE resolves correctly) | H | — | — | **BLOCKED — see Defect #2: no price data reaches the model to resolve this** |
| AC-3 (no prior results → clarify, no camp invented — mechanism) | H | unit | `cam-460-conversation-state.test.ts` (`shownResults=[]` → `NOTHING_SHOWN_MARKER`) | pass |
| AC-3 (BEHAVIOR: model actually asks, never invents) | H | eval (not yet added) + owner-verify | — | not verifiable headless yet |
| AC-4 (guest carries state → resolves; absent → clarify) | H | integration (route wiring) | `cam-460-route-wiring.test.ts` (guest lastResults flows / absent → undefined, both JSON + streaming) | pass |
| AC-5 (newest search replaces the shown set) | H | unit | `cam-460-conversation-state.test.ts` (BR-5/AC-5 overwrite test + new dedupe test) | pass |
| AC-6 (constraints retained across an interleaved question) | M | unit (mechanism: lastResults survives an interleaved plain reply) + owner-verify (constraint replay is message-window text, unchanged this story) | `cam-460-conversation-state.test.ts` (new gap-fill test) | pass (mechanism); constraint-replay itself is pre-existing `loadWindow`, not new code |
| BR-1 (state shape, shownIds accumulate) | H | unit | `cam-460-conversation-state.test.ts` (normal + new dedupe test) | pass |
| BR-2 (ordinal/superlative resolve via a real tool call) | H | unit (injection format only; the "real tool call" half is model behavior) | `cam-460-conversation-state.test.ts` | pass (mechanism); see Defect #2 for the superlative gap |
| BR-3 (no-prior/out-of-range → clarify, never guess) | H | unit | `cam-460-conversation-state.test.ts` (empty-array clarify text) | pass (mechanism) |
| BR-4 (guest untrusted input; sanitized + fenced) | H | unit + security | `cam-460-conversation-state.test.ts` (adversarial name sanitized, forged campId flows verbatim) + `cam-460-guest-forge-security.test.ts` (consuming tool re-gates) | pass, **1 defect found** (see below) |
| BR-5 (single most-recent slot; depth=1) | H | unit | `cam-460-conversation-state.test.ts` (overwrite test) | pass |
| BR-6 (Thai wording representative, not char-for-char; testable contract = eval+owner-verify) | — | n/a (documentation rule) | — | acknowledged; see AC-1/2/3 behavior rows |
| EC-1 (resolution routes through a real tool call — grounding) | H | eval/owner-verify (model behavior) | — | not verifiable headless |
| EC-2 (superlative with 1 shown camp / attribute not in shown data → clarify) | M | eval/owner-verify | — | not verifiable headless (compounds Defect #2) |
| EC-3 (no search yet → ask, invent nothing) | H | unit (mechanism) | `cam-460-conversation-state.test.ts` | pass |
| EC-4 (guest, no carried lastResults → clarify) | H | integration | `cam-460-route-wiring.test.ts` (absent → undefined, JSON + streaming) | pass |
| EC-5 (newer search → old ordinals gone) | H | unit | `cam-460-conversation-state.test.ts` (overwrite + dedupe tests) | pass |
| EC-6 (ordinal out of range → say only N shown) | M | eval/owner-verify (model behavior; prompt text instructs this) | — | not verifiable headless |
| EC-7 (state unavailable/oversize/corrupted → degrade, never error) | H | unit (gap-fill) | `cam-460-conversation-state.test.ts` (null blocks, malformed-whole, malformed-entry-mixed, corrupted-latest-falls-back — 4 shapes) | pass |
| D2 pt.1 (forged campId — consuming tool gates, no leak) | H | security (composition proof, not re-deriving the gate) | `cam-460-guest-forge-security.test.ts` | pass |
| D2 pt.2 (adversarial name sanitized before the prompt) | H | unit + security | `cam-460-conversation-state.test.ts` + `cam-460-guest-forge-security.test.ts` sibling coverage | pass, **1 defect found** (unclosed-tag variant) |
| D3 (cap ≤10, per-name truncation) | M | unit + drift-guard | `cam-460-conversation-state.test.ts` (cap/truncation) + `cam-460-guest-forge-security.test.ts` (single-source-of-truth guard) | pass |
| Zod boundary (`shownResultSchema`/`chatRequestSchema.lastResults`) | H | unit | `cam-460-conversation-state.test.ts` | pass |
| 5 sibling test edits (mechanical-consequence fixes) | H | audit (not new tests) | see "Sibling edits audit" below | pass, no weakening found |

Type mix (new tests this dispatch): 100% unit/integration (0% e2e) — consistent with this
story's own scope (server-side derive/inject/validate; no UI). Behavioral (LLM resolution) rows
are correctly routed to eval+owner-verify per the story's own BR-6/Self-verify, not silently
skipped.

## Prove-It — hand-verified red-then-green (gap-fill tests)

Temporarily perturbed `lib/ai/conversation-store.ts`'s `deriveShownState` (Set→array, dedup
removed; `continue`→reset on an empty-cards message) and re-ran
`cam-460-conversation-state.test.ts`:

- **3 of the 4 new fixture tests went RED** exactly as expected:
  `AssertionError: expected [...4 ids...] to deeply equal [...3 ids...]` (dedupe test),
  `expected [] to deeply equal [{ordinal:1,...},{ordinal:2,...}]` (interleaved-reply test, twice
  — the "does not clear" test AND the "corrupted-latest-falls-back" test both correctly caught
  the same regression from a different angle).
- Reverted (confirmed `git diff lib/ai/conversation-store.ts` = empty); re-ran → **33 pass, 1
  expected-fail** (the documented defect below), green again.

The `sanitizeShownResultName` direct unit tests were Prove-It'd by construction: each asserts a
concrete input→output pair against the real function; the `it.fails` defect-documentation test
(below) is itself the Prove-It artifact for Defect #1 — it demonstrably fails against the real,
unmodified source (verified via a standalone Node probe replicating the exact algorithm before
committing the test, to avoid reporting an unconfirmed hypothesis).

## Sibling edits audit (5 files, dispatch step 4)

All 5 are legitimate, mechanical consequences of the new `deriveShownState` call / new call
arity — **no assertion was weakened or removed; two were genuinely strengthened**:

| File | Change | Verdict |
|---|---|---|
| `cam-420-ai-chat-route-v2.test.ts` | Added a static `deriveShownState: () => ({lastResults:[],shownIds:[]})` mock stub | Mechanical. Zero assertion changes. |
| `cam-430-search-attempted-wire.test.ts` | Same stub | Mechanical. Zero assertion changes. |
| `cam-412-ai-chat-route-streaming.test.ts` | Same stub | Mechanical. Zero assertion changes. |
| `cam-271-ai-chat-route.test.ts` | Arity pin `toHaveLength(1)`→`toHaveLength(3)`; destructures `ctx`/`shownResults` | **Strengthened** — adds 2 NEW assertions (`ctx` is `{}`, `shownResults` is `undefined`) that were not present before; the original invariant ("no real options/data snuck in") is preserved and made more explicit. |
| `cam-417-adversarial-verify.test.ts` | Source-regex updated from `/runAssistantTurnFromMessages\(turnMessages\)/` to `/runAssistantTurnFromMessages\(turnMessages,\s*\{\},\s*shownResults\)/` | **Verified not weakened.** Read the real `route.ts` source directly: the legacy call is exactly `runAssistantTurnFromMessages(turnMessages, {}, shownResults)` — `ctx` is STILL a literal `{}` object, never a variable/expression that could carry attacker- or model-controlled data. The regex is pinned against the exact literal source text (same rigor as before), not loosened to a fuzzy pattern. The security invariant this test guards ("ctx.userId can only ever come from a server-side session, never args/body/model output") holds unchanged. **Minor Info-level doc-staleness nit** (non-blocking): the file's header docblock (~line 33-34) still narrates the OLD assertion ("passes NO ctx argument at all... resolves to the {} default") instead of the updated one ("passes a LITERAL empty ctx `{}`"); the code and the `it()` title were updated, the file-level docblock summary was not. Cosmetic only — does not affect test correctness. |

## Coverage

Real run, `npx vitest run --coverage` scoped to the CAM-460 diff (cross-referenced against
`git diff origin/dev...HEAD` hunks to isolate NEW lines in shared files, since 3 of the 5 touched
files are pre-existing with much unrelated code):

- **`lib/ai/conversation-store.ts`** (new `deriveShownState` + types): **100%** stmts/branch/func/line (93/93, 42/42, 17/17, 87/87).
- **`lib/validations/ai-chat.ts`** (new `shownResultSchema` + `lastResults` field): **100%** (12/12, 0/0, 2/2, 11/11).
- **`lib/ai/openrouter-client.ts`** (shared file — new: imports, `boundedShownResults`, `buildShownResultsBlock`, `buildSystemPrompt`'s 3rd param, both exported functions' new 3rd/4th param): file-overall 95.09%/90.59%/97.5%/97.05%; uncovered lines (613, 851, 976, 1002-1004, 1033, 1035, 1056, 1064, 1083-1084, 1114, 1122-1123, 1138, 1171, 1175, 1323) cross-checked against this story's diff hunks (91-118, 171-320, 895-913, 1218-1244) — **zero overlap; every CAM-460-added line is covered.** The uncovered lines are pre-existing (CAM-416/417/419-era agent-loop/error-handling branches), out of this diff.
- **`lib/ai/sanitize.ts`** (shared file — new: `sanitizeShownResultName` only, purely additive): file-overall 98.11%/94.44%/100%/97.95%; the one uncovered line (56, `return current;` inside `stripDelimiterTagsToFixpoint`'s loop-exhaustion fallback) is pre-existing CAM-410/415-era code, not touched by this diff.
- **`app/api/ai/chat/route.ts`** (shared file — new: `toShownResults`, `deriveShownState` wiring in `handleV2Turn`, `shownResults` threading in both legacy handlers): file-overall 94.63%/89.42%/95.23%/96.4%; uncovered lines (294, 354-355, 373, 503) cross-checked against this story's diff hunks (56-82, 165-192, 218-230, 275-296, 453-480) — **zero overlap; every CAM-460-added/changed line is covered.** Line 294 sits inside a touched hunk but is unchanged context (the pre-existing "`gen.next()` returns done on the very first call" edge case); the rest are outside any touched hunk entirely.

**New-code coverage verdict: 100% on every line/branch this story actually added or changed** —
comfortably over the ≥80% gate. Whole-file percentages for the 3 shared files understate this
because most of those files' code predates CAM-460; measured against the diff, per qa.md.

Full suite (real run, last act before push): `npx vitest run` → **260/260 files, 8055/8056 pass +
1 expected-fail (`it.fails`, the documented defect) = 8056/8056 accounted for**, 0 unexpected
failures, 0 skipped/flaky. `npx tsc --noEmit`: clean. `npm run lint`: 0 errors, 261 warnings (all
pre-existing tech-debt; confirmed 0 new warnings via diff cross-check on the touched test files).

## Defects found

**2** — both require a decision before this story is Done. Neither is fixed here (QA does not
write production code); both are reproduced with a real, executable test.

### Defect #1 (Important) — `sanitizeShownResultName` does not strip an UNCLOSED forged tag fragment

- **Failing "AC"/spec reference:** tech.md D2 security review point 2 ("a shown-result name has
  no legitimate reason to carry ANY tag-like markup... without stripping every tag, a forged
  `</shown_results>` inside `name` could escape the fence").
- **Repro (exact input → actual output):**
  `sanitizeShownResultName('ลานเขาใหญ่</shown_results', 200)` → returns
  `'ลานเขาใหญ่</shown_results'` **unchanged** (expected: the tag fragment stripped). Same for
  `sanitizeShownResultName('ลานเขาใหญ่<user_message', 200)` → returns unchanged.
- **Root cause:** `HTML_TAG_REGEX = /<[^>]*>/g` (`lib/ai/sanitize.ts`) requires a literal closing
  `>` to match at all. A forged tag fragment with NO closing bracket anywhere in the string never
  matches, so it survives untouched — unlike the sibling `sanitizeForPrompt`, which has an
  explicit hard-strip backstop (`DELIMITER_TAG_PREFIX_REGEX`) specifically for this "no closing
  bracket required" case (see that function's own docblock, `lib/ai/sanitize.ts` ~L59-73).
  `sanitizeShownResultName` has no equivalent backstop.
- **Severity reasoning:** Important, not Critical — no direct data leak or authz bypass (the
  resolving tool call still re-fetches + gates by id regardless of what the model "believes"
  about where the DATA fence ends); worst case is a degraded/manipulated ANSWER for that turn,
  bounded to the model's own interpretation of a syntactically-incomplete tag. Matches this
  codebase's own precedent severity for the sibling gap in `sanitizeForPrompt` ("Security fix
  (live repro, Important)").
- **Reproduction as a test (committed, does not break the gate):** `it.fails(...)` in
  `cam-460-conversation-state.test.ts` — Vitest's expected-failure wrapper. It genuinely fails
  today (confirmed via a standalone Node probe replicating the real algorithm before committing),
  which is what keeps `it.fails` "green" in CI; the moment a fix lands, this flips to an
  unexpected PASS and fails the suite — the signal to convert it to a plain `it`. This avoids
  committing a permanently-red test (would violate "all tests pass") while still leaving a real,
  executable, teeth-having regression net.
- **Recommendation:** add an equivalent hard-strip backstop to `sanitizeShownResultName`
  (mirroring `sanitizeForPrompt`'s `DELIMITER_TAG_PREFIX_REGEX` pattern, generalized since this
  function must strip ANY tag name, not just `shown_results`/`user_message`) — route to
  `security` or `backend`.

### Defect #2 (spec/tech contradiction, not a code bug) — AC-2's superlative-by-price cannot resolve; the injected state carries no price

- **Failing spec reference:** story.md BR-2 ("a superlative over the shown set (`ถูกกว่า`/
  `ถูกที่สุด`/`แพงสุด`) resolves over `last_results` **by the named attribute**") and AC-2
  ("Resolved over `last_results` by the named attribute (price)").
- **Contradicting tech reference:** tech.md D1's `ShownResult` shape = `{ordinal, campId, name}`
  — **no price field, anywhere** in the derive/injection pipeline (confirmed by reading
  `lib/ai/conversation-store.ts`, `lib/ai/openrouter-client.ts`'s `buildShownResultsBlock`, and
  `lib/validations/ai-chat.ts`'s `shownResultSchema` — all three agree, no price). D3 explicitly
  scopes the injected block to "ordinal → campId → name" only.
- **Evidence this is a real gap, not an oversight in my reading:** the story's own research
  source (`docs/research/campvibe-ai-gap-closure-data-layer.md`) categorizes "P4 superlative"
  under **"ไม่มี deterministic service"** (needs `sort`/a deterministic service), a SEPARATE
  bucket from "ไม่มี conversation state" (P1/P11/P16 — what CAM-460 actually builds), and assigns
  P4's real fix to **"Tool contract v2"** (`sort` on `searchCampsites`) — explicitly deferred to
  CAM-461 in this story's own Out-of-scope section. The research itself anticipated that a
  superlative needs more than conversation state alone; story.md's AC-2 nonetheless promises it
  as covered by THIS story, without providing the data the promise requires.
- **Why the model still might resolve it (uncertain, not proven either way):** the agent loop
  permits multiple `getCampDetail` calls per turn (`MAX_TOOL_CALLS_PER_ROUND=3`); a capable model
  COULD call `getCampDetail` on each shown campId to learn prices, compare, then answer — this is
  architecturally possible but is NOT instructed anywhere in the injected prompt text (`buildShownResultsBlock`'s
  wording says "resolve it to the campSiteId below," implying a direct lookup, not a compare-then-pick
  strategy), and is not proven by any test (unit or eval) in this PR.
  **Genuinely unproven either way** — not a confirmed-broken behavior, a confirmed-missing-proof one.
- **Recommendation (routes to architect, G2 re-open per story.md's own Self-verify: "IF the
  architect's G2 storage decision... turns out to contradict this behavior THEN STOP and re-open
  at G2"):** either (a) add `price` (or the relevant sortable attribute) as a 4th field to
  `ShownResult` — small, additive, low-risk — or (b) explicitly instruct the model in
  `buildShownResultsBlock`'s text to call `getCampDetail` on each candidate before answering a
  superlative, then prove it via an eval golden case, or (c) re-scope AC-2 to acknowledge the
  superlative is best-effort/model-judgment only. I recommend (a) as cheapest/most reliable, but
  this is an architect decision, not mine.

## Owner-verify / eval rows (cannot be proven headless, by the story's own design)

| # | Row | Why headless can't prove it |
|---|---|---|
| 1 | AC-1/AC-5/AC-6 — the model actually resolves an ordinal/retains constraints in a real conversation | LLM behavior; story.md Self-verify routes this to eval (`seededState`/`shownResults` golden cases, not yet added per tech.md D5) + owner-verify on localhost |
| 2 | AC-3/EC-3 — the model asks instead of inventing a camp when nothing was shown | Same as above |
| 3 | EC-1/EC-2/EC-6 — grounding via a real tool call, superlative edge cases, out-of-range ordinal wording | Same as above; EC-2 additionally compounds with Defect #2 |
| 4 | AC-2 (once Defect #2 is resolved) | Needs an architect decision first, then eval + owner-verify |

## Links

`docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-460-assistant-remembers-shown-results-conversation-sta/story.md` ·
`docs/specs/ai-assistant/assistant-answers-real-camper-asks-gap-closure-w1/CAM-460-assistant-remembers-shown-results-conversation-sta/tech.md` ·
`docs/research/campvibe-ai-gap-closure-data-layer.md` (P4 vs. D1-state categorization, Defect #2 evidence) ·
`.claude/rules/qa.md` · `.claude/rules/security.md` ·
`__tests__/cam-460-conversation-state.test.ts` · `__tests__/cam-460-route-wiring.test.ts` ·
`__tests__/cam-460-guest-forge-security.test.ts` (new) ·
`__tests__/cam-427-get-camp-detail.test.ts` · `__tests__/cam-469-check-availability-gate.test.ts`
(pre-existing gate proofs, not re-derived) ·
`lib/ai/conversation-store.ts` · `lib/ai/openrouter-client.ts` · `lib/ai/sanitize.ts` ·
`lib/validations/ai-chat.ts` · `app/api/ai/chat/route.ts`

## Changelog

- v1 (2026-07-24) — Independent QA verify of the shipped diff (PR #543, 28 pinned tests across 2
  commits, authored before this dispatch). Re-derived the AC/BR/EC matrix before reading the
  pinned tests; closed 12 gap-fill tests (4 `deriveShownState` fixtures, 1 forged-campId
  documentation test, 7 direct `sanitizeShownResultName` unit tests) + 1 new file
  (`cam-460-guest-forge-security.test.ts`, 3 tests: 2 tool-gating composition proofs + 1 drift
  guard) = 15 new tests. Prove-It'd the 4 fixture tests red-then-green by hand (perturbation
  + revert, confirmed clean). Audited all 5 mechanical sibling-test edits — none weakened, 2
  genuinely strengthened, 1 Info-level doc-staleness nit (non-blocking). Found 2 real issues: a
  code defect (`sanitizeShownResultName` incomplete-tag gap, Important, reproduced via a
  committed `it.fails` regression net) and a spec/tech contradiction (AC-2's price-superlative
  promise vs. the no-price injected state shape, evidenced by the story's own research
  categorization). New-code coverage: 100% on every CAM-460-added line across all 5 touched
  files (cross-checked line-by-line against diff hunks). Full suite: 260/260 files, 8056/8056
  tests accounted for (8055 pass + 1 expected-fail); typecheck clean; lint 0 errors/0 new
  warnings. Status: **blocked** — 2 findings need a decision (architect for Defect #2,
  security/backend for Defect #1) before Done.
