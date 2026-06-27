---
linear: CAM-220
feature: design-system-v2
epic: modal-header-consistency-one-shared-shell (CAM-219)
persona: platform
artifact: design
owner: ux-designer
status: Todo
version: v1
updated: 2026-06-27
---
# Design — MODAL-1: Unify modal header into one shared shell (CAM-220)

## Problem

Every modal hand-rolls its own header. Root cause is a padding asymmetry: the X button is absolute-positioned at `top-4` but the header band height varies because each modal chooses different vertical padding for its header container. Concretely:

- LoginModal / RegisterModal: `p-6` on the header container (24px top, 24px bottom of the band)
- SearchModal / FilterModal: `p-6 pb-2` (24px top, 8px bottom of the band)
- AmenitiesModal: uses base `DialogHeader` with `p-6 pb-4`, no X button at all, and is `rounded-2xl` (wrong — spec is `rounded-3xl` per DESIGN.md §2)
- AddMemberDialog: uses base `DialogContent` without `showCloseButton={false}`, so the built-in `top-4 right-4 bg-secondary` X button is active; header is left-aligned, not centered

The X button SIZE is identical everywhere (`size="icon"` = `size-11` = 44x44 confirmed in `components/ui/button.tsx` line 29: `icon: "size-11"`). The drift is entirely the band height, not the button size.

## Solution

Two components in `components/ui/modal-shell.tsx`:

1. `ModalHeader` — owns the header band: centered title, optional description, bottom divider, and the X close button vertically centered in the band via `absolute right-4 top-1/2 -translate-y-1/2`. This positioning invariant guarantees equal top/bottom gap regardless of whether a description is present.
2. `ModalContent` — thin wrapper over `DialogContent` that sets the canonical shell classes once and passes `showCloseButton={false}` so the built-in X is suppressed.

---

## Canonical ModalHeader Spec

### Props

```
title: string                    // required — the DialogTitle text
description?: string             // optional subtitle line
closeLabel?: string              // i18n aria-label for the X button (default: t.common.close)
onClose?: () => void             // forwarded to DialogClose onClick
```

### Header band: exact classes

```
relative flex items-center justify-center px-6 py-4 border-b border-border/60
```

**Why `py-4` (16px top + 16px bottom):**
- The current LoginModal/RegisterModal header uses `p-6` (24px all sides). With `top-4` (16px from top), the button sits inside a 24px band but starts 16px from the top — that leaves only 8px below the button inside the band, producing visible asymmetry when the built-in `bg-secondary` X is shown.
- `py-4` sets the band to 16px top + 16px bottom. The X is then positioned at `top-1/2 -translate-y-1/2` — vertically centered in the band — giving exactly half the band height (16px) above AND below the button regardless of title-only or title+description.
- `py-4` is a Tailwind scale utility (maps to `--spacing-4` = 1rem = 16px). No inline value needed.
- Horizontal padding `px-6` maintains the existing house rhythm and provides clearance so the centered title does not collide with the absolute X button at `right-4`.

### ASCII sketch of the header band

```
+---------------------------------------------------------------+
|  px-6                                        right-4          |
|    py-4 (16px)                                                 |
|                                                                |
|              Modal Title (centered)             [  X  ]        |
|         Optional description line              (top-1/2        |
|                                               -translate-y-1/2)|
|    py-4 (16px)                                                 |
+------- border-b border-border/60 ----------------------------+
```

The X sits at `right-4 top-1/2 -translate-y-1/2`. When description is absent the band height is fixed (py-4 above + title line-height + py-4 below). When description is present the band grows taller and the X re-centers automatically — the invariant holds by construction.

### Title: exact class

DESIGN.md §3 states `DialogTitle` uses `font-heading text-base leading-none font-medium`. However, all 6 existing modals override this to `text-lg font-bold text-foreground`, and the story AC explicitly requires the centered title. The canonical ModalHeader title class is:

```
text-lg font-bold text-foreground text-center
```

