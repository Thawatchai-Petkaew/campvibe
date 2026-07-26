---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: done
version: v2
updated: 2026-07-26
---
# Tech — Backfill district/sub-district from coordinates (CAM-562)

## Data model

**No migration.** `Location.adminAreaId`/`district`/`subDistrict` all already exist on the schema (see CAM-563's tech.md). Confirmed against the real dev DB:

```
$ prisma migrate status
23 migrations found in prisma/migrations
Database schema is up to date!
```
`git status --short prisma/migrations/ prisma/schema.prisma` is empty. This story is a script-only change.

## Real-run result (real dev DB, key restriction fixed by the owner mid-story)

**Dry-run projection (real Google calls, zero writes):**

| | count |
|---|---|
| candidates scanned | 650 |
| would resolve to sub-district | 519 |
| would resolve to district only | 17 |
| province mismatch (would NOT write) | 83 |
| unresolved (would NOT write) | 31 |
| Google Geocoding calls made | 650 |

**Real run — verified by querying the database myself, not the script's log:**

```
prisma.location.count({ where: { district: { not: null } } })    → 536
prisma.location.count({ where: { subDistrict: { not: null } } }) → 519
prisma.location groupBy adminArea.level (adminAreaId not null)   → { SUBDISTRICT: 519, DISTRICT: 17, PROVINCE: 114 }
```
114 = 83 province-mismatch + 31 unresolved, left untouched at PROVINCE level exactly as designed (never re-homed, never guessed). `district`/`subDistrict` fill rate: **519/650 (79.8%) reached sub-district, 536/650 (82.5%) reached at least district.**

**Google Geocoding calls actually spent (owner is billed for this): 650, once.** The dry-run made all 650 calls; the real run (and every subsequent run) reused the `Location.id`-keyed cache and made **zero** additional calls — proven live, not just in the unit suite.

**Language distribution of what this run wrote (the owner's explicit ask — state this run's contribution to the existing CAM-559 Thai/English mix):** **536 English, 0 Thai.** Every stored `Location.province` value in this dataset is English today (0 Thai-stored rows — matches CAM-563's own measurement), so BR-4 (write in the row's existing language) produced 100% English `district`/`subDistrict` writes this round. Independently re-verified with a separate regex scan of the written `district` values for Thai script — 0 Thai, 536 English, matching the script's own count exactly.

**Province mismatch (83 of 650, 12.8%) — reported, NOT written, per BR-2/BR-3.** Every mismatch pair is between geographically ADJACENT Thai provinces (e.g. stored `Phetchabun` → geocoded `Loei`; stored `Bangkok` → geocoded `Samut Prakan`/`Nonthaburi`/`Samut Sakhon`; stored `Lamphun` → geocoded `Chiang Mai`) — never a random or nonsensical pair. This is consistent with the seeded camps' coordinates sitting close to a provincial border rather than a matcher defect; this story does not investigate or fix the seed data (out of scope — see Out of scope in story.md), it only guarantees the mismatch is surfaced, not silently applied. Full list of all 83 (id, stored province, geocoded province, both languages) is in the PR body and the real run's own log.

**Unresolved (31 of 650, 4.8%) — reported, NOT written.** Breakdown by reason:
- `province_unmatched` (16 rows): the geocoded province string names a foreign administrative region — Laos (`Bolikhamsai Province`, `Khammouane Province`, `คำม่วน`, `Vientiane Prefecture`, `สะหวันนะเขต`), Myanmar (`Tanintharyi Region`), or Malaysia (`Perlis`/`ปะลิส`) — i.e. these camps' coordinates sit near/across a national border, outside the AdminArea (TH-only) tree entirely. Real geography, not a bug: Thailand's rectangular bounding box (which the ticket's own pre-check used) always includes slivers of neighboring countries; only a real reverse-geocode reveals this.
- `district_unmatched` (9 rows): Google's district-level component text doesn't match any AdminArea DISTRICT node under the (already-agreed) province — mostly a bare `เมือง`/`อ.เมือง` (Mueang, generic "town") without the province name Google normally appends, or a border-adjacent locality (`Krabi` appearing as a level-2 component for what should be a different level).
- `no_province_component` / `no_district_component` (6 rows): Google's response for that exact lat/lon didn't carry the expected `address_components` type.

**No matcher tuning was done to inflate this rate.** Per the coordinator's explicit instruction, a low/moderate fill rate is reported as-is; the reused `matchAdminAreaByName`/`normalizeAdminAreaName` (CAM-563's own tested matcher) was not modified.

## Bug found + fixed via the second-run proof (Prove-It, `.claude/rules/qa.md`)

Running the (now-working) backfill a **second** time in a row — exactly what the coordinator asked to prove idempotency — surfaced a real classification bug, caught before it reached the PR: **17 rows that correctly resolved to `district`-only on the first run (sub-district didn't match) were mis-reported as `unresolved` on the second run**, because they were STILL candidates (sub-district still null) but now sat at DISTRICT level in `Location.adminAreaId` (this script's own first-run write) — and `resolveCandidate` assumed every candidate's current `adminArea` was always the PROVINCE node (a structural invariant that was true for run 1, but broken by run 1's own partial writes). Comparing/reading a DISTRICT node as if it were the PROVINCE node made the mismatch-check and the language-consistency check (BR-4) both silently wrong for those 17 rows on rerun.

