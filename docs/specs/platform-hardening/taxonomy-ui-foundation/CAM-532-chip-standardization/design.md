---
linear: CAM-532
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: CAMPER
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-26
---
# Design — Every selectable chip looks and behaves the same (CAM-532)

## User job

A camper filtering camps must be able to tell, in one glance, **which choices are switched on** —
and must not have to re-learn that signal when they move from the home filter to the search modal.
The owner's report is exactly this: `ขนาดชิป` and `Hover State` differ between two surfaces that do
the same job, so the two modals read as two products.

**Flow:** Home → tap search → the search modal opens → the experience row shows the same chips as
the filter modal → tap one → it fills → press `ค้นหา` → the results narrow.

No new screen, no new component, no new token, no copy change. This is a reuse repair plus one
guard so the repair cannot silently rot.

## Root cause (re-confirmed on current code, not taken on trust)

`components/ui/filter-chip.tsx` (`FilterChip`, variants `pill`/`card`/`icon-card`) is the canonical
primitive and is already used by `FilterModal`, `spot-management-section`, and `app/preview`.
`SearchModal.tsx:167-183` hand-rolled a second pill that drifted in six ways:

| # | hand-rolled SearchModal pill | `FilterChip variant="pill"` |
|---|---|---|
| 1 | `shadow-md shadow-primary/20` on selected | no shadow (border + fill carry the state) |
| 2 | `transition-all` | `transition-colors` |
| 3 | unselected fill `bg-background` | `bg-card` |
| 4 | unselected label `text-muted-foreground` | `text-foreground` |
| 5 | icon `w-3.5 h-3.5` | `size-4` |
| 6 | no `active:scale-95`, no `min-w-[44px]` | both present |

Why it shipped uncaught: `scripts/check-ds.mjs` R6 matches a raw **`<span>`** carrying
`rounded-full` + `text-xs` + `bg-`. A hand-rolled `<button>` pill matches no rule at all, so the
guard was structurally blind to the most likely drift shape. That blindness is the real defect —
fixing only `SearchModal` would leave the next copy just as invisible.

Two more faults ride the same block and are fixed with it:

- `EXPERIENCE_TYPES` was a verbatim copy of `CategoryBar`'s `CATEGORIES` (frozen at 7 entries, so it
  never picked up SEA/WATF/GLAMP) — CAM-529 exported `CATEGORIES` precisely so this copy could die.
- `handleSearch` called `params.delete("terrain")` unconditionally, so pressing `ค้นหา` after
  changing only the dates wiped a filter-written `terrain=SEA,WATF`.

## Decision 1 — the selected chip is `bg-primary text-primary-foreground` (this is the load-bearing call)

`DESIGN.md` said the selected chip is `bg-foreground text-background` (§3 decision matrix + §3.1
Component Index); the primitive implements `bg-primary text-primary-foreground`. Both could not be
true, and that unresolved gap is part of why a hand-rolled copy looked acceptable — there was no
single answer to copy. **The primitive wins; `DESIGN.md` is corrected.** Four reasons, in order of
weight:

1. **`DESIGN.md`'s own token table already says so.** §2 lists `primary` / `primary-foreground` with
   "✅ use for: primary buttons, actions, prominent links, **selected**". The §3/§3.1 chip rows
   contradicted the token table that governs them; the token table is the SoT.
2. **The repo's own guard forbids the alternative.** `check:ds` R5a flags `bg-foreground` /
   `text-background` in any consumer file as a CTA-color override, with only two designer-approved
   image-scrim exceptions. The old wording prescribed a style CI blocks.
3. **Zero code churn, zero regression.** The primitive and its three live consumers already ship
   `bg-primary`. Flipping the primitive instead would restyle FilterModal, spot-management, and
   preview in a story whose entire point is *stop changing how chips look per surface*.
4. **Brand.** Teal-on-white is the CampVibe POV (`DESIGN.md` §1); a near-black filled chip is the
   generic default this system deliberately avoids.

