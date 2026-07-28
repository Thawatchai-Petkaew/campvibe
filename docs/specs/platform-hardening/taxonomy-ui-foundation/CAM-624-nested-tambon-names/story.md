---
linear: CAM-624
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
As a **Camper**, I want naming one of two tambons whose spelling embeds a second, unrelated real tambon's name to search the place I actually named, so that I am never silently sent to a different tambon in a different province.
Why: CAM-611's own re-scan found — and deliberately did not fix — that `ท่าทองหลาง` and `ท่าหินโงม` each embed a second, independently real, shortlisted sub-district name (`ทองหลาง`, `หินโงม`) as a trailing substring, and explicitly asked this ticket to MEASURE whether that is actually a wrong answer before assuming it needs a fix.
Scope: establish the current ranking behavior for both confirmed pairs; ship a general "a shorter shortlisted name is shadowed by a longer surviving one" rule in `buildSubDistrictCandidates`/`detectSubDistrict` (not a two-name patch) if the measurement shows a real misfire.
Depends on: CAM-611 (found this, left it unfixed on purpose) · CAM-600 (the sub-district detector + candidate-ranking mechanism this story extends) · CAM-609 (established the "found it, said so, didn't fix it" reporting norm this ticket continues)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper writes a camping-intent phrase naming one of the two confirmed nested-name tambons (`ท่าทองหลาง` / `ท่าหินโงม`) | Assistant parses the message | Assistant searches the exact place the camper named — this already worked before this ticket; measuring confirmed it, this story does not change it | `resolvePlace` returns `{subDistrict: <the longer name>, district: <its own district>}` | EC-1 |
| AC-2 | Camper writes an ORDINARY sentence naming the same tambon with NO camping-intent word anywhere (the confirmed misfire CAM-611 found) | Assistant parses the message | Assistant treats the message as naming no place (falls through to its own general search/answer), instead of silently searching a different, unrelated tambon in a different province | `resolvePlace` returns `{}`, never the embedded, unrelated tambon's `{subDistrict, district}` | AC-1 |
| AC-3 | Camper writes a genuine, standalone mention of the embedded inner tambon itself (`ทองหลาง` / `หินโงม`), with the outer name's substring not present anywhere | Assistant parses the message | Assistant still resolves that OTHER real, camp-holding place correctly — the fix must not remove a legitimate place from being found | `resolvePlace` returns `{subDistrict: <inner name>, district: <its own district>}`, unchanged | — (regression, not a new failure mode) |
| AC-4 | Any of CAM-600's six negative fixtures, CAM-609's `ตำนาน` cases, CAM-611's three words (`เหนือเมือง`/`เสาธง`/`รังนก`), or the sibling cases (`แม่ริม`/`อำเภอปาย`/`เชียงใหม่`/`ใกล้เขาใหญ่`/`ป่าตอง`/`หมูสี`) | Assistant parses the message | Behavior is byte-identical to before this story | No regression in any pinned CAM-501/502/503/504/596/599/600/605/606/609/611 test | — (regression suite, not a new user-facing case) |

## Rules
- BR-1 MEASURED first, per the ticket's own instruction, before writing any fix: with a camping-context marker present, the existing "sort candidates longest-name-first, return on first textual+guard match" idiom already made the longer/more-specific name win — `resolvePlace('ลานกางเต็นท์ท่าทองหลาง')` already returned `{subDistrict:"ท่าทองหลาง", district:"บางคล้า"}` before this ticket touched anything. **AC-1 was already true.**
- BR-2 The confirmed defect is narrower than "which name wins": CAM-611's own `requiresCampingContext` guard, when it SKIPS the longer candidate (because no camping word is present), lets the pre-existing "skip and keep scanning" idiom fall through to the SHORTER, unrelated, unguarded embedded candidate — which then fires on its own, because taken in isolation it is a real, camp-holding place with no guard of its own. This is what makes AC-2 fail before this story (`resolvePlace('เมื่อวานนี้ไปท่าทองหลางเยี่ยมญาติมา')` → the wrong `{subDistrict:"ทองหลาง", district:"บ้านนา"}`).
- BR-3 The fix is a GENERAL rule, not a two-name patch: a sub-district candidate whose `nameTh` is a proper substring of another SURVIVING candidate's `nameTh` is "shadowed" — skipped regardless of WHY the longer one didn't itself fire (context-guard OR unresolved ambiguity) — whenever that longer candidate's own `nameTh` is also present in the text. Computed once, at module load, from the SAME candidate list `buildSubDistrictCandidates` already produces (no second data source), so a future shortlist regeneration introducing a NEW such pair is automatically protected with no code change.
- BR-4 The shadow rule applies ONLY to the unmarked candidate path — mirrors CAM-609/CAM-611's own marker-vs-unmarked split. The explicit `ตำบล`-marked path cannot suffer this collision by construction: the marker requires direct adjacency to the name, and no embedded child name is ever directly preceded by `ตำบล` in the same text where the outer name also appears (verified, not assumed — tech.md).
- BR-5 MEASURED against today's 503-row shortlist: 12 such embedding pairs exist in total (tech.md's full table), not just the two the ticket named — but only these two are an OBSERVABLE misfire today, because the other 10 pairs' longer name is unguarded and single-entry, so it already won unconditionally (checked first in the sort order) before this story touched anything. The general rule protects all 12 (and any future ones) uniformly; its OBSERVABLE effect today is exactly the two confirmed cases — no other pinned behavior changes.

