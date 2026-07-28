---
linear: CAM-623
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: design
owner: frontend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Design — Tell the host about the price band before the server has to (CAM-623)

## Flow
No new screen. `CampgroundForm.tsx`'s existing Pricing card (`components/CampgroundForm.tsx`, `id="price"`) is unchanged in layout — both `priceLow`/`priceHigh` inputs stay visible together, as they already are. The only new behavior is at submit time: `handleSubmit` now runs a price-order guard (reusing the server's own `isPriceOrderValid`) before the `/api/location` and `/api/campsites` requests. On conflict, submit is blocked and the SAME idiom already used by the two neighboring client-side guards in this handler (`maxGuestsPerDay` — CAM-351, lat/lng pin — CAM-554) fires: `setFieldErrors` on both price fields + `setServerError` (rendered by the existing `ErrorBanner` near the top of the form) + `scrollToFirstErrorField` to the Pricing card. This is standard-class per Gate v2 (reuses existing tokens/components/flows, no new screen/token).

## Non-goals
Does not touch the server's `isPriceOrderValid` (`lib/validations/campsite.ts`) or its two call sites (`app/api/campsites/route.ts`, `app/api/campsites/[id]/route.ts`) — CAM-619 already established that guard is correct and it stays authoritative regardless of the client. Does not touch `components/spot-form-dialog.tsx` (a different price pair, not audited here).

## States (8)
- **default** — both price inputs empty or filled with a valid (non-inverted) band; no error shown.
- **hover/focus** — unchanged, inherited from `InputField`/`components/ui/input.tsx` (token-only, not touched by this story).
- **active** — unchanged (typing in either field).
- **loading** — unchanged; the existing `isLoading` spinner on the Save button covers the async save request, which this guard now simply prevents from firing on a conflict.
- **error (this story's addition)** — `priceLow > priceHigh` (both filled): both price inputs show the same inline message (via `InputField`'s existing `error=` slot) AND the top `ErrorBanner` shows the identical message; submit does not proceed. The live inline hint (while typing, before any submit attempt) and the submit-blocking message are now the SAME string — previously they were two different, field-specific strings (`minPriceError`/`maxPriceError`) shown only as a warning, never blocking.
- **empty** — either price field blank: guard treats it as nothing-to-compare (mirrors server `isPriceOrderValid` semantics exactly) and does not block.
- **disabled** — unchanged (Pricing card is hidden, not disabled, when `isFree` is toggled on; out of this story's scope).

## Validation UX
Per BR-1/BR-2/BR-3 (`story.md`): on `priceLow > priceHigh`, both `input--campground-price-low` and `input--campground-price-high` show the SAME inline error text, and `alert--campground-validation` (the existing `ErrorBanner` testid) shows it too. Copy source: `locales/translations.json` → `newCampground.priceOrderConflict` (TH/EN), interpolating `{min}`/`{max}` with the host's actual entered numbers — chosen over the two old asymmetric strings (`minPriceError`/`maxPriceError`) specifically so the message names the CONFLICTING PAIR, not one field, per the ticket's framing (the host's mental model is "I changed the maximum", not "the minimum is wrong").

## Components & tokens
No new component, no new token. Reused: `InputField` (`components/ui/input-field.tsx`, its existing `error=` prop), `ErrorBanner` (`components/ui/error-banner.tsx`, already wired to `serverError` state at the top of the form), the existing `fieldErrors`/`zErr()`/`scrollToFirstErrorField` plumbing this same file already uses for the `maxGuestsPerDay` and lat/lng guards. `check:ds` + `check:palette` stay green (no class/token change).

## a11y
Unchanged primitives carry their existing a11y: `ErrorBanner` has `role="alert"`; `InputField`'s error text is associated with its input via the existing `aria-describedby` wiring (pre-existing, not touched); focus ring and tap target are inherited, untouched by this story. `scrollToFirstErrorField(["priceLow"])` moves programmatic focus to the Pricing card (`tabIndex={-1}`), the same pattern already used for the other two client-side guards.

## Links
`story.md` (AC-1..AC-3, BR-1..BR-4) · CAM-619 `tech.md` §2 (the recorded follow-up this story closes, and why the server guard is a plain function, not a zod `.refine()`) · `components/ui/error-banner.tsx` · `components/ui/input-field.tsx`

## Changelog
- v1 (2026-07-28) — created.
