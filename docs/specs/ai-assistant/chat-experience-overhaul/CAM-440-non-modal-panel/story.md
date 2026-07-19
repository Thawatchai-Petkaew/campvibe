## Story
As a **Camper**, I want opening the น้องกองไฟ chat panel to never disturb the rest of the page, so that the whole website doesn't grow a blank band down its right edge and shift left the moment I open the assistant.
Why: R2 bug — owner report "a big sidebar suddenly appeared on the right of the whole website." Root cause: `AiChatPanel`'s Dialog root was a default-MODAL Radix Dialog, so opening it mounted Radix's `RemoveScroll`, which injects `body{padding-right + margin-right:<scrollbarWidth>px !important}` on open — a page-wide scroll-lock artifact, independent of CAM-429's already-transparent overlay. CAM-434 (launcher mounted on every page) turned a panel-local artifact into a site-wide one.
Scope: `components/ai-chat/AiChatPanel.tsx` (the Dialog root's `modal` prop + its doc comments) only. Does NOT touch `AiChatMessageList.tsx` / `AiChatLauncher.tsx` / `components/ui/dialog.tsx` / any token or new component.
Depends on: CAM-429 (transparent overlay, the panel this bug lives in), CAM-434 (the global-mount that made the bug site-wide)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper is on any page (chat panel closed) | Camper opens the น้องกองไฟ chat panel (launcher tap) | หน้าเว็บทั้งหมดไม่มีแถบว่างปรากฏที่ขอบขวาและเนื้อหาไม่ขยับ | `Dialog` mounts with `modal={false}` → Radix's `RemoveScroll` never mounts → no `body` padding/margin injected → no reflow of any element outside the panel | EC-1 |
| AC-2 | Chat panel is open | Camper presses Esc, clicks outside the panel, or taps the close button | แผงแชทปิดลงตามปกติ | `onOpenChange(false)` fires via Radix's `DismissableLayer` on `Dialog.Content` (unchanged — does not depend on `modal`) | AC-3 |
| AC-3 | Chat panel is open | Camper opens it | โฟกัสของแป้นพิมพ์ย้ายไปที่ช่องพิมพ์ข้อความทันที | `onOpenAutoFocus` still redirects focus into the composer (unchanged) | AC-2 |

## Rules
- BR-1 The Dialog root (`components/ai-chat/AiChatPanel.tsx`) is non-modal: `<Dialog open={open} onOpenChange={onOpenChange} modal={false}>`. This is the only behavioral change.
- BR-2 The CAM-429 transparent `DialogOverlay` stays in the tree unchanged (`bg-transparent`) — harmless under `modal={false}`, kept to minimize churn.
- BR-3 Dismiss (Esc key, outside-pointer, close button) and focus-on-open (`onOpenAutoFocus`) are unchanged — these live on `Dialog.Content`'s `DismissableLayer`/`FocusScope`, which do not depend on the `modal` prop (verified against `@radix-ui/react-dialog` source).
- BR-4 (accepted trade-off, stated not hidden) — `modal={false}` also removes Radix's focus TRAP (Tab can leave the panel to the rest of the page) and `hideOthers` aria-hiding of background siblings. This is the correct shape for a non-intrusive floating assistant that must never lock or hide the rest of the page (matches the owner's original CAM-429 "no overlay" intent); it is not a partial fix.

## Edge cases
- EC-1 IF the panel is opened on a page whose content is already exactly viewport-width (no native scrollbar) THEN there is still no injected padding/margin (RemoveScroll never mounts at all under `modal={false}`, not just skipped conditionally).

## Data
No schema change. No migration. No new `locales/` keys.

## Seams & refs
- Reuse: `components/ui/dialog.tsx`'s `Dialog`/`DialogPortal`/`DialogOverlay` (unchanged) + the Radix `Dialog` primitive's own `modal` prop (no new component, no new token).
- Refs: CAM-429 (`docs/specs/ai-assistant/chat-experience-overhaul/CAM-429-chat-shell-launcher/`, introduced the transparent overlay + the RemoveScroll/hideOthers claim this story corrects) · CAM-434 (`docs/specs/ai-assistant/chat-experience-overhaul/CAM-434-global-launcher/`, made the bug site-wide by mounting the launcher on every page).

## Out of scope
- A custom scroll-lock or a partial/opt-in scroll-lock for the panel — the owner's intent is that this floating assistant never touches page scroll at all; if a future story needs a scroll-lock for a different modal, that is its own ticket.
- Any change to the focus-trap/background-hiding behavior of OTHER modals in the app (photo modals, confirm dialogs) — those stay modal (`RemoveScroll`/`hideOthers` intact) and are unaffected by this fix.

## Self-verify
- AC-1/BR-1 → `__tests__/cam-440-non-modal-panel.test.ts` (Prove-It: asserts `modal={false}` is present on the Dialog root; fails against the pre-fix source)
- AC-2/BR-3 → `__tests__/cam-440-non-modal-panel.test.ts` (no `onEscapeKeyDown`/`onPointerDownOutside`/`onInteractOutside` override; close button still calls `onOpenChange(false)`) + pre-existing `__tests__/cam-272-ai-chat-components.test.ts` AC-8 block (same invariant, untouched)
- AC-3/BR-3 → `__tests__/cam-440-non-modal-panel.test.ts` (`onOpenAutoFocus` + composer `.focus()` still present; `onCloseAutoFocus` still absent, i.e. not overridden to compensate)
- BR-2 → `__tests__/cam-440-non-modal-panel.test.ts` (transparent `DialogOverlay` still present)
- BR-4 (trade-off) — documented in the code comment at the Dialog root and in this story; not independently testable in the `node`-environment Vitest config (no jsdom), stated honestly rather than asserted
- Gate = `/quality-gate` (lint 0 errors / typecheck / test / build + `check:ds`/`check:palette` green) · Done = AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created
