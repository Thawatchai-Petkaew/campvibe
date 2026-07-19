## Story
As a **Camper**, I want the expanded chat to feel like a true full-screen immersive space instead of a big floating card, so that when I grow the conversation it fills the whole screen with the campfire-night ambient behind it, my reading stays centered and easy to focus on, and the message box floats like a natural part of that scene instead of a boxed-in toolbar.
Why: direct owner staging feedback on the CAM-429 "expand to full-page" toggle — the near-full-page card (`inset-2`/`sm:inset-6`, rounded, bordered) still read as a card floating over the page rather than an immersive space.
Scope: `components/ai-chat/AiChatPanel.tsx` only. Does NOT touch `AiChatLauncher.tsx` / `AiChatAvatar.tsx` / `AiChatMessageList.tsx` / `app/globals.css` (parallel sibling stories own those in this wave).
Depends on: CAM-426 (closed `--ai-*` token set + glass surface, DESIGN.md §2.1), CAM-429 (the `expanded` toggle + `sessionStorage` persistence this story reshapes)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The chat panel is open (collapsed) | Camper taps the expand icon in the header | แผงแชทเต็มจอทั้งหมด ไม่มีกรอบการ์ดล้อมรอบ เห็นบรรยากาศกองไฟเต็มขอบจอ | `expanded` flips to `true`; Content className switches to `inset-0` with no `rounded-3xl`/`border` at the outer edge; the ambient (`.ai-aurora` + `AiAmbientCanvas`) fills edge-to-edge | AC-2 |
| AC-2 | The chat panel is expanded (fullscreen) | Camper taps the collapse icon | แผงแชทย่อกลับเป็นการ์ดลอยขนาดเดิมที่มุมขวาล่าง (จอกว้าง) หรือเต็มความกว้างด้านล่าง (จอมือถือ) | `expanded` flips to `false`; Content className returns to the byte-identical CAM-407 bottom-sheet/anchored-card variant; message list, composer draft, and `useAiChat` state carry over unchanged (no remount) | AC-1 |
| AC-3 | The chat panel is expanded (fullscreen) | Camper reads messages or types | ข้อความและกล่องพิมพ์อยู่กึ่งกลางจอเป็นแนวตั้ง มีระยะขอบว่างซ้ายขวากว้างพอสมควร ไม่ยืดเต็มขอบจอ | The reading/composing column renders inside a centered `max-w-2xl`/`sm:max-w-3xl` wrapper with side gutters; the collapsed variant is unaffected (already narrower than the bound) | — (layout-only, no failure twin) |
| AC-4 | The chat panel is expanded (fullscreen) | Camper looks at the bottom of the screen | กล่องพิมพ์ข้อความเป็นแคปซูลโปร่งแสงลอยอยู่เหนือบรรยากาศ ไม่ใช่แถบทึบเต็มความกว้างแบบมีเส้นขอบ | The composer renders as a `rounded-full` glass dock (`bg-ai-surface` + `backdrop-blur-xl` + `shadow-ai-glow` + a subtle teal→sky gradient accent) instead of the collapsed bordered full-width bar; send button unchanged | AC-5 |
| AC-5 | The chat panel is collapsed (bottom-sheet/anchored-card) | Camper looks at the composer | กล่องพิมพ์ข้อความยังเป็นแถบเต็มความกว้างมีเส้นขอบด้านบนเหมือนเดิม | Collapsed composer classes (`border-t border-border/60 p-4`) are byte-identical to pre-CAM-431 | AC-4 |
| AC-6 | The chat panel is expanded (fullscreen) | Camper looks at the top of the screen | ปุ่มขยาย/ปิด ลอยอยู่มุมขวาบนเป็นกลุ่มแคปซูลโปร่งแสง ชื่อผู้ช่วยยังอยู่มุมซ้ายบนแต่ดูเบาลง ไม่มีเส้นคั่นด้านล่าง | Header row drops `border-b`; the expand/close buttons group inside a `rounded-full` glass pill; the identity cluster (avatar + name/role) keeps the same elements, lighter container | — (layout-only, no failure twin) |

