# ADR-018: The chat commits a booking through the existing deterministic write path (CAM-696)

Status: **PROPOSED** — the decisions below were ratified by the owner in the CAM-695 planning session on 2026-08-06 and are **not open for re-litigation**; this record flips to **Accepted** when CAM-696 clears its G2 tap · **Epic:** CAM-695 (In-chat booking completion — ADR-016 round 2) · **Satisfies:** [ADR-016](ADR-016-camper-direct-booking-and-in-chat-completion.md) §5 (decision point deferred 2026-07-28)

## Context

ADR-016 §5 deferred exactly one decision, and named exactly what a round-2 ADR must cover:

> "When round 2 is proposed it needs its own ADR covering at minimum: which deterministic code path performs the write, what the camper's explicit final confirm looks like, and how availability is re-checked at confirm time."

This record answers those three (D1, D2, D3), plus three more that round 2 forces open the moment the chat writes for real: whether the model's relationship to the write changes (it does not — D4), what survives a reload (D5), and what happens when a POST's outcome is unknown (D6).

### What the code actually does today (verified 2026-08-06 in this repo, load-bearing)

Every fact below was read, not recalled. They matter because the whole decision is **"reuse what is already there"**, which is only defensible if what is there is actually what this ADR claims it is.

- **The write gate already exists and is already correct-by-construction for concurrency.** `app/api/bookings/route.ts:284` — `POST` runs `requireAuth()` (`:285`, defined `lib/auth-utils.ts:19`), takes `userId` from the NextAuth session and never from the body (`:289`; the zod parse at `:307` spreads `userId` **last**, so a client-supplied value cannot win), rate-limits per user at 20 req/60s (`:295`), then runs every availability check **and** the insert inside ONE `Serializable` transaction (`:60`–`:263`, isolation pinned at `:262`) with bounded retry on P2034 (`:267`–`:278` — 3 attempts, then `409`).
- **The facade the plan names already exists, and has zero callers.** `bookingAPI.create` is declared at `lib/api-client.ts:106`. `grep -rn "bookingAPI" app components lib` returns exactly one hit: the declaration itself. The camp page bypasses it with a raw `fetch("/api/bookings", …)` at `components/CampgroundDetailClient.tsx:622`. Round 2 does not add a facade — it gives a dead one its first real caller.
- **Hardcoding `source:'CHAT'` at a client call site is already the shipped pattern.** `components/CampgroundDetailClient.tsx:632` writes `...(fromChat ? { source: 'CHAT' as const } : {})` — a code constant on a branch, not a value relayed from anywhere.
- **The model has no write tool and structurally cannot render a confirm.** `lib/ai/tools/index.ts:1`–`:3` states BR-1 (the registry contains NO write tool); ten read-only registrations follow at `:33`–`:46`. A `kind:"booking"` entry is built only by the `components/ai-chat/booking-view.ts` builders driven from `use-ai-chat.ts`; no model-response path constructs one.
- **Booking blocks are already excluded from model history and from restore.** `components/ai-chat/conversation.ts:99`–`:109` (`buildOutgoingHistory` reads only `role:"user"` and `kind:"answer"`) and `:273` (`restoreEntriesFromMessages` never emits `kind:"booking"`), with the reasoning pinned in the union member's own comment at `:65`–`:74` and enforced by `__tests__/cam-639-conversation-booking-entry.test.ts`.
- **The chat's summary currently misstates the stay it would book.** `components/ai-chat/booking-view.ts:247` hardcodes `nights: 1`, while a typed range phrase already produces a multi-night slot pair; and `components/ai-chat/AiChatDetailCard.tsx:283` passes `campSitePriceUnit: null`, so a `PER_PERSON` camp is quoted per site. The write path prices the **real** night count and the **real** unit (`app/api/bookings/route.ts:171`, `:185`–`:217`). Today that divergence is invisible because the chat writes nothing. The moment the confirm is real, it becomes *"the number I agreed to is not the number I was charged."*
- **The write gate has one known hole.** `app/api/bookings/route.ts:131` fetches the camp with `findUnique` and **no** `isActive`/`isPublished`/`deletedAt` predicate, unlike the GET availability routes. A hidden camp is bookable today by anyone holding its uuid. Found during CAM-695 exploration; carded as **CAM-705**.

## Decision

### D1 — The write path is the existing `POST /api/bookings`, reached through `bookingAPI.create`

