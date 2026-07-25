---
linear: CAM-503
feature: ai-location-search
epic: CAM-498
persona: Camper
artifact: test
owner: qa-engineer
status: blocked
version: v1
updated: 2026-07-25
---
# Test — P3 Landmark search: parks/areas (เขาใหญ่/ปาย) → curated gazetteer + geo radius (CAM-503, closes epic)

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (landmark bare name → gazetteer near, sorted nearest-first) | H | unit | `__tests__/cam-503-landmark.test.ts` (`[AC-1]`), GEO-3 golden case | ✅ (but see DEFECT below — same detector) |
| AC-2 (landmark + terrain → AND) | H | unit | `__tests__/cam-503-landmark.test.ts` (`[AC-2]`, `[EC-3]`) | ✅ |
| AC-3 (landmark not in gazetteer → keyword fallback, honest) | M | unit (resolver) + prompt-text review (BR-4 wording) | `__tests__/cam-503-landmark.test.ts` (`[AC-3/BR-4 territory]`) + `lib/ai/openrouter-client.ts` diff review | ✅ (reasoned; no live-AI call — cost-gated, orchestrator step) |
| AC-4 (0 camps in landmark radius → honest empty, never mislabel) | H | unit | `__tests__/cam-503-landmark.test.ts` (`[AC-4]`) | ✅ |
| BR-1 (gazetteer: ≥20 entries, unique ids, Thailand-bbox, radiusKm>0) | H | unit | `__tests__/cam-503-landmark.test.ts` (`validateGazetteer` block) + `node scripts/validate-landmark-gazetteer.mjs` | ✅ 25/25, 0 violations |
| BR-2 (resolver landmark detection + DEF-1-style guard) | H | unit | `__tests__/cam-503-landmark.test.ts` (`resolvePlace` block) | **❌ DEFECT — see below** |
| BR-3 (near-path: landmark-gazetteer-first, then province-centroid, own radius, no fork) | H | unit | `__tests__/cam-503-landmark.test.ts` (`executeSearchCampsites` block) | ✅ |
| BR-4 (unknown landmark → keyword fallback guidance) | M | prompt-text review | `lib/ai/openrouter-client.ts` diff (new system-prompt line) | ✅ (reasoned) |
| BR-5 (no PostGIS/geocoding/dep, no Home UI touch) | L | diff-scope review | `git diff origin/dev --stat` | ✅ |
| EC-1 (landmark spans multiple provinces → geo radius, not province filter) | H | unit | `__tests__/cam-503-landmark.test.ts` (`[EC-1]`) | ✅ |
| EC-2 (landmark name collides with ordinary Thai vocabulary) | H | unit | `__tests__/cam-503-landmark.test.ts` (curated-ambiguous `ปาย` guard) + **QA DEFECT block (เขาใหญ่ itself, NOT guarded)** | **❌ DEFECT — see below** |
| EC-3 (landmark + terrain → AND) | M | unit | `__tests__/cam-503-landmark.test.ts` | ✅ |
| EC-4 (gazetteer alias overlap with a province → landmark precedence) | M | unit | `__tests__/cam-503-landmark.test.ts` (`[EC-4]`) | ✅ |
| Two golden ceilings (cam-457 + cam-459, 58→59) | M | unit | `__tests__/cam-457-eval-harness.test.ts`, `__tests__/cam-459-answer-policy-3-zones.test.ts` | ✅ both updated |

## Validation cases