Rationale: `font-bold` at `text-lg` is the established pattern across all 6 modals and gives the header appropriate visual weight relative to the body content below. `font-heading` + `font-medium` at `text-base` (from base DialogTitle) would make the modal header lighter than the section headings inside the modal body, producing a reversed hierarchy. The `text-center` is required by DESIGN.md §3 overlay grammar ("centered"). The element rendered MUST be `DialogTitle` (the Radix primitive) so it supplies the accessible name to the dialog — the class override is purely visual.

Rendered as `<DialogTitle className="text-lg font-bold text-foreground text-center">`.

### Description slot: exact class

```
text-sm text-muted-foreground text-center mt-1
```

Only rendered when the `description` prop is provided. Rendered as `<DialogDescription>` (the Radix primitive) so screen readers associate it with the dialog. `mt-1` = `--spacing-1` = 4px gap below the title — matches the existing base `DialogHeader`'s `gap-1.5` rhythm.

### X close button: exact classes

```
variant="ghost"
size="icon"
className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full hover:bg-muted"
aria-label={closeLabel}
data-testid="btn--modal-close"
```

Icon: `<X className="w-5 h-5 text-foreground" />` (lucide-react, named import).

`size="icon"` resolves to `size-11` (44x44px) — confirmed in `components/ui/button.tsx` line 29. Tap target is 44px x 44px — meets WCAG 2.1 AA requirement.

`rounded-full` — per DESIGN.md §2 radius table: "button · input · icon-button → `rounded-full`".

`hover:bg-muted` — the ghost variant already provides `hover:bg-muted hover:text-foreground` in `button.tsx` line 18; the class is not duplicated but is noted here for clarity. Do NOT add `bg-secondary` (that is the default DialogContent built-in button style and creates a filled background — wrong for the overlay close pattern).

Focus ring: inherited from Button base class `focus-visible:ring-3 focus-visible:ring-ring/30` (button.tsx line 8). No additional focus class needed.

Reduced motion: Button base has `motion-safe:active:scale-95` (button.tsx line 8). No additional animation added by ModalHeader — inherits the motion policy from Button. Respects `prefers-reduced-motion` automatically via `motion-safe:`.

Rendered inside `<DialogPrimitive.Close asChild>`.

---

## Canonical ModalContent Spec

### Props

Passes all `DialogContent` props through, plus suppresses the built-in close button.

### Exact classes applied at the ModalContent level

```
showCloseButton={false}
className="sm:max-w-md p-0 overflow-hidden border-none rounded-3xl bg-card shadow-2xl"
```

**Class-by-class rationale:**

| class | source | note |
|---|---|---|
| `rounded-3xl` | DESIGN.md §2 radius table: "card · modal/dialog · sheet → `rounded-3xl`" | NOT `rounded-2xl`. AmenitiesModal currently uses `rounded-2xl` (off-spec). |
| `bg-card` | DESIGN.md §2 color table: "card/surface raised surface" | NOT `bg-popover`. The base DialogContent uses `bg-popover` (= card in light, same token value, but `bg-card` is the semantically correct token for a modal surface). All 6 existing modals already pass `bg-card` explicitly. |
| `shadow-2xl` | DESIGN.md §2 shadow tiers: "modal → `shadow-2xl`" | The base DialogContent uses `shadow-xl`. The shadow tier table in DESIGN.md §2 explicitly states `shadow-2xl` for modals. All 6 existing modals already pass `shadow-2xl` explicitly. `shadow-2xl` wins over the base `shadow-xl`. |
| `p-0` | body padding stays per-modal | The header owns its own padding. Body content uses `p-6 md:p-8` (DESIGN.md §2 spacing: "modal content → `p-6 md:p-8`") placed inside the modal body area below the header, not at the shell level. |
| `overflow-hidden` | required | Clips body content to the `rounded-3xl` corners. |
| `border-none` | house style | All 6 modals pass this; the base DialogContent does not set a border, but Tailwind base can add one via ring. This is explicit suppression. |
| `showCloseButton={false}` | prevents duplicate X | The header owns the X. |

**Each modal passes its own width class** as an additional className (e.g. `sm:max-w-md` for Login/Register, `sm:max-w-3xl` for Search/Filter). The ModalContent default should be `sm:max-w-md` (matches the most common case) — wider modals override.

The `ring-1 ring-foreground/5` from the base DialogContent is kept (not suppressed) — it provides a subtle surface edge that aids perception in dark mode.

