<!--
story v2 — CAM-464 · epic CAM-456 (assistant answers real camper asks — gap closure W1), wave-1 story 8.
AI-assistant story convention (matches CAM-459/CAM-463): the deterministic, char-for-char surface is the
TOOL DATA (facet score + evidence). น้องกองไฟ's spoken answer is MODEL-PHRASED — the Thai in the "Then"
column is REPRESENTATIVE of what the camper sees, marked "(เรียบเรียงเอง)"; only a few honest-fallback
phrasings are pinned as instructed copy. What is contract-testable is the SYSTEM EFFECT column (the score,
confidence, and evidence) + the eval-suite grounding/no-hallucination assertions (CAM-457).
No open clarification markers: every G2 architecture fork below is an ARCHITECT/ANALYST decision at
G2 (flagged inline as 🟡 with a stated default), not a G1-scope blocker — see ## Seams & refs + the handoff.
-->

## Story
As a **Camper**, I want น้องกองไฟ to answer "เหมาะครอบครัวไหม / มือใหม่ไปได้ไหม / รถเก๋งเข้าถึงไหม" with a grounded answer backed by the camp's real facts (or an honest "ข้อมูลไม่พอ"), so that I can judge whether a camp fits my situation without the assistant guessing (grounds P2 compare + P7 mood/goal experience questions; not measured).
Why: today no facet / derived-attribute field exists (research §2), so these experience questions have no data to land on — the model either cannot answer or would have to invent one; this story derives family / beginner / road_access scores WITH mandatory evidence from EXISTING CampSite fields, so the answer is grounded and reproducible (P13) with zero new data collection.
Scope: a RULES-ONLY facet-scoring layer for 3 facets (family, beginner, road_access) computed from existing CampSite atomic fields, each carrying MANDATORY evidence + a confidence, surfaced on the assistant's camp-detail read. NO review-mining / host-input sources (phase-2), NO facet-based SEARCH filter (follow-up), NO new user-facing screen.
Depends on: CAM-457 (golden eval harness — the grounding + no-hallucination assertions this ties to) · research `campvibe-ai-gap-closure-data-layer.md` §5 phase-1 item 1-5 · PREP-8 (`campvibe-schema-gap-analysis.md`)

## AC
<!-- Then = user-visible (model-phrased answer = REPRESENTATIVE Thai, marked (เรียบเรียงเอง)) · System effect = the deterministic, test-assertable data outcome · Neg/edge = failure twin (EC-n). -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A published camp has toilet + shower, drive-up access, and no minimum-age restriction | The camper asks น้องกองไฟ "`[ลาน X] เหมาะกับครอบครัวไหม`" | A grounded "yes" that NAMES the real reasons, e.g. `เหมาะกับครอบครัวเลย มีห้องน้ำ ห้องอาบน้ำ ขับรถเข้าถึงได้ และรับเด็กเล็กได้` (เรียบเรียงเอง; ทุกเหตุผลมาจากฟิลด์จริงของลาน) | A `family` facet is available for the camp: score 0.00–1.00 + confidence + a non-empty evidence list naming the exact fields (TOIL, SHOW, DRIV access, minimumAge). Every stated reason maps to one evidence entry | EC-1 |
| AC-2 | A camp is drive-up with core comforts (toilet / shower / electric) | The camper asks "`[ลาน X] มือใหม่ไปได้ไหม`" | A grounded, encouraging answer that names the beginner-friendly facts, e.g. `ไปได้สบายสำหรับมือใหม่ ขับรถถึงหน้าลาน มีห้องน้ำ ห้องอาบน้ำ และไฟฟ้า` (เรียบเรียงเอง) | A `beginner` facet score + confidence + evidence naming DRIV access + the comfort facilities present | EC-2 |
| AC-3 | A camp records drive-up access (DRIV) but the data does NOT record vehicle class (sedan vs pickup vs 4WD) | The camper asks "`[ลาน X] รถเก๋งเข้าถึงไหม`" | An HONEST, hedged answer: confirms a car can drive up but does NOT guarantee a sedan specifically, e.g. `ขับรถเข้าถึงได้ แต่ข้อมูลยังไม่ได้ระบุชัดว่ารถเก๋งเข้าได้แน่นอน แนะนำเช็กกับทางลานอีกที` (เรียบเรียงเอง) | A `road_access` facet score with confidence CAPPED at the low-confidence ceiling (BR-4), because the source field cannot distinguish vehicle class; evidence names the access code(s) | EC-3 |
| AC-4 | A camp's structured option data is essentially empty for a facet (no supporting field ⇒ evidence would be empty) | The camper asks "`[ลาน Y] เหมาะกับครอบครัวไหม`" | An honest "not enough info" answer, never a guess and never a fabricated reason, e.g. `ตอนนี้ข้อมูลของลานนี้ยังไม่พอจะบอกได้ว่าเหมาะกับครอบครัวไหม` (เรียบเรียงเอง) | No `family` facet is produced for the camp (empty evidence is invalid ⇒ facet absent, BR-5); the tool returns no score for it | EC-4 |
| AC-5 | The camp's source fields are unchanged between two turns | The camper asks the same facet question again (another turn or day) | The camper sees the SAME level and the SAME grounded reasons as before (no drift) | Identical score, confidence, and evidence for identical input fields — the scoring is deterministic (BR-6, P13 reproducibility) | EC-5 |

