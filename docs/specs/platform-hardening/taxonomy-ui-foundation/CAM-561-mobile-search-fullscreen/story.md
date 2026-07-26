## Story
As a **Camper**, I want the search dialog to take over the whole screen on my phone with no floating header bar, so that search feels like the native surface of the app instead of a small card with awkward chrome.
Why: owner decision 2026-07-26 — CAM-550 just applied "small viewport = full screen, shrink/close chrome does not exist" to the assistant; the same principle applies to Search so the two experiences don't diverge.
Scope: `components/SearchModal.tsx` (mobile-only geometry + header removal + a mobile dismiss affordance) + an additive, backward-compatible `hideOnMobile` prop on the shared `components/ui/modal-shell.tsx` `ModalHeader` (every other consumer's header is byte-identical when the prop is omitted). Desktop (`sm:` / 640px and above) is unchanged.
Depends on: CAM-550 (pattern precedent) · CAM-540 (dialog dismiss guard — must not regress)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper taps search on a small viewport (below 640px width) | The dialog opens | The dialog fills the entire screen; there is no title row and no floating close (×) button anywhere on screen | The dialog's box occupies the full viewport width and height; the header band renders with zero visible footprint | EC-1 |
| AC-2 | The camper taps search on a desktop-width viewport (640px and above) | The dialog opens | The dialog renders exactly as before: a centred card with the `ค้นหา` title row and the close (×) button | No change to desktop behavior | — (regression-guard only; desktop was already correct) |
| AC-3 | The dialog is open on a phone, header bar removed | The camper looks for a way to leave without searching | A close control is visible at the top of the scrollable content, always reachable without scrolling | Tapping it calls the same close handler the old header X used; no search is submitted | EC-2 |
| AC-4 | The dialog is open on a phone | The camper presses the device's Escape (or an attached keyboard's Escape key) | The dialog closes, identical to desktop | No regression to CAM-540's dismiss-guard behavior (a Select/Popover open inside the dialog must still not let a stray click close it; a real backdrop click and Escape still must) | — (regression-guard; CAM-540 already covers backdrop/Select) |
| AC-5 | The dialog is open on a phone | The camper looks at the top/bottom edges of the full-screen dialog | There is breathing room above the mobile close control and below the footer actions; content does not sit flush against a notch or the home-indicator | Content/footer padding includes a safe-area allowance | — (visual-only; no failure twin, verified by real-viewport measurement) |

