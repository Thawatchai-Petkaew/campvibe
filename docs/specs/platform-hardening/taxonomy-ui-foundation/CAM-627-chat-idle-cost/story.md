## Story
As a **Camper**, I want the assistant panel to stop doing continuous work while it sits open and idle, so that my laptop does not run hot just from having the chat open.
Why: owner (Golf) device-level report, 2026-07-28: "ช่วยเอา animate ที่อยู่ใน chat ออกทั้งหมด เพราะเครื่องร้อนมากตอนเปิด chat เหลือไว้แค่น้องกองไฟ" (remove the animation in the chat, the machine runs hot with it open; keep only น้องกองไฟ).
Scope: `components/ai-chat/AiAmbientCanvas.tsx`, `app/globals.css` (`.ai-aurora-drift` only), `components/ai-chat/AiChatPanel.tsx` (doc-comments only, no className/behavior change). Does NOT touch `AiChatAvatar.tsx` (น้องกองไฟ stays exactly as-is), `lib/ai/**`, `app/api/**`, or any non-chat component.
Depends on: CAM-426 (introduced the ambient layer + `AiAmbientCanvas`), CAM-432 (`ai-flame-flicker`) — both merged, both unaffected by this fix.

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The chat panel is open and idle (no request in flight) | A fixed idle window is profiled (Chrome/CDP trace) | The panel looks and behaves the same (aurora glow + campfire particles still visible, frozen) | `AiAmbientCanvas` fires zero `requestAnimationFrame` callbacks during the window (was ~240/4s); renderer main-thread busy time over that window drops from ~630-665ms/4s to ~100-110ms/4s (measured, this machine, before vs after — see design.md) | EC-1 |
| AC-2 | The chat panel is open, no message ever sent | The camper looks at the header identity mark or the loading hero | น้องกองไฟ's flame still pulses (`ai-flame-glow`) and its aura still flickers while genuinely loading (`ai-flame-flicker`) | `AiChatAvatar.tsx` is untouched byte-for-byte; both classes still apply exactly as before | — (regression-guard only, no failure twin needed: the file is out of this story's surface) |
| AC-3 | The camper's OS is set to `prefers-reduced-motion: reduce` | The camper opens the chat panel | The panel shows the same still frame it already showed before this fix (dim stars only) | `AiAmbientCanvas`'s reduced-motion branch (`drawStaticFrame`) is unchanged; the aurora was already visually static under reduce-motion and stays so | EC-2 |
| AC-4 | The camper's OS has no motion preference (`no-preference`), the previous default | The camper opens the chat panel | The aurora gradient is visible but no longer drifts; the ambient particle scene (stars, fireflies, embers) renders once, frozen, instead of animating forever | `.ai-aurora-drift`'s CSS rule is `animation: none` unconditionally; `AiAmbientCanvas` paints one frame per real trigger (mount/resize/theme/tab-foreground) instead of looping | AC-1 |

## Rules
- BR-1 `AiAmbientCanvas` never calls `requestAnimationFrame` more than once per trigger (mount, `ResizeObserver` fire, theme-class `MutationObserver` fire, `visibilitychange` returning to foreground, `prefers-reduced-motion` change) — no self-rescheduling loop.
- BR-2 `.ai-aurora-drift` (`app/globals.css`) is `animation: none` unconditionally — not gated by `prefers-reduced-motion`, since a static loop is correct for every camper now, not just reduced-motion ones.
- BR-3 `AiChatAvatar.tsx` is not touched by this story; น้องกองไฟ's two motion classes (`ai-flame-glow`, `ai-flame-flicker`) are unaffected.
- BR-4 The reduced-motion code path in `AiAmbientCanvas.tsx` (the `if (!reducedMotionQuery.matches)` branch calling `drawStaticFrame()`) is unchanged in source and behavior.

## Edge cases
- EC-1 IF a future change reintroduces a self-rescheduling `requestAnimationFrame` call inside `AiAmbientCanvas.tsx`'s `step()` THEN `__tests__/cam-627-chat-idle-cost.test.ts`'s source-inspection guard fails (asserts `step`'s body contains no `requestAnimationFrame` call).
- EC-2 IF a future change adds an `animation` declaration back onto `.ai-aurora-drift` (any media query) THEN the same test file's guard fails (asserts the ONLY `.ai-aurora-drift { … }` rule block in `app/globals.css` sets `animation: none`).

## Data
No schema/data change. Pure client-side rendering-cost fix (one CSS rule, one component's internal loop). Migration: none.

## Seams & refs
- Reuse: `AiAmbientCanvas`'s existing `drawStaticFrame()` (reduced-motion fallback, unchanged) and its existing particle-seed/color-token machinery (`seed()`, `readTokenColor()`, `particleCap()`) — no new component, no new token.
- Refs: CAM-426 (`design.md §7`, the original loop budget/justification), CAM-432 (`ai-flame-flicker`, untouched), DESIGN.md §2.1 (updated in this story to record the loop count dropping from 4 to 3).

## Out of scope
- The panel's `backdrop-blur-xl`/`backdrop-blur-md` glass surfaces themselves — profiling (design.md) found these carry a real, separate, larger GPU-compositor cost that persists regardless of animation state (measured even with both loops frozen). That is the DESIGN.md §2.1-sanctioned glass-surface identity (item 3), not an animation — reducing it is a Designer/G2 call, tracked as a follow-up, not fixed here.
- The typing-dot pulse, streaming caret, `Loader2` send-spinner, and the launcher FAB's two decorative `animate-pulse` dots — all are state-gated (only render while sending/streaming/in-flight) or trivially cheap (small-element opacity pulse on the always-mounted FAB, not the panel); none contributed measurably to the idle-open cost profiled here, so none are changed.

## Self-verify
- AC-1 → `__tests__/cam-627-chat-idle-cost.test.ts` (source-inspection: no self-rescheduling rAF in `step()`) + the story's design.md before/after CDP trace numbers (owner-verify: measured on this machine, not asserted in a test — a real-browser continuous-frame measurement is not reproducible headless/CI).
- AC-2 → `__tests__/cam-627-chat-idle-cost.test.ts` asserts `components/ai-chat/AiChatAvatar.tsx` is unchanged from the pre-story git blob (byte-identical) and that `AiChatPanel.tsx` still renders `<AiChatAvatar .../>` unconditionally.
- AC-3 → existing `__tests__/cam-426-ai-expression-layer.test.ts` reduced-motion assertions (untouched, must stay green) + new assertion that `drawStaticFrame`'s source is unchanged.
- AC-4 → `__tests__/cam-627-chat-idle-cost.test.ts` asserts `.ai-aurora-drift { animation: none; }` in `app/globals.css` and that `step()`'s particle-draw code (stars+fireflies+embers) is reachable from a single, non-looping call site.
- Gate = `/quality-gate` (lint 0 errors · typecheck clean · full vitest suite green, including all pre-existing `cam-426`/`cam-432`/`cam-433` assistant-surface tests · `check:ds`/`check:palette` PASS). Done = AC verified on localhost before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created
