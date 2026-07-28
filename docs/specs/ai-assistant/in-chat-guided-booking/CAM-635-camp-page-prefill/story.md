---
linear: CAM-635
feature: ai-assistant
epic: in-chat-guided-booking (CAM-630)
persona: Camper
artifact: story
owner: frontend
status: In Progress — spec-lite (G1 folds into G3 packet)
version: v1
updated: 2026-07-29
---
# The camp page opens with the dates and party size the camper already chose (CAM-635)

<!-- Spec-lite (S): no schema/migration · no new API contract (POST /api/bookings already
accepts `source`, CAM-642) · no new component/token (composes existing pickers/Select only)
· diff ~150-250 lines incl. tests. G1 folds into G3 per Gate policy v2. -->

## Story
As a **Camper**, I want the camp page to already show the dates and party size I picked while talking to น้องกองไฟ, so that I don't have to re-pick them from scratch when the chat hands me off to `/campgrounds/<slug>`.
Why: CAM-634 built the one shared read/write contract for this handoff (`lib/booking-prefill.ts`) but wired no caller yet — today the link is bare and every choice already made in chat is thrown away.
Scope: `app/campgrounds/[slug]/page.tsx` (reads `searchParams`, calls `parseBookingPrefill`, computes the `from=chat` attribution flag) + `components/CampgroundDetailClient.tsx` (seeds `checkIn`/`checkOut`/`guests` state from the parsed prefill; attaches `source: 'CHAT'` to the reserve POST when applicable). No new UI element, no new token, no new component — composes the existing date pickers, the existing guests `<Select>`, and the existing CAM-636 capacity-clamp effect exactly as they already render.
Depends on: CAM-634 (`lib/booking-prefill.ts`, the reader/writer contract) · CAM-636 (`lib/guest-capacity.ts`, the capacity-bounded guests control this story must cooperate with) · CAM-642 (`Booking.source`, the attribution field this story populates)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper follows a chat handoff link carrying a valid prefill (e.g. `?checkIn=2026-08-01&checkOut=2026-08-02&guests=2&from=chat`, dates ≥ today, ≤ 30 nights, guests ≥ 1) | The camp page loads | The check-in field already shows `1 ส.ค. 2026`, the check-out field already shows `2 ส.ค. 2026`, and the guests control already shows `2 คน` — no re-picking needed | No booking written yet; state is seeded client-side only | AC-2 |
| AC-2 | The link's date/guest values fail any one of `parseBookingPrefill`'s named checks (malformed / past / inverted / too_long / guests_out_of_range, e.g. `checkIn` already in the past) | The camp page loads | The page renders exactly as a bare link today — the check-in and check-out fields show the placeholder ("เลือกวันที่"-style empty state), the guests control shows `1 คน`; no toast, no banner | No booking prefill is applied; one structured server log line records the slug and the reject reason (no PII) | AC-1 (happy twin) |
| AC-3 | A valid prefill carries `guests` higher than the real remaining capacity for that exact stay (e.g. `guests=8` against a camp whose capacity for those dates is 3) | The camp page loads | The guests control shows a real, selectable number that fits the stay (e.g. `3 คน`) — never a blank/unselected control and never `8 คน` | `guests` state is clamped to the current capacity ceiling; the dates from the link are kept | EC-3 |
| AC-4 | The camper follows a link carrying `from=chat` and completes Reserve | The camper taps `จอง` | Unchanged — the existing reserve flow, states, and confirmation redirect | The booking write includes `source: "CHAT"` | AC-5 (WEB twin) |
| AC-5 | The camper opens the camp page directly (no `from=chat` in the URL) and completes Reserve | The camper taps `จอง` | Unchanged — the existing reserve flow | The booking write omits `source` (server defaults to `"WEB"`, CAM-642) | AC-4 (CHAT twin) |

