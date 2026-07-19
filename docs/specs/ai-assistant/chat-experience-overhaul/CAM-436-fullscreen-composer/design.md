---
ticket: CAM-436
feature: ai-assistant
epic: chat-experience-overhaul
persona: Camper
artifact: design
owner: ux-designer
status: standard-class (G2 pre-authorized — reuses existing tokens/components, no new screen/flow/token)
version: v1
updated: 2026-07-19
---

# Design — Fullscreen composer dock + scrollbar-to-edge (CAM-436)

> **G2 class:** standard change (`DESIGN.md` §Gate policy v2). Reuses existing `--ai-*` tokens
> (`bg-ai-surface`, `shadow-ai-glow`) + the existing `ring`/`ring-ring` focus token; no new
> screen, flow, or token introduced. `check:ds` + `check:palette` green. Read-only source: the
> owner-facing R2 readability design brief (Designer role) — this file is the FE-authored
> implementation record of that brief for this one story.

## Root cause (why the CAM-431 shape read wrong)

The fullscreen composer was `rounded-full` (a stadium) at the full reading-column width. A
stadium only reads intentional as a single-line 44px bar; the moment the textarea grows toward
`max-h-32` it becomes a stretched capsule ("empty" at idle, "detached" send button once it grows).
Width was never the problem — shape, inset symmetry, and a visible focus surface were.

## Decisions

1. **Shape: `rounded-full` → `rounded-3xl`.** A composer that grows vertically is a surface (card
   role), not a control-pill. `rounded-3xl` stays correct at 1 line AND at multi-line — the
   ChatGPT/Claude composer shape.
2. **Width: unchanged** — still the reading column (`max-w-2xl`/`sm:max-w-3xl`, centered). Do not
   narrow; narrowing would misalign the composer from the message column.
3. **Send button:** unchanged (`h-11 w-11 rounded-full`, bottom-right, inside the surface).
   `pl-5` → `pl-4` makes the textarea inset even on both sides, so the button reads as part of the
   box instead of flung to the right.
4. **Visible focus:** the expanded textarea is `border-none bg-transparent`, which swallows its own
   ring inside the gradient. Move focus indication to the surface (`focus-within:ring-2
   focus-within:ring-ring`) and suppress the inner ring (`focus-visible:ring-0` on the textarea) →
   one clean ring around the whole dock on keyboard focus.
5. **Scrollbar-to-edge:** the reading-column `max-w` previously lived on the shared flex wrapper
   that contained BOTH the message scroll region and the composer, so the native scrollbar sat at
   the column's inner edge (mid-screen), not the screen edge. Moved the `max-w-2xl
   px-4 sm:max-w-3xl sm:px-8` off that shared wrapper and onto (a) a wrapper `<div>` around
   `<AiChatMessageList/>` inside `<ScrollArea>`, and (b) the composer container. The `ScrollArea`
   itself — and its scrollbar — now span the full panel width; content still reads centered.

## States (8) + a11y

- **default:** `rounded-3xl` glass dock, glow + teal→sky accent, comfortable one-line resting
  height — reads as a real "type here" surface.
- **hover:** send button inherits its existing `Button` hover; no dock-level hover added.
- **focus:** `focus-within:ring-2 ring-ring` on the surface — one visible ring. *Re-verify with
  keyboard + axe that the ring is clearly visible over the gradient (not measured yet).*
- **active:** send button `motion-safe:active:scale-95` (unchanged).
- **disabled:** send `disabled={!canSend}`; textarea `disabled={sending || disabled}` (unchanged).
- **loading:** send swaps to `LoadingSpinner` while `sending` (unchanged).
- **empty:** placeholder `composerPlaceholder` (existing locale key, unchanged) — now reads
  correctly as an idle box instead of an empty stretched pill.
- **error:** N/A on the composer itself; a send failure surfaces as an error entry in the message
  list (unchanged).
- Tap target: send button 44×44px (`h-11 w-11`) ✓. `aria-label={t.aiChat.send}` ✓ (unchanged, no
  new copy).

## Anti-slop pass

Shape by role (`rounded-3xl` surface for a growing card, `rounded-full` only for the fixed-size
circular send control) — not one radius applied everywhere. No new gradient beyond the already-
sanctioned §2.1 teal→sky accent. Token-only (`bg-ai-surface`, `shadow-ai-glow`, `ring-ring`, no
hex/px). Clear hierarchy: one input, one send action.

## Reference

ChatGPT / Claude composer — rounded-rect surface, textarea grows in place, circular send pinned
bottom-right *inside* the surface, one focus ring around the whole box.

## Not measured (owner/QA follow-up)

- Contrast of the focus ring over the gradient backdrop (axe, real browser).
- Visual read of the full-width scrollbar meeting the screen edge on a real deployed viewport.
