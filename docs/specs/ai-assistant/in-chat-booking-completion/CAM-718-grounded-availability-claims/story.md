# CAM-718 — An availability claim in the answer comes from a real availability check, never prose

version 1 · 2026-08-12 · priority 1 (a live owner-reproduced honesty failure on staging, found right after CAM-716)

## Story

As a **camper** who names a place and a date together, I want the assistant to only claim a stay is available when it actually checked, so that I never see a confident date-with-availability sentence ("มีที่ว่าง...วันที่ 19 สิงหาคม") that no tool behind it ever verified — and instead get an honest offer to check when it didn't.

Why: found by the orchestrator's live staging probe immediately after CAM-716 (2026-08-12). CAM-716 fixed `near` dropping — the camps shown were now correctly Saraburi — but the SAME owner query ("ริมแม่น้ำ แถวๆสระบุรี เสาร์หน้า") could still draw an answer claiming `มีที่ว่างสำหรับการเข้าพักในวันที่ 19 สิงหาคม 2026` — Aug 19 2026 is a Wednesday, not the Saturday asked for — on a turn where NO `checkAvailability`/`bulkAvailability` call ever joined (CAM-716's own test.md: this phrasing family joins `bulkAvailability` only ~3/8 of real attempts). The date resolver (`resolveDates`/`date-phrases.ts`) is deterministic and NOT the bug (CAM-716 confirmed it, this story confirms it again) — the model's PROSE is: on a turn with no availability call, nothing stopped it stating a date-availability fact from nowhere.

Scope: `lib/ai/openrouter-client.ts` (prompt-only: a new grounding clause + a minimal routing-nudge sentence) · `scripts/ai-eval/golden-cases.json` (+1 case) · tests. No tool schema/behaviour change. Depends on: CAM-716 (near/bulk `appliedFilters`/`ranges` echo, already shipped).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The turn's `checkAvailability`/`bulkAvailability` call actually returned a free result for a date | The answer states availability | คำตอบพูดถึงวันว่างได้ ตรงกับวันที่เครื่องมือตรวจสอบแล้วจริง | The stated date/ว่าง claim traces to that call's own args/result (`ranges`/cell/remaining) | EC-1 |
| AC-2 | No `checkAvailability`/`bulkAvailability` call ran this turn | The answer is generated | คำตอบไม่อ้างว่ามีที่ว่างหรือวันที่ยืนยันได้เลย แต่จะชวนให้บอกวันที่เพื่อเช็คให้อีกที (คำพูดเปลี่ยนไปได้ทุกครั้ง ไม่ใช่ประโยคตายตัว) | No fabricated availability/date-free claim; the answer instead offers to check | EC-2 |
| AC-3 | The camper names a stay date/phrase alongside a find/recommend ask (the owner's exact query shape) | The model composes its tool call(s) this turn | ผลลัพธ์ยังคงมาจากทำเลที่ขอจริง (สระบุรี) และถ้ามีการเช็ควันว่าง วันที่ที่พูดถึงต้องตรงกับที่เช็คจริง | The model SHOULD chain the resolved dates into `bulkAvailability` this turn (carrying the same place/terrain filters); when it does not, AC-2's grounding rule still holds | AC-2 |
| AC-4 | The owner's exact query: แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า | The answer arrives, 5 separate real runs | ไม่มีครั้งไหนเลยที่อ้างวันว่างที่ไม่มีเครื่องมือยืนยัน (ไม่มีคลาส "วันพุธ-19" เกิดขึ้นอีก) | Zero-tolerance regression case for this incident, verified behaviourally on the real model | — |

## Rules

- BR-1 A ว่าง/เหลือที่/converted-absolute-date claim anywhere in the answer (not only the CAM-714 opening reason sentence) must be sourced from THIS turn's own `checkAvailability` (its queried start/end dates + a real free result) or `bulkAvailability` (its own `ranges` echo + a free cell) — never from `resolveDates` alone, memory, or a `searchCampsites` call.
- BR-2 When no availability call ran this turn, the answer states NO converted/absolute date at all and no open/free/space claim; it may still restate the camper's own date phrase verbatim (e.g. เสาร์หน้า, never resolved into a computed date) while making ONE natural, varied offer to check — never a fixed string (CAM-714 anti-parrot mechanics: three never-copy examples + a vary-your-wording instruction + the particle-free voice spec).
- BR-3 A find/recommend/list request that also names a stay date SHOULD (not MUST — see BR-4) chain the resolved dates into `bulkAvailability` this turn, carrying the same place/terrain/other filters, rather than stopping at `searchCampsites` alone.
- BR-4 The BR-3 nudge is deliberately a SHOULD: CAM-716's own real-model sampling already showed the model does not reliably obey a stronger MUST for this phrasing family (~3/8), so a second unenforceable MUST would add nothing; BR-1/BR-2 (the grounding discipline) is the actual safety net, not tool-routing reliability.

## Edge cases

- EC-1 IF `checkAvailability`/`bulkAvailability` ran but returned `ok:false` (over_cap/no_match/error) THEN no free-cell/remaining fact exists to state — BR-1 already blocks it (there is nothing in the result to source a positive claim from); the pre-existing zero-result honesty rules (CAM-437/459/501/709/714) still govern the rest of that answer.
- EC-2 IF the camper's own message already contains an absolute date (not a relative phrase) THEN the same BR-1/BR-2 grounding still applies — restating a camper-supplied absolute date is allowed only as an unresolved echo of their own words, never re-presented as a checked/available fact without a real availability call.
- EC-3 IF the model DOES chain into an availability-bearing call this turn (BR-3 succeeds) THEN AC-1's stricter sourcing rule applies, and the claimed date must match that call's own real `ranges`/queried dates — never a different date than what was actually checked.

## Data

None. No schema change, no migration.

## Seams & refs

`lib/ai/openrouter-client.ts:510-536` (the existing `resolveDates`→availability chaining rules, CAM-462/477/505 — the routing nudge extends this family minimally) · `lib/ai/openrouter-client.ts:756-778` (the CAM-714 reason-sentence clause — the new grounding clause sits immediately after it, extending the SAME "sourced from a real tool result this turn" discipline from one sentence to the whole answer) · `lib/ai/tools/bulk-availability.ts` (`ranges`/`cells`/`appliedFilters`, unchanged) · `lib/ai/tools/check-availability.ts` (unchanged) · `lib/ai/date-phrases.ts` (deterministic, confirmed NOT the bug) · CAM-716's `test.md` (the routing-reliability baseline this story's own real-model sampling extends).

