---
linear: CAM-173
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: test
owner: qa-engineer
status: Backlog
version: v1
updated: 2026-06-25
---
# Test — ปรับ modal "ส่งมอบสำเร็จ" ให้เข้า design system + การ์ด list (CAM-173)

## AC→test matrix

| AC# | Test ID | Layer | Test file | Description | pass/fail |
|---|---|---|---|---|---|
| AC#1 (modal DS surface) | modal--map-delivery (source-inspect) | source-inspection | `__tests__/map-delivery.test.ts` | modal box has `bg-popover rounded-3xl shadow-2xl ring-1 ring-foreground/5` (no dark-glass rgba); overlay has `bg-foreground/15 backdrop-blur-sm` | PASS |
| AC#2 (card list) | modal--map-delivery (source-inspect) | source-inspection | `__tests__/map-delivery.test.ts` | each delivery item rendered in `<Card size="sm">` with `CheckCircle2` + `Badge variant="muted"` + `decodeHtmlEntities(item.title)` + Thai date; testid `modal--map-delivery` present; modal title "ส่งมอบสำเร็จ" verbatim; createPortal to body confirmed | PASS |
| AC#3 (entity decode) | `decodeHtmlEntities` (18 unit tests) | unit | `__tests__/html-utils.test.ts` | decodes `&quot;`→`"`, `&amp;`→`&`, `&lt;`→`<`, `&gt;`→`>`, `&#39;`→`'`, `&apos;`→`'`; empty passthrough; no-entity passthrough; order-safety `&amp;quot;`→`&quot;` (no double-decode); multiple entities; boundary (entity at start/end/only); error (unknown entity unchanged; malformed unchanged; partial no crash) | PASS |
| AC#4 (seen/close/reload) | source-inspection `handleClose` | source-inspection | `__tests__/map-delivery.test.ts` | `markSeen(ids)` + `setUnseen([])` present in `handleClose`; cross-tab `storage` event listener wired to `DELIVERY_SEEN_KEY`; `lib/map-delivery.ts` logic unchanged (zero git diff) | PASS |
| AC#5 (dark scene + responsive) | source-inspection a11y/no-CLS | source-inspection | `__tests__/map-delivery.test.ts` | `delivery-gift-wrapper` is `position:absolute` (no layout reflow); `.gift-indicator` retains 44px width/height; Button `size="icon"` (44px close button); no emoji in source; `prefers-reduced-motion` guards present; `unseenCount === 0` returns null | PASS |

### Regression guard (map-delivery.ts)

`lib/map-delivery.ts` — confirmed no git diff against `origin/staging` (file absent from `git status --short`). All 71 tests in `__tests__/map-delivery.test.ts` pass, confirming pure helpers, seen-set, pre-seed, and view-once logic are untouched.

## Validation cases (per AC)

### AC#3 — decodeHtmlEntities coverage matrix

| Case bucket | Example input | Expected output | Test name |
|---|---|---|---|
| normal — `&quot;` | `ปรับ &quot;modal&quot; ส่งมอบ` | `ปรับ "modal" ส่งมอบ` | `[normal] decodes &quot; to double-quote character` |
| normal — `&amp;` | `A &amp; B` | `A & B` | `[normal] decodes &amp; to ampersand` |
| normal — `&lt;` | `value &lt; 10` | `value < 10` | `[normal] decodes &lt; to less-than` |
| normal — `&gt;` | `value &gt; 5` | `value > 5` | `[normal] decodes &gt; to greater-than` |
| normal — `&#39;` | `it&#39;s a test` | `it's a test` | `[normal] decodes &#39; to apostrophe` |
| normal — `&apos;` | `it&apos;s a test` | `it's a test` | `[normal] decodes &apos; to apostrophe` |
| normal — multiple | `ชื่อ &quot;ดี&quot; &amp; สวยงาม &lt;3&gt;` | `ชื่อ "ดี" & สวยงาม <3>` | `[normal] decodes multiple entities in a single string` |
| **order-safety** | `&amp;quot;` | `&quot;` (NOT `"`) | `[normal] &amp; is decoded first — no double-decode of &amp;quot;` |
| real-world Linear title | `[frontend] ปรับ &quot;modal ส่งมอบสำเร็จ&quot; ให้เข้า design system` | `[frontend] ปรับ "modal ส่งมอบสำเร็จ" ให้เข้า design system` | `[normal] real-world Linear title with &quot; around a name` |
| null/empty — empty string | `""` | `""` | `[null/empty] returns empty string unchanged` |
| null/empty — no entity | `ส่งมอบสำเร็จ` | `ส่งมอบสำเร็จ` | `[null/empty] returns plain text with no entities unchanged` |
| boundary — entity only | `&quot;` | `"` | `[boundary] string with only an entity` |
| boundary — consecutive | `&lt;&gt;&amp;` | `<>&` | `[boundary] consecutive entities without spaces` |
| boundary — entity at start | `&quot;hello` | `"hello` | `[boundary] entity at the very start of the string` |
| boundary — entity at end | `hello&quot;` | `hello"` | `[boundary] entity at the very end of the string` |
| error — unknown entity | `&unknown;` | `&unknown;` | `[error/validation] unknown entity is left unchanged` |
| error — malformed (no semicolon) | `&amp` | `&amp` | `[error/validation] malformed entity (no semicolon) is left unchanged` |
| error — partial sequence | `&amp &quot` | `&amp &quot` | `[error/validation] partial entity sequence does not crash` |

