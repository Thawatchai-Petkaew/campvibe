---
linear: CAM-404
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-18
class: spec-lite
---
# AI search resolves Thai province names to stored English values (CAM-404)

## Story
As a **Camper**, I want the AI chat search to find camps when I type a Thai province name, so that asking "แคมป์ในเชียงใหม่" returns real results instead of an empty list.
Why: real-smoke defect — `Location.province` is stored in English (e.g. "Chiang Mai", 18 camps), the model emits the Thai province name it was given, `searchCampsites` does an exact match, so the search returns 0 results forever.
Scope: fix `lib/ai/tools/search-campsites.ts` only — resolve a Thai `province` arg via the existing `ThailandLocation` table before the where-clause is built. No schema change, no UI change.
Depends on: CAM-270 (`searchCampsites` tool, shipped) · CAM-271/272 (chat endpoint + UI, shipped).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper asks the AI chat about a mapped Thai province, e.g. `เชียงใหม่` | The model calls `searchCampsites` with `province: "เชียงใหม่"` | Real matching camp cards appear in the chat (no changed copy — reuses the existing card render) | The Thai value resolves to `Location.province`'s stored English value (`Chiang Mai`) via `ThailandLocation` before the query runs; matching camps are returned | EC-1 |
| AC-2 | The camper asks about a Thai province name not covered by the `ThailandLocation` table (partial ~12-province coverage) | The model calls `searchCampsites` with that Thai value | — (unchanged; same empty-result state as before this fix, CAM-272) | The raw Thai value passes through unchanged (same as prior behavior for an unmapped value); no crash | EC-2 |
| AC-3 | The model calls `searchCampsites` with an English province, e.g. `"Chiang Mai"` | The tool resolves the province arg | — (unchanged; existing behavior) | The English value is used unchanged; no `ThailandLocation` lookup is made | — (this row IS the passthrough case) |

## Rules
- BR-1 A `province` arg containing any Thai character is looked up in `ThailandLocation` (`provinceName` contains the value, which also covers an exact match) and substituted with `provinceNameEn` when a row matches. (proves AC-1)
- BR-2 A `province` arg with no Thai character is used unchanged, with no `ThailandLocation` query (no wasted DB round-trip on the already-correct English path). (proves AC-3)
- BR-3 A Thai `province` with no matching row, or a `ThailandLocation` lookup error, falls back to the raw value unchanged — the tool never throws. (proves AC-2, EC-1, EC-2)

## Edge cases
- EC-1 IF the `ThailandLocation` lookup throws (DB error) THEN fall back to the raw province value unchanged, no throw propagates to the caller (BR-3)
- EC-2 IF no `ThailandLocation` row matches the Thai province THEN fall back to the raw value unchanged (same result as before this fix) (BR-3)

## Data
- No schema change, no migration. Reads the existing `ThailandLocation` table (`provinceName` ↔ `provinceNameEn`) that CAM-270/CAM-271/CAM-272 already ship with. `Location.province` itself is untouched.

## Seams & refs
- Reuse: `lib/ai/tools/search-campsites.ts` (`executeSearchCampsites`, the only caller of `buildCampSiteWhere` in the AI tool layer) · `prisma/schema.prisma` `ThailandLocation` (existing model, no change). No other reader/writer of `Location.province` is touched by this fix — the resolve happens only at the AI tool's input boundary, before `buildCampSiteWhere` is called; every other `buildCampSiteWhere` caller (catalog list/count) is unaffected (NO-CHANGE).
- Refs: CAM-270 story (`searchCampsites` origin) · ADR-009 (AI tool layer, no forked data path).

## Out of scope
- Expanding `ThailandLocation` coverage beyond the ~12 seeded provinces → follow-up ticket if the gap recurs in smoke.
- District-level Thai resolution (this fix is province-only, matching the tool's existing `province` arg) → not requested.

## Self-verify
- AC-1 → unit (Thai province resolves via mocked `thailandLocation.findFirst` → English value reaches `buildCampSiteWhere`; Prove-It: red before the fix, green after)
- AC-2 → unit (unmapped Thai province + lookup error → raw value passthrough, no throw)
- AC-3 → unit (English province → no `thailandLocation` lookup fired, value unchanged)
- Story-specific: full existing `cam-270-search-campsites` suite re-run unmodified and green (no regression to the existing tool contract)
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost (dev DB)

## Changelog
- v1 (2026-07-18) — created (spec-lite, real-smoke defect fix; G1 folds into the G3 packet per gate policy v2)
