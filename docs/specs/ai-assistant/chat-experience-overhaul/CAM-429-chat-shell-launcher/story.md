## Story
As a **Camper**, I want the chat shell to feel lighter and the launcher to feel like น้องกองไฟ, so that opening the assistant never blacks out the page I was reading, I can grow the conversation to full-page when I need more room, and the two floating buttons on Home (the assistant launcher and the "become a host" FAB) never sit on top of each other.
Why: direct owner staging feedback on the CAM-426 Expression Layer shell (background dim felt heavy, no way to expand, and the CAM-272-era FAB-collision offset made the launcher sit in an unnatural spot).
Scope: `components/ai-chat/AiChatPanel.tsx`, `components/ai-chat/AiChatLauncher.tsx`, `components/HostOnboardingFab.tsx`, `locales/translations.json`. Does NOT touch `AiChatMessageList.tsx` or `AiChatCampCard.tsx` (CAM-428, a parallel sibling story).
Depends on: CAM-272 (original launcher/panel + FAB-collision offset), CAM-411 (Flame avatar/aura idiom), CAM-426 (closed `--ai-*` token set + sanctioned motion list, DESIGN.md §2.1)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The chat is closed | Camper taps the launcher | หน้าเว็บด้านหลังยังมองเห็นชัดเจน ไม่มีฉากมืดปิดทับ แผงแชทลอยอยู่ด้านบน | `DialogOverlay` renders `bg-transparent` (kept in the tree); outside-tap, Esc, and focus-trap still work (Radix `DismissableLayer`/`FocusScope` live on `Dialog.Content`, independent of the Overlay) | EC-1 |
| AC-2 | The chat panel is open (collapsed) | Camper taps the expand icon in the header | แผงแชทขยายเกือบเต็มจอ ยังโค้งมนและโปร่งแสงเหมือนเดิม | `expanded` flips to `true`; Content className switches to the `inset-2`/`sm:inset-6` near-full-page variant; icon flips to the collapse icon | AC-3 |
| AC-3 | The chat panel is expanded | Camper taps the collapse icon | แผงแชทย่อกลับเป็นการ์ดลอยขนาดเดิม | `expanded` flips to `false`; Content className returns to the bottom-sheet/anchored-card variant; message list, composer, and `useAiChat` state carry over unchanged (no remount) | AC-2 |
| AC-4 | Camper picked expanded (or collapsed) earlier in this browser tab | Camper closes the chat and reopens the launcher again | แผงแชทเปิดมาในขนาดล่าสุดที่เคยเลือกไว้ | Initial `expanded` state is read from `sessionStorage` (`ai-chat-expanded`) | EC-2 |
| AC-5 | Camper is logged in and sees the "เป็นเจ้าของแคมป์" button on Home | Home renders alongside the AI chat launcher | ปุ่มเป็นเจ้าของแคมป์อยู่มุมซ้ายล่าง ปุ่มแชทอยู่มุมขวาล่างตำแหน่งปกติ ไม่ทับกัน | `HostOnboardingFab` is `fixed bottom-6 left-6`; `AiChatLauncher` is `fixed bottom-6 right-6` (no `bottom-24` offset) | — (layout-only, no failure twin) |
| AC-6 | Camper sees the chat launcher on Home | Page renders | ปุ่มแชทมีแสงเรืองแบบกองไฟรอบปุ่ม เปลวไฟเป็นสีส้มอุ่นและมีประกายไฟเล็กๆ ข้างปุ่ม | Launcher button uses `shadow-ai-glow`; flame uses `text-ai-ember` + the existing `ai-flame-glow` pulse; two decorative dots use `bg-ai-ember`/`bg-ai-firefly` with `motion-safe:animate-pulse` | EC-3 |