## Rules
- BR-1 Below `sm:` (640px), the dialog's geometry is forced to fill the viewport (`h-[100dvh]`/`max-h-[100dvh]`, not a bare `inset-0` — CAM-550 lesson: a bare `inset-0` desyncs from the phone's address-bar animation) regardless of any other state. Desktop (`sm:`+) keeps the existing centred `sm:max-w-3xl` card untouched.
- BR-2 Below `sm:`, `ModalHeader`'s title row and close (×) button render with zero visible/tappable footprint: the title keeps only its accessible-name role (`sr-only`, never `hidden`/display:none, so the dialog's `aria-labelledby` still resolves to real text for assistive tech); the close control is fully absent from the accessible tree (matches CAM-550's "not merely hidden-but-tappable" standard for removed mobile chrome), not just visually hidden.
- BR-3 The mobile dismiss control (`btn--search-mobile-close`) calls the exact same `onClose` handler the desktop header's close (×) button calls — no separate close path, no state to drift.
- BR-4 CAM-540's dialog-dismiss guard (`components/ui/dialog.tsx`, unmodified by this story) must still pass unchanged: a Select/Popover opening inside this dialog must not let the resulting pass-through click dismiss the dialog, at any viewport.

## Edge cases
- EC-1 IF a camper resizes/rotates from desktop-width to below 640px while the dialog is open THEN the header disappears and the dialog becomes full screen on the very next re-render (CSS-driven via `max-sm:`, no separate mount — same technique CAM-550 proved).
- EC-2 IF the camper opens a Select (province) or a date Popover inside the full-screen mobile dialog and then taps elsewhere inside the dialog THEN the dialog must not close (CAM-540's guard, re-verified at a phone viewport, not just desktop).

## Data
- No schema/data change. Pure client-side layout fix in `components/SearchModal.tsx`, plus one additive optional prop (`hideOnMobile`, default `false`) on `components/ui/modal-shell.tsx`'s `ModalHeader`. Migration: none.

## Seams & refs
- Reuse: no new component — this story adjusts existing Tailwind classes on the existing `SearchModal`/`ModalContent`/`ModalHeader` shell, following the exact `max-sm:`-additive technique CAM-550 proved for `AiChatPanel.tsx` (h-[100dvh]/max-h-[100dvh], safe-area padding, additive-only so pre-existing pinned strings survive).
- `hideOnMobile` on `ModalHeader` (`components/ui/modal-shell.tsx`) is justified as a shared-shell change (not call-site-local) because `ModalHeader` is the sole owner of the title/close-button markup that needed independent mobile treatment; it is optional and defaults to `false`, so `FilterModal`/`LoginModal`/`RegisterModal`/`AmenitiesModal`/`spot-form-dialog.tsx`/`AddMemberDialog.tsx` are byte-identical when the prop is omitted (verified: `cam-220-modal-shell.test.ts`'s full pre-existing suite still passes unmodified — see test.md).
- Dismiss-path decision: chose a compact **back/close affordance living in the scrollable content flow** (`btn--search-mobile-close`, reuses the `Button`/`X` primitives + the existing `t.common.close` copy key) over relying solely on the `ค้นหา` submit button, because a camper who opened search by mistake needs a way out that does not also apply a search. It calls the identical `onClose` handler the desktop header's X calls (BR-3) — no new state. Placed as the first element inside the padded scrollable area (not absolutely positioned) so it needs no separate safe-area math and cannot overlap a notch.
- Refs: CAM-550 (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-550-mobile-assistant/story.md`, precedent) · CAM-540 (`components/ui/dialog.tsx` dismiss guard, unmodified, re-verified) — no ADR (a scoped mobile-layout change).

## Out of scope
- Any change to `components/ui/dialog.tsx` (CAM-540's guard) → out of bounds for this story, re-verified only.
- The other 6 `ModalHeader` consumers gaining mobile-fullscreen treatment → not requested; `hideOnMobile` stays opt-in per caller.
- `components/CategoryBar.tsx` / `locales/translations.json` → owned by a parallel CAM-554 PR (#639), not touched here.

## Self-verify
- AC-1/AC-2 → unit (`__tests__/cam-561-mobile-search-fullscreen.test.ts`, structural: `max-sm:` geometry classes present, `hideOnMobile` wired) + e2e (`e2e/regression/cam-561-mobile-search-fullscreen.spec.ts`, real browser at a phone viewport AND a desktop viewport — the only honest instrument for a responsive-CSS claim; measures the dialog's bounding box against the viewport)
- AC-3 → e2e (mobile close control visible + reachable + closes the dialog; also asserted absent at desktop, where the header's own X is the reachable control)
- AC-4 → e2e (Escape closes at a phone viewport) + re-run of the full pre-existing `__tests__/cam-540-dialog-dismiss-guard.test.ts` (must stay green, unmodified) + a phone-viewport case added to the CAM-540 dismiss e2e behavior inside this story's own spec (Select-open-then-click-inside must not dismiss, at a phone width)
- AC-5 → owner-verify (browser-only visual; `env(safe-area-inset-*)` present in source, same idiom as CAM-550)
- Story-specific: confirmed via source-inspection that `hideOnMobile` defaults to `false` and every other `ModalHeader` consumer's call site is unchanged (no `hideOnMobile` prop added anywhere but `SearchModal.tsx`).
- Gate = `/quality-gate` (lint 0 errors · typecheck clean · full vitest suite green · `check:ds`/`check:palette`/`check:contrast` PASS). Done = every AC verified on localhost before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created
