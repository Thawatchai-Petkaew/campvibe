---
linear: CAM-552
feature: Platform hardening
epic: Taxonomy UI foundation
persona: CAMPER
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-26
---
# Design — A real mobile compact scale, including typography (CAM-552)

## Flow

No new screen. This is a system rule applied to existing flows:

`Home` (navbar → CategoryBar → filter row) → `Filter modal` → `Search modal` — the three surfaces the owner named — plus `/preview`, which gains a **Mobile scale** section so the next person *sees* the rule instead of reading it.

## The finding (verified, not assumed)

The rule never existed. Verified against `DESIGN.md` before designing:

| claim | evidence |
|---|---|
| responsive pairs exist for a FEW properties only | card `p-4 md:p-6` (:104), modal `p-6 md:p-8` (:105), gutter `gap-4`/`gap-6` (:107) — ad hoc, per component |
| "compact" was never scoped to mobile | density line (:53) reads "comfortable (public) · compact (dashboard table)" — dashboard TABLES only |
| the height scale has no breakpoint variant at all | (:119) `sm h-9 · md h-11 · lg h-12` — a control is the same height on a phone as on a desktop |
| no typography token changes by breakpoint | none exists anywhere in `app/globals.css` |
| `/preview` never covered mobile | (:459) lists "mobile view" as an open backlog item |

## The load-bearing design decision

**Control height cannot be the compaction lever, because the touch floor already sits on it.**

44px is the WCAG 2.1 AA tap-target figure this codebase already uses (`min-w-[44px]` in `filter-chip.tsx`). `h-11` **is** 44px. So the `md` control height has zero room to step down — shrinking it would trade an accessibility floor for a few pixels.

That leaves a real, measurable compaction budget everywhere else:

1. `lg` 48px → 44px on mobile — the ONE height that steps, and it lands exactly on the floor.
2. Horizontal padding — chip 20px → 16px, leading-icon inset 48px → 40px.
3. Non-control block heights — the card/icon-card chips are far above the floor and can shrink freely.
4. Vertical rhythm — modal padding, section stacks, grid gaps.
5. Type — headings, which is where the vertical space actually goes.

This is why the DESIGN.md table has a "steps?" column with explicit **no** rows: the rows that do not step are the accessible ones, and an implementer needs to know that is deliberate rather than an omission.

## Non-goals

- Not shrinking any tap target. Compact stops at 44px.
- Not introducing a second breakpoint. One breakpoint (`md` = 768px), mobile-first, no `sm:`/`lg:`/`xl:` for sizing.
- Not stepping body/label/caption type down. 16px body is the iOS input-zoom threshold and the body-copy floor.

## Alternatives considered

- **Fluid type (`clamp()`) instead of a breakpoint step.** Rejected: `clamp()` produces a different size at every viewport width, which is unguardable and untestable — you cannot assert "the mobile value" of a continuously varying number, and the ticket explicitly asks for "a token that switches by breakpoint". A two-step token is measurable at 390px and at 1280px.
- **Shrinking `md` to `h-10` (40px) on mobile for a denser filter row.** Rejected: it breaks the 44px floor, which is a hard constraint, not a preference.
- **A new `scripts/check-scale.mjs` with its own npm script.** Rejected: `package.json` is outside this story's file surface, so a new `npm run` entry could not ship. The guard lives in `scripts/check-scale.mjs` and is folded into `check-ds.mjs`, which is already in the quality gate and in CI.

## The scale (authored into `DESIGN.md` §2 "Responsive scale")

**Breakpoint: `md` = 768px.** Mobile-first — bare utility = mobile, `md:` = desktop.
**Touch floor: 44×44px at every viewport, binding over compaction.**

### Control height

