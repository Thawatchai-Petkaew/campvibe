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
# Tech — write the location of the camp we actually authorised (CAM-613)

## The defect, exactly as found

`app/api/campsites/[id]/route.ts` PUT:

```ts
// :45 — authorises the CAMP NAMED IN THE PATH
const { error, campSite: existing, session } = await requireCampSitePermission(id, "CAMPSITE_UPDATE");
...
// :199-201 — writes a Location keyed by the REQUEST BODY, never compared to existing.locationId
if (data.locationId && hasLocationFieldEdit) {
  await prisma.location.update({ where: { id: data.locationId }, ... });
}
```

`existing` (the record `requireCampSitePermission` fetched and proved belongs to `id` in the path, `where: { id: campSiteId }` inside `lib/auth-utils.ts`) already carries `existing.locationId` — a plain scalar column on `CampSite` (`prisma/schema.prisma` line 349-350: `locationId String` / `location Location @relation(...)`), no extra query needed. The vulnerable line never reads it; it reads `data.locationId` from the zod-parsed body instead, which passes as any well-formed UUID (`campSiteSchema.locationId: z.string().uuid()`, made optional by `.partial()` on this route).

## Ignore vs reject — decision

**Chosen: silently ignore.** The location write always targets `existing.locationId`; a body-supplied `locationId` is never read for this purpose. Reasoning:

