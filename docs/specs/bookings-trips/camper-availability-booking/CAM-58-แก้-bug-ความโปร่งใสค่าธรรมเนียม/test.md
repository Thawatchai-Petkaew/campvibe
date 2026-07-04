---
linear: CAM-58
feature: bookings-trips
epic: camper-availability-booking (CAM-23)
persona: camper
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-06-23
---
# Test — แก้ bug ความโปร่งใสค่าธรรมเนียม (CAM-58)

> 35 tests total: 21 unit (`__tests__/booking-pricing.test.ts`, 100% module coverage) +
> 14 source-inspection (`__tests__/f3-detail-surface.test.ts`, the CAM-58 block).
> Scope note: CAM-58 ships the no-fee fix; the original story-table AC (which assumed
> +20/+35 fees *would be persisted*) was superseded — the correct behaviour is "no fees,
> displayed total == recorded total". The tests below assert that corrected behaviour.

## AC→test matrix
| AC (corrected behaviour) | type | test file | status |
|---|---|---|---|
| Displayed total == recorded total (single source of truth) | unit | `__tests__/booking-pricing.test.ts` (`totalAmount equals subtotalAmount`) | ✅ |
| Unit price = spot price when present, else `priceLow`, else 50 | unit | `__tests__/booking-pricing.test.ts` (`resolveUnitPrice` suite) | ✅ |
| Subtotal = unitPrice × nights; no platform fees | unit | `__tests__/booking-pricing.test.ts` (`computeBookingPrice` normal/invariant) | ✅ |
| VAT extracted inclusive (not added on top) | unit | `__tests__/booking-pricing.test.ts` (`VAT-inclusive` + `taxAmount never added`) | ✅ |
| Edge: 0 / negative nights, null prices, large prices | unit | `__tests__/booking-pricing.test.ts` (boundary/null-empty cases) | ✅ |
| Breakdown renders only room-subtotal + total rows (no fee rows) | unit (source) | `__tests__/f3-detail-surface.test.ts` (CAM-58 block) | ✅ |
| Total label uses `t.booking.total`; testids `row--booking-room-subtotal` + `row--booking-total` present | unit (source) | `__tests__/f3-detail-surface.test.ts` (CAM-58 block) | ✅ |
| UI consumes the shared module (`resolveUnitPrice`/`computeBookingPrice` from `booking-pricing`) | unit (source) | `__tests__/f3-detail-surface.test.ts` (CAM-58 block) | ✅ |

## Validation cases
**`resolveUnitPrice` (9 cases) — normal · null/empty · boundary:**
- normal: returns `priceLow` when no spot price; spot price overrides `priceLow`.
- null/empty: both null → 50; both undefined → 50; spot null/undefined → `priceLow` fallback.
- boundary: spot price `0` treated as absent → falls through to `priceLow`; `priceLow` `0` → 50 fallback; very large spot price (99999) returned as-is.

**`computeBookingPrice` (12 cases) — normal · boundary · null/empty · invariant:**
- normal: subtotal = unitPrice × nights; `totalAmount === subtotalAmount`; `vatRate 0` → `vatInclusive false`, `taxAmount 0`; VAT-inclusive 7% extracts tax from subtotal (`round((subtotal − subtotal/1.07) × 100)/100`); spot override end-to-end through both functions.
- boundary: 0 nights → all amounts 0 (no crash); 0 nights + VAT → `taxAmount 0`; negative nights clamped to 0; 1 night handled.
- null/empty: fallback unit price (50) × nights → valid result.
- **invariant (adversarial regression):** `totalAmount === subtotalAmount` for every `{unitPrice, nights, vatRate}` combination; `taxAmount` is **never** added to `totalAmount` (asserts `totalAmount !== subtotal + taxAmount`) — guards against re-introducing add-on-top fees/VAT.

**Adversarial source guards (the 2 highlighted in the brief), in `__tests__/f3-detail-surface.test.ts`:**
1. The breakdown has **no fee rows** — asserts `t.booking.cleaningFee` / `t.booking.serviceFee` and hardcoded `const cleaningFee =` / `const serviceFee =` / old `const totalPrice =` are all **absent** from `CampgroundDetailClient.tsx`.
2. The `feeInfo` "Good to know" block is structurally separate from (renders after) the booking breakdown — the breakdown shows only the room-subtotal row + the total row (`row--booking-total`), with the informational fee block in a distinct card below.

Re-asserted at the UI layer (vatRate=0): displayed total = `unitPrice × nights` and is **not** the old incorrect `1055` (= 500×2 + 20 + 35); `priceLow` null → 50 × nights.

## Coverage
- `lib/booking-pricing.ts`: **100%** module coverage (measured).
- Full suite: **1686 tests pass · 91% overall coverage** at the quality gate. Meets the ≥80%-on-new-code bar.

## Gate results
lint 0 errors · typecheck clean · `npm test` 1686 pass · coverage 91% (module 100%) · `npm run build` ok · `check:palette` ok · `check:ds` ok · `npm audit --omit=dev` 0 high/critical. No migration.

## Links
`story.md` (AC/Rules) · `tech.md` (module contract + invariant) · `.claude/rules/qa.md`

## Changelog
- v1 (2026-06-23) — created from shipped CAM-58 (35 tests, adversarial breakdown/feeInfo guards, gate results).
