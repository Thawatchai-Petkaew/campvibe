# CAM-714 — The reason sentence reads as human Thai, not a report

version 1 · 2026-08-12 · spec-lite (S-class: prompt-only, single file-surface, no schema/API contract change) · G1 folds into this PR's G3 packet per Gate policy v2

## Story

As a **camper**, I want the assistant's opening "why these camps" sentence to sound like a friend talking, not a system reciting a report, so that the answer reads as trustworthy conversation instead of a template.

Why: the owner rejected CAM-709's opener "เลือกมาจาก..." as not human Thai (2026-08-08 feedback). Root cause, proven by re-reading `lib/ai/openrouter-client.ts:700`: the clause carried exactly ONE worked example sentence, and the model parroted it verbatim on all 4 recorded CAM-709 answers (`docs/specs/.../CAM-709-why-these-camps/test.md`). A 3-candidate x 3-judge research pass (voice dossier + judged synthesis) produced a ratified composition: SHAPE from the fusion candidate (reason folds INTO the found-sentence, no separate report preamble), HONESTY SPINE from the strictest candidate (every CAM-709 constraint survives, extended for `petFriendly`/`type` + bulkAvailability's `ranges`-only sourcing), ANTI-PARROT MECHANICS from the anti-template candidate (a checkable banned-opener list + THREE never-copy examples + an in-clause voice spec).

Scope: `lib/ai/openrouter-client.ts` (the :700 reason-sentence clause rewrite + the adjacent :691 clause's ค่ะ-ending example sentences) + tests. Depends on: CAM-709 (extends its clause).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper asks by criteria the search really filtered on (water terrain + a price cap) | The results arrive | เปิดคำตอบด้วยประโยคเดียวที่ผสานเหตุผลกับสิ่งที่เจอเป็นภาษาพูดปกติ เช่น "เราหาลานกางเต็นท์ริมน้ำที่ราคาไม่เกิน 500 บาทต่อคืนต่อคนมาให้แล้ว มีหลายที่ให้เลือก" (ถ้อยคำจริงแตกต่างไปทุกครั้ง แต่ไม่ขึ้นต้นด้วยวลีรายงานอย่าง "เลือกมาจาก") | Same `appliedFilters`-only sourcing as CAM-709; opener varies turn to turn | EC-1, EC-2 |
| AC-2 | A camper asks for something unfilterable (บรรยากาศโรแมนติก) alongside something filterable (พาสัตว์เลี้ยง) | The results arrive | ประโยคเปิดพูดถึงเฉพาะเงื่อนไขที่กรองจริง (สัตว์เลี้ยง) คำว่า "โรแมนติก" หรือคำพ้องความหมายต้องไม่ปรากฏในประโยคนี้ | `appliedFilters` carries only `petFriendly`; the mood word is dropped, never mirrored | EC-1 |
| AC-3 | A camper asks broadly with no filterable criteria | The results arrive | คำตอบบอกตรงว่าเป็นการหากว้างๆ ไม่มีเงื่อนไขเฉพาะ และชวนบอกทำเล ราคา หรือสไตล์ เช่น "รอบนี้เราหากว้างๆ ให้ก่อน ลองบอกทำเล ราคา หรือสไตล์ที่ชอบมาได้เลย" | `appliedFilters` is empty; the model states that plainly, never invents a reason | — |
| AC-4 | Any 3+ separate criteria-bearing turns in the same session | Each returns results | ประโยคเปิดของแต่ละคำตอบไม่ซ้ำคำขึ้นต้นกัน และไม่มีคำใดในชุดคำต้องห้าม (เลือกมาจาก / คัดมาจาก / ตามเงื่อนไขที่ / จากเงื่อนไขที่ระบุ / ผลการค้นหา) และไม่ลงท้ายด้วยค่ะ/ครับ | The banned-opener list + 3 never-copy examples + in-clause voice spec (เรา, no ค่ะ/ครับ, no emoji, no em-dash) hold across turns | EC-4 |
| AC-5 | A `bulkAvailability`-routed question (many camps + a date, e.g. "ว่างเสาร์นี้ แถวสระบุรี") | The results arrive | ประโยคเปิดบอกวันที่จากผลตรวจสอบจริงเท่านั้น ไม่ใช่จากความจำของอาร์กิวเมนต์ที่ส่งไป | Dates sourced ONLY from that call's own `ranges`; degrades to dates+count when no filter echo exists | EC-5 |

## Rules

- BR-1 SHAPE: the reason sentence fuses INTO the found-report — one sentence does both jobs; no separate selection-report preamble slot (closes the exact structural gap `เลือกมาจาก` occupied).
- BR-2 HONESTY SPINE (verbatim-in-force from the ratified candidate): `appliedFilters`-only sourcing (search-campsites.ts), every dimension covered including `petFriendly`/`type` (buildAppliedFilters echoes both, the old clause omitted both), `labelTh`-only taxonomy naming (never a raw `code`), a FLAT no-parenthesis rule with a truncation carve for a `labelTh` that itself contains one (e.g. CHIC = "สบาย (สายคุณหนู)"), never-mirror-the-camper's-unapplied-mood, broad-search honesty, the sentence never names an individual campsite, skip-when-no-tool-call. Extended: bulkAvailability's date facts source ONLY from that result's own `ranges` (it carries no `appliedFilters` at all) — degrades to dates+count with no criteria when no filter echo exists.
- BR-3 ANTI-PARROT MECHANICS: a mechanically checkable banned-opener list (5 exact strings) + THREE structurally different (verb-first / place-first / criterion-first) example sentences, explicitly marked never-copy-verbatim + vary-your-opening-words + an in-clause voice spec (first person เรา, never ฉัน, no ค่ะ/ครับ, softeners นะ/เลย/ดูไหม, no emoji, no em-dash).
- BR-4 (iteration, real-model verify) A FLAT rule bans naming ANY province/region/place in the opening sentence unless it is the exact `appliedFilters.province`/`near`/`region` value — closes a location-fabrication gap the behavioural verify actually found (queries with no location criterion sometimes narrated a province the unfiltered results happened to share).
- BR-5 The adjacent :691 clause's two example sentences are re-registered particle-free (ค่ะ → เลย) to match the ratified register (locales/translations.json's aiChat.booking.* strings carry 0 ค่ะ/ครับ occurrences); every other word in :691 is unchanged.
- BR-6 Untouched, deliberately (BR-5-style pins, CAM-709 precedent): the anti-enumeration clause (:656, known-violated today, explicitly out of scope — same as CAM-709), the plain-text clause (:655), `MAX_TOKENS` (680), `matchedTag`/CAM-564 pins, `MAX_STATUS_RANGE_NIGHTS`/CAM-459 zones.

