## Story
As a **Camper**, I want the fullscreen chat's message box to read as an intentional typing surface (at idle, while typing multi-line, and on focus) and the message list's scrollbar to sit at the screen edge, so that the composer no longer looks like an empty stretched pill with a detached send button, and the scrollbar isn't floating oddly mid-screen.
Why: direct owner staging feedback (R2) on the CAM-431 fullscreen composer — a `rounded-full` stadium at the full reading-column width looks right only as a single-line 44px bar; the moment the textarea grows toward `max-h-32` it becomes a stretched capsule, and the shared `max-w` wrapper put the scrollbar at the column's inner edge instead of the screen edge.
Scope: `components/ai-chat/AiChatPanel.tsx` (the `expanded` composer branch + the shared scroll/composer wrapper) only. Does NOT touch `AiChatMessageList.tsx` / `AiChatLauncher.tsx` / `AiChatAvatar.tsx` / `app/globals.css` (no new token needed).
Depends on: CAM-426 (closed `--ai-*` token set + glass surface, DESIGN.md §2.1), CAM-431 (the fullscreen composer + centered-column geometry this story restyles)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The chat panel is expanded (fullscreen), composer at idle (empty draft) | Camper looks at the message box | กล่องพิมพ์ข้อความเป็นกรอบโค้งมนดูเป็นกล่องจริง ไม่ใช่แคปซูลยาวว่างเปล่า | The composer surface class is `rounded-3xl` (was `rounded-full`); inset padding `pl-4` (was `pl-5`) so the textarea/button gap reads even | AC-2 |
| AC-2 | The chat panel is expanded, camper types a multi-line question | The textarea grows toward its `max-h-32` cap | กล่องพิมพ์ขยายสูงขึ้นอย่างเป็นธรรมชาติ ไม่ผิดรูปเป็นแคปซูลยืด | Same `rounded-3xl` surface stays visually correct at any textarea height (a card, not a pill) | — (layout-only, no failure twin) |
| AC-3 | The chat panel is expanded | Camper tabs to (or clicks into) the message box | มีกรอบแสดงโฟกัสรอบกล่องพิมพ์ข้อความอย่างชัดเจนหนึ่งเส้น | The surface gains `focus-within:ring-2 focus-within:ring-ring`; the textarea itself gets `focus-visible:ring-0` so only one ring shows (not a swallowed inner ring) | EC-1 |
| AC-4 | The chat panel is collapsed (bottom-sheet/anchored-card) | Camper looks at the composer | กล่องพิมพ์ข้อความยังเป็นแถบเต็มความกว้างมีเส้นขอบด้านบนเหมือนเดิม | Collapsed composer classes (`border-t border-border/60 p-4`, no rounded-3xl/focus-within) stay byte-identical to pre-CAM-436 | AC-1/AC-2/AC-3 |
| AC-5 | The chat panel is expanded, the conversation has enough messages to scroll | Camper scrolls the message list | แถบเลื่อนของรายการข้อความอยู่ที่ริมขอบจอ ไม่ใช่ริมขอบคอลัมน์อ่านตรงกลางจอ | The `ScrollArea` itself spans the full panel width (no `max-w` on the shared flex column); the centered reading column (`max-w-2xl`/`sm:max-w-3xl`) now wraps only the message-list content INSIDE the scroll viewport and the composer container, so the native scrollbar renders at the panel's outer edge | AC-6 |
| AC-6 | The chat panel is collapsed | Camper scrolls the message list | ตำแหน่งแถบเลื่อนของรายการข้อความเหมือนเดิม (การ์ดแคบอยู่แล้ว) | Collapsed layout unaffected (no `max-w` was ever applied there — a no-op) | AC-5 |

