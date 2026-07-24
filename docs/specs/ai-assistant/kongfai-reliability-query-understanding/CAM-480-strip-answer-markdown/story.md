---
linear: CAM-480
feature: ai-assistant
epic: kongfai-reliability-query-understanding
persona: camper
artifact: story
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-07-25
---
# The assistant's answer never shows raw markdown syntax (CAM-480)

<!-- Gate class: G2 = standard class (server-side output-hardening only, no new API contract/schema/screen) — no separate G2 tap. -->

## Story
As a **Camper**, I want the assistant's answer text to always read as clean plain prose, so that I never see broken-looking syntax (`![alt](url)`, `**text**`, a numbered list of camp names) in the chat panel.
Why: F2 production bug, confirmed via screenshots — gpt-4o-mini sometimes still emits markdown despite the CAM-405 prompt rule against it. `parseAnswer` (`components/ai-chat/answer-format.ts`) is a plain-text parser: it builds paragraph/list blocks from line-leading markers but never interprets markdown syntax, so a literal `![Songkhla Camp](https://images.unsplash.com/...)` or `**bold**` renders as ugly literal text. There was no server-side backstop; the prompt rule alone was not sufficient.
Scope: `lib/ai/sanitize.ts` (new pure helper `stripAnswerMarkdown`) + `lib/ai/openrouter-client.ts` (`finalizeAnswer` — apply the helper to the non-streaming answer, after suggestions are extracted, before the answer is returned). No change to the CAM-405 prompt rule itself, `extractSuggestions`, `parseAnswer`, or the streaming path.
Depends on: CAM-405 (the prompt rule this hardens) · CAM-410 (`extractSuggestions`, whose output this runs after) · CAM-439 (`parseAnswer`, the plain-text renderer this protects).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the model's completion contains an image markdown link (`![alt](url)`) anywhere in the answer text | the non-streaming turn finishes and `finalizeAnswer` builds the response | the camper never sees the literal `![...](...)` syntax or the image URL in the answer text | `answer` string has the image markdown removed entirely before being returned | EC-1 |
| AC-2 | the model's completion contains bold/italic markers (`**x**`, `__x__`, `*x*`, `_x_`) or a numbered/bulleted enumeration of camps | the non-streaming turn finishes and `finalizeAnswer` builds the response | the camper sees plain prose — the emphasized text with no `*`/`_` clutter, and no visible `1.`/`2)`/`-`/`*` list marker (result cards already show each camp) | `answer` string has emphasis markers unwrapped to their inner text and leading list/heading markers stripped, line by line | EC-2 |

## Rules
- BR-1 `stripAnswerMarkdown(text)` (exported, `lib/ai/sanitize.ts`) is a pure, idempotent, never-throwing function: image markdown removed entirely; link markdown `[text](url)` unwrapped to `text`; bold/italic (`**`/`__`/`*`/`_`) unwrapped to inner text; leading heading hashes (`#`–`######`) stripped; a leading list marker (`1.` `2)` `-` `*`, each followed by whitespace) at line start stripped. (proves AC-1/AC-2)
- BR-1a (QA adversarial re-verify, 2 defects fixed) Image/link parsing uses a hand-written bracket/paren-DEPTH scanner (`scanImagesAndLinks`/`scanBracketConstruct`), not a regex character class — a `)` nested inside the URL (e.g. a Wikipedia-style `Camp_(recreation).jpg` path) or a `]` nested inside the alt/link text no longer breaks the match or corrupts surrounding prose. A link's label is recursively re-scanned (depth-capped at `MAX_LINK_NESTING_DEPTH`) so an image nested inside a link (`[![a](img)](url)`) fully collapses. (proves AC-1/AC-2 hold under nested-punctuation input)
- BR-2 Processing is strictly line-by-line (split on `\n`, never a cross-line regex) so a multi-item list (`* item1\n* item2`) cannot have two separate lines' markers accidentally paired as one emphasis span. (proves AC-2, regression guard)
- BR-3 `finalizeAnswer` (`lib/ai/openrouter-client.ts`) calls `stripAnswerMarkdown` on the answer AFTER `extractSuggestions` has already removed the `<suggestions>` block, and BEFORE the answer is returned — covers every non-streaming caller (Path A/C). The streaming path (`runAssistantTurnFromMessagesStreaming`) is explicitly OUT of scope: it emits deltas live as they arrive, so a full mid-stream strip is a follow-up, noted in-code. (proves AC-1/AC-2 apply to the shipped non-streaming answer)
- BR-4 No internal whitespace collapse beyond trimming each line's own ends — an unrelated upstream artifact (e.g. `extractSuggestions`' own documented double-space left behind when it removes an inline `<suggestions>` block) must not be silently rewritten by this helper. (regression guard, keeps `cam-410-adversarial-seam.test.ts` intact)