## Rules
- BR-1 `app/campgrounds/[slug]/page.tsx` is the ONLY caller of `parseBookingPrefill` for this route; it never re-implements any of the reader's rules (proves AC-1/AC-2).
- BR-2 The parse is attempted only when the URL carries at least one of `checkIn`/`checkOut`/`guests` — an ordinary bare link (no query at all, the overwhelming common case) never triggers a parse or a log line (proves AC-2's "no toast/banner" + keeps the reject log meaningful).
- BR-3 `ctx.today` is sourced via the repo's Bangkok-local helper (`bangkokTodayISO()`, `lib/ai/date-phrases.ts`) — never a naive UTC-derived day (per `lib/booking-prefill.ts`'s own header rule).
- BR-4 `ctx.maxGuests` passed to `parseBookingPrefill` is always `null` at this layer. The real per-camp/per-date ceiling (live `remaining` capacity, or a per-spot camp's `maxGuestsPerDay` — a documented STALE column for that mode, CAM-636) is never knowable synchronously at request time. Only a structurally invalid guest count (`< 1`) rejects the WHOLE prefill here; an over-ceiling-but-positive count is CLAMPED client-side instead (proves AC-3; BR-6 of CAM-634 — the reject is still all-or-nothing when it does fire).
- BR-5 `checkIn`/`checkOut`/`guests` are seeded from `prefill` in the `useState` initializer only — never an effect — so an immediate date/guest change by the camper is never fought after the fact (proves AC-1).
- BR-6 The seeded `guests` value is always a member of the FIRST paint's own `guestOptions` list — computed with the SAME pure functions (`computeGuestCeiling` + `buildGuestOptions`, `lib/guest-capacity.ts`) the existing CAM-636 clamp effect already uses, with the same `remaining: null` a just-mounted component starts with. The `<Select>` never renders a value absent from its options (proves AC-3).
- BR-7 On any reject reason, the page renders byte-identical to today's no-prefill default: empty `checkIn`/`checkOut`, `guests = 1`. No toast, no `ErrorBanner` — a bad deep link is not something the camper can fix; the page's own pickers are the recovery (proves AC-2).
- BR-8 A rejected prefill emits exactly one structured server log line — `{event: "booking_prefill_rejected", slug, reason}` — no PII, no stack (proves AC-2's system effect).
- BR-9 `fromChat` (whether the reserve POST body carries `source: "CHAT"`) is read directly from the URL's `from=chat` param, independent of whether the date/guest prefill itself validated — a camper re-picking a rejected date range from a chat-originated link still attributes to CHAT (proves AC-4). Absent → the field is omitted from the POST body entirely, not sent as `"WEB"` (server default per CAM-642) (proves AC-5).
- BR-10 `source` remains a client-asserted attribution label only — it is never read by any pricing/capacity/authz decision anywhere in this story's diff (unchanged from CAM-642's own rule).

## Edge cases
- EC-1 IF the URL carries none of `checkIn`/`checkOut`/`guests` THEN no parse is attempted and no log line is emitted (BR-2).
- EC-2 IF `guests` in the link is structurally invalid (`< 1`, e.g. `guests=0` or a negative number) THEN the WHOLE prefill is rejected (`guests_out_of_range`) and dates are ALSO reset to empty — never "keep the dates, only reset guests" (BR-4, BR-7; matches CAM-634's all-or-nothing reader contract).
- EC-3 IF `guests` in the link is positive but exceeds the real capacity ceiling for the exact stay THEN only `guests` is adjusted (clamped) — the dates from the link are kept, never discarded (BR-4, BR-6).
- EC-4 IF the true ceiling is not yet resolved at first paint (the live remaining-capacity fetch is still in flight) THEN the seeded `guests` value still matches one of the options the `<Select>` shows at that exact moment — never a value that only becomes valid/invalid after the fetch resolves (BR-6).
- EC-5 IF the link carries `from=chat` but the date/guest prefill itself is rejected THEN the reserve POST still sends `source: "CHAT"` once the camper manually completes the form (BR-9).

## Data
- No entities/schema touched — no migration. Reads `Booking.source` (CAM-642, already shipped) only through the existing `POST /api/bookings` contract; this story adds no new field.
- Files: `app/campgrounds/[slug]/page.tsx` (searchParams + `parseBookingPrefill` call + reject log + `fromChat` flag) · `components/CampgroundDetailClient.tsx` (state seeding + reserve POST `source`) · `__tests__/cam-635-camp-page-prefill.test.ts` (page-level wiring) · `__tests__/cam-635-detail-client-prefill-seed.test.ts` (component-level wiring) · one pre-existing call site updated (`__tests__/cam-588-stale-client-and-swallowed-errors.test.ts`'s `invoke()` helper, now also passes an empty `searchParams`).

## Seams & refs
- Reuse: `lib/booking-prefill.ts` (`parseBookingPrefill`, the ONE reader — CAM-634, no parallel re-implementation) · `lib/guest-capacity.ts` (`computeGuestCeiling`/`buildGuestOptions`, the ONE ceiling/options derivation — CAM-636) · `lib/ai/date-phrases.ts` (`bangkokTodayISO`, read-only import, module itself untouched) · `lib/validations/booking.ts` (`source` enum — CAM-642, untouched).
- Refs: epic CAM-630 (in-chat guided booking) · CAM-634 (booking-prefill contract) · CAM-636 (capacity-bounded guests control) · CAM-642 (`Booking.source`) · CAM-637 (design brief for the in-chat side of this handoff; this story is the receiving end only, no UI change needed here per that brief's own framing).

## Out of scope
- Building the in-chat flow that calls `buildBookingPrefillQuery` to construct the link → CAM-637's design brief covers the chat-side UI; its build ticket is separate under epic CAM-630.
- Resolving the true per-date capacity ceiling synchronously at request time → still async/client-driven (CAM-636); this story only seeds cooperatively with that existing mechanism.
- Any toast/banner/error UI for a rejected prefill link → deliberately excluded (BR-7); a follow-up ticket only if product later decides a bad deep link deserves in-page feedback.
- Any new design token/component → none needed; composes existing pickers/`<Select>` only.

## Self-verify
- AC-1 → unit/integration: page-level test asserts a valid prefill's parsed value reaches `CampgroundDetailClient` as `prefill`; component-level test asserts `checkIn`/`checkOut`/`guests` state seed from it in the `useState` initializer (source-inspection + behavioral, matching this component's established test precedent, e.g. `cam-636-guests-select-wiring.test.ts`).
- AC-2 → one test per named reject reason (`malformed`/`past`/`inverted`/`too_long`/`guests_out_of_range`) asserting `prefill` is `null` and the reject log line's shape (`event`, `slug`, `reason`, no PII) + a bare-link control case asserting NO log line fires (EC-1).
- AC-3 → behavioral test: a per-spot/whole-camp fixture with a real ceiling below the prefilled `guests` proves the seeded value is a member of `buildGuestOptions(computeGuestCeiling(null, ...))`, never the raw over-ceiling number.
- AC-4/AC-5 → component test asserts the reserve POST body includes `source: 'CHAT'` when `fromChat` is true and omits the key entirely when false — mirrors `cam-642-booking-source.test.ts`'s AC-1/AC-2 shape from the frontend side.
- Story-specific: `grep -rn "useSearchParams" components/CampgroundDetailClient.tsx` → 0 (CAM-218 regression class — searchParams read server-side only) · no new hex/px/shadow literal (`check:ds`/`check:palette` green) · no new i18n key (no new copy added).
- **Clock discipline (G3 fix):** `page.tsx` sources `today` from the real clock (`bangkokTodayISO(new Date())`, BR-3) by design — it is never injected. `__tests__/cam-635-camp-page-prefill.test.ts` therefore freezes the clock for the whole file (`vi.useFakeTimers({toFake:['Date']})` + `vi.setSystemTime(FROZEN_NOW)`, `vi.useRealTimers()` in `afterAll`) so page.tsx's internal `new Date()` and the test's own reference point are the identical instant; every fixture (`TODAY`/`IN_5`/`IN_6`/`YESTERDAY`) derives from `bangkokTodayISO(FROZEN_NOW)` — the SAME function page.tsx calls — plus pure `Date.UTC` calendar arithmetic (`addISODays`), never date-fns `addDays`/`format` on a live Date (which reads the process's local timezone and was the actual root cause of the CI flake: the prior version computed `TODAY` via the test runner's local/UTC day while page.tsx computed Bangkok's civil day, disagreeing for ~7h of every UTC day). `cam-635-detail-client-prefill-seed.test.ts` and `cam-635-guest-seed-clamp.test.ts` are both clock-independent (source-inspection strings / plain integer fixtures) — confirmed by grep, no `new Date`/`Date.now`/date-fns date-arithmetic in either file.
- Gate = `/quality-gate`. Done = merged to `dev` with AC verified on localhost against the dev DB (a real deep link built by hand against a seeded local camp) before merge; G4 re-verifies on the real Staging URL after the batched promote.

## Changelog
- v1 (2026-07-29) — created; implemented in the same PR (spec-lite, G1 folds into G3).
- v2 (2026-07-29) — G3 fix: `cam-635-camp-page-prefill.test.ts` computed its own `TODAY`/`IN_5`/`IN_6`/`YESTERDAY` from the test process's local/UTC day (date-fns `format(new Date(), ...)`) while `page.tsx` computes Bangkok's civil day — these disagree for ~7h of every UTC day, which is exactly what CI hit (ran 19:45 UTC = 02:45 Bangkok the next day), rejecting a "today" checkIn as `past`. Fixed by freezing the clock for the suite and deriving every fixture from `bangkokTodayISO` (the same function page.tsx calls) + pure `Date.UTC` arithmetic, never a date far in the future (that would only narrow the window, not close it).
