# CAM-716 — A date-led search respects the place the camper named

version 2 · 2026-08-12 · priority 0 (a live owner-reproduced honesty failure on staging)

## Story

As a **camper** who names a place and a date together, I want the results to actually come from that place, so that "ลานริมน้ำ แถวๆสระบุรี เสาร์หน้า" never returns Yala camps under a sentence claiming they are near Saraburi.

Why: the owner reproduced this on staging 2026-08-08. Two structural layers, both proven in code: `bulkAvailability`'s schema (`lib/ai/tools/bulk-availability.ts:103-119`) has no `near`/`district`/`subDistrict`, and the place-resolver's `near` pin (`openrouter-client.ts:371,383`) binds `searchCampsites` only — so a proximity query WITH a date drops its location entirely. And `bulkAvailability` returns no `appliedFilters` echo, so the CAM-709/714 reason-sentence discipline has nothing to bind to on that path — the model mirrors the request words instead.

Scope: `lib/ai/tools/bulk-availability.ts` · the place-hint blocks in `lib/ai/openrouter-client.ts` · shared proximity extraction from `search-campsites.ts` if needed · tests. Absorbs CAM-711 (echo + matchedTag parity). Depends on: —

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper asks for riverside camps near a named province with a stay date | Results arrive | ลานที่แสดงอยู่แถวจังหวัดที่ขอจริง และประโยคเหตุผลอ้างพื้นที่นั้นได้อย่างถูกต้อง | `bulkAvailability` receives and applies `near`; its result echoes it in `appliedFilters` | EC-1 |
| AC-2 | The named place has NO available camps matching the rest of the ask | Results arrive | คำตอบบอกตรงว่าแถวนั้นไม่มี และถ้าจะเสนอที่อื่นต้องบอกชัดว่าเป็นที่อื่น ไม่แอบอ้างว่าเป็นที่ที่ขอ | Zero-result honesty per the :691 rule, now enforceable because the echo proves what was applied | EC-2 |
| AC-3 | Any date-led search with taxonomy filters | Results arrive | ป้ายบนการ์ดบอกเหตุผลรายลานเหมือนเส้นค้นหาปกติ | bulk cards carry `matchedTag` via the same `deriveMatchedTags` (CAM-711 parity) | — |
| AC-4 | The owner's exact query: แนะนำลานกางเต้นท์ติดริมแม่น้ำ แถวๆสระบุรี เข้าพักเสาร์หน้า | The answer arrives | ผลลัพธ์อยู่แถวสระบุรีจริง หรือบอกตรงว่าแถวสระบุรีไม่มี — ไม่มีทางได้ยะลาใต้ประโยคที่อ้างสระบุรี | The regression case of this incident, verified behaviourally on the real model | — |

## Rules

- BR-1 `near` on `bulkAvailability` reuses CAM-502's committed centroid table + radius cap — the SAME semantics as `searchCampsites` (extract to a shared module rather than duplicating; the CAM-566 shared-matcher precedent).
- BR-2 The place-resolver `near` (and district/subDistrict if added) pin blocks extend to name `bulkAvailability` exactly as the province/region pins (:429/:440) already do. If district/subDistrict are NOT added this round, the pins must stay searchCampsites-only for those levels and the spec records the residual — never pin a param the tool cannot accept.
- BR-3 `appliedFilters` echo on the bulk result: same shape and same applied-only honesty as CAM-709's on search (BR-1 there). Additive.
- BR-4 `matchedTag` parity: bulk cards run through `deriveMatchedTags` with the same skip-when-no-taxonomy-filter behaviour (cam-564 pins are the reference semantics; do not disturb them).
- BR-5 The reason-sentence clause (:700, CAM-714) needs no wording change if the echo lands — verify its bulk branch reads the echo; adjust only the minimal sourcing reference if it names fields bulk now provides.

## Edge cases

- EC-1 IF the model still omits `near` on a proximity ask THEN that is the pin failing, not the schema — the behavioural case must assert the DISPATCHED args carry near (strictParams-style, the CAM-587 lesson: a green gate is only green over the cases it contains).
- EC-2 IF zero camps match near the place THEN the tool returns an empty result WITH the echo intact so the honest-zero sentence can name the place truthfully.
- EC-3 IF the centroid table has no entry for the named place THEN behave exactly as searchCampsites does today (its "no centroid available" path), never a crash, and the echo must not claim a near that was not applied.

## Data

None. No schema change, no migration.

## Seams & refs

`lib/ai/tools/bulk-availability.ts:96-119` (the deliberate v1 scope-cut comment — this story retires it) · `search-campsites.ts:31-70` (centroids, radius cap, landmark-first near resolution — the machinery to share) · `openrouter-client.ts:355-449` (pin blocks) · CAM-709's `appliedFilters` builder (the shape to mirror) · cam-564 matchedTag pins (must survive) · the golden corpus: check whether any golden case pins bulk WITHOUT near (the CAM-513→519 value-sweep lesson) and add a guardrail-grade case for the owner's query shape with `strictParams` asserting near.

## Out of scope

