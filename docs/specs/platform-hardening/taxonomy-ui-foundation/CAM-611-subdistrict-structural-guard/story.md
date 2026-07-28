---
linear: CAM-611
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: story
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---

## Story
As a **Camper**, I want sub-district (ตำบล) name detection to reject an ambiguous fragment the same way district detection already does, so that an ordinary Thai sentence is never silently steered to a specific tambon I never named.
Why: CAM-609's own re-scan of the (now 503-row) sub-district shortlist found that `buildSubDistrictCandidates` never inherited CAM-596's `requiresCampingContext` structural guard — the one thing that stops a name built from a very common component (`เมือง`/`ท่า`) from resolving on a bare, unrelated mention. That story fixed only the one word (`ตำนาน`) it was dispatched for and deliberately left this structural gap and two more individual words for a follow-up ticket — this one.
Scope: reuse the district-level `requiresCampingContext` guard (same constant, same idiom) for the sub-district unmarked path only; add three individual vocabulary entries the guard cannot cover; verify the explicit `ตำบล`-marked path is untouched; check the ~24 exposed names by name.
Depends on: CAM-596 (district guard origin), CAM-600 (sub-district detector), CAM-609 (its own re-scan named this gap)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper writes an ordinary sentence containing a เมือง/ท่า-prefixed shortlisted sub-district name with no camping-intent word anywhere | Assistant parses the message | Assistant treats the message as having no named place (falls through to its own general search/answer) | `resolvePlace` returns `{}` for that place; no `subDistrict`/`district` hint is injected for the model this turn | EC-1 |
| AC-2 | Camper writes the SAME sentence but WITH a camping-intent word present (`แคมป์`/`ลานกางเต็นท์`/etc.) | Assistant parses the message | Assistant resolves the named sub-district as before (unchanged) | `resolvePlace` returns `{subDistrict, district}` (or the existing collision-scoped fallback) exactly as it did before this story | EC-2 |
| AC-3 | Camper writes `เต็นท์รุ่นเหนือเมือง` / a sentence containing `เสาธง` / a sentence containing `รังนก`, with no `ตำบล` marker | Assistant parses the message | Assistant treats the message as having no named place | `resolvePlace` returns `{}` | EC-3 |
| AC-4 | Camper writes the SAME word explicitly marked with `ตำบล` in front (`ตำบลเหนือเมือง` / `ตำบลเสาธง` / `ตำบลรังนก`) | Assistant parses the message | Assistant resolves the real, named tambon | `resolvePlace` returns `{subDistrict: <name>, district: <its own district>}` | AC-3 |
| AC-5 | Any of CAM-600's six negative fixtures, CAM-609's `ตำนาน` cases, or the five named sibling cases (แม่ริม/อำเภอปาย/เชียงใหม่/ใกล้เขาใหญ่/ป่าตอง/หมูสี) | Assistant parses the message | Behavior is byte-identical to before this story | No regression in any pinned CAM-501/502/503/504/596/599/600/605/606/609 test | — (regression suite, not a new user-facing case) |

