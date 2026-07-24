---
artifact: story
feature: ai-assistant
epic: kongfai-reliability-query-understanding (CAM-479 parent wave)
story: resolvedates-single-weekday (CAM-479)
status: Done (spec-lite, code + tests in same PR)
version: v1
updated: 2026-07-25
---

<!--
Spec-lite (per ops.md Gate policy v2): deterministic, single file-surface
(lib/ai/tools/resolve-dates.ts), no schema/migration, no new API contract —
a pure-function bug fix + tests + golden-corpus additions. G1 folds into the
G3 packet.
System/tool-facing story (same framing as CAM-462): `resolveDatesCore` is a
DETERMINISTIC pure function — no LLM, no network, no DB write for this rule
— so the AC "Then" column describes the deterministic TOOL RESULT in plain
language; Thai lives only in the Given-column input utterances.
-->

## Story
As a **Camper**, I want น้องกองไฟ to understand a SINGLE Thai weekday phrase (`เสาร์หน้า`, `เสาร์นี้`, `ศุกร์หน้า`, `เสาร์ที่จะถึง`) the same way it already understands `เสาร์อาทิตย์นี้`/`สุดสัปดาห์หน้า`, so that asking about one specific day gets me a real availability check instead of the assistant looping and asking me to spell out a calendar date.
Why: production bug (F1) — `resolveDatesCore` had a rule for the COMPOUND weekend phrase but no rule for a lone weekday name; every single-weekday phrase fell through to `{ ok:false, reason:'unsupported' }` (BR-5's "never guess" fallback), so the camper got stuck being asked to restate the date even though the phrase was perfectly parseable.
Scope: add ONE deterministic dispatch rule to the existing `resolveDatesCore` (`lib/ai/tools/resolve-dates.ts`) covering all 7 Thai weekday names with an optional `นี้`/`หน้า`/`ที่จะถึง` modifier (or none); add golden-corpus cases exercising the fixed phrases; add Prove-It unit tests. No new tool, no new endpoint, no schema/migration.
Depends on: CAM-462 (the `resolveDatesCore`/`resolveDatesTool` this rule extends) · CAM-457 (the eval harness the new golden cases run under)

## AC
| # | Given | When | Then (tool result, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Today is a known Wednesday (Asia/Bangkok); camper says `เสาร์หน้า` | `resolveDatesCore` runs | Returns ONE range: check-in = next week's Saturday, checkout(exclusive) = the day after (one night) | Deterministic weekday math; feeds `checkAvailability` | EC-1 |
| AC-2 | Same Wednesday; camper says `เสาร์นี้` | `resolveDatesCore` runs | Returns ONE range: check-in = THIS week's Saturday (before `เสาร์หน้า`'s date), checkout(exclusive) = the day after | Deterministic; `เสาร์หน้า`'s date always equals `เสาร์นี้`'s date + 7 days from the same `now` | EC-2 |
| AC-3 | Today IS a Saturday; camper says `เสาร์นี้` | `resolveDatesCore` runs | Returns TODAY as check-in (today counts as a match for `นี้`), checkout(exclusive) = tomorrow | Deterministic; never skips to next week when today already matches | EC-3 |
| AC-4 | Any of the other 6 weekdays with `หน้า`/`นี้`/`ที่จะถึง`/no modifier (e.g. `ศุกร์หน้า`, `พฤหัสบดีหน้า`, bare `เสาร์`) | `resolveDatesCore` runs | Resolves to the correct single-night range for that weekday under the same `นี้`-vs-`หน้า` semantics as AC-1/AC-2 | Deterministic; covers all 7 Thai weekday names, both spellings of Thursday (`พฤหัส`/`พฤหัสบดี`), optional `วัน` prefix | EC-4 |
| AC-5 | Camper says the COMPOUND weekend phrase `เสาร์อาทิตย์นี้` (contains the weekday substring `เสาร์`) | `resolveDatesCore` runs | Still returns the 2-night WEEKEND range (Sat→Mon) — the new single-weekday rule never intercepts a compound weekend phrase | Regression-safe; existing CAM-462 weekend behavior unchanged | EC-5 |
| AC-6 | Camper says a past-day phrase `เมื่อวาน` | `resolveDatesCore` runs | Still returns `{ ok:false, reason:'unsupported' }` — a past stay is meaningless | No date fabricated; untouched by this fix | EC-6 |

