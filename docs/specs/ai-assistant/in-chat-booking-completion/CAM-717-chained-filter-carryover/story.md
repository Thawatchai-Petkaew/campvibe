# CAM-717 — A chained date search can drop the terrain filter while the answer still names it

version 1 · 2026-08-12 · priority 1 (the last open defect of the chat honesty arc, flagged by both CAM-716 and CAM-718)

## Story

As a **camper** who names a terrain/taxonomy characteristic together with a place and a date, I want the availability check to run over the SAME filtered camp set my search found, so that the camps and count I see never quietly widen to include camps that don't actually match what I asked for (e.g. a forest camp showing up under a "ริมแม่น้ำ" ask).

Why: found during CAM-716's own behavioural verify (test.md "(2) Zero-result variant") and independently re-confirmed live during CAM-718's own guardrail sampling (EC-4): when a turn dispatches `searchCampsites` (with a taxonomy filter the model itself chose, e.g. `terrain:"RIVE"`) and then `bulkAvailability` for the SAME request, the taxonomy filter sometimes does not survive onto the second call — while the answer's opening reason sentence still names the criterion. `near`/`province`/`region` are already carried onto BOTH tools by the mandatory, server-detected place-hint block (CAM-501/CAM-716); this gap is specifically the filters the MODEL infers itself (terrain and the rest of the taxonomy vocabulary), which no server-side hint can pin because nothing outside the model's own prior tool call recorded them.

Scope: `lib/ai/openrouter-client.ts` (prompt-only: a carry-over pin + an answer-side backstop) · `lib/ai/tools/bulk-availability.ts` (tool `description` field only — no schema/behaviour change) · `scripts/ai-eval/golden-cases.json` (+1 case) · tests. No tool schema/argument/execute change. Depends on: CAM-716 (bulkAvailability's `near`/`appliedFilters`, already shipped), CAM-718 (the reason-sentence/grounding clauses this story's answer-side backstop sits beside).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper names a taxonomy characteristic (e.g. ริมแม่น้ำ) together with a place and a date this turn | The model dispatches `searchCampsites` and then `bulkAvailability` for the same request | ลานที่แสดงล้วนตรงกับลักษณะที่ขอ (เช่น ริมแม่น้ำ) ไม่มีลานประเภทอื่นแอบปนมา | The taxonomy filter set on `searchCampsites` is repeated identically on the `bulkAvailability` call | EC-1 |
| AC-2 | A same-turn `searchCampsites` + `bulkAvailability` pair ran, and the taxonomy filter still failed to carry onto the second call | The answer is generated | คำตอบไม่กล่าวถึงลักษณะ (เช่น ริมแม่น้ำ) ที่ไม่ได้ถูกใช้จริงในการเช็ควันว่างครั้งนี้ | The reason sentence names only criteria present in EVERY call's `appliedFilters`, never one only the first call carried | EC-2 |
| AC-3 | A chained ask reliably reproduces the historical drop (terrain + date + place, the CAM-716/718 repro shape) | The turn is run repeatedly on the real model | ผลลัพธ์คงลักษณะที่ขอไว้ตรงกันทุกครั้งที่มีการเช็ควันว่างต่อจากการค้นหา | The carry-over property holds across repeated real runs (behavioural verify, not diff-read alone — qa.md) | — |
| AC-4 | CAM-718's own no-fabricated-date / CAM-714's opener properties | The same regression queries are re-run after this fix | คุณสมบัติเดิมของ CAM-714/CAM-718 ยังคงเป็นจริงทุกประการ ไม่มีการถดถอย | Zero regression on the two prior stories' behavioural properties | — |

## Rules

