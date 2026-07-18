---
linear: CAM-419
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-19
---
# Profile + wishlist AI tools — getMyProfile (phone-masked) / getMyWishlist (CAM-419)

> Full design: `docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md` §D5 (ratified 2026-07-19).
> Type: internal engine plumbing (wire contract byte-stable — `POST /api/ai/chat` request/response
> shape unchanged). Spec-lite class: no schema/migration, no new/changed API contract, single
> file-surface (`lib/ai/tools/my-profile-wishlist.ts` + registration + one system-prompt line).
> G1: folded — ADR-013 D5 is the ratified spec; no separate G1 tap for this story.
> Depends on: CAM-417 (tiered registry + `ToolContext`), CAM-416 (bounded agent loop this threads into).

## Story
As the **platform** (server-authoritative tool layer, no direct end-user-facing screen), I want two
`authed`-tier AI tools — `getMyProfile` and `getMyWishlist` — so that a signed-in camper's assistant
turn can answer "what's my email/when did I join/what have I saved" using the caller's OWN data only,
with the phone number masked before it ever enters the model's context (PII, ADR-013 D5).

Scope: `lib/ai/tools/my-profile-wishlist.ts` (new) registers `getMyProfile` (wraps
`prisma.user.findUnique`, scoped to `ctx.userId`) and `getMyWishlist` (wraps the same userId-scoped
query the `GET /api/wishlist` route already runs, projected through the existing `campCardSelect` —
never a forked data path). Both tools carry `tier: 'authed'`; `ctx.userId` is the ONLY source of
identity (CAM-417 server-bound `ToolContext`) — neither tool's zod `parameters` nor its `jsonSchema`
ever carries a `userId` field. `lib/ai/openrouter-client.ts`'s `buildSystemPrompt` gains one additional
line, present ONLY when `ctx.userId` is set, telling the model the camper is signed in and to prefer
the `getMy*` tools for the camper's own data.
**Out of scope (explicitly, this story does NOT):** `getMyBookings` / `getMyBookingDetail` — CAM-418
(concurrent, separate file surface); reading `auth()` in `app/api/ai/chat/route.ts` to populate a real
`ctx.userId` on the wire — CAM-420 (every real request today still resolves `ctx = {}`, so these two
tools are exercised only by tests until then).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A signed-in camper's turn (`ctx.userId` set) | The model calls `getMyProfile` | — (no direct screen; the model composes its own prose reply from the tool result) | Returns `{ok:true, name, email, phoneMasked, createdAtIso}` — `name`/`email`/`createdAtIso` PLAIN, `phoneMasked` in the exact ux.md shape `081-•••-••XX`; the raw `User.phone` value never appears in the returned object | EC-1 |
| AC-2 | The camper's User row has no phone on file | The model calls `getMyProfile` | — | `phoneMasked` is `null` (not a placeholder string, not an error) | EC-1 |
| AC-3 | A signed-in camper's turn (`ctx.userId` set) | The model calls `getMyWishlist` | — | Returns `{cards: CampCardPayload[]}` — exactly the caller's OWN wishlisted camps (Prisma `where: {userId: ctx.userId}`), projected through the same `campCardSelect` the catalog grid uses, capped at 10, most-recently-saved first | EC-2 |
| AC-4 | The camper has an empty wishlist | The model calls `getMyWishlist` | — | Returns `{cards: []}` — never `null`, never a thrown error | EC-2 |
| AC-5 | A guest turn (`ctx = {}`, no session) | The model's tool schema list is built, or it hallucinates a call to either tool anyway | — | Neither tool is offered to the model; if called anyway, `dispatchTool` refuses with `unauthorized_tool` (CAM-417 tier guard) — `execute()` never runs, no DB query fires | EC-3 |
| AC-6 | A signed-in camper's turn (`ctx.userId` set) | `buildSystemPrompt` runs | — | The system message contains ONE additional line ("the camper is signed in; use getMy* tools for their own bookings, wishlist, and profile"), present exactly once; a guest turn's system message is byte-identical to before this story (the line is absent) | EC-4 |

