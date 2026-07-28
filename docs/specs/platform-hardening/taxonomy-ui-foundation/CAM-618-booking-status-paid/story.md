---
linear: CAM-618
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: story
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Stop showing a Thai camper the raw word PAID (CAM-618)

## Story
As a **Camper** looking at my bookings, I want every `Booking.status` value — including `PAID` — to render as a real Thai label like its four siblings, so that I never see a raw English token on a status badge.
Why: `prisma/schema.prisma`'s `BookingStatus` enum has carried five members (`PENDING`, `CONFIRMED`, `PAID`, `CANCELLED`, `COMPLETED`) since CAM-98 (2026-06-21, the string→enum conversion). `lib/booking-status.ts` and `app/api/bookings/[id]/route.ts` each independently hand-declared their OWN four-member union, both omitting `PAID` — because each is a hand-written shadow of the real enum, `Record<BookingStatus, BookingStatusMeta>` type-checked against the file's own (incomplete) union instead of the real one, so the compiler never caught the gap. `getBookingStatusMeta('PAID')` has fallen through to the "unknown status" contract (`{ labelKey: null, variant: 'muted' }`, AC#9 from CAM-60) since the day the enum gained the member.
Scope: `lib/booking-status.ts` (the label map, made exhaustive against the real Prisma type) · `app/api/bookings/[id]/route.ts` (a second shadow of the same enum, found in the same sweep, hardened without widening what a generic PATCH may set) · `locales/translations.json` (the new Thai/EN copy pair) · `__tests__/cam-618-*.test.ts`. Does not touch `prisma/schema.prisma` (the enum is already correct) or any file under `components/**`/`app/dashboard/**` — all five render surfaces already call the one shared `getBookingStatusMeta` util, so fixing the map fixes every surface with no per-surface edit.
Depends on: none. (`BookingStatus.PAID` has existed in the schema since CAM-98; this story only wires the missing consumer-side mapping — no schema change.)

## AC
| # | Given | When | Then (user sees, Thai verbatim; AC-6 is dev-facing, no end-user copy) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper has a booking with `status: 'PAID'` | The camper opens `/bookings` (their bookings list) | The status badge reads `ชำระเงินแล้ว` (not the raw word `PAID`) | No data change; `getBookingStatusMeta('PAID')` now returns `{ labelKey: 'statusPaid', variant: 'success' }` instead of falling back to the raw string | EC-1 |
| AC-2 | Same booking | The camper opens `/bookings/[id]` (booking detail) | The status badge reads `ชำระเงินแล้ว` | Same mapping, same shared util | EC-1 |
| AC-3 | Same booking, just created | The camper lands on `/bookings/[id]/confirmation` | The status badge reads `ชำระเงินแล้ว` | Same mapping, same shared util | EC-1 |
| AC-4 | Same booking | An operator/admin opens `/dashboard` (overview) | The status badge reads `ชำระเงินแล้ว` | Same mapping, same shared util | EC-1 |
| AC-5 | Same booking | An operator/admin opens `/dashboard/bookings` | The status badge reads `ชำระเงินแล้ว` | Same mapping, same shared util | EC-1 |
| AC-6 | A future developer adds a new member to `prisma/schema.prisma`'s `BookingStatus` enum and regenerates the Prisma client, but does NOT add a matching entry to `lib/booking-status.ts`'s `STATUS_MAP` | The developer runs `npm run typecheck` (or builds) | `tsc` fails, naming the missing member in the error (`Property '<X>' is missing in type ... but required in type 'Record<BookingStatus, BookingStatusMeta>'`) — the gap can no longer ship silently | No behavior change to running code; the build/typecheck step blocks the merge | EC-2 |

## Rules
- BR-1 `STATUS_MAP.PAID = { labelKey: "statusPaid", variant: "success" }`. Thai copy `ชำระเงินแล้ว` / English `Paid`, following the existing four entries' phrasing pattern (plain language, `...แล้ว` suffix matching `ยืนยันแล้ว`/`ยกเลิกแล้ว`/`เข้าพักแล้ว`, no jargon, no em-dash). `variant: "success"` reuses `CONFIRMED`'s variant (both are good-news states in the PENDING→CONFIRMED→PAID→COMPLETED flow; the label TEXT, not the badge color, is what distinguishes them for the camper). (proves AC-1..AC-5)
- BR-2 `lib/booking-status.ts`'s `BookingStatus` type is imported from `@prisma/client` (the Prisma-GENERATED type), replacing the hand-written union `"PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"`. `STATUS_MAP: Record<BookingStatus, BookingStatusMeta>` is therefore exhaustive against the REAL schema enum by construction — this is the drift guard (mirrors `lib/delivery/status-adapter.ts`'s `STATE_TO_STATUS: Record<TicketState, string>`, an already-proven instance of the same pattern). (proves AC-6)
- BR-3 `app/api/bookings/[id]/route.ts`'s own `BookingStatusEnum` (a SECOND, independent hand-written shadow of the same Prisma enum, found in the same sweep) is a deliberate ALLOWLIST of the statuses a generic `PATCH` may set — not a mirror that must grow with the schema. `PAID` stays excluded on purpose: payment status must come from a payment-processor integration (not yet built), never a manual `PATCH` by camper/host/admin — letting any authenticated caller flip their own booking to `PAID` would be a self-serve fraud vector. The literal array is hardened with `as const satisfies readonly BookingStatus[]` so a future rename/removal of one of its four members is still caught at compile time, without forcing the allowlist to grow with every new enum member.
- BR-4 Reachability (measured, not assumed): `PAID` cannot be written by ANY code path today. Grepped every writer of `Booking.status` — `POST /api/bookings` (`app/api/bookings/route.ts:165`) hardcodes `status: 'PENDING'`; the PATCH route's allowlist (BR-3) excludes `PAID`; no seed script (`prisma/seed.ts`, `prisma/seed-bookings.ts`) writes it; no payment route exists yet (`app/api/**payment**`/`**payout**` — none found). This story is a display-and-guard fix for a LATENT trap, not a live production bug seen by a real camper today; it becomes live the day a payment integration writes `status='PAID'`.

