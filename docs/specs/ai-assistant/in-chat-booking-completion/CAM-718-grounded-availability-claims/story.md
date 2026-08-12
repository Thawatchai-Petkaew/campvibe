# CAM-718 — An availability claim in the answer comes from a real availability check, never prose

version 2 · 2026-08-12 · priority 1 (a live owner-reproduced honesty failure on staging, found right after CAM-716)

## Story

As a **camper** who names a place and a date together, I want the assistant to only claim a stay is available when it actually checked, so that I never see a confident date-with-availability sentence ("มีที่ว่าง...วันที่ 19 สิงหาคม") that no tool behind it ever verified — and instead get an honest offer to check when it didn't.

Why: found by the orchestrator's live staging probe immediately after CAM-716 (2026-08-12). CAM-716 fixed `near` dropping — the camps shown were now correctly Saraburi — but the SAME owner query ("ริมแม่น้ำ แถวๆสระบุรี เสาร์หน้า") could still draw an answer claiming `มีที่ว่างสำหรับการเข้าพักในวันที่ 19 สิงหาคม 2026` — Aug 19 2026 is a Wednesday, not the Saturday asked for — on a turn where NO `checkAvailability`/`bulkAvailability` call ever joined (CAM-716's own test.md: this phrasing family joins `bulkAvailability` only ~3/8 of real attempts). The date resolver (`resolveDates`/`date-phrases.ts`) is deterministic and NOT the bug (CAM-716 confirmed it, this story confirms it again) — the model's PROSE is: on a turn with no availability call, nothing stopped it stating a date-availability fact from nowhere.

Scope: `lib/ai/openrouter-client.ts` (prompt-only: a new grounding clause) · `scripts/ai-eval/golden-cases.json` (+1 case) · tests. No tool schema/behaviour change. Depends on: CAM-716 (near/bulk `appliedFilters`/`ranges` echo, already shipped).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The turn's `checkAvailability`/`bulkAvailability` call actually returned a free result for a date | The answer states availability | คำตอบพูดถึงวันว่างได้ ตรงกับวันที่เครื่องมือตรวจสอบแล้วจริง | The stated date/ว่าง claim traces to that call's own args/result (`ranges`/cell/remaining) | EC-1 |
| AC-2 | No `checkAvailability`/`bulkAvailability` call ran this turn | The answer is generated | คำตอบไม่อ้างว่ามีที่ว่างหรือวันที่ยืนยันได้เลย แต่จะชวนให้บอกวันที่เพื่อเช็คให้อีกที (คำพูดเปลี่ยนไปได้ทุกครั้ง ไม่ใช่ประโยคตายตัว) | No fabricated availability/date-free claim; the answer instead offers to check | EC-2 |
| AC-3 | An availability-bearing call reliably joins for SOME dated-proximity phrasing (proves the property is achievable at all) | The camper adds an explicit availability trigger word ("ว่างไหม") to a dated find/recommend ask | ผลลัพธ์ยังมาจากทำเลที่ขอจริง (สระบุรี) และวันที่ที่พูดถึงตรงกับที่เช็คจริง | `bulkAvailability` joins reliably (5/5 real-model), carrying `near` correctly | AC-2 |
| AC-4 | The owner's exact query: แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า | The answer arrives, 5 separate real runs | ไม่มีครั้งไหนเลยที่อ้างวันว่างที่ไม่มีเครื่องมือยืนยัน (ไม่มีคลาส "วันพุธ-19" เกิดขึ้นอีก) | Zero-tolerance regression case for this incident, verified behaviourally on the real model | — |

## Rules

