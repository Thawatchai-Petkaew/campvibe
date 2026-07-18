---
linear: CAM-272
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-18
---
# Design — AI chat shows campsite cards in the conversation (CAM-272)

> **G2 class: novel-ui** (new floating entry point + new overlay surface + new
> conversation states). Full design brief. DESIGN ONLY — Frontend builds the
> components from this brief; Architect owns the `cards[]` payload + the chat
> endpoint (CAM-271).

## User job (from AC)

A camper on the Home page wants to ask the assistant, in plain Thai, to find a
campsite ("หาที่แคมป์ติดน้ำ หมาเข้าได้"), see the answer **plus real campsite
cards inside the chat**, and tap a card through to that camp's detail page to
continue the normal booking flow. Discover-only: **no booking / no lead / no
write action happens inside the chat** (superseded scope — see Non-goals).

## Flow

```
Home page
  └─ Floating launcher (bottom-right, always visible on Home)
       └─ tap → chat panel opens
            ├─ desktop (≥ sm): anchored floating card, bottom-right (~384px wide, viewport-bounded height)
            └─ mobile (< sm): full-width bottom sheet (tall, ~85% of screen)
       ┌─────────────── panel ───────────────┐
       │ header: title + close (44px)         │
       │ message log (aria-live, scrolls)     │
       │   • welcome/empty → suggested prompts │
       │   • user bubble (right) / assistant   │
       │     bubble (left)                     │
       │   • assistant turn = plain-text answer│
       │     + 0–10 in-chat campsite cards     │
       │   • typing indicator while awaiting   │
       │   • error / rate-limit / disabled     │
       │     / zero-result notices             │
       │ composer: textarea + send (pinned)    │
       └──────────────────────────────────────┘
  tap a campsite card → /campgrounds/{slug}  (existing detail → booking flow, AC-2)
  Esc / close / tap-scrim(mobile) → panel closes, focus returns to launcher
```

Data path (security): the panel is a client component that POSTs the question
to the chat endpoint (CAM-271) through the `lib/api-client` facade and receives
`{ answer, cards }`. The client **never** calls the model directly (no secret in
the bundle, no SSRF). `answer` is a plain string; `cards` is `CampCardPayload[]`.

## States (8) — every interactive element

Interactive elements: **(L)** launcher FAB · **(C)** composer textarea · **(S)**
send button · **(P)** suggested-prompt pills · **(K)** in-chat campsite card.

| State | Launcher (L) | Composer (C) | Send (S) | Suggestion pill (P) | Card (K) |
|---|---|---|---|---|---|
| **default** | teal filled `h-12 w-12 rounded-full`, `Sparkles` icon, `shadow-lg shadow-primary/20` | `Textarea` `rounded-3xl`, placeholder copy, 1 row | `h-11 w-11` icon-button, `Send`, `bg-primary` | outline pill `rounded-full` `size="sm"` | reuse CampgroundCard (compact) |
| **hover** | `hover:scale-105` (transform) + slightly raised | border → `ring`-tinted | `hover:bg-primary/90` | `hover:bg-accent` | `group-hover` image `scale-105` (existing) |
| **focus** | visible `ring-ring` ring, `outline-ring/50` | visible ring on the field | visible ring | visible ring | visible ring on the card link |
| **active** | `active:scale-95` | — | `active:scale-95` | `active:scale-95` | link press (native) |
| **disabled** | never disabled (see disabled-assistant notice below) | disabled + dimmed while a turn is in flight OR assistant disabled | `disabled:opacity-60`, un-clickable while awaiting / when composer empty | disabled while a turn is in flight | n/a |
| **loading** | — | stays visible, disabled | inline `LoadingSpinner size="sm"` replaces the `Send` glyph; row shows typing indicator (below) | — | n/a (cards arrive with the answer, no per-card loader) |
| **empty** | — | — | — | **welcome/empty state** = heading + suggested prompt pills (below) | **zero-result** notice (below) |
| **error** | — | field stays usable to retry | — | — | **error / rate-limit / disabled** notices (below) |

### Conversation-level states (verbatim copy in §Copy)

- **welcome / empty** (`empty--ai-chat-welcome`): shown when the thread has no
  messages. A short heading + 3 tappable suggested-prompt pills (P), including
  `หาที่แคมป์ติดน้ำ หมาเข้าได้`. Tapping a pill sends it as the user's message.
