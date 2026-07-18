---
linear: CAM-411
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-18
---
# Assistant gets a name, avatar and camp-friend personality (CAM-411)

## Story
As a **Camper**, I want the CampVibe assistant to greet me by name (`น้องกองไฟ`) with a friendly face and a warm, plain-language voice, so that asking for a campsite feels like chatting with a fellow camper who really knows their stuff, not a faceless bot.
Why: G4/POC feedback — the chat works but reads generic ("ผู้ช่วยหาที่กางเต็นท์" + a Sparkles button); an identity + voice is what turns a tool into a companion that campers trust and return to (Trust-before-growth, `principles.md` #1).
Scope: identity + presentation + voice only — a name, an avatar mark, richer welcome/empty states, an assistant-bubble avatar + entrance micro-motion, the launcher mark, the `aiChat.*` copy keys, and ONE Thai tone line appended to the assistant system prompt. Touches header / welcome / bubble + launcher + prompt ONLY. Does NOT touch the in-chat card list, card layout, the answer-body render, or any conversation/tool logic.
Depends on: CAM-272 (chat UI, shipped) · CAM-271 (chat endpoint, shipped).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The camper opens the chat panel | The header renders | A flame avatar next to `น้องกองไฟ` with `ผู้ช่วยหาที่กางเต็นท์` beneath it | None (presentational) | — (presentational, no failure twin) |
| AC-2 | A fresh chat with no messages | The panel opens | The welcome shows `สวัสดี เราน้องกองไฟเอง อยากได้ที่กางเต็นท์แบบไหน ลองเล่าให้ฟังได้เลย`, then `ลองถามแบบนี้ดู` above the 3 example prompt pills | None | — (presentational) |
| AC-3 | The assistant replies (answer, typing, or a notice) | A turn renders | Each assistant-side bubble shows the flame avatar to its left and eases in gently | None | EC-1 |
| AC-4 | A search returns no matching cards | The answer renders | `ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ` | None (unchanged zero-card behavior, CAM-272 AC-3) | — (copy only) |
| AC-5 | The Home page renders | The camper sees the floating launcher | A flame mark on the launcher with the accessible name `คุยกับน้องกองไฟ` | None | — (presentational) |
| AC-6 | The camper asks a question in Thai | The assistant writes its answer | A reply that reads warm, concise and jargon-free (the น้องกองไฟ tone) | The assistant system prompt carries the น้องกองไฟ tone line on every turn | — (model behavior, owner-verify) |

## Rules
- BR-1 Name = `น้องกองไฟ` (TH) / `Kongfai` (EN); role subtitle reuses the existing title text `ผู้ช่วยหาที่กางเต็นท์` / `Camping assistant`. Every string lives in `locales/` under `aiChat.*` (TH + EN), never hardcoded. (proves AC-1/AC-2)
- BR-2 Avatar = a lucide `Flame` icon inside a token-tinted round icon-chip (`bg-primary/10` fill + `text-primary` icon, `rounded-full`, `aria-hidden`) — the DESIGN.md §3 icon-chip pattern, NOT a new component, NOT an emoji, NOT an external image. The SAME mark appears on the launcher FAB, in the header, in the welcome hero, and beside every assistant bubble. Flame is brand-tinted teal (a stylised mark, not a literal orange fire) to hold the teal POV. (proves AC-1/AC-3/AC-5)
- BR-3 Entrance micro-motion = transform + opacity only, ~200ms, `motion-safe:` gated (instant under reduced-motion), on each message turn. The typing indicator keeps its existing 3-dot pulse unchanged (delta: "typing indicator stays inline dots"). (proves AC-3, EC-1)
- BR-4 The assistant system prompt gains ONE appended Thai tone line establishing น้องกองไฟ = เพื่อนนักแคมป์ที่รู้จริง (warm, polite, concise, plain language, no jargon, no emoji, honest when nothing is found) — verbatim in `design.md` §Personality tone. It is a MODEL INSTRUCTION appended inside `lib/ai/openrouter-client.ts buildSystemPrompt()`, NOT a user-facing `locales/` string. (proves AC-6)
- BR-5 The welcome keeps the 3 existing example prompts (`suggestion1`–`suggestion3`, unchanged text). While reworking the welcome, the pills' tap target is raised to ≥44px (`size="default"`, `h-11`) to meet the DESIGN.md a11y bar (CAM-272 shipped them at `h-9`/36px). (proves AC-2)

## Edge cases
- EC-1 IF the camper's OS requests reduced motion THEN no entrance animation runs (bubbles appear instantly); the avatar and copy still render. (BR-3)
- EC-2 IF the assistant is disabled / rate-limited / errored THEN the notice bubble still shows the น้องกองไฟ avatar for identity consistency; existing notice copy is unchanged except `disabled`, which is name-voiced (`น้องกองไฟยังไม่พร้อมให้บริการ`). (BR-2)

## Data
- No entities, no fields, no schema, no migration. Copy in `locales/translations.json` (`aiChat.*`, TH + EN) + ONE Thai tone string inline in `lib/ai/openrouter-client.ts`. migration: none.

## Seams & refs
- Reuse: `components/ai-chat/AiChatPanel.tsx` (header), `components/ai-chat/AiChatMessageList.tsx` (welcome + bubbles + typing), `components/ai-chat/AiChatLauncher.tsx` (launcher mark) · a new tiny presentational `AiChatAvatar` that composes the DESIGN.md §3 icon-chip pattern (no parallel primitive) · `lib/ai/openrouter-client.ts buildSystemPrompt()` (tone line). Refs: CAM-272 `design.md` (chat brief) · DESIGN.md §1 voice / §2 motion / §3 icon-chip.
- Coordination (file overlap): this story edits header / welcome / bubble + launcher + prompt ONLY. It must NOT edit the in-chat card list block (`entry.cards` render in AiChatMessageList) — CAM-409 (card carousel) and CAM-410 (answer-body chips) own the card/answer-body area. Land CAM-411 AFTER CAM-409/410 to avoid a merge conflict on AiChatMessageList.

## Out of scope
- Card carousel → CAM-409 · Answer-body chips → CAM-410 · Streaming answer → CAM-412 · A full `/assistant` page → later (seam only).
- Changing `error` / `rateLimited` notice copy (kept as-is; only `disabled` is name-voiced) → not requested.

## Self-verify
- AC-1/2/4/5 → owner-verify on localhost (header, welcome greeting + examples label, zero-result copy, launcher mark) + grep that every `aiChat.*` key exists in both TH and EN.
- AC-3 → owner-verify (avatar beside each assistant bubble + a gentle motion-safe entrance) + reduced-motion check (EC-1).
- AC-6 → owner-verify (an answer reads warm + plain) + unit: `buildSystemPrompt()` output contains the น้องกองไฟ tone line.
- Story-specific: no new token (`npm run check:palette` green); axe on the panel (avatar `aria-hidden`, header contrast); diff review confirms the card-list block is untouched.
- Gate = /quality-gate · Done = every AC verified on the real Staging URL.

## Changelog
- v1 (2026-07-18) — created (Wave1-S3 assistant personality; G2 novel-ui, design brief authored).
