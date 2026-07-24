---
linear: CAM-464
feature: ai-assistant
epic: assistant-answers-real-camper-asks-gap-closure-w1 (CAM-456)
persona: Camper
artifact: tech
owner: architect
status: In Progress — G2 design (architect)
version: v1
updated: 2026-07-24
---
# Tech — Derived facet scores: family / beginner / road_access, rules-only v1 (CAM-464)

> ONE new pure module (`lib/facet-scores.ts`, the direct twin of
> `lib/listing-completeness.ts`) + ONE additive optional field on the EXISTING
> `getCampDetail` result (`facets: FacetScore[]`). **NO table, NO migration, NO
> new tool, NO new endpoint, NO change to any existing select** — `getCampDetail`
> already fetches every source field (`options {code, group}` + `minimumAge`).
> Six G2 decisions below; all reversible/additive/backward-compatible. No open
> clarification markers.

## D1 — STORE vs COMPUTE-ON-READ: compute-on-read, NO table, NO migration (confirms PO)
**Decision:** the facet layer is a **pure `computeFacetScores(input)` function** in `lib/facet-scores.ts` — no Prisma, no I/O, no clock, no randomness inside it, exactly the `listing-completeness.ts` split (the caller maps a Prisma row → a plain input; the rule is unit-testable with zero DB). Scores are computed **on read**, on the same request that already loaded the camp. **NO `CampFacetScore` table, NO migration this story.**

**Home + shape:**
```ts
// lib/facet-scores.ts — PURE (no prisma import; enforced by test, D6)
export type FacetId     = 'family' | 'beginner' | 'road_access';   // closed set, ADR-003 (D2)
export type FacetSource = 'rules';                                  // v1; phase-2 adds 'reviews' | 'host'

export interface FacetEvidence {
  type: 'field';                       // v1 rules-only provenance; phase-2: 'review' | 'host'
  ref: string;                         // a MasterData code ('TOIL','DRIV') or a CampSite field ('minimumAge')
  effect: 'supports' | 'limits';       // supports = raised the score; limits = capped/lowered it
  note?: string;                       // OPTIONAL stable machine caveat tag (NOT prose), e.g. 'vehicle_class_unknown' (D3 road_access)
}
export interface FacetScore {
  facet: FacetId;
  score: number;                       // 0.00–1.00, 2 dp (deterministic)
  confidence: number;                  // 0.00–1.00, 2 dp
  answerable: boolean;                 // confidence >= ANSWERABLE_CONFIDENCE (0.30) — the honesty gate (BR-4)
  evidence: FacetEvidence[];           // NON-EMPTY (BR-5); a facet with empty evidence is NOT emitted (absent)
  source: FacetSource;                 // 'rules' for every facet in v1 (matches PREP-8's `source`)
}
export interface FacetScoreInput {
  options: { code: string; group: string }[];  // exactly what getCampDetail's select already returns
  minimumAge: number | null;
}
export function computeFacetScores(input: FacetScoreInput): FacetScore[];
```
The shape adopts PREP-8's design (`facet` / `score` / `confidence` / `evidence` / `source`) as an in-memory value object instead of a table row — so a later phase-2 migration to the persisted table is a shape-preserving lift, not a redesign.

**Rationale:** the score is **fully derivable from existing atomic Pixels** (`options`, `minimumAge`) in microseconds. A table would add staleness + a backfill + a recompute-trigger on every source-field edit (EC-5) for **zero benefit** — Atomic Data Framework §12 permits a cache ONLY when it carries a derivation trail AND the compute is expensive; rules-only v1 is neither expensive nor un-derivable, so the cache is pure debt. It also reuses the shipped `listing-completeness` precedent and keeps the read on the single `getCampDetail` path (ADR-009 no-forked-data-path). Determinism (BR-6) and reproducibility (P13) are structural — a pure function of the source fields, no stored snapshot to drift.