1. **The legitimate client never needs it to differ.** `components/CampgroundForm.tsx` only ever submits `initialData.locationId` — the real, already-linked id for the camp being edited (`components/CampgroundForm.tsx:424`). A body `locationId` that disagrees with `existing.locationId` has no legitimate use case on THIS route; it is either an attack or a client bug, and both cases are handled correctly by ignoring it (attack: neutralised; bug: no data loss, same as if the field didn't exist).
2. **Rejecting still requires reading and trusting the field for the comparison itself**, keeping a client-controlled value in the authorization-relevant code path for no functional gain — the reject-diverges case (400/409) buys the client a slightly more informative error, but this route's own contract (`campSiteSchema.partial()`) never promised `locationId` could reassign which Location row is edited, so there is nothing to be "honest" about disagreeing with.
3. **Simpler diff, smaller trust surface.** Removing the dependency on `data.locationId` entirely (not just adding an `if (data.locationId !== existing.locationId) return 409`) means the location-write gate is now `hasLocationFieldEdit` alone — one fewer conditional, one fewer place a future edit could reintroduce the bug by touching the comparison instead of the target.

`locationId` remains a required field on `campSiteSchema` for `POST /api/campsites` (create) — unaffected; see the sweep finding below for a separate, real gap on that path (out of this story's file surface).

## The fix

```ts
// before
if (data.locationId && hasLocationFieldEdit) {
  await prisma.location.update({ where: { id: data.locationId }, data: {...} });
}

// after
if (hasLocationFieldEdit) {
  await prisma.location.update({ where: { id: existing!.locationId }, data: {...} });
}
```

`hasLocationFieldEdit` (unchanged — true iff the body carries `province`/`district`/`subDistrict`) is now the ONLY gate; the write's target is `existing!.locationId`, the same non-null assertion pattern already used elsewhere in this handler for the record `requireCampSitePermission` returned (e.g. `existing!.isPublished` two lines below the auth call). No new query — `existing` is already in scope.

## Sweep — authorise-path-A / write-body-B, across `app/api/**`

**Method:** read every route under `app/api/**` that authorises via a dynamic path segment (`requireCampSitePermission`, `requireCampSiteOwnership`, or `requireAuth` followed by a manual ownership `findUnique`/`findFirst`) and checked whether any subsequent write is keyed by an id taken from the request body instead of the path-derived, already-authorised record. Files walked: `bookings/[id]`, `campsites/[id]` (this route), `campsites/[id]/blocked-dates(+/[blockId])`, `campsites/[id]/holds(+/[holdId])`, `campsites/[id]/spots(+/[spotId])`, `campsites/[id]/zones(+/[zoneId])`, `team/members/[id]`, `team/invitations/[id]`, `ai/conversations/[id]`, `wishlist/[campSiteId]`, `tickets/[id](+/comments)`.

| Route | Body-id used in a write? | Verdict |
|---|---|---|
| `campsites/[id]` PUT | `data.locationId` → keyed a `Location` write, never compared to `existing.locationId` | **THE DEFECT — fixed here** |
| `bookings/[id]` PATCH | writes `where:{id}` (path), `data:{status}` only | clean |
| `campsites/[id]/spots/[spotId]` PUT/DELETE | `data.zoneId` resolved via `resolveSpotZoneWrite(id, …)`, which re-checks `where:{id:zoneId, campSiteId:id}` before use; `owned` lookup scopes `spotId` to `campSiteId:id` before any write | clean |
| `campsites/[id]/zones/[zoneId]` DELETE | CAS `updateMany({where:{id:zoneId, campSiteId:id, deletedAt:null}})` | clean |
| `campsites/[id]/zones` POST (create) | `zone.create({data:{campSiteId:id, ...}})` — `campSiteId` is path-derived, not body | clean |
| `campsites/[id]/spots` POST (create) | `spotSchema.safeParse({...body, campSiteId:id})` — **explicitly overrides** any body `campSiteId`; `zoneId` re-checked as above | clean |
| `campsites/[id]/blocked-dates(+/[blockId])` | `data.spotId` re-checked `where:{id:data.spotId, campSiteId:id}` before use; DELETE CAS-scopes `blockId` to `campSiteId:id` | clean |
| `campsites/[id]/holds(+/[holdId])` | `data.spotId` re-checked the same way; DELETE CAS-scopes `holdId` to `campSiteId:id` | clean |
| `team/members/[id]` PATCH/DELETE | writes `where:{id}` (path); only `data.role`/`data.permissions`/`data.isActive` from body | clean |
| `team/invitations/[id]` PATCH | writes `where:{id}` (path); ownership checked via `invite.userId !== session.user.id` | clean |
| `ai/conversations/[id]` GET/DELETE | no body read at all; ownership is `{id, userId}` inside the store query | clean |
| `wishlist/[campSiteId]` DELETE | `deleteMany({where:{userId, campSiteId}})` — both server-derived | clean |
| `tickets/[id](+/comments)` PATCH/POST | internal delivery-tool routes (STATUS_TOKEN gate, not a per-user ownership model); every op targets `id` from the path only | clean |

**Result: this route was the only instance of the reported shape.**

## Related-but-separate finding — NOT fixed here (out of file surface, reporting per instructions)

`POST /api/campsites` (create, `app/api/campsites/route.ts` — no `[id]`, a different file from this story's allowed surface) accepts a client-supplied `locationId: z.string().uuid()` and creates a new `CampSite` row pointing at it with **no check that the Location row is exclusive to (or was just created by) the requesting session**. `Location.campSites` is a one-to-many relation (`prisma/schema.prisma:237`, no unique constraint on `CampSite.locationId`), so nothing stops a host from reading another camp's `locationId` (exposed on `GET /api/campsites/[id]`, same read as this ticket's own exposure note) and setting it as their OWN new camp's `locationId` at create time. After that link exists, THIS story's fix would correctly treat that shared Location row as "their own camp's location" (`existing.locationId` would legitimately equal the victim's location id, because the attacker's own camp now really is linked to it) — so the create-path gap re-opens a path to the same outcome (editing another camp's province/district/subDistrict) via one extra step this story's fix does not close. Recommend a follow-up story on `app/api/campsites/route.ts` POST: either require a fresh, request-scoped Location (e.g. verify the Location has zero existing `campSites` before allowing the link, or have `POST /api/campsites` create the Location itself instead of accepting a pre-existing id).

## Data / migration

None. No schema change; `existing.locationId` is already selected by the existing `prisma.campSite.findUnique` inside `requireCampSitePermission` (default scalar selection, no `select`/`include` needed).

## Test-fixture note (transparency)

Two pre-existing test files mock `requireCampSitePermission` for this exact route and assert the `where` clause `prisma.location.update` is called with — neither previously set a `locationId` on the mocked `campSite`, because the pre-fix code never read that field from `existing`. Fixing the vulnerability makes the route depend on it, so both now set the mocked camp's `locationId` to the SAME id their existing assertions already expected the write to target:

- `__tests__/cam-559-cascading-location.test.ts` — `mockAllowed()` now includes `locationId: LOCATION_ID`.
- `__tests__/cam-574-retire-thailand-location.test.ts` — the `requireCampSitePermission` mock factory now includes `locationId: LOCATION_ID`.

Both are one-line fixture additions inside test files that already exercise this exact route's `location.update` call; no assertion was weakened, and neither file's test intent (province/district/subDistrict reach the database) changed. Flagged here for visibility since both sit outside this story's originally-listed file surface, but were required to keep the full suite green after the fix — the assertion `expect(call.where).toEqual({ id: LOCATION_ID })` would otherwise regress from `undefined` in both files, not from a real behavior change. Confirmed via the full-suite run (`npx vitest run`) that these were the ONLY two casualties across all 391 test files.

## Links
`app/api/campsites/[id]/route.ts` · `lib/auth-utils.ts` (read-only, unmodified) · `__tests__/cam-613-location-write-authz.test.ts` · `__tests__/cam-559-cascading-location.test.ts` (one-line fixture fix) · `story.md`

## Changelog
- v1 (2026-07-28) — created; fix + sweep + follow-up finding documented.
