---
linear: CAM-407
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-18
---
# AI chat panel keeps a fixed size, bounded scroll, composer never overlaps (CAM-407)

<!-- Gate class: SPEC-LITE (S — G4 defect fix on CAM-272, no schema/migration, no new API contract, single file-surface (components/ai-chat/AiChatPanel.tsx + AiChatMessageList.tsx), diff ~53 lines). G1 folds into the G3 packet. -->

## Story
As a **Camper** using the desktop AI chat panel (CAM-272), I want the panel to keep its designed size and let the message list scroll inside its own bounded area, so that the composer stays pinned at the bottom and never visually covers an assistant answer or an in-chat campsite card.
Why: owner G4 screenshots on staging showed the desktop panel opening as a small, squat box (content-driven height) and, once cards rendered, the composer overlapping message content instead of sitting below a scrollable region.
Scope: layout-only fix inside the two existing CAM-272 components; no change to the chat endpoint, conversation state machine, copy, or CampgroundCard.
Depends on: CAM-272 (the story this fixes).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper opens the chat panel on desktop (≥ sm) with an empty thread | Panel first opens (before any message exists) | Panel renders at its full designed size immediately (not a small/squat box that grows later) | Desktop dialog content has a definite `height` (not content-driven `auto`); width stays ~384px | AC-2 |
| AC-2 | Camper has sent enough messages/cards to exceed the panel's height | Camper scrolls the message list | The message list scrolls inside its own area; the composer stays visible at the bottom and never covers a message or card | Message list is a bounded `flex-1 min-h-0` scroll region inside a parent with a definite height; header and composer never compress | EC-1 |
| AC-3 | An assistant turn includes 1 or more in-chat campsite cards | Camper views the turn | Each card renders at the same width as the message column (not visibly narrower than the panel) | Card wrapper is `w-full max-w-full`; only the plain-text answer bubble keeps the narrower chat-bubble width | — (visual-only, no separate negative path) |

## Rules
- BR-1 The desktop (`sm:`) dialog content uses a fixed `height` expression bounded to the viewport (`min(37.5rem, 80dvh)`), never `height: auto` plus a `max-height` alone — an auto-height flex container does not give its scrollable child a resolvable percentage height. (proves AC-1, AC-2)
- BR-2 The panel header and composer rows carry `shrink-0` so only the message-list region is flexible. (proves AC-2)
- BR-3 An in-chat card's row and its cards container are `w-full max-w-full`; the `max-w-[85%]` chat-bubble constraint applies only to the plain-text answer bubble, not to the cards. (proves AC-3)

## Edge cases
- EC-1 IF the message list's content height exceeds the panel's bounded height THEN the excess scrolls inside the message-list region only — it must never render past the composer's box (BR-1, BR-2)

## Data
- No schema/API change. Layout-only edit to `components/ai-chat/AiChatPanel.tsx` and `components/ai-chat/AiChatMessageList.tsx`.

## Seams & refs
- Reuse: `components/ui/scroll-area.tsx` (unmodified) · `components/ui/dialog.tsx` primitives (unmodified) — only the two CAM-272 feature components change. Refs: `docs/specs/ai-assistant/ai-camping-assistant-a1-a4-b1-b3-c-inquiry/CAM-272-ai-chat-shows-campsite-cards-in-the-conversation-t/design.md` (panel dims + states, unchanged).

## Out of scope
- Auto-scroll-to-latest-message on new turns (a UX enhancement, not part of this defect) → file as a follow-up story if desired.

## Self-verify
- AC-1..3 → structural/unit (`__tests__/cam-272-ai-chat-components.test.ts`, CAM-407 describe block: fixed-width/height classes, `shrink-0` on header/composer, `w-full max-w-full` on the card row) + owner-verify (visual, browser-only) confirmed locally via a real running dev server + Playwright: panel measured 384×600 from first open (was width 384 / height 372–396, content-driven); ScrollArea Viewport measured bounded to its flex box (432px, was 4463px unbounded) after the fix; composer never overlapped a rendered card in a 20-card conversation.
- Story-specific: no schema/API touched; regression guard added so `sm:h-auto` (or the old `max-w-[85%]` wrap around cards) cannot silently return.
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost (dev DB — N/A, no DB touched).

## Changelog
- v1 (2026-07-18) — created (spec-lite G4-defect fix on CAM-272, G1 folds into G3, Auto mode).
