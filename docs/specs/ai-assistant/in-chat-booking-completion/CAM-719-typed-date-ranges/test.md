# CAM-719 — test.md

## Source-level (unit) tests

`__tests__/cam-719-date-range.test.ts` — 17 cases, all green. The deterministic
matrix over `resolveDatesCore`'s new range rule (`lib/ai/date-phrases.ts`):

- The owner's EXACT sentence and both anti-silent-misread forms named in the
  ticket ("19-21 ส.ค.", "19 ส.ค. - 21 ส.ค.") all resolve to `{startDate:
  '2026-08-19', endDate: '2026-08-21'}` (2 nights) — never 1 night, never
  collapsed to the start.
- AC-3 form variants: `ถึง` separator, informal month alias, `วันที่` prefix,
  fully monthless.
- EC-1 (monthless roll to next month when the start day already passed),
  EC-2 (explicit-month range crossing a month boundary), EC-3 (a trailing
  unrelated number, e.g. party size, is never swallowed into the range).
- BR-2 year handling: an explicit trailing Buddhist-era year normalizes to
  the identical Gregorian span; an explicit Gregorian year on both sides
  resolves identically.
- BR-3: a genuinely inverted range ("21-19") is rejected `unsupported`,
  never silently swapped; an impossible calendar date inside a range is
  never fabricated.
- null/empty: a lone number with no second day never matches.
- Regression (the risk surface MY change actually touches): a single
  absolute date ("15 ส.ค.") is never intercepted by the new rule; the
  cam-645 ISO-date collision pin ("2026-08-01") is re-verified directly
  against the new regex's boundary guard; "15/8" (rule 9's own numeric form)
  is unaffected.

`__tests__/cam-719-accept-ceiling.test.ts` — 5 cases, all green. Closes the
typed-range `MAX_BOOKING_NIGHTS` bypass in `acceptDateCandidate`
(`components/ai-chat/booking-flow.ts`) and drives AC-1 end-to-end:

- AC-1: the owner's exact sentence typed at the `date` step, through the REAL
  `advanceBookingFlow`, advances directly to `guests` (never re-asks
  `nights` — pre-filled to 2 from the resolved span).
- The REAL `buildSummaryView` (unmocked), fed the slots that same real flow
  produced, renders `datesValue` = **`"พุธ 19 ส.ค. พัก 2 คืน"`** — asserted
  both as an exact string and via `.toContain('พัก 2 คืน')`.
- AC-4/BR-5: a >30-night typed range ("1 ต.ค. - 1 พ.ย.", 31 nights) is
  rejected through the EXACT SAME shape `acceptNightsCandidate` already
  returns (`reasonKey:'too_long', data:{max:30}`) — no new rejection kind.
- EC-4: a range of exactly 30 nights passes (ceiling inclusive).
- EC-5: see "EC-5 decision" below.

## EC-5 decision (disclosed, per the ticket's own instruction)

A 1-night typed range ("19-20") sets `checkIn`/`checkOut` but does **not**
pre-fill `nights` — the `nights` step still asks, same as any other 1-night
resolution. This is the DEFAULT (preserve the cam-699 pin), chosen over the
alternative (pre-fill `nights:1`, arguably more truthful for an explicit
1-night range) because `acceptDateCandidate` decides purely from the
resolved `{checkIn, checkOut}` SPAN, not from which rule produced it — a
1-night range and a typed single date ("15 ส.ค.") produce byte-identical
1-night candidates by the time `accept` runs, so special-casing "this 1-night
span came from a range" would require threading provenance through a
boundary that today deliberately carries none (the exact reason the cam-699
pin exists). No code change was needed for this: the pre-existing `span > 1`
check in `acceptDateCandidate` already produces this behavior unmodified;
`cam-719-accept-ceiling.test.ts`'s EC-5 case proves it holds for a range
input specifically. Not superseded.

## Copy (BR-6)

