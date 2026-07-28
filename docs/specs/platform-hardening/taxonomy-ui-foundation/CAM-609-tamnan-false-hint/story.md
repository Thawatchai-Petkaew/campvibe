---
linear: CAM-609
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: story
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Saying a tent is legendary sends the camper to Phatthalung (CAM-609)

## Story
As the **Camper**, I want an ordinary word that only coincidentally matches a real sub-district name to stay ordinary when I use it in an unrelated sentence, so that describing a tent as "legendary" (`รุ่นตำนาน`) never quietly narrows my search to a district in Phatthalung I never named.
Why: `ตำนาน` ("legend"/"myth") is a real, camp-holding sub-district (ตำบลตำนาน, เมืองพัทลุง) that CAM-606's regeneration made newly searchable. It is exactly 5 Thai characters (CAM-600's length floor excludes only `< 5`) and was not in `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` when that story shipped, because the word did not exist in the 422-row list CAM-600 authored against. CAM-606 found and deliberately did not fix it (out of that story's file surface); this is that follow-up.
Scope: add `ตำนาน` to the existing `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` skip-set in `lib/ai/place-resolver.ts`, AND add the missing explicit-marker detection path this fix requires once it's confirmed the skip-set is consulted by the ONLY sub-district code path today (no marked-vs-unmarked split yet exists) — so a camper who explicitly writes `ตำบลตำนาน` still resolves the real place. Also re-scans the full, now-503-row shortlist for other same-class vocabulary risk and reports (not necessarily fixes) what is found. Does not touch the shortlist data file, the generator/drift scripts, or any other guard's calibration.
Depends on: CAM-600 (the shortlist detector + its guards) · CAM-606 (the regeneration that surfaced this specific word, named but not fixed).

## AC
<!-- Internal AI-assistant resolution behavior (`resolvePlace`), not end-user-facing UI copy in this story — "Then" states the observable resolver output for a given free-text input. -->
| # | Given | When | Then (observable behavior) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper's message contains the bare word `ตำนาน` with no explicit `ตำบล` marker, in an ordinary sentence about a tent (e.g. `เต็นท์รุ่นตำนาน`) | `resolvePlace` runs its pre-pass over the message | The resolver returns `{}` — no place hinted at all | No `subDistrict`/`district` hint reaches the model; the search tool is never mandatorily narrowed to เมืองพัทลุง | EC-1 |
| AC-2 | A camper's message contains `ตำบลตำนาน` — the explicit sub-district marker directly in front of the name | `resolvePlace` runs its pre-pass | The resolver returns `{subDistrict: "ตำนาน", district: "เมืองพัทลุง"}` — the real place still resolves | The search tool is correctly, deterministically scoped to the real ตำบลตำนาน | EC-2 |
| AC-3 | The six CAM-600 negative-case phrases (ordinary Thai words that happen to be short/curated-risk sub-district names), re-run against the current 503-row shortlist | A camper's message contains one of them, unrelated to any real place | `resolvePlace` still returns `{}` for every one, individually confirmed | The length floor + `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` skip-set continue excluding these names; adding `ตำนาน` introduces no side effect on the other three curated words | EC-3 |
| AC-4 | The five CAM-596/599/600/606 sibling fixtures (แม่ริม, อำเภอปาย, เชียงใหม่, ใกล้เขาใหญ่, ป่าตอง) | A camper's message names one of them | Each resolves exactly as before this story, individually confirmed | No regression at the district/province/landmark/newly-regenerated-subdistrict levels | EC-4 |
| AC-5 | The full, current 503-row shortlist | The Backend re-scans every surviving candidate name for the same ordinary-vocabulary collision class this ticket fixes for `ตำนาน` | Every name found is reported (fixed or not) in the PR body, naming the specific name, its risk reasoning, and whether it is already mitigated by an existing guard (e.g. within-shortlist collision-scoping) | No new guard is added purely from this re-scan unless it is the same, narrow, evidenced class as `ตำนาน` itself | — (a reporting AC, not a pass/fail system behavior; its own thoroughness is the check) |

## Rules
- BR-1 `ตำนาน` is added to `AMBIGUOUS_SUBDISTRICT_VOCAB_TH`, excluding it from the bare/unmarked candidate set exactly like `เหนือ`/`สะอาด`/`สำราญ` already are — same mechanism, no new guard category for the unmarked path.
- BR-2 An explicit `ตำบล` marker directly in front of a shortlisted name is the camper's own grammatical declaration of sub-district intent — the identical reasoning CAM-599 already established for `อำเภอ`/`อ.` in front of a district name. A marked mention bypasses ONLY the ordinary-vocabulary skip-set (BR-1's guard) — the length floor and the substring-of-any-province guard still apply unchanged, because neither of those is an ambiguity a marker resolves (a name too short to be meaningful, or one that exactly duplicates a real province's own name, stays excluded even when marked).
- BR-3 A shortlisted name that collides WITH ITSELF (repeats across >1 province) is still required to be scoped by a co-occurring district/province name in the same message before the explicit-marker path fires it, too — reusing the existing `resolveAmbiguousSubDistrictEntry` unchanged. An unresolvable ambiguity is never guessed, marked or not.
- BR-4 No other guard's calibration (length floor value, existing three vocab entries, substring-of-province logic) changes. This is a vocabulary-set addition + a marker-detection path, not an algorithm change.

## Edge cases
- EC-1 IF the bare word `ตำนาน` appears in a sentence with no `ตำบล` marker THEN `resolvePlace` returns `{}` for the sub-district level (falls through to district/province/region exactly as CAM-600 already specifies for any excluded candidate).
- EC-2 IF the `ตำบล`-marked form `ตำบลตำนาน` appears THEN the sub-district still resolves — the fix must not blanket-ban the word, only its unmarked/ambiguous use.
- EC-3 IF re-running the six CAM-600 negative phrases after this change produces anything other than `{}` THEN the vocabulary addition or marker path introduced a regression — stop before committing (none found).
- EC-4 IF the re-scan (AC-5) finds another name in the same evidenced class (an ordinary, high-frequency Thai word or common compound that clears the 5-character floor and is not already mitigated by within-shortlist collision-scoping) THEN it is named explicitly in the PR body with its risk reasoning — it is not silently added to the skip-set under this ticket unless the ticket's own scope already covers it (it does not; only `ตำนาน` is fixed here).
- EC-5 IF the re-scan surfaces a *structural* gap (a guard category that exists for districts but was never ported to sub-districts, e.g. a context-guard for an ordinary-word PREFIX) THEN that is reported as a distinct, named finding — not treated as "more vocabulary" and not fixed under this ticket (per the dispatch's own instruction: a vocabulary problem gets a vocabulary fix; a structural finding is reported, not acted on).

## Data
- No entity/field/schema change. `lib/ai/place-resolver.ts` only: one set-literal addition (`ตำนาน`) + one new, narrowly-scoped detection function + its candidate list (module-load-time, derived from the existing, unmodified `subdistrict-shortlist.json` import — no new data file). Migration: none.

## Seams & refs
- Reuse: `AMBIGUOUS_SUBDISTRICT_VOCAB_TH` (CAM-600) · `resolveAmbiguousSubDistrictEntry` (CAM-600, unchanged, reused for the marked path's own collision-scoping) · `detectExplicitDistrictPrefix`'s own established pattern (CAM-599 — "a marker candidate list, built once, bypassing only the guards a marker resolves") — this story's marker path mirrors that shape for sub-districts, not a new pattern.
- Refs: CAM-600 tech.md (the guard set + its own documented calibration) · CAM-606 tech.md (the finding this ticket closes) · CAM-599 tech.md (the explicit-marker precedent this story's fix shape follows).

## Out of scope
- Any change to `prisma/data/subdistrict-shortlist.json`, `scripts/generate-subdistrict-shortlist.mjs`, or `scripts/check-subdistrict-shortlist-drift.mjs` — none are touched.
- Widening the length floor (`MIN_SUBDISTRICT_NAME_LENGTH`) or changing the substring-of-province guard's logic — explicitly out of scope per the ticket; any belief that the floor itself needs to change at 503 names is a reported finding, not an action, in this story.
- Adding every other candidate word the re-scan surfaces to the skip-set — only `ตำนาน` is fixed; further words are named findings routed to a follow-up ticket if the owner wants them acted on.
- A `ท่า`/`เมือง`-prefix context-guard for sub-districts (the structural finding, if surfaced by the re-scan) — reported only, not built here; it is the same shape of work CAM-596 already did for districts, sized as its own ticket.

## Self-verify
- AC-1/AC-2 → `__tests__/cam-609-tamnan-false-hint.test.ts`, both bare phrases from the ticket's own reproduction + the `ตำบล`-marked phrase, each asserted individually.
- AC-3/AC-4 → same test file, `it.each` over the six negatives and the five siblings, each asserted individually (not just "all pass").
- AC-5 → reported in the PR body: the full re-scan method (script + guard replica), the candidate names found, and for each one the risk reasoning + whether an existing guard (e.g. multi-entry collision-scoping) already mitigates it.
- Story-specific: no migration (N/A) · `npx vitest run` full suite as the LAST act, including the pre-existing CAM-606 "documented finding, NOT desired behavior" tests, which this story updates to assert the now-fixed behavior (the finding they documented is the exact bug this ticket closes) · `ai-guardrail-gate` run once (real model, ~$4 remaining budget) and its result reported verbatim.
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created.
