# CAM-709 — The assistant says why these camps were chosen, from the filters it really applied

version 1 · 2026-08-07 · G1 approved on the plan (before/after examples ratified by the owner)

## Story

As a **camper**, I want the assistant to open its answer with why this set of camps was chosen, so that a list of results reads as a recommendation I can trust instead of an unexplained dump.

Why: today the answer is a bare list. The system already proves per-camp reasons (the `matchedTag` card badge, CAM-564) but nothing states the set-level reason, and the search tool never even tells the model which filters were really applied.

Scope: `lib/ai/tools/search-campsites.ts` (the echo) + `lib/ai/openrouter-client.ts` (the prompt clause) + tests. Depends on: —

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper asked for camps by criteria the search really filtered on (for example water terrain and a price cap) | The results arrive | ประโยคแรกของคำตอบบอกว่าเลือกจากเงื่อนไขอะไร เช่น เลือกมาจากเงื่อนไขที่ขอไว้ คือลานที่ติดแหล่งน้ำ และราคาไม่เกิน 500 บาทต่อคนต่อคืน (ถ้อยคำลื่นไหลตามบทสนทนา แต่ทุกข้อเท็จจริงมาจากเงื่อนไขที่ใช้กรองจริง) | The tool result carries an `appliedFilters` echo listing exactly the arguments that filtered; the model composes the sentence from it alone | EC-1, EC-2 |
| AC-2 | A camper asked for something the system could not filter on (for example วิวสวย) alongside one it could (พาสัตว์เลี้ยง) | The results arrive | เหตุผลอ้างเฉพาะเงื่อนไขที่กรองจริง (สัตว์เลี้ยง) และไม่อ้างเงื่อนไขที่ไม่ได้กรอง (วิว) | `appliedFilters` contains only the applied ones; the unapplied ask never appears in the echo | EC-1 |
| AC-3 | A camper asked broadly with no filterable criteria | The results arrive | คำตอบบอกตรงว่าเป็นการค้นทั่วไป ไม่ได้คัดจากเงื่อนไขพิเศษ และชวนให้บอกเงื่อนไขเพิ่ม | `appliedFilters` is empty; the model must not invent a reason | — |
| AC-4 | Any search with taxonomy filters | The results arrive | ชื่อเงื่อนไขในประโยคเป็นภาษาไทยแบบเดียวกับป้ายบนการ์ด (เช่น แม่น้ำ ลำธาร คลองเล็ก) ไม่ใช่รหัส | Thai labels resolved from MasterData ride in the echo; raw codes never reach the sentence | EC-3 |

## Rules

- BR-1 The echo lists ONLY arguments that actually constrained the query. An argument the tool dropped, ignored, or normalised away must not appear. This is the api.md "response must prove which filter was applied" rule (CAM-595/602) landing on this tool.
- BR-2 The echo is additive on `SearchCampsitesResult` — no existing key changes shape (api.md rule 12).
- BR-3 Taxonomy entries carry `{group, code, labelTh}` with `labelTh` resolved from MasterData in the same batched query pattern `deriveMatchedTags` already uses — never a second N+1.
- BR-4 The prompt change extends the EXISTING honest-scope clause (openrouter-client.ts:691); its honesty constraints keep their force verbatim in spirit: state only what was applied, skip the reason sentence's specific claims when nothing was applied.
- BR-5 Untouched, deliberately: the anti-enumeration clause (:656), the plain-text clause (:655), `MAX_TOKENS` (680), `matchedTag` and all its CAM-564 pins, and `deriveMatchedTags` behaviour.

## Edge cases

- EC-1 IF the model names a criterion not present in `appliedFilters` THEN that is the defect this design exists to prevent — the behavioural check must probe for it (ask with one filterable + one non-filterable criterion).
- EC-2 IF `sort` was applied (for example cheapest first) THEN it may be stated as part of the reason; if not applied, never implied.
- EC-3 IF a MasterData label lookup fails THEN omit that taxonomy entry from the echo (fail toward silence, never toward a raw code in a camper-facing sentence).
- EC-4 IF the search returned zero camps THEN the existing no-results behaviour stands; the echo still tells the truth about what was applied so the model can say what it searched FOR.

## Data

None. No schema change. The echo is a tool-result field (model-facing), not a public API shape.

## Seams & refs

`lib/ai/tools/search-campsites.ts:485` (`SearchCampsitesResult`), `:433` (`deriveMatchedTags` — the batched MasterData read to reuse), the execute return at `:1046-1053` · `lib/ai/openrouter-client.ts:691` (honest-scope clause), `:656`/`:655` (do not touch), `buildPlaceHintBlock:355` (the pin-server-facts idiom) · compareCamps `{criteria, camps}` (`lib/ai/tools/compare-camps.ts:186`) is the in-repo blueprint. Pins to supersede with dated notes: `__tests__/cam-415-adversarial-verify.test.ts:241-245` (full-prompt byte round-trip), any cam-501/502 pin on the :691 sentence, `.toEqual`-shaped result assertions in cam-270/404/408/427/461/463 search tests. Pins that must SURVIVE: cam-437 (anti-enumeration), cam-564-* (matchedTag), cam-459 (zones + MAX_TOKENS 680 + golden fixture count).

## Out of scope

- Remembering the reason across turns (`ShownResult` has no matchedTag/filters) — CAM-710.
- `bulkAvailability` parity (no matchedTag, no echo) — CAM-711.
- Fighting the model's list-writing habit (it violates :656 today; a separate behavioural battle, observed not fought here).

## Self-verify

- Unit: echo contains exactly the applied set (including a case where a supplied arg is dropped and must not echo); labels resolve; additive shape holds for existing consumers.
- Behavioural on the real endpoint (CAM-500 lesson — never trust a diff read for a prompt change): the four plan examples fired against the dev server; record the REAL answers in test.md, including the honesty probe (AC-2) and the broad-search case (AC-3).
- `npm run lint` · `npm run typecheck` · full `npm test` as the last act · the ai-guardrail-gate green on CI (lib/ai changed → 9 real-model cases run).