## Edge cases
- EC-1 IF the answer text has no markdown at all THEN `stripAnswerMarkdown` returns it unchanged (BR-1) — a bare `(url)` with no preceding `[text]` is left alone (not a link)
- EC-2 IF the same text is passed through `stripAnswerMarkdown` twice THEN the second call returns the same result as the first (idempotent, BR-1) — running it is always safe, never doubly-mangles already-clean text

## Data
— n/a (pure string transform; no schema, route, or store change).

## Seams & refs
- Reuse: the existing `sanitize.ts` idiom (CAM-410's `sanitizeSuggestion` already strips markdown syntax markers for suggestion chips) — this story adds a sibling helper scoped to the fuller answer-text contract (image/link handling, line-anchored heading/list stripping), not a parallel sanitizer philosophy.
- Refs: CAM-405 (the prompt rule this hardens, not replaces) · CAM-410 (`extractSuggestions`, called immediately before this helper in `finalizeAnswer`) · CAM-439 (`parseAnswer`, the plain-text renderer whose "no markdown interpretation" contract motivates this fix).

## Out of scope
- The streaming path (`runAssistantTurnFromMessagesStreaming`) — a full mid-stream markdown strip is a follow-up ticket; the reported bug (F2) is the non-streaming panel answer.
- Changing the CAM-405 prompt rule itself — this is a server-side backstop on top of it, not a replacement.
- `lib/ai/tools/resolve-dates.ts` and `scripts/ai-eval/golden-cases.json` — owned by a parallel story in this same epic.

## Self-verify
- AC-1/BR-1 → unit (`__tests__/cam-480-strip-answer-markdown.test.ts`): a realistic polluted answer (image link + `**bold**` + numbered list) has no `![`, no `](`, no `**`, no leading `1.`/`-` after the strip; each markdown kind (image/link/bold/italic/heading/list marker) also covered in isolation.
- AC-2/BR-2 → unit: a two-line bulleted list (`* item1\n* item2`) loses only its own leading marker per line — no cross-line pairing corrupts either line's text.
- BR-3 → unit + integration read of `finalizeAnswer`'s call site (openrouter-client.ts): the helper runs after `extractSuggestions`, before return; existing `__tests__/cam-270-openrouter-client.test.ts` (plain-text answers) still passes unchanged.
- BR-4/EC-1 → unit: plain prose with no markdown is returned unchanged; a bare `(url)` in prose is left alone; `__tests__/cam-410-adversarial-seam.test.ts`'s documented double-space case still passes unchanged (regression guard).
- EC-2 → unit: calling `stripAnswerMarkdown` twice on its own output is a no-op (idempotent), and adversarial/malformed markdown-like input never throws.
- Gate = /quality-gate · Done = merge to `dev` + AC verified (unit-level, no live-model call) on localhost before merge; the model's actual on-topic emission behavior is confirmed by the owner's staging smoke.

## Changelog
- v1 (2026-07-25) — created (spec-first, template v2, terse per the spec-lite class).
- v2 (2026-07-25) — QA adversarial re-verify found 2 genuine defects (Critical: `)` nested in a URL corrupted surrounding prose; Important: `]` nested in alt/link text leaked raw markdown). Fixed by replacing the regex-based image/link strip with a hand-written bracket/paren-depth scanner (BR-1a); the 4 `it.fails()` repros now pass.