## Edge cases
- EC-1 IF the outer (longer) nested-name tambon appears WITH a camping-context marker THEN it resolves exactly as before this story (unchanged) (BR-1)
- EC-2 IF the outer form appears with NO camping-context marker THEN `resolvePlace` returns `{}`, never the shorter embedded tambon (BR-2/BR-3)
- EC-3 IF the text names ONLY the inner (shorter) tambon, with the outer name's substring not present anywhere THEN it resolves normally, unaffected by the shadow rule (BR-3/BR-4)
- EC-4 IF the outer form is written with an explicit `ตำบล` marker THEN the shadow rule never applies (by construction) and it resolves exactly as before (BR-4)
- EC-5 IF a shortlisted name is a substring of an UNGUARDED, single-entry longer candidate (10 of the 12 measured pairs, e.g. `ปากน้ำแหลมสิงห์`⊃`ปากน้ำ`) THEN behavior is unchanged — the longer name already won unconditionally before this story (BR-5)

## Data
No entity/field change, no migration. `lib/ai/place-resolver.ts` only:
- A module-load-time `Map<string, readonly string[]>` (`SUBDISTRICT_SHADOW_PARENTS_BY_NAME`), derived once from `SUBDISTRICT_CANDIDATES_BY_LENGTH_DESC` (already built by `buildSubDistrictCandidates`).
- One new guard line inside `detectSubDistrict`'s existing loop (`isShadowedByLongerSubDistrict`).

## Seams & refs
Reuse: the exact "sort longest-first, return on first match" idiom every candidate list in this file already uses (province/region/landmark/district/sub-district) and the existing "skip and keep scanning" idiom (`detectDistrict`/`detectLandmark`/`detectSubDistrict`, unchanged). No change to `lib/geo/admin-area-match.ts` — the fix is entirely inside the free-text pre-pass's own candidate ranking, not the DB-backed exact-match resolver that consumes an already-decided argument (argued in tech.md; that file is used by non-AI callers too, per the dispatch's own STOP rule, and this collision class cannot occur there). Refs: `../CAM-611-subdistrict-structural-guard/tech.md` (found this, EC-5, deliberately left unfixed) · `../CAM-600-tambon-shortlist/tech.md` (the candidate-ranking mechanism extended here) · `../CAM-609-tamnan-false-hint/tech.md` (the "found it, said so, didn't fix it" precedent this ticket continues).

## Out of scope
- **NEW finding, reported not fixed** (found during this story's own verification, same "report what you find even if you only fix this one" standard CAM-606/CAM-609/CAM-611 already followed): the SAME family also manifests **across levels**, not just within the sub-district list — a shortlisted SUB-DISTRICT candidate can shadow an unrelated DISTRICT-level mention, because `resolvePlace` checks sub-district before district. Measured: `resolvePlace('เมื่อวานนี้ไปบ้านนาสารเยี่ยมญาติมา')` and `'...บ้านนาเดิมเยี่ยมญาติมา'` (Ban Na San / Ban Na Doem, real districts in Surat Thani) both resolve to `{subDistrict:"บ้านนา", district:"เมืองชุมพร"}` — a different, unrelated place in Chumphon; `'...แม่ลาน้อยเยี่ยมญาติมา'` (Mae La Noi district, Mae Hong Son) resolves to `{subDistrict:"แม่ลา", district:"บางระจัน"}` — a different, unrelated place in Sing Buri. **Confirmed pre-existing and unaffected by this story's fix** (verified by running the identical probe against `origin/dev` before this branch's change — byte-identical result). This is a broader, cross-level shape than this ticket's own scope ("one tambon name contains another") and would need either a cross-level shadow map or a precedence-order change to `resolvePlace` itself — a bigger, more invasive change than this story's budget and cost cap allow. Flagged as a follow-up ticket candidate, not filed here (per the dispatch's own instruction to report and stop, not spend further without asking).
- Extending the shadow rule to district-vs-district (same-level) candidates — checked (tech.md): 22 embedding pairs exist in the district candidate list too, but isolating them from the cross-level noise above, NONE is an observed district-vs-district misfire today (every district-level parent in the measured set is unguarded and single-entry, so it already wins unconditionally, mirroring the sub-district level's own 10 safe pairs). No evidence of a live bug at that level → no code added, per this arc's own "measured zero, not added" precedent (CAM-611 BR-3).

## Self-verify
- AC-1..4 → unit (`__tests__/cam-624-nested-tambon-names.test.ts`), pure/synchronous, no DB, no model call (this fix is entirely inside the deterministic free-text pre-pass — no guardrail-gate cost to reach the answer to "is this wrong")
- 2 pre-existing pinned assertions in `__tests__/cam-611-subdistrict-structural-guard.test.ts` (its own EC-5 block, explicitly labelled "found, not fixed" there) updated to the now-corrected expected value — a disclosed, necessary consequence of shipping the fix that block itself called for, not a weakening (its other 71 assertions unchanged and still pass)
- Full existing suite (11,006 tests) re-run green as the final act
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-28) — created; measured the confirmed misfire, shipped the general shadow-parent fix, and reported the new cross-level (sub-district-shadows-district) finding for a follow-up ticket.