---

## Interaction states — ModalHeader (all 8)

| state | X button behavior | title/description |
|---|---|---|
| default | ghost, no fill | rendered normally |
| hover | `bg-muted` fill (from ghost variant) | unchanged |
| focus | `ring-3 ring-ring/30 border-ring` (from Button base) | unchanged |
| active | `scale-95` (motion-safe, from Button base) | unchanged |
| loading | not applicable (caller disables the whole modal or shows spinner in body) | unchanged |
| error | not applicable to the header — error shows in body via ErrorBanner | unchanged |
| empty | not applicable | not applicable |
| disabled | `pointer-events-none opacity-50` when `onClose` is not passed or dialog is submitting | title/description remain visible |

---

## Per-modal migration table

| Modal | Current header markup | What frontend replaces | Special notes |
|---|---|---|---|
| `components/LoginModal.tsx` | `<div className="flex items-center justify-center p-6 border-b border-border/60">` + `<DialogClose asChild><Button ...><X/></Button></DialogClose>` + `<DialogTitle ...>` | Entire header `<div>` replaced by `<ModalHeader title={t.auth.login} closeLabel={t.common?.close} onClose={handleClose} />` | `DialogContent` `showCloseButton={false}` already set — replace outer `DialogContent` with `ModalContent` |
| `components/RegisterModal.tsx` | Same structure as Login but header `<div>` contains a nested `<div className="text-center">` wrapping both `<DialogTitle>` and a `<p>` subtitle | Replace with `<ModalHeader title={t.auth.registerModal.title} description={t.auth.registerModal.subtitle} closeLabel={t.common?.close} onClose={onClose} />` | The subtitle `<p>` becomes the `description` prop — it renders as `<DialogDescription>` in the shared header |
| `components/SearchModal.tsx` | `<div className="flex items-center justify-center p-6 pb-2 border-b border-border/60">` — note `pb-2` (8px bottom, source of the asymmetry) | Replace with `<ModalHeader title={t.search.search} closeLabel={t.common?.close ?? "Close"} onClose={onClose} />` | The redundant `w-11 h-11` explicit sizing on the X button disappears — `size="icon"` handles it |
| `components/FilterModal.tsx` | `<div className="flex items-center justify-center p-6 pb-2 border-b border-border/60 relative shrink-0">` — same `pb-2` asymmetry | Replace with `<ModalHeader title={t.filter?.title ?? "Filters"} closeLabel={t.common?.close} />` | No explicit `onClose` needed — `DialogClose` inside `ModalHeader` triggers Radix close. Keep `shrink-0` on the outer wrapper if needed for the flex layout; ModalHeader itself does not need it since it is not in a flex-grow context |
| `components/AmenitiesModal.tsx` | `<DialogHeader className="p-6 pb-4 border-b">` + `<div className="flex items-center justify-between"><DialogTitle>...</DialogTitle></div>` — NO X button today; `DialogContent` does NOT pass `showCloseButton={false}` so the built-in `bg-secondary top-4 right-4` X is active (not ghost); `rounded-2xl` on DialogContent (off-spec) | Replace `DialogContent` with `ModalContent`; replace `DialogHeader` block with `<ModalHeader title={t.campground.whatOffers} closeLabel={t.common.close} onClose={onClose} />`. Keep the existing footer Close button — this is a long scroll list and the footer button provides a second exit path (AC-4 explicitly keeps it). The header X is now ADDED. | **Radius fix**: `rounded-2xl` (18px) must become `rounded-3xl` (22px) via ModalContent — DESIGN.md §2 radius table. This is the explicit off-spec gap called out in DESIGN.md §8 backlog item 4. AmenitiesModal also uses `import * as Icons from "lucide-react"` — this is a wildcard import that bundles all 1414 lucide icons (PERF-BUNDLE anti-pattern). The frontend SHOULD fix this to named imports when touching this file, per `.claude/rules/performance.md` and the pattern established in FilterModal. |
| `components/settings/AddMemberDialog.tsx` | `<DialogContent className="rounded-2xl max-w-md">` (wrong radius — `rounded-2xl` not `rounded-3xl`); uses base `DialogHeader` (left-aligned); `DialogTitle` is left-aligned (`text-left`); `DialogDescription` is left-aligned (`text-left`); built-in `bg-secondary` X is active (no `showCloseButton={false}`) | Replace `DialogContent` with `ModalContent className="sm:max-w-md"`; replace entire `<DialogHeader>...</DialogHeader>` block with `<ModalHeader title={t.settings?.addTeamMember ?? "Add Team Member"} description={t.settings?.addMemberDesc ?? "Invite a team member to help manage your camp site"} closeLabel={t.common?.close} onClose={handleClose} />` | The `DialogDescription` becomes the `description` prop on ModalHeader. Title shifts from left-aligned to centered — this is a design correction per DESIGN.md §3 overlay grammar. **Radius fix**: `rounded-2xl` becomes `rounded-3xl` via ModalContent. |