**No-new-false-match probes (priority check, DEF-1 lesson):**
- `"อยากไปเที่ยวปายๆ กับเพื่อน"` (slangy "ปาย") → `{}` — holds, correctly unguarded.
- `"แคมป์สงบๆ"` (ordinary adjective, no place) → `{}` — holds.
- **`"เขาใหญ่กว่าฉันเยอะเลย"` / `"พี่เขาใหญ่โตในวงการนี้จริงๆ"` / `"น้องบอกว่าเขาใหญ่ไปหน่อยสำหรับงานนี้"` / `"แฟนเขาใหญ่กว่าฉันเยอะ"` — ALL false-match `near:"เขาใหญ่", nearIsLandmark:true`.** "เขาใหญ่" (the story's own flagship/AC-1 example) is simultaneously the ordinary pronoun "เขา" (he/she/they) + the ordinary adjective "ใหญ่" (big) — an everyday Thai collocation describing a PERSON, not a place ("he's bigger than me", "that person is prominent in this industry"). Unlike "ปาย" (correctly curated into `AMBIGUOUS_LANDMARK_NAMES_TH`), "เขาใหญ่" carries NO guard at all — this is the exact CAM-501-DEF-1 false-match class, reintroduced on this story's own headline example, at a materially HIGHER real-world collision rate than any already-guarded province name.
- **`"เขาหลักฐานชัดเจนมาก"`** (เขา + หลักฐาน="evidence") also false-matches `near:"เขาหลัก"` (Khao Lak) — the "substring hides inside another word" risk class, confirmed on a second gazetteer entry.
- 4 permanent regression tests added to `__tests__/cam-503-landmark.test.ts`, proven **RED** against the current implementation (Prove-It) — filed as a defect sub-ticket (see QA return `defects[0]`). A 5th pinned test confirms the camping-context AC-1 example (`"ลานกางเต็นท์เขาใหญ่"`) must stay green once a fix lands.
- "ปาย"/"ลานกางเต็นท์ปาย" bare mentions correctly return `{}` (guarded, as designed) — but this ALSO means the Story's own motivating example ("แคมป์ปาย" → "camps around that famous spot") degrades to BR-4's model-driven `keyword` fallback rather than the gazetteer radius search, for the SAME reason the story's own "Why" section criticizes keyword-only recall for เขาใหญ่. Not filed as a separate defect (mirrors the already owner-accepted CAM-501-DEF-1 tradeoff and is explicitly tested/documented behavior), but flagged for the record — the end-to-end keyword-fallback quality for "ปาย" is untestable here (no live AI call, per dispatch).

**Gazetteer validity (BR-1):** `node scripts/validate-landmark-gazetteer.mjs` → "OK — 25 entries, 0 violations". All 25 lat/lng within Thailand's real bbox; unique ids; radiusKm > 0; kind ∈ {park, mountain, town, area}. Spot-checked: เขาใหญ่ (14.4409, 101.3728) ≈ 14.4,101.4 ✓; ปาย (19.3583, 98.4358) ≈ 19.4,98.4 ✓; ดอยอินทนนท์ (18.5896, 98.4867) ≈ 18.6,98.5 ✓ — all match real-world coordinates.

**near-path landmark source (BR-3, no fork):** confirmed via mocked-Prisma tests — `near="เขาใหญ่"` resolves with ZERO `ThailandLocation` DB round-trip (gazetteer hit short-circuits the province path); uses the landmark's OWN `radiusKm` (40), not `MAX_NEAR_KM` (250) — a candidate at 60km (beyond 40, within 250) is correctly dropped; haversine-ascending sort proven with out-of-order mock rows; terrain AND (not OR) confirmed; honest empty (`{cards:[]}`, one query only) when 0 candidates in radius. A `near` naming a real province (e.g. `"Bangkok"`) or an unknown value falls through unbroken to the existing P2 province-centroid / exact-filter paths (regression-proven, unaffected).

**Keyword fallback (BR-4):** system-prompt addition reviewed verbatim — for a landmark NOT confirmed by a place hint, instructs the model to pass `keyword` (never guess `near`/`province`) and report honestly on zero matches. Reasoned against the diff only; the live-model behavioral reproduction is explicitly out of QA's self-verify budget per the dispatch (orchestrator step, real AI cost).

**Golden GEO-3:** `"ลานกางเต็นท์เขาใหญ่"` → `searchCampsites{near:"เขาใหญ่"}`, schema-valid, added to `scripts/ai-eval/golden-cases.json`. Both `__tests__/cam-457-eval-harness.test.ts` (58→59) and `__tests__/cam-459-answer-policy-3-zones.test.ts` (58→59) ceilings updated — verified neither is stale.

## Coverage
Scoped v8 coverage on the story's touched implementation files (`npx vitest run __tests__/cam-503-landmark.test.ts __tests__/cam-501-place-resolver.test.ts __tests__/cam-502-geo-proximity.test.ts --coverage --coverage.reportOnFailure=true`, real run, forced to report despite the intentional Prove-It red state):
- `lib/ai/place-resolver.ts`: **98.43% stmts / 96.87% branch** — the new landmark-detection code is exercised almost completely (one uncovered line is an unreachable defensive branch).
- `lib/ai/tools/search-campsites.ts`: **88.63% stmts / 72.34% branch** (uncovered lines are pre-existing remaining-capacity/execute-wrapper code, exercised by other suites, not new to this story).
- `scripts/validate-landmark-gazetteer.mjs`: 62.22% stmts — uncovered lines are the CLI `main()`/file-read wrapper; the pure `validateGazetteer` logic (load-bearing per BR-1) is fully exercised.
- All new-code files clear the 80% floor except the CLI wrapper lines in the validator script, which is intentionally thin glue around the tested pure function.

## Coverage matrix note
EC-2 (ambiguous-name collision) carries a normal case (guarded "ปาย" → `{}`) but its error/adversarial bucket surfaced a live defect on the UNGUARDED "เขาใหญ่" — see defect below. All other AC buckets (normal/null-empty/boundary/error/concurrent-N/A for this pure-function+mocked-Prisma surface) are covered per the matrix above.

## Defect (blocks Done)
**Severity: Important.** `resolvePlace`'s landmark detector free-text-scans for "เขาใหญ่" (and every other unguarded gazetteer entry) as a plain substring with NO context/boundary guard, unlike the already-curated `AMBIGUOUS_LANDMARK_NAMES_TH` set (which currently contains only "ปาย"). "เขาใหญ่" = เขา (pronoun "he/she/they") + ใหญ่ (adjective "big") is ordinary, high-frequency conversational Thai describing a PERSON — reproduced with 4 natural sentences, all false-matching the landmark with `nearIsLandmark:true`, which becomes a MANDATORY hint forcing the model to call `searchCampsites({near:"เขาใหญ่"})` on an unrelated turn (e.g. a camper commenting a friend "is prominent" gets redirected to Khao Yai camp results). A second gazetteer entry ("เขาหลัก" / Khao Lak) shows the same "substring hides inside another word" risk (`"เขาหลักฐาน"` = เขา+หลักฐาน "evidence"). Failing AC: EC-2 / BR-2 (false-match guard). Reproduction: `resolvePlace('แฟนเขาใหญ่กว่าฉันเยอะ')` currently returns `{near:'เขาใหญ่', nearIsLandmark:true}`, expected `{}`. 4 pinned regression tests in `__tests__/cam-503-landmark.test.ts` (RED, Prove-It) + a 5th pinned green test confirming the camping-context AC-1 phrasing must stay unaffected by any fix.

## Links
`docs/specs/ai-location-search/CAM-498-place-resolver/CAM-503-landmark/story.md` (AC/BR) · `.claude/rules/qa.md` · defect: see QA return `defects[0]` (CAM-503 sub-ticket, opened by orchestrator)

## Changelog
- v1 (2026-07-25) — created; QA verify pass found a real, high-priority false-match defect on the story's own flagship landmark ("เขาใหญ่" collides with the ordinary pronoun+adjective "he is big"); added 5 pinned regression tests (4 red, 1 green) as the Prove-It guard for the fix. Cleaned up 1 pre-existing dead-import lint warning in the story's own new test file (non-blocking, fixed directly).