**Rejected — the `CampFacetScore` table (PREP-8):** deferred to phase-2. A table earns its keep ONLY when a facet's score comes from a source that **cannot be computed per-request** — review-aspect mining (a batch LLM over verified reviews) or host input. Those land in phase-2 (research §5 phase-2, story Out-of-scope); THAT is the split point. **If phase-2 mining is ever folded into THIS story, it MUST SPLIT** — the table is a separate, additive, reversible migration and a separate story. For v1, no table is needed (concurs with the PO); I am not overriding.

**Confirmation:** `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource <db>` prints EMPTY and no new `prisma/migrations/*` dir exists in the diff; `__tests__/cam-464-facet-scores.test.ts` asserts `lib/facet-scores.ts` contains no `prisma`/`@/lib/prisma` import (purity) and that identical input ⇒ deep-equal output (BR-6).

## D2 — FACET IDENTIFIER: TS string-union enum, not a MasterData FK (confirms PO)
**Decision:** `type FacetId = 'family' | 'beginner' | 'road_access'` — a compile-time closed set owned by engineering (ADR-003). NOT a Prisma enum (there is no column — the id lives only in code + the JSON payload), NOT a MasterData-`Facet`-group FK. v1 facet set = the three the AC pins (`family`→AC-1, `beginner`→AC-2, `road_access`→AC-3). All UPPER_SNAKE-free lower_snake string literals, guest-safe `[Public]`.

**`photo` DEFERRED (BR-7 resolved):** excluded from v1. It is NOT near-zero cost here — `getCampDetail`'s select does **not** currently fetch `images`, so a `photo` facet would force an added `images { where kind:PANORAMA }` select (a real query-shape change), and there is **no AC** for a photo facet. Adding it violates "design exactly to the current AC" (lean). Revisit when a photo-fit question earns an AC. **`pet_detail` EXCLUDED** (BR-7) — redundant with the existing `petFriendly` boolean + its search filter.

**Rejected — MasterData-`Facet`-group FK (PREP-8):** buys runtime extensibility (add a facet as a data row) we do not need for three compile-time-known, rules-defined facets; it adds a seed dependency + a runtime join + loses the exhaustiveness a union gives (a `switch` over `FacetId` is compile-checked). Revisit the FK ONLY when facets become host-curated or runtime-extensible (phase-2), which is the same trigger as the D1 table.