- BR-1 A carry-over pin in `buildSystemPrompt()`'s chaining guidance: when a turn dispatches BOTH `searchCampsites` and `bulkAvailability` for the SAME request, every filter argument set on the FIRST of the two calls (`near`/`province`/`region`/`terrain`/`access`/`activities`/`facilities`/`annotatedFeatures`/`camperStyle`/`type`/`priceMin`/`priceMax`/`petFriendly`/`keyword`) MUST be repeated identically on the SECOND — phrased mechanically, naming the concrete mechanism ("copy your own previous call's arguments") per the same established idiom the CAM-501/CAM-716 place-hint pins already use, since a small model needs a mechanical instruction more than an abstract one (measured, see test.md).
- BR-2 An answer-side backstop, placed right after the CAM-714 reason-sentence clause: a criterion may be named anywhere in the answer, including the opening sentence, ONLY when it appears in the `appliedFilters` echo of EVERY call the answer draws from — never a criterion only ONE of a same-turn search+bulk pair actually carried. This is the smaller, mechanically checkable promise the ticket's own escape valve calls for, added after real-model sampling showed BR-1 alone is not 100% reliable (see test.md) — it closes the harm (a mislabeled result) even on a turn where BR-1 itself fails.
- BR-3 A carry-over note on `bulkAvailabilityTool.description` itself (the tool's own jsonSchema-adjacent description string, not its parameters/schema): placed as the tool's SECOND sentence, at the exact point the model composes THIS call's own arguments — measurably more effective than the system-prompt pin alone (test.md: 0/2 vs 5/5 on the same repro query, before/after this layer was added).
- BR-4 The golden case (`GEO-10`) targets the SAME reliable `bulkAvailability`-joining trigger family GEO-9 already established (an explicit "ว่างไหม" suffix), asserting BOTH `near` AND `terrain` on the dispatched call — the exact assertion GEO-9 deliberately avoided while this defect was still live.
- BR-5 (decided, recorded honestly) `GEO-10` ships as `guardrail:false`, NOT `guardrail:true`. Real-model sampling (6/6 informal runs) showed the terrain-carryover property itself holds once BR-1/2/3 land, but the REAL `ai:guardrail-gate` (3-attempt retry budget) failed 3/3 on one run where the model chose `searchCampsites`+`checkAvailability` instead of `bulkAvailability` — a ROUTING choice, not a carry-over failure (no attempt that dispatched `bulkAvailability` ever showed a dropped `terrain`). That routing-reliability ceiling is CAM-718's own territory (their routing nudge, tried and reverted for the identical reason: destabilizing an already-shipped guardrail pin) and is explicitly out of this story's scope.

## Edge cases

- EC-1 IF the model drops a taxonomy filter on the second call despite BR-1/BR-3 THEN BR-2 (the answer-side backstop) still prevents the answer from naming that criterion, so the camper is never told a filter applied that didn't.
- EC-2 IF a same-turn search+bulk pair's `appliedFilters` genuinely disagree on a criterion (one carries it, the other doesn't) THEN the reason sentence names only the criteria BOTH calls share — it never repairs the gap by assuming the missing call "must have" applied it too (BR-2).
- EC-3 IF only ONE of `searchCampsites`/`bulkAvailability` runs this turn (no chained pair) THEN BR-1/BR-2 do not apply at all — this is the pre-existing CAM-714/709 single-call sourcing rule, unchanged.
- EC-4 IF the model cannot be made to reliably CHOOSE `bulkAvailability` over `checkAvailability`/search-only for a given phrasing THEN that is a routing-reliability question (CAM-718's territory, already tried and reverted once) — out of this story's scope; the golden case added here is scoped to the carry-over property GIVEN bulk joins (BR-5), never to forcing the join itself.

## Data

None. No schema change, no migration.

## Seams & refs

`lib/ai/openrouter-client.ts:550-561` (the CAM-505 checkAvailability-vs-bulkAvailability routing rule — the carry-over pin, BR-1, lands immediately after it) · `lib/ai/openrouter-client.ts:778` (the CAM-714 reason-sentence clause — the answer-side backstop, BR-2, lands immediately after it and before the CAM-718 grounding clause) · `lib/ai/tools/bulk-availability.ts:552-559` (`bulkAvailabilityTool.description` — BR-3's carry-over note) · `lib/ai/tools/taxonomy-tags.ts` (`buildTaxonomyEcho`, shared, unchanged — the mechanism that makes the drop DETECTABLE via `appliedFilters` on both tools, CAM-709/716) · CAM-716's `test.md` "(2) Zero-result variant" (where this was first caught) · CAM-718's `story.md` EC-4 / `test.md` "Why NOT terrain in the expected params" (where GEO-9 was deliberately narrowed around this exact defect).

## Out of scope

- Making `bulkAvailability` joining itself (vs `checkAvailability`/search-only) deterministic — CAM-718 already tried a routing nudge for this and reverted it after it regressed a shipped guardrail pin; this story does not re-attempt it (BR-5/EC-4).
- Any UI/client change — this is a prompt-string + tool-description backend story, no route/schema/component touched.
- The pre-existing anti-enumeration (CAM-405) and mood-word-mirroring (CAM-714) small-model non-compliance observed incidentally during this story's behavioural verify — recorded honestly in test.md, unrelated to this story's diff, not fixed here.

## Self-verify

- Unit: `__tests__/cam-717-chained-filter-carryover.test.ts` (17 cases) — the carry-over pin (BR-1), the answer-side backstop (BR-2), the tool-description note (BR-3), and byte-identical regression guards on the CAM-505/CAM-714/CAM-716/CAM-718 chaining/grounding strings + MAX_TOKENS.
- Behavioural on the real endpoint (own dev server, port 3033, real OpenRouter call, shared local dev DB — CAM-500 lesson): full log in test.md. Headline — the CAM-716 Yala/FILD zero-result repro: 6/6 terrain-carryover PASS across the story's iteration; the CAM-716 Saraburi/RIVE bare-phrase repro: 0/2 PASS with BR-1/BR-2 only → 5/5 PASS after BR-3 (the tool-description layer) shipped — a real, measured before/after, not assumed.
- Golden case added: `GEO-10-CAM717-TERRAIN-CARRYOVER` (`guardrail:false`, BR-4/BR-5) — asserts `bulkAvailability` dispatches with `near`+`terrain` together. Tried as `guardrail:true` first; demoted after the real `ai:guardrail-gate` failed 3/3 on a routing (not carry-over) miss — recorded honestly per the ticket's own escape valve. Fixture-count pin (cam-459, cam-457) updated 72→73 with a dated note in both files (CAM-513 value-sweep lesson).
- Real guardrail gate (`npm run ai:guardrail-gate`) run against the live model 3 times total across the iteration (1 red on the GEO-10-as-guardrail attempt, root-caused as a routing miss and demoted; 2 consecutive green runs after the demotion, both including the CAM-716/718 pins GEO-8/GEO-9).
- Full suite last act · lint (0 errors) · typecheck (clean) · `npm test` 12481/12504 (1 unrelated, pre-existing shared-dev-DB-state failure — `cam-650-pricing-unit-schema.test.ts`, confirmed zero diff on any pricing/CampSite/schema file, same class CAM-718's own test.md documented) · `npm run build` clean · `npm audit --omit=dev` 0 vulnerabilities.

## Changelog

- v1 (2026-08-12) — created, built, and verified: three-layer fix (system-prompt carry-over pin + answer-side backstop + bulkAvailability tool-description note); golden case added and demoted to non-guardrail after a real CI-identical routing-miss, recorded honestly.
