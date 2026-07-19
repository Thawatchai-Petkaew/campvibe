---
linear: CAM-425
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# Chat loading is centered + the assistant stays a single thread (CAM-425)

<!-- Gate class: G2 = standard class (reuse-only: AiChatAvatar/LoadingSpinner-pattern + existing tokens, no new component/flow/token; the CAM-423 new-chat button is removed, not redesigned) — check:ds + check:palette green, no separate G2 tap. -->

## Story
As a **Camper**, I want the assistant's "resuming your conversation" loader centered in the chat window (not pinned top-left) and only ONE conversation thread available at a time, so that the loading moment feels intentional and on-brand, and I never lose or fork my ongoing conversation by accident.
Why: CAM-423 shipped the resume-fetch indicator pinned top-left (a bare spinner) and a "+" new-chat button; both ship ahead of a conversation-switcher UI, so the button currently only lets a camper silently abandon their one saved thread with no way back to it.
Scope: `components/ai-chat/AiChatMessageList.tsx` (loading treatment only) + `components/ai-chat/AiChatPanel.tsx` (remove the header button only). `startNewChat` stays in `use-ai-chat.ts`, unreferenced, for a later conversation-switcher story. Guest path unaffected (no session, no resume fetch).
Depends on: CAM-423 (resume fetch + the button this hides).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | a logged-in camper with a saved conversation | opens the assistant panel while the conversation is being fetched | a centered loader (น้องกองไฟ avatar with a subtle pulse) + `กำลังโหลด…` in the middle of the chat window, not pinned to the top-left corner | no data change — same `listConversations`→`getConversation` resume fetch as CAM-423; only the loading presentation changes | EC-1 |
| AC-2 | any camper (guest or logged-in) | opens the assistant panel | no "+" start-new-chat control appears anywhere in the header | the panel renders with only the identity cluster + the Close button; `startNewChat` is not wired to any control | — |
| AC-3 | `prefers-reduced-motion: reduce` is set | the centered loader is shown | the avatar renders static (no pulse animation), `กำลังโหลด…` still visible | the pulse class is `motion-safe:` scoped; no animation runs under reduced motion | — |

## Rules
- BR-1 The resuming indicator is centered within the chat thread area (an absolutely-positioned overlay filling the `ScrollArea`'s box, which is already `position: relative`), not an auto-height row at the top of the message list. (proves AC-1)
- BR-2 The resuming indicator uses the shared `AiChatAvatar` (size `lg`) wrapped in a `motion-safe:animate-pulse`, plus the existing `aiChat.loading` label — no new component, no new i18n key. (proves AC-1, AC-3)
- BR-3 The header never renders a new-chat control; `startNewChat` remains exported from `use-ai-chat.ts` for a future conversation-switcher story, but no button in `AiChatPanel.tsx` calls it. (proves AC-2)
- BR-4 The resuming region keeps its existing a11y contract unchanged: `role="status"` + `aria-live="polite"` + `aria-busy={resuming}` + the `aiChat.loading` text label. (proves AC-1, AC-3)

## Edge cases
- EC-1 IF the resume fetch fails or returns no saved conversation THEN the loader clears exactly as before (CAM-423 BR-2 unchanged) and the fresh welcome state renders — the centering change does not alter that fallback (BR-1)

## Data
— n/a (UI-only; no schema, route, or store change).

## Seams & refs
- Reuse: `AiChatAvatar` (`components/ai-chat/AiChatAvatar.tsx`, CAM-411) · `components/ui/scroll-area.tsx`'s `relative` Root (CAM-407's definite-height chain) · the existing `role=status`/`aria-live=polite`/`aria-busy` pattern from CAM-423 · `t.aiChat.loading` (no new locale key) · `motion-safe:`/`motion-reduce:` utilities already used elsewhere in this file (`ENTRANCE_MOTION_CLASS`).
- Refs: `.claude/rules/loading.md` §5 (a11y pair + reduced-motion) · CAM-407 (`AiChatPanel.tsx` comment on definite-height flex chain — the same reasoning applies to why an absolute overlay, not `h-full`, reliably centers inside Radix's `display:table` Viewport wrapper).

## Out of scope
- A conversation-switcher / history-browsing UI (the follow-up that will re-wire `startNewChat` to a control) — not built here.
- Any change to the resume fetch itself, `use-ai-chat.ts` state machine, or the API routes (CAM-423/420/421 unchanged).

## Self-verify
- AC-1/BR-1/BR-2/BR-4 → source-inspection (`AiChatMessageList.tsx`'s resuming branch uses `absolute inset-0 flex ... items-center justify-center`, `AiChatAvatar size="lg"`, `motion-safe:animate-pulse`, and keeps `role="status"`/`aria-busy={resuming}`/`{t.aiChat.loading}`) — `__tests__/cam-425-*.test.ts`
- AC-2/BR-3 → source-inspection (`AiChatPanel.tsx` no longer contains `btn--ai-chat-new` or a `MessageSquarePlus` import) — Prove-It (red before the fix, green after)
- AC-3 → the pulse class is `motion-safe:`-scoped (source-inspection); the underlying `prefers-reduced-motion` behavior is browser-only (owner-verify on `npm run dev`, per qa.md)
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost (dev DB) before merge.

## Changelog
- v1 (2026-07-19) — created (spec-first, template v2, terse per the spec-lite class).