- **typing / loading** (`status--ai-chat-typing`): while awaiting the turn,
  render an **assistant-side bubble with three pulsing dots** (opacity pulse,
  disabled under `prefers-reduced-motion`) + the send button shows an inline
  spinner and is disabled. **No skeleton** — per `.claude/rules/loading.md`
  decision matrix this is a *user-action async on a control* → inline indicator
  on the control + an inline typing indicator, never a skeleton (a chat thread
  has no predictable layout to mirror). `aria-live="polite"` announces
  `ผู้ช่วยกำลังพิมพ์…`.
- **zero-result** (`empty--ai-chat-zero-result`): the turn succeeded but
  `cards` is `[]` and the answer found nothing → the answer bubble plus the
  copy `ยังไม่พบลานที่ตรงกับที่ค้นหา ลองปรับเงื่อนไขดูนะ`. No cards rendered
  (AC-3).
- **error** (`error--ai-chat`): the turn failed (`ok:false` / non-2xx from
  CAM-271) → reuse **`ErrorBanner`** (`components/ui/error-banner.tsx`,
  destructive tone, `AlertCircle`) rendered as an assistant turn with the copy
  `ผู้ช่วยขัดข้อง กรุณาลองใหม่อีกครั้ง`, followed by a `ลองใหม่`
  (`Button variant="outline" size="sm"`) that re-sends the last question (AC-4).
- **rate-limited** (`error--ai-chat-ratelimited`): HTTP 429 from CAM-271 →
  assistant-side **muted bubble** with a `Clock` icon in `text-warning` + the
  copy `มีคำถามเข้ามามากเกินไป กรุณารอสักครู่แล้วลองใหม่`. Warning (not
  destructive) tone = temporary. No auto-retry; the user waits and re-sends.
- **assistant-disabled** (`info--ai-chat-disabled`): the turn returns
  `skipped:true` (OPENROUTER key off, AC-5 in the AI backend) → assistant-side
  muted bubble with an `Info` icon in `text-muted-foreground` + the copy
  `ผู้ช่วยยังไม่เปิดใช้งาน`; the composer is disabled. The launcher still
  renders so the state is reachable and honest.

## In-chat campsite card (K) — reuse contract

- **Reuse `components/CampgroundCard.tsx`** (AC-1: "ใช้ CampgroundCard เดิม") —
  do **not** build a parallel card style (reuse-not-reimplement, CAM-249).
- **Compact variant, no chat-side actions.** The chat card must NOT show the
  wishlist heart or the image-carousel arrows — those are actions/mutations,
  and chat is discover-only (delta: "NO booking/lead actions in chat").
  → **Recommended:** add a `variant?: "default" | "compact"` (or a
  `hideWishlist`/`hideCarousel` boolean pair) prop to CampgroundCard that, in
  the chat variant, hides the heart button + carousel arrows and keeps the same
  visual language (image radius `rounded-3xl`, name/province/price/rating
  typography, `tabular-nums` price). This keeps **one component** and satisfies
  AC-1. Frontend decides prop vs thin wrapper; the requirement is: one shared
  visual, zero parallel styles.
- Cards render **stacked in a single column** (`space-y-3`) inside the assistant
  turn (the ~384px panel is too narrow for the catalog grid).
- Each card is a link to `/campgrounds/{slug}` (AC-2). **Max 10 cards** — the
  backend already caps at `SEARCH_CAMPSITES_MAX_RESULTS = 10`; the UI renders
  whatever `cards[]` contains, no client-side slicing needed.

## Security (binding — Critical gate items)

- The assistant **`answer` renders as PLAIN TEXT only** — a text node with
  `whitespace-pre-wrap` to preserve newlines. **No `dangerouslySetInnerHTML`,
  no markdown-to-HTML, no HTML injection.** (delta SECURITY)
- **Cards come only from the structured `cards[]` payload** — never parsed or
  scraped out of the `answer` string.
- Model output is untrusted (`.claude/rules/security.md` §6): the panel treats
  `answer` as data to display, never as instructions.

## Validation UX

No form fields with validation rules in this story (the composer is free text;
`story.md` has no `BR-n` field-validation entries). The only input rule: the
send button is disabled when the composer is empty/whitespace-only (a client-
side guard, not a user-facing error message). The untrusted-text sanitize +
2000-char cap is enforced server-side (`lib/ai/sanitize.ts`), not surfaced as a
UI validation error.

## Components & tokens

**Components (from `components/ui/*` + `components/*` — no invention):**

