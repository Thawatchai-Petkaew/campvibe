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
| `text-display` | 30 / 36 | 36 / 40 | ✅ |
| `text-heading-1` | 24 / 32 | 30 / 38 | ✅ |
| `text-heading-2` | 20 / 28 | 24 / 32 | ✅ |
| `text-heading-3` | 16 / 24 | 18 / 28 | ✅ |
| `text-body` | 16 / 24 | 16 / 24 | no — 16px is the iOS input-zoom threshold + the body-copy floor |
| `text-label` | 14 / 20 | 14 / 20 | no — control text; already minimal |
| `text-caption` | 12 / 16 | 12 / 16 | no — already minimal |

Declared once in `app/globals.css` as `--type-*` custom properties, redefined inside one `@media (min-width: 768px)` block, exposed as role utilities. Deliberately **not** `--text-*` in `@theme`: that namespace generates Tailwind's own `text-*` utilities and would collide.

## States (8)

Unchanged by this story — the scale changes size, never behaviour. Every migrated primitive keeps its existing default · hover · focus (`ring-ring`) · active (`active:scale-95`) · loading · error · empty · disabled. The one state-adjacent change: skeleton blocks that mirror a `lg` control were migrated with it (`h-11 md:h-12`) so the placeholder and the real control stay the same height at both steps and CLS stays 0.

## Validation UX

None — no field, no error copy, no new string. **No `locales/` change is needed and none was made**; the story adds no user-facing text.

## Components & tokens

Migrated (in this story's file surface):

| file | change |
|---|---|
| `components/ui/button.tsx` | `lg` → `h-11 px-4 md:h-12 md:px-5` |
| `components/ui/input.tsx` | `inputSize.lg` → `h-11 md:h-12` |
| `components/ui/input-field.tsx` | leading-icon inset → `pl-10 md:pl-12`; label → `text-caption`; helper → `text-label` |
| `components/ui/filter-chip.tsx` | pill `px-4 md:px-5` + `text-label`; card `h-28 p-4 md:h-32 md:p-5`; icon-card `h-20 p-2.5 md:h-24 md:p-3` + `text-caption` |
| `components/ui/card.tsx` | padding → `p-4 md:p-6` (matches the documented rule for the first time) |
| `components/ui/modal-shell.tsx` | header padding + title → role token |
| `components/ui/loading-skeleton.tsx`, `components/ui/profile-form-skeleton.tsx` | control-mirroring blocks → `h-11 md:h-12` (CLS) |
| `components/FilterModal.tsx` | content `p-4 md:p-8`, `space-y-4 md:space-y-6`, grids `gap-3 md:gap-4`, footer `p-3 md:p-4`, section titles → `text-heading-3` |
| `components/SearchModal.tsx` | same rhythm; **date buttons `size="lg"` → default** (BR-5, absorbs CAM-542); titles → `text-heading-3`; field labels → `text-caption` |
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

## The guard (`scripts/check-scale.mjs`, folded into `npm run check:ds`)

Three rules. Structural co-occurrence, not bare string matching (the CAM-221 lesson):

| rule | catches | mode | backlog |
|---|---|---|---|
| **M1** control height | `h-12` that is a **control** height (co-occurs with `rounded-full`, or is a cva `lg` size value) with no `md:` twin. Squares (`w-12`/`size-12`) are skipped — an avatar/spinner block is not a control. | **blocking** in `components/ui/**` + this story's surfaces · **report** elsewhere | blocking 0 · report 3 (named) |
| **M2** display type | raw `text-2xl`..`text-6xl` with no responsive twin in the same className → use a `text-heading-*` role | **blocking** in `components/ui/**` + surfaces + `app/preview/**` · **report** elsewhere | blocking 0 · report 32 (named) |
| **M3** floor breach | a mobile step that lands **under** 44px (`h-9 md:h-12`, `h-10 md:h-11`, `size-10 md:size-11`, …) | **blocking repo-wide** | 0 by construction |

M3 is blocking everywhere from day one because its backlog is empty by construction: nobody could have written a mobile step before this story defined mobile steps. It is the rule that stops this scale from being used to defeat the floor it was built to respect.

Proven in both directions (`__tests__/cam-552-mobile-scale.test.ts`): each rule fires on a synthetic violation, and each is silent on the fixed tree.

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
