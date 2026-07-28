---
linear: CAM-600
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: story
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Sub-district search becomes as reliable as district search, using only the tambons that hold a camp (CAM-600)

## Story
As a **Camper**, I want naming an exact ตำบล (sub-district) that actually has a camp in it — e.g. "ลานกางเต็นท์แสนสุข" — to search that ตำบล directly, so that I get the specific 1-camp result inside it instead of a wider, less useful district-level answer (or nothing at all).
Why: CAM-587 wired `subDistrict` into the `searchCampsites` tool and proved the resolution layer works. CAM-596 then made district detection deterministic but *deliberately* did not do the same for sub-districts: it measured that scanning all 7,452 Thai sub-districts was unsafe — ordinary Thai words (เหนือ, กลาง, ตากแดด) are ALSO real sub-district names, and the only available guard (a camping-context marker) gives no protection because nearly every message to this camping assistant already contains one. The owner's insight changes the math: a camper can only usefully ask about a sub-district that actually HAS a camp — 422 of the 7,452 (94% smaller) — which is what makes a deterministic detector defensible where a full scan was not.
Scope: extend the deterministic pre-pass (`resolvePlace`) to detect a CURATED, camp-holding shortlist of sub-district names in free text, mirroring exactly how CAM-596 does it for districts, through the SAME shared matcher (`matchAdminArea`, CAM-566) and the SAME "MANDATORY hint" mechanism (`buildPlaceHintBlock`). The shortlist is necessary but NOT sufficient by itself (measured residual risk, see Rules below) — a length floor, a curated ordinary-vocabulary skip-set, and a within-shortlist collision-scoping requirement are added on top of it. The actual sub-district RESOLUTION (`resolveExactInsideAdminAreaIds`/`resolveSubDistrictAdminAreaId`, both already calling the shared `matchAdminArea`, CAM-587) is proven correct and is not touched. No schema/migration — the shortlist is a generated, committed data artifact (`prisma/data/subdistrict-shortlist.json`), regenerated offline by `scripts/generate-subdistrict-shortlist.mjs` from the live camp data (see tech.md "Build-time or runtime" for the full reasoning and staleness handling).
Depends on: CAM-596 (district-through-the-model, the sibling this story completes and reconciles precedence with), CAM-599 (named-district-beats-landmark, the precedence this story fits into), CAM-587 (wired subDistrict into the tool; this story is its gap), CAM-566 (shared `matchAdminArea`), CAM-501/502/503/504 (the existing pre-pass this story extends).

## AC
<!-- "Then" describes the observable result (which camps/how many, or the honest not-found phrasing) — the same convention CAM-587's/CAM-596's own story.md use for this tool. -->
| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper names a real, camp-holding sub-district by itself (e.g. "ลานกางเต็นท์แสนสุข") | The camper sends the message to น้องกองไฟ | The assistant shows the real, specific sub-district's camp(s) — narrower than (or equal to, when it is the district's only camp-holding sub-district) the district-wide result — never a wider, unscoped answer | The pre-pass detects the shortlisted sub-district and injects a MANDATORY hint (`subDistrict` + its owning `district`); the model calls `searchCampsites` this turn; the existing, unchanged resolver returns the matching camp(s) | EC-1 |
| AC-2 | The camper's message contains an ordinary Thai word that also happens to be a shortlisted sub-district name (e.g. ถนน "road", ตลาด "market") | The camper sends an ordinary sentence using that word normally (e.g. asking for a campsite "ริมถนน") | The assistant behaves exactly as if no place were named at all by that word — it is never hijacked into a narrow, wrong sub-district search | The pre-pass excludes that candidate entirely (length floor); no `subDistrict` hint fires for it | EC-2 |
| AC-3 | The camper names a sub-district whose exact name repeats in more than one province within the shortlist (e.g. "ในเมือง"), with NO province or district named in the same message | The camper sends the message | The assistant does not silently guess one of the several real places — it behaves as if that word resolved to nothing more specific (falls through to whatever coarser place, if any, the rest of the message still names) | No `subDistrict` hint fires; the ambiguity is never guessed | EC-3 |
| AC-4 | The SAME colliding sub-district name is named together with one of its real owning provinces (or districts) in the same message | The camper sends the message | The assistant shows the camps for that EXACT sub-district (the specific province/district resolves which one) | The pre-pass confirms the one matching entry and hints `subDistrict` + its own `district` together | EC-4 |

