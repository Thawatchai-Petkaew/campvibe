---
linear: CAM-364
feature: m1-data-trust
epic: m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu (CAM-288)
persona: host
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-05
class: spec-lite
---
# ทำความสะอาดส่วนสถานะและการมองเห็นในฟอร์มแก้ไขแคมป์ (CAM-364)

## Story
As a **Host**, I want the Status & Visibility section of the edit-campsite form to only show
controls that actually do something when I click them, and I want the pet-policy toggle to live
somewhere that matches what it means, so that I never toggle a switch that silently does nothing
and the form's sections stay honest about what they contain.
Why: `isVerified` was a lying control — the toggle looked editable to every host, but
`lib/admin-fields.ts` (`applyAdminOnlyFields`) has always stripped it silently server-side for any
non-ADMIN caller (CAM-186 admin-fields hardening), so a host's click never persisted. Separately,
`petFriendly` (a guest-facing camp amenity) was grouped under "Status & Visibility" (an
internal-status card) purely by historical accident, not by meaning.
Scope: `components/CampgroundForm.tsx` only (+ `locales/translations.json` for one new read-only
copy key). No API/schema/migration change — reuses the EXISTING `applyAdminOnlyFields` server
behavior unchanged, the EXISTING `/api/operator/dashboard` fetch this form already makes (role now
also read off that same response), and EXISTING primitives (`Badge`, `TruncatedLabel`, `Card`).
Depends on: none (both defects are entirely client-side; the server-side strip behavior in
`lib/admin-fields.ts` and `requireCampSitePermission`'s ADMIN bypass are unchanged and already
covered by `__tests__/admin-fields.test.ts`).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The host (a non-ADMIN operator) opens the edit-campsite form for their own camp | The Status & Visibility card renders | `isVerified` renders as a read-only status row (no button, not clickable): a success badge reading `ยืนยันแล้ว` with a check icon when verified, or muted plain text reading `ยังไม่ได้ยืนยัน` when not | No `isVerified` toggle is rendered for a non-admin session; `isVerified` is never included in the save payload for that session (omitted, not sent as an unchanged value) | EC-1 |
| AC-2 | An ADMIN-role user (platform admin) opens the edit-campsite form for ANY camp | The Status & Visibility card renders | `isVerified` renders as the existing interactive toggle (unchanged behavior/copy) | Saving includes `isVerified` in the payload exactly as before; the PUT route accepts it for the ADMIN role (`lib/admin-fields.ts`, unchanged) | EC-2 |
| AC-3 | The host opens the edit-campsite form (any role) | The host scrolls to Amenities & Features | The Pet Friendly toggle (`อนุญาตสัตว์เลี้ยง`) renders there, above the facility/access/accommodation groups, with its existing copy and behavior unchanged | `petFriendly` continues to save exactly as before (same field, same payload key); the Status & Visibility card no longer contains this control | EC-3 |
| AC-4 | A save fails zod validation and `petFriendly` is among the failing fields (future schema rule) | The host taps `อัปเดต` | The page scrolls/moves focus to the Amenities & Features section (not Status & Visibility) | `FIELD_SECTION_ID['petFriendly']` resolves to `"amenities"` | — (shares AC-1's `scrollToFirstErrorField` mechanism from CAM-356; no separate failure path) |

## Rules
- BR-1 `isVerified` renders as the existing editable toggle ONLY when the session's role (from the same `/api/operator/dashboard` fetch the form already makes) is `'ADMIN'`; every other role renders the read-only status display. (proves AC-1, AC-2)
- BR-2 The read-only display never renders a `<button>`/`onClick`/`aria-pressed` for `isVerified` — it is informational only, no call-to-action. (proves AC-1)
- BR-3 For a non-admin session, `isVerified` is set to `undefined` in the save payload (dropped by `JSON.stringify`, never transmitted) rather than the current boolean; for an admin session it is sent unchanged. The server's own strip (`applyAdminOnlyFields`) is unaffected and stays the authoritative enforcement either way. (proves AC-1, AC-2)
- BR-4 `petFriendly`'s control (markup, copy, state wiring) is byte-identical to what shipped before — only its containing `Card` changes (Status & Visibility → Amenities & Features). (proves AC-3)
- BR-5 `FIELD_SECTION_ID['petFriendly']` maps to `"amenities"` (not `"status-visibility"`). (proves AC-4)

## Edge cases
- EC-1 IF a non-admin host's `/api/operator/dashboard` fetch has not yet resolved (role still `undefined` on first render) THEN `isVerified` renders the read-only display by default (fail-closed — the toggle only appears once the role is confirmed `'ADMIN'`, never optimistically)
- EC-2 IF an ADMIN session's `/api/operator/dashboard` fetch fails or is slow THEN the toggle falls back to the read-only display until role data arrives — the admin briefly sees the same safe default a host sees, never a broken/half-wired control
- EC-3 IF `petFriendly` is `true` on load (existing data) THEN the relocated toggle still reflects that value correctly in its new section (no state reset from the move)

## Data
- No schema/migration change. `isVerified` and `petFriendly` remain the same `CampSite` columns (`Boolean`, unchanged Prisma types). Only the client wire payload changes: `isVerified` is now conditionally omitted (`undefined`) instead of always present. The server (`lib/admin-fields.ts` `applyAdminOnlyFields`, `app/api/campsites/[id]/route.ts`) is unmodified · migration: none

## Seams & refs
- Reuse: `lib/admin-fields.ts` (`applyAdminOnlyFields`, unchanged — the server-side authority this story's client behavior now matches) · `lib/auth-utils.ts` (`requireCampSitePermission`, unchanged — confirms ADMIN reaches this same form/endpoint for any camp) · `app/api/operator/dashboard/route.ts` (already returns `operator.role`, no change) · `components/ui/badge.tsx` (`variant="success"`, same pattern as `components/ListingCompletenessCard.tsx`'s `badge--listing-completeness-complete`) · `components/ui/truncated-label.tsx`. Refs: `.claude/rules/security.md` (server stays authoritative; client change is UX/honesty only, not a new authz boundary) · `.claude/rules/code.md` (reuse-first, i18n).

## Out of scope
- Building an in-form admin "verify this camp" review workflow (audit trail, verification notes, etc.) beyond the existing boolean toggle → a separate ticket if the owner wants a richer admin verification flow.
- The publish-state gate for `isActive`/`isPublished` (both stay host-editable exactly as they are today) → CAM-365, a separate story.
- Any other Status & Visibility field reshuffle beyond `petFriendly`'s relocation → not needed; `isActive`/`isPublished` stay in place.

## Self-verify
- AC-1/AC-2 → source-inspection (`isAdminEditor` derived from `operator?.role === 'ADMIN'`; the interactive toggle renders only inside that branch with its own test id; the read-only branch renders a non-interactive `<div>` with a success `Badge` or muted text, never a button) + unit (`__tests__/cam-364-status-section-cleanup.test.ts` — role-gating, read-only markup, payload omission) + owner-verify on the real Staging URL (a host session sees the read-only badge/text and cannot toggle it; an admin session — if one is available on Staging — still sees the working toggle)
- AC-3/AC-4 → source-inspection (the `petFriendly` toggle control exists exactly once, positioned inside the `id="amenities"` Card and absent from `id="status-visibility"`; `FIELD_SECTION_ID` maps `petFriendly` to `"amenities"`) + unit (same test file) + owner-verify (Pet Friendly renders and saves correctly from its new location on Staging)
- Story-specific: no new component (reuse-only: `Badge`, `TruncatedLabel`, existing `Card`) · no schema/API/migration change · `check:ds` + `check:palette` stay green (token-only, no new hex/px) · the one new user-facing string (`notVerified`) lives in `locales/translations.json` (TH+EN), no em-dash, no technical jargon
- Gate = `/quality-gate` (`npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `check:ds` + `check:palette` green). **G1/G2 fold into this spec-lite packet** (single file-surface, no schema/API/new-endpoint, expected diff within the atomic-story range) — this `story.md` ships in the same PR as the code. Done = merge to `staging` + AC verified on the real Staging URL.

## Changelog
- v1 (2026-07-05) — created. Two defects on the campsite edit form's Status & Visibility section, fixed together as one atomic story (both client-only, same file surface): (1) `isVerified` was a lying host-facing toggle (server always stripped it for non-admins) — replaced with a read-only status display for every non-ADMIN session, keeping the toggle editable only for the ADMIN role that genuinely uses this form/endpoint to verify camps; (2) `petFriendly` relocated from Status & Visibility into Amenities & Features (its honest semantic home as a guest-facing camp feature), with the CAM-356 `FIELD_SECTION_ID` error-scroll map updated to match.
