---
linear: CAM-445
feature: ai-assistant
epic: chat-experience-overhaul
persona: camper
artifact: story
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# Resuming a persisted conversation re-renders answers exactly as they were answered (CAM-445)

<!-- Gate class: G2 = standard class (no new component/flow/token; data-shape fix only, `ChatMessage.blocks` already exists — no migration) — check:ds + check:palette green, no separate G2 tap. Bug-fix ticket (R3 owner feedback), not a new feature; spec-lite per discovery.md (single file-surface concern, no new API contract, no schema change). -->

## Story
As a **Camper**, I want a reopened conversation to look exactly like it did when the assistant answered it, so that I don't lose the structured list/campsite-card layout or see a false "no results" banner on my own past answers.
Why: R3 owner feedback — resuming a persisted conversation regressed three ways at once: (1) structured answers (headers/lists) render as one flattened run-on paragraph, (2) campsite cards the assistant showed are gone, (3) a `ยังไม่เจอที่ถูกใจเลย…` banner falsely appears on every restored answer.
Scope: `lib/ai/sanitize.ts` (new newline-preserving store sanitizer) · `app/api/ai/chat/route.ts` (use it for the answer + persist a `cards` block) · `lib/api-client.ts` (shared block-type constant + `extractCardsBlock`) · `components/ai-chat/conversation.ts` (`restoreEntriesFromMessages` maps the block back + never re-derives `zeroResult`). Forward-only: conversations already persisted before this fix stay flat/cardless (no backfill).
Depends on: CAM-414 (`ChatMessage.blocks` column, appendTurn/loadWindow support) · CAM-420 (ADR-013 D6, the `blocks[]` wire envelope + `normalizeBlocks`) · CAM-423 (`restoreEntriesFromMessages`) · CAM-439 (`parseAnswer` splits stored text on `\n`) · CAM-430 (`searchAttempted`/`zeroResult` semantics).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | a logged-in camper's assistant answer contained a numbered/bulleted list this turn | the camper closes and reopens the assistant panel (resume) | the restored answer still shows the list structure, not one run-on paragraph | the stored `ChatMessage.contentText` keeps its `\n` line breaks; `parseAnswer` rebuilds the same ordered/unordered blocks on resume | EC-1 |
| AC-2 | this turn's answer included campsite cards | the camper resumes the conversation | the same campsite cards reappear under the restored answer | the turn's cards persist as a `{type:'cards', v:1, data:[...]}` block on the `ASSISTANT` message; resume re-validates and maps it into `entry.cards` | EC-2 |
| AC-3 | any restored answer (with or without cards) | the camper resumes the conversation | `ยังไม่เจอที่ถูกใจเลย…` never appears on a restored answer | `zeroResult` on every restored entry is always `false` — it is a live-turn-only signal, never re-derived on resume | — |

## Rules
- BR-1 The assistant's answer is sanitized before storage with a NEWLINE-PRESERVING sibling of the existing prompt sanitizer (`sanitizeAnswerForStore`, `lib/ai/sanitize.ts`): same control-char strip + `<user_message>` delimiter fixpoint-strip + hard-strip backstop + length cap as `sanitizeForPrompt`, but collapses only horizontal whitespace per line and leaves `\n` intact. The camper's own question text (`userText`) is unchanged (still flattened) — this fix is scoped to the answer only. (proves AC-1)
- BR-2 A turn's rendered cards persist as one additive `blocks` entry `{type:'cards', v:1, data:AiChatCardResponse[]}` on the v2 (session-bound) path only, using the same `toWireCards` shape already sent to the client. Omitted (`undefined`) when the turn has no cards — an empty block is never stored. (proves AC-2)
- BR-3 On restore, `entry.cards` comes ONLY from a validated `cards` block (`extractCardsBlock`, `lib/api-client.ts`) — each entry is re-checked through `isAiChatCardResponse` (stored JSON is an input boundary); a malformed card is dropped, the rest of the array survives; never parsed back out of the answer text. (proves AC-2)
- BR-4 `zeroResult` on a restored answer is always `false`, regardless of whether a `cards` block is present — it is computed only on a live turn (`appendOutcome`, from that turn's own `searchAttempted` + `cards` result) and is never persisted, so it must never be re-derived from restored data. (proves AC-3)

## Edge cases
- EC-1 IF the stored answer has no `cards` block (a message persisted before this fix, or a turn with no cards) THEN it restores exactly as before — `cards: []`, no throw (BR-3)
- EC-2 IF a persisted `cards` block contains a malformed entry (fails `isAiChatCardResponse`) THEN that one entry is dropped and the well-formed siblings still restore, never a crash (BR-3)

## Data
- No schema change — `ChatMessage.blocks Json?` already exists (CAM-414); `appendTurn` already accepts an optional `blocks` input. This story only changes what gets WRITTEN into that existing column and how it is READ back. Migration: none.

## Seams & refs
- Reuse: `sanitizeForPrompt`'s control-char/delimiter-strip helpers (`stripControlChars`, `stripDelimiterTagsToFixpoint`, `DELIMITER_TAG_PREFIX_REGEX`) — the new sanitizer shares them, only the whitespace-collapse step differs · `toWireCards` (route.ts, CAM-427) — the SAME wire shape used for both the live response and the stored block · `normalizeBlocks` (`lib/api-client.ts`, CAM-420) — the one structural-validation pass every `blocks` payload goes through, on both the live-wire and the restore path · `parseAnswer` (`components/ai-chat/answer-format.ts`, CAM-439) — unchanged; this fix makes its `\n`-split input actually preserve structure.
- Refs: ADR-013 (persisted chat history + blocks envelope) · CAM-430 (`searchAttempted`/`zeroResult` semantics this story deliberately does NOT try to reconstruct on restore).

## Out of scope
- Backfilling `blocks`/newline structure onto conversations persisted before this fix (forward-only) → no follow-up ticket; explicitly accepted.
- Persisting/restoring `suggestions` (follow-up-question chips) → a later ticket if ever wanted.
- Re-deriving a resumed `zeroResult` from stored data (e.g. inferring "the original turn searched and found nothing") → deliberately out of scope (BR-4); the banner simply never shows on restore.

## Self-verify
- AC-1 → unit (`sanitizeAnswerForStore` newline preservation + security invariants unweakened) + integration (`sanitizeAnswerForStore` → `parseAnswer` round trip rebuilds the same list blocks) — `__tests__/cam-445-resume-render.test.ts`
- AC-2 → write side: route persists `{type:'cards',...}` only when cards are non-empty, omitted otherwise — `__tests__/cam-420-ai-chat-route-v2.test.ts`; read side: `extractCardsBlock` unit coverage — `__tests__/cam-420-api-client-blocks.test.ts`; `restoreEntriesFromMessages` maps the block into `entry.cards`, drops a malformed card — `__tests__/cam-423-ui-resume.test.ts`
- AC-3 → `restoreEntriesFromMessages` always yields `zeroResult:false`, with and without a cards block — `__tests__/cam-423-ui-resume.test.ts`
- Story-specific: security regression guard — the newline-preserving sanitizer still strips control chars + a forged `<user_message>` delimiter (incl. nested/overlapping fragments) + caps length, same as `sanitizeForPrompt`
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created (bug-fix ticket, root cause pre-investigated per R3 owner feedback; spec authored alongside the fix in the same PR per spec-lite class).
