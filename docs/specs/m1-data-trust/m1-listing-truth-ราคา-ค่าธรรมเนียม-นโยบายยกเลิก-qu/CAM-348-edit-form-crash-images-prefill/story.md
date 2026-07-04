---
linear: CAM-348
feature: m1-data-trust
epic: m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu (CAM-288)
persona: host
artifact: story
class: spec-lite
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-04
---
# Edit form crashes on open: images prefill still parses CSV after the S4b relation (CAM-348)

## Story
As a **Host**, I want the campsite edit form to open without crashing, so that I can actually edit my listing (including everything the M1 completeness card sends me here to fix).
Why: defect found by the owner during M1 G4 verification. `GET /api/campsites/[id]` returns `images` as an `Image[]` relation (S4b) but `CampgroundForm`'s prefill still calls `initialData.images.split(',')` — an array has no `.split`, so opening the edit page throws a client-side TypeError into the dashboard error boundary for EVERY camp (with or without photos; `[]` is truthy). Pre-existing since the S4b payload change; exposed today because CAM-305's completeness-card deep-links gave hosts a direct path in.
Scope: normalize the prefill only. Single surface (`components/CampgroundForm.tsx`), no API change, no schema change → spec-lite; this story.md rides the fix PR.
Depends on: — (S4b image relation and CAM-305 links are shipped context, not blockers)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host owns a camp with photos (images = Image rows) | The host opens the camp's edit page | The form renders with the existing photos shown in the media section (no error page) | Prefill maps each Image row to its `url`; form state holds the url list the PUT contract expects | EC-1 |
| AC-2 | A host owns a camp with no photos | The host opens the edit page (including via a completeness-card deep-link) | The form renders with an empty media section (no error page) | Prefill yields an empty list; nothing is written | EC-1 |

## Rules
- BR-1 One normalizer, `toImageUrlList(images)`: `Image[]`/string[] → url list (blank/null rows dropped) · legacy CSV string → split list · null/undefined/anything else → `[]`. Exported for behavioral tests. (proves AC-1, AC-2)

## Edge cases
- EC-1 IF `initialData.images` is null, undefined, `[]`, an array containing rows without a `url`, or a non-string/non-array value THEN the prefill yields `[]` (or the valid urls only) and never throws (BR-1)

## Data
- Read-only form-state fix. No schema change, no migration, no API change. The PUT contract (`imageReplaceNested(urls: string[])`) is unchanged and already matches the normalized shape.

## Seams & refs
- `components/CampgroundForm.tsx` — the only `.images.split(` site in the repo (swept). `lib/spot-aggregation.ts:getCampSiteWithCapacity` (the GET's shape, `include: { images }`) and `lib/api-utils.ts:imageReplaceNested` (the PUT contract) are read-only context, untouched.

## Out of scope
- Guarding the neighboring `groundType` `JSON.parse` (no crash observed; separate hardening if it ever fires) · any media-upload behavior change.

## Self-verify
- AC-1/AC-2/EC-1 → unit tests on the exported `toImageUrlList` (Image rows · string array · CSV string · "" · null · undefined · rows missing url) + source-inspection: prefill uses the helper and no `.images.split(` remains in the form.
- Gate = /quality-gate · Done = owner reopens the edit page on the real Staging URL without the error page.

## Changelog
- v1 (2026-07-04) — created as spec-lite with the fix PR (defect from owner G4 verification of the M1 batch).
