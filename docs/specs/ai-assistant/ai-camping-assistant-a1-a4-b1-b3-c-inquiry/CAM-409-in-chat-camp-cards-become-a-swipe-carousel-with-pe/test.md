---
linear: CAM-409
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — In-chat camp cards become a swipe carousel with peek (CAM-409)

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (peek layout replaces stack) | H | unit (structural) | `__tests__/cam-409-ai-chat-card-carousel.test.ts` (BR-2 describe: `snap-x snap-mandatory`, `w-64 shrink-0 snap-start sm:w-60`, `-mx-4`/`px-4` bleed, `AiChatMessageList` delegates + old `space-y-3` stack gone) | ✅ pass |
| AC-1 | H | e2e (independent, ad-hoc Playwright, mocked `/api/ai/chat`, isolated port 3211) | Real render, desktop (1280×900, 384px panel) + mobile (390×844) viewports — measured card/track bounding boxes | ✅ pass — see empirical table |
| AC-2 (swipe/chevron snaps) | H | unit (structural) | same file, BR-3 describe: `disabled={atStart}`/`disabled={atEnd}`, `scrollByOneCard`, `track.scrollBy({left: direction*step})` | ✅ pass |
| AC-2 / EC-2 | H | e2e (independent Playwright) | clicked Next repeatedly on a real 4-card mock until `disabled`; measured `atStart`/`atEnd` at both ends | ✅ pass — 3 clicks to end, Prev/Next disable correctly at each end |
| AC-3 (a11y group + reachable links) | H | unit (structural) | same file, `role="group"`, `aria-roledescription`, `aria-label` (counted), not `aria-live`, indicator `aria-hidden` | ✅ pass |
| AC-3 | H | e2e (independent, `@axe-core/playwright`) | axe scan on the open chat panel with a 4-card carousel rendered | ✅ pass — 0 violations |
| AC-3 (keyboard) | M | e2e (independent Playwright) | real Tab traversal from composer; DOM `role`/`aria-roledescription`/`aria-label` read back from the live element | ✅ pass — see empirical table |
| AC-4 (tap-through) | L | — (reuse) | covered by CAM-272 AC-2 (card link unchanged); this story asserts no new write handler on the card wrapper | ✅ pass (structural, `not.toMatch(/fetch\(|POST/)`) |
| BR-1 / EC-1 (chrome gates on cards.length>1) | H | unit (structural) | 0-card `return null`; 1-card block asserted to exclude all 3 chrome test-ids | ✅ pass |
| BR-1 / EC-1 | H | e2e (independent Playwright) | real render with exactly 1 mock card | ✅ pass — no carousel/chevron/indicator test-ids present, single card full-width |
| BR-3 / EC-3 (reduced-motion) | M | e2e (independent Playwright, `reducedMotion` context option) | computed `scroll-behavior` on the track under `reduce` vs `no-preference` | ✅ pass — `auto` under reduce, `smooth` otherwise |
| BR-4 (copy verbatim) | H | unit | `cam-409-...test.ts` BR-4 describe — TH verbatim × 4 keys, EN non-empty parity, no em-dash, key-set match | ✅ pass |
| Regression guard (un-shrinkable track / atStart-atEnd off-by-one) | H | unit (structural) | `grid-cols-1 min-w-0` root; index derived from `scrollLeft - items[0].offsetLeft`, not a raw `scrollLeft<=1` | ✅ pass |
| CAM-272/407 grep-pins updated | M | unit (structural) | `cam-272-ai-chat-components.test.ts` — `cards={entry.cards}` forwarding, `grid ... grid-cols-1` row (not `flex-col`), single-card `w-full max-w-full`, peek width `w-64 ... sm:w-60` | ✅ pass — asserts updated, no weakened/removed cases found |

