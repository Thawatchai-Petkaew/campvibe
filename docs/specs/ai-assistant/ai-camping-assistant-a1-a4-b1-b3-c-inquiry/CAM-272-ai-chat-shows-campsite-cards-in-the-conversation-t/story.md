---
linear: CAM-272
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-18
---
# AI chat shows campsite cards in the conversation, tap through to the camp page (AI-3) (CAM-272)

<!-- Gate class: FULL (G2 novel-ui per design.md — new floating entry + new overlay surface + new conversation states; multi-file UI surface). Copy + states SoT = the ratified design.md in this folder; this story consumes it and the CAM-271 endpoint. -->

## Story
As a **Camper** (including a guest who is not signed in), I want a floating chat on the Home page where I ask for a campsite in plain Thai and see the reply plus real campsite cards I can tap through to that camp's page, so that I can discover a place to camp without leaving Home or contacting anyone.
Why: Discover-only — the card links to the camp's detail page and stops there; there is NO booking, lead, or write action inside the chat (ADR-011: HostLead handoff waits on HostOS M1.2).
Scope: the floating launcher + chat panel on Home only, wiring `POST /api/ai/chat` (CAM-271) through the `lib/api-client` facade; render the answer as plain text + up to 10 in-chat cards (reused `CampgroundCard`) linking to `/campgrounds/{slug}`; all 8 states + a11y per `design.md` / `DESIGN.md` / `.claude/rules/loading.md`.
Depends on: CAM-271 (chat endpoint — `200 {answer,cards}` / `429` / `400` / `503` / `502`) · design.md (G2 novel-ui brief) · ADR-009.

## AC
<!-- The assistant's reply text is MODEL-GENERATED (dynamic), so AC-2/AC-3 describe the observable shape. Verbatim Thai applies to FIXED UI copy (welcome, notices) — all copy comes from locales `aiChat.*` (design.md §Copy, TH+EN); no hardcoded Thai in components. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper is on Home and the assistant is reachable | They tap the floating launcher | The chat panel opens showing `ถามผู้ช่วยหาที่กางเต็นท์ได้เลย` and 3 suggested prompts incl. `หาที่แคมป์ติดน้ำ หมาเข้าได้` | Panel opens (Dialog on desktop / bottom Sheet on mobile); focus moves into the composer; no request is sent yet | EC-4 |
| AC-2 | The assistant is enabled and a question is typed (e.g. `หาที่แคมป์ติดน้ำ หมาเข้าได้`) | The camper sends it | `ผู้ช่วยกำลังพิมพ์…` appears, then the assistant's reply text with up to 10 matching campsite cards (reply wording is model-generated) | Client POSTs the conversation to the endpoint via `lib/api-client`; a `200` renders the answer as plain text + cards from the `cards[]` payload; nothing is written | EC-5 |
| AC-3 | A reply shows campsite cards | The camper taps a card | That camp's detail page opens (the existing booking flow continues there) | Navigates to `/campgrounds/{slug}`; no write/lead/booking happens inside the chat | — (native link navigation; no in-chat failure state owned here) |
| AC-4 | The assistant is enabled and the search found nothing | The turn returns with no cards | The reply text plus `ยังไม่พบลานที่ตรงกับที่ค้นหา ลองปรับเงื่อนไขดูนะ`; no cards shown | `200` with `cards: []` → zero-result notice; no cards rendered | EC-2 |
| AC-5 | A question was sent | The endpoint returns a non-2xx error other than 429/503 (e.g. 400/502) or the request fails | `ผู้ช่วยขัดข้อง กรุณาลองใหม่อีกครั้ง` with a `ลองใหม่` button | Error notice rendered as an assistant turn; tapping `ลองใหม่` re-sends the last question | EC-5 |
| AC-6 | A question was sent | The endpoint returns `429` | `มีคำถามเข้ามามากเกินไป กรุณารอสักครู่แล้วลองใหม่` in a warning-tone bubble (no retry button) | Rate-limited notice; no auto-retry; the user waits and re-sends | EC-3 |
| AC-7 | The assistant is disabled (`OPENROUTER` key off) | The camper opens the panel and sends | `ผู้ช่วยยังไม่เปิดใช้งาน`; the composer is disabled | `503` (skipped) mapped to the disabled state; the launcher still renders so the state stays reachable | EC-4 |
| AC-8 | The chat panel is open | The camper presses Esc, taps close, or taps the scrim (mobile) | The panel closes | Dialog/Sheet closes; keyboard focus returns to the launcher (restore-to-trigger) | — (a11y close behaviour; focus-return is asserted in this row) |

