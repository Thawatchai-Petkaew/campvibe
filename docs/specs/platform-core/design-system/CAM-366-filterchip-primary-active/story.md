<!--
ticket: CAM-366
epic: — (standalone design-system primitive fix; no parent epic)
feature: platform-core
status: Done (implemented in this PR)
version: v1
spec-class: LITE (S) — single file-surface (components/ui/filter-chip.tsx) + its two guard-test files, no schema/migration, no new API contract, expected diff well under ~150 lines. G1 folds into this PR's G3 packet per the S-class rule.
persona: Camper
-->

## Story
As a **Camper**, I want the FilterChip primitive's selected state to fill with the app's primary teal (not an inverted black/foreground fill), so that a selected filter (catalog Activity/Facility filters, and any other screen reusing the shared chip, e.g. a Host's zone-filter row) reads as "on-brand selected", consistent with every other selected/primary control in the app (Buttons, active nav, etc.).
Why: owner decision (2026-07-05) — the chip's selected state used a foreground-inversion token (`bg-foreground`/`text-background`), which renders as a stark black/white fill rather than the teal brand color already used for every other "selected/primary" control per `DESIGN.md` §2's `primary`/`primary-foreground` row (documented use: "primary buttons, actions, prominent links, **selected**").
Scope: `components/ui/filter-chip.tsx` only — the shared primitive's 3 variants (`pill`, `card`, `icon-card`). This is a token-family swap on the already-existing `selected` conditional branch (`foreground` family → `primary` family); the unselected branch, the component's props/behavior, and every consumer file (`components/FilterModal.tsx`, `components/spot-management-section.tsx`) are unchanged — the effect is system-wide by construction because both consumers render through this one primitive.
Depends on: — (no ADR; reuses the existing `primary`/`primary-foreground` token pair already shipped on the default `Button` variant)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A `FilterChip` (any variant: pill / card / icon-card) is unselected | The user selects it (e.g. taps an Activity/Facility filter, or a Host's zone chip) | The chip's fill/border turns the app's primary teal instead of a black/inverted fill (no new user-facing text; the change is purely visual) | The chip's `selected` branch renders `border-primary`/`bg-primary` (pill: + `text-primary-foreground`; card/icon-card: `bg-primary/5` tint + `text-primary` label/icon) instead of the old `border-foreground`/`bg-foreground`/`text-background` set | EC-1 |
| AC-2 | A `FilterChip` is selected | The user deselects it | The chip returns to the existing default (unselected) appearance — no visual regression | The `selected=false` branch is untouched (`border-border bg-card text-foreground` / `border-border text-muted-foreground`) | — (unselected branch was not touched by this change; no failure mode to twin) |

## Rules
- BR-1 Every one of the 3 variants' `selected` branch uses the `primary`/`primary-foreground` token family in the same class positions/structure the `foreground` family previously occupied (pill: `border-primary bg-primary text-primary-foreground hover:bg-primary/85`; card: `border-primary bg-primary/5` + icon `text-primary`; icon-card: `border-primary bg-primary/5 font-semibold text-primary`). No new token, no new component. (proves AC-1)
- BR-2 The `selected=false` branch and every other prop/behavior (`aria-pressed`, `disabled`, focus ring, tap-target sizing) is unchanged. (proves AC-2)

## Edge cases
- EC-1 IF the app is in dark mode THEN the selected chip still resolves to the `primary`/`primary-foreground` pair automatically via the `.dark` token flip (no hand-written `dark:` override was added — DESIGN.md forbids one) (BR-1)
- EC-2 IF a chip is both `disabled` and `selected` THEN the existing `opacity-50 pointer-events-none` disabled treatment still applies on top of the new primary fill (disabled handling untouched by this change) (BR-2)

## Data
- No entities/fields touched. No migration.

## Seams & refs
- Reuse: `components/ui/filter-chip.tsx` is the ONLY primitive edited — no parallel logic. Consumers (`components/FilterModal.tsx` catalog Activity/Facility filters, `components/spot-management-section.tsx` zone-filter row) are **not edited**; they inherit the new selected treatment automatically by rendering through this shared primitive.
- Refs: `DESIGN.md` §2 token table, `primary`/`primary-foreground` row — documented use includes "selected"; the same pair is already used by the default `Button` variant (`components/ui/button.tsx`), so this is a proven, already-shipped contrast pair, not a novel combo.

## Out of scope
- Any edit to `components/CampgroundForm.tsx` or `components/spot-management-section.tsx` — both are owned by another in-flight agent; this story only touches the shared primitive they consume. No follow-up needed: the consumers get the new treatment for free with zero code change on their side.
- Any new component, token, or variant — this is a token-family swap on an existing conditional branch only.

## Self-verify
- AC-1 → unit (source-inspection guard tests: `__tests__/ds1-dropdown-grammar.test.ts` AC-chip-7 + a new CAM-366 regression guard pinning the exact selected-branch classes on all 3 variants; `__tests__/f2-listing-surface.test.ts` AC-chip-1) + owner-verify screenshot on the real Staging URL (visual confirm: teal fill, not black).
- AC-2 → unit (the same guard files assert the unselected-branch classes are unchanged).
- EC-1 → unit guard already in `ds1-dropdown-grammar.test.ts` ("FilterChip has no dark: color overrides") — untouched by this change, still green.
- EC-2 → covered by existing disabled-state assertions in the same guard suite (untouched).
- Story-specific: no new component/token (check:ds + check:palette green) · consumer files untouched (verified by diff scope) · design gate (token-only, all 8 states already existed and are unchanged except the selected fill color).
- Gate = /quality-gate · Done = every AC verified on the real Staging URL.

## Changelog
- v1 (2026-07-05) — created. FilterChip primitive's selected state changed from foreground-inversion (`bg-foreground`/`text-background`) to the primary/primary-foreground family across all 3 variants (pill/card/icon-card); system-wide effect on `FilterModal` (catalog filters) and the zone-chip row via the shared primitive — no consumer file touched.