### Source-inspection assertions (delivery-gift.tsx)

All assertions passed via `__tests__/map-delivery.test.ts` source-inspection suite:

- `data-testid="btn--map-delivery-gift"` present
- `data-testid="modal--map-delivery"` present
- `role="dialog"` + `aria-modal="true"` present
- Modal title `"ส่งมอบสำเร็จ"` verbatim in source
- `aria-label={COPY.indicatorLabel(unseenCount)}` on gift button
- `markSeen(ids)` + `setUnseen([])` in `handleClose`
- `if (unseenCount === 0) return null;` present
- `size="icon"` on close Button (44px tap target)
- `.gift-indicator` CSS with `width: 44px` / `height: 44px` retained
- `createPortal(` + `document.body` present
- `prefers-reduced-motion: no-preference` guards `giftFloat` + `giftGlow` animations
- `prefers-reduced-motion: reduce` → `animation: none` present
- `position: absolute` + `delivery-gift-wrapper` present (no-CLS)
- `Gift` from `lucide-react` (no emoji — `/[🎁🎉🎊]/u` absent)
- `e.key === "Escape"` + `onClose()` present (focus trap)
- `preSeed(allDoneIds)` + `!hasInitialized()` present (first-visit pre-seed)
- `window.addEventListener("storage", onStorage)` + `e.key !== DELIVERY_SEEN_KEY` present (cross-tab)
- `unseenCount > 9 ? "9+" : String(unseenCount)` present (badge cap)

### Dark-glass removal confirmation

Searched `delivery-gift.tsx` for `rgba(10,28,20`, `dark-glass`, `delivery-modal-close` — all absent. Modal surface is entirely Tailwind DS tokens.

## Coverage

### lib/html-utils.ts (new file — AC#3)

| Metric | Value |
|---|---|
| Statements | 100% (3/3) |
| Functions | 100% (2/2) |
| Lines | 100% (3/3) |
| Branches | 50% (1/2) — line 23 `?? match` fallback |

Branch note: the 50% branch on line 23 is the `?? match` right-hand side of the nullish coalescing operator in `HTML_ENTITIES[match] ?? match`. This branch is structurally unreachable — the regex `/&(?:amp|quot|lt|gt|#39|apos);/g` only matches entities that exist as keys in `HTML_ENTITIES`, so the lookup can never return `undefined`. The v8 coverage tool counts both sides of `??` as independent branches. This is a defensive coding guard, not a gap — no additional test is needed, and the coverage bar for this file's reachable code is 100%.

### Overall suite (real run — `npx vitest run --coverage`)

| Metric | Value |
|---|---|
| Test files | 45 passed |
| Tests | 2515 passed |
| Statements | 84.25% (1006/1194) |
| Branches | 75.31% (723/960) |
| Functions | 76.04% (127/167) |
| Lines | 86.28% (900/1043) |

New code files (`lib/html-utils.ts`, changes to `__tests__/html-utils.test.ts` + `__tests__/map-delivery.test.ts`) — all statements, functions, and lines at 100%; single unreachable branch as noted above. New-code coverage >=80% satisfied.

## Quality gate results

| Check | Result |
|---|---|
| `npm run lint` | 0 errors; 245 pre-existing warnings; 0 new warnings from CAM-173 code |
| `npm run typecheck` | Clean — 0 errors |
| `npm test` (2515 tests, 45 files) | All passed |
| `lib/html-utils.ts` statements/lines/functions | 100% |
| New-code coverage | >=80% |
| `lib/map-delivery.ts` unchanged | Confirmed — zero diff vs origin/staging |

## Links

- `story.md` (CAM-173) — AC and Rules
- `tech.md` (CAM-173) — implementation detail and quality gate log
- `__tests__/html-utils.test.ts` — 18 unit tests for `decodeHtmlEntities`
- `__tests__/map-delivery.test.ts` — 71 tests (logic + i18n verbatim + source-inspection)
- `lib/html-utils.ts` — `decodeHtmlEntities` pure util
- `app/status/map/delivery-gift.tsx` — rebuilt modal (DS tokens + Card list + entity decode)
- `.claude/rules/qa.md`

## Changelog

- v1 (2026-06-25) — created; AC#1–5 all mapped; 18+71=89 tests green; lib/map-delivery.ts regression confirmed