## Rules
- BR-1 The launcher renders on Home whenever the page renders — including when the assistant is disabled, so the disabled state stays reachable (never hide the launcher). It carries `aria-label` = `เปิดผู้ช่วยหาที่กางเต็นท์`. It is a Home-surface, Discover-only entry (not a global nav item). (proves AC-1, AC-7)
- BR-2 Opening the panel shows the welcome/empty state: the heading `ถามผู้ช่วยหาที่กางเต็นท์ได้เลย` + 3 tappable suggested-prompt pills (`หาที่แคมป์ติดน้ำ หมาเข้าได้`, `ลานใกล้เชียงใหม่ งบไม่เกิน 1500 บาท`, `ที่กางเต็นท์สำหรับครอบครัว มีห้องน้ำสะอาด`). Tapping a pill sends that text as the user's message. No request is sent on open. (proves AC-1)
- BR-3 On send, the composer + send button disable, an assistant-side typing indicator (three pulsing dots, disabled under `prefers-reduced-motion`) shows with an inline spinner on the send button, and `ผู้ช่วยกำลังพิมพ์…` is announced via `aria-live="polite"`. The client POSTs the conversation to the CAM-271 endpoint through the `lib/api-client` facade — it NEVER calls the model directly (no secret in the client bundle). The typing indicator is the correct loader (user-action async on a control), NOT a skeleton (`.claude/rules/loading.md`). (proves AC-2)
- BR-4 (SECURITY, Critical gate) A successful turn renders `answer` as PLAIN TEXT only (a text node with `whitespace-pre-wrap`) — no `dangerouslySetInnerHTML`, no markdown-to-HTML, no HTML injection; model output is treated as data to display, never as instructions. Campsite cards come ONLY from the structured `cards[]` payload — never parsed/scraped from the `answer` string — capped at 10 (the endpoint already caps at 10; the UI renders whatever `cards[]` contains). Each card reuses `CampgroundCard` in a compact variant with NO wishlist heart and NO carousel arrows (Discover-only, no chat-side actions) and links to `/campgrounds/{slug}`. (proves AC-2, AC-3, EC-6)
- BR-5 The endpoint status maps to exactly one conversation state (verbatim copy): `200` + `cards:[]` and nothing found → zero-result `ยังไม่พบลานที่ตรงกับที่ค้นหา ลองปรับเงื่อนไขดูนะ`; `429` → rate-limited `มีคำถามเข้ามามากเกินไป กรุณารอสักครู่แล้วลองใหม่` (warning tone, no retry button); `503` (assistant disabled) → `ผู้ช่วยยังไม่เปิดใช้งาน` + composer disabled; any other non-2xx (400/502/…) or a failed request → error `ผู้ช่วยขัดข้อง กรุณาลองใหม่อีกครั้ง` + a `ลองใหม่` button that re-sends the last question. (proves AC-4, AC-5, AC-6, AC-7)
- BR-6 The send button is disabled when the composer is empty or whitespace-only (a client guard, not a user-facing error message). Enter sends; Shift+Enter inserts a newline. (proves AC-2, EC-1)
- BR-7 The panel is a11y-complete: `role="dialog"` + `aria-label` = `ผู้ช่วยหาที่กางเต็นท์`; a focus trap while open; Esc / close / tap-scrim(mobile) closes it; focus moves into the composer on open and returns to the launcher on close; the message log is `role="log"` + `aria-live="polite"`; every notice pairs an icon with text (state is never colour alone); tap targets ≥ 44px. All copy resolves from locales `aiChat.*` (TH + EN) — no hardcoded string. (proves AC-1, AC-8)

## Edge cases
- EC-1 IF the composer is empty or whitespace-only THEN the send button is disabled, no request is sent, and no error message shows (BR-6)
- EC-2 IF the turn succeeds but returns no cards (`cards:[]`) THEN show the answer plus `ยังไม่พบลานที่ตรงกับที่ค้นหา ลองปรับเงื่อนไขดูนะ` and render no cards (BR-5)
- EC-3 IF the endpoint returns `429` THEN show the warning-tone bubble `มีคำถามเข้ามามากเกินไป กรุณารอสักครู่แล้วลองใหม่` with no retry button (BR-5)
- EC-4 IF the endpoint returns `503` (assistant disabled) THEN show `ผู้ช่วยยังไม่เปิดใช้งาน`, disable the composer, and keep the launcher rendered so the state stays reachable (BR-1, BR-5)
- EC-5 IF the endpoint returns any other non-2xx (e.g. `400` / `502`) or the request fails THEN show `ผู้ช่วยขัดข้อง กรุณาลองใหม่อีกครั้ง` + a `ลองใหม่` button that re-sends the last question (BR-5)
- EC-6 IF the `answer` text contains HTML/markup (or a model tries to inject markup) THEN it renders as inert plain text (`whitespace-pre-wrap`, no HTML executed); cards still come only from `cards[]` (BR-4)
- EC-7 IF `prefers-reduced-motion` is set THEN the typing dots and the launcher hover/press scale animations are disabled (static) (BR-3)