| role | mobile (<768px) | desktop (≥768px) | steps? |
|---|---|---|---|
| `sm` | `h-9` (36px) | `h-9` | no — under the floor, non-tappable / inside a ≥44px hit area only |
| `md` (default) | `h-11` (44px) | `h-11` | **no — at the floor** |
| `lg` | `h-11` (44px) | `md:h-12` (48px) | ✅ the one height that steps |
| icon button | `size-11` (44px) | `size-11` | no — at the floor |

### Padding · block height · rhythm

| property | mobile | desktop |
|---|---|---|
| chip / pill padding-x | `px-4` | `md:px-5` |
| button `lg` padding-x | `px-4` | `md:px-5` |
| input leading-icon inset | `pl-10` | `md:pl-12` |
| chip `card` block | `h-28 p-4` | `md:h-32 md:p-5` |
| chip `icon-card` block | `h-20 p-2.5` | `md:h-24 md:p-3` |
| card padding | `p-4` | `md:p-6` |
| modal content padding | `p-4` | `md:p-8` |
| modal footer padding | `p-3` | `md:p-4` |
| page / bar gutter | `px-4` | `md:px-6` |
| control-group gap | `gap-2` | `md:gap-3` |
| grid gutter | `gap-3` | `md:gap-4` |
| section stack | `space-y-4` | `md:space-y-6` |

### Typography roles

Seven roles. A component picks a **role**, never a raw `text-*` per screen size.

| role | mobile | desktop | steps? |
|---|---|---|---|
| `type-display` | 30 / 36 | 36 / 40 | ✅ |
| `type-heading-1` | 24 / 32 | 30 / 38 | ✅ |
| `type-heading-2` | 20 / 28 | 24 / 32 | ✅ |
| `type-heading-3` | 16 / 24 | 18 / 28 | ✅ |
| `type-body` | 16 / 24 | 16 / 24 | no — 16px is the iOS input-zoom threshold + the body-copy floor |
| `type-label` | 14 / 20 | 14 / 20 | no — control text; already minimal |
| `type-caption` | 12 / 16 | 12 / 16 | no — already minimal |

Declared once in `app/globals.css` as `--type-*` custom properties, redefined inside one `@media (min-width: 768px)` block, exposed as `@utility` classes.

**Why `type-*` and not `text-*` — a bug the measurement caught.** The roles were originally built as `text-body` / `text-heading-2`, exactly as the ticket illustrated. Rendered at 390px, the FilterChip pill measured **16px** while its source clearly read `text-label`. Cause: `cn()` is clsx + **tailwind-merge**, and tailwind-merge classifies an unrecognised `text-<x>` as a **text colour** — so `cn("text-label", "text-foreground")` silently drops `text-label` and the role never reaches the DOM:

```
twMerge("text-label transition-colors", "text-foreground")
  → "transition-colors text-foreground"      // text-label GONE
twMerge("type-label transition-colors", "text-foreground")
  → "type-label transition-colors text-foreground"   // survives
```

It would have shipped invisibly at roughly half the call sites, and **no amount of className review would have revealed it** — only the rendered box did. Teaching tailwind-merge the names would mean editing `lib/utils.ts`, outside this story's file surface, so the roles are namespaced `type-*` instead. Both directions are pinned by the "BUG GUARD" tests, so a future tidy-up back to `text-*` goes red first.

Also deliberately **not** `--text-*` in `@theme`: that namespace generates Tailwind's own `text-*` utilities and would collide.

## States (8)

Unchanged by this story — the scale changes size, never behaviour. Every migrated primitive keeps its existing default · hover · focus (`ring-ring`) · active (`active:scale-95`) · loading · error · empty · disabled.

**Loading state, deliberately NOT touched.** The plan was to step the `h-12` skeleton bars in `loading-skeleton.tsx` / `profile-form-skeleton.tsx` alongside the controls. That would have been wrong: those bars mirror the inline `h-12` inputs in `app/profile/page.tsx`, which is **outside this story's file surface**. Stepping the placeholder while the real control stayed at 48px would have *created* layout shift on mobile rather than preventing it. A skeleton tracks whatever control it stands in for, so it moves when that control moves — which is why the guard also skips `<Skeleton>` by design, with the reason recorded in `check-scale.mjs`. The profile inputs are in the M1 report backlog; the skeleton follows them in the same follow-up.

