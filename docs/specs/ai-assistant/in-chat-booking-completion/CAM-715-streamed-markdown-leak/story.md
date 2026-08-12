# CAM-715 — Streamed answers no longer leak raw markdown to the camper

version 1 · 2026-08-12 · spec-lite (S-class: no schema/API contract change, single file-surface, expected diff well under ~150 lines) · G1 folds into this PR's G3 packet per Gate policy v2

## Story

As a **camper**, I want the assistant's answer text to read as plain, clean Thai, so that I never see stray `**`/`*`/`` ` `` markdown symbols the assistant did not mean to show me.

Why: owner screenshot (2026-08-08) showed literal `**bold**` asterisks and raw numbered-list markers reaching the guest chat's screen on the STREAMING answer path. Root cause: `stripAnswerMarkdown` (`lib/ai/sanitize.ts`) only runs inside `finalizeAnswer` (`lib/ai/openrouter-client.ts`), which covers the non-streaming reply only — the streaming path (`runAssistantTurnFromMessagesStreaming`) emits raw model tokens live and was never covered, by that function's own docblock. Fixed CLIENT-side (not server) because: (1) it covers both the streaming and non-streaming paths uniformly with one change, (2) it stays outside `lib/ai/**` so the real-model guardrail gate does not fire on a pure-UI fix, and (3) streaming tokens cannot be reliably filtered server-side mid-stream without buffering, which would break the streaming UX. This does not weaken the CAM-405 plain-text prompt rule — it is defence for when the model disobeys it, exactly like the existing server-side `stripAnswerMarkdown` backstop.

Scope: `components/ai-chat/answer-format.ts` only (the `parseAnswer` client-side parser both `AiChatMessageList` entry kinds — `"streaming"` and `"answer"` — already call) + its test coverage. Depends on: CAM-439 (introduced `parseAnswer`) · CAM-480 (introduced the server-side `stripAnswerMarkdown` this fix mirrors the bounds of).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The model's streamed answer text contains `**ริมคลองร่มรื่นสระบุรี**` (owner's exact repro) | The chunk renders (streaming or settled) | ชื่อแคมป์แสดงเป็นข้อความล้วน ไม่มีเครื่องหมาย `**` ปรากฏให้เห็น เช่น "แนะนำ ริมคลองร่มรื่นสระบุรี ครับ" | `parseAnswer`'s paragraph/list-item text has the bold markers unwrapped to plain text before it reaches the DOM | EC-1 |
| AC-2 | The model's answer contains ordinary prose with a legitimate, unpaired asterisk (e.g. a footnote mark) | The answer renders | ข้อความยังคงเครื่องหมาย `*` ที่ไม่ได้จับคู่ไว้เหมือนเดิม ไม่ถูกลบทิ้ง | The bounded strip (mirrors `stripAnswerMarkdown`'s regex bounds) leaves an unmatched single marker untouched | — (bound-of-the-fix case, not a failure path) |
| AC-3 | The model's streamed answer contains a numbered list whose item text itself carries a bold camp name (e.g. `1. **ลานเอ** ราคา 300 บาท`) | The list renders as a real `<ol>` | รายการแสดงเป็นลำดับเดียว ไม่มีตัวเลขซ้ำซ้อนและไม่มีเครื่องหมาย `**` เช่น "ลานเอ ราคา 300 บาท" | The line's leading `1.` marker is consumed once, structurally, by the existing ordered-list regex; the bold strip runs on the captured item text only | EC-2 |

## Rules

- BR-1 `parseAnswer` strips `**bold**`, `__bold__`, `*italic*`, `_italic_`, and `` `code` `` markers from every block's text/items, mirroring `stripAnswerMarkdown`'s (`lib/ai/sanitize.ts`) bold/italic regex bounds exactly: each character class excludes `\n` (a match can never cross a line/list-item boundary) and bold is unwrapped before italic (a double-marker pair is never first mis-split by the single-marker pattern).
- BR-2 The strip never touches list-structure markers (`1.`/`2)`/`-`/`*`/`•` at a line's start) — those are already consumed structurally by `parseAnswer`'s existing `ORDERED_RE`/`UNORDERED_RE` before the emphasis strip ever runs, so no double-handling and no double-numbering.
- BR-3 `parseAnswer` remains pure string-in/string-out (BR-4 of the CAM-439 header docblock, unchanged) — no `dangerouslySetInnerHTML`, no markdown-to-HTML library, ever.

## Edge cases

- EC-1 IF the model emits an unmatched single `*`/`_` (no closing pair on the same line) THEN it survives unchanged — the bounded regex only unwraps a real pair, never a lone marker (proves AC-2, mirrors `stripAnswerMarkdown`'s own "lone unmatched marker" invariant).
- EC-2 IF a list item's captured text itself contains injected-looking markup (e.g. `<script>`) THEN it stays literal, inert text after the emphasis strip — the strip is a plain string replace, never markup construction (BR-3).

## Data

None. No schema/API change. Pure client-side string-transform fix.

## Seams & refs

Reuse: `lib/ai/sanitize.ts`'s `stripAnswerMarkdown` bold/italic regex bounds are the reference this fix mirrors (character-class-excludes-`\n`, bold-before-italic) — no parallel/divergent stripping logic invented. Refs: none (no ADR; this is a same-shape defect fix, not a new decision). Pins superseded with dated notes in the same PR (no assertion changes needed — neither pin exercises bold/italic/code fixtures): `__tests__/cam-439-answer-format.test.ts` (its header docblock recorded "inline emphasis out of scope" — now superseded) · `__tests__/cam-480-strip-answer-markdown.test.ts` (dated note clarifying it only ever pinned the server-side/non-streaming half of this gap). New coverage: `__tests__/cam-715-inline-emphasis-strip.test.ts`.

## Out of scope

- Image/link markdown (`![alt](url)` / `[text](url)`) on the streaming path — the owner's screenshot and this ticket's repro are bold/asterisk only; a client-side image/link scanner is a larger surface (bracket/paren-depth scanning, per `sanitize.ts`'s own `scanImagesAndLinks`) that was not observed leaking and is not requested here. → follow-up ticket if a future screenshot shows it.
- Heading markers (`#`/`##`) on the streaming path — not observed in the repro; `parseAnswer` has never rendered headings distinctly, and adding heading-strip is a broader change than this defect calls for. → follow-up ticket if observed.
- Any change to `lib/ai/**` or the CAM-405 prompt rule — this fix is a client-only mirror/backstop, not a prompt change.

## Self-verify

- AC-1..3 → unit (`__tests__/cam-715-inline-emphasis-strip.test.ts`), including the owner's exact repro string as a fixture.
- Story-specific: existing `cam-439-answer-format.test.ts` + `cam-480-strip-answer-markdown.test.ts` pins re-run green (dated-note only, no assertion changes needed) proving no regression to list-structure parsing or the server-side strip.
- Gate = `/quality-gate` (`npm run lint` · `npm run typecheck` · `npm test` · `npm run build`) + design gate (`check:ds` + `check:palette`, token-only — no new UI surface, pure logic change) · Done = every AC verified on localhost (dev DB) before merge.

## Changelog

- v1 (2026-08-12) — created
