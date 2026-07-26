---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: blocked-on-external-credential
version: v1
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

## Real-run result — BLOCKED on an external Google Cloud credential, not a code defect

The script (`scripts/backfill-cam-562-subdistrict-geocode.mjs`) is fully implemented and unit-tested (30/30 green, `__tests__/cam-562-geocode-backfill.test.ts`, mocked `fetch` + fake Prisma covering every AC/BR/EC). Running it for real against the dev DB surfaced a genuine environment gap that CAM-554's own tech.md flagged as unmeasured ("no real Google API calls were made anywhere in this story... the key was only just added"): **this is the first real integration attempt against `GOOGLE_GEOCODING_API_KEY`, and every one of the 650 calls was denied.**

**Root cause, verified directly (one-off diagnostic call, `error_message` never contains the key):**
```
http status: 200
google status: REQUEST_DENIED
error_message: API keys with referer restrictions cannot be used with this API.
```
The key is configured in Google Cloud Console with an **HTTP referrer** application restriction — a browser-only mechanism (checks the `Referer` header). A server-side `fetch()` call never sends a `Referer` header, so Google denies every request regardless of the request being otherwise well-formed (confirmed: `http status 200`, i.e. the request reached Google fine; the denial is Google's own authorization layer, not a network/route problem). This is consistent with CAM-554's architecture decision that this key is meant to be server-only, but its current Console configuration does not match that intent.

**Fix required (outside this story's file surface — a Google Cloud Console setting, not code):** change `GOOGLE_GEOCODING_API_KEY`'s Application restriction from "HTTP referrers" to "IP addresses" (the Vercel/local egress IPs) or "None" (Google Cloud Console → APIs & Services → Credentials → the key → Application restrictions). No code change closes this; a spoofed `Referer` header was considered and explicitly declined — it would circumvent an owner-configured access control rather than fix it (`.claude/rules/security.md` — respect, don't bypass, an existing restriction).

**What WAS proven against the real dev DB despite the blocker (all commands run, all counts queried myself, not trusted from the script's own log):**

| Check | Result |
|---|---|
| Candidate query correctness | `650` candidates scanned (matches the ticket's own measurement: 650 real camps, 2 null-coordinate rows correctly excluded) |
| Fail-safe behavior on total geocode failure | `0` rows updated, `0` writes attempted — every one of the 650 recorded as `geocode_failed` / `google_REQUEST_DENIED`, never a crash, never a partial write |
| Guard | Refused without `ALLOW_SUBDISTRICT_GEOCODE_BACKFILL=1` / `DATABASE_URL` / `GOOGLE_GEOCODING_API_KEY`, and against a production-looking target (unit-tested; not re-tried live against a prod-looking URL, by design) |
| Cache reuse (BR-6), run twice in a row | 1st run: `Google Geocoding calls made: 650, served from cache: 0`. 2nd run (same tmp cache file): `Google Geocoding calls made: 0, served from cache: 650` — proves the cache mechanism works correctly even under a total-failure response, not just the happy path |
| `district`/`subDistrict` fill state, before AND after both runs | `district set on 0, subDistrict set on 0 of 652` — unchanged, exactly as expected when every call is denied |
| **AC-6 — province filter regression guard** | `prisma.campSite.count({ where: { location: { province: 'Chiang Mai' } } })` → **18** camps, both before and after (0 rows touched) — matches the count the owner verified after CAM-563; unaffected by this story either way |

**What could NOT be measured (honest, not fabricated) until the key is fixed:** the real fill rate (resolved-to-sub-district / resolved-to-district-only / mismatched), the real province-mismatch count, and the real total Google spend. The dry-run/real-run mechanics, the bilingual matcher, the mismatch-detection logic, and the idempotent/cache-reuse behavior are all proven correct via the 30-test unit suite against realistic Google-response fixtures (`__tests__/cam-562-geocode-backfill.test.ts`) — only the LIVE Google round-trip is blocked.

**Recommended next step:** once the key's Application restriction is corrected, re-run:
```
ALLOW_SUBDISTRICT_GEOCODE_BACKFILL=1 DRY_RUN=1 node --env-file=.env scripts/backfill-cam-562-subdistrict-geocode.mjs   # projection
ALLOW_SUBDISTRICT_GEOCODE_BACKFILL=1 node --env-file=.env scripts/backfill-cam-562-subdistrict-geocode.mjs             # real write
```
(delete the stale tmp cache first — it currently has no entries, since this story's own diagnostic run was cleaned up — so the corrected key gets a fresh attempt, not a replay of the `REQUEST_DENIED` cache).

## Cost

Google Geocoding is billed per request regardless of the response status (REQUEST_DENIED responses have historically not been billed by Google, but this is **not measured/confirmed** for this project's billing account — stated honestly, not assumed). The dry-run/real-run cache pairing (BR-6) is designed so the ~650-call cost is paid ONCE per environment, not twice; this was proven structurally (2nd run: 0 new calls) even though the calls themselves were denied this round.

## Reader/writer inventory (architecture.md §15b — mandatory sweep)

**Search method:** `grep -rn "\.district\b|\.subDistrict\b" app/ lib/ components/ scripts/` (excluding `__tests__`), cross-checked against CAM-563's own `adminAreaId` inventory.

| Reader/writer | Touches how | Action this story | Why |
|---|---|---|---|
| `components/CampgroundCard.tsx`'s `buildLocationText` (CAM-545) | Renders `"{district}, {province}"` when `district` is non-null, else just `province` | **NOW (activates, no code change)** — this backfill is what makes district data exist for the first time; the branch was already built + tested in advance | Out of this story's file surface (`components/**`); flagged for Frontend/QA visibility — once a real run succeeds, cards will start showing district text for the first time in production data |
| `app/wishlist/page.tsx` | Renders `campSite.location.district` | **NO-CHANGE**, display-only, same activation | Out of file surface |
| `app/api/campsites/[id]/route.ts` PATCH | Host-edited `district`/`subDistrict` free text; never touches `adminAreaId` | **NO-CHANGE, pre-existing gap noted only** | Out of file surface (`app/api/**`); a host edit after this backfill can drift the free text away from `adminAreaId` — pre-existing since CAM-553, not introduced here |
| `lib/campsite-filters.ts`'s exact-equality `district` filter param | Not exercised by any live caller today | **NO-CHANGE** | Out of file surface; dormant |
| `lib/campsite-filters.ts`'s `province` string/id OR-match (CAM-563) | `where.location.OR = [{province}, {adminAreaId:{in:ids}}]`; `resolveProvinceAdminAreaIds` already resolves a province name to itself + every descendant district/sub-district id | **VERIFIED, NO-CHANGE** — this story deepens `adminAreaId` under the SAME already-agreed province subtree (or skips entirely on mismatch), so a camp resolved deeper by this script stays inside its province's id-set; AC-6's 18-camp Chiang Mai count is unaffected either way | Out of file surface; this story's BR-2 (never re-home) is what keeps this invariant true by construction |

## ADRs

No new ADR — reuses CAM-563's already-accepted `adminAreaId`-as-storage decision and CAM-554's already-accepted server-side-Google-Geocoding decision; this story is a deeper backfill pass on the same, already-decided model.

## Seams — reuse, not a third implementation

- `matchAdminAreaByName` (bilingual, hierarchical, exact-match, parent-scoped) is imported DIRECTLY from `scripts/backfill-cam-563-location-admin-area.mjs` — both are same-runtime plain `.mjs` modules, so no port was needed (unlike CAM-563's own port of CAM-554's TS algorithm, since #640 wasn't merged yet at the time).
- `callGoogleGeocode` has no existing plain-JS twin — CAM-554's version lives in `app/api/geocode/_shared.ts` (TS, `app/api/**`, out of this story's file surface). This story's copy is a small, necessary, documented duplicate (same endpoint, same never-log-the-key-bearing-URL discipline) — not a redesign.
- **No `lib/geo/**` extraction was made.** Evaluated per the dispatch's explicit invitation: the only possible consumer of a shared TS module would be this new `.mjs` script, which cannot import a `@/`-aliased TS module without introducing a new tsx-based script-runner convention project-wide — out of this story's scope. A future story that DOES introduce that convention (e.g. if more scripts need TS-shared logic) is the right moment to finally do CAM-563's own recommended consolidation (`app/api/geocode/_shared.ts`, `app/api/location/route.ts`, `scripts/backfill-cam-563-*.mjs`, and this script all currently carry a near-identical matcher/normalizer — now FOUR copies across the codebase, not three).

## Links
`scripts/backfill-cam-562-subdistrict-geocode.mjs` · `scripts/backfill-cam-563-location-admin-area.mjs` (reused) · `app/api/geocode/_shared.ts` (CAM-554, algorithm reference) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-563-location-by-id/tech.md` · `story.md` · `.claude/ENV-CONFIG.md` (key config)

## Changelog
- v1 (2026-07-26) — created; real run blocked on the `GOOGLE_GEOCODING_API_KEY`'s HTTP-referrer restriction (Google Cloud Console setting, not code) — reported, not silently worked around.
