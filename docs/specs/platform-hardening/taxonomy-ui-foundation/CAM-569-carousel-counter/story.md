## Story
As a **Camper** using the น้องกองไฟ chat assistant, I want the `{cur}/{N}` pagination counter on a long card carousel to stay legible in light mode, so that I can tell which result I'm on without straining to read faint text.
Why: CAM-541 measured this exact defect while fixing the neighbouring assistant secondary-text spots, but its file surface excluded `AiChatCardCarousel.tsx` (owned by CAM-547), so it reported the gap instead of fixing it (CAM-541 story.md, Out of scope).
Scope: `components/ai-chat/AiChatCardCarousel.tsx` (the `{cur}/{N}` counter's text class only) · `scripts/check-contrast.mjs` (register the pair). Does NOT touch CAM-547's active/inactive DOT treatment (shape-based indicator, `MAX_DOTS` threshold unchanged) and does NOT touch `app/globals.css` (no new token needed — CAM-541 already shipped `text-foreground/70` and the `fgAlpha` measurement mechanism this story reuses).
Depends on: CAM-541 (the `text-foreground/70` fix + `fgAlpha` contrast-guard mechanism, merged), CAM-547 (the carousel's dot shape-fix, merged, untouched here).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The assistant panel is open in light mode and a search returned more than 5 campsite cards (the `{cur}/{N}` counter form of the pagination indicator) | The camper looks at the counter below the card strip | The numeral pair reads clearly, not faint/washed out (no copy change — a language-neutral numeral pair, `aria-hidden`) | The counter's text class renders at a measured contrast ratio ≥ 4.5:1 against the panel's `--ai-surface` glass, in both light and dark themes (`scripts/check-contrast.mjs`) | EC-1 |
| AC-2 | A search returns 5 or fewer cards (the dot form of the same indicator) | The camper looks at the indicator | The active/inactive dot treatment (wider pill vs. round dot) is unchanged from CAM-547 | No change to the dots' classes or shapes | — (regression-guard only; CAM-547 already fixed this — re-verified, not re-solved) |

## Rules
- BR-1 The counter (`{cur}/{N}`, shown when `cards.length > MAX_DOTS`) uses `text-foreground/70`, never `text-muted-foreground` — the same established fix CAM-541 already shipped for the assistant's other secondary-text spots on `--ai-surface` (no new token, no new component).
- BR-2 The dots' classes (`h-1.5 w-4 rounded-full bg-primary` active / `h-1.5 w-1.5 rounded-full bg-muted-foreground/60` inactive) are untouched — colour alone was already proven insufficient to separate them (CAM-547), and the counter and dots do not share one treatment because they are different problems: the counter is body TEXT judged at the 4.5:1 floor, the dots are a non-text state signal (SC 1.4.11, 3:1 floor) that already needed a SHAPE fix, not a colour swap.

## Edge cases
- EC-1 IF a future change reintroduces `text-muted-foreground` on the counter THEN `npm run check:contrast` fails (the `--foreground`@70%-vs-`--ai-surface` pair, already enforced by CAM-541 and now explicitly documented as covering this counter too, does not itself regress at the token level; a component regression back to the wrong class is caught by this story's own class-level assertion, not the token guard alone).

## Data
- No schema/data change. Pure client-side class fix in `AiChatCardCarousel.tsx` + a `scripts/check-contrast.mjs` context annotation. Migration: none.

## Seams & refs
- Reuse: `text-foreground/70` is the SAME fix CAM-541 already shipped for `AiChatPanel.tsx`/`AiChatMessageList.tsx`'s identical `text-muted-foreground`-on-`--ai-surface` defect. The exact numeric pair (`--foreground` at 70% over `--ai-surface`, floor 4.5) is ALREADY registered in `scripts/check-contrast.mjs`'s `ENFORCED_PAIRS` by CAM-541 (it measures the token math, not any one component's usage) — this story extends that entry's `context` to name the carousel counter explicitly, rather than adding a numerically-duplicate row that would test the identical math twice (CLAUDE.md Iron Rule 6, Lean).
- Refs: CAM-541 story.md (origin of the `text-foreground/70` fix + the `fgAlpha` contrast-guard mechanism, and the ticket that first reported this exact gap) · CAM-547 story.md (the dot shape-fix, untouched by this story).

## Out of scope
- Redesigning the dots-vs-counter two-style indicator, or unifying their treatment — confirmed intentional per CAM-547 (design.md), a Designer decision, not a defect.
- Any change to `AiChatPanel.tsx`, `AiChatLauncher.tsx`, `AiChatMessageList.tsx`, or `AiChatCampCard.tsx` — CAM-541 already fixed the assistant's other secondary-text spots; none of those files change here.

## Self-verify
- AC-1 → unit (`__tests__/cam-569-carousel-counter-contrast.test.ts`, computes the real light/dark ratios from `app/globals.css` via `scripts/check-contrast.mjs`'s own engine — no hardcoded expected number; also asserts the counter's source class is `text-foreground/70`, not `text-muted-foreground`) + `npm run check:contrast` (the pair, already enforced, now documented for this context).
- AC-2 → unit (source-inspection: the dots' active/inactive class strings are asserted present, byte-for-byte, unchanged from CAM-547).
- Story-specific: `npm run check:contrast` reports the enforced-pair count (58, unchanged — this story extends an existing row's context rather than adding a duplicate) and the before/after ratio for the counter (before: measured at the pre-existing `--muted-foreground`-on-`--ai-surface` pair's light-mode ratio; after: the `--foreground`@70% pair's ratio), computed not guessed.
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created