`locales/translations.json` — `aiChat.booking.date.typeHint` and
`date.unreadable` (TH + EN) gain a range example ("19-21 ส.ค." / "19-21
Aug") so the copy advertises what the parser can now read. Two pre-existing
pins superseded (dated note, not silently weakened):

- `__tests__/cam-638-booking-copy.test.ts` — TH `typeHint`/`unreadable`.
- `__tests__/cam-638-ai-chat-booking-step.test.ts` — the EN `typeHint`
  rendered-DOM pin (found only by running the full pin sweep, not named in
  the dispatch's Seams & refs list — the same CAM-513 "value-sweep" lesson:
  a copy change can strand a pin nobody explicitly named).

## Tool description (BR-7)

`lib/ai/tools/resolve-dates.ts` — both the `jsonSchema.text.description` and
`resolveDatesTool.description` now mention an explicit date RANGE
("19-21 ส.ค.") alongside relative/holiday/absolute, with the exclusive-
checkout semantics spelled out for the model. No test pins this literal
string (checked — `cam-462-prompt-date-tool.test.ts` does not assert exact
description text).

## Golden case (BR-7, additive, non-guardrail)

The golden corpus (`scripts/ai-eval/golden-cases.json`) had **zero** range-
shaped date cases before this story (swept — confirmed via `grep` across
every `utterance` field). Added `CAM719-DATE-RANGE`
(`"มีลานว่างช่วง 19-21 ส.ค. ไหม"` → expects `resolveDates` dispatched,
`guardrail:false`). Fixture-count pin swept and bumped 73 → 74 in **both**
files carrying it (`__tests__/cam-457-eval-harness.test.ts`,
`__tests__/cam-459-answer-policy-3-zones.test.ts`) — the CAM-513 lesson: a
stale count in one file silently masks the other.

This case does **not** run inside the blocking `ai:guardrail-gate` CI job:
`scripts/ai-eval/guardrail-gate.eval.ts` filters to `guardrail === true`
cases only (`filterGuardrailCases`), and this new case is `guardrail:false`
by design — it rides the full advisory eval run (`npm run ai:eval`) and
reports its own pass rate there, but adds **zero** incremental risk to the
blocking gate. The blocking gate re-runs the exact same 6 pre-existing
guardrail cases (GEO-8/9 + 4 others), none of which this story touches.

## Live dev-server / real-model verification — BLOCKED, disclosed honestly

The dispatch asked for the owner's exact sentence to be "driven through the
real flow on your own dev server (port 3034)" with a summary screenshot.
This worktree ships with **no `.env`** — confirmed by directory listing:
only `.env.example`/`.env.e2e.example`/`env.example` exist on disk, no real
`DATABASE_URL`/`OPENROUTER_API_KEY`/`AUTH_SECRET`. `Read` on `.env.example`
itself is sandbox-denied. There is a local Postgres `campvibe` DB reachable
(confirmed via `pg_isready`/`psql -l`), so a bare page could plausibly load,
but the AI chat's `getCampDetail`/booking-start entry point structurally
requires a real model turn first (`AiChatDetailCard`'s "เริ่มจอง" button only
renders after the model shows a camp detail card — there is no non-chat
deep-link into `startBookingFlow`) — with no `OPENROUTER_API_KEY` reachable
in this isolated worktree, that first hop cannot be driven at all. I did not
fabricate a screenshot.

**What I verified instead (the strongest reachable substitute):** the exact
`git stash`-verified RED/GREEN behavioural proof above (real pre-change vs
post-change `resolveDatesCore` output), plus
`cam-719-accept-ceiling.test.ts`'s AC-1 end-to-end case, which drives the
REAL, UNMOCKED `advanceBookingFlow` → `buildSummaryView` chain — the exact
same functions the browser calls — from the owner's raw Thai sentence
straight through to the literal rendered Thai summary sentence
(`"พุธ 19 ส.ค. พัก 2 คืน"`). Nothing in this chain is mocked; only the
actual browser/DOM paint step and the live model turn needed to reach the
booking-start button are unreachable from here.

**Flag for the orchestrator/owner:** the live browser click-through (open
chat → ask about a real camp → tap "เริ่มจอง" → type the owner's sentence →
confirm the rendered summary) needs a worktree/session with real
`OPENROUTER_API_KEY`/`DATABASE_URL` and should be done as an owner-verify
step before or at G4, per the qa.md precedent for browser-only ACs
("Mark them owner-verify ACs... never claim a browser-only AC Done from curl
alone").

## Full suite (last act)

- `npm run lint` — 0 errors (pre-existing unrelated warnings only, including
  the pre-existing `_ctx` unused-param convention in `resolve-dates.ts`,
  present before this story).
- `npx tsc --noEmit` (`npm run typecheck`) — clean.
- `npm test` — **12501 passed, 25 skipped, 0 failed** across 493 test files
  (5 skipped files, pre-existing). All named "must stay green" pins
  re-verified individually first (19 files, 457 tests): cam-645, cam-479,
  cam-462 (×3), cam-633, cam-699 (×2), cam-640 (×3), cam-700 (×3), cam-702,
  cam-638 (×2), cam-457, cam-459.
- `npm run build` — succeeds.
- `npm audit --omit=dev` — 0 vulnerabilities.
- `ai:guardrail-gate` — not run locally (no `OPENROUTER_API_KEY` in this
  worktree); will run for real on CI (repo secret). Risk assessed as
  unchanged: the gate only replays `guardrail===true` cases, none of which
  this story touches, and the fixture parses with 0 load errors locally.

## Cleanup

Scratch verification artifacts (`.scratch-cam719-red.test.ts`, a temporary
`git stash` of only `lib/ai/date-phrases.ts` used to capture the pre-change
RED output, popped immediately after) were removed/restored before this
commit — none ride the PR.
