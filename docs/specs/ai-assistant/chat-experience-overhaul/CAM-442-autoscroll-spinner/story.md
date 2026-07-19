## Story
As a **Camper**, I want the chat panel to follow the newest message and show a visible sending spinner, so that I don't have to scroll down manually after every question and I can tell the assistant is actually working.
Why: R3 owner feedback — (1) the thread never followed a new send/answer, the view froze wherever Enter was pressed; (2) the send button's spinner rendered invisible (same color as the button fill), making the icon look like it "disappeared."
Scope: `components/ai-chat/AiChatPanel.tsx` only. Does NOT touch `components/ui/scroll-area.tsx` or `components/ui/loading-spinner.tsx` (both shared primitives, left untouched), `AiChatMessageList.tsx`, or any token/new component.
Depends on: CAM-272 (the panel + ScrollArea this bug lives in), CAM-407 (the definite-height flex chain the auto-scroll fix must not disturb), CAM-412 (the streaming answer whose growth the auto-scroll must follow)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper is reading the thread at the bottom (or the thread is fresh) | Camper sends a question (Enter or a suggestion chip) | The view is already at the newest turn as it appears — camper never has to scroll manually | The scroll wrapper's `stickToBottomRef` is forced `true` on send, then the viewport scrolls to `scrollHeight` on the entries/sending change | EC-1 |
| AC-2 | Camper sent a question and the assistant's answer is streaming in (guest path) | The answer text grows word by word | The view keeps following the growing answer | The auto-scroll effect re-fires on the streaming entry's growing text length while `stickToBottomRef` is `true` | EC-2 |
| AC-3 | Camper scrolled up mid-thread to re-read an earlier message | A new turn arrives (their own send or a settling answer) | The view stays where the camper left it, it does not yank back down | The near-bottom scroll listener flips `stickToBottomRef` to `false` once the camper scrolls away from the last ~120px of the viewport | AC-1 |
| AC-4 | Camper reopens the panel and their last conversation is being restored | The restore finishes | The view lands on the newest (most recent) message, not wherever the fetch happened to leave it | `resuming` transitioning true→false is in the auto-scroll effect's dependency list, and `stickToBottomRef` still defaults `true` on a fresh mount | EC-3 |
| AC-5 | Camper presses the send button | The turn is in flight | The button's spinner is visibly a spinning ring, not an invisible/blank icon | The button renders a `Loader2` icon in `text-primary-foreground` (visible against the button's `bg-primary` fill) instead of the shared `LoadingSpinner` (whose ring color was hardcoded to the same `border-primary`) | — (visual-only, no negative path) |

## Rules
- BR-1 The auto-scroll wrapper ref (`scrollWrapperRef`) sits on the EXISTING flex column that already holds `<ScrollArea>` (not a new wrapping element) so the CAM-407 definite-height chain is untouched; the real scrollable node is resolved via `querySelector('[data-radix-scroll-area-viewport]')` since `components/ui/scroll-area.tsx` exposes no ref for it and that shared primitive is not edited.
- BR-2 `stickToBottomRef` defaults `true`; a scroll listener on the viewport flips it to `false` once `scrollHeight - scrollTop - clientHeight >= 120` (camper has scrolled away from the bottom to read history), and back to `true` whenever the camper is within that threshold again.
- BR-3 Every camper-initiated send (`handleSend`, `handleSuggestion`) forces `stickToBottomRef.current = true` before the turn starts, overriding any prior "reading history" state — Enter always jumps to the newest turn.
- BR-4 The follow-effect scrolls to `viewport.scrollHeight` only when `stickToBottomRef.current` is true, re-running on `[entries.length, sending, lastAssistantTextLength, resuming]`; `requestAnimationFrame` defers the read until the appended DOM has committed.
- BR-5 Scroll behavior is `"auto"` under `prefers-reduced-motion: reduce`, `"smooth"` otherwise (checked live via `matchMedia`, not cached).
- BR-6 The send button's in-flight icon is `lucide-react`'s `Loader2` (`size-4 animate-spin text-primary-foreground motion-reduce:animate-none`), replacing `<LoadingSpinner>`; the now-unused `LoadingSpinner` import is removed from this file (confirmed to be its only use).

## Edge cases
- EC-1 IF the camper sends a question while already scrolled up reading history THEN the send still jumps the view to the bottom (BR-3 overrides the read-history state — a send is always camper-initiated intent to see the new turn).
- EC-2 IF the guest stream aborts mid-flight (panel closed while streaming) THEN no scroll effect fires again after unmount (the effect's cleanup cancels any pending `requestAnimationFrame`).
- EC-3 IF the restored conversation has zero messages (a brand-new camper) THEN the effect is a no-op scroll-to-top (no content to follow, no crash).

## Data
No schema change. No migration. No new `locales/` keys.

## Seams & refs
- Reuse: Radix's own `data-radix-scroll-area-viewport` attribute (already rendered by `components/ui/scroll-area.tsx`, unedited) + `lucide-react`'s existing `Loader2` icon (already a project dependency via other lucide imports in this file).
- Refs: CAM-407 (`docs/specs/ai-assistant/ai-camping-assistant-a1-a4-b1-b3-c-inquiry/CAM-407-ai-chat-panel-fixed-size-bounded-scroll/`, the definite-height chain this fix must not disturb) · CAM-412 (`docs/specs/ai-assistant/ai-camping-assistant-a1-a4-b1-b3-c-inquiry/CAM-412-assistant-answers-stream-in-word-by-word/`, the streaming entry the auto-scroll follows).

## Out of scope
- A "jump to latest" floating button for when the camper has scrolled away — not requested; a future story if the owner asks for it.
- Any change to `components/ui/scroll-area.tsx` or `components/ui/loading-spinner.tsx` (both shared primitives stay generic; this fix is scoped to how `AiChatPanel.tsx` consumes them).

## Self-verify
- AC-1/AC-3/BR-1/BR-2/BR-3 → `__tests__/cam-442-autoscroll-spinner.test.ts` (source-inspection: wrapper ref + querySelector + stickToBottomRef + forced-true on send/suggestion)
- AC-2/BR-4 → `__tests__/cam-442-autoscroll-spinner.test.ts` (effect deps include the streaming/answer text length + `entries.length`/`sending`/`resuming`)
- AC-4 → `__tests__/cam-442-autoscroll-spinner.test.ts` (`resuming` present in the effect's dependency array)
- BR-5 → `__tests__/cam-442-autoscroll-spinner.test.ts` (`prefers-reduced-motion` checked via `matchMedia`, `"auto"`/`"smooth"` branch present)
- AC-5/BR-6 → `__tests__/cam-442-autoscroll-spinner.test.ts` + updated `__tests__/cam-272-ai-chat-components.test.ts` (BR-3 block: `<Loader2` present, `LoadingSpinner` absent)
- Gate = `/quality-gate` (lint 0 errors / typecheck / test / build + `check:ds`/`check:palette` green) · Done = AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created
