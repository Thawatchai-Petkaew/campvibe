---
linear: CAM-365
feature: m1-data-trust
epic: m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu (CAM-288)
persona: host
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-05
class: full
---
# เผยแพร่แคมป์ได้ต่อเมื่อข้อมูลครบอย่างน้อย 80% (CAM-365)

## Story
As a **Host**, I want the publish switch to stay locked until my listing is at least 80% complete (with the missing items shown so I can go fix them), so that no camper ever lands on a half-empty listing missing its price, fee, or cancellation policy (raises the share of published listings that meet the M1 "Listing Truth" bar; not measured, baseline set after ship).
Why: M1 "Listing Truth" — CAM-304/CAM-305 already show a host what is missing, but nothing stops them publishing a 30%-complete listing anyway; the owner (2026-07-05) set an 80% completeness floor for the unpublished→published transition. Publishing stays a host action, only gated.
Scope: gate the unpublished→published transition on completeness score ≥ 80 — a disabled publish control with the reason + missing list on the client (UX), AND a server-authoritative reject on the PUT/POST write path. Reuses the CAM-304 scoring function and the CAM-305 anchor map. No schema change, no new endpoint, no change to catalog visibility or the scoring rule itself.
Depends on: CAM-304 (completeness score + `computeListingCompleteness` — MERGED) · CAM-305 (anchor map + missing-list card — MERGED) · CAM-364 (status-visibility section restructure — IN FLIGHT, see Seams)

## AC
<!-- Then = user-visible (verbatim Thai) · System effect = data outcome · Neg/edge = failure twin. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host is editing an unpublished camp whose live completeness score is below 80 (e.g. 60%) | The host looks at the publish switch in the status-visibility section | The publish switch is disabled (unclickable) and shows `ต้องกรอกข้อมูลให้ครบอย่างน้อย 80% ก่อนเผยแพร่ ตอนนี้ 60%`, with the itemized missing list below it (e.g. `ยังไม่ระบุราคา`, `ยังไม่ระบุนโยบายยกเลิก`), each item a link that jumps to the section to fix it | No write; `isPublished` stays `false` | EC-1 |
| AC-2 | A host is editing an unpublished camp whose live score is exactly 80 | The host turns the (now enabled) publish switch on and saves | The camp saves and is published (success), no block message | `isPublished` set to `true` (score 80 ≥ 80) | EC-1 |
| AC-3 | A host is editing an unpublished camp at 60% because the price is missing | The host fills the price in this same edit (score rises to 80), turns publish on, and saves | The camp saves and is published (success) | The price AND `isPublished=true` are written in the same save; the server evaluates the state as-it-will-be-after-this-save (score 80 ≥ 80) and accepts | AC-4 |
| AC-4 | A camp's post-save score would still be below 80 | A request sets `isPublished=true` directly on the write path (bypassing the disabled switch) | The request is rejected and the camp is not published; the message is `ยังเผยแพร่ไม่ได้ ต้องกรอกข้อมูลให้ครบอย่างน้อย 80% ก่อน ตอนนี้ 60%` | HTTP 400; `isPublished` left unchanged (not set to `true`) | EC-5, EC-6 |
| AC-5 | A camp is already published and its owner removes photos so the live score drops to 55% | The host saves that edit (publish left on) | The camp stays published (success); it is not auto-hidden | `isPublished` stays `true` (already-published is never re-gated; no auto-unpublish) | EC-7 |
| AC-6 | A camp is published (any score) | The host turns the publish switch off and saves | The camp is unpublished (success), no block message | `isPublished` set to `false` (unpublishing is never gated) | — (a true→false transition has no failure twin — unpublish is always allowed) |