## Rules
- BR-1 FAMILY (candidate rule — 🟡 exact weights/thresholds are an analyst G2 refinement, defaults stated): score rises with each PRESENT supporting field — toilet (`TOIL`), shower (`SHOW`), drive-up access (`DRIV`, short walk from car with kids/gear), potable/water/electric (`POTA`/`WATE`/`ELEC`), and `minimumAge` null-or-low (kids welcome); a high `minimumAge` (🟡 default ≥ 12) lowers it. Evidence entries name each contributing code/field. (proves AC-1)
- BR-2 BEGINNER (candidate rule — 🟡 as BR-1): score rises with drive-up access (`DRIV`, NOT hike/boat-only) + creature-comfort facilities (`TOIL`/`SHOW`/`ELEC`/`POTA`) + on-site/nearby food (`REST`/`CAFE`/`MIMT`/`GRIL`) + any Equipment-group option (gear available on site). Boat/hike-only access strongly lowers it (see EC-3/BR-3). (proves AC-2)
- BR-3 ROAD_ACCESS: access options containing `DRIV` ⇒ drivable (higher score); access WITHOUT `DRIV` (only `HIKE`/`WALK`/`BAOT`) ⇒ not drivable (score ≤ 🟡 0.2) and the honest EC-3 answer. The score answers "can a vehicle reach it", never a guaranteed sedan claim (BR-4). (proves AC-3, EC-3)
- BR-4 CONFIDENCE + road_access honesty cap: confidence (0.00–1.00) = the fraction of a facet's source fields that the host has actually populated (a sparsely-filled listing yields low confidence). road_access confidence is CAPPED at 🟡 ≤ 0.5 because `DRIV` cannot distinguish sedan / pickup / 4WD (`Access type` is coarse — schema-gap PREP-7). A facet whose confidence is below the answerable threshold (🟡 default 0.3) is treated as insufficient (⇒ honest fallback, AC-4). (proves AC-3, AC-4)
- BR-5 EVIDENCE MANDATORY (P13 provenance): every produced facet score carries a NON-EMPTY evidence list of `{type:"field", ref:<code|fieldName>}` naming the exact fields that drove it. A facet with empty evidence is INVALID and is NOT produced — the facet is ABSENT (never score 0 with no reason), which routes the assistant to the honest "ข้อมูลไม่พอ" fallback. score ∈ 0.00–1.00, confidence ∈ 0.00–1.00. (proves AC-4)
- BR-6 DETERMINISTIC / REPRODUCIBLE (P13): identical input field values ⇒ identical score, confidence, and evidence. The scoring function is pure — no AI, no randomness, no I/O inside it (mirrors the `lib/listing-completeness.ts` precedent). (proves AC-5)
- BR-7 FACET SCOPE v1: the committed facets are `family`, `beginner`, `road_access`. `photo` = 🟡 include ONLY if it reuses existing signals at near-zero cost (`Image.kind = PANORAMA` + scenic terrain `BEAC`/`MTNS`/`RIVE` + `avgRating`); otherwise defer. `pet_detail` is EXCLUDED — redundant with the existing `petFriendly` boolean + search filter (adds nothing a single boolean does not). All facet codes are UPPER_SNAKE, guest-safe `[Public]`.

