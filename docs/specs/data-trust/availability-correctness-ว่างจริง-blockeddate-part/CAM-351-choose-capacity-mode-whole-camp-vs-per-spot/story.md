<!--
ticket: CAM-351
epic: Availability Correctness — ว่างจริง (BlockedDate + partial capacity + hold)
feature: Data & Trust
status: Draft (proposed for G1)
version: v1
spec-class: FULL (M) — changes a business rule (completeness), reframes a form flow, adds copy, touches backend completeness. NOT spec-lite (spans 4 files + a rule change).
persona: Host
-->

## Story
As a **Host**, I want to choose upfront how my camp's capacity is defined — as one number for the whole camp, or derived per spot — so that a camp with no individual spots can still state its real capacity instead of being forced into a per-spot model that does not fit it.
Why: many camps do not define individual spots; they treat capacity as a whole (owner requirement 2026-07-04). Today the only capacity knob is a buried "Use Spot View" display toggle, and a whole-camp camp that (correctly) has no spots is permanently penalized on its listing-completeness score.
Scope: the **capacity-mode choice** in the host camp form (create + edit) + the whole-camp entry path + a read-only per-spot derived-total display + safe mode-switching that never deletes data + the listing-completeness "zones" fairness fix. Reuses the existing `useSpotView` flag and `Spot.maxCampers` — **no schema change, no migration**. Does NOT build a spot editor and does NOT change any availability/booking math (both are named follow-ups).
Depends on: — (CAM-304 completeness rule + CAM-343 holds UI already shipped; this coordinates with, does not block on, them)