## Out of scope

- Making `bulkAvailability`/`checkAvailability` joining deterministic/100%-reliable for every dated find-request phrasing — CAM-716 already established this ceiling is a small-model instruction-following limit, not a structural gap (the `near` schema is fully wired); this story's own real-model sampling (test.md) confirms the SAME ceiling for the plain owner phrasing (~1/15 joined) while showing a DIFFERENT, explicit-trigger phrasing ("...ว่างไหม") is reliable (5/5) — scoped as the new golden case instead of chasing 100% on the ambiguous phrasing.
- CAM-717 (a chained search dropping the terrain filter while the answer still names it) — a sibling, already-flagged, unrelated defect from CAM-716's own Out of scope; not touched here.
- Any UI/client change — this is a prompt-only backend story (`buildSystemPrompt`), no route/schema/component touched.

## Self-verify

- Unit: 18 new pinned prompt-string assertions (`__tests__/cam-718-grounded-availability-claims.test.ts`) covering both new clauses (grounding + routing nudge), the anti-parrot mechanics, and byte-identical regression guards on the CAM-714/CAM-709 honesty spine + MAX_TOKENS.
- Behavioural on the real endpoint (own dev server, port 3032, real OpenRouter call, shared local dev DB — CAM-500 lesson): full log in test.md. Headline: the owner's exact query run 5x (final, official run) — 4/5 no availability call joined + no ว่าง/date claim + honest offer; 1/5 `bulkAvailability` actually joined (the BR-3 nudge worked) and its ว่าง+date claim matched the call's own real dates exactly. **Zero occurrences of an ungrounded date/availability claim across the 5 official runs** (AC-4 met). Two earlier iteration rounds (10 more runs total) are also recorded, showing the clause needed strengthening twice before reaching this result — recorded honestly, not hidden.
- Golden case added: `GEO-9-CAM718-AVAILABILITY-BULK-JOIN` (`guardrail:true`) — the owner's query + an explicit "ว่างไหม" suffix, asserting `bulkAvailability` dispatches with `near="Saraburi"` + `terrain="RIVE"` (subset match). Real-model sampling (5/5 locally) showed THIS phrasing reliably joins, unlike the bare GEO-8 phrasing (which CAM-716 already measured as flaky and deliberately left unpinned for bulk-joining) — the honest, mechanically-feasible case per the ticket's own escape valve. Fixture-count pin (cam-459, cam-457) updated 71→72 with a dated note in both files (CAM-513 value-sweep lesson).
- Real guardrail gate (`npm run ai:guardrail-gate`) run twice locally against the live model — both green (12 guardrail cases incl. the new one).
- Full suite last act · lint · typecheck green.

## Changelog

- v1 (2026-08-12) — created, built, and verified in one pass.
