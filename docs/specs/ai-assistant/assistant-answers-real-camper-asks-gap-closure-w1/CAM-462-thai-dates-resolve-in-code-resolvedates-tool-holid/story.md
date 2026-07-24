---
artifact: story
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
story: thai-dates-resolve-in-code (CAM-462)
status: In Progress (G1 — Discovery complete, proposing Scope)
version: v1
updated: 2026-07-24
---

<!--
System/tool-facing story (like CAM-457): `resolveDates` is a DETERMINISTIC tool — no LLM, no network, no DB writes — so its output is a data structure (an ISO date-set), never user-visible copy. The AC "Then" column therefore describes the deterministic TOOL RESULT in plain language; verbatim Thai appears only in the Given-column INPUT utterances (what the camper types). The one genuinely user-facing behaviour (on an unresolvable phrase น้องกองไฟ ASKS rather than guesses) is model-generated prose owned by the prompt/eval layer — asserted as behaviour (BR-5/BR-6), not as pinned Thai copy, because the exact wording is non-deterministic.
Framework English; EARS applies. Empty/loading/forbidden states: a pure function has no "loading"; "empty" = no-match (EC-3/EC-6); "forbidden" = N/A (read-only, guest-tier, no identity — same as checkAvailability).
-->

## Story
As a **Camper**, I want น้องกองไฟ to turn my everyday Thai date phrases (`พรุ่งนี้`, `เสาร์อาทิตย์นี้`, `วันหยุดยาวหน้า`) into the exact dates it checks, so that I get availability for the days I actually meant without spelling out a calendar date — and if my phrase is genuinely unclear the assistant asks me instead of guessing a wrong date (protects the camper from being shown availability for the wrong dates; epic KPI = 40-case golden pass-rate, P3 temporal group, baseline: not measured).
Why: today date resolution is PROMPT-based — the model computes ISO dates itself from an injected "today" line (CAM-408, `openrouter-client.ts` line ~308). LLM date arithmetic is error-prone (off-by-one, wrong weekday, month/year boundaries) and cannot express a DATE-SET ("weekends of this month" = several ranges). This story MOVES that math out of the prompt into a deterministic tool so the dates are correct by construction, not by luck.
Scope: a NEW deterministic `resolveDates` tool + a `ThaiHoliday` reference table (seeded current + next year) + the one prompt line that switches the model from "compute dates yourself" to "call resolveDates and use its ranges; on no result, ask the camper". The tool's date-set OUTPUT is produced and returned; wiring a MULTI-range set into a batch availability check is CAM-465 (a single range already feeds today's checkAvailability). No new UI.
Depends on: research §5 phase-1 item 1-3 · CAM-408 (the prompt-based resolution being replaced) · ADR-013 (bounded loop + tool tiers) · CAM-457 (eval harness — the P3 group this is measured by)

## AC
<!-- "Then" = the deterministic tool RESULT in plain language (resolveDates has no user-facing copy of its own); Thai lives in the Given utterances. System effect = what the tool computes/reads. Neg/edge names the failure twin. Date semantics: endDate = EXCLUSIVE checkout day, identical to Booking.checkOutDate / check-availability.ts — never reinterpret as inclusive. -->
| # | Given | When | Then (tool result, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Today is a known date (Asia/Bangkok); camper says `พรุ่งนี้` | The model calls resolveDates with that phrase | Returns a date-set of ONE range: check-in = today+1, checkout(exclusive) = today+2 (one night) | Deterministic result; no DB write; the model then calls checkAvailability with that range | EC-1 |
| AC-2 | Today is a Wednesday (Asia/Bangkok); camper says `เสาร์อาทิตย์นี้` | resolveDates runs | Returns ONE range for this coming weekend: check-in = this Saturday, checkout(exclusive) = the following Monday (Sat + Sun nights) | Deterministic weekday math in Asia/Bangkok; feeds checkAvailability | EC-2 |
| AC-3 | ThaiHoliday is seeded; camper says `วันหยุดยาวหน้า` | resolveDates runs | Returns ONE range = the NEXT long-weekend span after today (from ThaiHoliday rows flagged as a long weekend) | Reads ThaiHoliday (read-only); deterministic | EC-3 |
| AC-4 | Camper says a date-SET phrase `เสาร์อาทิตย์ทุกสัปดาห์ของเดือนนี้` | resolveDates runs | Returns a date-SET of MULTIPLE ranges (one per weekend remaining in this month), capped at a MAX | Deterministic; the multi-range set is handed to bulk availability (CAM-465) — checkAvailability alone takes one range | EC-4 |
| AC-5 | Camper says a vague/unparseable time phrase `ช่วงนี้` | resolveDates runs | Returns an explicit "could not resolve" status — NO date is fabricated | No guessed range; the model asks the camper to specify the dates rather than assuming any date | EC-5 |
| AC-6 | The server clock is in any timezone (e.g. a late-night UTC moment that is already the next day in Bangkok) | resolveDates computes "today" and weekdays | Every returned date is the camper's Asia/Bangkok date, never the server-local date | Deterministic; timezone pinned to Asia/Bangkok | EC-6 |