## Validation UX

None — no field, no error copy, no new string. **No `locales/` change is needed and none was made**; the story adds no user-facing text.

## Components & tokens

Migrated (in this story's file surface):

| file | change |
|---|---|
| `components/ui/button.tsx` | `lg` → `h-11 px-4 md:h-12 md:px-5` |
| `components/ui/input.tsx` | `inputSize.lg` → `h-11 md:h-12` |
| `components/ui/input-field.tsx` | leading-icon inset → `pl-10 md:pl-12`; label → `type-caption`; helper → `type-label` |
| `components/ui/filter-chip.tsx` | pill `px-4 md:px-5` + `type-label`; card `h-28 p-4 md:h-32 md:p-5`; icon-card `h-20 p-2.5 md:h-24 md:p-3` + `type-caption` |
| `components/ui/card.tsx` | padding → `p-4 md:p-6` (matches the documented rule for the first time) |
| `components/ui/modal-shell.tsx` | header padding + title → role token |
| `components/FilterModal.tsx` | content `p-4 md:p-8`, `space-y-4 md:space-y-6`, grids `gap-3 md:gap-4`, footer `p-3 md:p-4`, section titles → `type-heading-3` |
| `components/SearchModal.tsx` | same rhythm; **date buttons `size="lg"` → default** (BR-5, absorbs CAM-542); titles → `type-heading-3`; field labels → `type-caption` |
| `components/CategoryBar.tsx` | `gap-6 px-4 md:gap-8 md:px-6`, `pb-2 md:pb-3`, tab min-width steps |
| `app/preview/PreviewClient.tsx` | headings → role tokens + a new **Mobile scale** section (closes `DESIGN.md` §8's "mobile view" backlog item) |

Deliberately **not** migrated, with the reason:

| file | why left |
|---|---|
| `components/ui/option-group-section.tsx` | its heading className is pinned char-for-char by `__tests__/cam-528-detail-taxonomy.test.ts:140`; that test is outside this story's file surface (STOP RULE 3) → report backlog |
| `components/CampgroundCard.tsx`, `components/CampgroundForm.tsx`, `components/ai-chat/**` | owned by CAM-541/547/550 → out of bounds |
| `components/Navbar.tsx` | out of bounds; carries two measured touch-floor violations (below) → follow-up |
| `app/**` page headings (`text-2xl`/`text-3xl`, ~30 sites) | out of bounds → report backlog, follow-up |
| `components/ui/loading-spinner.tsx` `lg` (`w-12 h-12`) | decorative square, not a control → correctly outside the rule |
| `components/ui/loading-skeleton.tsx`, `components/ui/profile-form-skeleton.tsx` | their `h-12` bars mirror the inline `h-12` inputs in `app/profile/page.tsx`, which is out of bounds — stepping the placeholder alone would CREATE layout shift (see States above) |

## The guard (`scripts/check-scale.mjs`, folded into `npm run check:ds`)

Three rules. Structural co-occurrence, not bare string matching (the CAM-221 lesson):

| rule | catches | mode | backlog |
|---|---|---|---|
| **M1** control height | `h-12` that is a **control** height (co-occurs with `rounded-full`, or is a cva `lg` size value) with no `md:` twin. Squares (`w-12`/`size-12`) are skipped — an avatar/spinner block is not a control. | **blocking** in `components/ui/**` + this story's surfaces · **report** elsewhere | blocking 0 · report 3 (named) |
| **M2** display type | raw `text-2xl`..`text-6xl` with no responsive twin in the same className → use a `text-heading-*` role | **blocking** in `components/ui/**` + surfaces + `app/preview/**` · **report** elsewhere | blocking 0 · report 32 (named) |
| **M3** floor breach | a mobile step that lands **under** 44px (`h-9 md:h-12`, `h-10 md:h-11`, `size-10 md:size-11`, …) | **blocking repo-wide** | 0 by construction |

M3 is blocking everywhere from day one because its backlog is empty by construction: nobody could have written a mobile step before this story defined mobile steps. It is the rule that stops this scale from being used to defeat the floor it was built to respect.

Proven in both directions (`__tests__/cam-552-mobile-scale.test.ts`): each rule fires on a synthetic violation, and each is silent on the fixed tree.

## Measured, in a real browser (Playwright, 390 × 844 and 1280 × 900)

Not read off classNames. Every number below is `getBoundingClientRect()` / `getComputedStyle()` on the rendered element.

**The finding that justifies the whole story** — BEFORE, the mobile column and the desktop column were *identical on every single row*:

| specimen | BEFORE mobile | BEFORE desktop | AFTER mobile | AFTER desktop |
|---|---|---|---|---|
| chip pill | h44 · padX 20/20 | h44 · padX 20/20 | h44 · **padX 16/16** | h44 · padX 20/20 |
| chip card block | **h128** · pad 20 | h128 · pad 20 | **h112** · **pad 16** | h128 · pad 20 |
| chip icon-card block | **h96** · pad 12 | h96 · pad 12 | **h80** · **pad 10** | h96 · pad 12 |
| button `md` | h44 | h44 | h44 (floor) | h44 |
| button `lg` | **h48** · padX 20/20 | h48 · padX 20/20 | **h44** · **padX 16/16** | h48 · padX 20/20 |
| button icon | h44 | h44 | h44 (floor) | h44 |
| page `h1` | **36px** | 36px | **30px** | 36px |
| section `h2` | 20px | 20px | 20px | **24px** |

Filter modal (measured with the modal open at 390px):

| specimen | before | after |
|---|---|---|
| price input (`inputSize="lg"`) | h **48** · padX 48/12 | h **44** · padX **40**/12 |
| footer primary CTA (`size="lg"`) | h **48** · padX **32/32** · w 235 | h **44** · padX **16/16** · w 197 |
| section heading | 18px / 28px line | **16px / 24px** |
| usable content width inside the dialog | 310px | **326px** (+16px, `p-6` → `p-4`) |

**Touch floor confirmation.** Full sweep of every `button` / `a[href]` / `input` / `[role=button]` at 390px:

- Nothing this story changed is under 44px. Chip pill, chip blocks, `md`/`lg`/icon buttons and the filter trigger all measure ≥ 44px at both steps.
- The only controls under 44px are `size="sm"` (36px) — unchanged by this story and by design a dense/inline size, flagged in `DESIGN.md` §2.0 as non-tappable-only.
- **Pre-existing violations found by the sweep, in files this story may not edit** (reported, not fixed): `CampgroundCard` carousel arrows **28 × 28px** (48 instances on a populated Home), `Navbar` language switcher **36px**, `Navbar` profile menu **42px**, `Navbar` logo link **32px**.

## a11y

- **Touch floor 44×44px held.** Measured after migration across every interactive element at 390×844: nothing this story touched is under the floor.
- **Pre-existing violations found by the same sweep, in files out of bounds** (reported, not fixed): `CampgroundCard` carousel arrows **28×28px** (48 instances), `Navbar` language switcher **36px**, `Navbar` profile menu **42px**.
- Type: no role drops below 12px; body stays 16px so a focused input never triggers iOS Safari auto-zoom.
- Contrast: **unchanged** — this story alters no colour token. `check:contrast` stays green on its 38 pinned pairs.
- Focus ring, `aria-*`, keyboard order: untouched by a size-only change.

## Links
`../../feature.md` · `DESIGN.md` §2 "Responsive scale" · `story.md` (BR-1..BR-6) · `.claude/rules/ops.md` (guard rollout)

## Changelog
- v1 (2026-07-26) — created