## Edge cases

- EC-1 IF the model names a criterion not present in `appliedFilters` THEN that is the defect this design exists to prevent — probed directly (AC-2).
- EC-2 IF a `labelTh` itself contains a parenthesis (CHIC) THEN keep only the plain Thai part before it — never drop the flat no-parenthesis rule for this one label.
- EC-3 IF two consecutive answers would otherwise open with the same words THEN the vary-your-opening-words instruction + 3 differently-headed examples are the mitigation; single-turn verification cannot force a hard guarantee (LLM instruction, not deterministic code) — this is documented residual risk, not silently claimed as solved.
- EC-4 IF the model's own new examples get parroted instead of the old ones THEN that is what the variety check in this story's behavioural verify exists to catch — iterate the wording, never ship on a diff read alone (CAM-500 lesson).
- EC-5 IF `bulkAvailability`'s result carries no `appliedFilters` echo (it never does today) THEN state only dates+count in the opening sentence, never a terrain/province/taxonomy criterion from memory.

## Data

None. No schema change. Prompt-only.

## Seams & refs

`lib/ai/openrouter-client.ts:700` (the reason-sentence clause, full rewrite) · `:691` (the honest-scope clause, two example-sentence edit only) · `lib/ai/tools/search-campsites.ts:588-630` (`buildAppliedFilters` — the real dimension list the enumeration must match) · `lib/ai/tools/bulk-availability.ts:146-164` (`BulkAvailabilityResult` — confirms no `appliedFilters` field, only `ranges`) · `prisma/seed.ts:105` (CHIC labelTh = "สบาย (สายคุณหนู)", the parenthesis truncation case) · locales/translations.json's `aiChat.booking.*` (the ratified particle-free register). Pins superseded with dated notes in the same PR: `__tests__/cam-709-openrouter-honest-scope-extend.test.ts` (assertions updated to the new clause text) · `__tests__/cam-415-adversarial-verify.test.ts` (dated note only, the byte-round-trip pin itself needed no assertion change — it never asserted against :700/:691 content). Pins that must SURVIVE unchanged: cam-437 (anti-enumeration/no-invent-camps), cam-459 (3-zone answer policy + `MAX_TOKENS` 680), cam-564 (`matchedTag`).

## Out of scope

- The pre-existing :656 anti-enumeration violation (the model still lists camp names/prices under the opening sentence on most turns) — known, explicitly out of scope per CAM-709's own test.md; a separate behavioural battle.
- A fully deterministic (server-side, non-prompt) fix for location-fabrication — the BR-4 flat rule measurably reduces but does not 100%-eliminate a small model occasionally narrating an incidental province pattern from unfiltered results (see test.md's iteration log); a follow-up ticket should evaluate a code-level validation/strip pass if this recurs after G4. → follow-up not yet ticketed, flagged here.
- `bulkAvailability` gaining a real `appliedFilters` echo (would let the Saraburi-style case cite criteria from the SAME tool that verified availability) — CAM-711 already covers `bulkAvailability` parity per CAM-709's own out-of-scope note.

## Self-verify

- Source-level: `__tests__/cam-714-reason-sentence-rewrite.test.ts` (new, 22 cases) + updated `__tests__/cam-709-openrouter-honest-scope-extend.test.ts` (12 cases) pin the new clause's shape/honesty/anti-parrot mechanics and the :691 register fix.
- Behavioural on the real endpoint, own dev server port 3029 (CAM-500 lesson — never trust a diff read for a prompt change): all 4 CAM-709 cases + the Saraburi bulkAvailability case + a 3-question variety check, run multiple times each; iterated the clause twice against real findings (a location-fabrication gap found on 2 different query shapes, fixed with a FLAT rule after a nuanced phrasing under-held). Full log + verbatim answers in test.md.
- `npm run lint` (0 errors) · `npm run typecheck` (clean) · `npm run build` (clean) · full `npm test` as the last act (12420/12421 pass; 1 pre-existing unrelated real-DB test failure on the shared dev DB, `cam-650-pricing-unit-schema.test.ts`, zero files touched in that area — documented, not chased) · ai-guardrail-gate green on CI (lib/ai changed → 9 real-model golden cases run).

## Changelog

- v1 (2026-08-12) — created
