---
linear: CAM-623
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: story
owner: frontend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tell the host about the price band before the server has to (CAM-623)

## Story
As a **Host**, I want the camp form to catch an inverted min/max price BEFORE it submits, so that I am never told my minimum price is wrong when I only touched the maximum.
Why: `CampgroundForm.tsx` submits the full form state on every save (never a per-field diff). A host who lowers only `priceHigh` while `priceLow` still holds a higher value from an earlier session sends an inverted band; the server correctly 400s it (`ราคาต่ำสุดไม่สามารถมากกว่าราคาสูงสุดได้`, CAM-619), but that message names the minimum, a field the host never touched, and the host only discovers this by failing a save.
Scope: `components/CampgroundForm.tsx` only — a client-side guard, run before any request, that reuses the server's own `isPriceOrderValid` check and shows one message naming both conflicting values. The server guard (`lib/validations/campsite.ts`, `app/api/campsites/**`) is out of scope and must not change — CAM-619 established it is correct.
Depends on: CAM-619 (recorded this exact follow-up in its tech.md)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host has `priceLow` and `priceHigh` both filled, with `priceLow > priceHigh` (either because they just edited the max down, or because the min is stale from an earlier session) | The host presses save (create or edit form) | Submit is blocked; a banner and inline messages under both price fields show `ราคาต่ำสุด {min} บาท มากกว่าราคาสูงสุด {max} บาท กรุณาแก้ไขราคาใดราคาหนึ่ง` (with the actual entered numbers substituted) | No `/api/campsites` request is sent (not even the prerequisite `/api/location` POST); no `CampSite` row is created/updated | EC-1 |
| AC-2 | A host has `priceLow <= priceHigh`, or either price field is blank | The host presses save | The form proceeds to submit normally; no price-band message shown | The existing save flow (POST/PUT `/api/campsites`) runs unchanged | — (happy path; nothing to negate) |
| AC-3 | The server independently receives an inverted band (e.g. a direct API call, or a race with a second stale session) | `POST`/`PUT /api/campsites` is called | (server-facing, no new end-user copy) `400` `ราคาต่ำสุดไม่สามารถมากกว่าราคาสูงสุดได้` | No Prisma write — `isPriceOrderValid` in `lib/validations/campsite.ts` is unchanged and still authoritative | EC-2 |

## Rules
- BR-1 The client guard runs `isPriceOrderValid({ priceLow, priceHigh })` (imported, unmodified, from `lib/validations/campsite.ts` — no parallel re-implementation of the comparison) on the same blank-to-null coercion the submit payload already uses, BEFORE the `/api/location` POST and BEFORE the `/api/campsites` POST/PUT. A violation sets both `priceLow` and `priceHigh` field errors plus the top banner to the SAME message and returns without any `fetch` call. (proves AC-1)
- BR-2 The message names both conflicting values (not just one field): `newCampground.priceOrderConflict` = TH `ราคาต่ำสุด {min} บาท มากกว่าราคาสูงสุด {max} บาท กรุณาแก้ไขราคาใดราคาหนึ่ง` / EN `Minimum price {min} is higher than maximum price {max}. Please adjust one of the two prices.` — `{min}`/`{max}` are the host's actual entered numbers, stored in `locales/translations.json` (TH+EN), never inlined. (proves AC-1)
- BR-3 The live inline hint under each price input (shown while typing, independent of submit) uses the SAME message and the SAME `isPriceOrderValid` check as the submit guard — never two different messages for the same condition. (proves AC-1)
- BR-4 The server-side `isPriceOrderValid` check in `lib/validations/campsite.ts` and its call sites in `app/api/campsites/route.ts` / `app/api/campsites/[id]/route.ts` are unchanged; an inverted band still 400s at the API regardless of what the client does. (proves AC-3)

## Edge cases
- EC-1 IF `priceLow > priceHigh` (both filled) on submit THEN the request never leaves the client (no `/api/location`, no `/api/campsites` call) and both price fields plus the banner show the paired conflict message (BR-1/BR-2).
- EC-2 IF the client guard is ever removed/bypassed (e.g. a future refactor) THEN the server must still reject an inverted band with `400` — pinned by a test that calls the real route handler directly (BR-4).
- EC-3 IF only one of `priceLow`/`priceHigh` is filled (the other blank) THEN `isPriceOrderValid` treats it as nothing-to-compare and submit proceeds (existing, unmodified server semantics, mirrored client-side) — same as AC-2.

## Data
- No schema/DB change, no migration. No new field. Reuses the existing `priceLow`/`priceHigh` form state and the existing exported `isPriceOrderValid` function.

## Seams & refs
- Reuse: `isPriceOrderValid` (`lib/validations/campsite.ts`, imported not re-implemented) · the existing `fieldErrors`/`serverError`/`scrollToFirstErrorField` guard idiom already used by the `maxGuestsPerDay` (CAM-351) and lat/lng (CAM-554) client-side guards in the same `handleSubmit` · `ErrorBanner` (`components/ui/error-banner.tsx`) · `InputField`'s existing `error=` slot.
- Refs: CAM-619 (`tech.md` §2 recorded this exact follow-up and the reason the server guard must stay a plain function, not a zod `.refine()`).

## Out of scope
- Any change to `lib/validations/campsite.ts` or `app/api/campsites/**` — the server guard stays exactly as CAM-619 left it.
- `components/spot-form-dialog.tsx` (spot-level pricing) — a different price pair; not audited by this story. If it shares this defect, that is a new ticket.

## Self-verify
- AC-1 → unit/integration (source-inspection + mocked-route, `__tests__/cam-623-*.test.ts`): the guard runs and returns before any `fetch`; the message is asserted verbatim (TH).
- AC-2 → unit: a valid band (or a blank side) does not trigger the guard and reaches the existing `campSiteSchema.partial()` pre-check unchanged.
- AC-3 → integration: direct route invocation (mocked Prisma/auth, same precedent as `cam-619-campsites-create-price-order.test.ts`) proving an inverted band still 400s server-side.
- Story-specific: confirmed the CREATE form and the EDIT form share the exact same `CampgroundForm` component (`app/host/new/page.tsx`, `app/dashboard/campsites/new/page.tsx`, `app/dashboard/campsites/[id]/edit/page.tsx` all render it), so one fix covers both — no separate create-path guard needed.
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created.