- **district/subDistrict on bulk — decided NOT trivially free, deferred.** Adding them would require threading `resolveExactInsideAdminAreaIds`'s district/sub-district id-resolution (currently private to `search-campsites.ts`, itself calling 3 more helper functions) into bulk's own precedence chain and its own `appliedFilters`/pin-block surface — a second, real extraction on top of the near/taxonomy one this story already ships, not a byte-free addition. The province-level and near-level honesty this story ships closes the reported incident (near/province/region now all echo correctly on bulk); the openrouter place-hint pins for `district`/`subDistrict` stay `searchCampsites`-only (BR-2's residual, unpinned for bulk — never pin a param the tool cannot accept).
- Cross-turn reason memory (CAM-710).
- **New finding, out of scope (flag for a follow-up ticket, not fixed here):** behavioural verify surfaced a REAL, reproducible defect unrelated to `near` — when the model chains `searchCampsites` (with a taxonomy filter, e.g. `terrain:"FILD"`) into a SECOND `bulkAvailability` call for the same ask, it does not always carry the taxonomy filter over to the second call, yet the answer's opening sentence still names the dropped criterion (observed 3/3 runs: "แนะนำลานทุ่งหญ้า แถวๆยะลา เข้าพักเสาร์หน้า ว่างไหม" → `bulkAvailability` dispatched with only `{near, dates}` — no `terrain` — while the answer opens "เราเจอลานทุ่งหญ้าแถวยะลาที่ว่าง..." naming ทุ่งหญ้า it never re-applied). This is a location-HONEST answer (near is never dropped, this story's own concern) but a terrain-dishonest one — a distinct defect from AC-4's Yala/Saraburi regression, pre-existing (bulk has offered `terrain` since CAM-408/511/513, well before this story), and out of this story's BR/AC scope (which is `near` specifically). See test.md for the full repro log.

## Self-verify

- Unit: near filtering on bulk (in-radius kept, out-of-radius dropped, no-centroid honest), echo applied-only matrix, matchedTag parity incl. the skip case — `__tests__/cam-716-bulk-near-and-echo.test.ts` (14 cases, all green).
- Behavioural on the real endpoint (own dev server, port 3031, real OpenRouter call, shared local dev DB — CAM-500 lesson): the OWNER'S EXACT QUERY run 5x — `near` was correctly set on the dispatched call in 5/5 runs (never dropped), and the visible answer always named Saraburi-area camps honestly, NEVER Yala under a Saraburi claim. **Real finding, recorded not assumed:** the place-resolver hint's canonical English value ("Saraburi") is what the model emits in the MAJORITY of runs (6/8 across all owner-query variants), but the model sometimes emits the camper's own Thai text ("สระบุรี") instead — both are correct (the shared `resolveProvinceForSearch` resolves either), so the golden case (below) is pinned to the majority English form with guardrail retries covering the minority case, rather than asserting an unverified 100% determinism. Full verbatim log in test.md.
- Golden case added for the proximity+date+terrain shape (id `GEO-8-CAM716-DATE-NEAR-SARABURI`, `guardrail:true`) — asserts the DISPATCHED args carry `near="Saraburi"` + `terrain="RIVE"`. Targets `searchCampsites` (not `bulkAvailability`): real-model sampling (8 runs) showed `searchCampsites` reliably fires first with `near` correctly set every time, while `bulkAvailability` only joins the turn when the message also carries an explicit availability trigger word — a pre-existing, this-story-unrelated tool-routing behavior. Pinning the reliable trigger is the honest choice (a flaky guardrail is not a guardrail); the shared near-machinery `bulkAvailability` itself now runs is proven deterministically by the unit tests above, and by direct real-endpoint runs recorded in test.md that DID route to bulk. `strictParams` was considered and rejected (see EC-1 note below) — subset match on `near`+`terrain` is the mechanically feasible, still-rigorous choice. Fixture-count pin (cam-459 `:277-297`, cam-457 `:97-155`) updated 70→71 with a dated note (both files swept, CAM-513 value-sweep lesson).
- EC-1 note: literal `strictParams:true` (exact key-set match) is infeasible for ANY `dates`-bearing tool call — a real dispatched `bulkAvailability`/`resolveDates`-chained call always also carries a `dates` array whose value is day-relative ("next Saturday" resolved against the real run date), so no static JSON fixture can pin it exactly; verified by inspecting `scoreCase`'s exact-key-count check (`scripts/ai-eval/score.ts`) and confirming no existing guardrail case combines `strictParams:true` with a dates-bearing tool. Subset match with a pinned exact `near`/`terrain` VALUE (via `deepEqual`) still rigorously proves "the model actually SETS near" per EC-1's own intent.
- Full suite last act · lint · typecheck · ai-guardrail-gate green on CI (real guardrail gate run twice locally against the live model, both green).

## Changelog

- v1 (2026-08-08) — created.
- v2 (2026-08-12) — built + verified: `near` shared-extracted (`lib/geo/province-proximity.ts`) and added to `bulkAvailability`; `appliedFilters`/`matchedTag` shared-extracted (`lib/ai/tools/taxonomy-tags.ts`) and echoed on bulk; openrouter near-hint pins extended to bulk; the :700 clause's bulk-sourcing sentence updated. Real-model behavioural verify recorded 2 findings not assumed at spec time: (1) near-value language (EN "Saraburi" vs TH "สระบุรี") is model-non-deterministic, both resolve correctly server-side; (2) `searchCampsites` is the reliable near-carrying trigger for the owner's exact phrasing, `bulkAvailability` joins only with an explicit availability keyword — golden case + Out-of-scope updated accordingly. A new, unrelated terrain-carry-over defect was found and flagged for follow-up, not fixed in this story.
