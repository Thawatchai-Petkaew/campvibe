## Story
As a **Camper**, I want every selectable chip in the app to be the same size and to react the same way when I hover, focus, or select it, so that the search modal and the filter modal read as one product instead of two.
Why: the owner, reviewing the live SearchModal on 2026-07-26, reported `ตอนนี้ UI ใน Modal นี้ไม่มีความ Consistency เรื่องของขนาดชิป เรื่องของ Hover State ตอนนี้ไม่เหมือนกันเลย. รวมถึงทั้งระบบ เราควรจะทำแบบนี้` — the canonical `FilterChip` primitive already existed, but `SearchModal` hand-rolled a near-identical pill that drifted in six ways, and the `check:ds` guard could not see it (R6 only matches a raw `<span>`).
Scope: `components/SearchModal.tsx` adopts `FilterChip` and imports `CategoryBar`'s exported `CATEGORIES`/`buildCategoryUrl` instead of keeping its own copy; `DESIGN.md` resolves the selected-chip contradiction; `scripts/check-ds.mjs` gains one new rule (R9) so the next hand-rolled pill cannot ship uncaught. No new component, no new token, no copy change, no schema.
Depends on: CAM-529 (exported `CATEGORIES` + `buildCategoryUrl`) · `.claude/plans/research-user-jolly-mochi.md` §"S5 · Chip standardization" (approved plan)

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper is on Home | Camper opens the search modal and looks at the experience row | Every pill (`ทั้งหมด` `ลานกางเต็นท์` `แคมป์ด้วยรถ` `แกลมปิ้ง` `ชายหาด` `ทะเล` `ป่า` `ภูเขา` `ริมน้ำ` `น้ำตก`) has the same height, the same rounded shape, and the same icon size as the chips in the filter modal | SearchModal renders `FilterChip variant="pill"`; no hand-rolled pill markup remains in the file | AC-2 |
| AC-2 | Camper is looking at the experience row | Camper hovers an unselected pill, then moves the keyboard focus to it | The unselected pill's outline darkens on hover and shows a visible focus ring on keyboard focus, exactly as the filter modal chips do; the selected pill stays filled and does not change shape | Hover/focus/active/disabled are owned by the one primitive; SearchModal carries no chip styling of its own | EC-4 |
| AC-3 | Camper already picked `ทะเล` and `น้ำตก` in the filter (the address carries `terrain=SEA,WATF`) | Camper opens the search modal, changes only the dates, and presses `ค้นหา` | The results still show only sea and waterfall camps, now narrowed by the new dates | `terrain=SEA,WATF` is preserved character-for-character; only the date values change | EC-1 |
| AC-4 | Camper already picked `ทะเล` and `น้ำตก` in the filter (the address carries `terrain=SEA,WATF`) | Camper taps the `ภูเขา` pill and presses `ค้นหา` | The results show mountain camps only | `terrain` is replaced by the single value `MTNS`, never merged with the previous two | EC-2 |
| AC-5 | Camper opens the search modal after the new home tabs shipped | Camper looks at the experience row | The row offers `แกลมปิ้ง`, `ทะเล`, and `น้ำตก` next to the original pills, matching the home category bar exactly | SearchModal reads `CATEGORIES` exported by `CategoryBar`; no second copy of the pill list exists | EC-3 |
| AC-6 | A developer hand-rolls a new selectable pill instead of using the primitive | The quality gate runs `npm run check:ds` | (developer-facing; no camper-visible copy) the gate prints the file and line of the hand-rolled pill | `check:ds` rule R9 reports a `<button>` / `<div role="button">` carrying `rounded-full` + a border + a selected-state signal, unless the file declares `FilterChip` itself | EC-5 |

## Rules
- BR-1 Exactly one component may style a selectable chip: `components/ui/filter-chip.tsx`. A consumer passes `variant`/`selected`/`onToggle`/`label`/`icon` and contributes no chip className of its own — height (44px), radius (`rounded-full`), icon size (`size-4`), `min-w-[44px]`, `transition-colors`, and `active:scale-95` all come from the primitive (proves AC-1, AC-2).
- BR-2 The selected chip is `bg-primary text-primary-foreground` with `border-primary`. `DESIGN.md`'s older `bg-foreground text-background` wording is retired (see `design.md` §Decision) — measured contrast 5.17:1 light / 7.23:1 dark, both ≥ WCAG AA 4.5:1 for the 14px label (proves AC-1).
- BR-3 A pill is a single-value shortcut over the category dimension: picking one **replaces** whatever value sits in its owned param (`type` or `terrain`), including a filter-written multi-value CSV, and never merges — the identical rule CAM-529 documented for the home tabs, executed by the same exported `buildCategoryUrl` (proves AC-4).
- BR-4 When no pill can represent the current address (a multi-value CSV such as `terrain=SEA,WATF`, an unknown code, or `type` and `terrain` both set), no pill renders as selected and pressing `ค้นหา` leaves `type`/`terrain` untouched. Only an explicit pill tap rewrites the category dimension (proves AC-3).
- BR-5 The pill list has exactly one source: `CATEGORIES`, exported from `components/CategoryBar.tsx`. `SearchModal` may not declare its own list (proves AC-5).
- BR-6 `check:ds` R9 fires on a `<button>` (or `<div role="button">`) whose opening tag carries `rounded-full` **and** a `border*` class **and** a selected-state signal (`aria-pressed`, or a `selected`/`active`/`checked` conditional), and never on the file that declares `FilterChip`. It lands in the mode the PR states, with the measured backlog count; a blocking mode is only permitted at backlog 0 (`.claude/rules/ops.md`) (proves AC-6).

