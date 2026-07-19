## Story
As a **Camper**, I want the assistant's replies to use the full message width and to only show the "no match, try again" notice when I actually searched and got nothing, so that I can read longer answers comfortably and I'm never told to "refine my search" after a greeting or a general question.
Why: owner staging feedback on the CAM-426/427/428 chat surface flagged three concrete defects — (C) the per-reply avatar eats horizontal space that should go to the answer text, (B) the in-chat card carousel/chips sit flush at the row's true left edge instead of lining up with the bubble's own text, and (D) the zero-result banner fired for EVERY answer with 0 cards, including greetings/FAQ/general chat where 0 cards is normal — a real bug, not a layout nit.
Scope: `components/ai-chat/AiChatMessageList.tsx` (avatar removal + width/alignment) + `components/ai-chat/conversation.ts` (`zeroResult` gate) + `lib/api-client.ts` (`AiChatOutcome.searchAttempted`, additive/optional) + `lib/ai/openrouter-client.ts` (tracks whether `searchCampsites` was dispatched this turn) + `app/api/ai/chat/route.ts` (forwards the additive, optional `searchAttempted` field on both the legacy and v2 response bodies). Does NOT touch `AiChatPanel.tsx`/`AiChatLauncher.tsx` (CAM-429's surface) or any schema/migration.
Depends on: CAM-411 (per-row avatar, now superseded here), CAM-409 (card carousel container), CAM-427 (`searchCampsites` tool + card wire contract).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | An assistant answer/typing/rate-limited/disabled/error row renders | The camper views the chat | No per-message น้องกองไฟ avatar sits beside the row; the bubble/notice fills the row's full width | The row's container drops `AiChatAvatar` and its `max-w-[85%]` cap becomes `w-full` | — (visual, owner staging verify) |
| AC-2 | The panel header, the CAM-425 resuming state, and the welcome/empty state | The camper opens/waits on/first sees the chat | The น้องกองไฟ mark still appears in exactly those three places, unchanged | `AiChatAvatar` usage count in the message list stays 2 (`size="lg"`, resuming + welcome); the header (`AiChatPanel.tsx`) is untouched | — |
| AC-3 | An answer entry has 1+ cards or follow-up chips | The camper views that answer | The card carousel and the chip row line up with the answer text's own left inset, with clear spacing above/below | Both get `pl-4` (matches the bubble's `px-4`); the answer's row gap is `gap-3` | — (visual, owner staging verify) |
| AC-4 | The camper asks the assistant to find a camp and `searchCampsites` returns 0 rows | The assistant replies | `t.aiChat.zeroResult` (`ยังไม่เจอที่ถูกใจเลย...`) shows under the answer | `searchAttempted:true` + `cards.length===0` -> `zeroResult:true` on the entry | EC-1 |
| AC-5 | The camper sends a greeting/FAQ/general question that never triggers `searchCampsites` | The assistant replies with 0 cards | No zero-result notice — just the model's own answer text | `searchAttempted` absent (or false) -> `zeroResult:false` even though `cards.length===0` | EC-1 |

## Rules
- BR-1 The wire response's `searchAttempted` field is additive and OPTIONAL (api.md rule 12) — present (`true`) only when `searchCampsites` was actually dispatched this turn; omitted for every other turn, so every existing fixture/consumer with no search stays byte-identical to the pre-CAM-430 body (same "absent means no signal" convention `suggestions`/`blocks`/`conversationId` already use on this same endpoint).
- BR-2 `searchAttempted` is tracked at the tool-dispatch layer (`lib/ai/openrouter-client.ts`'s `executeToolCalls`/`runTurnFromBaseMessages`) by comparing the dispatched call's name against the registered `searchCampsitesTool.name` — never a hardcoded string duplicated in two places.
- BR-3 `zeroResult` = `searchAttempted === true && cards.length === 0` — never `cards.length === 0` alone (the CAM-272 original gate, now superseded as the root cause of the bug).
- BR-4 The avatar removal + width/alignment changes are scoped to `AiChatMessageList.tsx` only; `AiChatCardCarousel.tsx`'s own internal `-mx-4/px-4` panel-edge-bleed mechanic is unchanged (the new `pl-4` wrapper shifts the settled card position without touching that file).

## Edge cases
- EC-1 IF `searchAttempted` is `true` AND `cards.length > 0` THEN `zeroResult` stays `false` (a successful search never shows the empty-search notice).

## Data
No schema/migration. `searchAttempted` is a derived, non-persisted boolean (computed per-turn from which tools ran) — never stored.

## Seams & refs
- Reuse: the exact "absent means no signal" wire convention already established for `suggestions` (CAM-410) and `blocks`/`conversationId` (CAM-420) on this same `/api/ai/chat` response — `searchAttempted` follows the identical pattern, not a new one.
- Refs: CAM-411 (per-row avatar, superseded) · CAM-409 (carousel container) · CAM-427 (`searchCampsites` tool, real card fields).
- Reader/writer sweep (architecture.md 15b): `AssistantTurnResult.searchAttempted` is read only by `app/api/ai/chat/route.ts`'s two branches (legacy + v2), both updated in this story; `AiChatOutcome.searchAttempted` is read only by `components/ai-chat/conversation.ts`'s `appendOutcome`, also updated here. No other reader exists (grepped `searchAttempted` across `app/`, `lib/`, `components/`).

## Out of scope
- Any change to `AiChatPanel.tsx`/`AiChatLauncher.tsx` (header, composer, launcher) — CAM-429's surface.
- A dedicated `isFree`/`priceCurrency` wire field (unrelated, tracked under CAM-428's out-of-scope note).

## Self-verify
- AC-1/AC-2 → source-inspection (`__tests__/cam-411-assistant-personality.test.ts` AC-3/BR-3/EC-1 block)
- AC-3 → source-inspection (`__tests__/cam-411-assistant-personality.test.ts`, `__tests__/cam-272-ai-chat-components.test.ts`)
- AC-4/AC-5 → unit (`__tests__/cam-272-ai-chat-conversation.test.ts` `appendOutcome` block — Prove-It: the pre-fix test asserted the bug's behavior and now asserts the corrected gate)
- Design gate: `check:ds` + `check:palette` green; no new token/component
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created, bundled into the CAM-428 PR per owner staging feedback
