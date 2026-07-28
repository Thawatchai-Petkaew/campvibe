---
linear: CAM-600
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — Sub-district search becomes as reliable as district search (CAM-600)

## Data model
No new entity/field. One new generated data artifact, `prisma/data/subdistrict-shortlist.json` — `{ nameTh: string; districtNameTh: string; provinceNameTh: string }[]`, 422 rows measured against the dev DB today (`node scripts/generate-subdistrict-shortlist.mjs`). Reuses the existing `AdminArea` tree (CAM-553/562/566/587) as its ONLY source — no new table, no new column.

## Build-time or runtime — decided: build-time, generated artifact
The shortlist answers "which sub-districts currently hold a camp", a fact that changes as camps are added — it WILL go stale. Two options, both considered:

- **Runtime query** (rejected): would require `resolvePlace`'s pre-pass to become `async` and call `matchAdminArea`/a new count query per turn. CAM-596's tech.md already made this exact call for districts and rejected it for the identical reason, reinforced here: `resolvePlace` is called synchronously, with no `await`, from 3 production sites in `openrouter-client.ts`, and 133 existing test cases (cam-501/502/503/504/596/599, measured — re-run green, unmodified, in this story) assert an exact, synchronous return. Making it async would force `await` onto every call site and every existing test for a change that buys nothing a build-time artifact doesn't already give — the DB fact needed ("does this exact name hold a camp") is a slow-changing set (422 rows), not a per-request-volatile one.
- **Build-time generated artifact** (chosen): a committed JSON file, structurally identical in role to `thailand-locations.json`/`landmark-gazetteer.json`/`place-aliases.json` (all already static, committed, module-load-time imports in this exact file). `scripts/generate-subdistrict-shortlist.mjs` queries the live `AdminArea`/`Location`/`CampSite` tables once, offline, and writes the artifact — the pre-pass detector reads it exactly like the other three gazetteers, staying pure/synchronous.

