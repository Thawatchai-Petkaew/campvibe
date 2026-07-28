---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: tech
owner: backend-engineer
status: done
version: v1
updated: 2026-07-28
---
# Tech — a new camp cannot silently attach to someone else's location (CAM-617)

## The three questions, answered from the code (not assumed)

### Q1 — Does anything today legitimately create two camps against one Location?

**No.** Checked all three places that create `CampSite`+`Location` rows:

- **`prisma/seed.ts` (line ~731-741):** `existingLocation` is looked up by `{country, province, lat, lon}` — a natural key that is unique **per seeded camp** (each of the 12 seed camps has its own distinct lat/lon). The `findFirst`+`update-or-create` idempotency here exists so **re-running the seed** doesn't orphan a new `Location` row every run (CAM-359 BR-3(a)'s own comment) — it is NOT two different camps sharing one row within a single seed run. One Location per camp, always.
- **`scripts/backfill-cam-575-reconcile-coordinates.mjs`:** reconciles `CampSite.latitude/longitude` vs `Location.lat/lon` for **existing** divergent pairs (4 rows found live). It writes `CampSite` only (`Location` is derived by the trigger) and never creates a new `Location` or re-points a `CampSite.locationId` to a different row. No sharing introduced.
- **Host onboarding (`components/CampgroundForm.tsx:595-616`):** on CREATE, `formData.locationId` starts as `""` (line 306, `initialData` is absent) — so `!locationId` is always true and the client **always** `POST`s a brand-new `/api/location` row first, then uses the returned `location.id`. `formData.locationId` is only ever pre-populated (`initialData.locationId || ""`, line 434) on the **EDIT** path, which goes through `PUT /api/campsites/[id]`, not this route. The legitimate client NEVER supplies a pre-existing `locationId` to `POST /api/campsites`.

Conclusion: no code path, seeded or live, ever intends two `CampSite` rows to reference one `Location` row — not even for the same host.

### Q2 — Does the create path even need a client-supplied `locationId`?

**Yes, as currently contracted** — but not because of anything server-side. The two-step client flow (`POST /api/location` → `POST /api/campsites`) exists because `CampSite.locationId` is a required, non-null FK (`prisma/schema.prisma:349-350`) and the `Location` row must exist before a `CampSite` can point at it. `campSiteSchema.locationId: z.string().uuid()` (required) reflects that FK, not client convenience.

Deleting the parameter isn't the available "simplest good outcome" here, for two reasons this dispatch's allowed surface can't get around:
1. It would require the client (`components/CampgroundForm.tsx`, `components/**` — out of bounds for this dispatch) to stop making the first `POST /api/location` call and instead send province/district/subDistrict/lat/lon directly to `POST /api/campsites`, which would also require widening `campSiteSchema` to carry those Location-shaped fields (an API-contract change, not argued for here).
2. Even if that refactor happened, `POST /api/location` itself has **no ownership/exclusivity concept on `Location` at all** (it's just an authenticated create) — the actual gap is "a `locationId`, once it exists, can be claimed by more than one `CampSite`", which exists independently of how many HTTP round trips create it.

So the fix stays where CAM-613's finding pointed: guard the CLAIM (create-time attach), not the shape of the request.

### Q3 — What does `campsite_coords_sync` do when two camps share a Location and one moves?

Read `prisma/migrations/20260726165149_cam575_campsite_location_coord_sync_trigger/migration.sql` directly:

```sql
CREATE TRIGGER campsite_coords_sync
AFTER INSERT OR UPDATE OF "latitude", "longitude", "locationId" ON "CampSite"
FOR EACH ROW EXECUTE FUNCTION sync_location_coords_from_campsite();
```

The function does `UPDATE "Location" SET lat=NEW.latitude, lon=NEW.longitude WHERE id=NEW."locationId"` — **per CampSite row**, unconditionally, on every INSERT and on UPDATE of `latitude`/`longitude`/`locationId`. It carries no awareness of how many other `CampSite` rows also reference that `Location`. Two camps sharing one Location **would** fight over it: whichever camp's row is inserted/updated LAST wins `Location.lat/lon`, silently overwriting the other's.

This is checkable and was checked (see `__tests__/cam-617-location-exclusivity-real-db.test.ts`, "the shared row is never touched" test): a scratch `Location` is created, a scratch `CampSite` is attached to it (syncing it to `13.75/100.5`), then a REAL `POST /api/campsites` call attempts to attach a SECOND camp to the same `locationId` with different coordinates (`18.79/98.98`). Blocked (409) → `Location.lat/lon` stays exactly `13.75/100.5`, proving the trigger never got the chance to fight over it. Had the create NOT been blocked, this assertion would fail (and did, before the fix — see "Prove-It" below).

This is the sharpest symptom, but not the only one: because CAM-613's PUT-path fix now correctly targets `existing.locationId` (the camp's OWN, truly-linked location, once the coupling exists), an edit to province/district/subDistrict on either camp would also silently reach into the shared row and relabel the other camp — the exact "quieter version of CAM-613" the ticket named.

## Conclusion: real, and fixed here

All three questions point the same way: nothing legitimate shares a Location, the create path genuinely needs the parameter (can't be deleted within this dispatch's surface), and the coordinate trigger demonstrably fights over a shared row. The gap is real.

## Ignore vs reject — decision (contrast with CAM-613)

