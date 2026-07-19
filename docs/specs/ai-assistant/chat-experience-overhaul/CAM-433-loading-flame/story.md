## Story
As a **Camper**, I want the chat's loading moment to look like น้องกองไฟ's flame gently flickering (not a plain pulsing circle with a caption underneath), so that the wait reads as the assistant "breathing" on-brand instead of a generic loading spinner.
Why: direct owner staging feedback (item C) — the CAM-425 centered resuming indicator used a generic `motion-safe:animate-pulse` wrapper + a visible `กำลังโหลด…` caption; it read as a stock loader, not the campfire mark.
Scope: `components/ai-chat/AiChatMessageList.tsx` only (the CAM-425 resuming branch, ~L104-121). Does NOT touch `AiChatPanel.tsx` / `AiChatLauncher.tsx` / `app/globals.css` (parallel sibling stories own those files; the `ai-flame-flicker` keyframe + `--ai-flame-aura` token already exist, shipped by CAM-432).
Depends on: CAM-425 (centered resuming indicator, the branch this story recolors), CAM-432 (closed `ai-flame-flicker` keyframe + `--ai-flame-aura` token, already wired inside `AiChatAvatar` itself)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper opens the chat panel and the latest conversation is being fetched | The resuming state renders | เปลวไฟของน้องกองไฟวูบวาบเบาๆ กลางจอ (ไม่มีตัวหนังสือ "กำลังโหลด…" ให้เห็น) | The resuming branch renders `<AiChatAvatar size="lg" />` directly (no `motion-safe:animate-pulse` wrapper `<div>`); the avatar's own `ai-flame-flicker` aura span + `ai-flame-glow` icon pulse (already wired inside `AiChatAvatar`, CAM-432) supply the flicker | EC-1 |
| AC-2 | Camper's OS has no reduced-motion preference | The resuming state renders | แสงกองไฟวูบวาบต่อเนื่องขณะรอ | `AiChatAvatar`'s internal `ai-flame-flicker`/`ai-flame-glow` classes are unchanged and already gated `@media (prefers-reduced-motion: no-preference)` in `globals.css` (CAM-432, untouched here) | AC-3 |
| AC-3 | Camper's OS has `prefers-reduced-motion: reduce` set | The resuming state renders | เปลวไฟนิ่ง ไม่มีการวูบวาบ | Same untouched `AiChatAvatar` internals resolve `animation: none` under the existing reduce-motion block | AC-2 |
| AC-4 | A screen reader user opens the chat panel while resuming | The resuming state renders | ผู้ใช้โปรแกรมอ่านหน้าจอยังได้ยินประกาศ "กำลังโหลด…" เหมือนเดิม แม้จะไม่เห็นตัวหนังสือบนจอ | The region keeps `role="status"` + `aria-live="polite"` + `aria-busy={resuming}`; the `t.aiChat.loading` string moves into a `sr-only` `<span>` (announced, not painted) | EC-2 |
| AC-5 | Camper opens the chat panel while resuming | The resuming state renders | เปลวไฟยังคงอยู่กึ่งกลางจอเหมือนเดิม (ไม่ใช่มุมซ้ายบน) | The overlay keeps `absolute inset-0 flex flex-col items-center justify-center` (CAM-425's centering, unchanged) | — (regression guard, no failure twin) |

## Rules
- BR-1 No new CSS/keyframe/token is introduced — `ai-flame-flicker` and `--ai-flame-aura` already exist (CAM-432) and are already wired inside `AiChatAvatar` itself; this story only removes the extra `motion-safe:animate-pulse` wrapper `<div>` around it (CAM-425) so the avatar's own on-brand animation is what the camper sees, not a generic pulse layered on top.
- BR-2 The visible `กำลังโหลด…` text node is removed from the render tree entirely (not just hidden via CSS) and replaced by a `sr-only`-classed `<span>` carrying the exact same `t.aiChat.loading` string — no new locale key, no copy change.
- BR-3 The region's a11y contract (`role="status"`, `aria-live="polite"`, `aria-busy={resuming}`, `data-testid="status--ai-chat-resuming"`) and its centering classes (`absolute inset-0 flex flex-col items-center justify-center`) are unchanged from CAM-425 — this story only recolors the visual treatment inside the region.

## Edge cases
- EC-1 IF the camper has JavaScript-rendered dev tools open and inspects the DOM THEN no `motion-safe:animate-pulse` wrapper `<div>` remains around `AiChatAvatar` in the resuming branch (Prove-It: present before this fix, absent after).
- EC-2 IF a screen reader announces the region THEN it still reads the Thai `กำลังโหลด…` label (via the `sr-only` span), identical to the announcement before this story, even though the label is no longer visible on screen.

## Data
No schema change. No migration. Purely presentational (one JSX branch in one existing component; no new CSS/token).

## Seams & refs
- Reuse: `AiChatAvatar` (`components/ai-chat/AiChatAvatar.tsx`) already carries `ai-flame-flicker` (aura span) + `ai-flame-glow` (flame icon) internally, shipped by CAM-432 — this story does not add motion, it stops competing with the avatar's own motion.
- Refs: CAM-425 (`docs/specs/ai-assistant/chat-experience-overhaul/CAM-425-chat-loading-centered-single-thread/story.md` — the centered-overlay layout this story recolors, unchanged), CAM-432 (`docs/specs/ai-assistant/chat-experience-overhaul/CAM-432-fire-aura-flicker/story.md` — the flame/aura tokens + keyframe reused here, unchanged).

## Out of scope
- `AiChatPanel.tsx` / `AiChatLauncher.tsx` / `app/globals.css` — owned by parallel sibling stories in this epic; no new token/keyframe is needed or added.
- Any change to the welcome-state hero avatar or per-turn avatars (CAM-430 already removed those) — this story touches only the CAM-425 resuming branch.

## Self-verify
- AC-1/EC-1 → `__tests__/cam-433-loading-flame.test.ts` ("AC-1" — no motion-safe:animate-pulse wrapper left, AiChatAvatar rendered directly)
- AC-2/AC-3 → `__tests__/cam-433-loading-flame.test.ts` ("AC-2/AC-3" — AiChatAvatar's own flicker/glow classes present, untouched reduce-motion gate in globals.css)
- AC-4/EC-2 → `__tests__/cam-433-loading-flame.test.ts` ("AC-4" — sr-only span carries t.aiChat.loading; role/aria-live/aria-busy unchanged; no visible label text node)
- AC-5 → `__tests__/cam-433-loading-flame.test.ts` ("AC-5" — centering classes unchanged) + updated stale pins in `__tests__/cam-425-centered-loading-and-single-thread.test.ts` (the old visible-pulse/visible-label assertions, superseded per code.md's "update the guard to the new canonical class" rule)
- Gate = `/quality-gate` (lint 0 errors / typecheck / test / build + `check:ds`/`check:palette` green) · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created
