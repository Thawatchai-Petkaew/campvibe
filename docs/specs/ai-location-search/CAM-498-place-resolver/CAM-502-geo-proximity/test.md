---
linear: CAM-502
feature: ai-location-search
epic: CAM-498
persona: Camper
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-07-25
---
# Test — P2 Geo proximity: "ใกล้/แถว X" returns camps near a province (CAM-502)

## AC→test matrix
<!-- risk = H/M/L; type mix ≈ 70% unit / 20% integration / 10% e2e -->
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (ใกล้X → near, sorted nearest-first, honest scope) | H | unit | `__tests__/cam-502-geo-proximity.test.ts`, `__tests__/cam-457-eval-harness.test.ts` (GEO-1), `__tests__/cam-459-answer-policy-3-zones.test.ts` | ✅ |
| AC-2 (ใกล้X + terrain, AND not OR) | H | unit | `__tests__/cam-502-geo-proximity.test.ts` (`[BR-2 AND terrain]`) | ✅ |
| AC-3 (ในX exact stays province, not near) | H | unit | `__tests__/cam-502-geo-proximity.test.ts` (`[AC-3]`), GEO-2 golden case | ✅ |
| AC-4 (0 camps in radius → honest empty, never mislabel) | H | unit | `__tests__/cam-502-geo-proximity.test.ts` (`[AC-4]`) | ✅ |
| BR-1 (centroid build: deterministic mean, sparse guard) | H | unit | `__tests__/cam-502-geo-proximity.test.ts` (`computeCentroids` block) | ✅ |
| BR-2 (bbox + haversine ascending + MAX_NEAR_KM cap + candidate cap) | H | unit | `__tests__/cam-502-geo-proximity.test.ts` (`executeSearchCampsites — near-path`) | ✅ |
| BR-3 (resolvePlace proximity-vs-exact split + DEF-1 guard under proximity) | H | unit | `__tests__/cam-502-geo-proximity.test.ts` (`resolvePlace` block, incl. QA-added DEF-1×proximity regressions) | ✅ |
| BR-4 (honest-scope answer wording extended to near/0-result) | M | unit (prompt-text assertion in `lib/ai/openrouter-client.ts` diff; no dedicated test file — reviewed by QA, reused CAM-501 pattern) | — | ✅ (reviewed, no new test needed — string only) |
| BR-5 (no landmark, no PostGIS/external geocoding, no Home UI change) | L | n/a (scope check via diff review) | — | ✅ (diff scope verified) |
| EC-1 (near w/ centroid → sort asc, includes in-province camps) | H | unit | `__tests__/cam-502-geo-proximity.test.ts` (`[BR-2]` sort test) | ✅ |
| EC-2 (near w/ sparse/unknown centroid → exact fallback, no crash) | H | unit | `__tests__/cam-502-geo-proximity.test.ts` (`[EC-2]`) | ✅ |
| EC-3 (near + province both set → near wins) | M | unit | `__tests__/cam-502-geo-proximity.test.ts` (`[EC-3]`) | ✅ |
| EC-4 (candidate cap before haversine, CAM-344) | H | unit | `__tests__/cam-502-geo-proximity.test.ts` (`take: NEAR_CANDIDATE_CAP` assertion) | ✅ |
| EC-5 ("ใกล้ฉัน/แถวนี้" no province → out of scope P2, no near set) | M | unit | `__tests__/cam-502-geo-proximity.test.ts` (`[edge]` no-place case) + QA probe (`ใกล้ฉันหน่อย`, `แถวนี้มีไหม` → `{}`, not committed as separate cases, covered by the existing no-place edge test's assertion shape) | ✅ |

## Validation cases
- **No new false-match (DEF-1 lesson, priority check):** QA reproduced the exact CAM-501-DEF-1 defect class (ambiguous province names ตาก/เลย/น่าน/ตราด/แพร่/ตรัง/ยะลา colliding with ordinary vocabulary) specifically under the NEW proximity code path. `detectProvince` is called unconditionally on every `resolvePlace` path (no separate/looser proximity matcher), so the existing `AMBIGUOUS_PROVINCE_NAMES_TH` skip-set applies identically. Added 3 permanent regression tests (`ไปตากผ้าใกล้ๆ บ้าน`, `เยอะเลยแถวนี้`, `แถวน่านน้ำ` → all `{}`), proven **red** (guard temporarily bypassed locally, never committed) → **green** (guard restored, byte-identical to backend's diff).
- Additional QA probes (not committed, transient) that returned `{}` correctly with no source change: `อยากได้ที่ใกล้ๆ ธรรมชาติ`, `แถวนี้มีไหม`, `ค่ายลูกเสือแถวๆ ร่มรื่น`, `ใกล้ฉันหน่อย`, `มีลานแถวย่านนี้ไหม`, `อยากไปแคมป์ริมน้ำใกล้ๆ` (terrain-only, no province → correctly unresolved).
- **near-vs-exact split:** `resolvePlace('ลานกางเต็นท์ใกล้กรุงเทพ')` → `{ near: 'กรุงเทพ' }`; `resolvePlace('ในกรุงเทพ')` → `{}` (P1 exact path fires downstream, unchanged); golden cases GEO-1/GEO-2 pin the same split at the tool-call level (`near:"กรุงเทพ"` vs `province:"Bangkok"`).
- **Geo path correctness:** bbox is a true rectangular superset of the radius circle (`bboxForRadius` real-math test); haversine sort confirmed ascending via out-of-order mock fixtures (candidate query AND card-fetch query both returned scrambled, result re-sorted correctly); MAX_NEAR_KM=250 cap drops a 300km-away candidate the bbox rectangle would have admitted; `NEAR_CANDIDATE_CAP=500` applied as Prisma `take` on the candidate query, before the sort; sparse/unknown centroid falls back to exact-province filter with no bbox clause; near+terrain is AND (both clauses present in the same `where.AND`); 0-in-radius → `{ cards: [] }` with only ONE query executed (no wasted card-fetch).
- **ADR-009 compliance:** bbox pushed onto `buildCampSiteWhere`'s own `where.AND` output (verified in diff review) — not a forked where-builder or a parallel query path.
- **Centroid build (BR-1):** `computeCentroids` (pure function) proven deterministic — same rows in shuffled order → byte-identical JSON; output keys sorted independent of input order; sparse guard omits provinces with <2 camps (boundary: exactly 2 → included); missing/non-finite lat/lng/province rows excluded, never coerced to 0,0. The committed `prisma/data/province-centroids.json` has all 77 provinces, min `campCount`=3 (no sparse province in real data today, guard logic present and unit-tested with fixtures regardless). Full DB-backed `main()` rerun for byte-identical-determinism **not measured** in this QA sandbox (no `DATABASE_URL` available in the worktree) — the load-bearing determinism claim is proven at the pure-function level instead, which is what BR-1 actually requires reruns to preserve.
- **.gitignore:** narrow allow-list entry `!/scripts/build-province-centroids.mjs`, same shape/comment style as the existing `reconcile-ratings.mjs`/`parity-check.mjs` precedents — inspected, no unintended un-ignoring.
- **Two ceilings:** both `__tests__/cam-457-eval-harness.test.ts` and `__tests__/cam-459-answer-policy-3-zones.test.ts` updated 56→58 consistently, matching the +2 GEO-1/GEO-2 golden cases added.

## Coverage
Scoped v8 coverage on the 3 touched implementation files (`lib/ai/place-resolver.ts`, `lib/ai/tools/search-campsites.ts`, `scripts/build-province-centroids.mjs`), measured via `npx vitest run __tests__/cam-502-geo-proximity.test.ts __tests__/cam-501-place-resolver.test.ts --coverage`:
- **85.25% statements / 80.72% branches / 80.64% functions / 84.96% lines** — real run, above the 80% floor.
- `lib/ai/place-resolver.ts`: 97.72% stmts / 95.83% branch.
- `lib/ai/tools/search-campsites.ts`: 87.5% stmts / 70.73% branch (uncovered lines are the pre-existing remaining-capacity block + the tool's `execute` wrapper, exercised by other test files not in this scoped run, e.g. cam-427/cam-417).
- `scripts/build-province-centroids.mjs`: 67.5% stmts — uncovered lines are the DB-calling `main()` function only; `computeCentroids` (the pure, load-bearing logic per BR-1) is fully exercised.

## Links
`docs/specs/ai-location-search/CAM-498-place-resolver/CAM-502-geo-proximity/story.md` (AC/BR) · `.claude/rules/qa.md`

## Changelog
- v1 (2026-07-25) — created (QA verify pass, no defects found)