## Validation cases
Presentational-layout story — no new form/BR-n input validation. Per-BR coverage:
- BR-1 (chrome gating): 0 cards / exactly 1 card / >1 cards — all three states asserted (unit) + 1-card and 4-card states independently reproduced (e2e).
- BR-2 (card width/snap): on-scale widths asserted both as source strings and as **measured** rendered pixel widths (240px desktop / 256px mobile) matching `sm:w-60`/`w-64`.
- BR-3 (chevron disable + motion-safe): boundary-tested at both scroll ends (start/end) via real clicks, not just source assertion; reduced-motion boundary tested via a real computed-style read under both `prefers-reduced-motion` states.
- BR-4 (copy): verbatim TH asserted char-for-char against `locales/translations.json`; EN parity + key-set equality (no drift).
- EC-1/2/3: all three covered by a dedicated e2e reproduction, not source-inspection alone.

## Independent empirical verification (QA reproduction, real Chromium, zero spend)
Ran on an isolated dev server (`localhost:3211`, separate from the owner's main dev server on 3000), with `/api/ai/chat` intercepted via Playwright `page.route` — no request ever reached the real handler or OpenRouter, zero spend regardless of the worktree `.env`'s `OPENROUTER_API_KEY` state (sandbox denied editing `.env` directly; route interception achieves the same isolation at the network layer, before any server-side key use).

| Measurement | Value | Verdict |
|---|---|---|
| Desktop track width (1280×900 vp, 384px panel) | 382px | matches design.md ~384px panel |
| Desktop card width | 240px (`sm:w-60`) | matches BR-2 |
| Desktop cards visible w/ peek | 1 full + ~54% of card 2 ≈ **1.54 cards** | matches design.md "~1.6 visible" target, real "peek" affordance confirmed visually (screenshot) |
| Mobile track/card width (390×844 vp) | track 390px, card 256px (`w-64`) | matches BR-2 mobile dim |
| Mobile cards visible w/ peek | 1 full + ~52% of card 2 ≈ **1.52 cards** | matches design.md "~1.5 visible" target |
| Mobile page horizontal bleed | `document.documentElement.scrollWidth` (390) === `clientWidth` (390) | **no horizontal page bleed** |
| Prev/Next disabled at start (4-card mock) | Prev=disabled, Next=enabled | matches BR-3/EC-2 |
| Clicks to reach the end | 3 (index 0→3, 4 cards) | correct step count |
| Prev/Next disabled at end | Prev=enabled, Next=disabled | matches BR-3/EC-2 — confirms the snapped-index `atStart`/`atEnd` fix (not a raw `scrollLeft<=1` threshold, which the track's own `px-4` edge padding would break) |
| Keyboard Tab order (both chevrons enabled) | close → card₁ → card₂ → card₃ → card₄ → next (prev skipped, disabled) | correct — disabled chevron excluded from tab order, cards reachable in order |
| Tab-to-off-screen-card auto-scroll | track `scrollLeft` 16 → 530 after tabbing to card 4 | confirms native "focused card auto-scrolls into view" behavior (design.md a11y §Keyboard item 2); card 4 lands ~58% visible (native browser minimal-scroll-into-view, not full-edge-align) — **Info**, not a defect: AC-3/design.md require reachability + auto-scroll, not full-visibility-on-focus, and explicitly call the ArrowLeft/Right enhancement optional |
| `scroll-behavior` under `prefers-reduced-motion: reduce` | `auto` | confirms EC-3 — instant, no forced smooth scroll |
| `scroll-behavior` under `no-preference` | `smooth` | confirms `motion-safe:scroll-smooth` engages when motion is allowed |
| axe scan on open panel (4-card carousel) | **0 violations** | confirms a11y AA self-check (role/roledescription/label/contrast/name) |
| Group DOM attrs (live, not source) | `role="group"`, `aria-roledescription="carousel"`, `aria-label="4 recommended campsites"` | matches BR-4/AC-3, EN string confirmed live (TH verbatim already unit-tested) |
| 1-card render (EC-1, live) | no `carousel--ai-chat-cards`/`btn--ai-chat-cards-prev`/`-next`/`status--ai-chat-cards-position` in DOM; single card full-width | confirms BR-1/EC-1 behaviorally, not just by source grep |

### Scrollbar question (dispatch-specific, resolved)
The track's `no-scrollbar` class initially appeared undefined — no rule for it exists in `app/globals.css` or in the directly-grepped app/component tree. Traced the import chain: `app/globals.css` does `@import "shadcn/tailwind.css"`, and that package file (`node_modules/shadcn/dist/tailwind.css`) defines a real Tailwind v4 `@utility no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; &::-webkit-scrollbar { display: none; } }`. This compiles into the real build output (confirmed in `.next/static/chunks/*.css`) and was confirmed **live** in the browser: `getComputedStyle(track).scrollbarWidth === "none"` while `scrollWidth (1028) > clientWidth (382)` (i.e. genuinely scrollable, just not showing a native scrollbar) — visually confirmed in both desktop/mobile screenshots (no scrollbar track/thumb visible beneath the strip). **Verdict: `hidden` — a real, deliberate, cross-engine CSS mechanism (not an accidental "browsers hide it anyway"/overlay-scrollbar coincidence). No defect.**

## Coverage
Vitest v8 coverage on the two touched components (`AiChatCardCarousel.tsx`, `AiChatMessageList.tsx`) reports **0% / not instrumented** — this is the same pre-existing, documented characteristic as the CAM-272/CAM-407 suite: every `[structural]`/`[unit]` case in `cam-409-ai-chat-card-carousel.test.ts` and the CAM-409 additions to `cam-272-ai-chat-components.test.ts` does `readFileSync` on the component source and regex-asserts the exact class/wiring strings — the component is never `render()`-ed, so v8's execution-based instrumentation never fires for it. This is not a gap introduced by this story; it is the whole repo's established pattern for this feature area (see both files' header comments). Real behavior is instead proven by the independent Playwright reproduction above (real render + mocked-network Prove-It across 2 viewports + reduced-motion + axe + keyboard), which is stronger evidence for this presentational story than an executed-line percentage. Repo-wide coverage: not measured (out of scope for this verify pass).

## Defects found
None. Zero production defects surfaced by either the source-inspection suite or the independent empirical pass.

**Test-file nit fixed (in QA's own test-authoring remit, not production code):** `cam-409-ai-chat-card-carousel.test.ts` line 158 carried a stray `// eslint-disable-next-line no-misleading-character-class` that ESLint flagged as an *unused* directive (the emoji regex never actually triggers that rule) — 1 new warning vs the repo baseline. Removed the stray comment; `npm run lint` is back to the pre-existing 250-warning baseline (0 errors, same as before this story).

**Environment-only test failures (pre-existing, not caused by this story's diff):**
1. `__tests__/delivery-client.test.ts` — known env-dependent failure per the dispatch contract (`DELIVERY_DATABASE_URL` not set locally); explicitly flagged as "ignore, note in PR, do not chase."
2. `__tests__/f5-account-misc.test.ts` and `__tests__/f6-palette-guard.test.ts` — both assert `git diff staging --name-only` excludes `app/status/page.tsx`. Root-caused: this worktree's **local** `staging` branch ref is 154 commits behind `origin/staging` (`git rev-list --left-right --count staging...origin/staging` → `0  154`). Re-running the same assertion against the fresh ref (`git diff origin/staging --name-only`) shows the true 7-file story diff with no `app/status/page.tsx` present. This is a stale local-branch-ref artifact in the worktree, not a regression introduced by CAM-409 — confirmed the actual PR diff (`git diff origin/dev --name-only`) touches only the 7 files listed in this story's surface.

## Links
`story.md` (AC/BR) · `design.md` · `.claude/rules/qa.md`

## Changelog
- v1 (2026-07-18) — created (LIGHT-MEDIUM verify pass: AC/EC↔test map + independent empirical Playwright reproduction + scrollbar-question resolution)