## Edge cases
- EC-1 IF a booking's status is one of the other four values (`PENDING`/`CONFIRMED`/`CANCELLED`/`COMPLETED`) THEN its existing Thai label is unchanged on all five surfaces (regression guard — this story must not alter the four working mappings).
- EC-2 IF `getBookingStatusMeta` receives a value that is not a real `BookingStatus` member (garbage/empty/future-unknown, e.g. `'REFUNDED'`) THEN it still falls back to `{ labelKey: null, variant: 'muted' }` (unchanged AC#9 behavior from CAM-60/CAM-61 — this story must not make every string "known").

## Data
- No schema/migration. `prisma/schema.prisma`'s `BookingStatus` enum already carries `PAID` (added in CAM-98, 2026-06-21) — this story adds no field/column, only a consumer-side label map entry + one translation key pair (`bookings.statusPaid` in `locales/translations.json`, TH + EN).

## Seams & refs
- Reuse: `lib/delivery/status-adapter.ts`'s `STATE_TO_STATUS: Record<TicketState, string>` — the exact same "Record typed against a Prisma-generated enum" pattern, already proven out and left unmodified by this story (read-only reference, per the dispatch's explicit out-of-bounds).
- Refs: CAM-98 (`feat(schema): S1 — string fields → Prisma enums`, 2026-06-21 — introduced `BookingStatus.PAID`) · CAM-60/CAM-225 (the original `getBookingStatusMeta` unification across all five render surfaces this story extends).

## Out of scope
- Making `PAID` reachable/settable (a payment-processor integration/endpoint) — BR-4. A future payment story's own job, including its own decision on whether/how `PAID` becomes settable and by whom.
- Widening `app/api/bookings/[id]/route.ts`'s PATCH allowlist to accept `PAID` — BR-3; intentionally left excluded, documented in-line.
- `app/dashboard/bookings/page.tsx`'s status FILTER `<Select>` (its `<SelectItem>` list already lacks `COMPLETED`, not just `PAID` — a pre-existing, unrelated gap). Not touched: `PAID` is unreachable today, so there is nothing yet for the filter to filter; adding it now would be building for a state that cannot exist (Iron Rule #2, no future-proofing). Follow-up: a future ticket, alongside the payment story that makes `PAID` reachable.
- Two other hand-written unions/arrays found in the sweep that shadow a Prisma enum the same way (`lib/team-permissions.ts`'s `TeamRole`, `lib/cancellation-policy.ts`'s `CANCELLATION_POLICY_VALUES`) — reported in `tech.md` §Sweep per the ticket's explicit "report what you find even if you only fix this one," not fixed here (out of this story's file surface; one is a documented deliberate trade-off, not an oversight — see tech.md).

## Self-verify
- AC-1..AC-5 → all five render surfaces call the one shared `getBookingStatusMeta`; unchanged, already-green source-inspection guards (`__tests__/ds4-badge-auth.test.ts`, `__tests__/f4-forms-operator.test.ts`, `__tests__/f5-account-misc.test.ts`, `__tests__/cam-398-bookings-list.test.ts`, `__tests__/cam-61-booking-detail.test.ts`) plus this story's own `__tests__/cam-618-booking-status-paid.test.ts` (`PAID` → `statusPaid`/`success` + Thai/EN copy verbatim character-for-character).
- AC-6/EC-2 → proven two ways: (1) manually, not shippable as an automated schema edit — temporarily added a 6th member to `prisma/schema.prisma`, ran `npx prisma generate` + `npx tsc --noEmit`, observed the real compiler error naming the missing property, then reverted both files (see `tech.md` for the captured output); (2) automated — a runtime companion test in `__tests__/cam-618-booking-status-paid.test.ts` iterates `Object.values(BookingStatus)` from the REAL `@prisma/client` runtime export and asserts every member resolves to a non-null `labelKey`; this test was verified to fail (red) when `PAID`'s `STATUS_MAP` entry is removed, then pass again once restored.
- EC-1 → existing `__tests__/booking-status.test.ts` (PENDING/CONFIRMED/CANCELLED/COMPLETED mapping tests, unchanged, still green).
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created.