**Fix:** `getProvinceAncestor()` walks `parentId` up from whatever level the row's current `adminArea` sits at to its true PROVINCE ancestor, before any comparison. No data was ever corrupted (the first run's writes were correct; the bug was a second-run *misclassification*, never a wrong write — `needsWrite` was never reached for the mis-skipped rows). Verified live: after the fix, the second real run reports `resolved to district only: 17` (not folded into `unresolved`), `unresolved: 31` (the true, stable number), `rows updated: 0`, `Google Geocoding calls made: 0` — all re-confirmed by an independent DB query, not the script's own log. Regression test added: `__tests__/cam-562-geocode-backfill.test.ts` (c) — a row seeded at DISTRICT level (simulating a prior partial run) now correctly resolves to `resolved_subdistrict` instead of being skipped.

## AC-6 — province filter regression, verified before AND after

```
prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } }) → 18
```
Verified before the real run, after the first real run, and after the fix's re-run: **18 in all three cases**, unaffected. This holds by construction (`lib/campsite-filters.ts`'s `resolveProvinceAdminAreaIds`, untouched by this story, already resolves a province name to its FULL AdminArea subtree — province node + every descendant district/sub-district — so deepening a camp's `adminAreaId` under the SAME already-agreed province, or leaving it untouched on mismatch, can never remove it from that province's filter result).

## Reader/writer inventory (architecture.md §15b — mandatory sweep)

**Search method:** `grep -rn "\.district\b|\.subDistrict\b" app/ lib/ components/ scripts/` (excluding `__tests__`), cross-checked against CAM-563's own `adminAreaId` inventory.

| Reader/writer | Touches how | Action this story | Why |
|---|---|---|---|
| `components/CampgroundCard.tsx`'s `buildLocationText` (CAM-545) | Renders `"{district}, {province}"` when `district` is non-null, else just `province` | **NOW ACTIVE** — 536 camps now render a district line for the first time in production data | Out of this story's file surface (`components/**`); flagged for Frontend/QA — this is a real, visible UI change even though no UI file was touched. Known limitation (pre-existing, not introduced here): `district` has no separate Thai form, so a Thai-mode card pairs an English district with a Thai province for these 536 camps until a follow-up adds a `districtTh` column |
| `app/wishlist/page.tsx` | Renders `campSite.location.district` | **NOW ACTIVE**, same effect | Out of file surface |
| `app/api/campsites/[id]/route.ts` PATCH | Host-edited `district`/`subDistrict` free text; never touches `adminAreaId` | **NO-CHANGE, pre-existing gap noted only** | Out of file surface; a host edit after this backfill can drift the free text away from `adminAreaId` — pre-existing since CAM-553 |
| `lib/campsite-filters.ts`'s `province` string/id OR-match (CAM-563) | `where.location.OR = [{province}, {adminAreaId:{in:ids}}]` | **VERIFIED, NO-CHANGE** — AC-6 above | Out of file surface |

## ADRs

No new ADR — reuses CAM-563's already-accepted `adminAreaId`-as-storage decision and CAM-554's already-accepted server-side-Google-Geocoding decision.

## Seams — reuse, not a third implementation

- `matchAdminAreaByName` (bilingual, hierarchical, exact-match, parent-scoped) is imported DIRECTLY from `scripts/backfill-cam-563-location-admin-area.mjs` — both are same-runtime plain `.mjs` modules, so no port was needed.
- `callGoogleGeocode` has no existing plain-JS twin — CAM-554's version lives in `app/api/geocode/_shared.ts` (TS, `app/api/**`, out of this story's file surface). This story's copy is a small, necessary, documented duplicate.
- **No `lib/geo/**` extraction was made** — evaluated and declined: the only consumer would be this `.mjs` script, which cannot import a `@/`-aliased TS module without a new tsx-based script-runner convention (out of scope). Now FOUR near-identical matcher copies exist across the codebase (`app/api/geocode/_shared.ts`, `app/api/location/route.ts`, `scripts/backfill-cam-563-*.mjs`, this script) — flagging again for a future consolidation story.

## Links
`scripts/backfill-cam-562-subdistrict-geocode.mjs` · `scripts/backfill-cam-563-location-admin-area.mjs` (reused) · `app/api/geocode/_shared.ts` (CAM-554, algorithm reference) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-563-location-by-id/tech.md` · `story.md`

## Changelog
- v1 (2026-07-26) — created; real run initially blocked on `GOOGLE_GEOCODING_API_KEY`'s HTTP-referrer restriction (Google Cloud Console, not code).
- v2 (2026-07-26) — owner fixed the key restriction. Real dry-run + real run + second-run completed against the dev DB; found and fixed a second-run classification bug (province-ancestor walk) via the coordinator's explicit second-run proof requirement; all numbers in this file are independently verified by direct database query, not the script's own log.
