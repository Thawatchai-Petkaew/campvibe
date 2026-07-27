## Story
As a **Camper**, I want the province filter dropdown to show province names in whichever language I'm using the site in, so that I can read and choose my own province instead of a list stuck in English.
Why: owner-reported defect from the search modal (2026-07-27) — the province dropdown listed Amnat Charoen, Ang Thong, Bangkok, etc. in English while the UI language was Thai. Cause confirmed (not re-investigated from scratch): `app/actions/getSearchLocations.ts` returned `string[]` built straight from `camp.location.province`, the raw free-text column that stores English (CAM-553's import), and `components/SearchModal.tsx` rendered those strings verbatim as option labels. CAM-563's own inventory named this file as still on the legacy string path, and CAM-573 moved its neighbours (`CatalogResults`, `getCampSiteCount`) onto AdminArea — but this reader returns a **display** value rather than a filter value, so it fell outside that story's shape and was left behind.
Scope: `getSearchProvinces()` now returns the AdminArea PROVINCE node's `{id, nameTh, nameEn}` for each raw province string that has ≥1 published camp (same visibility predicate, unchanged), resolved via one batched `AdminArea` lookup (no N+1). `SearchModal.tsx`'s province `<Select>` renders the label by the active UI language and sorts the list by that same displayed language (`Intl.Collator`). The value the modal **submits** stays the raw English string (`nameEn`), byte-identical to before — `lib/campsite-filters.ts` is **not touched** (see the decision below). Does not touch the mobile full-screen behaviour of the search dialog (CAM-561, unrelated).
Depends on: CAM-563 (`resolveProvinceAdminAreaIds`, `AdminArea` model + `nameTh`/`nameEn`, already accepted) · CAM-573 (moved this reader's siblings onto AdminArea; this story finishes the set it left named-but-undone).

**Decision — which value the modal submits (the trap this whole arc has been about):** kept submitting the canonical English string (`nameEn`, unchanged) rather than moving the whole path onto AdminArea ids. Reasoning: `lib/campsite-filters.ts`'s province branch still matches by **exact string equality** on `Location.province`; changing the submitted value without changing the matcher returns **zero results, silently** (no error, no log — the exact failure mode CAM-563/573 built `provinceAdminAreaIds` to catch when it DOES diverge). Measured against the real dev DB (see Self-verify): every one of the 76 distinct provinces with a published camp resolves case-insensitively to an `AdminArea` PROVINCE node's `nameEn` with zero mismatches, so `nameEn` is a safe, stable submission value today. Moving to ids would touch `lib/campsite-filters.ts` (currently keys its OR-boost on the caller supplying `provinceAdminAreaIds` derived from the *same submitted string*) and every consumer's expectation that `?province=` is a human-readable English name — a bigger, riskier change for a label-only defect. This is the smaller, safer option; `lib/campsite-filters.ts` is unedited in this story.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | UI language is Thai (`campvibe_lang=th`) | Camper opens the search modal and the province dropdown loads | Every option shows its Thai name (e.g. `เชียงใหม่`, not `Chiang Mai`); `t.search.anyProvince` (`ทั้งหมด`/equivalent) still the first row | `getSearchProvinces()` returns `{id, nameTh, nameEn}` per province; the modal renders `nameTh` | EC-1 |
| AC-2 | UI language is English (`campvibe_lang=en`) | Camper opens the search modal and the province dropdown loads | Every option shows its English name (e.g. `Chiang Mai`) | Same data, renders `nameEn` | AC-1 |
| AC-3 | UI language is Thai, dropdown open | Camper selects `เชียงใหม่` and presses search | Results load for Chiang Mai camps, no `แคมป์นี้เต็มแล้ว`/zero-result surprise | The URL carries `?province=Chiang%20Mai` (the unchanged `nameEn` value, per BR-2); the catalog's exact-string matcher still matches it, returning a non-zero count (18 in the dev DB) | EC-2 |
| AC-4 | UI language is Thai | Camper opens the dropdown | Options appear in Thai alphabetical order, not English order with a Thai label pasted on top | Client sorts the fetched list via `Intl.Collator('th')` keyed to `nameTh` before rendering | — (cosmetic ordering, no negative twin: any order is "safe", this AC is about correctness of the perceived order only) |
| AC-5 | Zero provinces currently have a published camp | Camper opens the dropdown | `t.search.provinceEmpty` (`ยังไม่มีจังหวัดให้เลือก`) renders, not a bare empty list | `getSearchProvinces()` returns `{status:'ok', provinces:[]}`, distinguishable from an error | EC-3 |
| AC-6 | The province fetch fails (DB error) | Camper opens the dropdown | `t.search.provinceLoadFailed` (`โหลดรายชื่อจังหวัดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง`) + a retry button | `getSearchProvinces()` returns `{status:'error'}`, dropdown stays disabled | EC-3 |

## Rules
- BR-1 The dropdown LABEL follows the active UI language (`nameTh` when `language==='th'`, `nameEn` when `language==='en'`); the SUBMITTED value is always `nameEn` regardless of the active language (proves AC-1/AC-2/AC-3).
- BR-2 (the trap) `nameEn` stays byte-identical to the raw `Location.province` string the option was built from — never normalized/re-cased before being used as the `SelectItem` value — because `lib/campsite-filters.ts`'s province filter still matches it by exact string equality (proves AC-3; violating this silently zeroes every result for that province).
- BR-3 The displayed list sorts by the DISPLAYED field (`nameTh` under Thai via `Intl.Collator('th')`, `nameEn` under English via `Intl.Collator('en')`), recomputed client-side whenever the active language changes (proves AC-4).
- BR-4 A raw province string with no matching `AdminArea` PROVINCE node (defensive; none exist in the dev DB today) falls back to itself for `nameTh`/`id` — the option still renders and is still selectable, never dropped or crashed (proves AC-1/AC-2 non-regression on unmapped data).
- BR-5 The empty-vs-error distinction (`{status:'ok', provinces:[]}` vs `{status:'error'}`) is unchanged by this story's shape change (proves AC-5/AC-6).

## Edge cases
- EC-1 IF a raw province string matches no `AdminArea` PROVINCE node THEN the option renders with `nameTh = nameEn` (English text shown even under Thai) rather than being dropped — an explicit, logged-nowhere fallback, acceptable because CAM-553's import leaves no such row in the dev DB today (BR-4)
- EC-2 IF the camper submits a province whose `nameEn` no longer matches any `Location.province` row (should not happen — the option is only ever offered when `buildCampSiteWhere({})` found ≥1 camp) THEN the catalog returns zero results the same way it always has for a stale/mistyped value — this story does not change that behavior (BR-2)
- EC-3 IF `getSearchProvinces()` resolves `{status:'error'}` THEN the Select stays `disabled`, `ErrorBanner` + a retry control render, and the retry re-invokes the same load function (BR-5, unchanged from CAM-531)

## Data
- No schema/migration. Reads `AdminArea` (existing, CAM-553/563) `{id, nameTh, nameEn}` for `level='PROVINCE', countryCode='TH'` — one batched query, not new data.

## Seams & refs
- Reuse: `lib/campsite-filters.ts`'s `buildCampSiteWhere`/`resolveProvinceAdminAreaIds` (CAM-563) — unmodified; this story does not touch the matcher (see the Decision above). `unstable_cache` + `CATALOG_TAG` pattern from `lib/catalog-cache.ts` (unchanged, already in `getSearchLocations.ts` since CAM-531).
- Reader/writer sweep (architecture.md §15b): this story changes the SHAPE of `getSearchProvinces()`'s return value. Grep `getSearchProvinces` / `getSearchLocations` across `app/`, `components/`, `__tests__/`, `e2e/` — the only readers are `components/SearchModal.tsx` (updated, in-surface) and `__tests__/cam-531-province-source.test.ts` (updated in place, out-of-surface pinned assertions on the old shape — see PR). `e2e/regression/cam-540-dialog-select-dismiss.spec.ts` and `cam-561-mobile-search-fullscreen.spec.ts` only click the `select--search-province` testid, never assert option text — unaffected, confirmed by reading both files.
- Refs: none (no ADR — read-side label/sort fix on an already-accepted data model, same class as CAM-573).

## Out of scope
- Moving the province filter's submitted value onto AdminArea ids (`lib/campsite-filters.ts`) — deliberately deferred (see Decision above); the `provinceAdminAreaIds` OR-boost already covers the bilingual-mismatch case this would otherwise be for. Follow-up only if a real bilingual-drift camp is found.
- CAM-561's mobile full-screen search dialog behaviour — untouched, out of this story's file surface per dispatch.

## Self-verify
- AC-1/AC-2/AC-4 → owner-verify (browser-only: rendered option text + order, `campvibe_lang` set via `addInitScript` against `localhost:3000`) + unit (`__tests__/cam-589-province-filter-labels.test.ts`, source-inspection of the language-keyed label/sort code)
- AC-3 (canary) → unit (`buildCampSiteWhere({province: option.nameEn})` round-trip) + real DB (`prisma.campSite.count({location:{province:'Chiang Mai'}})` = **18**, ad-hoc script against the local dev DB) + real HTTP (`GET /api/campsites?province=Chiang%20Mai` against the running dev server) — both asserted as the number 18, recorded in the PR body
- AC-5/AC-6 → unit (unchanged coverage in `cam-531-province-source.test.ts`, re-verified green after the shape change)
- Story-specific: no migration (N/A) · `lib/campsite-filters.ts` untouched (grep-confirmed 0 diff lines in that file)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-27) — created