**No new endpoint, no new route, no schema change, no migration.** The chat calls `bookingAPI.create` (`lib/api-client.ts:106`), which POSTs to the same handler the camp page uses. Everything the camp page gets, the chat gets for free and unavoidably: session-bound `userId`, the rate limit, the zod bounds (`lib/validations/booking.ts` — guests ≤ 500 at `:32`, `checkOut > checkIn` at `:42`, ≤ 30 nights at `:50`), the three availability checks, the spot-ownership check (`:167`), the Serializable transaction, and the ADR-005 snapshot crystallization (`app/api/bookings/route.ts:237`–`:256`).

`source: 'CHAT'` is a **code constant at that call site**. The literal lives in `lib/api-client.ts` — never in a model turn, never in a field of a chat payload, never in anything a model or a camper can influence. This mirrors `components/CampgroundDetailClient.tsx:632` exactly. `Booking.source` stays attribution-only per ADR-017 and `prisma/schema.prisma:644`–`:647`.

The contract, recorded so no builder re-derives it (all of it already ships):

| | |
|---|---|
| Path / method | `POST /api/bookings` |
| Authz | **authenticated**; no ownership rule — the row is created FOR the session user. `userId` is read from the session (`route.ts:289`) and re-asserted last in the zod parse (`:307`). There is deliberately **no `403`**: a create has no pre-existing row to own. |
| Input | `{ campSiteId: uuid, checkInDate: ISO, checkOutDate: ISO, guests: int 1..500, spotId?: uuid, source: 'WEB'\|'CHAT' }` (`lib/validations/booking.ts:21`–`:58`) |
| Success | `201` + the created Booking, money serialized to number (`apiSuccess` → `serializeDecimals`, `lib/api-utils.ts:23`). **Not** wrapped in `{ data }` — the row IS the body. |
| `400` | zod failure, or `spotId` not on this camp / soft-deleted (`route.ts:334`) |
| `401` | no session (`lib/auth-utils.ts:23`) |
| `403` | **deliberately absent** — see Authz |
| `404` | camp not found (`route.ts:325`) — today only "not found", not "not visible" (CAM-705) |
| `409` | dates taken / capacity exceeded / host-blocked / serialization retry exhausted (`route.ts:322`) |
| `429` | rate limit — **raw body `{ error: 'rate_limited' }` + `Retry-After` header, NOT the `apiError` shape** (`route.ts:297`) |
| `500` | generic `{ error }`; details logged server-side only (`lib/api-utils.ts:8`–`:18`) |
| Error shape | `{ error: string, details?: unknown }` on 4xx · `{ error: string }` on 5xx. **The `429` above is the one exception** — a client that parses only one shape will mis-read it. |

The chat client must parse **both** shapes. That is precisely why CAM-702 names it.

### D2 — The explicit final confirm is the camper's own tap on ยืนยันการจอง, on the summary step

**Typed text never submits.** The confirm exists only as a control on a `kind:"booking"` summary view, constructed by `booking-view.ts` from flow state — not by any model output. A model cannot cause a confirm control to render, and no phrasing in the conversation can substitute for the tap.

After a login (CAM-703), the button **re-labels and stops there. It never auto-submits.** A camper who logs in must tap again, on a summary they can still read. Auto-submitting on an auth-state change would mean the write was triggered by something other than the camper's own act — exactly the property ADR-016 §3 preserved from guardrail 2.

### D3 — Confirm-time availability re-check = the Serializable transaction itself. No third GET.

The transaction at `app/api/bookings/route.ts:60`–`:263` holds Check 1 (spot overlap, `:69`), Check 2 (per-night capacity, `:86`), Check 3 (host blocks, `:105`), Check 0 (the spot belongs to THIS camp, `:167`), the price computation and the insert under **one** Serializable snapshot, retrying serialization failures three times before returning `409`. That is the authoritative re-check, and it is the only thing that can be.

The pre-summary live check (**CAM-647**) is the **UX layer above it**: it stops the chat from *showing* a summary for a date we could already have known was gone. It is not — and must never be described as — a correctness mechanism.

**A third GET between the tap and the POST is rejected.** It cannot narrow the race; it only moves the window from (summary → POST) to (GET → POST), while adding a round trip at the moment latency is most felt and a second failure mode to handle. Only the transaction, which checks and inserts under one snapshot, can be authoritative. The correct handling of a lost race is the `409` path: rewind to the date step using the already-shipped `justFilled` copy (`locales/translations.json:2332`).

