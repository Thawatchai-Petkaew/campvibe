---
linear: CAM-409
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-18
---
# Design — In-chat camp cards become a swipe carousel with peek (CAM-409)

> **G2 class: novel-ui** (new interaction pattern — horizontal snap-scroll
> carousel with peek + count indicator, inside the existing chat panel). Full
> design brief. DESIGN ONLY — Frontend builds from this; no new data/API.
>
> **Addendum to CAM-272.** This SUPERSEDES the CAM-272 design.md §"In-chat
> campsite card (K)" layout rule ("Cards render **stacked in a single column**
> (`space-y-3`)"). Everything else in the CAM-272 brief (the panel, the 6
> conversation states, security/plain-text, reuse of `CampgroundCard`,
> Discover-only) stands unchanged. Surface: `components/ai-chat/*`.

## User job (from AC)

A camper asked the assistant and got back several campsite cards. In the shipped
build those cards stack full-width and vertically, so one card fills the panel
and the camper must scroll a long way to compare options ("cards too big, one at
a time" — owner, 2026-07-18). The camper wants to **glance across the recommended
camps and swipe between them** without losing the answer above, then tap one
through to its detail page (unchanged, CAM-272 AC-2).

Owner picked **carousel with peek** (2026-07-18) over mini-rows and a grid.

## Flow

```
assistant turn (answer bubble)
  └─ ≥2 cards → horizontal snap-scroll strip (replaces the vertical stack)
       │  ~1.5 cards visible in the panel → the NEXT card peeks at the trailing
       │  edge = the "there is more, swipe" affordance
       ├─ swipe / drag  → native momentum + CSS snap to the next card
       ├─ chevron ‹ ›   → programmatic scroll one card (keyboard + non-touch)
       └─ count indicator (dots ≤5, else "{n}/{N}") tracks position
  └─ exactly 1 card → the single card, NO carousel chrome (no chevrons/indicator)
  └─ 0 cards → zero-result notice (CAM-272, unchanged — no carousel)
  tap a card → /campgrounds/{slug}  (CAM-272 AC-2, unchanged)
```

## What changes (delta vs CAM-272)

| CAM-272 (shipped) | CAM-409 (this story) |
|---|---|
| cards in a vertical column `space-y-3`, each full panel width | horizontal snap-scroll strip, each card `~240px`, ~1.5 visible with peek |
| navigate by scrolling the message log vertically | swipe / drag horizontally · chevron ‹ › · count indicator |
| no per-card-group a11y grouping | strip = a labelled `group` ("{N} recommended campsites"), cards stay tab-reachable links |

`AiChatCampCard` (the `CampgroundCard` compact wrapper) is **unchanged** — only
the container that lays the cards out changes. Recommend Frontend extract a small
`AiChatCardCarousel` client component fed `cards: AiChatCardResponse[]`; the
`entry.cards.length > 0` block in `AiChatMessageList.tsx` renders it instead of
the current `space-y-3` map.

## In-chat card — reuse contract (binding, unchanged from CAM-272)

- **Reuse `CampgroundCard` (compact variant) exactly** as the only card visual —
  no parallel card style (CAM-272 AC-1 "ใช้ CampgroundCard เดิม", reuse-not-
  reimplement CAM-249). The carousel changes layout only, never the card.
- **Card image aspect stays `aspect-square`** (what `CampgroundCard` renders
  today across catalog / wishlist / chat). See §"Image aspect" below — the
  delta's "4:3" is deliberately NOT forked here; flagged for the owner.
- Each card sits in a fixed-width track item; the card's own internal radius /
  typography / `tabular-nums` price / rating badge are untouched.

## Image aspect — design decision + flag (Important, not measured)

The ratified delta says "image 4:3". `CampgroundCard` renders `aspect-square`
everywhere (`components/CampgroundCard.tsx` L153). Honoring 4:3 **only in chat**
would fork the one shared card visual — the exact parallel-style drift CAM-249
(owner-flagged, ~4 fix rounds) and CAM-272 AC-1 forbid. The real complaint
("cards too big, one at a time") is solved by the horizontal-with-peek layout,
not by the image ratio.

**Design decision:** keep `aspect-square` (reuse wins). The carousel already
delivers the compactness 4:3 was reaching for. Do **not** improvise a 4:3 image.
If the owner still wants 4:3, that is a change to the shared `CampgroundCard`
(an `imageAspect` prop → Frontend/Architect surface, re-opens the divergence
question) — routed as a separate decision, not silently built here. Surfaced in
the handoff `needs_decision`.

## States (8) — the NEW interactive elements

New interactive/structural elements this story adds: **(T)** the scroll track ·
**(N)** the Prev/Next chevron buttons · **(I)** the count indicator
(presentational). **(K)** the card keeps all 8 states from CAM-272 (reused).

| State | Track (T) | Chevron ‹ › (N) | Indicator (I) |
|---|---|---|---|
| **default** | `flex gap-3 overflow-x-auto snap-x snap-mandatory`; first card aligned to the message column, next card peeking at the trailing edge | ghost icon-button `h-11 w-11 rounded-full`, lucide `ChevronLeft`/`ChevronRight` | dots (≤5 cards) or `{cur}/{N}` counter (>5), reflects the snapped card |
| **hover** | — (native scrollbar hidden; swipe/drag) | `hover:bg-accent` | — |
| **focus** | not a tab stop by default; cards + chevrons carry focus | visible `ring-ring` / `outline-ring/50` | — |
| **active** | snap engages on drag release | `active:scale-95` (transform) | active dot = `bg-primary` |
| **disabled** | — | Prev disabled at scroll-start, Next disabled at scroll-end → `disabled:opacity-50 disabled:pointer-events-none` | — |
| **loading** | **n/a** — cards arrive WITH the answer; no per-carousel loader (the turn-level typing indicator, CAM-272, covers the wait). No skeleton (a card strip has no pre-known count/layout to mirror — `.claude/rules/loading.md` matrix: content arrives with the response). | n/a | n/a |
| **empty** | 0 cards → no carousel (CAM-272 zero-result notice); **1 card → single card, no carousel chrome** | not rendered when ≤1 card | not rendered when ≤1 card |
| **error** | **n/a** at carousel level — a failed turn shows the turn-level `ErrorBanner` (CAM-272); a broken card image → `ImageWithFallback` placeholder (existing) | n/a | n/a |

## Layout, tokens & motion (per DESIGN.md §2 — no new token)

- **Track:** `flex gap-3 overflow-x-auto snap-x snap-mandatory` inside the
  assistant turn's `w-full max-w-full` cards row (CAM-407). Native scrollbar
  hidden (reuse the app's scrollbar-hide utility if present) — chevrons + peek +
  indicator are the affordances. Let the strip bleed to the panel edges
  (`-mx-4 px-4`, matching the message list `p-4`) so the trailing peek reaches
  the edge; the first card stays aligned to the message column.
- **Card width (scale utilities, not inline px):** `w-64 sm:w-60` — mobile bottom
  sheet ~256px (`w-64`), desktop 384px panel 240px (`sm:w-60`). Each item
  `snap-start shrink-0`. In the 384px panel → ~1.6 cards visible = peek; in the
  ~390px mobile sheet → ~1.5 visible = peek. ("~1.5 with peek" is the design
  requirement; `w-64/w-60` is the Frontend-tunable realization.)
- **Chevron buttons:** `Button variant="ghost"` icon-button `h-11 w-11
  rounded-full` (tap ≥44px), lucide `ChevronLeft`/`ChevronRight`. Control row
  BELOW the strip: `mt-2 flex items-center justify-center gap-2` → `[‹] [indicator] [›]`
  (avoids overlapping the narrow cards). Rendered only when `cards.length > 1`.
- **Indicator:** ≤5 cards → dots, each `h-1.5 w-1.5 rounded-full`, active
  `bg-primary`, inactive `bg-muted-foreground/30` (token + opacity, allowed).
  >5 cards → `{cur}/{N}` text, `text-xs text-muted-foreground tabular-nums`.
  Presentational, `aria-hidden="true"` (the count lives in the group label).
- **Tokens:** all existing — `primary` (active dot), `muted-foreground`
  (inactive dot / counter), `accent` (chevron hover), `ring` (focus). **No new
  token; `npm run check:palette` unaffected** (widths are scale utilities, not
  palette values).
- **Radius:** chevrons `rounded-full`; card radius untouched (reused).
- **Motion (DESIGN.md §2):** `motion-safe:scroll-smooth` on the track → chevron/
  arrow programmatic scroll animates ONLY when reduced-motion is off; native
  touch-swipe momentum is browser-native (user-driven, not an added animation);
  `active:scale-95` on chevrons (transform). No `transition: all`, no animated
  width/height. **prefers-reduced-motion → no smooth-scroll** (satisfied by
  `motion-safe:`). No JS animation library, no new dep.

## a11y (WCAG 2.1 AA per DESIGN.md §3)

- **Strip = a labelled group** (not `listbox` — the cards are LINKS to detail
  pages, not selectable options; `option`/`listbox` semantics would be wrong):
  `role="group"` + `aria-roledescription="แถบเลื่อนการ์ด"` (carousel) +
  `aria-label={t.aiChat.cardsLabel}` with the count → announces "{N} recommended
  campsites". (APG carousel pattern.)
- **Keyboard (baseline required):** (1) Prev/Next chevrons are Tab-reachable,
  Enter/Space scrolls one card — the required non-touch + keyboard affordance;
  (2) cards are native links — Tab moves between them and the focused card
  auto-scrolls into view + snaps. **Optional enhancement:** ArrowLeft/ArrowRight
  on the track (`tabindex=0`) scroll ±1 card — only add if it does not create a
  confusing extra tab stop; (1)+(2) is sufficient for full operability.
- **Tap target ≥44px:** chevron `h-11 w-11`.
- **Focus:** visible ring on chevrons and each card (reused).
- **Color-not-only:** navigation is by icon-buttons + swipe + peek, never color
  alone; the active dot is paired with the reachable-links group, not the sole
  signal.
- **No AT chattiness:** dots/counter are `aria-hidden`; the strip is NOT an
  `aria-live` region (the answer bubble already announced via the CAM-272
  `role="log"` — re-announcing every scroll would be noise).
- **Contrast:** active dot `bg-primary`, counter `text-muted-foreground` on the
  panel surface, chevron `foreground`/ghost — AA per DESIGN.md §2. **Composite
  (inactive dot `muted-foreground/30`) → verify with axe at build (not measured).**
- **Icons:** lucide only (`ChevronLeft`, `ChevronRight`) — DESIGN.md §7, no
  emoji.

## Copy (keys → verbatim TH / EN)

> Frontend adds these to `locales/` under the existing `aiChat` namespace
> (TH + EN) before any hardcoded string, in the build PR. No em-dash separator,
> no technical jargon (DESIGN.md §4).

| key | TH (verbatim) | EN |
|---|---|---|
| `aiChat.cardsLabel` | `ลานกางเต็นท์ที่แนะนำ {count} แห่ง` | `{count} recommended campsites` |
| `aiChat.cardsPrev` | `ดูลานก่อนหน้า` | `Previous campsite` |
| `aiChat.cardsNext` | `ดูลานถัดไป` | `Next campsite` |

The `{cur}/{N}` counter is a language-neutral numeral pair (`tabular-nums`),
`aria-hidden` — no separate copy string; its meaning is carried by
`aiChat.cardsLabel` on the group.

## Test IDs (`<type>--<module>-<detail>`)

`carousel--ai-chat-cards` (the track/group) · `btn--ai-chat-cards-prev` ·
`btn--ai-chat-cards-next` · `status--ai-chat-cards-position` (the indicator) ·
`card--ai-chat-campsite` (each item — **unchanged** from CAM-272, so existing
tests keep asserting it).

## Non-goals

- **No card redesign.** Only the layout container changes; `CampgroundCard`
  compact is reused as-is (image `aspect-square`, see §Image aspect).
- **No 4:3 image fork** in chat (would break the one-shared-visual rule) — routed
  as a separate owner decision, not built here.
- **No autoplay / auto-advance** — user-driven only (swipe/chevron); autoplay is
  a motion + a11y anti-pattern in a chat thread.
- **No clickable dots** — dots are presentational; chevrons + swipe navigate
  (keeps the surface lean).
- **No wishlist / booking / lead action in chat** — Discover-only stands
  (CAM-272). Tap a card → `/campgrounds/{slug}` only.

## Alternatives considered

- **Mini-rows (list of thin rows)** / **2-col grid** — rejected by the owner in
  favour of the carousel-with-peek (2026-07-18): peek gives the strongest
  "swipe for more" affordance in a narrow panel without shrinking each card to an
  unreadable thumbnail.
- **`role="listbox"` + `option` cards** — rejected: cards are navigation links,
  not single-select options; `group` + reachable links is the correct semantics.
- **Chevrons floating over the card edges** (like the catalog card carousel) —
  rejected: they collide with the ~240px card in a 384px panel; a control row
  below the strip is cleaner.
- **4:3 card image** (per delta) — set aside for the reuse rule; see §Image
  aspect (flagged to owner).

## Seams & coordination (Frontend)

- Recommend a new `components/ai-chat/AiChatCardCarousel.tsx` (client) consuming
  `cards: AiChatCardResponse[]`; `AiChatMessageList.tsx` swaps its current
  `space-y-3` cards block for it. `AiChatCampCard` unchanged.
- Scroll-position tracking (which card is snapped, at-start/at-end for chevron
  disabled): an `onScroll` handler comparing `scrollLeft` to item width, or an
  `IntersectionObserver` on the items — Frontend's choice; no new dep either way.
- No Architect involvement — `cards[]` payload (CAM-271) is unchanged.

## Design Gate self-check (this PR must pass — DESIGN.md §6)

- [ ] **Token-only** — no floating hex/px; `w-64/w-60/gap-3` are scale utilities;
      dots use `bg-primary` / `bg-muted-foreground/30`; `npm run check:palette` green.
- [ ] **Component-in-system** — `Button` (ghost icon) + reused `CampgroundCard` /
      `ImageWithFallback`; lucide `ChevronLeft`/`ChevronRight` only; no invented component.
- [ ] **Scale matches role** — chevrons `rounded-full h-11 w-11`; card radius untouched; no inline height override.
- [ ] **All 8 states** — T / N / I table above; K reused (CAM-272); 1-card and 0-card empties handled.
- [ ] **Loading (blocks PR)** — correct per matrix: NO loader/skeleton (cards arrive with the answer); turn-level typing indicator unchanged.
- [ ] **a11y AA** — `role="group"` + `aria-roledescription` + counted `aria-label`; chevrons named + Tab/Enter; cards Tab-reachable; tap ≥44px; visible focus ring; dots `aria-hidden`; not `aria-live`; axe clean (inactive-dot tint verified at build).
- [ ] **i18n** — `aiChat.cardsLabel/cardsPrev/cardsNext` TH + EN in `locales/`, no em-dash, no jargon; counter `tabular-nums`.
- [ ] **Motion** — `motion-safe:scroll-smooth` + `active:scale-95` (transform/opacity), 120–250ms class-driven, no `transition: all`; reduced-motion disables smooth scroll; no new dep.
- [ ] **Anti-slop (§5)** — teal POV; one dominant strip; reuses `CampgroundCard` (no parallel card style); peek is a functional affordance, not decoration.
- [ ] **Test IDs** — `carousel--ai-chat-cards` · `btn--ai-chat-cards-prev/next` · `status--ai-chat-cards-position` · `card--ai-chat-campsite` (unchanged).

## Links

CAM-272 `../../ai-assistant/ai-camping-assistant-a1-a4-b1-b3-c-inquiry/CAM-272-ai-chat-shows-campsite-cards-in-the-conversation-t/design.md` (the brief this extends) · `DESIGN.md` (§2 tokens · §3 components · §5 anti-slop · §6 gate · §7 icons) · `.claude/rules/loading.md` (cards-arrive-with-answer → no loader) · `story.md` · `components/CampgroundCard.tsx` · `components/ai-chat/AiChatMessageList.tsx` · `components/ai-chat/AiChatCampCard.tsx` · `components/ai-chat/conversation.ts` (`ChatEntry`/`AiChatCardResponse`)

## Changelog
- v1 (2026-07-18) — created (G2 novel-ui carousel addendum to CAM-272)
