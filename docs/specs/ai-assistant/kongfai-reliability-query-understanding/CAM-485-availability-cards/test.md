---
linear: CAM-485
feature: ai-assistant
epic: kongfai-reliability-query-understanding
persona: Camper
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-07-25
---
# Test — availability-cards (CAM-485)

## AC→test matrix
<!-- risk = H/M/L (impact × likelihood if this AC breaks). Adversarial independent QA verify (backend-implemented; QA wrote no production code). -->
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (bulkAvailability cards[]) | M | unit | `__tests__/cam-485-availability-cards.test.ts` | ✅ |
| AC-2 (checkAvailability cards:[card]) | M | unit | `__tests__/cam-485-availability-cards.test.ts` | ✅ |
| AC-3 (engine dedup, non-streaming) | H (existence/consistency-adjacent) | integ | `__tests__/cam-485-availability-cards.test.ts` | ✅ |
| AC-3 (engine dedup, **streaming**) | H (spec explicitly names both paths; original suite missed this) | integ | `__tests__/cam-485-availability-cards.test.ts` (QA-added) | ✅ |
| AC-4 (no free anywhere -> `cards:[]`, no fake) | M | unit | `__tests__/cam-485-availability-cards.test.ts` | ✅ |
| EC-1 (empty cards, never absent/throw) | M | unit | `__tests__/cam-485-availability-cards.test.ts` | ✅ |
| EC-2 (NO_DATA -> no `cards` key, no oracle) | **H — security-adjacent** | unit | `__tests__/cam-485-availability-cards.test.ts` | ✅ |
| EC-3 (RANGE_TOO_WIDE -> no `cards`) | H (same no-oracle contract) | unit | `__tests__/cam-485-availability-cards.test.ts` | ✅ |
| EC-4 (cross-tool overlap dedup, first-seen order) | H | integ | `__tests__/cam-485-availability-cards.test.ts` | ✅ |
| EC-4 (**streaming twin**) | H (QA gap-fill) | integ | `__tests__/cam-485-availability-cards.test.ts` (QA-added) | ✅ |
| EC-5 (card with no readable `id`, never throw) | M | integ | `__tests__/cam-485-availability-cards.test.ts` | ✅ |
| EC-5 (non-string `id`, e.g. numeric — **QA-added**) | M | integ | `__tests__/cam-485-availability-cards.test.ts` (QA-added) | ✅ |
| BR-4 (`ok:false` never leaks a `cards` key — **QA-added**) | M (contract-break guard) | unit | `__tests__/cam-485-availability-cards.test.ts` (QA-added) | ✅ |

## Validation cases
- **BR-1 (bulkAvailability):** happy — single-range free camp -> `cards[remaining=cell.remaining]`; multi-range -> `remaining` = FIRST free cell (deterministic, asserted with range-0-full/range-1-free fixture, never last/aggregate); boundary — mix of free+full camps -> `cards` has ONLY the free ones while `camps`(+`cells`) keeps both (BR-4 byte-for-byte, asserted via `toEqual`/`toHaveLength`); error — `unknown` cell (capacity null, unbounded) correctly excluded from `cards`.
- **BR-2 (checkAvailability):** happy — visible camp + real result -> `cards:[card]`, `remaining` = the SAME just-computed number (no second calc), visibility-gate query args asserted unchanged (`select:{id:true}`, still ungated by the card fetch); error/no-oracle — unpublished id AND nonexistent id both produce the byte-identical no-`cards` shape (`not.toHaveProperty('cards')`), `getRemainingCapacity` never called; error — `RANGE_TOO_WIDE` throw -> unchanged `{ok:false,code}`, card-fetch `findFirst` never reached (call-count assertion); edge — card row races away between the two queries -> fails open (numbers intact, no `cards`, no throw).
- **BR-3 (engine dedup):** happy — 2 tools, overlapping ids, first-seen order kept, proven on BOTH `runAssistantTurn` (non-streaming) and `runAssistantTurnFromMessagesStreaming` (QA gap-fill — the original suite only covered non-streaming despite the spec naming both paths explicitly); edge — a card with no readable `id` (missing property, or present-but-non-string e.g. numeric) is pushed unconditionally, on both paths, never throws.
- **BR-4 (no contract break):** `bulkAvailability`'s 3 `ok:false` branches (`over_cap`/`no_match`/`error`) asserted with `toEqual` (exact shape) + `not.toHaveProperty('cards')` — the discriminated union forbids the leak only at compile time; asserted at runtime since TS types are erased (QA gap-fill).

**Prove-It (red-before-green), run by QA independently of the backend author:**
1. Reverted `collectCardsFromToolData` to its pre-fix naive `push(...maybeCards)` (no dedup) -> all 4 dedup tests (2 pre-existing non-streaming + 2 QA-added streaming) went **red** with the exact "B appears twice" diff.
2. Added a stray `cards: []` to `bulkAvailability`'s `over_cap` branch -> the QA-added BR-4 no-leak test went **red**.
3. Both reverted via `git checkout --` before committing; `lib/` is byte-identical to the backend's fix (verified `git diff -- lib/...` empty post-revert).

## Coverage
Measured (`npx vitest run` + `--coverage`, files scoped to the CAM-485 diff), across `__tests__/cam-485-availability-cards.test.ts` + regression siblings (`cam-465*`, `cam-469*`, `cam-430*`, `cam-416*`, `cam-270-check-availability.test.ts`):
- `lib/ai/tools/bulk-availability.ts` — **100%** stmts / 87.09% branch / 100% funcs / 100% lines (all remaining branch misses are pre-existing province/region + tool-registry wiring, outside the CAM-485 diff).
- `lib/ai/tools/check-availability.ts` — **94.73%** stmts / 100% branch / 66.66% funcs / 94.44% lines (the one uncovered function is the `checkAvailabilityTool.execute` registry wrapper, pre-existing).
- `lib/ai/openrouter-client.ts` — 80.54% stmts (whole shared 1400+-line file, not diff-scoped; the CAM-485 diff itself — `readCardId`, `collectCardsFromToolData` dedup, the `cards` param threading through `executeToolCalls`/both round-loops — is 100% exercised per the Prove-It red/green above; the file's uncovered lines belong to streaming-fallback/abort/deadline branches outside this story's scope, covered by `cam-412`/`cam-459`/`cam-460` which were not included in this scoped run).
All 3 files individually clear the ≥80%-on-new-code bar; the whole-file 80.54% on `openrouter-client.ts` is reported honestly rather than inflated by excluding it.

## Links
`story.md` (AC/BR) · `.claude/rules/qa.md` · added tests: `__tests__/cam-485-availability-cards.test.ts` (commit `1a35aa5`)

## Changelog
- v1 (2026-07-25) — created; independent adversarial QA verify, 0 defects found, 6 gap-fill tests added (streaming dedup ×2, non-string-id EC-5, BR-4 no-leak ×3)