## Edge cases
- EC-1 IF the address carries a multi-value `terrain` CSV THEN opening the search modal selects no pill and pressing `ค้นหา` preserves the CSV byte-for-byte (BR-4)
- EC-2 IF the address carries a multi-value `terrain` CSV AND the camper taps a terrain pill THEN the CSV is replaced by that pill's single code, not appended to (BR-3)
- EC-3 IF a new category tab is added to `CategoryBar` THEN the search modal shows it with no edit to `SearchModal.tsx` (BR-5)
- EC-4 IF a pill is disabled THEN it renders at 50% opacity and cannot be pressed, from the primitive's own disabled state, with no consumer override (BR-1)
- EC-5 IF a file declares `FilterChip` itself THEN R9 does not fire on it, so the primitive's own implementation is never reported as drift (BR-6)

## Data
No schema, no migration, no API change. Read-only consumer of already-seeded MasterData codes (`CAGD`/`CACP`/`GLAMP` types, `BEAC`/`SEA`/`FORE`/`MTNS`/`RIVE`/`WATF` terrain). No new i18n key — all ten `categories.<key>` entries already exist in `locales/translations.json` (th + en) from CAM-529.

## Seams & refs
- Reuse: `components/ui/filter-chip.tsx` (`FilterChip`, `variant="pill"`) — the canonical primitive already used by `FilterModal`, `spot-management-section`, and `app/preview`. `components/CategoryBar.tsx` exports `CATEGORIES` (the single pill list) and the pure `buildCategoryUrl` (the mutual-exclude / single-value-replace rule, CAM-529 BR-1/BR-2) — imported read-only, `CategoryBar.tsx` is not edited. `scripts/check-ds.mjs` R1–R8 scanner is the host for the new R9.
- Refs: `.claude/plans/research-user-jolly-mochi.md` §"S5" + §"Chip drift" · `DESIGN.md` §2 (radius/size roles), §3 (component decision matrix), §3.1 (Component Index), §6 (gate) · `.claude/rules/ops.md` (report-mode → backlog 0 → blocking rollout for a new guard) · `.claude/rules/code.md` §3 (reuse before create).
- Out of bounds (owned by other agents right now): `locales/translations.json`, `prisma/**`, `app/api/**`, `components/CampgroundDetailClient.tsx`, `components/CampgroundForm.tsx`, `components/FilterModal.tsx`, `components/ActiveFilters.tsx`, `components/CategoryBar.tsx`, `lib/taxonomy-registry.ts`, `app/globals.css`.

## Out of scope
- Restyling `ActiveFilters` (dismiss tokens, correctly `Badge`) or `CategoryBar` (an underline nav tab, not a chip) — both are deliberately outside the chip family; the reason is recorded in `design.md` §Not-a-chip so a future reader does not "fix" them.
- Changing any color token. The dark-mode selected-vs-surface fill contrast (2.31:1, below the 3:1 WCAG 1.4.11 non-text target) is a **pre-existing, system-wide** token property shared by every bordered control (`--border` is 1.25:1 on light `--background`); it is recorded as a `DESIGN.md` backlog item, not fixed here — a fix means editing `app/globals.css` tokens, which is a separate owner-visible decision.
- Flipping R9 to blocking later if it lands in report mode → the PR states the mode and the backlog count; the flip is a one-line follow-up.

## Self-verify
- `npx vitest run __tests__/cam-532-chip-standardization.test.ts` — green, both guard directions proven (fires on a hand-rolled fixture, silent on `FilterChip`).
- `npm run check:ds` (R9 backlog count reported) · `npm run check:palette` · `npm run typecheck` · `npm run lint` · `npx vitest run` (full suite, last).
- `grep -c 'shadow-primary/20' components/SearchModal.tsx` → 0 · `grep -c 'EXPERIENCE_TYPES' components/SearchModal.tsx` → 0 · `grep -c 'FilterChip' components/SearchModal.tsx` → ≥1.