---

## a11y notes

- `<DialogTitle>` is the Radix primitive — it provides the accessible name for the `role="dialog"` automatically. Frontend MUST render it as `<DialogTitle>` (imported from `components/ui/dialog`), not a plain `<h2>` or `<p>`, even though the visual style is customized.
- `<DialogDescription>` is the Radix primitive — it is associated with the dialog via `aria-describedby` automatically. Frontend MUST use it for the description slot.
- Esc + overlay-click close come from Radix Dialog root — ModalContent wraps DialogContent which wraps the Radix primitive. No change to this behavior.
- Focus is trapped inside the Dialog by Radix. The X button is the first focusable element in the header. Tab order after X: the first focusable element in the modal body.
- The X button `aria-label` is supplied by the `closeLabel` prop. Callers MUST pass `t.common.close` (TH: `"ปิด"` / EN: `"Close"` — confirmed in `locales/translations.json` lines 68 and 752). No new i18n key is needed.
- Contrast: `text-foreground` on `bg-card` — both are OKLCH tokens that invert correctly in dark mode. Contrast is not measured here; it is verified as theme-safe by the token system. Mark: **not measured individually** (token pair is the same as body text on card surfaces used throughout the app).
- Tap target: X button is `size-11` = 44x44px — meets WCAG 2.1 AA 44px minimum.
- Focus ring: Button base class `focus-visible:ring-3 focus-visible:ring-ring/30` is present on all Button instances — visible focus ring confirmed.
- Color is not the only signal for the close action — the X icon provides the shape signal.

---

## Dark mode notes

All classes are token-only. Token behavior in dark mode (via `.dark` class, automatically applied — no hand-written `dark:` overrides needed or permitted):

| token class | light | dark |
|---|---|---|
| `border-border/60` | `oklch(0.925 0.005 214.3 / 60%)` | `oklch(1 0 0 / 10% / 60%)` — slightly lighter rule |
| `text-foreground` | `oklch(0.148 0.004 228.8)` navy | `oklch(0.987 0.002 197.1)` near-white |
| `text-muted-foreground` | `oklch(0.56 0.021 213.5)` | `oklch(0.723 0.014 214.4)` lighter muted |
| `bg-card` | `oklch(1 0 0)` pure white | `oklch(0.218 0.008 223.9)` dark navy surface |
| `hover:bg-muted` | `oklch(0.963 0.002 197.1)` tinted light | `oklch(0.275 0.011 216.9)` tinted dark |

No hand-written `dark:` class is added anywhere in `modal-shell.tsx`. Dark mode is fully covered by the token system.

---

## i18n notes

No new i18n keys are needed. Confirmed keys already in `locales/translations.json`:

- `t.common.close` — EN: `"Close"` / TH: `"ปิด"` (lines 68 and 752)
- All modal titles are existing keys already used in the current modal implementations

The `closeLabel` prop on ModalHeader accepts the resolved string (not a key) — the caller resolves `t.common.close` and passes the string. This keeps ModalHeader free of a language context dependency.

---

## Reduced motion

No new animations are introduced by `modal-shell.tsx`. The Dialog open/close animation is owned by the base `DialogContent` (Radix + Tailwind animate utilities at `duration-100`). The X button press `motion-safe:active:scale-95` is inherited from Button base. Both respect `prefers-reduced-motion` via the `motion-safe:` Tailwind variant already in place.

