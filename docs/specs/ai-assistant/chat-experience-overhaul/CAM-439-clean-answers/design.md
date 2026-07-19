---
ticket: CAM-439
feature: ai-assistant
epic: chat-experience-overhaul
persona: Camper
artifact: design
owner: frontend
status: implemented
version: v1
updated: 2026-07-19
---

# Design — Clean assistant answers (CAM-439, R2 owner staging feedback)

> Scope note: this story's design decisions were made by the Designer read-only pass (see
> `.claude/rules/loading.md`-adjacent scratchpad brief) inside the existing CAM-426 §2.1 exception — **no new
> token, no new component**. This file records the one binding token-usage decision for the answer row and the
> exact `DESIGN.md` amendment it requires (Designer/token-owner to land — Frontend does not edit `DESIGN.md`).

## 1) What changed and why

Owner staging feedback (R2): the `bg-ai-tint` container around every assistant answer read cluttered, and a
list-shaped answer (numbered steps / bulleted options) rendered as one run-on `<p>`, hard to scan.

**Before:** answer row = `rounded-2xl bg-ai-tint px-4 py-2.5 text-sm text-foreground` wrapping a single
`whitespace-pre-wrap` paragraph of `entry.text`.

**After:** answer row = `space-y-2 text-sm leading-relaxed text-foreground` — plain text directly on the panel's
own `bg-ai-surface` glass (no fill, no bubble padding). The text is split by `parseAnswer()` into typed blocks and
rendered as real `<p>`/`<ol>`/`<li>`/`<ul>` elements.

## 2) DESIGN.md §2.1 amendment (token-owner follow-up — Frontend does not edit DESIGN.md)

`DESIGN.md` §2.1 item 5 currently reads:

> 5. tint the assistant bubble with **`bg-ai-tint`** (`text-foreground`, ≥ AA) and the avatar flame with `text-ai-ember`;

Proposed amendment (exact wording to land, Designer/token-owner to apply):

> 5. tint **notice** rows (typing / rate-limited / disabled) with **`bg-ai-tint`** (`text-foreground`, ≥ AA); the
>    assistant **answer** itself renders as plain `text-foreground` directly on the panel's `bg-ai-surface` glass
>    (no per-answer tint — CAM-439, owner staging feedback); the avatar flame keeps `text-ai-ember`.

This is a usage-scope narrowing of an existing token (`bg-ai-tint` still exists, still used for notices), not a
new token or new component — flagged here per the dispatch contract for the token-owner's sign-off, not applied to
`DESIGN.md` by this story.

## 3) List rendering — token-only, no new component

| block type | element | classes |
|---|---|---|
| paragraph | `<p>` | `whitespace-pre-wrap` |
| ordered list | `<ol>` | `list-decimal space-y-1 pl-5 marker:text-muted-foreground` |
| unordered list | `<ul>` | `list-disc space-y-1 pl-5 marker:text-muted-foreground` |

All Tailwind structural utilities (`list-decimal`/`list-disc`/`pl-5`/`space-y-*`) and the existing
`--muted-foreground` token via `marker:text-muted-foreground` — no new token, no arbitrary value.

## 4) Spacing

The bubble's `px-4` inset is gone with the bubble itself, so the card carousel and the suggestion-chip group drop
their matching `pl-4` (added in CAM-430 only to line up with that inset) — everything now left-aligns at the
message log's own `p-4` edge. The answer grid keeps `gap-3` (unchanged, matches the log's inter-turn `gap-3`).

## 5) States (8) + a11y

| state | behavior |
|---|---|
| default | plain `text-foreground` answer, `leading-relaxed`; lists render as real `<ol>`/`<ul>` |
| empty | `zeroResult` copy unchanged, now in the shared `space-y-2` container (no `mt-1`) |
| loading | typing indicator keeps its `bg-ai-tint` chip, unchanged |
| error | `ErrorBanner` + retry, unchanged; rate-limited/disabled notices keep `bg-ai-tint` |
| hover/focus/active/disabled | N/A on plain answer text; card carousel + chips keep their own interactive states, unchanged |

**a11y:** `<ol>`/`<ul>`/`<li>` are semantic — screen readers announce "list, N items" instead of a run-on
paragraph. The log's `role="log" aria-live="polite" aria-relevant="additions"` contract is unchanged. Contrast:
`text-foreground` on `bg-ai-surface` is the same max-contrast token pair already used for the panel header/name on
this surface (AA by token parity) — **re-verified with axe by Frontend at merge, see checks in the PR** (not
independently tool-measured in this design pass).

## 6) Security (BR-4, Critical)

`parseAnswer()` returns strings only, never markup. The renderer maps each string to a React child (auto-escaped)
— a `<script>`/`<img onerror>` string in model text renders as literal, inert text. No `dangerouslySetInnerHTML`,
no markdown-to-HTML library, at the parser or the render site. See `components/ai-chat/answer-format.ts`'s own
header comment for the full note.

## 7) Gate checks (this story)

- `check:ds` / `check:palette` — green, no new token/component introduced.
- No new `--ai-*` token, no reuse of `bg-ai-tint`/`bg-ai-surface` outside the existing §2.1 scope.
- Screenshot-vs-brief / anti-slop: content leads, light chrome (bubble removed, structure via spacing not a new
  container); radius-by-role unaffected (no bubble = no `rounded-2xl` bubble radius to check here).

## Changelog
- v1 (2026-07-19) — created; records the answer-row token-usage change + the DESIGN.md §2.1 amendment for
  token-owner follow-up.
