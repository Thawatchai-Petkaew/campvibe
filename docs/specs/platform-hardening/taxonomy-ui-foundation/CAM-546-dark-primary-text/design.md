---
linear: CAM-546
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: CAMPER
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-26
---
# Design — Primary-coloured text is readable on the dark background (CAM-546)

## Flow

No screen changes. The surfaces a camper meets, in order:

`/preview` (the living reference) → the **link-variant button** renders teal words directly on
`--background`. That is the element axe flagged. The same token paints every teal *word* in the app:
booking prices, sign-in / register links, the active dashboard menu item, a guest's initial in an
avatar, today's date in the availability calendar, the selected icon-chip label, and the AI card's
"view detail" line. All of them move together to one new token.

## How every number below was produced

`scripts/check-contrast.mjs` (CAM-537's engine, reused unchanged for the maths) parses the real
`app/globals.css`, converts each OKLCH declaration to linear sRGB (Björn Ottosson's matrices),
gamut-clamps in encoded space as a display would, composites alpha over the actual backdrop in
gamma-encoded sRGB, then takes the WCAG 2.1 relative-luminance ratio. Nothing here is eyeballed.

**Confidence check.** Re-derived independently before trusting CAM-537: the engine reproduces its
figures (fill 3.28 / 3.73, label 5.08) and — the decisive one — the dark `--primary` value at `L 0.520`
encodes to **`#257771`**, which is **character-for-character the foreground hex axe reported**. axe read
3.71:1 against the page; the engine reads 3.73:1. The 0.02 gap is axe rounding to 8-bit channels. Same
colour, same pair, same verdict: the token is the defect.

## The one-token impossibility, re-derived (not taken on trust)

Scanned `L` at 0.001 resolution, chroma and hue fixed at `--primary`'s dark values:

| requirement | measured window |
|---|---|
| `--primary` as **text** on `--card` ≥ 4.5:1 | `L ≥ 0.596` |
| near-white `--primary-foreground` **on the fill** ≥ 4.5:1 | `L ≤ 0.548` |
| `--primary` as a **fill** vs `--card` ≥ 3:1 | `L ≥ 0.499` |

The first two windows are **disjoint**, so no single lightness satisfies both. CAM-537's conclusion
holds; its parked value `L 0.520` sits mid-window for the fill pair and is left exactly as it is.

## Which floor governs which row (WCAG 2.1)

| kind of thing | floor | why |
|---|---|---|
| body text | **4.5:1** | SC 1.4.3 |
| large text (≥18.66px **bold**, or ≥24px) | 3:1 | SC 1.4.3 exception |
| an icon that conveys meaning; a fill that identifies a state | **3:1** | SC 1.4.11 Non-text Contrast |

Two rows are easy to misjudge and are called out on purpose:

- **Teal icons are not text.** They are judged at 3:1, which `--primary` already clears (worst measured
  3.01:1, on a 10%-primary tint). Moving them would be churn with no a11y gain, and would visibly
  change the weight of every icon chip. They stay.
- **A price at `text-xl font-bold`** (20px/700) *does* qualify as WCAG large text, so its 3.28:1 already
  passes 3:1. It is migrated anyway — see "Judgement calls" below, with the measured reason.

## The token

```css
/* :root  */ --primary-ink: oklch(0.511 0.096 186.391);
/* .dark  */ --primary-ink: oklch(0.760 0.120 184);
```

- **Light = byte-identical to light `--primary`.** Light mode does not change at all; the light teal
  already measured ≥ 4.5:1 on every surface it is used on (worst 4.68:1).
- **Dark = byte-identical to dark `--ai-price`.** Deliberate: CAM-444 already introduced exactly one
  bright teal for dark-mode text, and the app should have **one**, not two nearly-identical ones.
  Inventing a fresh value 4 hue-degrees away would be the drift `DESIGN.md` exists to prevent.
- **Name.** `--primary-ink` — "primary, as ink (letters)". It cannot be confused with
  `--primary-foreground`, which is the colour that sits *on* a primary fill.

## Before / after — every measured pair

Floor is **4.5:1 text** on every row in this table. Light values are byte-identical before and after.

### The defect this PR closes — `--primary` → `--primary-ink` as TEXT

| surface it sits on | light before → after | dark before → after |
|---|---|---|
| `--background` (links, calendar day, `/preview` link button) | 5.39 ✅ → 5.39 ✅ | **3.73 ❌ → 9.68 ✅** |
| `--card` / `--popover` (cards, dialogs, dropdowns) | 5.39 ✅ → 5.39 ✅ | **3.28 ❌ → 8.52 ✅** |
| `--ai-surface` (AI chat card) | 5.14 ✅ → 5.14 ✅ | **3.28 ❌ → 8.53 ✅** |
| `bg-primary/10` over `--card` (active nav item, avatar initial) | 4.68 ✅ → 4.68 ✅ | **3.01 ❌ → 7.81 ✅** |
| `bg-primary/10` over `--background` | 4.68 ✅ → 4.68 ✅ | **3.48 ❌ → 9.03 ✅** |
| `bg-primary/5` over `--card` (selected icon-chip label) | 5.03 ✅ → 5.03 ✅ | **3.15 ❌ → 8.17 ✅** |
| `bg-primary/5` over `--background` | 5.03 ✅ → 5.03 ✅ | **3.61 ❌ → 9.38 ✅** |
| **`/80` alpha** on `--card` (permission tooltip) | **3.70 ❌ → 5.39 ✅** | **2.56 ❌ → 8.52 ✅** |

The `bg-primary/10` row is the binding surface: the tint *lightens* the backdrop, so it is the worst
case, not an equivalent of bare `--card`. The `/80` row failed in **both** themes — a token swap alone
would not have fixed it, so the alpha modifier is dropped rather than re-tinted (BR-5).

### `--primary` — proven UNCHANGED (CAM-537's work must not be undone)

| pair | floor | light | dark |
|---|---|---|---|
| `--primary` fill vs `--card` | 3:1 non-text | 5.39 ✅ | 3.28 ✅ |
| `--primary` fill vs `--background` | 3:1 non-text | 5.39 ✅ | 3.73 ✅ |
| `--accent` fill vs `--card` | 3:1 non-text | 5.39 ✅ | 3.28 ✅ |
| `--primary-foreground` on the fill | 4.5:1 text | 5.17 ✅ | 5.08 ✅ |
| `--primary` as an **icon** on `bg-primary/10` over `--card` (worst icon surface) | 3:1 non-text | 4.68 ✅ | 3.01 ✅ |

Every number in this second table is identical to CAM-537's, and the test suite asserts that by
recomputing them from the real stylesheet rather than by comparing to a copied constant.

## Judgement calls — what moved, what stayed, and why

**Rule applied (BR-2): if the thing is made of letters it takes `--primary-ink`; if it is an icon, a
fill, a border, or a ring it keeps `--primary`.** One question a reviewer can answer without measuring.

### Migrated (25 call sites) — all are words

| file:line | what it is | why it moved |
|---|---|---|
| `components/ui/button.tsx:26` | `link` variant | **the axe hit.** 3.73 → 9.68 on `--background` |
| `components/ui/badge.tsx:46` | `link` variant | same pattern, same failure |
| `app/login/page.tsx:194` · `components/LoginModal.tsx:195` · `components/RegisterModal.tsx:104,281` | sign-in / register links | 3.28 → 8.52 on `--card` |
| `app/login/page.tsx:203` · `components/ActiveFilters.tsx:177` | `hover:text-primary` on 12–14px text | a hover state is still text a camper reads (EC-5) |
| `app/bookings/page.tsx:184` · `app/bookings/[id]/BookingDetailClient.tsx:156` | price, 20px/700 | qualifies as large text and passes 3:1 at 3.28 — but with only 0.28 headroom, and one `text-lg` edit away from silently failing. It is text; it takes the text token |
| `app/bookings/[id]/confirmation/BookingConfirmationClient.tsx:135` | price, 24px/700 | same reasoning |
| `app/bookings/page.tsx:263` · `app/dashboard/page.tsx:244` | ghost-primary link-action labels | 3.28 → 8.52. The `hover:bg-primary/5` that `check:ds` R5b keys on is untouched |
| `app/dashboard/layout-client.tsx:83` | active menu **label** on a 10% tint | 3.01 → 7.81, the worst surface measured |
| `app/dashboard/layout-client.tsx:88` | active menu **icon** | an icon at 3:1 would have passed, but it sits inside the same control as the label above; one control must not render two different teals (EC-4) |
| `app/dashboard/page.tsx:281` · `app/dashboard/bookings/page.tsx:380` · `components/settings/TeamManagement.tsx:271` | a guest's initial in an avatar | a letter, not an icon. 3.01 → 7.81 |
| `app/dashboard/settings/page.tsx:114` | active tab label | 3.73 → 9.68. Its `border-primary` sibling class stays (a border is not text) |
| `app/dashboard/campsites/page.tsx:201` | inline link | 3.28 → 8.52 |
| `components/CampgroundForm.tsx:489` | selected option label, 14px | 3.28 → 8.52 |
| `components/availability-calendar.tsx:259` | today's date number | 3.73 → 9.68. `DESIGN.md` §3 already warns never to mark today with `--primary`; this closes the text half of that note |
| `components/ui/filter-chip.tsx:101` | selected icon-card: label + the icon that inherits from it | 3.15 → 8.17. The icon has no colour class of its own, so it moves with the label automatically (EC-4) |
| `components/ai-chat/AiChatCampCard.tsx:117` | "view detail" line + its inherited chevron | 3.28 → 8.53 on `--ai-surface`. Scoped to this `<p>`; the price hero's `text-ai-price` is untouched |
| `components/ui/permission-tooltip.tsx:48` | suggestion text | the `/80` alpha failed **both** themes (3.70 light / 2.56 dark). Alpha dropped → 5.39 / 8.52 |

### Left on `--primary` (22 call sites) — none is text

| file:line | what it is | measured |
|---|---|---|
| `app/host/page.tsx:40,49,58` · `components/NotificationCenter.tsx:333` | icon-only chip on a 10% tint | 3.01:1 vs a 3:1 floor ✅ |
| `app/dashboard/campsites/page.tsx:252,274` | `hover:text-primary` on **icon** buttons | 3.73:1 vs 3:1 ✅ |
| `app/dashboard/page.tsx:207` · `components/LocationPicker.tsx:155,180` · `components/DashboardHeader.tsx:56` · `components/CampgroundForm.tsx:907,981,1079,1142,1205` | section / status icons | 3.28:1 vs 3:1 ✅ |
| `components/LogoUpload.tsx:98` · `components/ImageUpload.tsx:137` · `components/CampgroundForm.tsx:824` | loading spinners | 3.28:1 vs 3:1 ✅ |
| `components/ListingCompletenessCard.tsx:233` | `Check`, `aria-hidden` | decorative; 3.28:1 ✅ |
| `components/CampgroundCard.tsx:294` · `components/CampgroundDetailClient.tsx:575` | saved-state `Heart` | 3.28:1 vs 3:1 ✅ (state is also exposed via `aria-pressed`, so colour is not the only signal) |
| `components/ui/filter-chip.tsx:77` | image-card icon | 3.15:1 vs 3:1 ✅. Its label is `text-foreground`, so no two-teal problem arises |

## Alternatives considered

- **Raise `--primary` again.** Rejected — provably impossible (the disjoint windows above) and it would
  undo CAM-537 by pushing the near-white label on the fill below 4.5:1.
- **Rename/alias `--ai-price` into the new token instead of adding one.** Genuinely attractive (it would
  leave exactly one bright teal). Rejected here only because `__tests__/cam-444-dark-price-contrast.test.ts`
  pins `--ai-price:\s*oklch\(` as a literal in both blocks, and that file is outside this story's surface.
  Recorded as a follow-up in `story.md` §Out of scope; the values are already identical, so the eventual
  consolidation is a rename with no visual change.
- **Give the new token a fresh hue anchored to `--primary` (188.216).** Rejected: measured ratios are
  within 0.02 of `--ai-price`'s hue 184, so it would buy nothing and would put two barely-different
  teals side by side inside the AI card.
- **Migrate the icons too, for uniformity.** Rejected: icons are judged at 3:1 and already pass, and
  brightening every icon chip is a visible restyle nobody asked for.

## States (8)

This story changes **no state's treatment** — only the colour a state paints its letters with. The
element axe flagged is the `link` button variant; its states are owned by `components/ui/button.tsx`:

| state | treatment (unchanged) | what this story changes |
|---|---|---|
| default | `text-primary underline-offset-4` | → `text-primary-ink`; dark 3.73 → **9.68:1** |
| hover | `hover:underline` | nothing (underline, not colour) |
| focus | `focus-visible:ring-ring` ring, never suppressed | nothing |
| active | shared button `active:` treatment | nothing |
| disabled | `disabled:opacity-50 disabled:pointer-events-none` | nothing — opacity applies over the new colour identically |
| loading | N/A for the link variant — it navigates, it does not submit; async controls use the `default` variant with `LoadingSpinner` (`.claude/rules/loading.md`) | nothing |
| empty | N/A — a link renders only when there is a destination | nothing |
| error | N/A — a link has no validation surface; the error path belongs to the destination screen | nothing |

The other migrated controls (nav item, filter chip, tab) keep every state from CAM-532/CAM-533; only
the selected/active branch repaints its letters.

## Validation UX

No `BR-n` produces a user-facing error: this story writes no data and submits no form. The only failure
path is a build-time one — a token below its floor — surfaced to a developer through `check:contrast`,
never to a camper. No inline error and no `ErrorBanner` surface is involved.

## Components & tokens

- **New token:** `--primary-ink` in `:root` + `.dark`, plus `--color-primary-ink: var(--primary-ink)` in
  `@theme inline`. Without that `@theme` entry the utility `text-primary-ink` emits nothing at all and
  the text would silently fall back to inherited colour — this is the one wiring step that cannot be
  skipped.
- **Tokens deliberately untouched:** `--primary`, `--accent`, `--primary-foreground` (CAM-537's window),
  `--ai-price` (CAM-444's name, same value), and the `--ai-glow` / `--ai-gradient` stops.
- **Components:** no new component, no new variant. 25 class-name edits across 20 files; every one swaps
  `text-primary` → `text-primary-ink` on a text node (one additionally drops an `/80` alpha).
- **Copy:** no string added or changed, so `locales/` is untouched.

## a11y

- **Contrast:** every ratio in this file is measured by `scripts/check-contrast.mjs` against the real
  `app/globals.css`, both themes, each row judged against the floor named above. Worst migrated result:
  **4.68:1** (light, 10% tint) and **7.81:1** (dark, same) — both over the 4.5:1 body floor.
- **The reported violation:** axe `color-contrast`, serious, `#257771` on `#090b0c`, 3.71:1 → the pair
  now measures **9.68:1**.
- **Colour is not the only signal:** unchanged and still true — the active nav item is a `<Link>` with
  `aria-label`, chips carry `aria-pressed`, saved hearts carry `aria-pressed`. Nothing here made colour
  load-bearing.
- **Focus ring:** unchanged (`ring-ring`, never suppressed). Its light-mode gap stays deferred from
  CAM-537 with its recorded reason.
- **Tap target:** unchanged — no size, padding, or layout property is touched by this story.
- **Not measured:** no browser screenshot was taken. The property this story changes is verified
  numerically over the real stylesheet, and the axe rule is re-checked by the e2e a11y spec in CI —
  see the note in the PR body about which of those ran locally.

## Guard — mode and measured backlog

`scripts/check-contrast.mjs` gains the new pairs. Rollout follows `.claude/rules/ops.md`
(report-mode → backlog 0 → blocking):

| set | size | measured backlog | mode |
|---|---|---|---|
| ENFORCED | 38 → **54** pairs (27 contexts × 2 themes) | **0** — the 8 new contexts are added and measured green in the same PR | **blocking** (exit 1) |
| DEFERRED | 12 → **10** pairs | **10 → 9** known failures | **report only** (exit 0, printed loudly with its reason) |

Two DEFERRED rows are **retired**, not re-parked: `--primary` as text on `--card` (CAM-537's
placeholder for this exact defect) is replaced by an ENFORCED `--primary-ink` row on the same surface.
That context contributed one failure (dark) and one pass (light), so the known-failure count drops by
one, not two.

The registry gains **one** capability it did not have: an **overlay** backdrop
(`overlay: { token: "--primary", alpha: 0.10 }`), because `bg-primary/10` is a Tailwind opacity fill
rather than a token and so could not be named as a surface at all. Without it the worst surface in the
app would have gone unmeasured. A matching `fgAlpha` was considered and **not** built — after BR-5 no
call site puts an opacity modifier on this token, so the feature would have had no caller. The `/80`
numbers in the table above are computed directly in `__tests__/cam-546-*` from the same exported
helpers, which keeps the claim verifiable without adding speculative code to the guard.

Both directions are proven in `__tests__/cam-546-dark-primary-text.test.ts`: the guard **fires**
(exit 1, naming the pair) on a deliberately-bad `--primary-ink`, and is **quiet** (exit 0) on the real
tree. A guard proven in only one direction can be silently toothless — the CAM-532 R9 / CAM-537 lesson.

## Anti-slop criteria that must pass

- No hardcoded hex or `dark:` override anywhere — one token, declared in both themes, read through a
  Tailwind utility.
- The dark value reuses the bright teal the app already ships rather than inventing a second one.
- Light mode is byte-identical — a contrast fix must not become a redesign.
- Icons, fills, and borders are left alone, so nothing changes weight that did not have to.
- Every ratio in this document came out of a program that was run.

## Links

`../../feature.md` · `DESIGN.md` (§2 token table, §8 item 11) · `story.md` (BR-1..BR-7) ·
`../CAM-537-contrast-floor/design.md` (the deferral this closes) · CAM-444 (`--ai-price` precedent) ·
unblocks **CAM-544** (dark as the default theme, PR #628)

## Changelog
- v1 (2026-07-26) — created