## Rules
- BR-1 The candidate list is built ONLY from `prisma/data/subdistrict-shortlist.json` — every SUBDISTRICT-level `AdminArea` currently holding >=1 published (`isActive`, not soft-deleted) camp, generated offline (never a DB round-trip inside the pre-pass — `resolvePlace` stays pure/synchronous, the same load-bearing constraint CAM-596 established).
- BR-2 A candidate shorter than 5 Thai characters is excluded entirely (measured: this story's own named risk words — ตลาด, ถนน, ช่อง, บ่อ, ดู่, ปอ — are ALL <=4 Thai characters; the floor is set one character above CAM-596's own district-level floor because the collision risk is measurably denser at this level).
- BR-3 A curated, small skip-set additionally excludes a shortlisted name that is ALSO ordinary, high-frequency Thai vocabulary even at 5+ characters (measured: "เหนือ" — north/above — is a real, shortlisted sub-district AND the exact word CAM-596's own docblock names as an unguardable collision; "สะอาด"/"สำราญ" — clean/relaxed, common adjectives — are the same class at the same length). Not exhaustive — a follow-up ticket only if evals surface a further, evidenced miss (the same acceptance CAM-596 records for its own guards).
- BR-4 A candidate that is a substring of (or identical to) any real province's own Thai name is excluded entirely, reusing the SAME `isSubstringOfAnyProvince` guard CAM-596's district candidates already use (measured: shortlisted "สระแก้ว"/"หนองบัว"/"ประจวบคีรีขันธ์"/"บึงกาฬ" each collide with a real province name).
- BR-5 A shortlisted name that repeats across >1 province WITHIN the shortlist itself (measured: 13 names, e.g. "ในเมือง" in 5 provinces) is hinted ONLY when the SAME message also names ONE of that specific entry's own district or province names — resolved to EXACTLY one candidate, never more than one. A district-name check is skipped when it would be identical to the sub-district's own name (measured tautology: shortlisted "บ้านแหลม" has an entry whose own district is ALSO named "บ้านแหลม", which would otherwise trivially "confirm itself" on every bare mention).
- BR-6 Precedence (extends CAM-599's ladder): explicit "อำเภอ"/"อ." district marker > landmark (bare mention) > bare Bangkok mention > **shortlisted sub-district (this story)** > plain district (CAM-596) > province > region. A sub-district is more specific than a district, so it is checked before the plain district detector — but a landmark bare mention (which can span multiple provinces) still wins over an automatic sub-district match on the same name (measured sibling conflict: "เขาค้อ" is BOTH a context-guarded landmark AND a real, shortlisted sub-district — a bare, marker-less mention must keep resolving as the landmark's area radius, unchanged).
- BR-7 A hinted sub-district is ALWAYS paired with its own, known-correct owning `district` — never alone — because the tool's own (unchanged) resolution only properly scopes a `subDistrict` argument via a `district` parentId; 155 of the 422 shortlisted names ALSO exist as a different, camp-less sub-district elsewhere in Thailand, so omitting `district` risks the resolver matching the wrong row.

## Edge cases
- EC-1 IF the shortlisted sub-district candidate found in the text fails BR-2/BR-3/BR-4 THEN the pre-pass does not hint it at all — the message falls through to district/province/region detection exactly as it did before this story.
- EC-2 IF an excluded (BR-2/BR-3) candidate's word appears in an ordinary, unrelated sentence THEN nothing this story added ever fires for it — proven with a red-then-green regression test on the exact ticket-named words (ตลาด/ถนน).
- EC-3 IF a colliding (BR-5) candidate has zero or more than one confirming district/province match in the text THEN it is skipped (not hinted), and scanning continues for any other, resolvable candidate elsewhere in the text.
- EC-4 IF a colliding (BR-5) candidate has EXACTLY one confirming match THEN it is hinted, paired with that confirmed entry's own district (BR-7).

## Data
- No schema/migration. New generated data artifact `prisma/data/subdistrict-shortlist.json` (`{nameTh, districtNameTh, provinceNameTh}[]`, 422 rows measured against the dev DB today) — regenerated offline by `scripts/generate-subdistrict-shortlist.mjs`; ships alongside the artifact (see tech.md "Build-time or runtime").

## Seams & refs
- Reuse: `lib/ai/place-resolver.ts`'s existing `resolvePlace`/`detectDistrict`/`detectLandmark`/`isSubstringOfAnyProvince`/`hasCampingContextMarker` idioms (longest-match-first, context-guard, curated ambiguous-name exclusion) — the new sub-district detector is a new candidate list scanned with the SAME mechanism. `lib/geo/admin-area-match.ts`'s `matchAdminArea` (CAM-566) and `lib/ai/tools/search-campsites.ts`'s `resolveSubDistrictAdminAreaId`/`resolveExactInsideAdminAreaIds` (CAM-587) are reused UNCHANGED — this story never touches them (out of file surface). Refs: CAM-596 tech.md (the district detector this mirrors and reconciles precedence with) · CAM-599 tech.md (the explicit-marker precedence this story's own BR-6 extends) · CAM-587 story.md (the resolution layer this story reaches).

## Out of scope
- Automating the shortlist's regeneration cadence (e.g. a scheduled CI job that opens a PR when new camp data changes the shortlist) — the generator script is manual/on-demand today; a follow-up ticket if staleness proves a real, recurring gap.
- An exhaustive, hand-curated list of every possible ordinary-Thai-word collision beyond the 3 measured entries (BR-3) — accepted under the same EC-4-style substring tolerance the district/province/landmark detectors already carry; a follow-up ticket only if evals show a further, evidenced miss.
- Changing `resolveExactInsideAdminAreaIds`'s own resolution/scoping logic in `search-campsites.ts` — CAM-587 proved it correct; this story is only about the model reaching it with the right arguments.

## Self-verify
- AC-1..4 → unit (`__tests__/cam-600-*.test.ts`, mirrors `cam-596`/`cam-599` convention) for the pre-pass detector + hint-block wording + tool-description reconciliation, plus a real-model behavioral run via a new guardrail golden case (`GEO-7-CAM600-SUBDISTRICT`, CAM-500 lesson: a prompt/pre-pass change is verified through the model, or it is not verified).
- Story-specific: every BR-2..7 guard gets its own red-then-green-class regression test (the DEF-1/DEF-2 convention); the precedence ladder (BR-6) is pinned directly against the measured "เขาค้อ" landmark/sub-district sibling conflict; the full existing `cam-501`/`cam-502`/`cam-503`/`cam-504`/`cam-596`/`cam-599` suites (133 tests) re-run green, unmodified — proving this story's insertion point never shadows an existing pinned fixture.
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created; documents the shipped design (shortlist artifact + 4 measured guards + precedence reconciliation with CAM-596/CAM-599).