## Edge cases
- EC-1 IF a camp satisfies NONE of the family source fields THEN no `family` facet is produced (empty evidence is invalid, BR-5) → the assistant answers honestly (see AC-4), never invents. (BR-5)
- EC-2 IF beginner signals conflict (drive-up but zero comfort facilities) THEN the score reflects only the partial support with lowered confidence, and the answer names the gap rather than a blanket `มือใหม่ไปได้` (เรียบเรียงเอง). (BR-2, BR-4)
- EC-3 IF access is boat/hike-only (no `DRIV`) THEN road_access answers honestly that a vehicle cannot reach it, e.g. `ลานนี้เข้าถึงได้ทางเรือหรือเดินเท้าเท่านั้น รถเข้าไม่ได้` (เรียบเรียงเอง). (BR-3)
- EC-4 IF a camp's option data is essentially empty (a new / unfilled listing) THEN EVERY facet is absent and the assistant answers "ข้อมูลไม่พอ" for each, never a guess. (BR-5)
- EC-5 IF a source field later changes (host edits access / facilities / minimumAge) THEN the next computed score + evidence reflects the new fields (staleness handling — ties to the compute-timing G2 decision in ## Seams & refs). (BR-6)
- EC-6 IF a facet score is requested for an unpublished / inactive / soft-deleted camp THEN nothing is returned (reuses `get-camp-detail`'s existing `isPublished` + `isActive` + `deletedAt` guard — no new visibility path). (BR-5)

## Data
- Source fields (rules-only v1) — read from EXISTING CampSite atomic fields + relations ONLY, no new data collected: `options` (MasterData groups `Access type` = BAOT/DRIV/HIKE/WALK · `Internal facility` = TOIL/SHOW/ELEC/POTA/WATE/REST/CAFE/MIMT/GRIL/… · `Activity` · `Terrain` = BEAC/FORE/RIVE/MTNS · `Equipment`), `minimumAge`, `maxGuestsPerDay` + `useSpotView`, `images.kind` (PANORAMA), `avgRating`, `petFriendly`. All `[Public]`, guest-safe (no operator/contact/PII field is read — mirrors the get-camp-detail boundary).
- Facet-score SHAPE (adopting PREP-8's richer design, IF the G2 store path is chosen): `facet`, `score` Decimal(3,2), `confidence` Decimal(3,2), `evidence` Json (MANDATORY, non-empty — BR-5), `computedAt`, `@@unique([campSiteId, facet])`. `source` = `rules` for every row in v1.
- migration: 🟡 DEPENDS on the G2 store-vs-compute-on-read decision (see ## Seams & refs) — compute-on-read (recommended) = **none**; a persisted `CampFacetScore` table = **one reversible additive migration**. The author does NOT decide this (architect G2).

## Seams & refs
<!-- This story adds a NEW derived value; the readers/writers of the SOURCE fields are unchanged (read-only derivation) — the seam is where the derived value is COMPUTED and SURFACED. -->
- Reuse: `lib/listing-completeness.ts` — the direct precedent for a pure, deterministic, rules-based score (plain field inputs, NO Prisma inside the scoring fn, unit-testable with zero DB) → the facet scorer follows this exact shape. `lib/ai/tools/get-camp-detail.ts` — the surface: extend its lean `select` + `GetCampDetailResult` with the facet scores (ADR-009 no-forked-data-path), or add a sibling `getFacetEvidence` read. `lib/read-models/ai-camp-card.ts` — existing `options`/Terrain read pattern.
- Refs: research §5 phase-1 (1-5) · PREP-8 · ADR-003 (closed value set → engineering-owned enum) · ADR-009 (no forked data path) · Atomic Data Framework §12 (compute-on-the-fly; a cache is allowed only WITH a derivation trail — the `evidence` field IS that trail) — pointers only, no implementation.
- **G2 decisions to resolve (ARCHITECT / ANALYST — flagged, NOT decided here):**
  1. 🟡 Facet identifier — FK → a MasterData `Facet` group (PREP-8; extensible, add facets as data) **vs** a fixed enum / string-union (simpler, engineering-owned per ADR-003). Default/recommend: **enum-string** for a rules-only closed set (ADR-003), revisit the FK when host-input/curated facets need runtime extensibility. (architect)
  2. 🟡 Where the score lives / when it computes — (a) **compute-on-read** in a pure lib (NO table, NO migration — exactly like `listing-completeness`) **vs** (b) a stored `CampFacetScore` table (PREP-8) recomputed at write-time or in a batch job. Default/recommend: **(a) compute-on-read for rules-only v1** — the score is fully derivable from existing atomic fields, so a table adds staleness + backfill + a recompute trigger for zero benefit until phase-2 sources (review-mining / host-input) that CANNOT be computed on read arrive; write an ADR either way. (architect)
  3. 🟡 Exact per-facet weights / thresholds / confidence formula (BR-1..BR-4 give defensible candidates + defaults). (analyst)

## Out of scope
- Facet-based SEARCH filter on `searchCampsites` (e.g. "หาลานเหมาะครอบครัว") → follow-up (keeps this story atomic; compute + expose first).
- Review-aspect mining + host-input facet sources (phase-2 data acquisition) → follow-up (research §5 phase-2 item 2-1).
- Persisted `CampFacetScore` table + backfill / recompute job → only if the G2 store path (decision 2b) is chosen; otherwise deferred to phase-2 → follow-up.
- `pet_detail` facet (redundant with `petFriendly`) → phase-2, only if pet sub-detail pixels (fenced / size limit / vet) are added.
- The wider PREP-8 facet vocabulary (`quiet`/`party`/`workation`/`senior`/`solo_safe`/`rain_ok`) → later waves.

## Self-verify
- AC-1..3 → integration: for fixture camps with known fields, assert the facet score + non-empty evidence is produced, and that road_access confidence is capped (BR-4) + never over-claims a sedan; PLUS a golden eval case (CAM-457) asserting the grounded answer names only real fields.
- AC-4 / EC-1 / EC-4 → integration: a sparse camp ⇒ facet absent; PLUS the eval no-hallucination assertion (honest "ข้อมูลไม่พอ", no invented reason).
- AC-5 / EC-5 → unit: identical input ⇒ identical score/confidence/evidence; a changed source field ⇒ a changed output (pure-function determinism, mirrors the `listing-completeness` tests).
- Story-specific: evidence non-empty on every produced score (BR-5) · road_access confidence ≤ cap (BR-4) · unpublished/inactive/deleted camp returns nothing (EC-6) · ties to eval P2 / P7 / P13 (CAM-457 golden suite).
- Gate = /quality-gate · Done = every AC verified on the real Staging URL.

## Changelog
- v1 (2026-07-24) — created (Discovery + spec, PO). Rules-only v1 adopting PREP-8's shape; store-vs-compute-on-read + facet-id + weights flagged for architect/analyst G2.
