---
linear: CAM-444
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# The in-chat card price reads bright enough in dark mode (CAM-444)

<!-- Gate class: G2 = standard class (reuses the closed --ai-* token exception, DESIGN.md §2.1 — adds one new member to that already-sanctioned set, no new screen/flow/component) — no separate G2 tap. -->

## Story
As a **Camper**, I want the price on a recommended-camp card in the assistant chat to be easy to read in dark mode, so that I can compare prices at a glance without straining to read dim text.
Why: R3 owner staging feedback — the price teal was too dim to read on the dark card.
Scope: `app/globals.css` (one new `--ai-price` token, light + dark) + `components/ai-chat/AiChatCampCard.tsx` (price hero spans only, both the priced and free branches) + `DESIGN.md` §2.1 (allowlist doc).
Depends on: CAM-426 (the closed `--ai-*` AI Expression Layer token set) · CAM-438 (the price hero line this token now colors).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the app is in dark mode | the camper views a chat card with a real nightly price | the ฿price number renders in a visibly brighter teal, readable against the dark card (≥ 4.5:1 contrast) | no data change; the price span's color resolves to the new `--ai-price` (dark) token instead of `--primary` | EC-1 |
| AC-2 | the app is in dark mode | the camper views a chat card for a free campsite | the `ฟรี` hero text renders in the same brightened teal as AC-1, same size/weight | display-only; same token swap on the free-branch span | EC-1 |
| AC-3 | the app is in light mode | the camper views any chat card's price (priced or free) | the price hero color is unchanged from before this fix | `--ai-price` (light) is defined equal to light `--primary` — no visual change in light mode | — (boundary of AC-1/AC-2, light mode was already ≥ AA) |

## Rules
- BR-1 A new closed-set token `--ai-price` is added to `app/globals.css` (`:root` + `.dark`) and mapped to a `@theme inline` utility (`--color-ai-price`, giving `text-ai-price`). `--primary` itself is not modified anywhere (it drives white-on-primary buttons and the user chat bubble site-wide). (proves AC-1/AC-3)
- BR-2 Light `--ai-price` = the existing light `--primary` value (`oklch(0.511 0.096 186.391)`) — the price color is unchanged in light mode, already ≥ AA (5.36:1 measured) as text on the white `--card`. (proves AC-3)
- BR-3 Dark `--ai-price` = `oklch(0.760 0.120 184)`, a brightened teal — measured 8.56:1 as text on dark `--card` (was 2.30:1 with `--primary`), clearing WCAG AA 4.5:1 with margin. (proves AC-1/AC-2)
- BR-4 Both price-hero spans in `AiChatCampCard.tsx` (the priced `฿{amount}` span and the free `ฟรี` span) switch from `text-primary` to `text-ai-price` — they are the same "price hero" element, just two branches of the same conditional. (proves AC-1/AC-2)

## Edge cases
- EC-1 IF a future edit re-hardcodes `text-primary` on either price-hero span THEN the dark price silently returns to 2.30:1 (below AA) — guarded by `__tests__/cam-444-dark-price-contrast.test.ts`'s structural assertion that `text-primary` is absent from the price `<p>` block

## Data
— n/a (CSS token + className only; no schema/API change).

## Seams & refs
- Reuse: the closed `--ai-*` AI Expression Layer token set + its `@theme inline` wiring pattern (`DESIGN.md` §2.1, `app/globals.css`, CAM-426).
- Refs: `docs/specs/ai-assistant/chat-experience-overhaul/CAM-438-card-price-hero/story.md` (the price hero this token colors) · `CAM-426-ai-expression-layer/story.md` (the token-set precedent).

## Out of scope
- Any other `--ai-*` token, any non-price element on the card, or any change to `--primary`/`--accent` themselves.
- Re-tuning the light-mode price color — light was already ≥ AA; only dark was dim (owner R3 feedback was dark-mode specific).

## Self-verify
New test file `__tests__/cam-444-dark-price-contrast.test.ts` (Prove-It — computes the real WCAG relative-luminance contrast ratio from the actual OKLCH token values parsed out of `app/globals.css`, not a source-string grep alone):

- AC-1/BR-3 → regression: confirms the ORIGINAL bug (`--primary` dark as text on dark `--card` < 4.5:1); confirms the NEW `--ai-price` (dark) clears ≥ 4.5:1; confirms it is measurably brighter (higher L) than `--primary`.
- AC-3/BR-2 → unit: light `--ai-price` equals light `--primary` (unchanged) and clears ≥ 4.5:1.
- BR-1 → unit: `--ai-price` declared in both `:root` and `.dark`; `--color-ai-price` mapped in `@theme inline`.
- AC-1/AC-2/BR-4 → unit: both price-hero spans use `text-ai-price`; structural guard that `text-primary` is absent from the price `<p>` block (EC-1).
- DESIGN.md §2.1 → unit: `--ai-price` is named in the closed-token-set parenthetical + a MAY-line documents its purpose.
- Existing `__tests__/cam-438-card-price-hero.test.ts` updated (was pinned to `text-primary`, now pinned to `text-ai-price` — same design-system-refactor pattern as CAM-224/226/229) and re-run green; `__tests__/cam-426-ai-expression-layer.test.ts` re-run green unaffected (its allowlist assertion is a prefix substring, still contained).
- Manual (this PR): a real `axe-core` browser scan (`@axe-core/playwright`'s underlying `axe-core`, run against static markup carrying the actual shipped `oklch()` values) confirms `color-contrast` PASS in both themes and reproduces the pre-fix FAIL at 2.3:1 — numbers reported in the PR/handoff, not fabricated.
- Gate = `/quality-gate` · Done = merge to `dev` + AC verified on localhost before merge.

## Changelog
- v1 (2026-07-19) — created (spec-first, template v2, terse per the spec-lite class; owner R3 feedback fix).