- BR-1 A ว่าง/เหลือที่/converted-absolute-date claim anywhere in the answer (not only the CAM-714 opening reason sentence) must be sourced from THIS turn's own `checkAvailability` (its queried start/end dates + a real free result) or `bulkAvailability` (its own `ranges` echo + a free cell) — never from `resolveDates` alone, memory, or a `searchCampsites` call.
- BR-2 When no availability call ran this turn, the answer states NO converted/absolute date at all and no open/free/space claim; it may still restate the camper's own date phrase verbatim (e.g. เสาร์หน้า, never resolved into a computed date) while making ONE natural, varied offer to check — never a fixed string (CAM-714 anti-parrot mechanics: three never-copy examples + a vary-your-wording instruction + the particle-free voice spec).
- BR-3 (tried, REVERTED) A routing-nudge sentence — a find/recommend request that also names a stay date SHOULD chain into `bulkAvailability` — was built, tested locally (1/15 dispatch-behaviour change), and reverted after a REAL CI guardrail run showed it destabilizing the pre-existing, already-shipped `GEO-8-CAM716-DATE-NEAR-SARABURI` pin (the nudge's own worked example quoted the incident phrase verbatim, and the model skipped `searchCampsites` entirely, 0/3 attempts on CI). BR-1/BR-2 alone already closes the incident (AC-4, proven 5/5) with zero tool-routing change required — see test.md's "Routing nudge — built, tested, reverted" section for the full record.
- BR-4 The golden case (`GEO-9`) proving AC-3 targets a DIFFERENT, explicit-trigger phrasing ("...ว่างไหม") rather than the bare owner phrasing GEO-8 already covers — that phrasing already satisfies the pre-existing CAM-505 MUST rule (unrelated to the reverted BR-3), and real-model sampling shows it joins reliably (5/5) without any new routing change.

## Edge cases

- EC-1 IF `checkAvailability`/`bulkAvailability` ran but returned `ok:false` (over_cap/no_match/error) THEN no free-cell/remaining fact exists to state — BR-1 already blocks it (there is nothing in the result to source a positive claim from); the pre-existing zero-result honesty rules (CAM-437/459/501/709/714) still govern the rest of that answer.
- EC-2 IF the camper's own message already contains an absolute date (not a relative phrase) THEN the same BR-1/BR-2 grounding still applies — restating a camper-supplied absolute date is allowed only as an unresolved echo of their own words, never re-presented as a checked/available fact without a real availability call.
- EC-3 IF the model DOES chain into an availability-bearing call this turn THEN AC-1's stricter sourcing rule applies, and the claimed date must match that call's own real `ranges`/queried dates — never a different date than what was actually checked.
- EC-4 IF a chained `bulkAvailability` call drops its `terrain` filter (the pre-existing, already-flagged CAM-717 defect, confirmed still live during this story's own guardrail runs) THEN this story's own golden case (`GEO-9`) does NOT assert `terrain` — only `near` — so it tests the join-reliability property this story owns, not CAM-717's separate, deferred defect.

## Data

None. No schema change, no migration.

## Seams & refs

`lib/ai/openrouter-client.ts:510-522` (the existing `resolveDates`→availability chaining rules, CAM-462/477/505 — considered for a minimal extension, reverted, see BR-3) · `lib/ai/openrouter-client.ts:756-778` (the CAM-714 reason-sentence clause — the new grounding clause sits immediately after it, extending the SAME "sourced from a real tool result this turn" discipline from one sentence to the whole answer) · `lib/ai/tools/bulk-availability.ts` (`ranges`/`cells`/`appliedFilters`, unchanged) · `lib/ai/tools/check-availability.ts` (unchanged) · `lib/ai/date-phrases.ts` (deterministic, confirmed NOT the bug) · CAM-716's `test.md` (the routing-reliability baseline this story's own real-model sampling extends and, for BR-3, re-confirms via a live CI regression).

## Out of scope

- Making `bulkAvailability`/`checkAvailability` joining deterministic/100%-reliable for the bare, ambiguous owner phrasing — CAM-716 already established this ceiling is a small-model instruction-following limit, not a structural gap; this story's own real-model sampling (test.md, 15 runs across 3 iteration rounds) confirms the SAME ceiling (~1/15 joined) and additionally found that PUSHING on it (the reverted BR-3 nudge) actively destabilizes an already-shipped pin. Scoped to discipline-only (BR-1/BR-2) per the ticket's own escape valve.
- CAM-717 (a chained search dropping the terrain filter while the answer still names it) — a sibling, already-flagged, unrelated defect from CAM-716's own Out of scope; re-confirmed still live during this story's own guardrail runs (EC-4); not fixed here.
- Any UI/client change — this is a prompt-only backend story (`buildSystemPrompt`), no route/schema/component touched.

## Self-verify

- Unit: 17 pinned prompt-string assertions (`__tests__/cam-718-grounded-availability-claims.test.ts`) covering the grounding clause, its anti-parrot mechanics, a regression guard proving the reverted routing-nudge sentence stays absent, and byte-identical regression guards on the CAM-714/CAM-709 honesty spine + MAX_TOKENS.
- Behavioural on the real endpoint (own dev server, port 3032, real OpenRouter call, shared local dev DB — CAM-500 lesson): full log in test.md. Headline (final, official run, grounding clause only — no routing nudge): the owner's exact query x5 — **5/5 no availability call joined + no ว่าง/date claim + honest, varied offer**; zero occurrences of an ungrounded date/availability claim (AC-4 met). Three earlier iteration rounds (20 more runs total, including the reverted-nudge experiment) are also recorded, showing the clause needed strengthening twice and the routing nudge was tried and cut — recorded honestly, not hidden.
- Golden case added: `GEO-9-CAM718-AVAILABILITY-BULK-JOIN` (`guardrail:true`) — the owner's query + an explicit "ว่างไหม" suffix, asserting `bulkAvailability` dispatches with `near="Saraburi"` (subset match — deliberately NOT `terrain`, see EC-4). Real-model sampling (5/5 locally) showed THIS phrasing reliably joins, unlike the bare GEO-8 phrasing (which CAM-716 already measured as flaky and deliberately left unpinned for bulk-joining) — the honest, mechanically-feasible case per the ticket's own escape valve. Fixture-count pin (cam-459, cam-457) updated 71→72 with a dated note in both files (CAM-513 value-sweep lesson).
- Real guardrail gate (`npm run ai:guardrail-gate`) run against the live model: 1 red (the routing-nudge regression on GEO-8, root-caused and reverted same session), then 3 consecutive green runs locally after the fix (12 guardrail cases incl. the new one).
- Full suite last act · lint · typecheck green.

## Changelog

- v1 (2026-08-12) — created, built with a grounding clause + a routing nudge.
- v2 (2026-08-12) — the routing nudge (BR-3) shipped, hit CI, and broke the pre-existing GEO-8 guardrail case (a real regression, not a flake — reproduced its root cause: the nudge's own worked example quoted GEO-8's exact utterance). Reverted the nudge; narrowed the new golden case (GEO-9) to drop a `terrain` assertion after discovering it collides with the pre-existing, unrelated CAM-717 defect. Re-verified everything behaviourally after both fixes (5/5 zero-tolerance, 3x green real guardrail gate).
