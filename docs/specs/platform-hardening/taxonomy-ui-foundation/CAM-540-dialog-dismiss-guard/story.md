## Story
As a **Camper**, I want opening a dropdown inside a modal to NOT close the modal, so that I can finish choosing a value (e.g. a province) without the whole dialog vanishing out from under me.
Why: owner-reported and reproduced live in a browser (Playwright: dialog count 1 → 0 on one click inside the search modal after opening the province `<Select>`) — a shared-primitive defect, not a one-screen bug.
Scope: fix the shared `Dialog` primitive (`components/ui/dialog.tsx`) only. Every screen that nests a Select/Popover/DropdownMenu inside a Dialog inherits the fix for free; no per-screen changes.
Depends on: —

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A modal is open and contains a `<Select>`; the user has opened its dropdown | The user clicks anywhere else inside the modal (not the dropdown, not the true backdrop) | The dropdown closes; the modal stays open and fully visible/interactive — no `Thai` copy involved, this is a structural/interaction AC | The Dialog's `onOpenChange` is NOT invoked; no navigation/close side-effect fires | EC-1 |
| AC-2 | The same modal is open, with no dropdown/popover currently open | The user clicks the real dimmed backdrop area outside the modal card | The modal closes, exactly as before this fix | The Dialog's `onOpenChange(false)` fires once | EC-2 |
| AC-3 | The modal is open (with or without a nested dropdown open) | The user presses Escape | The modal closes | The Dialog's `onOpenChange(false)` fires; unaffected by this change (different code path) | — (baseline behavior, not touched by the fix) |

## Rules
- BR-1 The dialog's outside-interaction guard must suppress dismissal ONLY for the one interaction that was caused by a nested Radix popup (Select/modal Popover/modal DropdownMenu) being the topmost pointer-events layer; every other outside interaction (genuine backdrop click) must dismiss exactly as before. A guard that suppresses unconditionally is a worse bug than the one being fixed (AC-2 is the proof it doesn't).
- BR-2 Escape must remain untouched — the fix only touches the pointer-down-outside path (`onPointerDownOutside`), never `onEscapeKeyDown`.

## Edge cases
- EC-1 IF the click that would normally dismiss the dialog was caused by a nested popup's own pointer-events cascade (see Seams & refs — root cause) THEN the dialog does not dismiss for that one interaction (BR-1).
- EC-2 IF no nested popup was open at the time of the pointerdown THEN the guard must never engage — the dialog dismisses on the real backdrop click exactly as before (BR-1), and the guard must not "stick" across interactions (proven: select-close-then-backdrop-click in the same session still closes on the second click).

## Data
- No schema/data change. Pure client-side interaction fix in `components/ui/dialog.tsx`. Migration: none.

## Seams & refs
- Reuse: `components/ui/dialog.tsx` (`DialogContent`) is the ONE shared primitive every modal in the app composes from (`ModalContent` in `components/ui/modal-shell.tsx` wraps it; nothing re-implements a dialog shell elsewhere) — fixing it here fixes every screen (SearchModal, FilterModal, AmenitiesModal, spot-form-dialog, etc.) that nests a Select/Popover/DropdownMenu, with zero per-screen changes.
- Root cause (verified empirically, see `__tests__/cam-540-dialog-dismiss-guard.test.ts` and the in-file comment on `DialogContent`): Radix's `Select` (always) and a `modal` `Popover`/`DropdownMenu` set `disableOutsidePointerEvents: true` on their own popup layer while open. Radix's shared `DismissableLayerContext` (module-singleton across `@radix-ui/react-dismissable-layer`) then sets `pointer-events: none` on every OTHER layer that is not the topmost one with that flag — including the Dialog's own content box. A click that lands anywhere on the dialog's visible card (but not on the nested popup) is therefore not hit-tested there at all in a real browser; it passes straight through to the Dialog's own overlay underneath, which the Dialog's dismissable layer correctly-per-spec reads as a genuine backdrop click and closes.
  - An initially-considered fix — checking whether `event.target` is contained in a `[data-radix-popper-content-wrapper]` element — does **not** work for this codebase: by the time the guard observes the event, `event.target` is the OVERLAY (not anything inside the popup, confirmed empirically), and this repo's `<Select>` (`components/ui/select.tsx`) uses Radix's default `position="item-aligned"`, which never renders a `[data-radix-popper-content-wrapper]` element at all (that marker is `position="popper"`-only). The wrapper-containment check would silently no-op for every `<Select>` in this app.
  - The actual, verified mechanism: because Dialog defers its outside-pointerdown handling to the following `click` event (Radix's own `deferPointerDownOutside`, to give a nested popup first refusal), by the time the deferred check runs the nested popup has typically already unmounted — so ANY live-DOM-query signal (wrapper presence, `document.body.style.pointerEvents`) is stale. The fix instead records, via a `document`-level pointerdown CAPTURE listener (fires before Radix's own bubble-phase "outside" detection and before the popup can close/unmount), whether the Dialog's OWN content node had `pointer-events: none` at that exact instant — the literal CSS condition that causes the click pass-through — and reads that recorded flag back when `onPointerDownOutside` fires later, calling `event.preventDefault()` only when it was set.
- Refs: — (no ADR; a scoped primitive bugfix)
- Other primitives sharing the SAME composition (found while confirming there is no other in-scope occurrence, reported per the ticket's work item #5 — NOT fixed here, out of this story's file surface): `components/ui/alert-dialog.tsx` (used by `components/ui/confirm-dialog.tsx`) and `components/ui/sheet.tsx` both wrap a Radix `Content` the same way, with no `onPointerDownOutside`/`onInteractOutside` guard. Neither currently nests a Select/modal-Popover/modal-DropdownMenu anywhere in the app (grep-verified), so neither is exposed to this bug today — flagged as a follow-up watch-item, not a live defect.

## Out of scope
- Fixing `alert-dialog.tsx` / `sheet.tsx` pre-emptively (no live defect today; would be scope creep beyond the reported bug) → follow-up ticket if/when either primitive gains a nested Select/Popover/DropdownMenu consumer.
- Any change to `components/SearchModal.tsx` or any other call site — the whole point of this story is that the primitive owns the fix, not the call site.

## Self-verify
- AC-1 → unit (`__tests__/cam-540-dialog-dismiss-guard.test.ts`, Prove-It: red on pre-fix `dialog.tsx`, green after) + e2e (`e2e/regression/cam-540-dialog-select-dismiss.spec.ts`, real browser, real hit-testing)
- AC-2 → unit (two cases: backdrop-click-only, and backdrop-click-after-a-prior-select-close-in-the-same-session) + e2e
- AC-3 → unit (Escape sanity, unaffected code path)
- Story-specific: proved the naive `[data-radix-popper-content-wrapper]` check does NOT apply to this repo's default `<Select position="item-aligned">` (see Seams & refs) before committing to the pointer-events-cascade mechanism instead.
- Gate = `/quality-gate` (lint 0 errors · typecheck clean · full vitest suite 314/314 files green · `check:ds`/`check:palette` PASS). Done = every AC verified on localhost before merge into `dev`; the e2e spec could not be executed in this worktree (no seeded local regression DB / `.env.e2e` wired here — out of this story's scope to stand up) and relies on the CI `e2e-regression` job (already advisory/`continue-on-error`, per `e2e/regression/README.md`).

## Changelog
- v1 (2026-07-26) — created
