## Story
As a **Camper**, I want น้องกองไฟ's answers to read as clean text (no cluttered container) and to see a numbered/bulleted answer rendered as a real list, so that I can read the assistant's reply comfortably instead of a boxed, run-on paragraph.
Why: R2 owner staging feedback — the `bg-ai-tint` container around every answer read cluttered, and list-shaped answers (steps/options) rendered as one run-on paragraph, hard to scan.
Scope: `components/ai-chat/AiChatMessageList.tsx` (answer row only — drop the bubble, render parsed blocks, drop the now-redundant `pl-4` on cards/chips) + new `components/ai-chat/answer-format.ts` (pure parser, no rendering). Does NOT touch `AiChatPanel.tsx`/`AiChatCardCarousel.tsx`/`AiChatCampCard.tsx` internals, the user bubble, or any notice row (typing/rate-limited/disabled/error) beyond removing their now-unneeded `pl-4` siblings.
Depends on: CAM-426 (`bg-ai-tint`/`bg-ai-surface` tokens, §2.1 exception) · CAM-430 (the `pl-4` alignment this story removes) · CAM-409 (card carousel, untouched internally).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | An assistant answer entry renders | The camper views the chat | The answer text sits directly on the panel's glass background (no boxed/tinted container around it) | The answer row's className drops `bg-ai-tint`/`rounded-2xl`/`px-4 py-2.5`, keeping `text-foreground` | — (visual, owner staging verify) |
| AC-2 | The typing indicator, the rate-limited notice, or the disabled notice renders | The camper views the chat | Those system notices still show inside their own tinted container, unchanged | Those three rows keep `bg-ai-tint`; only the answer row changes | — |
| AC-3 | น้องกองไฟ's answer text contains a numbered list (`1. …`/`2. …`) or a bulleted list (`- …`/`* …`/`• …`) | The camper views that answer | The list renders as a real numbered/bulleted list, not a run-on paragraph | `parseAnswer()` splits the text into typed blocks; the renderer maps each block to a semantic list/paragraph element | EC-1 |
| AC-4 | น้องกองไฟ's answer text has no list markers | The camper views that answer | The answer reads exactly as before — a plain paragraph | `parseAnswer()` returns one paragraph block; text is unchanged | — |
| AC-5 | The card carousel or the follow-up suggestion chips render under an answer | The camper views that answer | Cards/chips left-align with the answer text (no extra indent) | The `pl-4` on both wrappers is dropped (it existed only to match the now-removed bubble's inset) | — (visual, owner staging verify) |

## Rules
- BR-1 The answer row's container className becomes `space-y-2 text-sm leading-relaxed text-foreground` (plain text on the panel's `bg-ai-surface` glass) — no background fill, no bubble padding.
- BR-2 `bg-ai-tint` is retained on exactly 3 rows: typing indicator, rate-limited notice, disabled notice. `ErrorBanner` keeps its own destructive tint (unchanged, CAM-272).
- BR-3 `parseAnswer(text: string): AnswerBlock[]` classifies each line: ordered `/^\s*\d+[.)]\s+(.+)$/`, unordered `/^\s*[-*•]\s+(.+)$/`, blank line ends the currently-open block, anything else is a paragraph line. Consecutive lines of the same open type merge into one block (paragraph lines join with `\n` preserved; list lines of the same list type share one `items[]`).
- BR-4 (Critical, security) `parseAnswer` returns **strings only**, never markup — the renderer maps each string to a React child (auto-escaped). No `dangerouslySetInnerHTML`, no markdown-to-HTML library, at the parser or the render site.
- BR-5 Inline emphasis (`**bold**`, `*italic*`, `` `code` ``) is out of scope — left literal/inert in the rendered text (a follow-up ticket if ever wanted).

## Edge cases
- EC-1 IF an answer mixes a paragraph, then a list, then another paragraph THEN each becomes its own block in the original order (no lines dropped, no block merged across a type change).
- EC-2 IF the answer text is empty or whitespace-only THEN `parseAnswer` returns `[]` and the row renders no list/paragraph elements (the `zeroResult` notice, if present, still renders independently).
- EC-3 IF the model output contains an HTML-looking string (e.g. `<script>…</script>`, `<img onerror=…>`) THEN it renders as inert literal text in the DOM — never executes, never becomes markup (BR-4).

## Data
No schema/migration. `AnswerBlock[]` is a derived, non-persisted, per-render value (computed from the existing `entry.text` string) — never stored.

## Seams & refs
- Reuse: `parseAnswer` is the ONLY place that interprets `entry.text` structure; `AiChatMessageList` calls it once per answer row and never re-implements line classification inline. Cards still render exclusively from `entry.cards` (never parsed out of `text` — BR-4/EC-6 of CAM-272, unchanged).
- Refs: CAM-426 (§2.1 exception, `bg-ai-tint`/`bg-ai-surface` tokens) · CAM-430 (`pl-4` alignment, now superseded) · CAM-272 (original BR-4 plain-text contract, preserved not weakened).
- Reader/writer sweep (architecture.md 15b): `entry.text` is read only by `AiChatMessageList`'s answer/user rows (grepped `entry.text` across `app/`, `lib/`, `components/`); this story adds exactly one new reader (`parseAnswer`, called from the answer row) and removes none.

## Out of scope
- Inline emphasis (bold/italic/code) rendering — BR-5, follow-up ticket if wanted.
- The DESIGN.md §2.1 token amendment itself (Designer-owned — see this story's `design.md` for the exact wording to land).
- Any change to `AiChatPanel.tsx`, `AiChatCardCarousel.tsx`/`AiChatCampCard.tsx` internals, or the user-side bubble.

## Self-verify
- AC-1/AC-2/AC-5 → source-inspection (`__tests__/cam-272-ai-chat-components.test.ts`, `__tests__/cam-411-assistant-personality.test.ts`, `__tests__/cam-426-ai-expression-layer.test.ts` — updated in place, CAM-439 SUPERSEDES notes added)
- AC-3/AC-4/BR-3/BR-4/BR-5/EC-1/EC-2/EC-3 → real unit tests (`__tests__/cam-439-answer-format.test.ts`)
- Design gate: `check:ds` + `check:palette` green; no new token/component; token-only (space-y-*/pl-5/marker:text-muted-foreground)
- Gate = /quality-gate · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-19) — created, R2 owner staging feedback