## Rules
- BR-1 Every node this story touches is the SAME element in both the `expanded` and collapsed branches — only `className` forks via `cn(...)` (no conditional mount/unmount); `useAiChat()`, `entries`, and the composer `draft` state are never lost on toggle (extends CAM-429/CAM-431's no-remount guarantee).
- BR-2 The reading-column width (`max-w-2xl`/`sm:max-w-3xl` + side padding) moves off the shared `mx-auto flex w-full min-h-0 flex-1 flex-col` wrapper and onto two places only: (a) a wrapper `<div>` around `<AiChatMessageList/>` inside `<ScrollArea>`, and (b) the composer container `<div>` (merged into its existing `expanded` branch). No new component; the reading width is unchanged (still the same `max-w-2xl`/`sm:max-w-3xl`, not narrower).
- BR-3 The composer surface uses only already-sanctioned DESIGN.md §2.1 tokens (`bg-ai-surface`, `shadow-ai-glow`, `backdrop-blur-xl`) plus the existing `ring` token for focus — no new token, no `app/globals.css` edit.
- BR-4 Send button (`h-11 w-11 rounded-full`, `data-testid="btn--ai-chat-send"`) is unchanged in size, shape, and position (bottom-right, inside the surface).

## Edge cases
- EC-1 IF `prefers-reduced-motion: reduce` is set THEN the focus ring still renders (a static outline is not motion) — no change from the existing reduce-motion guards on the panel's open/close transition.
- EC-2 IF the camper types past `max-h-32` (textarea's own scroll takes over) THEN the composer surface's `rounded-3xl` corners stay visually correct (no clipping) since the surface's own `p-2` padding and `items-end` alignment are unchanged.

## Data
No schema change. No migration. No new `locales/` keys — this story restyles existing elements only (no new user-facing copy).

## Seams & refs
- Reuse: DESIGN.md §2.1 closed `--ai-*` token set (`bg-ai-surface`, `shadow-ai-glow`) · the existing `ring`/`ring-ring` focus token (already used elsewhere in the design system) · the existing `max-w-2xl`/`sm:max-w-3xl` column width from CAM-431 (relocated, not redefined).
- Refs: CAM-426 (Expression Layer, DESIGN.md §2.1 sanctioned exception) · CAM-431 (fullscreen composer + centered-column geometry this story restyles).
- Design brief: `.claude/plans/` R2 chat design brief §CAM-436 (Designer, read-only — exact class diffs specified there; this story implements them verbatim).

## Out of scope
- Any change to `AiChatMessageList.tsx` internals (card carousel, answer rendering) → CAM-438/CAM-439, parallel sibling stories.
- A side panel for the reserved side gutters → future story once the center-column reading experience is validated (owner note, carried over from CAM-431).
- Any new `--ai-*` token or motion loop → would require full human G2; this story reuses only already-sanctioned primitives.

## Self-verify
- AC-1/AC-2 → `__tests__/cam-436-fullscreen-composer.test.ts` (surface is `rounded-3xl` not `rounded-full`, even `pl-4` inset, old stadium shape gone)
- AC-3 → `__tests__/cam-436-fullscreen-composer.test.ts` (`focus-within:ring-2 focus-within:ring-ring` on the surface, `focus-visible:ring-0` on the expanded textarea)
- AC-4 → `__tests__/cam-436-fullscreen-composer.test.ts` (collapsed composer classes byte-identical: `border-t border-border/60 p-4`)
- AC-5/AC-6/BR-2 → `__tests__/cam-436-fullscreen-composer.test.ts` (shared wrapper carries no width bound; message-list wrapper + composer container each carry the centered max-w column, forked on `expanded`)
- BR-1 (no-remount) → `__tests__/cam-436-fullscreen-composer.test.ts` (`useAiChat()` destructure + `entries={entries}` present exactly once)
- Updated pre-existing guards superseded by this story's class changes → `__tests__/cam-431-fullscreen-immersive-chat.test.ts` (composer shape + max-w wrapper pins) + `__tests__/cam-429-chat-shell-launcher.test.ts` (message-list indentation pin)
- Gate = `/quality-gate` (lint 0 errors / typecheck / test / build + `check:ds`/`check:palette` green) · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created
