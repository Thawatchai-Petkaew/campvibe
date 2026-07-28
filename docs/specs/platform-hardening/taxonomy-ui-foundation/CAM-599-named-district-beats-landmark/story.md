---
linear: CAM-599
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: story
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# A named district beats a landmark radius (CAM-599)

## Story
As a **Camper**, I want naming an อำเภอ (district) explicitly (e.g. "อำเภอปาย", "อ.ปาย") to search that district, so that I get camps IN Pai rather than everything within a 250km proximity radius around it.
Why: owner decision 2026-07-28, "อำเภอปายควรได้อำเภอนั้น" — the camper wrote the word อำเภอ; the resolver must answer with that district, not a guess at area-intent.
Scope: extend the deterministic pre-pass (`resolvePlace`, `lib/ai/place-resolver.ts`) with ONE new detector that fires on an explicit "อำเภอ"/"อ." marker in front of a real district name, checked BEFORE the existing landmark check. A bare landmark mention (no marker) is completely untouched — CAM-503's original reasoning (a landmark like เขาใหญ่ spans multiple provinces, so `near` is the only honest answer) still holds for that case. The actual district RESOLUTION (`resolveDistrictAdminAreaIds`, CAM-587/CAM-566) is proven correct and is not touched — this story only changes which hint the pre-pass injects.
Depends on: CAM-596 (district is now a first-class, deterministically-resolved level — the reason this story's fix has somewhere better to send an explicit อำเภอ ask), CAM-503 (the landmark check this story now runs after, for an explicit marker only), CAM-501/502/504 (the shared pre-pass idiom this story extends).

## AC
| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper names a real district with an explicit "อำเภอ" marker, and that same bare name also exists in the landmark gazetteer (e.g. "แคมป์ที่อำเภอปาย") | The camper sends the message to น้องกองไฟ | The assistant shows camps IN Pai district, not a 250km radius search | The pre-pass detects the explicit marker FIRST (ahead of the landmark check) and injects a MANDATORY `district="ปาย"` hint; the model calls `searchCampsites` with `district="ปาย"` this turn | EC-1 |
| AC-2 | The camper names the same district using the "อ." abbreviation (e.g. "แคมป์ที่ อ.ปาย") | The camper sends the message | Same result as AC-1 — camps in Pai district | The pre-pass recognizes both "อำเภอ" and "อ." as the explicit marker | EC-1 |
| AC-3 | The camper names the SAME bare landmark name with NO explicit marker, with or without a proximity word (e.g. "ลานกางเต็นท์ปาย", "ใกล้เขาใหญ่") | The camper sends the message | The assistant behaves exactly as before this story — the landmark's own proximity radius, unchanged | The landmark check still fires first for a marker-less mention (regression guard) | EC-2 |
| AC-4 | The camper names an explicit district AND its province in the same message (e.g. "อำเภอปาย จ.แม่ฮ่องสอน") | The camper sends the message | The assistant shows camps in Pai district, scoped by the named province | The pre-pass hints both `district` and `province` (the province narrows, never replaces, the district match) — unchanged CAM-596 BR-2 behavior, just reached via the new marker path too | — (mirrors CAM-596 AC-4, not a new risk) |

## Rules
- BR-1 Precedence (the one rule this story adds): `detectExplicitDistrictPrefix` (an "อำเภอ"/"อ." marker in front of a real district name) is checked FIRST, ahead of even the landmark check. Below that new first step, the existing CAM-501/502/503/504/596 order is BYTE-IDENTICAL: landmark → Bangkok-bare-mention → marker-less district (CAM-596) → province → region.
- BR-2 The explicit-marker candidate list reuses the SAME `thailandLocations` district data CAM-596 already scans, WITHOUT the three CAM-596 ambiguity guards that protect a BARE mention (the 4-char length floor, the curated `AMBIGUOUS_PROVINCE_NAMES_TH` set, and "substring of any other province's name") — the marker itself is the disambiguating context those guards exist to substitute for. The one CAM-596 guard KEPT is the "เมือง"+own-province capital-district pattern (e.g. "เมืองเชียงใหม่") — that guard is about redundancy with the province detector, not ambiguity, so it applies regardless of a marker.
- BR-3 A province named in the SAME message as an explicit district is still attached alongside it (mirrors CAM-596 BR-2) — consulted only as a scoping hint, never a competing filter.
- BR-4 Only "อำเภอ" and "อ." are recognized markers — a colloquial "เมือง" prefix (e.g. "เมืองปาย") is NOT treated as an explicit marker and keeps today's landmark behavior exactly (out of scope; not a signal the camper used to mean "administrative district" the way อำเภอ/อ. is).

## Edge cases
- EC-1 IF the explicit-marker text also names a district too short/ambiguous/province-name-colliding to survive CAM-596's own guards (e.g. "อำเภอตาก") THEN it still resolves as a district — the marker removes exactly the ambiguity those guards exist to protect against.
- EC-2 IF no "อำเภอ"/"อ." marker is present anywhere in the message THEN this story changes nothing — the existing landmark/district/province/region order runs exactly as it did before this story.

## Data
No schema/migration. No new entity/field — reuses `prisma/data/thailand-locations.json` (the same static gazetteer CAM-596 already scans) and the existing `AdminArea`-backed resolution (`resolveDistrictAdminAreaIds`, CAM-587/CAM-566, unchanged).

## Seams & refs
Reuse: `lib/ai/place-resolver.ts`'s existing candidate-list idiom (longest-match-first, `buildAdminAreaCandidates`'s guard set) — the new candidate list is built the same way, just with three of the four guards intentionally not applied (BR-2). `buildPlaceHintBlock` (`lib/ai/openrouter-client.ts`)'s existing `place.district` branch needed NO change — it already reads `ResolvedPlace.district` generically, regardless of which detector set it. Refs: CAM-596 story.md + tech.md (district as a first-class level, the reason this fix has somewhere to go); CAM-503 story.md (the original landmark-first reasoning, which this story narrows to "bare mention only"); CAM-596's own comment thread (the orchestrator flagged this exact gap during CAM-596's G3 review, "worth a decision, not a silent inheritance").

## Out of scope
- Sub-district ("ตำบล") explicit-marker detection — CAM-596 already scoped sub-district free-text detection out entirely (measured unsafe at that name-collision density); this story does not revisit that decision.
- A colloquial "เมือง" prefix as an explicit marker (BR-4) — only "อำเภอ"/"อ." are in scope per the owner's framing of the distinction ("the camper's own words"). → follow-up ticket only if evals show a systematic miss.

## Self-verify
- AC-1..4 → unit (`__tests__/cam-599-named-district-beats-landmark.test.ts`) for the pre-pass detector, asserting the district/proximity pair together so they cannot drift apart, plus a new guardrail golden case (`scripts/ai-eval/golden-cases.json`) for AC-1, real-model verified per the CAM-500 lesson.
- Every existing `cam-501`/`cam-502`/`cam-503`/`cam-504`/`cam-596` suite re-run green (sibling source-pin risk on a precedence change) — one pinned assertion in `cam-503-landmark.test.ts` was a direct, necessary consequence: it exercised exactly the "แคมป์อำเภอปาย" landmark-alias case this story deliberately changes, updated to assert the new district outcome and replaced with a non-อำเภอ-prefixed alias to keep its original "alias resolves to canonical nameTh" point intact. Golden-case COUNT pins in `cam-457`/`cam-459` were bumped by 1 (same precedent CAM-596 established when it added its own golden case).
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created.