## Rules
- BR-1 `DialogOverlay` stays in the render tree with `className="bg-transparent"` — never removed outright — so Radix's `RemoveScroll` (body scroll-lock) and `hideOthers` (aria-hiding of background siblings) keep working; only the visible scrim disappears.
- BR-2 The focus trap, outside-pointer dismiss, and Esc dismiss are NOT re-implemented — they are already wired on `PanelPrimitive.Content` (`disableOutsidePointerEvents`/`trapFocus`/`onDismiss` inside Radix's `DialogContentModal`), independent of the Overlay's visual style; no `onEscapeKeyDown`/`onPointerDownOutside`/`onInteractOutside` override is added.
- BR-3 `expanded` is a single boolean `useState` inside `AiChatPanel`, initialized from `sessionStorage.getItem("ai-chat-expanded")`; every toggle writes back to `sessionStorage`. A read/write failure (privacy mode, quota) never throws — it silently falls back to in-memory-only for that open.
- BR-4 Expand/collapse reuses the SAME `AiChatMessageList`/composer/`useAiChat()` call — no remount, no message loss, no draft loss when toggling.
- BR-5 `HostOnboardingFab` moves to `fixed bottom-6 left-6 z-50`; `AiChatLauncher` resets to `fixed bottom-6 right-6 z-50` — its pre-CAM-272-FAB-collision natural position. No other fixed element occupies `bottom-6 left-6` anywhere in the app (verified by grep).
- BR-6 The launcher's campfire aura reuses ONLY already-sanctioned DESIGN.md §2.1 primitives — `shadow-ai-glow`, `text-ai-ember`, `bg-ai-ember`, `bg-ai-firefly`, and the existing `ai-flame-glow` named loop (already used on `AiChatAvatar`) — plus Tailwind's stock `animate-pulse`/`motion-reduce:animate-none` (the same idiom `components/ui/skeleton.tsx` already uses site-wide). No new CSS keyframe is added to `app/globals.css`; a brand-new motion inside the §2.1 exception would route back to full human G2.

## Edge cases
- EC-1 IF a camper clicks outside the (now-transparent) panel THEN the panel still closes (Radix's `disableOutsidePointerEvents`/dismissable-layer path is unaffected by the Overlay's opacity).
- EC-2 IF `sessionStorage` is unavailable (privacy mode) THEN the expand toggle still works for the current open; the next open defaults to collapsed (no crash, no thrown error).
- EC-3 IF `prefers-reduced-motion: reduce` is set THEN the flame pulse (`ai-flame-glow`, already-gated) and the two ember/firefly dots (`motion-reduce:animate-none`) render static.

## Data
No schema change. No migration. `sessionStorage` key `ai-chat-expanded` is client-only, not persisted server-side.

## Seams & refs
- Reuse: `components/ui/dialog.tsx` (`Dialog`/`DialogPortal`/`DialogOverlay`, unmodified) · DESIGN.md §2.1 closed `--ai-*` token set + the `ai-flame-glow` named loop (CAM-426) · the `motion-safe:animate-pulse`/`motion-reduce:animate-none` idiom already used in `components/ui/skeleton.tsx`.
- Verified against `@radix-ui/react-dialog` source (`node_modules/@radix-ui/react-dialog/dist/index.mjs`): `DialogContentModal` passes `disableOutsidePointerEvents: context.open` / `trapFocus: context.open` to `DialogContentImpl`, whose `DismissableLayer` wires `onDismiss: () => context.onOpenChange(false)` and the Esc-keydown handler directly — none of this depends on `DialogOverlay` being rendered or opaque.
- Refs: CAM-272 (original launcher/panel + FAB-collision offset) · CAM-411 (Flame avatar + `ai-flame-glow`) · CAM-426 (Expression Layer, DESIGN.md §2.1 sanctioned exception + motion list).

## Out of scope
- `AiChatMessageList.tsx` / `AiChatCampCard.tsx` changes → CAM-428 (parallel sibling story).
- A cross-session (localStorage) expand preference → `sessionStorage` only, per this story's scope.
- Any brand-new motion/keyframe for the launcher aura → would require full human G2; this story reuses only already-sanctioned primitives.

## Self-verify
- AC-1 → `__tests__/cam-429-chat-shell-launcher.test.ts` (DialogOverlay transparent + no dismiss-override guards)
- AC-2/AC-3/AC-4 → `__tests__/cam-429-chat-shell-launcher.test.ts` (expand state, toggle, sessionStorage read/write, className variants)
- AC-5 → `__tests__/cam-429-chat-shell-launcher.test.ts` + updated assertions in `__tests__/cam-272-ai-chat-components.test.ts` / `__tests__/cam-411-assistant-personality.test.ts`
- AC-6 → `__tests__/cam-429-chat-shell-launcher.test.ts` (aura/glow/ember/firefly token + motion-safe guards)
- Gate = `/quality-gate` (lint/typecheck/test/build + `check:ds`/`check:palette`) · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created