## Rules
- BR-1 Threshold single-source: the floor is a named constant `PUBLISH_MIN_COMPLETENESS = 80`, exported from `lib/listing-completeness.ts` beside `MIN_PHOTOS_FOR_COMPLETE`. Both the client (the disabled-switch UX gate) and the server (the PUT/POST write path) import this one constant — the value never appears as a literal in a form or a route. Changing the floor is a one-line, single-place edit. (proves AC-1, AC-2)
- BR-2 Inclusive boundary: `score >= PUBLISH_MIN_COMPLETENESS` permits publishing; `score <= 79` blocks it. 80 is allowed, 79 is blocked. (proves AC-2, EC-1..EC-3)
- BR-3 Gated transition only — no auto-unpublish: the gate fires ONLY on the unpublished→published transition (the stored `isPublished` is `false` and the request sets it `true`). A camp that is already published is NEVER re-gated on completeness, so a later score drop below 80 does not hide or unpublish it. Unpublishing (`true`→`false`) is always allowed. Re-publishing after an unpublish is a fresh false→true transition and is gated again (≥ 80 required). (owner-vetoable — the owner may later add an auto-unpublish policy; that is out of scope here.) (proves AC-5, AC-6, EC-7)
- BR-4 Evaluation point = post-save projection: the score is evaluated against the camp's state AS IT WILL BE AFTER this same save is applied — the stored atomic fields overlaid with this request's changed fields, plus the relation counts reflecting any relation replacement in this request and the live image/option/spot counts at write time — NOT the pre-save stored state. This is what lets one save both complete the last missing field and publish (AC-3). It is computed with `computeListingCompleteness` (the exact CAM-304 rule), fed the same inputs the completeness route assembles. (proves AC-3, EC-6)
- BR-5 Server-authoritative: the PUT and POST handlers recompute the score server-side and reject a below-threshold publish transition with HTTP 400 and the copy `ยังเผยแพร่ไม่ได้ ต้องกรอกข้อมูลให้ครบอย่างน้อย 80% ก่อน ตอนนี้ {N}%` (`{N}` = the live server-computed score). The server never trusts a score sent by the client — it computes its own. The client disabled switch is UX only (ux.md rule 1). (proves AC-4, EC-1, EC-5, EC-6)
- BR-6 Create parity: a create (POST) that requests `isPublished=true` is the same false→true transition and is gated identically on the post-create projected score. The normal form create always sends `isPublished=false`, so only a direct API create can reach this — it is rejected the same way (HTTP 400, same copy). (proves EC-4)
- BR-7 No role bypass: an ADMIN is subject to the identical gate on both client and server. Data quality is the entire point of the gate, so no role — including platform admin — bypasses it. (proves EC-5)
- BR-8 Client UX gate: the publish switch is disabled while the live form score < 80 AND the camp is currently unpublished. The disabled control shows `ต้องกรอกข้อมูลให้ครบอย่างน้อย 80% ก่อนเผยแพร่ ตอนนี้ {N}%` plus the itemized missing list — labels rendered verbatim from `computeListingCompleteness`'s `missing[]`, never re-derived (same rule as CAM-305 BR-1) — each item linking to its edit section via the CAM-305 anchor map (`photos`, `price`, `cancellation-policy`, `extra-fee`, `zones`, `amenities`). The score is computed live from the current unsaved form state, so filling a field enables the switch the instant the score reaches 80 (AC-3). When the camp is already published the switch stays enabled so the host can unpublish (BR-3). (proves AC-1, AC-3)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF the live score is exactly 79 THEN the switch stays disabled with `ต้องกรอกข้อมูลให้ครบอย่างน้อย 80% ก่อนเผยแพร่ ตอนนี้ 79%`, and a forced `isPublished=true` on the write path is rejected `400` `ยังเผยแพร่ไม่ได้ ต้องกรอกข้อมูลให้ครบอย่างน้อย 80% ก่อน ตอนนี้ 79%` (BR-2, BR-5)
- EC-2 IF the live score is exactly 80 THEN the switch is enabled and the publish transition is accepted (boundary is inclusive) (BR-2)
- EC-3 IF the live score is 81 THEN the switch is enabled and the publish transition is accepted (BR-2)
- EC-4 IF a create request (POST) sets `isPublished=true` while its post-create projected score is below 80 THEN the create is rejected `400` with the same copy — nothing is created as published (BR-6)
- EC-5 IF an ADMIN sets `isPublished=true` on a camp whose post-save score is below 80 THEN the request is rejected `400` exactly as for a host — no admin bypass (BR-7)
- EC-6 IF a client submits an optimistic/stale publish while the persisted post-save score is below 80 THEN the server recomputes the score live at write time (ignoring any client-sent score) and returns `400`; a switch reflecting a stale score can never publish past the server gate (BR-4, BR-5)
- EC-7 IF a host unpublishes a below-80 camp and then tries to re-publish it while still below 80 THEN the re-publish (a fresh false→true transition) is gated again and blocked until the score reaches 80 (BR-3)

## Data
- Read-only for the gate. The only column written is the existing `CampSite.isPublished` (boolean), already whitelisted on the PUT and POST paths. To compute the score the gate reads existing atomic fields (`priceLow`, `isFree`, `extraFeeAmount`, `extraFeeLabel`, `cancellationPolicy`, `useSpotView`, `maxGuestsPerDay`) plus live relation counts (non-deleted `Spot`, `Image`, `options`) — the same inputs the CAM-304 completeness route already assembles. No new field, no new enum, no new endpoint. migration: none.