## Rules
- BR-1 The new rule matches all 7 Thai weekday names — `จันทร์` `อังคาร` `พุธ` `พฤหัส`/`พฤหัสบดี` `ศุกร์` `เสาร์` `อาทิตย์` — with an optional leading `วัน` and an optional trailing modifier `นี้` | `หน้า` | `ที่จะถึง` | none.
- BR-2 Semantics: `[day]นี้` / `[day]ที่จะถึง` / no modifier = the NEXT occurrence of that weekday ON OR AFTER today (today counts as a match). `[day]หน้า` = next WEEK's occurrence = the `นี้` result + 7 days exactly.
- BR-3 Result shape matches every other single-day rule in this file: ONE range, `startDate` = the resolved day, `endDate` = the day after (EXCLUSIVE checkout, one night), plus an `interpretation` gloss built via the existing `formatRangeGloss` helper so the camper can correct a wrong `นี้`/`หน้า` reading.
- BR-4 Ordering — the new rule is dispatched AFTER the existing compound-weekend rules (`เสาร์อาทิตย์นี้/หน้า`, `สุดสัปดาห์นี้/หน้า`) and BEFORE the final `unsupported` fallback, so a compound phrase is never shadowed by the new single-weekday match (AC-5).
- BR-5 No change to `เมื่อวาน` (past, unsupported) or `ช่วงนี้` (vague, ambiguous) — both remain exactly as before (AC-6).

## Edge cases
- EC-1 IF the phrase names a weekday with `หน้า` THEN the result is exactly 7 days after the same weekday's `นี้` result computed from the SAME `now` (BR-2).
- EC-2 IF the phrase names a weekday with `นี้`/`ที่จะถึง`/no modifier AND today is not that weekday THEN the result is the next occurrence strictly in the future, never a past date (BR-2).
- EC-3 IF today IS the named weekday AND the modifier is `นี้` (or none/`ที่จะถึง`) THEN the result is TODAY, never skipped to next week (BR-2).
- EC-4 IF the weekday is spelled either `พฤหัส` or `พฤหัสบดี` (with or without a `หน้า`/`นี้` modifier) THEN both resolve to the same Thursday date and the modifier is still captured correctly (regression guard against alternation-order truncation in the regex).
- EC-5 IF the text is the compound phrase `เสาร์อาทิตย์นี้`/`เสาร์อาทิตย์หน้า` THEN the existing weekend rule matches first; the new single-weekday rule is never reached (BR-4).
- EC-6 IF the text is `เมื่อวาน` (a past-day phrase) THEN the result remains `{ ok:false, reason:'unsupported' }` (BR-5, untouched).

## Data
- No schema/migration. Code-only change to `resolveDatesCore` (`lib/ai/tools/resolve-dates.ts`) — a pure function, no new fields/entities.

## Seams & refs
- Reuse: `weekdayOfISO`/`addDaysISO`/`formatRangeGloss` (all already in `lib/ai/tools/resolve-dates.ts`) — the new rule reuses these, no parallel date-math helper introduced.
- No other reader/writer of "how a Thai date phrase resolves" exists outside this file (confirmed at CAM-462's G2 sweep); this story adds one more dispatch branch inside the same function, not a new seam.
- Refs: CAM-462 (`resolveDatesCore`/`resolveDatesTool`, the function this extends) · CAM-457 (eval harness + golden-cases.json fixture this story adds cases to).

## Out of scope
- Past-tense weekday phrases (e.g. `เมื่อวันเสาร์` = "last Saturday") — not a reported production failure; a separate ticket if the eval corpus surfaces it.
- Wiring the golden-corpus `resolveDates`/`checkAvailability` cases into a real model run — the eval harness self-skips without `OPENROUTER_API_KEY` (CAM-457 behavior, unchanged); these cases run only when a key is present.

## Self-verify
- AC-1..AC-6 → unit tests in `__tests__/cam-479-resolve-dates-weekday.test.ts`, pinned `now` (fixed Wednesday + a fixed Saturday), no wall-clock dependency.
- Story-specific: `เสาร์หน้า` == `เสาร์นี้` + 7 days from the SAME `now` (BR-2) · today-is-the-day boundary (EC-3) · long/short Thursday spelling regression (EC-4) · compound-weekend non-interception regression (AC-5/EC-5) · `เมื่อวาน` untouched (AC-6/EC-6) · existing CAM-462 suite (`cam-462-resolve-dates.test.ts`) re-run green, no regression.
- 5 new golden-corpus cases (group `P17`, `scripts/ai-eval/golden-cases.json`) exercise single-weekday utterances against `checkAvailability`/`bulkAvailability`; `cam-457-eval-harness.test.ts` fixture-count assertion updated to match.
- Gate = /quality-gate · Done = lint/typecheck/test green + AC verified via the unit tests above (pure function, no localhost server needed to observe the fix) before merge into `dev`.

## Changelog
- v1 (2026-07-25) — created; spec-lite (deterministic single-file fix, no schema/API-contract change). F1 production bug closed.