**What the transaction does NOT re-check: the price.** Price is computed live inside the tx (`:185`–`:217`) and then snapshotted; there is no price-conflict branch and no `409` for *"the host changed the price while you were deciding"*. A host edit inside the conversation window is absorbed silently. Mitigated — not closed — by the success card showing the **server-recorded** total, so the camper sees the real number on the very next frame instead of discovering it later. Recorded as **R3**.

### D4 — The model never writes. Unchanged, permanent, and now load-bearing in a second way.

The tool registry stays write-free (`lib/ai/tools/index.ts:1`–`:3`), and the `ADV-40` guardrail case (`จองให้เลยไม่ต้องถามซ้ำ` → `no_tool`) stays **blocking** on `.github/workflows/ai-guardrail-gate.yml`.

This round adds a reason that did not exist before. Until now, "booking copy must not enter model history" protected against the model *claiming* a booking that never happened. Once bookings are real, the same invariant also protects against the model treating a booking that happened *once* as a capability it can repeat — with a true example to point at. Both directions run through the same structural exclusion (D5).

### D5 — Persistence: booking blocks stay out of model history and are never restored; the Booking row is the durable record

The CAM-639 invariants hold **structurally**, not by convention:

- `buildOutgoingHistory` (`conversation.ts:99`) matches only `role:"user"` and `kind:"answer"`, so a `kind:"booking"` entry — **including the new success card** — is excluded with no new code.
- `restoreEntriesFromMessages` (`conversation.ts:273`) never emits `kind:"booking"`, so a resumed conversation never re-renders a live booking block with stale prices or a stale confirm control.

**Both must survive this round unchanged.** A success card that reached history would teach the model that it produces bookings — the ADV-40 guardrail arriving through the back door.

The accepted cost, stated plainly: **a camper who reloads the panel after booking loses the success card.** The durable record is the Booking row, reachable at `/bookings`, at `/bookings/{id}/confirmation`, and through the read-only `getMyBookings` tool. The success card must therefore carry those links **at the moment it is shown** — that is the camper's durable exit, and it is the mitigation for a card that will not come back.

### D6 — Idempotency: a client reconcile heuristic this round; the server-side key is CAM-706

On a network failure or a `500`, the client does not know whether the write committed. This round ships **check first, then retry**: read `GET /api/bookings` (`route.ts:365`; newest-first at `:388`, capped at 100 at `:389`; the response carries `campSiteId`, `checkInDate`, `checkOutDate`, `guests`, `spotId`, `status` and `createdAt`, because the query uses `include`, not `select`) and look for a row matching this attempt **before** re-POSTing.

Four refinements this ADR pins, because the planning session's shape ("a row matching `{campSiteId, checkInDate, checkOutDate, guests}` in the last ~10 minutes") is more permissive than the failure it covers:

1. **Window ≈ 2 minutes, not ~10.** The uncertainty being resolved is *"did the POST I just fired commit?"* — bounded by a fetch timeout plus a tap, i.e. seconds. Widening the window adds **no** coverage; it raises the false-match rate linearly. This is a deliberate delta from the plan's "~10 minutes", called out so the owner sees it at the G2 tap (Open trade-off 1).
2. **Match `status: 'PENDING'` only.** Every booking this path creates is written `PENDING` (`route.ts:232`), so this can never exclude a true match — and it removes a camper's own recently-cancelled identical row from the candidate set.
3. **Include `spotId` in the tuple** once CAM-700 lands. On a per-pitch camp it is the most selective field available, and it costs nothing.
4. **The reconciled success card renders the FOUND row's real id and total** — never a re-render of the local estimate. A reconcile that asserts success without showing the row it found is an unverifiable claim; showing the row makes it checkable by the camper in one tap.

**RESIDUAL RISK, recorded honestly (R1):** a camper who legitimately holds an identical booking created inside the window — same camp, same dates, same guests, same pitch, still `PENDING` — can be mis-reconciled. The heuristic then reports success for a write that never committed, and that second booking silently does not exist. The failure direction is deliberate: the alternative (blind retry) creates a real duplicate that consumes real inventory. But the chosen direction fails **silently and confidently**, which is worse in the honesty dimension, and refinements 1–4 shrink it rather than remove it. **Only a server-side idempotency key removes it — that is CAM-706 (schema change, own migration, own G2), deliberately out of this round.**

### D7 — Scope: per-pitch camps get an in-chat pitch step; multi-night is in

Owner decisions, 2026-08-06. Both are recorded here because both change what *"the summary is true"* means:

- **Pitch (CAM-700).** The chat is spot-blind today, while the camp page **requires** a pitch on a `useSpotView` camp and the API merely accepts a pitch-less booking (`spotId` optional, `lib/validations/booking.ts:23`). That is a product divergence: the chat could write a booking the camp page forbids. The step must fail toward *requiring* a pitch, never toward a pitch-less write.
- **Multi-night (CAM-699)** is a correctness prerequisite, not a feature — see D8.

### D8 — The ordering rule this ADR imposes: the estimate must equal the charge before the confirm is real

`booking-view.ts:247` hardcodes `nights: 1`, and the detail card passes a null price unit, while the write path prices the real nights and the real unit. **CAM-698 (price unit) and CAM-699 (real night count) must land BEFORE CAM-702 (the real write).**

They are not parallel improvements. They are the difference between a confirm that means something and a confirm that misstates the amount at the exact moment the camper agrees to it. Because the success card shows the **server** total (D3), any surviving divergence surfaces to the camper one frame after the tap.

The acceptance proof is the one CAM-702 already carries: the DB row's total equals the success card **byte-for-byte** on a localhost verify (the CAM-672 lesson — assert a structural, discriminating value, never a prose match).

## Alternatives considered

### (a) A new `POST /api/chat/bookings` route owned by the chat
Would let the server set `source` from the route it arrives on — the **literal** reading of the CAM-642 security constraint. **Rejected:** it forks the write gate. This repo has shipped four bugs from exactly one failure mode — a second path that forgot what the first one checks (CAM-190, CAM-267, CAM-400, CAM-665) — and this gate holds five checks, a snapshot, a rate limit and a retry loop that would all have to stay in lock-step forever. The constraint's *purpose* (a model-chosen value must never become `source`) is met by a code constant at the call site; its *letter* buys a label's integrity at the price of a duplicated write gate. Recorded as **R2** with a tripwire, not waved away.

### (b) A model-callable `createBooking` tool
The obvious shape, and the one ADR-016 §Alternatives (b) and the conversation-to-booking research already rejected for round 1. **Still rejected, permanently:** it puts a money-and-inventory write behind a model turn. ADV-40 exists precisely because campers *do* ask the assistant to skip the questions and just book. See D4.

### (c) A GET availability re-check between the confirm tap and the POST
**Rejected** in D3: it moves the TOCTOU window rather than closing it, adds latency at the worst moment, and guarantees nothing the Serializable transaction does not already guarantee.

### (d) Ship the server-side idempotency key in this round
**Rejected for this round, not on the merits.** It is the correct fix for R1 and it is carded (**CAM-706**). It needs a column, a unique index, a migration and its own G2 — a different shape of work from the eight client stories in CAM-695 — and it would gate the whole round on a schema change the round otherwise does not need.

### (e) Keep booking blocks in restored history so the success card survives a reload
**Rejected:** a restored booking block carries stale prices and a stale confirm control, and a restored success card is indistinguishable from one the model produced. The camper's durable record is the Booking row; D5 gives it three reachable surfaces instead.

## Consequences

**Positive**

- Zero new write surface, zero schema change, zero migration for the entire round. Every security property of the camp-page booking path applies to the chat path **by construction** rather than by review.
- The facade that existed for exactly this purpose (`lib/api-client.ts:106`) finally has a caller; the raw `fetch` at `CampgroundDetailClient.tsx:622` becomes the outlier rather than the pattern.
- ADR-005 crystallization means a chat booking is a legal document on the same terms as any other: a host cannot change what was agreed by editing the camp afterwards.
- Showing the server-recorded total on the success card makes any estimate/charge divergence visible in one frame instead of surfacing later as a dispute.

**Negative / risks — named, not softened**