**Chosen: reject (409), not ignore.** CAM-613's PUT-path fix could safely ignore a foreign body `locationId` because `existing.locationId` — the value `requireCampSitePermission` already fetched for the camp named in the URL path — was ALWAYS a valid, already-authorised fallback target to substitute in. Reasoning did not depend on rejecting vs ignoring being equally available; it depended on there being a safe target to ignore INTO.

A CREATE has no such target. This is the FIRST link ever made between the new `CampSite` row and a `Location` row — there is no "this camp's own, already-known-good" `locationId` to fall back to if the body's value is rejected. "Ignore the body" would mean either (a) inventing a value from nowhere, which doesn't exist, or (b) omitting the FK and failing the write anyway (`locationId` is non-null) — functionally identical to rejecting the request outright, just later and with a worse (Prisma FK) error. So the create is rejected explicitly and early, with a clear Thai message, rather than allowed to fail opaquely downstream.

## The fix

`app/api/campsites/route.ts`, `POST` handler — added immediately after the existing `isPriceOrderValid` check (same "fails closed before any write" placement):

```ts
const existingCampAtLocation = await prisma.campSite.findFirst({
  where: { locationId: data.locationId, deletedAt: null },
  select: { id: true },
});
if (existingCampAtLocation) {
  return apiError(LOCATION_ALREADY_LINKED_ERROR, 409);
}
```

`deletedAt: null` mirrors the same convention already used everywhere else `CampSite` existence is checked in this codebase (`lib/campsite-filters.ts`'s base catalog `where`, every scoped `Zone`/`Spot`/`Hold` query in `app/api/campsites/[id]/**`) — a camp whose row is soft-deleted no longer holds a live claim on its Location. (Note: `DELETE /api/campsites/[id]` currently performs a hard delete, so no row actually carries a non-null `deletedAt` today; the filter is included only for consistency with the established convention, not as new soft-delete behavior — see story.md's Out of scope.)

The check does **not** filter by `operatorId` — BR-2 / Q1 established that no legitimate case exists even for the SAME host reusing one of their own other camp's `locationId`, so scoping the query to "someone else's camp" would leave the same-host case open for no reason.

## No N+1, no migration

One extra `findFirst` per create request (not a loop), against an already-indexed column (`prisma/schema.prisma:355`, `@@index([locationId])` on `CampSite`) — bounded, single query, before the existing `campSite.create` call. No schema change.

## Prove-It (teeth, confirmed both directions)

Both new test files were run RED before the fix (`git stash` on `app/api/campsites/route.ts` only) and GREEN after (`git stash pop`):

- Mocked suite (`cam-617-location-exclusivity.test.ts`): the two rejection tests failed (`expected 201 to be 409`) with the fix removed; the "no existing CampSite" acceptance test was unaffected (it never hit the guard).
- Real-DB suite (`cam-617-location-exclusivity-real-db.test.ts`, gated on `DATABASE_URL`, runs against the local dev Postgres): the sharing test failed the same way; the control test additionally surfaced a `nameThSlug` unique-constraint 500 because the pre-fix code had ALREADY created a real row against the shared Location in the prior (unblocked) test run within that same red-state pass — itself circumstantial confirmation that the pre-fix create path was happy to attach a second camp to an already-used Location. Stray rows from this manual red-state run were cleaned up by hand (`campSite`/`location` delete by id) before the final green run; the automated `afterAll` in the test file cleans up every row it creates itself in a normal (fix-present) run.

## Test-fixture note (transparency, same class as CAM-613's own note)

Five pre-existing test files mock `@/lib/prisma` for `POST /api/campsites` and never previously set `campSite.findFirst` (the route never read it before this fix). Running the full suite after the fix turned 14 previously-green tests red with a 500 (`findFirst is not a function`) — not a real regression, just the same "a route fix makes it depend on a mocked call sibling tests never set" shape CAM-613's own tech.md documented for `locationId` on the PUT path. Each file gets a one-line addition: `findFirst: vi.fn()` in the `campSite` mock factory + `.mockResolvedValue(null)` in that file's existing `beforeEach` (no assertion weakened, no test intent changed):

- `__tests__/cam-352-image-kind-groundwork.test.ts`
- `__tests__/cam-365-publish-gate.test.ts`
- `__tests__/cam-521-metadata-groups.test.ts`
- `__tests__/cam-619-campsites-create-price-order.test.ts`
- `__tests__/security-hotfix.test.ts`

Confirmed via the full-suite run (`npx vitest run`, real `DATABASE_URL` set for the real-DB suite) that these five were the only casualties, and that after the fixture fix all 10984 non-`delivery-client.test.ts` tests pass (that one file's one failure is the known, pre-existing, env-dependent case the dispatch instructions name explicitly).

## Links
`app/api/campsites/route.ts` · `__tests__/cam-617-location-exclusivity.test.ts` · `__tests__/cam-617-location-exclusivity-real-db.test.ts` · the 5 fixture-note files above · CAM-613's tech.md (origin of this finding) · `prisma/migrations/20260726165149_cam575_campsite_location_coord_sync_trigger/migration.sql` (read-only, unmodified) · `story.md`

## Changelog
- v1 (2026-07-28) — created; established the defect from the code, fixed create-path exclusivity, documented the ignore-vs-reject contrast with CAM-613.