## Rules
- BR-1: `getMyProfile`/`getMyWishlist` both carry `tier: 'authed'` and a zod `parameters` schema of `z.object({})` — no argument, no `userId` field anywhere in the schema or the hand-written `jsonSchema` (proves AC-5 alongside the CAM-417 registry guard).
- BR-2: `getMyProfile`'s phone field is masked per `.claude/rules/ux.md` §3 PDPA table: keep first 3 + last 2 digits, glyph `•` (U+2022), shape `081-•••-••XX`. This is the ONLY place a `User.phone` value is read for the AI layer; the raw value is never placed on the returned object (proves AC-1).
- BR-3: `getMyWishlist` reuses `campCardSelect` (the identical card projection `searchCampsites` and the catalog grid already use — ADR-009 no-forked-data-path) and caps results at `GET_MY_WISHLIST_MAX_RESULTS` (10) — an AI tool result feeds directly into the model's prompt/token budget, so it is bounded regardless of the underlying `GET /api/wishlist` route's own (unbounded) shape.
- BR-4: The system-prompt signed-in line is appended ONLY when `ctx.userId` is present, via `buildSystemPrompt(now, ctx)`; a guest turn (`ctx = {}}`, every real request today) produces a prompt byte-identical to pre-CAM-419.

## Edge cases
- EC-1: IF the camper's User row has `phone: null` THEN `getMyProfile` returns `phoneMasked: null` — never a guessed/placeholder string, never a crash.
- EC-2: IF the camper's wishlist is empty THEN `getMyWishlist` returns `{cards: []}` — never `null`/`undefined`/a thrown error (mirrors `searchCampsites`'s AC-8 empty-state contract).
- EC-3: IF a guest turn's model hallucinates a call to `getMyProfile`/`getMyWishlist` (names it was never offered) THEN `dispatchTool` refuses with `{ok:false, code:'unauthorized_tool'}` before either tool's `execute()` runs — no DB query fires.
- EC-4: IF `ctx.userId` is absent (the guest default) THEN the signed-in system-prompt line is absent entirely — not blank, not a "not signed in" line — keeping the guest prompt byte-identical to before this story.

## Data
- No schema/migration. `lib/ai/tools/my-profile-wishlist.ts` (new) — 2 `ToolDefinition`s registered into the existing `lib/ai/tool-registry.ts` registry via `lib/ai/tools/index.ts`. `lib/ai/openrouter-client.ts`'s `buildSystemPrompt` gains a second parameter (`ctx: ToolContext = {}`) and one conditional array entry; both call sites (`runAssistantTurn`, `runAssistantTurnFromMessages`) now pass their own `ctx` through.

## Seams & refs
- Reuse: `lib/read-models/camp-card.ts` (`campCardSelect`/`CampCardPayload` — identical projection `searchCampsites` uses) · `app/api/wishlist/route.ts`'s `GET` handler (the same `userId`-scoped `wishlist.findMany` shape, re-expressed through `campCardSelect` instead of that route's own DTO select) · `lib/ai/tool-registry.ts`'s `ToolContext`/tier machinery (CAM-417, unmodified). Refs: ADR-013 §D5 · `.claude/rules/ux.md` §3 (PDPA masking table) · `.claude/rules/security.md` (OWASP access-control / no-identity-in-schema).
- Not touched: `lib/ai/tool-registry.ts` core, `getMyBookings`/`getMyBookingDetail` (CAM-418, concurrent — separate file surface) · `app/api/ai/chat/route.ts` (no `auth()` read — CAM-420).

## Out of scope
- `getMyBookings` / `getMyBookingDetail` → CAM-418.
- Reading `auth()` in the chat route to populate a real `ctx.userId` on the wire → CAM-420.
- A `'write'` tier or any confirmed-write tool → not scheduled (ADR-013 D5 seam only).

## Self-verify
- AC-1..6 → `__tests__/cam-419-my-profile-wishlist.test.ts` (mask-shape unit tests, getMyProfile normal/null/not-found/Prove-It, getMyWishlist normal/empty/boundary, the CAM-417 no-userId invariant re-proven for these 2 tools, `dispatchTool` guest-refusal, and the signed-in system-prompt line present/absent + injection-guard/persona regression).
- Story-specific: full AI sibling suite re-run green as the last act (code.md CAM-302/194 lesson) — zero new failures.
- Gate = `/quality-gate` · Done = merged into `dev`, AC verified on localhost (dev DB) before merge.

## Changelog
- v1 (2026-07-19) — created.