**Contrast — measured, not eyeballed** (OKLCH values read from `app/globals.css`, converted to sRGB,
WCAG 2.1 relative-luminance ratio; script kept in the session scratchpad, numbers reproducible):

| pair | light | dark | target | verdict |
|---|---|---|---|---|
| selected label on selected fill (`primary-foreground` on `primary`) | **5.17:1** | **7.23:1** | 4.5:1 (AA, 14px normal text) | ✅ pass both themes |
| unselected label on unselected fill (`foreground` on `card`) | **19.71:1** | **16.74:1** | 4.5:1 | ✅ pass both themes |
| rejected option: `background` on `foreground` | 19.71:1 | 19.00:1 | 4.5:1 | ✅ would also pass — rejected on the four reasons above, not on contrast |

**Honest finding (Important, not fixed here).** Selected fill vs the surrounding surface is
**5.39:1 light / 2.31:1 dark**; the dark figure is below the 3:1 WCAG 1.4.11 non-text target for
identifying a component state by fill alone. This is **pre-existing and system-wide**, not caused by
this story: every bordered control in the system shares it (`--border` on `--background` measures
**1.25:1** in light mode). Selection is additionally exposed to assistive tech via `aria-pressed`,
and the fix requires editing color tokens in `app/globals.css` — an owner-visible decision outside
this story's file surface. Logged to the `DESIGN.md` §8 backlog.

## Decision 2 — the search pill row reuses CategoryBar's list and URL rule, and preserves what it cannot represent

The pill row is a **single-value shortcut** over one category dimension — the exact contract CAM-529
wrote for the home tabs (BR-1 mutual-exclude, BR-2 replace-never-merge), executed by the same
exported pure `buildCategoryUrl`. Re-deriving that behavior in a second file is how the two
surfaces drifted apart in the first place.

The clobber fix is a **state-honesty** change, not a new merge rule: when the address carries
something no single pill can express — a multi-value CSV (`terrain=SEA,WATF`), an unknown code, or
`type` **and** `terrain` both set — the row renders with **no pill selected** (not a lying
`ทั้งหมด`), and pressing `ค้นหา` leaves `type`/`terrain` untouched. Only an explicit pill tap
rewrites the category dimension. This is why "no chip selected" is a legitimate, designed state of
this row and not a bug.

## Not-a-chip — deliberately out of the chip family (do not "fix" these later)

- **`ActiveFilters`** — its pills are *dismiss tokens*: they report a filter that is already on and
  remove it on tap. They are not selectable (there is no unselected state to render), so they
  correctly use `Badge` (`rounded-xl`, `DESIGN.md` §3 "status label"). Converting them to
  `FilterChip` would give them a meaningless selected/unselected duality.
- **`CategoryBar`** — an underline **nav tab** (`aria-current`, `border-b-2`, no fill, no border
  box). It switches the page's context rather than composing a multi-select filter, and
  `DESIGN.md` §3 assigns that job to the tab grammar, not the chip grammar.

Both are correct as they stand. R9 does not fire on either (neither carries `rounded-full` + border
+ a selected conditional), which is the guard behaving as designed, not a gap.

## States (8) — all owned by `FilterChip variant="pill"`, none by the consumer

| state | treatment | token source |
|---|---|---|
| default (unselected) | `h-11 min-w-[44px] px-5 rounded-full border-border bg-card text-foreground`, icon `size-4` | §2 radius (control = `rounded-full`), §2 size (`h-11`) |
| hover (unselected) | `hover:border-foreground` — the outline darkens; fill unchanged | `foreground` |
| hover (selected) | `hover:bg-primary/85` | `primary` |
| focus | `focus-visible:ring-2 ring-ring ring-offset-2`, always visible, never removed | `ring` |
| active (press) | `active:scale-95` (motion only, no color change) | §2 motion |
| selected | `border-primary bg-primary text-primary-foreground` (Decision 1) | `primary` |
| disabled | `opacity-50 pointer-events-none` | — |
| loading | N/A for this row — selection is local state with no async dependency. The one async control in this modal (the province select) already owns its loading/error/empty states from CAM-531 (`aria-busy`, `role="status"` `กำลังโหลด`, retry, empty note); this story does not touch them. |
| empty | N/A — the pill list is a static ten-entry taxonomy that cannot be empty. "No pill selected" is a *designed* state (Decision 2), not an empty state. |
| error | N/A — a pill tap is local state only; it issues no request that can fail. |

