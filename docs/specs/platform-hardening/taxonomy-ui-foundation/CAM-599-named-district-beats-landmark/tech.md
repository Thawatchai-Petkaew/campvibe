---
linear: CAM-599
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — A named district beats a landmark radius (CAM-599)

## Data model
No new entity/field. Reuses `prisma/data/thailand-locations.json` — the exact same static gazetteer `lib/ai/place-resolver.ts` already imports and scans for province/district detection (CAM-501/CAM-596). No new DB query, no change to `AdminArea`/`matchAdminArea` (CAM-566/CAM-587), which stay the proven-correct resolution layer this pre-pass only hints toward.

## The one precedence rule (reconciles with CAM-596's own note)
`resolvePlace`'s dispatch order, in full, after this story:

```
detectExplicitDistrictPrefix(text)?  -> NEW (CAM-599): { district: nameTh },
                                         PLUS an accompanying province: detectProvince(text) result,
                                         if the SAME message also names one — an "อำเภอ"/"อ." marker
                                         in front of a real district name, checked FIRST (even before
                                         the landmark check below)
detectLandmark(text)?                -> unchanged (near + nearIsLandmark) — still the answer for a
                                         BARE landmark mention with no explicit marker (CAM-503's
                                         reasoning holds: a landmark can span multiple provinces)
isBareBangkokMention(text)?          -> unchanged (near or province)
detectDistrict(text)?                -> unchanged (CAM-596): { district: nameTh }, no marker required,
                                         still runs AFTER the landmark check (a marker-less district
                                         name never overrides a landmark match)
detectProvince(text)?                -> unchanged (province, or near if a proximity marker is present)
detectRegion(text)?                  -> unchanged (region)
else {}                              -> unchanged
```

This is the SAME text that must now also live in CAM-596's own tech.md (updated in this PR) so the two documents describe one system, not two. CAM-596's tech.md previously stated the dispatch order started at the landmark check; it now states the new first step and cross-references this file.

## Why a NEW candidate list, not a relaxed `detectDistrict`
`detectDistrict` (CAM-596) and `detectExplicitDistrictPrefix` (CAM-599) are two separate functions over two separate candidate lists, not one function with a flag, because their SAFETY ARGUMENT is different in kind, not just degree:

- `detectDistrict`'s candidates survive four guards (length floor, curated ambiguous-name set, substring-of-any-province, "เมือง"+own-province pattern) precisely because the BARE name carries no other signal — the guards are a stand-in for missing context.
- `detectExplicitDistrictPrefix`'s candidates skip the first three of those guards ON PURPOSE: the "อำเภอ"/"อ." marker in the text IS the context those guards exist to substitute for. Folding this into `detectDistrict` via a boolean would require every call site to reason about "guarded when unmarked, unguarded when marked" inside one function — two candidate lists, each provably safe under its own single condition, is simpler to read and to test in isolation (mirrors this file's own existing precedent: `detectLandmark`'s bare-`nameTh` candidates are guarded, its alias candidates are not, for the identical reason).
- The one guard kept on BOTH lists (the "เมือง"+own-province capital-district pattern) is not an ambiguity guard at all — it exists purely so a redundant hint is never fired when the plain province detector already covers the exact same substring. That reasoning is marker-independent, so it stays on both.

## Why `buildPlaceHintBlock` (openrouter-client.ts) needed no change
`ResolvedPlace.district`'s shape and meaning are unchanged — a plain Thai district name string, optionally paired with `province`. `buildPlaceHintBlock`'s existing `place.district` branch (CAM-596) already reads it generically ("The camper named the district/อำเภอ ... detected deterministically server-side ... not a guess") with no dependency on WHICH detector produced it. Verified by re-running `__tests__/cam-596-openrouter-hint.test.ts` unmodified — still green, because its own fixtures ("ลานกางเต็นท์แม่ริม", etc.) never carry an "อำเภอ"/"อ." marker and so never exercise the new first branch, and the branch it DOES exercise (`place.district` generically) is byte-identical code.

## Why `search-campsites.ts` needed no change
`executeSearchCampsites`'s own `near`/`district`/`province`/`region` branch order (the real, DB-facing precedence when the MODEL sets multiple tool params at once) is a completely separate concern from `resolvePlace`'s free-text pre-pass detection order — that ladder governs what happens when a tool CALL already carries multiple params; this story only changes which SINGLE hint the pre-pass injects before the model ever calls the tool. Confirmed unaffected: `__tests__/cam-503-landmark.test.ts`'s `executeSearchCampsites`-level tests (including the one passing `near: "อำเภอปาย"` directly as an explicit tool arg, unrelated to free-text detection) all remain green, unmodified.

## Sibling-pin sweep (measured, not assumed)
Grepped every `__tests__/*.test.ts` for `อำเภอ`/`อ.[ก-๙]` inside a `resolvePlace(...)` call before writing the fix. Exactly ONE hit: `cam-503-landmark.test.ts:99`, `expect(resolvePlace('แคมป์อำเภอปาย')).toEqual({ near: 'ปาย', nearIsLandmark: true })` — this literally exercises the exact bug this story fixes, so it was updated (not weakened) to assert the new `{ district: 'ปาย' }` outcome, with a second, non-อำเภอ-prefixed alias substituted in so the test's own original point ("an alias resolves to canonical nameTh") stays proven. Re-ran the full `cam-501`/`cam-502`/`cam-503`/`cam-504`/`cam-596` suites (127 tests) green after the fix — no other sibling pin touched this substring.

The 4 landmark gazetteer entries with an "อำเภอ"-prefixed alias — ปาย, เขาค้อ, สวนผึ้ง, วังน้ำเขียว — are ALL, measured, real district names in `thailandLocations`. None of the other three (เขาค้อ/สวนผึ้ง/วังน้ำเขียว) had an existing pinned test anywhere in the repo, so their behavior change (an explicit "อำเภอเขาค้อ" now also resolves as a district, not a landmark radius) carries zero regression risk against the existing suite, and is the SAME general fix, not a ปาย-special-case.

## Golden set
Added `GEO-6-CAM599-DISTRICT-BEATS-LANDMARK` to `scripts/ai-eval/golden-cases.json` (`guardrail: true`, `strictParams: true`, mirrors `GEO-5-CAM596-DISTRICT`'s shape) — a real-model, behavioral proof for AC-1 (CAM-500 lesson: a prompt/pre-pass change is verified through the model, or it is not verified). This bumps the fixture's total case count from 68 to 69; `cam-457-eval-harness.test.ts`/`cam-459-answer-policy-3-zones.test.ts`'s own hardcoded `expect(cases.length).toBe(68)` pins were bumped to 69 — the same direct, necessary consequence CAM-596's own tech.md already documented when it added `GEO-5-CAM596-DISTRICT`.

## Links
`../../feature.md` (## Architecture overview) · `lib/ai/place-resolver.ts` · `lib/ai/openrouter-client.ts` (unchanged, confirmed above) · `lib/ai/tools/search-campsites.ts` (unchanged, confirmed above) · `story.md` · CAM-596 tech.md (its own precedence note, updated in this PR) · CAM-503 tech.md/story.md (the original landmark-first reasoning this story narrows to "bare mention only").

## Changelog
- v1 (2026-07-28) — created; documents the shipped fix (new `detectExplicitDistrictPrefix` candidate list + precedence check), the sibling-pin sweep, and the golden-set addition.
