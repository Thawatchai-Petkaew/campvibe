## Story
As a **Camper**, I want the after-send "น้องกองไฟ is thinking" indicator to show as plain animated dots with no box around them, so that the in-flight moment reads as a light typing cue instead of a tinted chip competing with the message above it.
Why: R3 owner staging feedback — the `rounded-2xl bg-ai-tint px-4 py-2.5` frame around the typing dots read as an unwanted box; the dots alone are the intended affordance.
Scope: `components/ai-chat/AiChatMessageList.tsx` (the `sending && !lastIsStreaming` typing-indicator row only) + `__tests__/cam-426-ai-expression-layer.test.ts` (the `bg-ai-tint` occurrence-count guard, updated from 3 to 2 now that typing drops the frame). Does NOT touch the answer row (already plain text since CAM-439), the rate-limited/disabled notice chips, `ErrorBanner`, or the CAM-433 centered resuming-flame indicator.
Depends on: CAM-426 (`bg-ai-tint` token + the 4-then-3-row guard) · CAM-439 (already dropped `bg-ai-tint` from the answer row, leaving 3) · CAM-412 (`lastIsStreaming` gate that suppresses this row once streaming text exists, unchanged).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper just sent a message and no streaming answer entry exists yet | The turn is in flight (`sending === true`) | Three small dots pulse in sequence with no surrounding box/tint | The typing row's className drops `rounded-2xl bg-ai-tint px-4 py-2.5`; the row keeps `flex items-center gap-1` + the entrance motion class | — (visual, owner staging verify) |
| AC-2 | The typing row is visible | A screen reader is active | The screen reader announces `กำลังพิมพ์...` (unchanged `t.aiChat.typing` sr-only label) | `role="log" aria-live="polite"` on the parent + the row's `sr-only` label are untouched | — |
| AC-3 | The rate-limited notice, the disabled notice, or `ErrorBanner` renders | The camper views the chat | Those system notices still show inside their own tinted container, unchanged | Those rows keep `bg-ai-tint`; only the typing row loses it | — |
| AC-4 | A streaming answer entry already exists for the current turn | The turn is in flight | No separate typing-dots row appears (the growing text + caret is already the in-flight affordance) | `sending && !lastIsStreaming` stays the gate — unchanged from CAM-412 | AC-1 (its positive twin) |

## Rules
- BR-1 The typing row's className becomes `` `flex items-center gap-1 ${ENTRANCE_MOTION_CLASS}` `` — no background fill, no padding, no radius. The parent `<div role="log" ... className="... p-4">` already supplies the log's own edge inset, so no replacement padding is added.
- BR-2 `bg-ai-tint` is retained on exactly 2 rows after this change: the rate-limited notice and the disabled notice. `ErrorBanner` keeps its own destructive tint (unchanged, CAM-272).
- BR-3 The 3 animated dot spans (`size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse`, staggered `animationDelay`) and the `sr-only` `t.aiChat.typing` label are unchanged in markup and behavior — only the wrapping container's frame classes are removed.

## Edge cases
- EC-1 IF `prefers-reduced-motion: reduce` is set THEN the dots render statically (no `motion-safe:animate-pulse`, no entrance slide-in) — unchanged prior behavior, not affected by the frame removal.
- EC-2 IF the composer is disabled or rate-limited when the camper attempts to send THEN the typing row never renders at all (those are separate notice rows gated on `entry.kind`, not on `sending`) — unaffected by this change.

## Data
No schema/migration. Pure className change on an existing element; no new state, prop, or persisted field.

## Seams & refs
- Reuse: no new component; the existing typing-row `<div>` in `AiChatMessageList.tsx` is edited in place. No parallel loader/spinner introduced (per `.claude/rules/loading.md` — one loader per region, unchanged region).
- Refs: CAM-426 (§2.1 exception, introduced `bg-ai-tint` on this row) · CAM-439 (dropped it from the answer row, precedent for this same-class removal) · CAM-412 (the `lastIsStreaming` suppression this story does not touch).
- Reader/writer sweep (architecture.md 15b): no new reader/writer of any field; `sending`/`lastIsStreaming` props are read exactly as before.

## Out of scope
- Any change to the answer row, notice chips, `ErrorBanner`, or the CAM-433 resuming-flame indicator.
- Re-tuning the dot animation timing/stagger — visual-only frame removal per R3 feedback.

## Self-verify
- AC-1/AC-3/BR-1/BR-2 → source-inspection (`__tests__/cam-426-ai-expression-layer.test.ts`, occurrence-count guard updated 3→2; `__tests__/cam-272-ai-chat-components.test.ts` typing test-id + gate assertions re-run, unchanged and still green)
- AC-2/BR-3/EC-1 → unchanged markup, covered by existing `__tests__/cam-272-ai-chat-components.test.ts` + `__tests__/cam-410-chip-render.test.ts` assertions on the typing block
- AC-4/EC-2 → unchanged `lastIsStreaming`/notice-row gating, covered by existing CAM-412/CAM-272 tests
- Design gate: `check:ds` + `check:palette` green; no new token/component; token-only removal (no stray hex/px added)
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created, R3 owner staging feedback