## AC
<!-- Then = user-visible (verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A new camp form (create), no mode chosen yet | Host opens the Capacity card | Sees the question `กำหนดความจุของแคมป์แบบไหน` with two choices `ทั้งลาน` (`กำหนดจำนวนผู้เข้าพักรวมของทั้งแคมป์`) and `รายจุด` (`กำหนดจำนวนผู้เข้าพักในแต่ละจุด แล้วระบบจะรวมเป็นความจุของทั้งแคมป์`), with `ทั้งลาน` pre-selected | Form state `useSpotView = false` (WHOLE-CAMP is the default mode) | EC-3 |
| AC-2 | WHOLE-CAMP mode selected | Host enters `50` in the overall-capacity field and saves | The overall-capacity field labelled `จำนวนผู้เข้าพักสูงสุดต่อวัน` accepts `50` | `CampSite.maxGuestsPerDay = 50`, `useSpotView = false` | EC-3 |
| AC-3 | PER-SPOT mode selected, the camp has 3 non-deleted spots holding 4, 6, 6 people | Host views the Capacity card | Sees a read-only total `ความจุรวมของทั้งแคมป์ (คำนวณจากทุกจุด): 16 คน` and the note `หนึ่งจุดรองรับได้หลายคน จำนวนจุดไม่เท่ากับจำนวนคน` | No manual capacity input shown; total is derived (read-only), not stored as the source of truth here | EC-2, EC-5 |
| AC-4 | PER-SPOT mode selected, the camp has zero non-deleted spots | Host views the Capacity card | Sees `ยังไม่ได้เพิ่มจุดกางเต็นท์ ความจุจะคำนวณเมื่อคุณเพิ่มจุด` (no `0 คน` shown as if it were a real capacity) | Derived total treated as "not yet defined", not `0` | EC-5 |
| AC-5 | PER-SPOT mode with 3 existing spots | Host switches the mode to `ทั้งลาน` | Sees a warning `คุณมีจุดกางเต็นท์อยู่ 3 จุด หากเปลี่ยนเป็นแบบทั้งลาน ระบบจะใช้จำนวนที่คุณกรอกแทน (จุดเดิมจะถูกเก็บไว้แต่ไม่นำมาคำนวณ)` and the overall-capacity field appears | On save `useSpotView = false`; all 3 `Spot` rows are preserved (not deleted); capacity now reads from the manual field | EC-1 |
| AC-6 | WHOLE-CAMP mode with `maxGuestsPerDay = 50` | Host switches the mode to `รายจุด` | Sees `เปลี่ยนเป็นการกำหนดความจุแบบรายจุด กรุณาเพิ่มจุดกางเต็นท์เพื่อให้ระบบคำนวณความจุ`; the manual `50` field is hidden | On save `useSpotView = true`; the `maxGuestsPerDay` value is preserved in the row (kept-but-ignored while in PER-SPOT), so switching back restores it | EC-4, EC-6 |
| AC-7 | A published WHOLE-CAMP camp with `maxGuestsPerDay = 50` and zero spots | Host (or admin) views the listing-completeness score | The capacity criterion counts as satisfied; the missing-list does NOT show `ยังไม่ระบุความจุ (จำนวนรวม หรือจุดกางเต็นท์)` | Completeness score includes the 10-point capacity criterion (no permanent 10% penalty for a whole-camp camp) | EC-2 |
| AC-8 | A PER-SPOT camp with 1+ non-deleted spots | Host views the listing-completeness score | The capacity criterion counts as satisfied (unchanged from CAM-304 behavior) | Completeness score includes the 10-point criterion; existing per-spot camps unaffected | — (unchanged path) |
| AC-9 | An existing camp saved before this story with `useSpotView = true` | Host opens its edit form | The mode selector shows `รายจุด` selected (not reset to the default) | No write on load; the stored flag is the mode, mapped `true → รายจุด`, `false → ทั้งลาน` | EC-4 |
| AC-10 | A PER-SPOT camp (capacity derived from spots) | A camper searches dated results / attempts a booking for it | Booking availability, the search availability badge, remaining-capacity, and the guest-capacity filter behave **identically to before this story** (this story does not yet enforce spot-derived capacity downstream) | No availability/booking file is modified by this story; every consumer still reads `CampSite.maxGuestsPerDay` exactly as before (unchanged-by-construction) | EC-7 |
| AC-11 | WHOLE-CAMP mode, overall-capacity field empty or `0` | Host tries to save / publish | Sees `จำนวนผู้เข้าพักต้องมากกว่า 0` under the field; save is blocked | No write; `maxGuestsPerDay` unchanged | EC-3 |

## Rules
- BR-1 The capacity mode is stored in the **existing** `CampSite.useSpotView` boolean — `false` = WHOLE-CAMP (the default for a new camp), `true` = PER-SPOT. No new column, no migration. (proves AC-1, AC-9, BR-6)
- BR-2 In WHOLE-CAMP mode, `maxGuestsPerDay` must be an integer `≥ 1` to save and to count toward completeness; on empty/`0`/`< 1` show `จำนวนผู้เข้าพักต้องมากกว่า 0` (verbatim from the shared validation catalog, `.claude/rules/ux.md` §2 `capacity`). `maxTentsPerDay` and ground-type stay optional, WHOLE-CAMP only (unchanged). (proves AC-2, AC-11)
- BR-3 In PER-SPOT mode the camp-level capacity is **derived, read-only** = sum of `Spot.maxCampers` over **non-deleted** spots (`deletedAt = null`). One spot may hold many people — spot count ≠ guest capacity (owner's core constraint; already modelled by `Spot.maxCampers`, not a new field). Shown as `ความจุรวมของทั้งแคมป์ (คำนวณจากทุกจุด): {N} คน` where `{N}` is that sum. (proves AC-3, BR-7)
- BR-4 A mode switch **never deletes data**: switching PER-SPOT → WHOLE-CAMP keeps every `Spot` row (kept-but-ignored) and warns with `คุณมีจุดกางเต็นท์อยู่ {N} จุด หากเปลี่ยนเป็นแบบทั้งลาน ระบบจะใช้จำนวนที่คุณกรอกแทน (จุดเดิมจะถูกเก็บไว้แต่ไม่นำมาคำนวณ)`; switching WHOLE-CAMP → PER-SPOT keeps `maxGuestsPerDay` in the row (kept-but-ignored) and hints `เปลี่ยนเป็นการกำหนดความจุแบบรายจุด กรุณาเพิ่มจุดกางเต็นท์เพื่อให้ระบบคำนวณความจุ`. Last choice on save wins. (proves AC-5, AC-6, EC-1, EC-6)
- BR-5 Listing-completeness **capacity criterion is satisfied** when `spotCount ≥ 1` **OR** (`useSpotView = false` AND `maxGuestsPerDay ≥ 1`) — so a whole-camp camp with a stated capacity is no longer permanently penalized. The criterion label becomes mode-neutral: `ยังไม่ระบุความจุ (จำนวนรวม หรือจุดกางเต็นท์)` (replaces `ยังไม่มีโซนหรือจุดกางเต็นท์`). Weight stays 10; this is a coordinated change to the CAM-304 rule table (`lib/listing-completeness.ts`) and its label copy — update it in one place. (proves AC-7, AC-8)
- BR-6 Existing camps map by their current `useSpotView` value (the de-facto mode today) — no backfill, no data write on load. `true → PER-SPOT`, `false → WHOLE-CAMP`. (proves AC-9, EC-4)
- BR-7 The derived total (BR-3) and the completeness `spotCount` both exclude soft-deleted spots (`deletedAt = null`). Note: the existing `lib/spot-aggregation.ts:calculateSpotCapacity` sums ALL spots (no `deletedAt` filter) — a pre-existing inconsistency; the form's derived total must NOT reproduce it. Fixing `calculateSpotCapacity` itself is routed to the enforcement-parity follow-up (Out of scope). (proves AC-3, EC-5)
- BR-8 **Product decision (stated default, confirm at G1):** PER-SPOT remains selectable even though the in-app spot editor page does not exist yet (see Out of scope) — existing/seeded spots still derive correctly. The old "Create Spots" CTA that links to `/dashboard/campsites/{id}/spots` (a route that currently returns 404) is replaced by the honest derived-total display + empty state (AC-3/AC-4); no broken link ships. Alternative the owner may prefer: hide PER-SPOT behind "coming soon" until the spot editor ships. Default = keep it visible with the honest state.

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF the host switches PER-SPOT → WHOLE-CAMP while spots exist THEN keep every spot row, warn with `คุณมีจุดกางเต็นท์อยู่ {N} จุด หากเปลี่ยนเป็นแบบทั้งลาน ระบบจะใช้จำนวนที่คุณกรอกแทน (จุดเดิมจะถูกเก็บไว้แต่ไม่นำมาคำนวณ)`, and use the manual `maxGuestsPerDay` for capacity (BR-4)
- EC-2 IF a PER-SPOT camp has spots whose `maxCampers` are all null/unset THEN the derived total is `0`, which is shown as the empty state `ยังไม่ได้เพิ่มจุดกางเต็นท์ ความจุจะคำนวณเมื่อคุณเพิ่มจุด`, never as `0 คน` capacity, and the completeness capacity criterion stays unsatisfied (BR-3, BR-5)
- EC-3 IF WHOLE-CAMP mode is saved with `maxGuestsPerDay` empty, `0`, or `< 1` THEN block save and show `จำนวนผู้เข้าพักต้องมากกว่า 0` (BR-2)
- EC-4 IF an existing camp has `useSpotView = true` THEN its edit form loads in PER-SPOT mode (not reset to the WHOLE-CAMP default), with no write on load (BR-6)
- EC-5 IF every spot of a PER-SPOT camp is soft-deleted (`deletedAt` set) THEN the derived total counts them as absent (= `0`) and renders the empty state, matching the completeness `spotCount` of 0 (BR-7)
- EC-6 IF the host toggles the mode back and forth without saving THEN no data is lost — the manual number and the spot rows both persist; the last mode selected at save time is written (BR-4)
- EC-7 IF a PER-SPOT camp is searched/booked THEN availability behaves exactly as it did before this story (no new cap enforced) — this story adds NO mode-awareness to any availability consumer; enforcing spot-derived capacity is the named follow-up (BR-1, Out of scope)

## Data
- Reused, no change: `CampSite.useSpotView` (Boolean, the mode: false=WHOLE-CAMP / true=PER-SPOT) · `CampSite.maxGuestsPerDay` / `maxTentsPerDay` (WHOLE-CAMP entry, unchanged column semantics) · `Spot.maxCampers` (per-spot guest capacity, already "many people per spot") · `Spot.deletedAt` (soft-delete, for the non-deleted sum).
- Backend touch (no schema): `lib/listing-completeness.ts` `ListingCompletenessInput` gains `useSpotView: boolean` + `maxGuestsPerDay: number | null`; the capacity predicate uses them (BR-5). `app/api/campsites/[id]/completeness/route.ts` passes those two values (both already on the `campSite` object it fetches).
- migration: **none** (verdict: reuse `useSpotView` + `Spot.maxCampers`; a `useSpotView → capacityMode` enum rename would be a migration and is deferred — see Out of scope).

## Seams & refs
- Reuse (edit these): `components/CampgroundForm.tsx` Capacity card (`id="zones"`, lines ~1117–1242 — the `useSpotView` toggle + manual inputs + Create-Spots CTA) · `locales/translations.json` `newCampground.*` (replace the jargon keys `useSpotView`/`useSpotViewDesc`/`spotViewEnabled`/`createSpots*` with the plain-language mode copy in BR-1..BR-4; keep `maxGuestsPerDay`/`maxTentsPerDay`) · `lib/listing-completeness.ts` (BR-5 predicate + label) · `app/api/campsites/[id]/completeness/route.ts` (pass 2 fields) · `lib/spot-aggregation.ts:calculateSpotCapacity` (the existing derived-total helper the form's read can build on — but see BR-7 soft-delete note).
- Do NOT touch (the "downstream unchanged-by-construction" proof — every one still reads the raw `CampSite.maxGuestsPerDay` column, no mode-awareness added): `lib/campsite-availability.ts` (`getRemainingCapacity` · `getCampSiteDailyAvailability` · `getAvailabilityStatusForCamps` · `checkDateAvailabilityInTx`) · `lib/campsite-filters.ts` step 5 (guest-capacity filter) · `app/api/bookings/route.ts` (booking write path). CAM-343 holds spot-selector hides itself when a camp has no spots → mode-consistent by construction (WHOLE-CAMP = no spots), no change.
- Refs: ADR-012 (holds/availability) · CAM-304 (completeness rule — coordinate BR-5) · CAM-343 (holds UI) · CAM-326/328/329 (future camp→zone→pitch model — this story deliberately reuses the flat `Spot` model and must NOT pre-empt that richer model). Architect (G2): decide the enforcement-parity approach for the follow-up (persist derived total into `maxGuestsPerDay` vs make availability consumers read-through the aggregation).

## Out of scope
- Spot-management UI page — the in-app editor to add/edit/remove spots (`/dashboard/campsites/[id]/spots` currently returns 404; only the spot CRUD **API** exists). PER-SPOT hosts cannot yet manage spots in-app. → follow-up story: "Host spot-management UI" (CAM id TBD by orchestrator).
- Capacity-enforcement parity — make PER-SPOT-derived capacity actually drive booking limit / remaining-capacity / search availability badge / guest-capacity filter (today all read the raw `maxGuestsPerDay` column, so a PER-SPOT camp is effectively **uncapped** for availability — a pre-existing gap, not introduced here). Includes fixing `calculateSpotCapacity`'s soft-delete sum. Architect picks persist-vs-read-through at G2. → follow-up story: "Per-spot capacity enforcement parity" (CAM id TBD).
- `useSpotView → capacityMode` enum rename (clarity only; requires a migration) → deferred, ADR candidate.
- Richer camp→zone→pitch data model + map drawing → CAM-326 / CAM-328 / CAM-329 (future epic).
- Ground-type breakdown derivation in PER-SPOT mode (spots carry free-text `environment` only, not a structured ground-type) → not attempted; ground-type stays WHOLE-CAMP only.

## Self-verify
- AC-1..AC-6, AC-9, AC-11 → integration (form) + owner-verify on the real Staging URL (the mode UX, switch warnings, verbatim Thai copy, existing-camp load mapping).
- AC-7, AC-8 → unit (`computeListingCompleteness` with `useSpotView`+`maxGuestsPerDay` inputs: whole-camp-with-capacity satisfied, whole-camp-without unsatisfied, per-spot-with-spots satisfied) + integration on the completeness route.
- AC-3, AC-4, EC-2, EC-5 → unit on the non-deleted derived-total sum (3 spots → 16; zero spots → empty; all-deleted → empty).
- AC-10, EC-7 → regression: assert this PR's diff touches **no** file under the "Do NOT touch" list; the availability/booking suites pass unchanged (proof of unchanged-by-construction).
- Story-specific: mode is stored in `useSpotView` only (no new column) · no data-destroying write on any mode switch (spots + manual number both survive) · existing-camp load performs no write · Thai copy verbatim, no em-dash separator, no "Spot View" jargon.
- Gate = /quality-gate · Done = every AC verified on the real Staging URL.

## Changelog
- v1 (2026-07-04) — created. Discovery + gap map for the capacity-mode switch (reuse `useSpotView`, no schema change); enforcement parity + spot-editor UI split to named follow-ups.
