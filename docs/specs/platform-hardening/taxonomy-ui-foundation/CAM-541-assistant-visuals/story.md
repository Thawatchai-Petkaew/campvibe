## Story
As a **Camper**, I want the assistant (น้องกองไฟ) to stay legible in light mode, stop overlapping page content on a small screen, calm its orange glow, and show its identity mark only once at the start of a chat, so that the assistant reads as polished rather than broken across theme, viewport and first-open.
Why: owner tested on localhost (2026-07-26) after CAM-550/CAM-547 merged and reported these four items directly.
Scope: `components/ai-chat/AiChatPanel.tsx`, `components/ai-chat/AiChatMessageList.tsx`, `components/ai-chat/AiChatAvatar.tsx` (aura token consumer only) + `app/globals.css` (`--ai-flame-aura` alpha only) + `scripts/check-contrast.mjs` (new enforced pair). Does NOT touch CAM-550's mobile geometry/launcher position or CAM-547's result-card carousel (indicator/shadow/rating badge) — both already shipped and are re-verified here, not re-solved.
Depends on: CAM-550 (mobile full-screen), CAM-547 (result-card carousel), CAM-451 (the `text-foreground/70` fix this story reuses), CAM-537 (the contrast-guard engine this story extends) — all merged.

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper is in light mode with the assistant panel open | The camper looks at the header's role subtitle (`ผู้ช่วยหาที่กางเต็นท์`), the welcome examples label (`ลองถามแบบนี้ดู`), or the zero-result notice (`ยังไม่เจอที่ถูกใจเลย...`) | The text reads clearly, not faint/washed out | Each of those three secondary-text spots renders at a measured contrast ratio ≥ 4.5:1 against the panel's glass surface (`scripts/check-contrast.mjs`) | EC-1 |
| AC-2 | The camper opens the assistant on a phone-width viewport (390px), in either light or dark mode, at both the default text scale and ~150% root font-size | The panel opens | The panel exactly fills the visible viewport; no page content is visible around or through it | The panel's measured bounding box equals `{x:0, y:0, width:viewportWidth, height:viewportHeight}` in every one of the 4 combinations | — (regression-guard only; CAM-550 already fixed this — re-verified, not re-solved) |
| AC-3 | The camper looks at the assistant's flame mark (header, welcome/loading states, or the launcher FAB) | Either theme | The orange aura halo around the mark is visibly dimmer than before, while still readably present as an affordance | The `--ai-flame-aura` shadow token's alpha channel is reduced (~40%) in both `:root` and `.dark`; hue/lightness/blur/spread geometry unchanged | — (visual-only; no failure twin, verified by screenshot + the CAM-432 regression pin on hue/lightness) |
| AC-4 | The camper opens the assistant with an empty conversation (a fresh chat) | The camper looks at the panel before sending a message | The assistant's flame mark appears exactly once (in the header) | The welcome/empty state's own copy of the mark is removed; the panel header's mark is the only one rendered | EC-2 |

## Rules
- BR-1 Any assistant-side secondary text that sits directly on `bg-ai-surface`/`bg-ai-tint` (no opaque child wrapper) uses `text-foreground/70`, never `text-muted-foreground` — the established, already-guarded fix (CAM-451), not a new token.
- BR-2 `--ai-flame-aura`'s three shadow layers keep their existing hue/lightness/blur/spread (`oklch(0.7[28]0 0.1[78]0 5[58])`-family, unchanged geometry) — only the alpha channel changes, so the CAM-432 aura identity is preserved, just dimmer.
- BR-3 The welcome/empty state (`entries.length === 0`) renders the greeting text with no `AiChatAvatar` of its own; the panel header's `AiChatAvatar size="md"` remains the sole visible mark until the first assistant reply, which also renders no avatar (unchanged since CAM-430).

## Edge cases
- EC-1 IF a future change reintroduces `text-muted-foreground` on `--ai-surface`/`--ai-tint` THEN `npm run check:contrast` fails (the new enforced pair, `--foreground`@70% vs `--ai-surface`/`--ai-tint`, floor 4.5, does not itself regress — this guards the TOKEN pair; a component regression back to the wrong class is caught by the CAM-541 test file's class-level assertions, not the token guard).
- EC-2 IF a future change reintroduces an `AiChatAvatar` inside the welcome/empty block THEN the CAM-541 regression test (counting `AiChatAvatar` renders in the DOM at chat-start) fails.

## Data
- No schema/data change. Pure client-side token/class fix in the assistant panel + a `app/globals.css` shadow-token alpha adjustment + a `scripts/check-contrast.mjs` guard addition. Migration: none.

## Seams & refs
- Reuse: `text-foreground/70` is the SAME fix CAM-451 already shipped for `AiChatDetailCard`'s identical `text-muted-foreground`-on-`ai-surface` defect — no new token, no new component. The contrast-guard extension (`fgAlpha` on a pair) generalizes `scripts/check-contrast.mjs`'s existing `overlay` mechanism (CAM-546, which tints the BACKGROUND a fill sits on) to the FOREGROUND side, which is what a Tailwind `text-x/NN` opacity utility actually renders.
- Refs: CAM-550 (mobile full-screen, re-verified not re-solved), CAM-547 (result-card carousel, untouched), CAM-451 (origin of the `text-foreground/70` fix), CAM-537 (origin of the contrast-guard engine this story extends).

## Out of scope
- The result-card carousel's own pagination-counter text contrast at `cards.length > MAX_DOTS` (an `aria-hidden` decorative numeral inside `AiChatCardCarousel.tsx`, CAM-547's file) — noted as a follow-up, not fixed here (this story's file surface excludes that carousel).
- The panel's own `bg-ai-surface`/`shadow-ai-glow` "glass" identity (how washed-out the whole surface reads against the page) — a deliberate CAM-426-sanctioned design exception, not a measurable token-pair defect; changing it is a Designer call, not this bug-fix's scope.

## Self-verify
- AC-1 → unit (`__tests__/cam-541-assistant-visuals.test.ts`, computes the real light-mode ratio from `app/globals.css` via `scripts/check-contrast.mjs`'s own engine — no hardcoded expected number) + `npm run check:contrast` (the new enforced pair, blocking).
- AC-2 → owner-verify performed during self-verify (Playwright against the local dev server at a 390×664 viewport, both `colorScheme`s, default and 24px root font-size — see PR body for the 4 measured boxes); asserted structurally in the CAM-541 test file that the `max-sm:h-[100dvh]`/`max-sm:top-0` full-screen classes are still present (CAM-550 regression guard, not a re-fix).
- AC-3 → unit (alpha values in `app/globals.css` are lower than the pre-CAM-541 values; hue/lightness family unchanged, re-checked against the existing CAM-432 pin).
- AC-4 → unit (counts `AiChatAvatar` occurrences in the welcome/empty block; asserts exactly one `AiChatAvatar` total reachable at chat-start across header + welcome).
- Story-specific: `npm run check:contrast` reports the enforced-pair count (54 → 58) and the light-mode before/after ratio for the fixed pair, computed not guessed.
- Gate = `/quality-gate` (lint 0 errors · typecheck clean · full vitest suite green · `check:ds`/`check:palette`/`check:contrast` PASS). Done = every AC verified on localhost before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created