**What keeps it correct (the regeneration story, named per the ticket's own ask):** the generator is a manual/on-demand command today (`node scripts/generate-subdistrict-shortlist.mjs`, committed alongside this story) — re-run it (and commit the diff) whenever a meaningfully large batch of new camps goes live in a previously camp-less sub-district, e.g. as part of a host-onboarding batch or before a release train. **A stale artifact only ever causes a MISS** (a real, camp-holding sub-district not yet detected — the pre-pass simply has no hint for it, falling through to whatever the model does on its own initiative, per its own softened "do NOT guess" guidance) — **never a wrong/guessed match**; the guard logic (length floor, ordinary-vocabulary skip-set, collision-scoping) is entirely unaffected by staleness, it just scans a slightly smaller or larger candidate set. Automating the regeneration cadence (a scheduled job that opens a PR when the DB diff is non-empty) is an explicit, named follow-up, not this story — this story ships the artifact + the generator that produces it, per the ticket's own "a generated artifact needs a regeneration story" instruction.

Confirmation: `scripts/generate-subdistrict-shortlist.mjs` run against the real dev DB produced exactly 422 rows, matching the owner's own measured number in the ticket.

## Detection algorithm (`lib/ai/place-resolver.ts`)

New module-load-time candidate build from `subdistrict-shortlist.json` (never `thailandLocations` — that file has no "holds a camp" fact), grouped by `nameTh` (a name can repeat across provinces) into `SubDistrictCandidate { nameTh, entries: {districtNameTh, provinceNameTh}[] }`:

1. **BR-2 length floor** — `nameTh.length < 5` excluded entirely. Measured: excludes 26 of the 422 raw rows, including every name the ticket itself names as dangerous (ตลาด, ถนน, ช่อง, บ่อ, ดู่, ปอ — all <=4 Thai characters). Set at 5, not CAM-596's district-level 4, because the collision risk is measurably denser here.
2. **BR-3 curated ordinary-vocabulary skip-set** (`AMBIGUOUS_SUBDISTRICT_VOCAB_TH`) — a SECOND, independent guard, because the length floor alone does not catch every risk: "เหนือ" (north/above, 5 Thai characters) is itself a real, shortlisted sub-district (Kalasin) — measured directly by re-running this story's own candidate-build logic against this file's EXISTING `cam-501`/`cam-503` regression fixtures ("ริมน้ำภาคเหนือ", "ภาคตะวันออกเฉียงเหนือ", …), which all contain the substring "เหนือ" and are pinned to resolve as a REGION, never a sub-district — this is the exact same word CAM-596's own docblock already names as an unguardable district-level collision, now confirmed to recur at the sub-district level too. "สะอาด" (clean) and "สำราญ" (relaxed/content) are added on the same evidence class (common adjectives, camping-review-adjacent, exactly 5 Thai characters) — a deliberate, judgment-based addition (not test-fixture-forced like "เหนือ"), documented as such; not exhaustive (story.md "Out of scope").
3. **BR-4 substring-of-any-province** — reuses CAM-596's own `isSubstringOfAnyProvince` (zero new code). Measured: shortlisted ตำบล "สระแก้ว"/"หนองบัว" are each a substring of a DIFFERENT real province's name (สระแก้ว is itself a province too; หนองบัว⊂หนองบัวลำภู — the SAME collision class CAM-596 measured for districts), and "ประจวบคีรีขันธ์"/"บึงกาฬ" are each a shortlisted ตำบล that exactly duplicates its OWN province's full name.

After guards 1-3, 388 of the 422 raw rows survive, grouped into 357 shortlist-globally-unique names (fire unconditionally) + 13 names that repeat across >1 province within the shortlist (31 rows total — measured: บางปลา, โคกม่วง, บ้านยาง, ท่าเรือ, ในเมือง, ดงมะไฟ, โพธิ์ชัย, ขมิ้น, ห้วยยาง, ห้วยแก้ว, ดอนทราย, บ้านแหลม, บางหมาก).

**BR-5 collision scoping** (`resolveAmbiguousSubDistrictEntry`) — for a >1-entry candidate, an entry counts as confirmed when the SAME text ALSO contains that entry's OWN `districtNameTh` or `provinceNameTh`; the candidate hints ONLY when EXACTLY ONE entry is confirmed. A `districtNameTh` check is skipped when it is IDENTICAL to the candidate's own `nameTh` — a real, measured tautology: shortlisted "บ้านแหลม" has an entry whose own district is ALSO named "บ้านแหลม" (its seat sub-district), which would otherwise trivially "confirm itself" on every bare mention of "บ้านแหลม", defeating the whole point of the scoping requirement. Proven: `resolvePlace('ลานกางเต็นท์บ้านแหลม')` (no province given) falls through to CAM-596's own (unchanged) `detectDistrict`, resolving `{ district: 'บ้านแหลม' }` — a graceful degrade to the next coarser, already-proven-safe level, never a guess at which of the 2 candidate provinces was meant; `resolvePlace('ลานกางเต็นท์บ้านแหลม เพชรบุรี')` correctly confirms and resolves `{ subDistrict: 'บ้านแหลม', district: 'บ้านแหลม' }`.

**Why `district` is ALWAYS paired with `subDistrict`, even for a shortlist-unique name** — measured, not assumed to be safe: 155 of the 422 shortlisted names (37%) are NOT globally unique across the FULL 7,452-row national `AdminArea` table — they only happen to be the ONLY *camp-holding* sub-district under that exact name; a different, camp-less sub-district somewhere else in Thailand can share the identical name. The tool's own (unchanged) `resolveExactInsideAdminAreaIds`/`resolveSubDistrictAdminAreaId` only scope a `matchAdminArea('SUBDISTRICT', name, parentId)` lookup correctly when a `district` parentId is supplied — omitting it risks an arbitrary DB-order pick among all nationally-matching rows, most of which hold no camp at all. Attaching the sub-district's own, already-known-correct `districtNameTh` (from the shortlist artifact itself) costs nothing and removes this risk entirely, for every fired candidate.

## Precedence — reconciles with CAM-596/CAM-599 (measured, not assumed)

`resolvePlace`'s dispatch order, in full, after this story:

```
detectExplicitDistrictPrefix(text)?  -> unchanged (CAM-599): { district: nameTh }, checked FIRST
detectLandmark(text)?                -> unchanged (CAM-503): near + nearIsLandmark, for a BARE mention
isBareBangkokMention(text)?          -> unchanged (CAM-502/504): near or province
detectSubDistrict(text)?             -> NEW (CAM-600): { subDistrict: nameTh, district: ownDistrictNameTh }
detectDistrict(text)?                -> unchanged (CAM-596): { district: nameTh }, no marker required
detectProvince(text)?                -> unchanged: province, or near if a proximity marker is present
detectRegion(text)?                  -> unchanged: region
else {}                              -> unchanged
```

The ONE placement decision this story had to make, and the MEASURED conflict that forced it: `detectSubDistrict` is a sub-district, strictly MORE specific than a plain district, so the obvious first instinct is to place it ahead of the landmark check too. Building it there and re-running the full `cam-501..504`/`cam-596`/`cam-599` suite caught a REAL regression before it shipped: "เขาค้อ" (Phetchabun) is BOTH a `CONTEXT_GUARDED_LANDMARK_NAMES_TH` entry (CAM-503-DEF-2) AND a real, shortlisted, camp-holding sub-district — `cam-599-named-district-beats-landmark.test.ts`'s own pinned case `resolvePlace('ที่พักเขาค้อ')` (a bare mention, no camping-context marker, no "อำเภอ"/"อ." marker) expects `{ near: 'เขาค้อ', nearIsLandmark: true }`; placing `detectSubDistrict` ahead of the landmark check would have silently narrowed this to a single administrative sub-district instead of the landmark's whole area radius — CAM-503's original reasoning (a landmark can span multiple provinces, so `near` is the only honest answer for a bare mention) still holds, and this story does not change that case. Moving `detectSubDistrict` to AFTER the landmark/Bangkok checks (and re-running the full existing suite, 133 tests, green, unmodified) resolved it — proven, not merely reasoned about, exactly the discipline CAM-596/CAM-599's own tech.md files record for their own sibling-pin sweeps.

This precedence table is the SAME text now also updated into `../CAM-596-district-through-the-model/tech.md` and `../CAM-599-named-district-beats-landmark/tech.md` in this same PR, so the three documents describe one system.

## API contract (tool-surface, prompt-only changes)

`lib/ai/tools/search-campsites.ts` — no zod/schema change (CAM-587 already added `subDistrict` to `searchCampsitesArgsSchema`); one text-only edit, mirroring CAM-596's exact treatment of `district`'s description: the pre-existing "do NOT guess" sentence is reconciled (not deleted) with an added sentence — if this turn's own instructions already tell the model to set `subDistrict`/`district`, that is a confirmed match and it MUST follow both; guessing on the model's OWN initiative, with no such instruction, is still discouraged exactly as before (preserves CAM-587 BR-4/AC-6 — an unresolved sub-district still returns zero rows honestly).

`lib/ai/openrouter-client.ts`'s `buildPlaceHintBlock` gains ONE new branch (`place.subDistrict`), inserted BEFORE the existing `place.district` branch (a sub-district match ALWAYS also carries `district`, per BR-7 above — if checked after, the district branch would fire first and the model would never learn about the sub-district at all). The new branch mandates BOTH `subDistrict` AND `district` together in one sentence.

## ADRs
None new. Extends CAM-596/CAM-501's pre-pass mechanism (a deterministic, mandatory hint removes a guess from the model) to the sub-district level, using the SAME "MANDATORY hint" pattern, never a new mechanism.
Confirmation: `__tests__/cam-600-place-resolver-subdistrict.test.ts` (unit, pre-pass detector + all BR-2..7 guards) + `__tests__/cam-600-openrouter-hint.test.ts` (the new hint-block branch) + `__tests__/cam-600-tool-description.test.ts` (the tool-surface text) + a new guardrail golden case (`GEO-7-CAM600-SUBDISTRICT`, `scripts/ai-eval/golden-cases.json`) — run for real against the live model via `npm run ai:guardrail-gate` in this environment (`OPENROUTER_API_KEY` was available here, unlike CAM-596's authoring environment) and confirmed PASSING (all 9 guardrail cases green, including the new one), the actual behavioral verification for AC-1/AC-4, not a claim made without evidence.

## Links
`../../feature.md` (## Architecture overview) · `lib/ai/place-resolver.ts` · `lib/ai/tools/search-campsites.ts` · `lib/ai/openrouter-client.ts` · `lib/geo/admin-area-match.ts` · `scripts/generate-subdistrict-shortlist.mjs` · `prisma/data/subdistrict-shortlist.json` · `story.md` · `../CAM-596-district-through-the-model/tech.md` (its own precedence note, updated in this PR) · `../CAM-599-named-district-beats-landmark/tech.md` (its own precedence note, updated in this PR) · CAM-587 tech.md (the resolution layer this story reaches, unchanged)

## Changelog
- v1 (2026-07-28) — created; documents the shipped shortlist artifact + generator, the 4 measured collision guards (length floor, ordinary-vocabulary skip-set, substring-of-province, within-shortlist collision-scoping with the tautology exception), the measured "เขาค้อ" landmark/sub-district precedence conflict and its resolution, and the real-model guardrail-gate confirmation.
