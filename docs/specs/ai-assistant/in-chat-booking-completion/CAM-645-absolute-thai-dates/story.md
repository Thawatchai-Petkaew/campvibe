---
artifact: story
feature: ai-assistant
epic: in-chat-booking-completion (CAM-695, S9 slice)
story: absolute-thai-dates (CAM-645)
status: Done (spec-lite, code + tests in same PR)
version: v1
updated: 2026-08-06
---

<!--
Spec-lite (per ops.md Gate policy v2): deterministic, single file-surface
(lib/ai/date-phrases.ts; lib/ai/tools/resolve-dates.ts description-only),
no schema/migration, no new API contract — a pure-function capability
addition + tests. G1 folds into the G3 packet.
System/tool-facing story (same framing as CAM-462/CAM-479): `resolveDatesCore`
is a DETERMINISTIC pure function — no LLM, no network, no DB write for this
rule — so the AC "Then" column describes the deterministic TOOL RESULT in
plain language; Thai lives only in the Given-column input utterances.
-->

## Story
As a **Camper**, I want to name an explicit date (`15 ส.ค.`, `วันที่ 15 สิงหา`, `15/8`, `15 สิงหาคม 2569`) at the date step, so that typing exactly what the assistant's own hint told me to type resolves my dates instead of re-asking me for something I already gave it.
Why: production gap (CAM-633 builder finding) — `resolveDatesCore` had 9 rules and none of them handled an absolute day+month phrase, while the shipped copy (`aiChat.booking.date.typeHint`/`date.unreadable`) promises `15 ส.ค.` works. A camper who follows the hint gets re-asked twice, then dumped to the assistant — and with a real confirm button landing this round (CAM-695), that loop is now a direct obstacle to completing a booking, not just an annoyance.
Scope: add ONE deterministic dispatch rule to the existing `resolveDatesCore` (`lib/ai/date-phrases.ts`) covering abbreviated Thai months (with/without a trailing dot), full month names, informal truncated month names, an optional leading `วันที่`, and bare numeric D/M — with Buddhist-era and Gregorian 4-digit year handling. Update the `resolveDates` tool's model-facing description (`lib/ai/tools/resolve-dates.ts`, description strings only) so the model knows absolute dates now resolve. No new tool, no new endpoint, no schema/migration.
Depends on: CAM-632 (the pure `resolveDatesCore` module this rule extends) · CAM-633 (the booking-flow pinned limitation this closes) · CAM-479 (the single-weekday rule this new rule's dispatch-ordering pattern mirrors)

## AC
| # | Given | When | Then (tool result, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Today is a known Wednesday 2026-07-22 (Asia/Bangkok); camper types `15 ส.ค.` (abbreviated month, trailing dot) | `resolveDatesCore` runs | Returns ONE range: check-in `2026-08-15`, checkout (exclusive) `2026-08-16` | Deterministic day+month math; feeds `checkAvailability`/the booking-flow date step | EC-1 |
| AC-2 | Same Wednesday; camper types `15 ส.ค` (identical abbreviation, NO trailing dot) | `resolveDatesCore` runs | Returns the IDENTICAL range as AC-1 | The trailing dot is optional, never required | EC-1 |
| AC-3 | Same Wednesday; camper types `วันที่ 15 สิงหา` (optional `วันที่` prefix + informal truncated month name) | `resolveDatesCore` runs | Returns the IDENTICAL range as AC-1 | Full name, informal truncation, and abbreviation all resolve to the same month | EC-2 |
| AC-4 | Same Wednesday; camper types `15/8` (bare numeric day/month, Thai D/M order) | `resolveDatesCore` runs | Returns the IDENTICAL range as AC-1 | Numeric form resolves without any month-name text present | EC-3 |
| AC-5 | Same Wednesday; camper types `15 สิงหาคม 2569` (full month name + explicit Buddhist-era year) | `resolveDatesCore` runs | Returns the IDENTICAL range as AC-1 (2569 BE − 543 = 2026 CE) | Buddhist-era 4-digit years are converted, never taken literally | EC-4 |
| AC-6 | Same Wednesday; camper types `15 สิงหาคม 2026` (explicit Gregorian year) | `resolveDatesCore` runs | Returns the IDENTICAL range as AC-1 | A Gregorian 4-digit year passes through unchanged | EC-4 |
| AC-7 | Same Wednesday; camper types `1 ม.ค.` (day+month with NO year, and Jan 1 has already passed this year) | `resolveDatesCore` runs | Returns check-in `2027-01-01`, checkout `2027-01-02` — the NEXT occurrence | Omitting the year never produces a past date | EC-5 |
| AC-8 | Same Wednesday; camper types `1 ม.ค. 2568` (explicit past Buddhist-era year → 2025 CE, before today) | `resolveDatesCore` runs | Returns `{ok:false}` — the assistant re-asks for the dates, same as any unparseable phrase | No date fabricated; reuses the existing past-phrase rejection shape (rule 9, formerly rule 8's `เมื่อวาน` path) | EC-6 |
| AC-9 | Same Wednesday; camper types `30 ก.พ.` (February has no 30th day) | `resolveDatesCore` runs | Returns `{ok:false}` — the assistant re-asks | No date fabricated for an impossible calendar day | EC-7 |

## Rules
- BR-1 The new rule matches an explicit day+month, in three lexical forms: (a) abbreviated Thai month with an OPTIONAL trailing dot (`ส.ค.`/`ส.ค`), (b) full Thai month name (`สิงหาคม`) or its common informal truncation (`สิงหา`), (c) bare numeric `D/M` (Thai day-then-month order, e.g. `15/8`). An optional leading `วันที่` is accepted before the day number in forms (a)/(b).
- BR-2 Month-alias matching is LONGEST-alias-first, so a short informal form (`สิงหา`) never short-circuits a longer one sharing the same prefix (`สิงหาคม`) before a trailing year is read (regression class: same alternation-order hazard CAM-479 already guards for `พฤหัส`/`พฤหัสบดี`).
- BR-3 Year handling: an explicit 4-digit year is used as given, Buddhist-era normalized (`year > 2400` → `year − 543`); a Gregorian 4-digit year (`≤ 2400`) passes through unchanged. An OMITTED year always resolves to the NEXT occurrence — this year if the day+month has not yet passed relative to today, else next year. A bare day+month can therefore never itself resolve to a past date; only an EXPLICIT past year can.
- BR-4 An explicit year that resolves to a date before `todayISO` rejects via the SAME `{ ok:false, reason:'unsupported' }` shape rule 9 (the existing `เมื่อวาน` past-phrase rejection, renumbered from rule 8) already returns — no new rejection reason is invented (per ticket instruction: reuse the existing path).
- BR-5 An impossible calendar date (day/month combination that does not exist in any year, e.g. `30 ก.พ.`, or a specific year's non-leap `29 ก.พ.`) is never fabricated or silently clamped — it returns the same `unsupported` shape as BR-4.
- BR-6 Result shape matches every other single-day rule in this file: ONE range, `startDate` = the resolved day, `endDate` = the day after (EXCLUSIVE checkout, one night), plus an `interpretation` gloss (`วันที่ระบุ …`) built via the existing `formatRangeGloss` helper.
- BR-7 Ordering — the new rule is dispatched AFTER every existing named-term relative/weekday rule (none of those ever contain a digit or a month alias, so none is shadowed) and BEFORE the past-phrase (`เมื่อวาน`)/vague-phrase (`ช่วงนี้`) rules, which are renumbered from rules 8/9 to 9/10 to make room.
- BR-8 No change to any of the existing 9 rules' own behavior — regression-proven against the full `cam-462`/`cam-479`/`cam-633` suites.

## Edge cases
- EC-1 IF the abbreviated-month form is used with or without the trailing dot THEN both resolve to the identical date (BR-1a).
- EC-2 IF the full month name or its informal truncation is used, with or without the leading `วันที่` THEN both resolve to the identical date (BR-1b).
- EC-3 IF the bare numeric `D/M` form is used with no month-name text present THEN it still resolves correctly, and an unrelated bare-ISO string (`2026-08-01`, dash-separated) or a guests-step numeral (`8 คน`) never accidentally matches it (BR-1c, regression — no `/` separator present in either).
- EC-4 IF an explicit year is given THEN a Buddhist-era 4-digit value (`> 2400`) is converted (`− 543`) and a Gregorian 4-digit value (`≤ 2400`) is used as-is, both producing the same real-world date when they name the same year (BR-3).
- EC-5 IF no year is given AND the day+month has already passed this year THEN the result rolls to next year, never the past (BR-3).
- EC-6 IF an explicit year resolves to a date strictly before `todayISO` THEN the result is `{ ok:false, reason:'unsupported' }`, identical to the existing `เมื่อวาน` rejection shape (BR-4).
- EC-7 IF the day/month combination is not a real calendar date in the resolved year (e.g. `30 ก.พ.`, or `29 ก.พ.` in a non-leap year with no year given and next year also non-leap) THEN the result is `unsupported`, never a clamped/guessed date (BR-5).
- EC-8 IF the text is any of the 9 EXISTING relative/holiday/weekday/past/vague phrases (`พรุ่งนี้`, `เสาร์อาทิตย์นี้`, `เสาร์หน้า`, `เมื่อวาน`, `ช่วงนี้`, …) THEN the new absolute-date rule never intercepts them — behavior is byte-identical to before this story (BR-7/BR-8).

## Data
- No schema/migration. Code-only change to `resolveDatesCore` (`lib/ai/date-phrases.ts`) — a pure function, no new fields/entities. `lib/ai/tools/resolve-dates.ts` gets a description-string-only update (model-facing tool contract text), no logic change.

## Seams & refs
- Reuse: `addDaysISO`/`formatRangeGloss`/`bangkokTodayISO` (all already in `lib/ai/date-phrases.ts`) — the new rule reuses these, no parallel date-math helper introduced.
- No other reader/writer of "how a Thai date phrase resolves" exists outside `lib/ai/date-phrases.ts` (re-confirmed at this story's grep sweep of `scripts/ai-eval/golden-cases.json` and the guardrail test suites — no case names an absolute-date phrase, so none went stale).
- Refs: CAM-632 (`resolveDatesCore` extraction to `lib/ai/date-phrases.ts`, the function this extends) · CAM-633 (the in-chat booking-flow pinned `KNOWN LIMITATION` this closes, superseded with a dated note, not deleted) · CAM-479 (the single-weekday rule whose alternation-order regression-guard pattern this story's BR-2 mirrors) · ADR-016/ADR-018 (in-chat booking completion, the round this slice ships under).

## Out of scope
- A date RANGE named in one absolute phrase (e.g. "15 ส.ค. ถึง 17 ส.ค.") — not requested by this ticket; the existing single-date-per-phrase contract is unchanged. Follow-up if the eval corpus surfaces a real camper asking this way.
- Any other absolute-date lexical form not named in the ticket (relative-to-absolute month math like "เดือนหน้าวันที่ 15", 2-digit years, English month names) — deliberately out; add only when a real gap is found, per Iron Rule #2.
- Wiring a new golden-corpus case for an absolute-date phrase — the grep sweep of `scripts/ai-eval/golden-cases.json` found NO existing case using an absolute-date phrase (none went stale), so none needed updating; a new case is optional future QA work, not required by this ticket's scope.

## Self-verify
- AC-1..AC-9 → unit tests in `__tests__/cam-645-absolute-thai-dates.test.ts`, pinned `now` (fixed Wednesday 2026-07-22, Asia/Bangkok), no wall-clock dependency. Red-first: `resolveDatesCore('15 ส.ค.', now, [])` verified to return `{ok:false, reason:'unsupported'}` against the PRE-change code (via a temporary `git stash` of the implementation) before the rule was added — documented in the test file's header comment.
- Story-specific: all three lexical forms resolve to the identical date from the same `now` (BR-1) · alternation-order regression guard for the full-name-vs-truncation prefix hazard (BR-2) · Buddhist-era vs Gregorian year producing identical real dates (BR-3/EC-4) · no-year-given never resolves to the past, swept across every month (BR-3/EC-5) · explicit-past-year rejection reuses the EXACT same `{ok:false, reason:'unsupported'}` object shape as the existing `เมื่อวาน` phrase (BR-4/EC-6) · impossible calendar date never fabricated (BR-5/EC-7) · full existing `cam-462-resolve-dates.test.ts`/`cam-479-resolve-dates-weekday.test.ts`/`cam-633-booking-flow.test.ts` suites re-run green, no regression (BR-8/EC-8).
- `__tests__/cam-633-booking-flow.test.ts`'s pinned `KNOWN LIMITATION` (module docstring + describe title + the `"15 ส.ค."` test itself) superseded with a dated note (2026-08-06) — the test itself now asserts the resolved `advance` outcome (`checkIn: '2026-08-15'`) instead of the old `reprompt`/`unsupported` outcome.
- `resolveDates` tool description (`lib/ai/tools/resolve-dates.ts`, both the `jsonSchema.properties.text.description` and the `resolveDatesTool.description` strings) updated to name absolute dates as a supported phrase type — no test pins the old string literally, confirmed by grep before editing.
- Golden/guardrail corpus swept (`scripts/ai-eval/golden-cases.json`, `cam-507-guardrail-gate.test.ts`, `cam-568-guardrail-diagnosability.test.ts`) for any phrase matching the new absolute-date pattern (digit+Thai-month or `D/M`) — none found; nothing needed updating.
- Gate = /quality-gate · Done = lint (0 errors) / typecheck / full suite (12120 passed, 25 pre-existing skips, 0 new failures) / build all green + the `lib/ai/**`-triggered real-model AI Guardrail Gate green on CI (verified on the PR, not locally — the workflow requires a live `OPENROUTER_API_KEY` secret only CI holds) before merge into `dev`.

## Changelog
- v1 (2026-08-06) — created; spec-lite (deterministic single-file capability addition, no schema/API-contract change). CAM-633's absolute-Thai-date gap closed.
