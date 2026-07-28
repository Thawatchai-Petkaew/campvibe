---
linear: CAM-609
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — Saying a tent is legendary sends the camper to Phatthalung (CAM-609)

## Data model
No new entity/field, no migration. `lib/ai/place-resolver.ts` only: one set-literal addition to the existing `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` (CAM-600) + one new candidate list/detector function pair, built at module load from the SAME, already-imported `subdistrict-shortlist.json` (CAM-600/606, unchanged) — no new data file, no new import.

## Part 1 — confirming the skip-set is consulted for BOTH marked and unmarked mentions (the dispatch's own check)
Before touching anything, I confirmed the premise the ticket named: `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` is consulted inside `buildSubDistrictCandidates()`, which is the ONLY candidate-building function `detectSubDistrict()` read from before this story — there was no marked/unmarked split anywhere in this module (unlike districts, where CAM-599 already built a SEPARATE `buildExplicitDistrictPrefixCandidates()` for the "อำเภอ"/"อ."-marked path). So a one-line addition of `ตำนาน` to the skip-set would have excluded it from the ONE candidate map both the bare word AND the `ตำบล`-marked form draw from — fixing `เต็นท์รุ่นตำนาน` would have silently broken `ลานกางเต็นท์ตำบลตำนาน` (verified by a scratch run before writing any fix: with only the vocab-set line added and no marker path, `resolvePlace('ลานกางเต็นท์ตำบลตำนาน')` returned `{}`, dropping the correct case). This confirms the ticket's own prediction: the marker path is required, not optional.

## Part 2 — the fix (two changes, one function each)

### 2a. Vocabulary addition
`ตำนาน` added to `AMBIGUOUS_SUBDISTRICT_VOCAB_TH`, identical mechanism to the existing เหนือ/สะอาด/สำราญ entries — excludes it from the UNMARKED candidate build (`buildSubDistrictCandidates`), so a bare mention with no "ตำบล" marker no longer hints a place at all.

### 2b. New explicit-marker path — `detectExplicitSubDistrictPrefix`
A second, separate candidate list (`buildExplicitSubDistrictPrefixCandidates`, mirroring CAM-599's own `buildExplicitDistrictPrefixCandidates` shape for districts) built from the RAW `SUBDISTRICT_SHORTLIST`, filtering out only:
- names shorter than `MIN_SUBDISTRICT_NAME_LENGTH` (5) — a marker does not make a too-short name meaningful
- names that are a substring of any real province's own name (`isSubstringOfAnyProvince`, reused unchanged) — a marker does not resolve the redundancy/wrong-scope risk that guard protects against

and deliberately NOT filtering through `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` — an explicit "ตำบล" marker directly in front of the name IS the camper's own grammatical declaration of sub-district intent, the exact ambiguity that guard exists to substitute for. `detectSubDistrict()` calls this new function FIRST, then falls through to the existing, byte-identical guarded loop for the unmarked case. `resolvePlace()`'s own top-level precedence (where the sub-district check sits relative to landmark/Bangkok/district/province/region) is UNCHANGED — this story only changed what happens inside the sub-district step, not where that step sits, so no sibling tech.md (CAM-596/599/600) needed a precedence-table update.

**Why bypass only 2 of the 3 sub-district guards, unlike CAM-599's district marker which bypasses all 3 of its own guards:** CAM-599's `detectExplicitDistrictPrefix` bypasses its length floor, its `AMBIGUOUS_PROVINCE_NAMES_TH` reuse, AND its substring-of-province guard — keeping only its guard #4 (a literal "เมือง"+own-province redundancy pattern). I deliberately did NOT mirror that exact bypass set here: this ticket's own dispatch instruction is explicit — "do not widen the length floor... a vocabulary problem gets a vocabulary fix" — and the reported problem (`ตำนาน`) needs ONLY the vocabulary guard bypassed (it already clears the length floor at exactly 5 characters, and it is not a substring of any province). Bypassing the length floor or the substring-of-province guard for the marked path was not required by any reproduced case, would be new, unverified surface, and is explicitly out of this ticket's scope — kept off per BR-2 (story.md) and reported as a design choice here rather than silently generalized.

## Part 3 — the wider re-scan (all 503 names)
Read-only analysis (no edit to the shortlist, the generator, or the drift script), reproducing `buildSubDistrictCandidates`'s own two exclusion guards (length floor + `isSubstringOfAnyProvince`, pre-this-story's vocab-set) directly against `prisma/data/subdistrict-shortlist.json` + `prisma/data/thailand-locations.json`: **444 of 503 raw rows survive both guards** (script + full output kept in the session scratchpad, not committed — this is analysis, not a new artifact). Every surviving name was read; findings below, ordered by confidence, are reported per the ticket's own instruction ("report what you find even if you only fix this one") — **none beyond `ตำนาน` is fixed under this ticket.**

