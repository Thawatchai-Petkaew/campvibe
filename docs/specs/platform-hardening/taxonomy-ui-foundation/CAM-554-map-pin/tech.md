---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: tech
owner: frontend-engineer
status: done
version: v1
updated: 2026-07-26
---
# Tech — Map pin, two-way synced with the cascading selects (CAM-554)

## Architecture decision (owner, 2026-07-26)

Leaflet stays on the browser (`components/MapComponent.tsx`'s existing `react-leaflet`/`leaflet` dependency, reused not reinvented); Google is used ONLY server-side, for the Geocoding API. This avoids a browser-exposed key, per-map-load billing, and a third CSP round in a codebase already bitten twice by CSP changes (CAM-202/203, CAM-218). The Geocoding API's "reverse" (latlng->address) and "forward" (address->latlng) modes are the SAME endpoint/key/billing model - using both is not a new dependency or a new external service, just the same API used in both its native directions. `GOOGLE_GEOCODING_API_KEY` is the one new env var (`.claude/ENV-CONFIG.md`), server-only, never `NEXT_PUBLIC_`.

## Mid-flight architecture correction (coordinator, 2026-07-26)

The owner separately decided to move `Location`'s stored province/district/sub-district from free text to an id (`Location.adminAreaId`, already on the schema, populated on only 12/652 rows today - that migration is CAM-563, not this story). The resolver here is built AHEAD of that: it resolves against the `AdminArea` tree FIRST (bilingual, hierarchical - see below) and gets the deepest matched node's `id` as the primary result; the free-text `province`/`district`/`subDistrict` strings returned alongside it are DERIVED from that same resolved node (via a `ThailandLocation` join on the shared `provinceCode`/`districtCode`), never the other way round. This story does NOT write `Location.adminAreaId` (that write path - `app/api/location/route.ts` / `app/api/campsites/[id]/route.ts` - is out of this story's file surface and is CAM-563's job), but the `adminAreaId` the resolver returns is already the id CAM-563 will consume.

## API contract

### `GET /api/geocode/reverse?lat=&lon=` (NEW)
- Input (`lib/validations/location.ts` `geocodeReverseQuerySchema`): `lat`/`lon`, `z.coerce.number()`, bounds -90..90 / -180..180 (mirrors `createLocationSchema`).
- Auth: `requireAuth()` (401 if not logged in) - unlike the free `/api/locations/search` DB read, this call is BILLED per request by Google, so it is gated the same way `POST /api/location` already is, rather than left open to anonymous traffic.
- Output (`geocodeReverseResultSchema`): `{ province: ThailandLocationRow|null, district: ThailandLocationRow|null, subDistrict: SubDistrictRow|null, adminAreaId: string|null }` - `.parse()` on a plain (non-strict) zod object strips any unrecognized key before the response leaves the route, so a stray internal field (or the Google response itself) can never ride along.
- Resolution (`app/api/geocode/_shared.ts`): calls Google (`language=th`), extracts `administrative_area_level_1/2` + `sublocality_level_1|administrative_area_level_3|locality` from `address_components`, strips known Thai/English admin prefixes-suffixes (`normalizeAdminName` - จังหวัด/อำเภอ/เขต/ตำบล/แขวง/กิ่งอำเภอ, Changwat/Amphoe/Khet/Tambon/Khwaeng/… Province/District), then matches EXACT (case-insensitive, never `contains` - CAM-501/503's Thai-substring lesson) against `AdminArea.nameTh` OR `AdminArea.nameEn` (bilingual - the geocoder's response language is not assumed), scoped by `parentId` at each level (province -> district -> sub-district), so a same-named district in the wrong province can never match. A level with no raw component, or no match, stops the walk (a district is never guessed from an unmatched province).
- Error codes: `400` malformed lat/lon · `401` not logged in · `500` geocoding failed (generic; Google's raw body/status and the request URL - which carries the key - are logged server-side only via `console.error`, never returned).

### `GET /api/geocode/forward?province=&district=&subDistrict=` (NEW)
- Input (`geocodeForwardQuerySchema`): `province` required (1-100 chars), `district`/`subDistrict` optional (max 100).
- Auth + cost: same as `reverse` above.
- Resolution: joins the three text values into one address string (`[subDistrict, district, province, 'Thailand'].filter(Boolean).join(', ')`), calls Google's SAME Geocoding endpoint in forward mode, returns `{ lat, lon }` (`geocodeForwardResultSchema`) from the first result's `geometry.location`, or `{lat:null, lon:null}` on `ZERO_RESULTS`.
- Error codes: `400` missing province · `401` not logged in · `500` geocoding failed.

## Expected call pattern (cost control - Google bills per request)

Per host session on the Location step, at most:
- **1 reverse-geocode call per discrete pin action** (a `click` or `dragend` - Leaflet only fires these once per gesture, never per intermediate drag frame), debounced 300ms to coalesce rapid repeats.
- **1 forward-geocode call per SETTLED cascading-select combination**, debounced 300ms after the last of province/district/sub-district changes, and skipped entirely when the resolved address string is unchanged since the last call (`lastForwardQueryRef`).
- **Zero calls on mount**, in either direction, even when editing a camp that already has both a pin and a selection (BR-3) - both directions fire only from an explicit user action.
- **Zero echo calls**: a reverse-geocode resolution that updates the selects sets `suppressForwardRef` so the forward-geocode effect (which watches those same select states) does not immediately re-fire a geocode call for the pin it was just derived from.

Typical session (create a camp, pin once, maybe nudge it once): **2-4 Google Geocoding API calls total**, not per keystroke/per drag-frame/per render.

## Bilingual match rate (measured, honestly scoped)

- **Fixture-based (this repo, no live Google traffic)**: `normalizeAdminName` tested against 12 representative Thai + English address-component strings (province/district/sub-district, both languages, both Bangkok-style เขต/แขวง and provincial-style อำเภอ/ตำบล forms) - **12/12 (100%) strip to the exact bare form** `AdminArea.nameTh`/`nameEn` store.
- **Real dev-DB verification** (2026-07-26, read-only query, no data changed): sampled 5 rows per `AdminArea` level (PROVINCE/DISTRICT/SUBDISTRICT) - confirmed `nameTh`/`nameEn` are stored BARE (e.g. a live province row: `{"nameTh":"พิษณุโลก","nameEn":"Phitsanulok"}`, no จังหวัด/Province anywhere) - so the normalizer's assumption about the target shape is correct against real seeded data, not a guess.
- **NOT measured**: the true field match rate against LIVE Google Geocoding responses. No real Google API calls were made anywhere in this story (mocked in every test) - the key was only just added to the environment and no production traffic has flowed yet. Recommend a follow-up observability metric (`.claude/rules/observability.md`) once this ships: count reverse-geocode calls where `province` resolved vs. stayed `null`, to get the real rate.

## Key safety (explicit tests, `__tests__/cam-554-geocode-routes.test.ts`)

- The key is read via `process.env.GOOGLE_GEOCODING_API_KEY` ONLY in `app/api/geocode/_shared.ts` - grep-asserted absent from every client component (`LocationPicker.tsx`, `LocationMapPin.tsx`, `CampgroundForm.tsx`).
- Never `NEXT_PUBLIC_`-prefixed anywhere (source + `.claude/ENV-CONFIG.md`).
- The outgoing Google request URL (which carries the key as a query param) is never passed to `console.error` - only an HTTP status code or Google's `status` string is logged on failure.
- A 500 (Google failure) and a missing-key path both return the generic `{error:'geocode_failed'}` shape - proven not to contain the key, and the server-log spy proven not to contain it either.

## Cost/perf note

Both routes are read-only (no Prisma writes) and add no new client bundle weight beyond the Leaflet chunk `components/MapComponent.tsx` already ships (same `dynamic(ssr:false)` pattern, reused). CWV: not measured (no Lighthouse/browser session available in this environment); the map's own chunk is lazy-mounted (`IntersectionObserver`, mirrors `components/InfiniteScrollGrid.tsx`'s precedent) so it never loads on initial page paint - a potential LCP/bundle risk if it were NOT lazy is avoided by construction, not measured.

## ADRs

No new ADR - this is additive UI + two read-only server routes on already-decided data models (CAM-553/CAM-559's AdminArea-vs-ThailandLocation split, unchanged; the owner's Leaflet-browser/Google-server split, recorded inline in the ticket's comments). CAM-563 (the `adminAreaId`-as-storage migration) is a separate future ADR-worthy decision, out of this story's scope.

Confirmation: `__tests__/cam-554-geocode-routes.test.ts` (hierarchical scoping, bilingual match, key safety) + `__tests__/cam-554-map-pin-sync.test.ts` (two-way sync, visible reconciliation, lazy load, cost control, i18n, design gate) + `e2e/regression/ac5-create-camp.spec.ts` (real create flow, actually run locally - see Changelog v2).

## Links
`components/MapComponent.tsx` (the reused Leaflet pattern, read-only in this story) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-559-cascading-location-selects/tech.md` (the AdminArea-vs-ThailandLocation split + the canonical-storage-format forward-looking note this story acts on) · `story.md`

## Changelog
- v1 (2026-07-26) — created
- v2 (2026-07-26) — CI's `e2e-regression` job caught real fallout: this story's new submit-guard (BR-8) blocked `e2e/regression/ac5-create-camp.spec.ts`, which never placed a pin, before the create-camp POST ever fired. Actually ran the regression suite locally (not just reasoned about it) against a dedicated local Postgres (`campvibe_e2e_cam554`, migrated + seeded - never the shared dev DB) + the real Next.js dev server on port 3100: reproduced the exact CI timeout first, fixed the spec (click the map - synchronous, no dependency on a real `GOOGLE_GEOCODING_API_KEY`), then confirmed all 25 regression specs pass at `--workers=1` (CI's serial mode) on a fresh reseed. Also confirmed BOTH geocode routes fail gracefully (generic `500`, logged, never blocking) when `GOOGLE_GEOCODING_API_KEY` is absent, exactly as designed - observed live in the dev-server log during this run, not just asserted in a mock.
