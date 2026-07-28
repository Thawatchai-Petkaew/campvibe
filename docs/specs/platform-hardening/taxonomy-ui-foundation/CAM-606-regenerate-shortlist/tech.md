---
linear: CAM-606
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — Regenerate the tambon shortlist (CAM-606)

## Data model
No new entity/field, no migration. `prisma/data/subdistrict-shortlist.json` regenerated in place, same shape CAM-600 defined: `{ nameTh: string; districtNameTh: string; provinceNameTh: string }[]`. 422 → 503 raw rows.

## What actually ran (no new mechanism — reused verbatim)
1. `node --require dotenv/config scripts/check-subdistrict-shortlist-drift.mjs` (before regenerating) → `MISSED — 74 sub-district(s)`, 0 removed. Matches the ticket's measured numbers exactly (795 camps / 503 camp-holding sub-districts / 422 committed / 74 to add / 0 to remove).
2. `node --require dotenv/config scripts/generate-subdistrict-shortlist.mjs` → wrote 503 rows. Neither script was edited; `--require dotenv/config` is the only deviation from the documented usage (`source .env` first), needed because this environment's sandbox refuses a bare `source` invocation for a worktree-isolated agent — `dotenv/config` is an existing devDependency, achieves the identical `process.env.DATABASE_URL` result, and touches neither script.
3. `node --require dotenv/config scripts/check-subdistrict-shortlist-drift.mjs` (after regenerating) → `OK — 0 drift. The committed shortlist (503 raw rows) still matches the live, guard-surviving fact.`
4. `git diff --stat prisma/data/subdistrict-shortlist.json` → 405 insertions, 0 deletions (pure addition, no row removed) — confirms BR-2/AC-1 independently of the drift check's own report.