## Seams & refs
- Reuse: `lib/listing-completeness.ts` — `computeListingCompleteness` (the pure, Prisma-free scoring fn, safe to import client- AND server-side) + a NEW exported `PUBLISH_MIN_COMPLETENESS = 80` constant added here (single-source threshold, BR-1). · `app/api/campsites/[id]/completeness/route.ts` — the reference for exactly which selects/counts feed `ListingCompletenessInput`; the PUT handler must assemble the same inputs but from the post-save projection (G2/architect designs the merge: body-over-existing for scalars, live counts for relations). · `app/api/campsites/[id]/route.ts` PUT + `app/api/campsites/route.ts` POST — the `isPublished` whitelist lines where the server gate is inserted (detect the false→true transition by comparing the stored `isPublished`, then recompute the projected score). · `components/CampgroundForm.tsx` status-visibility section (~line 1436, the publish toggle button) — the disabled state + helper + missing list attach here. · `components/ListingCompletenessCard.tsx` `ANCHOR_BY_KEY` — reuse this exact anchor map for the missing-item links (in-page anchors `#photos` … `#amenities`, all confirmed present as `Card id=` in the form). · `lib/campsite-visibility.ts` `isCampSitePublic` + `lib/campsite-filters.ts` `buildCampSiteWhere` — confirm the public catalog already hides `isPublished=false`; UNCHANGED (no visibility work in this story).
- Coordinate with in-flight **CAM-364** (branch `fix/cam-364-status-section-cleanup`): CAM-364 restructures this same status-visibility card (makes `isVerified` read-only, moves `petFriendly` out). This spec targets the POST-364 shape — the publish toggle stays in the status-visibility card; if CAM-364 has not merged when this builds, rebase onto it first (STOP RULE: repo shape contradicting this spec → report, do not improvise). CAM-363 (MERGED, #375) already restructured the capacity section but preserved the `#zones` anchor.
- Refs: CAM-304 (score fn), CAM-305 (anchor map + missing-list rendering), CAM-351 (mode-neutral zones criterion), ux.md rule 1 (server-authoritative; client validation = UX only), api.md §2 (authz/ownership unchanged via `requireCampSitePermission`).

## Out of scope
- Auto-unpublishing a published camp that later drops below 80 → NOT done (BR-3, no auto-unpublish); owner-vetoable, no follow-up ticket.
- Gating publish on `isVerified` (the platform trust badge) → out of scope; verified is an admin-only field (CAM-364), not a completeness signal.
- Making the 80 threshold configurable per camp / per plan → out of scope; the floor is a single constant.
- Changing the completeness scoring rule or weights → owned by CAM-304/CAM-351, unchanged here.
- A separate dedicated "publish" button/flow → out of scope; publish stays the existing toggle in the status-visibility section.

## Self-verify
- AC-1 → component test: score < 80 + unpublished → toggle disabled + helper `ตอนนี้ {N}%` + missing list rows with the CAM-305 anchor links.
- AC-2, EC-1/EC-2/EC-3 → route test (PUT): projected score 79 → `400`, 80 → `200` (published), 81 → `200`.
- AC-3 → route test (PUT): request that BOTH sets the last missing field AND `isPublished=true`, projected score reaches 80 → `200` (post-save projection accepts).
- AC-4, EC-6 → route test (PUT): direct `isPublished=true` at projected score < 80 → `400` with the verbatim copy; a client-sent score field is ignored.
- AC-5 → route test (PUT): stored `isPublished=true`, save with score now < 80 and `isPublished` unchanged → `200`, stays published.
- AC-6, EC-7 → route test (PUT): stored `isPublished=true` → set `false` → `200`; then set `true` at score < 80 → `400`.
- EC-4 → route test (POST): create with `isPublished=true` at projected score < 80 → `400`, nothing created as published.
- EC-5 → route test: ADMIN caller, `isPublished=true` at score < 80 → `400` (no bypass).
- e2e candidate: on the real Staging URL, a host fills an incomplete listing up to 80% and publishes; a below-80 listing shows the disabled switch + missing list.
- Story-specific: ownership unchanged (`requireCampSitePermission`, CAMPSITE_UPDATE) · no migration · transition detected by comparing the stored `isPublished` (never gate an already-published camp) · threshold imported from the single constant on both sides.
- Gate = /quality-gate · Done = every AC verified on the real Staging URL.

## Changelog
- v1 (2026-07-05) — created