The three N/A rows are stated rather than omitted: per `DESIGN.md` §5 a missing state is a bug, so
each one carries its reason.

## Components & tokens

- Components: `components/ui/filter-chip.tsx` (`FilterChip variant="pill"`) — reused as-is, **no new
  prop, no new variant**. Icons come from `CATEGORIES` (lucide, per DS-5) and are passed through the
  primitive's `icon` prop; SearchModal drops the seven now-orphaned icon imports it no longer uses.
- Tokens: `primary`, `primary-foreground`, `card`, `foreground`, `border`, `ring` — all existing.
  **No token added, changed, or removed.** `app/globals.css` is untouched.
- `DESIGN.md` edits: §3 decision-matrix chip row + §3.1 Component Index chip row (selected =
  `bg-primary text-primary-foreground`), a new §3 note recording Decision 1 and the not-a-chip
  boundary, the §6 gate line for R9, and one §8 backlog line for the dark-mode 1.4.11 finding.

## Guard rollout (R9) — mode and measured backlog

`check:ds` R9 flags a `<button>` / `<div role="button">` whose **opening tag** carries `rounded-full`
+ a `border*` class + a selected-state signal (`aria-pressed`, or a `selected`/`active`/`checked`
conditional). It is a structural co-occurrence heuristic over the parsed opening tag (brace/quote
aware), not a flat line grep — the CAM-221 lesson that a string guard cannot see structure.

The primitive is exempted by **declaration**, not by path: a file that declares `FilterChip` is
skipped. Removing that exemption makes the rule fire on `filter-chip.tsx` (verified), which is what
proves the exemption is load-bearing rather than the rule being toothless.

Rollout per `.claude/rules/ops.md` ("report-mode → backlog 0 → blocking; never land a blocking guard
with a non-zero backlog"), executed inside this PR:

| step | measurement |
|---|---|
| report run on `dev` before the fix | **backlog = 1** — `components/SearchModal.tsx:167`, 0 false positives across 184 scanned files |
| after the SearchModal fix in this PR | **backlog = 0** |
| mode landed | **blocking** — the flip condition (backlog 0) is met and proven in the same PR by the test suite |

`R9_MODE` is a single named constant at the top of the rule: reverting to report-only is a one-word
edit if the owner prefers a cycle of observation first.

## a11y (WCAG 2.1 AA)

- Contrast: measured above — 5.17:1 light / 7.23:1 dark on the selected chip label, both ≥ AA. The
  sub-3:1 dark non-text state contrast is recorded as a pre-existing system finding, above.
- Accessible name + state: `aria-pressed` on every chip (from the primitive) — selection is never
  color-only. Labels come from `t.categories.<key>` (th + en already present, CAM-529); no string is
  hardcoded in the component.
- Focus: `focus-visible:ring-2 ring-ring ring-offset-2` from the primitive, never suppressed.
- Tap target: `h-11` (44px) + `min-w-[44px]` — meets the 44px minimum. The hand-rolled pill had the
  height but **not** `min-w-[44px]`, so a short label could fall under 44px wide; adopting the
  primitive fixes that.
- Reduced motion: the only motion is `active:scale-95` on press (no looping animation).

## Anti-slop criteria that must pass

- Every value from a token; no floating hex/px in the diff (`check:palette` green).
- No shadow on a chip — the drifted `shadow-md shadow-primary/20` is deleted, not ported. Border +
  spacing carry hierarchy (`DESIGN.md` §5: "content leads, light chrome").
- One radius per role: chips stay `rounded-full`; nothing gains a second radius.
- No new component invented; no card nested in a card; no gradient.

## Reference

`app/preview` renders `FilterChip variant="pill"` in all states — the reference surface to compare
the search modal against at the design gate.