## Rules
- BR-1 `resolveDates` is a PURE deterministic function — no LLM, no network, no DB write; given `(text, today, tz)` it always returns the same result. Contract: input `{ text: string, today?: ISOdate, tz?: IANA }`; output a discriminated result `{ ok: true, dates: Range[] } | { ok: false, reason: 'ambiguous' | 'unsupported' | 'no_match' | 'too_many' }`. `Range = { startDate: ISOdate (inclusive check-in), endDate: ISOdate (EXCLUSIVE checkout) }`. Registered as a `guest`-tier read-only tool (same tier as checkAvailability — no identity needed).
- BR-2 Date-SET semantics — the result is a SET of 1..N ranges: a single day or one weekend = 1 range; "weekends of this month" = N ranges; a long weekend = 1 contiguous range. An EMPTY set is never a success — a phrase that matches nothing returns `{ ok: false, reason: 'no_match' }`, not `{ ok: true, dates: [] }`.
- BR-3 Checkout-day convention — `endDate` is the EXCLUSIVE checkout day, byte-identical to `Booking.checkOutDate` / `check-availability.ts` semantics (do NOT reinterpret as inclusive), so `เสาร์อาทิตย์` (Sat + Sun nights) = check-in Sat, checkout Mon. No off-by-one.
- BR-4 ThaiHoliday source + long-weekend rule — seeded with the OFFICIAL Thai public holidays (cabinet-announced, as published by the Bank of Thailand) for the current + next calendar year, including substitution/in-lieu days (~20–40 rows). `isLongWeekend = true` for a holiday that forms a contiguous ≥3-day non-working span with its adjacent weekend/holiday days. 🟡 default — the exact source authority + whether `isLongWeekend` is STORED (seeded) or COMPUTED from adjacency is an architect/analyst G2 decision (see Seams).
- BR-5 No silent guess — an ambiguous, unsupported, or unmatched phrase returns `{ ok: false, reason }`; the tool NEVER fabricates a date. The camper-protecting guarantee: a wrong date must never be checked because the model guessed one.
- BR-6 Prompt change — the current instruction "compute the absolute ISO date(s) from today's date above before calling checkAvailability" (CAM-408) is REPLACED by: "for any relative or holiday Thai date phrase, call resolveDates and use the ranges it returns; if resolveDates returns no result, ask the camper to specify the dates — never assume one." The model no longer does date arithmetic itself.
- BR-7 Timezone — "today" and every weekday are computed in Asia/Bangkok via the EXISTING `Intl.DateTimeFormat({ timeZone: 'Asia/Bangkok' })` idiom (`formatTodayContextLine`), never server-local; `tz` defaults to and is effectively pinned at Asia/Bangkok for this story.
- BR-8 Bounded expansion — the number of ranges a date-SET phrase may produce is capped at a MAX checked BEFORE the set is built (CAM-344 lesson: any client/phrase-controlled iteration count is bounded before it runs); over the cap returns `{ ok: false, reason: 'too_many' }`. 🟡 MAX value → architect G2.

## Edge cases
- EC-1 IF a phrase resolves to a date already in the past in Asia/Bangkok (e.g. `เมื่อวาน`) THEN return `{ ok: false, reason: 'unsupported' }` (a past stay is meaningless); the model asks for a future date (BR-5).
- EC-2 IF a weekend/relative phrase straddles a month or year boundary (e.g. `เสาร์อาทิตย์หน้า` on the last day of the month) THEN compute the correct next-month/next-year dates in Asia/Bangkok, not a clamped same-month date (BR-7).
- EC-3 IF no long weekend exists in the seeded ThaiHoliday window after today THEN return `{ ok: false, reason: 'no_match' }` — never fabricate one; the model tells the camper it doesn't have that and asks for dates (BR-2/BR-4/BR-5).
- EC-4 IF a date-SET phrase would expand past the MAX range count (e.g. `ทุกวันเสาร์ของปีนี้`) THEN the cap is enforced BEFORE building the list and the tool returns `{ ok: false, reason: 'too_many' }` — the tool never allocates an unbounded set (BR-8/CAM-344).
- EC-5 IF the `today` argument is missing or an invalid date THEN the tool falls back to the real Asia/Bangkok current date and still resolves — it never throws (BR-7).
- EC-6 IF ThaiHoliday is empty/unseeded (fresh DB) THEN holiday phrases return `{ ok: false, reason: 'no_match' }` gracefully; relative-day phrases (`พรุ่งนี้`, `เสาร์นี้`) still resolve because they never read the table (BR-4).