### 3a. The one *structural* finding (most significant — distinct from a vocabulary miss)
`buildSubDistrictCandidates()` has **no equivalent of CAM-596's `requiresCampingContext` prefix-guard** for sub-districts. At the district level, CAM-596 established that "เมือง"/"ท่า"-prefixed names (ordinary words for "town/capital" and "pier/dock", measured across 23 district names) need a co-occurring camping-context marker before firing. That treatment was never ported down to sub-districts, despite the sub-district shortlist being ~5x larger. Measured directly against the current shortlist: **22 surviving sub-district names start with "ท่า"** (ท่าเกษม, ท่าขุนราม, ท่างาม, ท่าจำปี, ท่าชัย, ท่าช้าง, ท่าตะเกียบ, ท่าตูม, ท่าทองหลาง, ท่าเทววงษ์, ท่านัด, ท่าม่วง, ท่ายาง, ท่าเรือ*, ท่าแร้งออก, ท่าลาด, ท่าศาลา, ท่าสว่าง, ท่าสองคอน, ท่าหินโงม, ท่าอิฐ — *`ท่าเรือ` is one of CAM-600's own 13 within-shortlist collision names, so it already gets SOME protection from `resolveAmbiguousSubDistrictEntry`; the other 21 are shortlist-unique and fire completely unconditionally) and **2 start with "เมือง"** (`เมืองเก่า` — Sukhothai's own historic-park sub-district, and `เมืองปอน`). None of these 24 names is currently guarded by anything beyond the length floor and the province-substring check. This is reported as a finding, not fixed here — it is the same shape and size of work CAM-596 already did once for districts, sized as its own ticket, and explicitly out of this ticket's scope per the dispatch (a structural/algorithm change, not a vocabulary fix).

### 3b. Individual ordinary-vocabulary candidates found (same class as `ตำนาน`, not yet mitigated)
- **`เหนือเมือง`** (Roi Et, single-entry, fires unconditionally) — the literal concatenation of two of the highest-frequency words in Thai ("north"/"above" + "city/town"); a completely ordinary phrase describing a location relative to a town center (e.g. "บ้านอยู่เหนือเมือง") would collide. Same root risk CAM-600 already fought for bare "เหนือ", now recurring in a compound that escapes the exact-match skip-set.
- **`เสาธง`** ("flagpole", Nakhon Si Thammarat, single-entry) — an ordinary, concrete noun that appears in generic scene-setting ("ข้างเสาธง").
- **`รังนก`** ("bird's nest [soup]", Phichit, single-entry) — a common food noun, plausible in unrelated conversation.

### 3c. Individual candidates found but already mitigated by an existing guard
- **`เวียง`** (Chiang Rai / Phayao, 2 entries) — a common Lanna/Northern-Thai morpheme for "town" that is also a substring of well-known unrelated place names a camper might mention (e.g. "เวียงจันทน์" = Vientiane). Already requires a co-occurring "เชียงราย"/"พะเยา" (or their district names) in the same message before firing (`resolveAmbiguousSubDistrictEntry`, unchanged) — meaningfully lowers, but does not eliminate, the risk of a coincidental co-mention.
- **`ขมิ้น`** ("turmeric", Kalasin / Sakon Nakhon, 2 entries) — a common food/spice noun; same within-shortlist collision-scoping mitigation as `เวียง` above (already named as a collision case in CAM-600's own tech.md, not new here).

### 3d. Considered and judged lower-risk (same reasoning class CAM-606 already used for `บ้านนา`)
Generic-word + place-word compounds (`บางปู`, `บางปอ`, `นาทับ`/`นาบัว`/`นาป่า`/`นาพละ`/`นาโส่`, `นางแล`, `บ้านสวน`, `บ้านป่า`, `หัวนา`, `หัวรอ`, `ไร่รถ`, `คูบัว`, `มะค่า`, `สุเทพ` — the last also a well-known mountain/temple + common given name, but functioning as a place-name pattern rather than a stand-alone descriptive phrase) — judged the same way CAM-606's own tech.md judged `บ้านนา`: place-name-shaped by construction, not a phrase a camper would use in unrelated conversation. Named here for completeness in case a future eval surfaces a real miss (same acceptance CAM-606 already recorded).

## Precedence (unchanged — confirmed, not assumed)
`resolvePlace`'s dispatch order is byte-identical to CAM-600's own documented table; this story changed no ordering, only `detectSubDistrict`'s own internal first step. Re-running the full existing suite (CAM-501/502/503/504/596/599/600/605/606, unmodified except the two CAM-606 assertions this story's own bug fix required updating — see `test.md`) confirms no sibling regressed.

## Self-verify commands run
`npx vitest run __tests__/cam-609-*` (14/14 pass) · `npx tsc --noEmit` (clean, after `bash scripts/worktree-setup.sh` regenerated this worktree's own Prisma clients) · `npx eslint lib/ai/place-resolver.ts __tests__/cam-609-tamnan-false-hint.test.ts __tests__/cam-606-regenerated-shortlist.test.ts` (0 problems) · full `npx vitest run` (385 files / 10629 tests passed, 2 skipped — pre-existing, unrelated) run once mid-work and once as the final act · `npm run ai:guardrail-gate` run ONCE (real model, reported verbatim in the PR body per the dispatch's cost instruction).

## Links
`lib/ai/place-resolver.ts` · `__tests__/cam-609-tamnan-false-hint.test.ts` · `__tests__/cam-606-regenerated-shortlist.test.ts` (two assertions updated — the bug they documented is what this story fixes) · `../CAM-600-tambon-shortlist/tech.md` (the guard set this story extends) · `../CAM-606-regenerate-shortlist/tech.md` (the finding this story closes) · `../CAM-599-named-district-beats-landmark/tech.md` (the explicit-marker precedent this story's fix shape follows) · `story.md`.

## Changelog
- v1 (2026-07-28) — created; documents the confirmed marked/unmarked-both-consulted premise, the two-part fix (vocab entry + marker path with 2-of-3 guard bypass, narrower than CAM-599's district precedent by design), the full 503-name re-scan (1 structural finding + 3 individual-word findings + 2 already-mitigated + judged-lower-risk group), and the self-verify results.