---

## DESIGN.md rows relied upon

The following rows are the normative basis for every class decision above:

**§2 Radius table:** "card · modal/dialog · sheet → `rounded-3xl`" — establishes that every Dialog is `rounded-3xl`. AmenitiesModal and AddMemberDialog currently use `rounded-2xl`, which this story corrects.

**§2 Shadow tiers:** "`shadow-2xl` modal" — establishes that the canonical modal shadow is `shadow-2xl`, not `shadow-xl` (which is the base DialogContent default).

**§2 Size table:** "icon-button → `h-11 w-11`" — confirms the X button is `size-11` (44x44px) via `size="icon"`.

**§2 Spacing table:** "modal content → `p-6 md:p-8`" — body padding stays per-modal inside the content area below the header; the header band uses `py-4` for symmetry (a scale utility, not an inline value).

**§3 Overlay grammar:** "Dialog | focused-task modal, centered, `rounded-3xl`, close `h-11 w-11` top-right" — the full canonical specification: the close button is `h-11 w-11` top-right; title is centered.

**§3 Button grammar:** "icon-button = `h-11 w-11` + `aria-label`" and "every variant `rounded-full`" — confirms `rounded-full` on the X button and the `aria-label` requirement.

**§5 Named anti-patterns:** "One modal shell (`rounded-3xl`, close `h-11 w-11`) — align AmenitiesModal (`rounded-2xl`)" (§8 backlog item 4) — this is the exact gap this story closes.

**§6 Quality gate:** "Token-only · Scale matches role · All 8 states · a11y AA · i18n · Anti-slop" — all gate criteria apply to `modal-shell.tsx` and to every migrated modal.

---

## Design-gate checklist for this story

Frontend must pass all of these before requesting merge:

- [ ] Token-only: no free hex/px in `modal-shell.tsx` or any migrated modal header section. `npm run check:palette` green.
- [ ] Radius by role: every migrated modal uses `rounded-3xl` (via ModalContent). AmenitiesModal and AddMemberDialog corrected from `rounded-2xl`.
- [ ] X button: `size="icon"` (44x44), `rounded-full`, `ghost` variant, `hover:bg-muted` (from ghost), `absolute right-4 top-1/2 -translate-y-1/2`, `aria-label={closeLabel}`, `data-testid="btn--modal-close"`. Confirmed on all 6 modals.
- [ ] Centered title: rendered as `<DialogTitle className="text-lg font-bold text-foreground text-center">` in all 6 modals.
- [ ] Shadow: `shadow-2xl` on all 6 modal shells.
- [ ] No built-in X: `showCloseButton={false}` on all 6 ModalContent instances — no `bg-secondary` X visible.
- [ ] All 8 interaction states defined for the X button (see states table above).
- [ ] a11y: `DialogTitle` is the Radix primitive (accessible name), `DialogDescription` for description slot, focus ring on X, tab order correct, tap target 44px. Verified with axe before merge.
- [ ] No new i18n key needed. `t.common.close` used for `closeLabel` in all callers.
- [ ] No hardcoded string in `modal-shell.tsx` itself.
- [ ] Screenshot of all 6 modals on Staging URL: X button top/bottom gap is visually equal in each.
- [ ] AmenitiesModal wildcard import `import * as Icons from "lucide-react"` replaced with named imports (PERF-BUNDLE fix, triggered by touching this file — per `.claude/rules/performance.md` and the established pattern in FilterModal).
- [ ] `npm run lint` · `npm run typecheck` · `npm run build` green.

---

## Reference

The only canonical visual reference for the header band is the existing LoginModal header at `top-4` — before this story, it is the closest to the spec (centered title, ghost X, divider). After this story, all 6 modals must match it, but with `top-1/2 -translate-y-1/2` instead of `top-4`, which is the structural fix.

Anti-slop criteria: the header band must feel like a single clean horizontal strip — centered title, one X on the right, one thin divider below. No decorative background on the header band, no rounded corners on the header strip itself (the shell handles radius), no card-in-card nesting.

---

## Changelog

- v1 (2026-06-27) — created at G2 (Design)