## Data
- New model `ThaiHoliday` (reference/seed table): `date` (Geo/Public, `DateTime @db.Date`, primary key) · `nameTh` (Public, string) · `isLongWeekend` (Public, boolean, default false). ~20–40 seeded rows for the current + next calendar year. migration: reversible (additive table + seed; down = drop table, no data loss elsewhere).
- `resolveDates` is CODE only (a `lib/` resolver + a tool registration) — it has no schema of its own; it READS ThaiHoliday and writes nothing.
- No change to existing models. checkAvailability / search-campsites date inputs are UNCHANGED (single-range consumers).

## Seams & refs
- Reader/writer sweep (architecture.md 15b — how dates get resolved changes): the ONE writer of "how a Thai date phrase becomes ISO dates" today is the PROMPT instruction in `buildSystemPrompt` (`lib/ai/openrouter-client.ts`, the CAM-408 line ~308) — it moves NOW from prompt-arithmetic to a resolveDates tool call (BR-6). Date CONSUMERS `checkAvailability` (`lib/ai/tools/check-availability.ts`) and `searchCampsites` (`lib/ai/tools/search-campsites.ts`) are NO-CHANGE here — they still take a single `startDate`/`endDate`; a MULTI-range set that exceeds their one-range input is LATER (CAM-465, bulkAvailability). Grep terms for the sweep: `formatTodayContextLine`, `startDate`, `endDate`, `checkAvailability`, `compute the absolute ISO`. No other reader/writer of date-resolution exists in `lib/`, `app/`, `components/`, `scripts/`.
- Reuse (no parallel logic): `formatTodayContextLine` (openrouter-client.ts) — the Asia/Bangkok `Intl` idiom for "today"/weekday, injectable-`now` testable pattern (do NOT re-implement tz math) · the `ToolDefinition` / `registerTool` pattern + the `dispatchTool` discriminated-result shape (`lib/ai/tool-registry.ts`) · check-availability.ts's `isoDate` zod refine + its EXCLUSIVE-checkout semantics.
- Refs: research §5 item 1-3 + §2 (P3 fuzzy temporal, P12 aggregate), ADR-013 (bounded loop, tool tier), CAM-408 (prompt-based resolution replaced), CAM-344 (pre-loop MAX cap), CAM-465 (bulkAvailability consumes the multi-range set). ARCHITECT G2 DECISIONS (not decided here): (1) resolveDates as a TOOL the model calls vs a server-side pre-parse — research recommends a deterministic tool; (2) ThaiHoliday authority + `isLongWeekend` stored-vs-computed (BR-4); (3) the MAX range cap value (BR-8); (4) whether the multi-range set feeds checkAvailability via N calls or waits for CAM-465's bulk path.

## Out of scope
- Feeding a MULTI-range date-set into a single batch availability check → CAM-465 (bulkAvailability). A single range already feeds today's checkAvailability.
- Adding the P3 temporal GOLDEN CASES to the eval fixture + lifting the current `cases.length <= 8` ceiling in `__tests__/cam-457-eval-harness.test.ts` → blocked on the owner corpus import (not yet in repo); a follow-up once the 40-case corpus lands. This story ships the CAPABILITY the P3 cases will measure, not the cases themselves.
- Region rollup / derived facet scores (other phase-1 items) → CAM-463 / CAM-464.
- Non-date natural-language parsing (party size, guests) → later stories.

## Self-verify
- AC-1..AC-6 → unit tests of `resolveDates` with an INJECTED `today` (deterministic, no wall-clock, mirroring `formatTodayContextLine`'s testability) over a fixed ThaiHoliday fixture; the prompt change (BR-6) verified by a prompt-content unit test + the advisory eval harness.
- Story-specific: EXCLUSIVE-checkout off-by-one asserted (BR-3, `เสาร์อาทิตย์` = Sat→Mon) · Asia/Bangkok boundary (a late-night UTC `now` that is next-day in Bangkok, AC-6/EC-2) · unresolvable NEVER fabricates a date (BR-5/AC-5) · pre-expansion MAX cap enforced before the set is built (EC-4/CAM-344) · empty/unseeded ThaiHoliday graceful, relative-day phrases still resolve (EC-6) · ThaiHoliday migration up→down→up on the dev DB.
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB with ThaiHoliday seeded) before merge; the P3 eval number is owner-verify once the corpus is imported.

## Changelog
- v1 (2026-07-24) — created; Discovery run (6-dimension), Business + Functional gaps closed. No 🔴 blockers: holiday authority/`isLongWeekend` derivation, tool-vs-pre-parse, and the MAX cap are 🟡 with defaults, routed to architect G2. Proposing G1.