## Rules
- BR-1 The new guard is the SAME structural mechanism CAM-596 already built for districts: a sub-district candidate is tagged `requiresCampingContext = true` only when its name starts with `เมือง` or `ท่า` (the exact `CONTEXT_GUARDED_ADMIN_AREA_PREFIXES_TH` constant, reused unchanged — never a second copy, never a new prefix list). A tagged candidate is skipped (not rejected outright — scanning continues) when no camping-context marker (`hasCampingContextMarker`, unchanged) is present in the same message.
- BR-2 The guard applies ONLY to the unmarked candidate path (`buildSubDistrictCandidates`/`detectSubDistrict`'s own loop). It is deliberately NOT added to the explicit `ตำบล`-marker path (`buildExplicitSubDistrictPrefixCandidates`/`detectExplicitSubDistrictPrefix`, CAM-609) — an explicit marker is itself sufficient context, the same precedent CAM-599 already set for the district-level `อำเภอ`/`อ.` marker (which also carries no camping-context field).
- BR-3 CAM-596's OTHER district guard (`nameTh === 'เมือง' + ownProvinceNameTh`, the provincial-capital-naming redundancy pattern) was measured against the CURRENT 503-row sub-district shortlist and matched ZERO rows. Per this story's own instruction, it is NOT added — a guard with no evidence behind it is not shipped; the measurement is recorded in `tech.md` so a future regeneration that introduces such a name has a place to look.
- BR-4 `เหนือเมือง`, `เสาธง`, `รังนก` each need an INDIVIDUAL entry in `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` (mirroring `เหนือ`/`สะอาด`/`สำราญ`/`ตำนาน`) — none starts with `เมือง`/`ท่า`, so BR-1's structural guard does not and cannot subsume them. The guard and the vocabulary skip-set are two independent mechanisms; this story adds to the skip-set only where the structural guard measurably does not reach.

## Edge cases
- EC-1 IF a เมือง/ท่า-prefixed sub-district name appears with no camping-context marker THEN `resolvePlace` returns `{}` for that candidate and scanning continues to the next candidate/level (same "skip and keep scanning" idiom as `detectDistrict`) (BR-1)
- EC-2 IF the same name appears WITH a camping-context marker THEN the guard does not skip it and resolution proceeds exactly as before this story (BR-1)
- EC-3 IF `เหนือเมือง`/`เสาธง`/`รังนก` appear bare (no `ตำบล` marker), regardless of camping context THEN `resolvePlace` returns `{}` (BR-4)
- EC-4 IF `เหนือเมือง`/`เสาธง`/`รังนก` appear with an explicit `ตำบล` marker THEN `resolvePlace` resolves the real tambon (BR-2, BR-4)
- EC-5 (found, not fixed — see tech.md) IF a เมือง/ท่า-prefixed name's OWN text embeds a second, independently-real, unguarded shortlisted sub-district name as a trailing substring (measured: `ท่าทองหลาง` embeds `ทองหลาง`; `ท่าหินโงม` embeds `หินโงม`) THEN the outer, guarded name is correctly suppressed in neutral phrasing, but the SAME text still resolves — to the different, unrelated, already-unguarded inner name, not to `{}`. This is a distinct, pre-existing collision class (independent of BR-1's fix), named here and left for a follow-up ticket per this story's own scope.

## Data
- No entity/field change, no migration. `lib/ai/place-resolver.ts` only: `SubDistrictCandidate` gains one boolean field (`requiresCampingContext`), computed at module load from data already imported (`prisma/data/subdistrict-shortlist.json`, `prisma/data/thailand-locations.json`); `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` gains three string entries.

## Seams & refs
- Reuse: `CONTEXT_GUARDED_ADMIN_AREA_PREFIXES_TH` + `hasCampingContextMarker` (both already defined by CAM-596, `lib/ai/place-resolver.ts`) — no new constant, no new function, no change to `lib/geo/admin-area-match.ts` (the shared `matchAdminArea` this pre-pass deliberately stays upstream of, per CAM-596/CAM-600's own tech.md). Refs: CAM-596 tech.md (guard origin), CAM-600 tech.md (sub-district detector + its own two guards), CAM-609 tech.md (the re-scan that found this gap + the explicit-marker precedent this story does not touch).

## Out of scope
- The `เมือง`+ownProvince redundancy guard (BR-3) — measured zero matches today, not added; revisit only if a future shortlist regeneration introduces one (would surface via the existing regeneration/drift-check cadence, `scripts/generate-subdistrict-shortlist.mjs` / `scripts/check-subdistrict-shortlist-drift.mjs`, both out of this story's file surface).
- EC-5's substring-embedding collision (`ท่าทองหลาง`⊃`ทองหลาง`, `ท่าหินโงม`⊃`หินโงม`) — a distinct problem class (independently-valid shortlisted names colliding with each other as substrings, not a common-component pattern) → follow-up ticket, not filed here (found during this story's own verification, reported in `tech.md`/PR body per the standing "report what you find even if you only fix this one" instruction).
- The pre-existing, documented divergence between `lib/ai/place-resolver.ts`'s `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` and `scripts/check-subdistrict-shortlist-drift.mjs`'s own duplicated copy (CAM-605's own named, bounded risk — that script is out of this story's file surface; already missing CAM-609's `ตำนาน` entry, unaffected by this story).

## Self-verify
- AC-1..5 → unit (`__tests__/cam-611-subdistrict-structural-guard.test.ts`), all pure/synchronous, no DB
- Story-specific: full existing suite re-run as the final act (place-resolver has the most pinned sibling tests in the repo — CAM-501/502/503/504/596/599/600/605/606/609); real-model guardrail gate run ONCE only (cost-capped, `lib/ai/**` touched)
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-28) — created
