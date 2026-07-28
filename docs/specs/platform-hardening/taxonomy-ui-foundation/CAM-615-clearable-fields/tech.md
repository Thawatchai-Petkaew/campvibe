---
linear: CAM-615
feature: platform-hardening
epic: taxonomy-ui-foundation
artifact: tech
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-07-28
---
# tech.md — CAM-615 clearable fields (root fix + guard)

## 1. Contract change (additive only — no breaking change, per `.claude/rules/api.md` rule 12)

`PUT /api/campsites/[id]` and `PUT /api/campsites/[id]/spots/[spotId]` accept the SAME body shape as before; every touched field now ALSO accepts an explicit `null` in addition to a value or an omitted key:

```
undefined (key omitted)  -> skip, column untouched   (unchanged — protects a partial PUT)
null | ''                -> clear the column to NULL  (NEW for the fields listed in §2)
<a real value>            -> set the column           (unchanged)
```

No new endpoint, no new field, no response-shape change. `types/api.ts` is untouched (the response already returns whatever Prisma holds, including `null`).

## 2. Fields widened (zod `.nullable()` added) this story

**CampSite** (`lib/validations/campsite.ts`): `nameEn`, `description`, `address`, `directions`, `videoUrl`, `phone`, `lineId`, `facebookUrl`, `facebookMessageUrl`, `tiktokUrl`, `feeInfo`, `toiletInfo`, `minimumAge`, `priceLow`, `priceHigh`, `partner`, `nationalPark`, `maxGuestsPerDay`, `maxTentsPerDay`.

**Spot** (`lib/validations/spot.ts`): `viewType`, `maxCampers`, `maxTents`, `environment`, `pricePerSite`.

Already nullable before this story (CAM-341/CAM-360, unchanged): `extraFeeAmount`, `extraFeeLabel`, `cancellationPolicy`, `logo`.

Deliberately NOT widened (documented in `scripts/check-clearable-fields.mjs`'s `ALLOWLIST`, with a reason each): `CampSite.tags` (array->CSV idiom instead), `CampSite.groundType`, `CampSite.ownershipType`, `Spot.zone`, `Spot.zoneId`, `Spot.nearFacilities` (array->CSV idiom instead).

## 3. Write-mapping change

**`app/api/campsites/[id]/route.ts` PUT** — every field in §2 (plus the 4 already-nullable fields, refactored for consistency) now writes through `clearableWrite()` (`lib/api-utils.ts`):

```ts
export function clearableWrite<T>(value: T | '' | null): T | null {
  return value === '' || value === null ? null : value;
}
```

`tags` uses the array idiom instead: `arrayToCsv(data.tags) ?? null` (was `arrayToCsv(data.tags)`, which returns `undefined` on an empty array — read by Prisma as "skip").

**`app/api/campsites/[id]/spots/[spotId]/route.ts` PUT** — `viewType`/`maxCampers`/`maxTents`/`pricePerSite` needed NO route change (they already forwarded `data.x` as-is with no `|| undefined` collapse; once the zod schema accepts `null`, an explicit clear reaches Prisma correctly with zero additional code). `nearFacilities` gets the same `?? null` array fix as `tags`.

## 4. Client mapping change

**`components/CampgroundForm.tsx`** — a new module-level `clearableText(value): string | null` (`value === "" ? null : value`) replaces `formData.partner || undefined` / `formData.nationalPark || undefined`. `priceLow`/`priceHigh`/`minimumAge`/`maxGuestsPerDay`/`maxTentsPerDay` swap their `=== "" ? undefined : ...` for `=== "" ? null : ...`. `phone`/`lineId`/`facebookUrl`/`facebookMessageUrl`/`tiktokUrl`/`videoUrl`/`nameEn`/`description`/`address`/`directions`/`feeInfo`/`toiletInfo` needed NO client change — they ride the `...formData` spread and already send a real `''` when blank (the bug for these was route-side only).

**`components/spot-form-dialog.tsx`** — `viewType`/`maxCampers`/`maxTents`/`pricePerSite` swap `? undefined` for `? null`.

## 5. Reader/writer inventory (architecture.md §15b — derivation change: `undefined`/`null` semantics widened)

| Field(s) | Reader | Change |
|---|---|---|
| `maxGuestsPerDay`/`maxTentsPerDay` | `lib/campsite-filters.ts` (catalog guest-count filter) | NO-CHANGE — already treats `null` as "unbounded, always match"; this story makes that state actually reachable via clearing |
| `maxGuestsPerDay`/`maxTentsPerDay` | `lib/campsite-availability.ts` (booking write-gate) | NO-CHANGE — already treats `null` as "no cap enforced" |
| `maxGuestsPerDay`/`maxTentsPerDay` | `lib/listing-completeness.ts` | NO-CHANGE — already typed `number \| null` |
| `priceLow` | `lib/booking-pricing.ts` `resolveUnitPrice` | NO-CHANGE — already falls back to a sane default when `null`/`0` (a DIFFERENT, deliberate business default for the booking total, not touched) |
| `priceLow` | `components/CampgroundDetailClient.tsx` booking-widget headline | **NOW** — fixed in this story (was `|| 50`, now the honest `isHeadlinePriceFree` check, matching `CampgroundCard.tsx`) |
| `priceLow` | `components/CampgroundCard.tsx` catalog card | NO-CHANGE — already honest (`isFree` check, CAM-545) |
| every other field in §2 | detail/edit-form prefill | NO-CHANGE — all already read `initialData.x ?? ""` / `initialData.x || ""`, which renders a cleared `null` identically to an always-empty field |

Single seam invariant proven by the CAM-615 test suite: every write path (client -> zod -> Prisma) for a clearable field agrees on `undefined = skip, null/'' = clear, value = set` — the `check-clearable-fields.mjs` guard is the structural half of that proof (the zod contract), the round-trip integration tests are the behavioral half (the actual write + a reload).

## 6. Guard mechanics (`scripts/check-clearable-fields.mjs`)

1. `parsePrismaNullableFields(schemaSource, modelName)` — regex-extracts `name Type?` lines from a model body, skipping `@relation` lines (object relations are a different mechanism).
2. `parseZodFieldBlocks(zodSource)` — splits a `z.object({...})` body into `{fieldName: fullDefinitionText}`, collecting multi-line chained definitions (e.g. `extraFeeAmount`) as one block.
3. `findClearableGuardViolations({...})` — for every nullable Prisma field that also exists in the zod schema and is NOT in the model's `ALLOWLIST`, checks the block text for `.nullable()`. A miss is a violation (the backlog).
4. Report mode: `main()` always `process.exit(0)`; a non-zero backlog prints loudly but never fails the build. Flip to blocking (`process.exit(1)` on a violation) in a follow-up once the 0-backlog has held.

Proven with teeth (not just asserted): `__tests__/cam-615-clearable-fields.test.ts` runs the guard against a deliberately-broken fixture model/schema pair and asserts the missing field IS flagged, then that adding `.nullable()` clears it, before trusting the guard's 0-violation result against the real files.

## 7. Error-code set (unchanged)

`400` invalid input (e.g. `maxCampers: 0`, still rejected by the pre-existing `.min(1)`) · `401` unauthenticated · `403`/`404` not found / not owner · `500` internal. No new error code introduced by this story.

## 8. Audit / observability

No new audit event — these are ordinary listing-field edits, already covered by the existing PUT/GET routes' structured `console.error` on failure (`lib/api-utils.ts` `apiError`). No secret/PII touched.
