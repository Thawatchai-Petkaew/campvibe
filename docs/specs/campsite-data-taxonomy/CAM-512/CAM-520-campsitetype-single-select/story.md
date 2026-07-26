---
ticket: CAM-520
epic: CAM-512
title: Campground-type is single-select — match form to the scalar column (follow-up)
class: spec-lite
version: 1
---

# CAM-520 — Campground-type single-select (follow-up)

## Story

As a **host**, I want the "ประเภทแคมป์" field to be a single choice that actually saves, so that picking a type isn't silently truncated and I'm not shown a misleading "เลือกได้หลายอย่าง" hint the storage can't honor.

Scope: align the 2 out-of-step layers (host form + zod) to the scalar `campSiteType` column — make it a SINGLE-select. Remove the array→`[0]` coercion + the invalid "CAMPGROUND" sentinel in the write paths. NO migration (existing stored values are already correct single scalars).
Depends on: — . Found by QA in CAM-517.

Why: QA-flagged data-integrity gap — form + zod treat `campSiteType` as a multi-select array; the DB column + 5 downstream consumers (write, detail display, AI/catalog filter, seed, mock) are scalar. Today a multi-select silently keeps only `[0]`; an empty array writes `"CAMPGROUND"` (not a valid `CampSiteTypeEnum` code, no label, matches no filter).

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Host on the campground form | picks a campground type | It behaves as a single choice (picking one deselects the others); no "เลือกได้หลายอย่าง" hint | one code saved to the scalar `campSiteType` | EC-1 |
| AC-2 | Host edits an existing camp | opens the form | The camp's current type is pre-selected (single) | round-trips unchanged | — |
| AC-3 | Host saves | POST/PUT | The chosen code is written verbatim (no `[0]` coercion, no "CAMPGROUND" fallback) | scalar column = the picked code | EC-2 |

## Rules

- BR-1: `lib/validations/campsite.ts` — `campSiteType` becomes a single `CampSiteTypeEnum` (required on POST; the PUT `.partial()` makes it optional on update). Drop `z.array(...).default([])`.
- BR-2: `components/CampgroundForm.tsx` — model it as a single string (state `campSiteType: string`); the type block becomes single-select (choosing one clears the others — a radio-style toggle, reuse the existing button visual). Remove the `multipleSelection` label for this field. Edit-prefill sets the scalar directly; default (create) pre-selects the first option (column is non-nullable). Payload sends the single string.
- BR-3: `app/api/campsites/route.ts` POST + `app/api/campsites/[id]/route.ts` PUT — remove the `Array.isArray(data.campSiteType) ? data.campSiteType[0] : ...` coercion and the `|| "CAMPGROUND"` fallback; write `data.campSiteType` directly (POST required; PUT guarded on presence).
- BR-4: Do NOT touch the scalar column, the AI/catalog `type` filter (already scalar-equals), the detail display (already single), seed, or mock — they're correct.

## Edge cases

- EC-1: the field must never end up empty on create (column is non-nullable) — the create default pre-selects a valid code.
- EC-2: a legacy camp whose stored value is the invalid "CAMPGROUND" sentinel (if any exist) → the edit-prefill should fall back to a valid default rather than crash; a quick data check for existing "CAMPGROUND" rows is a nice-to-have (likely none, latent path).

## Data

None — no schema change, no migration. (Optional: a one-off check/update for any stored "CAMPGROUND" sentinel value.)

## Seams & refs

- `lib/validations/campsite.ts:58` (the `z.array` → single enum) + `CampSiteTypeEnum:5-13`.
- `components/CampgroundForm.tsx:232` (state), `:307-311` (create default), `:325` (edit prefill), `:1230` (drop multiSelect label), `:1235-1262` (single-select render), `:546` (payload), `toggleArrayItem:424` (use a single-set instead for this field).
- `app/api/campsites/route.ts:236` + `app/api/campsites/[id]/route.ts:174` (drop the `[0]`/"CAMPGROUND" coercion).
- Tests: a `__tests__/cam-520-*.test.ts` (or extend cam-356/host-form tests) — the write path stores the picked code verbatim; empty→valid-default; zod rejects an array now. Prove teeth.

## Out of scope

- Making `campSiteType` genuinely multi-value (a column→relation migration) — not needed; product stores one type per camp.

## Self-verify

- [ ] `npx tsc --noEmit` + `npm run lint` clean; host-form + campsite-schema tests green + teeth
- [ ] form is single-select; POST/PUT write the code verbatim (no `[0]`/"CAMPGROUND"); zod is a single enum
- [ ] edit round-trips; create pre-selects a valid default; no migration