## Rules
- BR-1 `expanded`'s fullscreen geometry is `inset-0` on every breakpoint (no `sm:` variant) — mobile and desktop both go edge-to-edge; no `rounded-3xl`/`border` class is present on the Content element while `expanded` is `true`.
- BR-2 Every DOM node inside the panel (header row, identity cluster, button group, scroll region, composer row, `Textarea`, send `Button`) is the SAME element in both the `expanded` and collapsed branches — only `className` forks on `expanded` via `cn(...)` ternaries. No node is conditionally mounted/unmounted based on `expanded`, so `useAiChat()`, the thread `entries`, and the composer `draft` state are never lost on toggle (extends CAM-429 BR-4).
- BR-3 The centered column (`max-w-2xl`/`sm:max-w-3xl` + side padding) wraps the scroll region + composer only while `expanded`; the collapsed variant renders the same wrapper with no extra width/padding classes (a no-op, since the collapsed card is already narrower than the bound).
- BR-4 The fullscreen composer dock uses only already-sanctioned DESIGN.md §2.1 tokens (`bg-ai-surface`, `shadow-ai-glow`, `backdrop-blur-xl`) plus stock Tailwind gradient utilities on the existing semantic tokens `primary`/`info` (`bg-gradient-to-r from-primary/10 via-info/10 to-transparent`) — no new `--ai-*` token, no `app/globals.css` edit.
- BR-5 `expanded`'s `sessionStorage` persistence (`ai-chat-expanded`, CAM-429 BR-3) is unchanged by this story — only the visual shape of the `expanded` branch changes, not the state machine.

## Edge cases
- EC-1 IF the camper toggles expand/collapse repeatedly THEN the message list scroll position may reset (expected — the layout genuinely changes shape) but `entries`, `draft`, and the active `useAiChat` conversation never reset or lose data.
- EC-2 IF `prefers-reduced-motion: reduce` is set THEN the fullscreen transition still respects the existing `motion-reduce:data-open:animate-none`/`motion-reduce:data-closed:animate-none` guard (unchanged from CAM-429).
- EC-3 IF the viewport is very short (e.g. landscape mobile keyboard open) THEN the centered column still scrolls within `min-h-0 flex-1` (unchanged scroll-region mechanics from CAM-407); no new overflow bug introduced by the added wrapper div.

## Data
No schema change. No migration. No new `locales/` keys — this story restyles existing elements only (no new user-facing copy).

## Seams & refs
- Reuse: DESIGN.md §2.1 closed `--ai-*` token set (`bg-ai-surface`, `shadow-ai-glow`) · the existing `.ai-aurora`/`AiAmbientCanvas` ambient (CAM-426, unmodified) · stock Tailwind gradient utilities on the existing `primary`/`info` semantic tokens (no new token).
- Refs: CAM-426 (Expression Layer, DESIGN.md §2.1 sanctioned exception) · CAM-429 (the `expanded` toggle + near-full-page geometry this story reshapes into true fullscreen).

## Out of scope
- A side panel for the reserved side gutters → a future story once the center-column reading experience is validated (owner note).
- Any change to `AiChatLauncher.tsx` / `AiChatAvatar.tsx` / `AiChatMessageList.tsx` / `app/globals.css` → parallel sibling stories in this wave.
- Any new `--ai-*` token or named motion loop → would require full human G2; this story reuses only already-sanctioned primitives + stock semantic-token gradients.

## Self-verify
- AC-1/AC-2 → `__tests__/cam-431-fullscreen-immersive-chat.test.ts` (Content className: `inset-0`, no `rounded-3xl`/border while expanded; collapsed variant byte-identical to CAM-407)
- AC-3 → `__tests__/cam-431-fullscreen-immersive-chat.test.ts` (centered `max-w` wrapper present, forks on `expanded`)
- AC-4/AC-5 → `__tests__/cam-431-fullscreen-immersive-chat.test.ts` (fullscreen composer = `rounded-full` glass dock with gradient accent; collapsed composer classes unchanged)
- AC-6 → `__tests__/cam-431-fullscreen-immersive-chat.test.ts` (header loses `border-b` + buttons group into a `rounded-full` pill while expanded)
- No-remount guarantee (BR-2) → `__tests__/cam-431-fullscreen-immersive-chat.test.ts` (every shared node/prop wiring — `entries`, `draft`, `useAiChat()` destructure — present exactly once, unconditional)
- Updated pre-existing guards superseded by this story's geometry change → `__tests__/cam-429-chat-shell-launcher.test.ts` (Content className assertion) + `__tests__/cam-272-ai-chat-components.test.ts` (header/composer shrink-0 assertion)
- Gate = `/quality-gate` (lint/typecheck/test/build + `check:ds`/`check:palette`) · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created