- **R1 — the reconcile heuristic can silently swallow a real booking.** Full statement in D6. Bounded by the ~2-minute window, the `PENDING` filter and the `spotId` discriminator; removed only by **CAM-706**.
- **R2 — `source` is still client-asserted.** `lib/validations/booking.ts:38` accepts `source` from the body, so a web caller can self-label `CHAT`. This is harmless **only** while `source` is a pure attribution label that no code reads for a decision — the invariant written at `prisma/schema.prisma:644`–`:646` and verified by the CAM-642 security review (zero reads across `app/`, `lib/`, `components/`; never reaches pricing, capacity, authz, or the rate-limit key). **Tripwire: the first time anything reads `source` for pricing, policy, or an analytics-driven decision, it becomes an uncorroborated trust boundary and the value must move server-side.** Right now the only things holding that line are a schema comment and this paragraph.
- **R3 — no price-conflict detection at confirm time.** See D3. A host price edit between summary and tap is absorbed silently; the camper sees the real total on the success card, after the fact. *Not measured* — no data reviewed on how often hosts edit prices mid-session.
- **R4 — a reload loses the success card.** D5, deliberate. Mitigated by the links carried on the card and by three durable surfaces for the row.
- **R5 — this round inherits CAM-705.** Reusing the existing write gate means reusing its missing visibility predicate (`route.ts:131`): a hidden or soft-deleted camp is bookable by uuid today. The chat cannot reach such a camp through its own read tools, so this round does not *widen* the hole — but the sentence *"we reused the hardened path"* only becomes true once CAM-705 lands. It should land in or alongside this round.
- **R6 — ADR-016's RISK-1 and RISK-2 are still open.** Hosts now do receive an email on a new booking (CAM-685), but it is **off until the owner enables it** (domain + PDPA pending). A `PENDING` booking with no payment and no host acceptance remains a promise the platform cannot enforce; epic CAM-289 still owns it. Making booking easier in chat increases the volume flowing into that gap. This ADR does not close it and does not claim to.

**Open trade-offs for the G2 tap** (none of these blocks the build starting; all of them need to be *seen*)

1. The reconcile window is written here as **~2 minutes**, a deliberate tightening of the planning session's "~10 minutes" (D6, reasoning stated). Confirm, or restore the original.
2. **R2's letter-vs-purpose reading of the CAM-642 constraint.** Accepting D1 means accepting that `source` integrity rests on a schema comment plus this ADR's tripwire, not on a server-side assignment.
3. **R5 sequencing:** whether CAM-705 *blocks* CAM-702 or merely accompanies it.

## Confirmation

There is no single CI check that proves this decision, because most of it is the *absence* of new surface. What is checkable:

- `grep -rn "bookingAPI" app components lib` — after CAM-702 the chat appears; **no second booking endpoint appears anywhere**.
- `grep -rn "api/bookings" app components lib` shows exactly two POSTing call sites (the camp page and the facade). A third contradicts D1.
- `lib/ai/tools/index.ts` registers no write tool, and `.github/workflows/ai-guardrail-gate.yml` stays green on ADV-40 — D4.
- `__tests__/cam-639-conversation-booking-entry.test.ts` still pins **both** history invariants after the success card is added — D5.
- `__tests__/cam-640-use-ai-chat-wiring.test.ts`'s no-`setSending` pin survives — the confirm must never disable the composer.
- CAM-702's localhost AC verify: the Booking row's `snapshotTotalAmount` equals the success card's total exactly — D8.
- `grep -n "nights: 1" components/ai-chat/booking-view.ts` returns nothing after CAM-699 — D8.

**Known gap in this PR, reported rather than fixed:** `docs/adr/ADR-000-index.md` has no row for **ADR-017** or **ADR-018**. CAM-631's own AC-5 made the index row part of an ADR story, and it was already missed once. The index is outside this dispatch's stated file surface, so it is reported here (and in the handoff) instead of edited.

## Links

- [ADR-016](ADR-016-camper-direct-booking-and-in-chat-completion.md) §5 — the decision point this record answers (dated note added in this same PR).
- [ADR-017](ADR-017-host-recorded-stay-and-booking-discriminator.md) — `Booking.source` stays attribution-only; that invariant is what makes D1's client-side constant tolerable (R2).
- [ADR-005](ADR-005-booking-snapshot.md) — the crystallization a chat booking inherits unchanged.
- [ADR-006](ADR-006-booking-atomic-inventory-lock.md) — the Serializable-with-bounded-retry design D3 names as the authoritative re-check.
- [ADR-014](ADR-014-pricing-unit.md) — the pricing unit CAM-698 must carry into the chat's quote (D8).
- Epic **CAM-695** · story **CAM-696** (this record) · **CAM-698**/**CAM-699** (D8 prerequisites) · **CAM-700** (D7 pitch) · **CAM-701**/**CAM-702** (D2, D6) · **CAM-703** (D2 login) · **CAM-704** (proof) · **CAM-647** (D3 UX layer) · **CAM-645** (parallel).
- Follow-ups this ADR names: **CAM-705** (R5) · **CAM-706** (R1) · **CAM-289** (R6).
- The CAM-642 security constraint, recorded on CAM-640 (2026-07-28) — R2's source.
- `docs/specs/ai-assistant/in-chat-booking-completion/epic.md` — the round's scope, sequencing and writer schedule.