## Data
- No schema change, no migration. The chat is STATELESS in the POC: the conversation lives in client state only (no server-side persistence). It reads only through the CAM-271 endpoint. Response shape consumed: `{ answer: string, cards: CampCardPayload[] }`. · migration: none
- NFR — a11y: WCAG 2.1 AA (focus trap · Esc · focus-return · `role="log"`+`aria-live` · 44px targets · colour-not-only; composite tint contrast verified with axe at build, not yet measured). i18n: all copy in `locales` `aiChat.*` (TH+EN), no em-dash separator, no jargon. security: plain-text answer, cards from `cards[]` only, client never calls the model/reads a secret. performance: keep the panel/thread code lazy so the launcher does not regress the Home route bundle/LCP (not measured).

## Seams & refs
- Reuse: `components/CampgroundCard.tsx` (compact variant — no wishlist heart, no carousel; ONE shared card, no parallel style — CAM-249) · `components/HostOnboardingFab.tsx` (FAB idiom `fixed bottom-6 right-6 z-50`) · `components/ui/{sheet,dialog,card,textarea,button,scroll-area,error-banner,modal-shell}` · `lib/hooks/use-modal-a11y.ts` (focus-trap + restore-to-trigger — reuse, don't hand-roll, CAM-368) · `lib/api-client` (facade that POSTs the endpoint) · `lib/read-models/camp-card.ts` `CampCardPayload`. Refs: `design.md` (G2 novel-ui brief — SoT for copy + all 8 states) · CAM-271 (endpoint contract) · ADR-009 · ADR-011 · `DESIGN.md` · `.claude/rules/loading.md` · `.claude/rules/security.md` §6.
- Build note — FAB collision (design.md §Seams): the chat launcher and `HostOnboardingFab` both sit at `fixed bottom-6 right-6 z-50` on Home for a logged-in non-host. They MUST NOT overlap — the chat launcher owns the corner and the Host FAB stacks above it (e.g. `bottom-24`), or vice-versa. Frontend resolves the exact offset; the requirement is: no visual collision.
- Build note — `cards[]` ↔ CampgroundCard props (design.md §Seams): `CampCardPayload` (a narrower `select`) is NOT assignable as-is to CampgroundCard's `campground: CampSite & { location; images? }` prop. Reconciling it (widen CampgroundCard's prop to the card read-model, or map at the boundary) is a Frontend/Architect typing decision — flagged so it is not missed. Do NOT introduce a parallel card to sidestep the type.

## Out of scope
- The chat endpoint itself → CAM-271 (this story consumes it)
- A full `/assistant` page → later (design the panel as self-contained subcomponents so a future page can reuse them, but do NOT build the page now)
- Streaming (SSE / token-by-token) → deferred (the endpoint returns the full `{answer,cards}` in one response)
- HostLead / inquiry form / booking / compare / trip-planner inside chat → deferred (ADR-011); cards stop at `/campgrounds/{slug}`
- Server-side conversation persistence → not in the POC (client-only thread state)
- Multi-turn agent loop / `getCampDetail` tool → deferred (CAM-270/271 out-of-scope)

## Self-verify
- AC-1 → component test (open panel → welcome heading + 3 pills; focus lands in the composer)
- AC-2 → component test (send → typing indicator → mocked `200` renders answer as plain text + N cards from `cards[]`; CampgroundCard compact, no heart/carousel)
- AC-3 → component test (each card is a link to `/campgrounds/{slug}`; no write fires)
- AC-4 / EC-2 → component test (`200` `cards:[]` → zero-result copy, no cards)
- AC-5 / EC-5 → component test (`502` / `400` / network fail → error copy + `ลองใหม่` re-sends the last question)
- AC-6 / EC-3 → component test (`429` → rate-limited copy, no retry button)
- AC-7 / EC-4 → component test (`503`/skipped → disabled copy + composer disabled; launcher still renders)
- AC-8 → component test (Esc / close / scrim → panel closes, focus returns to the launcher)
- EC-6 → security test (an `answer` containing `<script>`/markup renders inert as text; no `dangerouslySetInnerHTML`; cards only from `cards[]`)
- EC-7 → test (reduced-motion disables typing dots + launcher scale)
- Story-specific: NO write action fires from chat (Discover-only); the client never imports/calls the model or reads a secret; all copy resolves from `locales` `aiChat.*` (TH+EN), no hardcoded Thai. Design Gate (DESIGN.md §6) must pass (token-only · 8 states · loading · a11y AA · i18n · security · motion · anti-slop · test IDs).
- Gate = /quality-gate + Design Gate · Done = quality-gate green + every AC verified on localhost (dev DB) before the merge into `dev`.

## Changelog
- v1 (2026-07-18) — created (spec-first, template v2), aligned to the ratified G2 novel-ui design brief (`design.md`). POC scope (owner-ratified, AUTO mode): Discover-only floating chat on Home consuming CAM-271. Supersedes the stale ticket "tap through to inquiry / HostLead" framing — cards link to `/campgrounds/{slug}` with no lead form (ADR-011 deferred to HostOS M1.2). Streaming + full assistant page + persistence deferred.
