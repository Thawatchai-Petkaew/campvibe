# CAM-716 — A date-led search respects the place the camper named

version 1 · 2026-08-08 · priority 0 (a live owner-reproduced honesty failure on staging)

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

- district/subDistrict on bulk (unless trivially free with the shared extraction — decide in-build and record); the province-level and near-level honesty closes the reported incident.
- Cross-turn reason memory (CAM-710).

## Self-verify

- Unit: near filtering on bulk (in-radius kept, out-of-radius dropped, no-centroid honest), echo applied-only matrix, matchedTag parity incl. the skip case.
- Behavioural on the real endpoint: the OWNER'S EXACT QUERY — assert the dispatched bulk call carries near=สระบุรี (or the search fallback does) AND the visible answer either shows Saraburi-area camps or says none exist there; plus the four CAM-714 cases still hold (no regression in the opener).
- Golden case added for the proximity+date shape with strictParams; fixture-count pin (cam-459 :277-295) updated with a dated note.
- Full suite last act · lint · typecheck · ai-guardrail-gate green on CI.
