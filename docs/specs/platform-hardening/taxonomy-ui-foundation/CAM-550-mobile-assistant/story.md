## Story
As a **Camper**, I want the assistant to behave correctly on my phone (full screen, a header that stays put, and a launcher I can always tap), so that the assistant is actually usable on a small screen instead of visually broken.
Why: owner tested live on a phone (2026-07-26) and reported three concrete defects — this ticket fixes exactly those three, nothing else.
Scope: `components/ai-chat/AiChatPanel.tsx` (geometry, header, composer) + `components/ai-chat/AiChatLauncher.tsx` (position). No change to CAM-541 (light-mode legibility/glow/duplicate avatar) or CAM-547 (result-card carousel) — both explicitly out of scope, flagged if this diff happens to make either LOOK different.
Depends on: —

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper opens the assistant on a small viewport (below 640px width) | The panel opens | The panel fills the entire screen; there is no minimize control and no way to collapse it back to a smaller card — only the close (×) control is present | The expand/collapse toggle is not rendered at all at this width (not merely hidden-but-tappable) | EC-1 |
| AC-2 | The camper opens the assistant on a desktop-width viewport (640px and above) | The panel opens | Both the expand/collapse toggle and the close control are present, exactly as before | No change to desktop behavior | — (regression-guard only; desktop was already correct) |
| AC-3 | The assistant is open on a phone with a long conversation | The camper scrolls the conversation up and down | The header (ผู้ช่วยหาที่กางเต็นท์'s name/role + close control) stays fixed in place at the top; it never scrolls off screen and does not require scrolling back down to reappear | The message list is the only scrolling region; the header/composer never move | EC-2 |
| AC-4 | The assistant is open on a phone | The camper looks at the top and bottom edges of the panel | There is visible breathing room above the header and below the composer — content does not sit flush against the screen edge or a notch/home-indicator | Header/composer padding includes a safe-area allowance | — (visual-only; no failure twin, verified by screenshot + real viewport measurement) |
| AC-5 | The camper is on any page, on a phone, with the assistant closed | The camper looks at the launcher button | The launcher disc is fully visible, never clipped at the screen edge | The launcher's fixed position is nudged clear of the device safe area | EC-3 |

## Rules
- BR-1 The expand/collapse toggle (`btn--ai-chat-expand-toggle`) renders only at `sm:` (640px) and above; below that width it does not exist in the accessible tree (proven by a real-browser visibility check, not just a class name).
- BR-2 Below `sm:`, the panel's geometry is forced to the same full-screen shape already used by the desktop "expanded" state, regardless of the internal `expanded` toggle value (which a mobile camper cannot reach anyway).
- BR-3 The panel's full-screen height on a small viewport uses a real dynamic-viewport-tracking unit (not a static `inset: 0`), so the box does not desync from the browser's currently-visible area as the address bar shows/hides.
- BR-4 The launcher's fixed position is nudged by the device's safe-area inset (notch / dynamic island / home-indicator), additive on top of its existing offset — zero effect on a device with no safe area.

## Edge cases
- EC-1 IF a camper resizes/rotates from desktop-width to below 640px while the panel is open THEN the toggle disappears and the panel becomes full screen on the very next re-render (CSS-driven, no separate mount).
- EC-2 IF the message list has not overflowed its viewport yet (a short conversation) THEN there is nothing to scroll and the header trivially stays in place — the guarantee only becomes observable once content overflows, which the e2e spec forces deterministically.
- EC-3 IF the device has zero safe-area inset (e.g. an older phone, or a desktop browser) THEN the launcher's position is byte-identical to before this story (the safe-area nudge evaluates to 0).

## Data
- No schema/data change. Pure client-side layout fix in `components/ai-chat/AiChatPanel.tsx` and `components/ai-chat/AiChatLauncher.tsx`. Migration: none.

## Seams & refs
- Reuse: no new component — this story only adjusts existing Tailwind classes on the existing `AiChatPanel`/`AiChatLauncher` shell (CAM-429/431/453/455's fullscreen geometry, reused for mobile instead of duplicated).
- Diagnosis performed first, per the ticket: the actual scroll container was already, correctly, the message list only (Radix `[data-radix-scroll-area-viewport]`, established by CAM-407/442/454) — confirmed via Playwright at a fixed viewport size (header/panel boxes never moved while the internal viewport scrolled). The real mobile-only gap was that the full-screen geometry relied on a bare `inset-0`, which a `position:fixed` box can resolve against the browser's large viewport rather than the currently-visible one on a real phone.
- Implementation constraint (recorded for the next reader): every fix is an ADDITIVE `max-sm:`-prefixed class layered after the existing `expanded ? … : …` branches in `AiChatPanel.tsx`, and the launcher's fix lives in a new inner wrapper + `style` rather than the outer `<div>`'s `className` — several pre-existing tests (`cam-272`, `cam-411`, `cam-429`, `cam-431`, `cam-432`, `cam-436`, `cam-454`, `cam-455`) pin those exact pre-CAM-550 strings verbatim; this keeps every one of them green without weakening any assertion.
- Refs: — (no ADR; a scoped mobile-layout bugfix).

## Out of scope
- CAM-541 (light-mode legibility, orange border/glow strength, duplicate avatar next to the first message) → not touched here.
- CAM-547 (result-card carousel: pagination dots, cropped card shadow, redundant "ดูรายละเอียด" line, badge mismatch, rating placement) → not touched here.

## Self-verify
- AC-1/AC-2 → unit (`__tests__/cam-550-mobile-assistant.test.ts`, structural: toggle carries `hidden sm:inline-flex`, close carries no `hidden`) + e2e (`e2e/regression/cam-550-mobile-fullscreen.spec.ts`, real browser at a phone viewport AND a desktop viewport — the only honest instrument for a responsive-CSS claim)
- AC-3 → e2e (real scroll of a genuinely-overflowing message list; header bounding box asserted unchanged and within the viewport before/after)
- AC-4 → owner-verify (browser-only visual; screenshot captured at a phone viewport during self-verify, `env(safe-area-inset-*)` present in source)
- AC-5 → e2e (launcher bounding box asserted fully inside the viewport at a phone width)
- Story-specific: proved (via Playwright, before writing the fix) which element actually scrolls — the message list, not the panel — before touching any geometry; confirmed the max-height cap (`max-h-[85dvh]`, inherited from the pre-existing collapsed branch) had to be overridden alongside height, or the panel silently stayed 85% tall despite the height fix (caught empirically, not by code review).
- Gate = `/quality-gate` (lint 0 errors · typecheck clean · full vitest suite green · `check:ds`/`check:palette`/`check:contrast` PASS). Done = every AC verified on localhost before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created