| Job | Component | Notes |
|---|---|---|
| Launcher FAB | `Button` (size `lg`, `h-12 w-12 rounded-full`) | idiom from `components/HostOnboardingFab.tsx` (`fixed bottom-6 right-6 z-50`) |
| Mobile overlay | `Sheet` `side="bottom"` | `bg-popover`, built-in focus-trap + scroll-lock + Esc + `aria-modal` |
| Desktop overlay | anchored `Card` panel via `Dialog` (repositioned bottom-right, light/no scrim) | reuse `Card` `rounded-3xl` + `shadow-2xl`; focus-trap via `lib/hooks/use-modal-a11y.ts` (reuse, don't hand-roll — CAM-368) |
| Panel header | `ModalHeader` (`components/ui/modal-shell.tsx`) | centered title + 44px close; or a lean header band with the same 44px close |
| Message scroll region | `ScrollArea` | `flex-1 min-h-0` so the composer stays pinned |
| Composer | `Textarea` (`rounded-3xl`, auto-grow 1–4 rows) | Enter = send · Shift+Enter = newline |
| Send | `Button` icon-button (`h-11 w-11 rounded-full`, `variant="default"`) | lucide `Send`; inline `LoadingSpinner size="sm"` while awaiting |
| Suggested prompts | `Button variant="outline" size="sm"` `rounded-full` | actions, not filters → not `FilterChip` |
| In-chat card | `CampgroundCard` (compact variant) | see reuse contract above |
| Error notice | `ErrorBanner` | destructive tone, reused as an assistant turn |
| Typing / rate-limit / disabled | assistant-side muted bubble + lucide icon | color paired with icon+text (a11y color-not-only) |

**Tokens (all existing — no new token):**

| Token | Use |
|---|---|
| `primary` / `primary-foreground` | launcher, send button, user message bubble |
| `muted` / `foreground` | assistant bubble surface + text; typing/rate-limit/disabled bubbles |
| `card` | desktop panel surface (`rounded-3xl`) |
| `popover` | mobile Sheet surface |
| `destructive` (via `ErrorBanner` `bg-destructive/2 …`) | hard-error notice |
| `warning` (`text-warning`) | rate-limited notice icon |
| `info` / `muted-foreground` (`text-info` / `text-muted-foreground`) | assistant-disabled notice icon |
| `border` / `ring` | panel/bubble borders + focus ring (`outline-ring/50`) |

**Radius / size / spacing (per DESIGN.md §2):** launcher + send `rounded-full`;
panel + desktop card + textarea `rounded-3xl`; message bubbles `rounded-2xl
px-4 py-2.5`; suggestion pills `rounded-full`; close `h-11 w-11`; panel width
`w-full sm:w-96` (~384px, on-scale); panel/sheet height bounded to the viewport
via a flex column (ScrollArea `flex-1`) — a `max-h-[..dvh]` layout constraint is
acceptable (it is a responsive container height, not a palette/px design token,
so `check:palette` is unaffected).

**Motion (DESIGN.md §2):** launcher `hover:scale-105` / `active:scale-95`;
panel entrance + bottom-sheet slide use the `Sheet`/`Dialog` built-in
transform+opacity animations (120–250ms); typing dots pulse via opacity — all
disabled under `prefers-reduced-motion`. No `transition: all`.

## a11y (WCAG 2.1 AA per DESIGN.md §3)

- **Launcher**: `aria-label="เปิดผู้ช่วยหาที่กางเต็นท์"` / EN `Open camping
  assistant`; `h-12 w-12` ≥ 44px tap target.
- **Panel**: `role="dialog"` + `aria-label="ผู้ช่วยหาที่กางเต็นท์"`; **focus
  trap** while open (mobile via Sheet/Radix Dialog, desktop via `useModalA11y`);
  **Esc closes**; on open focus moves into the panel (composer), on close focus
  **returns to the launcher** (`useModalA11y` restore-to-trigger).
- **Message log**: `role="log"` + `aria-live="polite"` + `aria-relevant="additions"`
  so each new assistant turn is announced without interrupting; `aria-busy`
  toggles true while awaiting; `กำลังโหลด…`/`ผู้ช่วยกำลังพิมพ์…` announced via a
  polite status line (`.claude/rules/loading.md` §5).
- **Send / close / suggestions**: every control has an accessible name; close
  `aria-label="ปิด"`; send `aria-label="ส่งคำถาม"`.
- **Color-not-only**: error = icon + text (destructive), rate-limit = `Clock` +
  text (warning), disabled = `Info` + text — state is never color alone.
- **Contrast**: token pairs `primary/primary-foreground`, `muted/foreground`,
  `ErrorBanner` destructive tint (AA-fixed, CAM-261) are AA per DESIGN.md §2/§3.
  Composite tints (`text-warning` icon on `bg-muted`, `text-info` on `bg-muted`)
  → **verify with axe at build (not yet measured)**.
- **Icons**: lucide only (`Sparkles`, `Send`, `AlertCircle`, `Clock`, `Info`) —
  no emoji (standing owner rule).

## Test IDs (`<type>--<module>-<detail>`)

`btn--ai-chat-launcher` · `dialog--ai-chat-panel` · `btn--ai-chat-close` ·
`log--ai-chat-messages` · `input--ai-chat-composer` · `btn--ai-chat-send` ·
`btn--ai-chat-suggestion` · `msg--ai-chat-user` · `msg--ai-chat-assistant` ·
`status--ai-chat-typing` · `card--ai-chat-campsite` (or reuse CampgroundCard's
`btn--wishlist-toggle` is absent in compact) · `empty--ai-chat-welcome` ·
`empty--ai-chat-zero-result` · `error--ai-chat` · `error--ai-chat-ratelimited` ·
`info--ai-chat-disabled`.

## Copy (keys → verbatim TH / EN)

> Frontend adds these to `locales/translations.json` under a new `aiChat`
> namespace (TH + EN) **before** any hardcoded string, in the build PR.
> `design.md` is the verbatim source of truth. No em-dash separator, no
> technical jargon (DESIGN.md §4).

| key | TH (verbatim) | EN |
|---|---|---|
| `aiChat.launcherLabel` | `เปิดผู้ช่วยหาที่กางเต็นท์` | `Open camping assistant` |
| `aiChat.title` | `ผู้ช่วยหาที่กางเต็นท์` | `Camping assistant` |
| `aiChat.close` | `ปิด` | `Close` |
| `aiChat.composerPlaceholder` | `พิมพ์คำถามเกี่ยวกับลานกางเต็นท์…` | `Ask about campsites…` |
| `aiChat.send` | `ส่งคำถาม` | `Send` |
| `aiChat.typing` | `ผู้ช่วยกำลังพิมพ์…` | `Assistant is typing…` |
| `aiChat.loading` | `กำลังโหลด…` | `Loading…` |
| `aiChat.welcomeHeading` | `ถามผู้ช่วยหาที่กางเต็นท์ได้เลย` | `Ask the assistant to find a campsite` |
| `aiChat.suggestion1` | `หาที่แคมป์ติดน้ำ หมาเข้าได้` | `Find a riverside camp that allows dogs` |
| `aiChat.suggestion2` | `ลานใกล้เชียงใหม่ งบไม่เกิน 1500 บาท` | `Camps near Chiang Mai under 1,500 baht` |
| `aiChat.suggestion3` | `ที่กางเต็นท์สำหรับครอบครัว มีห้องน้ำสะอาด` | `Family campsites with clean bathrooms` |
| `aiChat.zeroResult` | `ยังไม่พบลานที่ตรงกับที่ค้นหา ลองปรับเงื่อนไขดูนะ` | `No campsites match yet. Try adjusting your search.` |
| `aiChat.error` | `ผู้ช่วยขัดข้อง กรุณาลองใหม่อีกครั้ง` | `The assistant is unavailable. Please try again.` |
| `aiChat.retry` | `ลองใหม่` | `Try again` |
| `aiChat.rateLimited` | `มีคำถามเข้ามามากเกินไป กรุณารอสักครู่แล้วลองใหม่` | `Too many questions right now. Please wait a moment and try again.` |
| `aiChat.disabled` | `ผู้ช่วยยังไม่เปิดใช้งาน` | `The assistant is not available yet.` |

## Error pattern

Conversational, not a form. Hard failure → reuse `ErrorBanner` (destructive)
rendered inline as an assistant turn + a `ลองใหม่` retry button. Temporary
throttle (429) → a warning-tone muted bubble (no retry button). Both live inside
the message log, never as a page-level overlay (this is not the top-of-form
`ErrorBanner` server-error case).

## Non-goals

- **No write action in chat.** The ticket's original AC and a later ADR-011
  comment routed the card CTA to a HostLead inquiry form; the ratified AUTO-mode
  delta for this story is **discover-only** — the card links to
  `/campgrounds/{slug}` and stops there. No lead form, no booking, no compare /
  trip-planner UI (out of scope → Phase later).
- **No full assistant page.** The launcher + panel are the only surface. Design
  the panel as self-contained (thread + composer subcomponents) so a future
  `/assistant` full page can reuse them — but do NOT design that page now (seam
  noted, nothing built).

## Alternatives considered

- **Desktop as a full-height right `Sheet` (side="right")** — rejected: the
  owner intent is a "ช่อง chat ล้ำๆ" floating anchored slot (Intercom-style),
  not a full-height rail. Anchored bottom-right `Card` matches the intent and
  reuses `Card` + `Dialog` without a full-height takeover.
- **Hiding the launcher when the assistant is disabled** — rejected: the spec
  requires a reachable, honest `assistant-disabled` state; a hidden FAB would
  make that copy unreachable. The launcher stays; the disabled notice shows on
  open.

## Seams & coordination (for Frontend / Architect)

- **`cards[]` type ↔ CampgroundCard props.** `CampCardPayload`
  (`lib/read-models/camp-card.ts`) is a narrower `select` than CampgroundCard's
  `CampSite & {…}` prop type (it intentionally omits non-rendered scalars).
  Reconciling the prop type (widen CampgroundCard's prop to the card read-model,
  or map at the boundary) is a **Frontend/Architect** typing decision — not a
  design decision. Flagged here so it isn't missed.
- **Launcher stacking with `HostOnboardingFab`.** Both sit at
  `fixed bottom-6 right-6 z-50` on Home for a logged-in non-host. **Important:**
  they must not overlap — recommend the chat launcher owns the corner and the
  Host FAB stacks above it (e.g. `bottom-24`), or vice-versa. Frontend resolves
  the offset; the design requirement is: no visual collision.

## Design Gate self-check (the checklist this PR must pass — DESIGN.md §6)

- [ ] **Token-only** — no floating hex/px; `npm run check:palette` green (viewport `max-h` layout constraint is not a palette value).
- [ ] **Component-in-system** — `Sheet`/`Dialog`/`Card`/`Textarea`/`Button`/`ScrollArea`/`ErrorBanner`/`ModalHeader`/`CampgroundCard` reused; lucide icons only; no invented component.
- [ ] **Scale matches role** — `rounded-full` (launcher/send/pills), `rounded-3xl` (panel/card/textarea), `rounded-2xl` (bubbles); no inline height override.
- [ ] **All 8 states** present for L/C/S/P/K + the 6 conversation states.
- [ ] **Loading (blocks PR)** — inline typing indicator + send spinner (correct loader per matrix, NOT a skeleton); `aria-busy` + `role="log"`+`aria-live="polite"` + `กำลังโหลด…`; shimmer/dots disabled under `prefers-reduced-motion`.
- [ ] **a11y AA** — focus trap + Esc + focus-return; every control named; visible focus ring; tap ≥ 44px; color-not-only on all notices; axe clean (composite tints verified at build).
- [ ] **i18n** — all copy in `locales/` (`aiChat.*`) TH + EN, no em-dash separator, no jargon.
- [ ] **Security** — answer is plain text (no `dangerouslySetInnerHTML`/markdown-HTML); cards only from `cards[]`.
- [ ] **Motion** — transform/opacity only, 120–250ms, respects reduced-motion.
- [ ] **Anti-slop (§5)** — teal POV, one dominant surface, no gradient/heavy-shadow stack, reuses CampgroundCard (no parallel card style).
- [ ] **Test IDs** — `<type>--<module>-<detail>` per §Test IDs.

## Links

`../../feature.md` (## Design overview) · `DESIGN.md` (§2 tokens · §3 components · §5 anti-slop · §6 gate) · `.claude/rules/loading.md` (inline-indicator row) · `.claude/rules/security.md` §6 · `story.md` · `components/CampgroundCard.tsx` · `components/HostOnboardingFab.tsx` · `components/ui/error-banner.tsx` · `components/ui/sheet.tsx` · `lib/hooks/use-modal-a11y.ts` · `lib/read-models/camp-card.ts` · `lib/ai/openrouter-client.ts` (`AssistantTurnResult` shape) · CAM-271 (chat endpoint)

## Changelog
- v1 (2026-07-18) — created (G2 novel-ui design brief)