## Reconciling the two different "how many" numbers (read before trusting either alone)
Raw file rows: 422 → 503 (+81 raw rows, 0 removed — a plain line-count fact from the file itself). Of those 81 raw rows, 2 pairs (นาบัว, บางเตย) are a SECOND entry for a name that is now newly-shortlisted in a second province — so 79 of the 81 raw rows are unique new names. Running `computeDrift` (the exact function `check-subdistrict-shortlist-drift.mjs` uses) between the pre- and post-regeneration files reports 74 added / 0 removed — the guard-filtered subset of those 79 unique names (i.e. after excluding anything shorter than 5 Thai characters, in the ordinary-vocabulary skip-set, or a substring of any real province). All three numbers (81 raw, 79 unique, 74 guard-surviving) are real, mutually consistent (74 ⊆ 79 ⊆ 81), and independently reproduced here (see `git diff` scratch reconciliation, not committed — the two counts that matter for this story's ACs are the drift check's own 74/0 and the file's own 422→503).

## Behavioral verification (the actual point of this story)

### 1. Three newly-added tambons — resolve AND return the camp that qualified them
Verified by direct script (not committed as a test — `executeSearchCampsites` is DB-backed, and `resolvePlace`'s own test suite for this module has always stayed DB-free; the pairing itself IS committed in `__tests__/cam-606-regenerated-shortlist.test.ts`):

| Text | `resolvePlace` | `executeSearchCampsites({subDistrict, district})` |
|---|---|---|
| `ลานกางเต็นท์เขาฉกรรจ์` | `{subDistrict: "เขาฉกรรจ์", district: "เขาฉกรรจ์"}` | 1 card: "ชายป่าอนุรักษ์สระแก้ว" |
| `ลานกางเต็นท์ป่าตอง` | `{subDistrict: "ป่าตอง", district: "กะทู้"}` | 1 card: "ลานกางเต็นท์หาดป่าตอง" |
| `ลานกางเต็นท์วารินชำราบ` | `{subDistrict: "วารินชำราบ", district: "วารินชำราบ"}` | 1 card: "ริมแม่น้ำสายหลักอุบลราชธานี" |

Each card is exactly the camp whose existence made that tambon qualify for the shortlist in the first place (`computeLiveShortlistEntries`'s own definition: `locations: { some: { campSites: { some: { isActive: true, deletedAt: null } } } }`) — the loop closes: regenerate → detect → search → real camp.

### 2. The six CAM-600 negative cases, re-run against the larger (503, was 422) list — reported individually, verbatim
The list grew ~19% (422→503); this is exactly where a guard set gets tested for real, not in theory.

| Text | `resolvePlace` result |
|---|---|
| `ลานกางเต็นท์ริมถนน` | `{}` |
| `ลานกางเต็นท์ใกล้ตลาด` | `{}` |
| `ลานกางเต็นท์ริมบ่อ` | `{}` |
| `ลานกางเต็นท์ทางเหนือ` | `{}` |
| `ลานกางเต็นท์ที่สะอาด` | `{}` |
| `ลานกางเต็นท์บรรยากาศสำราญ` | `{}` |

All six still resolve to nothing. `ถนน`/`ตลาด`/`บ่อ` are excluded by the unchanged 5-character length floor; `เหนือ`/`สะอาด`/`สำราญ` are excluded by the unchanged `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` skip-set. Both guards are read-only in this story — this result is the guards continuing to work at a larger N, not a new behavior.

### 3. Siblings unchanged
| Text | Result |
|---|---|
| `ลานกางเต็นท์แม่ริม` | `{district: "แม่ริม"}` |
| `แคมป์ที่อำเภอปาย` | `{district: "ปาย"}` |
| `ลานกางเต็นท์เชียงใหม่` | `{province: "Chiang Mai"}` |
| `ลานกางเต็นท์ใกล้เขาใหญ่` | `{near: "เขาใหญ่", nearIsLandmark: true}` |

All four match their pre-regeneration values exactly (CAM-596/599/503 fixtures, unchanged).

## Collision-risk inspection of all ~81 newly-added raw names (not just the 74 that already survive guards)
Every new name was read by hand and additionally programmatically checked for length and guard-survival (`survivesGuards`, unmodified, imported from the check script — never re-derived). Findings:

- **Filtered out already, correctly, by the existing guards (3 names, not shipped as live candidates):** `เว่อ` (below the 5-character floor), `อ่างทอง` (a real province's own name — `isSubstringOfAnyProvince`), `บุดี` (below the floor). These prove the substring-of-province and length guards are still doing real work at this size, not just historically.
- **The one finding worth naming explicitly: "ตำนาน"** ("legend"/"myth" — ordinary Thai vocabulary), a real, newly-shortlisted sub-district (เมืองพัทลุง district, Phatthalung). It is exactly 5 Thai characters — the length floor excludes `< 5`, so 5 survives — and it is NOT a member of `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` (which today curates only เหนือ/สะอาด/สำราญ). This is the identical guard-gap SHAPE CAM-600's own docblock already names for สะอาด/สำราญ (a common word landing exactly on the floor) — just a noun instead of an adjective, and not yet in the skip-set because it did not exist in the 422-row list CAM-600 authored against. Measured, not asserted: `resolvePlace('อยากได้เต็นท์รุ่นตำนาน')` → `{subDistrict: "ตำนาน", district: "เมืองพัทลุง"}`, and `resolvePlace('ลานกางเต็นท์ในตำนาน')` → the same — an entirely ordinary phrase about an "iconic/legendary" tent gets hinted toward a real place in Phatthalung. Both are committed as documented-finding tests in `__tests__/cam-606-regenerated-shortlist.test.ts` (asserting today's ACTUAL behavior, not the desired one) so this is visible to the next reader rather than rediscovered. **Not fixed here** — `lib/ai/place-resolver.ts` and its guard constants are out of this story's file surface, and the ticket explicitly asks that a guard gap be reported, not patched under this ticket. Recommended follow-up: add `ตำนาน` to `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` in a dedicated CAM-600-following story (a one-line addition, same shape as the existing three entries).
- **Reviewed and judged safe** — the other 73 guard-surviving names (e.g. `เขาดิน`, `บ้านนา`, `ป่าตอง`, `หนองแก`, `นาพละ`, `ไร่รถ`, `ขะยูง`, `ช่อแฮ`) are place-name-shaped compounds (a generic-word + place-word pattern, or a proper-noun-only construction) rather than a single ordinary noun/adjective a camper would use in unrelated conversation. `บ้านนา` ("house" + "rice field") was the closest second case considered — judged lower-risk than `ตำนาน` because it functions overwhelmingly as a place-name pattern in Thai rather than a stand-alone descriptive phrase, but it is named here for completeness in case a future eval surfaces a real miss.
- Two names collide within the shortlist itself (`นาบัว` × 2 provinces, `บางเตย` × 2 provinces) — both go through the SAME, unmodified `resolveAmbiguousSubDistrictEntry` scoping CAM-600 already ships (a bare, unscoped mention falls through rather than guessing); not a new risk class, the identical mechanism already proven for `ในเมือง`/`บ้านแหลม`.

## No regression in the guard set at the larger size
Per the ticket's explicit instruction: if the larger list broke a negative case or a sibling, that would be reported as a finding for a follow-up story (CAM-600's guard set insufficient at this size), not patched here. None of the six negative cases or four siblings regressed — the one real gap found (`ตำนาน`) is a genuinely NEW case (it did not exist in the 422-row list CAM-600 authored and tested against), not a break of an existing, previously-passing guarantee.

## Self-verify commands run
`npx vitest run __tests__/cam-606-*` (15/15 pass) · `node --require dotenv/config scripts/check-subdistrict-shortlist-drift.mjs` (0 drift) · `npm run typecheck` · `npm run lint` · full `npx vitest run` (last act, per dispatch).

## Links
`scripts/generate-subdistrict-shortlist.mjs` (unmodified) · `scripts/check-subdistrict-shortlist-drift.mjs` (unmodified) · `lib/ai/place-resolver.ts` (read-only reference) · `lib/ai/tools/search-campsites.ts` (read-only, `executeSearchCampsites`) · `prisma/data/subdistrict-shortlist.json` · `../CAM-600-tambon-shortlist/tech.md` · `../CAM-605-shortlist-staleness/tech.md` · `story.md`.

## Changelog
- v1 (2026-07-28) — created; documents the regeneration run, the raw-vs-guard-filtered count reconciliation (81/79/74), the full behavioral verification (3 new tambons + camps, 6 negatives, 4 siblings), and the one named collision-risk finding (`ตำนาน`) with a recommended one-line follow-up.