**Confirmation:** typecheck — `FacetId` is a union; a `satisfies Record<FacetId, …>` rule table (mirroring `listing-completeness`'s `SATISFIED_WHEN`) makes a missing/typo'd facet a compile error, not a silent gap.

## D3 — THE RULE CONTRACT (the correctness core — analyst decision, owned here)
Constants (named, single-source in `lib/facet-scores.ts`):
`ANSWERABLE_CONFIDENCE = 0.30` · `ROAD_ACCESS_CONFIDENCE_CAP = 0.50` · `FAMILY_AGE_CEILING = 12` · `FAMILY_AGE_RESTRICTED_CAP = 0.40` · `ROAD_DRIVABLE_SCORE = 0.70` · `ROAD_NOT_DRIVABLE_SCORE = 0.15`.
Group tags (from `prisma/seed.ts`): `Access type` = BAOT/DRIV/HIKE/WALK · `Internal facility` = TOIL/SHOW/POTA/WATE/ELEC/REST/CAFE/MIMT/GRIL/… · `Equipment for rent` = TENT/TFAN/…

**Scoring model (all facets):** `score = Σ (fired-slot weight)`, clamped `[0,1]`, 2 dp — the same additive weight-table shape as `listing-completeness`. Each **fired** slot emits exactly ONE evidence entry, in fixed slot order (BR-6 deterministic ordering). `confidence = firedSlots / totalSlots` (the fraction of the facet's source dimensions we have positive evidence for — BR-4), except road_access (special-cased below). **Empty evidence ⇒ the facet is NOT emitted** (BR-5 → the absent/"ข้อมูลไม่พอ" path, AC-4/EC-1/EC-4). `answerable = confidence >= 0.30`; a produced-but-below-threshold facet stays in the array with `answerable:false` so the assistant hedges to "ข้อมูลไม่พอ" naming the gap (EC-2) rather than committing.

> **Confidence honesty note (accepted v1 limitation):** the schema records only PRESENT `options` — a missing `TOIL` is indistinguishable from "host didn't fill it in". `firedSlots/totalSlots` therefore conflates genuine absence with unfilled data, but it ALWAYS errs toward LOW confidence → a hedged answer, the safe failure direction. A true absent-vs-unfilled signal is a phase-2 host-input source (D1), not a v1 rule.

### FAMILY — 5 slots, weights Σ = 1.00 (proves AC-1; absent = AC-4/EC-1)
| slot | fires when | weight | evidence (ref, effect) |
|---|---|---|---|
| toilet | `TOIL ∈ codes` | 0.25 | `TOIL`, supports |
| shower | `SHOW ∈ codes` | 0.20 | `SHOW`, supports |
| driveUp | `DRIV ∈ codes` (short carry with kids/gear) | 0.25 | `DRIV`, supports |
| waterPower | any of `{POTA, WATE, ELEC} ∈ codes` | 0.15 | first present in order POTA→WATE→ELEC, supports |
| kidsWelcome | `minimumAge == null` OR `minimumAge <= 6` | 0.15 | `minimumAge`, supports |

**Age ceiling (BR-1):** if `minimumAge != null && minimumAge >= 12` → clamp `score = min(score, 0.40)` AND append `{ref:'minimumAge', effect:'limits'}` (the age gate makes the camp less family-suitable, stated as evidence). `kidsWelcome` cannot also fire (12 > 6), so no double count. `minimumAge` 7–11 → neither fires nor caps (neutral). `confidence = firedSupportSlots / 5` (the `limits` entry does not count as a fired source slot). Zero fired support slots ⇒ evidence empty ⇒ **family absent** (EC-1: satisfies none → honest fallback, never score 0 with no reason).

### BEGINNER — 7 slots, weights Σ = 1.00 (proves AC-2; conflict = EC-2)
| slot | fires when | weight | evidence (ref, effect) |
|---|---|---|---|
| driveUp | `DRIV ∈ codes` (front-of-camp, no long hike with gear) | 0.35 | `DRIV`, supports |
| toilet | `TOIL ∈ codes` | 0.10 | `TOIL`, supports |
| shower | `SHOW ∈ codes` | 0.10 | `SHOW`, supports |
| power | `ELEC ∈ codes` | 0.10 | `ELEC`, supports |
| water | `POTA ∈ codes` | 0.10 | `POTA`, supports |
| food | any of `{REST, CAFE, MIMT, GRIL} ∈ codes` | 0.10 | first present in that order, supports |
| gearRental | any option with `group == 'Equipment for rent'` (เช่าก่อนซื้อ) | 0.15 | that equipment code (first in code order), supports |

**Hard-access cap (BR-2, EC-3 region):** if `DRIV ∉ codes` AND any of `{BAOT, HIKE} ∈ codes` → clamp `score = min(score, 0.30)` AND append `{ref: the hard-access code, effect:'limits'}` (boat/hike-only strongly lowers beginner). EC-2 (drive-up but zero comfort) needs no special case: `driveUp` fires (0.35) while the comfort/food/gear slots stay 0 → `score 0.35`, `confidence ≈ 1/7 = 0.14 < 0.30` ⇒ `answerable:false` → the assistant names the gap, not a blanket "มือใหม่ไปได้". `confidence = firedSupportSlots / 7`.

### ROAD_ACCESS — special-cased single-dimension facet (proves AC-3/EC-3; the P13 honesty demo)
Reads the `Access type` group only. `hasDriv = DRIV ∈ codes`; `otherAccess = {BAOT,HIKE,WALK} ∩ codes`.
- **Drivable** (`hasDriv`): `score = 0.70` (a vehicle can reach it — deliberately NOT 1.00, since a sedan is not guaranteed). `evidence = [{ref:'DRIV', effect:'supports', note:'vehicle_class_unknown'}]`. `confidence = 0.50` (**capped**, BR-4 — `Access type` cannot distinguish sedan/pickup/4WD, schema-gap PREP-7). `answerable:true` — the assistant CAN answer, but the `note` tag + the 0.70/0.50 combo is the machine hook that drives the AC-3 hedge ("ขับรถเข้าถึงได้ แต่ยังไม่ระบุชัดว่ารถเก๋งเข้าได้แน่นอน"). The `note` is a stable CODE, never prose — the model phrases the caveat.
- **Not drivable** (`!hasDriv` AND `otherAccess` non-empty): `score = 0.15` (≤ 0.2, BR-3). `evidence =` the present access codes in order BAOT→HIKE→WALK, each `effect:'limits'`. `confidence = 0.50` (we know the access mode with certainty, still held ≤ the cap). `answerable:true` → the honest EC-3 answer "เข้าถึงได้ทางเรือ/เดินเท้าเท่านั้น รถเข้าไม่ได้".
- **No access codes at all:** evidence empty ⇒ **road_access absent** (AC-4 for the access question).

**Every produced score carries non-empty evidence (BR-5).** There is no "fake 0": a facet with nothing to stand on is absent, which is the honest "ข้อมูลไม่พอ" route, not a zero.

**Confirmation:** `__tests__/cam-464-facet-scores.test.ts` (pure, zero DB) — table-driven fixtures assert, per facet: the exact score/confidence/evidence for representative code-sets; `road_access` `confidence <= 0.50` for ALL inputs and a `note:'vehicle_class_unknown'` whenever `DRIV` present (BR-4/AC-3); every emitted score has `evidence.length >= 1` (BR-5); a camp with no matching codes emits NO facet for it (EC-1/EC-4); `family` clamps at 0.40 when `minimumAge >= 12`; identical input ⇒ deep-equal output (BR-6).

## D4 — EXPOSURE: additive `facets` on the existing getCampDetail result (backward-compatible)
**Decision:** extend `GetCampDetailResult` (the `ok:true` branch, `lib/ai/tools/get-camp-detail.ts`) with one field: `facets: FacetScore[]`. In `executeGetCampDetail`, after the existing `findFirst`, call `computeFacetScores({ options: campSite.options.map(o => ({code:o.code, group:o.group})), minimumAge: campSite.minimumAge })` and attach the result. **NO change to the Prisma `select`** — `options {code, group, …}` and `minimumAge` are ALREADY selected (CAM-449). **Zero added DB cost** (computed on already-fetched fields — not an N+1). This answers "[ลาน X] เหมาะครอบครัวไหม / มือใหม่ไปได้ไหม / รถเก๋งเข้าถึงไหม" with a per-facet score + evidence on the SAME tool the assistant already calls for a camp.

**Backward-compatible (api.md rule 12):** `facets` is a NEW field ADDED to the success union member; no existing field is removed or retyped. Existing consumers ignore it; the new capability reads it. The tool `description` gains one line naming the facets + the honesty rule (answer only from `evidence`; when a facet is absent or `answerable:false`, say "ข้อมูลไม่พอ"; for `road_access` never over-claim a sedan). **EC-6 needs no new guard** — `computeFacetScores` runs only after the existing `where:{ isPublished, isActive, deletedAt:null }` filter, so an unpublished/inactive/deleted camp already returns `{ok:false}` before any facet is computed (no new visibility path).

**A facet SEARCH filter (`searchCampsites`) is OUT OF SCOPE** — an explicit follow-up (story Out-of-scope). This story computes + exposes on the detail read only, keeping it atomic. **No new `getFacetEvidence` tool** either — the evidence rides inside `getCampDetail.facets` (ADR-009: one data path, not a second tool for the same camp).

**Confirmation:** the `getCampDetail` integration test asserts a fixture camp with known codes returns `facets` with the expected ids + non-empty evidence and that the field is additive (all pre-existing `ok:true` fields unchanged); a type test asserts `GetCampDetailResult` still satisfies every current consumer (no removed/retyped field).

## D5 — EVAL: P2 / P7 / P13 golden cases, bounded by the CAM-457 8-case ceiling
The grounding + no-hallucination assertions attach to the CAM-457 harness (`scripts/ai-eval/golden-cases.json`; `__tests__/cam-457-eval-harness.test.ts` pins `cases.length >= 6 && <= 8`). Target cases: **P2** "[ลาน X] เหมาะครอบครัวไหม" → answer names only real `family` evidence fields (AC-1); **P7** "มือใหม่ไปได้ไหม" → grounded `beginner` answer (AC-2); **P13** "รถเก๋งเข้าถึงไหม" → the hedged, confidence-capped `road_access` answer that never guarantees a sedan (AC-3), PLUS a **no-hallucination** case: a sparse camp → honest "ข้อมูลไม่พอ", no invented reason (AC-4). **8-case ceiling:** the fixture is capped at 8; if it is already at the ceiling, the P2/P7/P13 rows land in the SAME PR that bumps the `<= 8` assertion, or ride the owner-corpus follow-up (same constraint CAM-462 D5 recorded). The deterministic `cam-464-facet-scores` unit tests carry the real per-rule coverage regardless of the eval ceiling.

**Confirmation:** the golden rows (once added) assert the model's answer contains ONLY tokens traceable to the facet `evidence`; the harness gate stays green.

## D6 — Atomic · reversible · backward-compatible (confirmed)
- **Atomic:** ~1 new pure lib (`lib/facet-scores.ts`) + 1 additive field wire in `get-camp-detail.ts` + tests. Well under ~400 lines, single concern. **No migration.**
- **Reversible:** full rollback = delete `lib/facet-scores.ts`, drop the `facets` field + the `computeFacetScores` call, revert the tool-description line. No schema, no data, nothing to un-migrate.
- **Backward-compatible:** `facets` is an added optional-by-nature field on the `ok:true` result (D4); `ToolContext`, the tool registry, and every other tool are untouched.
- **No new ADR file required:** this decision is an APPLICATION of accepted ADRs — ADR-003 (closed set → engineering enum, D2), ADR-009 (no forked data path, D4), Atomic Framework §12 (compute-on-the-fly, D1) — and is trivially reversible, so it does not meet the "hard-to-reverse / cross-module" bar for a standalone ADR. The phase-2 promotion to a persisted `CampFacetScore` table WOULD warrant a new ADR at that time (superseding nothing; additive).

**Confirmation:** `npm run typecheck` proves no existing tool signature changed; the D1 migrate-diff proves no schema change; `git revert` of the single PR removes the capability cleanly.

## Links
`../../feature.md` (## Architecture overview) · `lib/listing-completeness.ts` (the pure-fn precedent) · `lib/facet-scores.ts` (new) · `lib/ai/tools/get-camp-detail.ts` (add `facets`, reuse existing select) · `prisma/schema.prisma` (CampSite `options`/`minimumAge` — read-only, no change) · `prisma/seed.ts` (MasterData codes) · `docs/research/ai-chat/campvibe-schema-gap-analysis.md` (PREP-7/PREP-8) · `docs/adr/ADR-003-enum-vs-masterdata.md` · `docs/adr/ADR-009-ai-assistant-data-architecture.md` · `story.md`

## Changelog
- v1 (2026-07-24) — created; G2 Technical. Six decisions: (D1) compute-on-read pure `computeFacetScores` in `lib/facet-scores.ts`, NO table/NO migration, `CampFacetScore` deferred to phase-2 mining/host-input; (D2) `FacetId` TS string-union enum (ADR-003), v1 = family/beginner/road_access, photo/pet_detail deferred; (D3) concrete per-facet weight-table rule contract with mandatory evidence, confidence = firedSlots/total, road_access capped ≤ 0.50 + `vehicle_class_unknown` note (P13 honesty); (D4) additive `facets: FacetScore[]` on getCampDetail, no select change, backward-compatible, search-filter out of scope; (D5) P2/P7/P13 golden cases under the CAM-457 8-case ceiling; (D6) atomic/reversible/backward-compatible, no new ADR (applies ADR-003/009 + Atomic §12). No open clarification markers.
