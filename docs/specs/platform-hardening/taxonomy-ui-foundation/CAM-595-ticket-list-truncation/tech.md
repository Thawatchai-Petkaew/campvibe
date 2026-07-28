---
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: admin
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — The gate board silently stops at ticket 561 and hides everything newer (CAM-595)

## Ground-truth data check (measured against the real ticket DB, before writing any code)

`GET /api/tickets?archived=false&state=<S>` for each `TicketState` (per-state exact filter already existed, so each call is safely under any cap):

```
BACKLOG         count=108   localMaxNumber=595
TODO            count=2     localMaxNumber=474
IN_PROGRESS     count=2     localMaxNumber=587
AWAITING_GATE   count=2     localMaxNumber=594
DONE            count=379   localMaxNumber=592
CANCELED        count=41    localMaxNumber=582
------------------------------------------------
unarchived total = 534   highest ticket number = 595
```

Confirms the ticket's own measurement (500 rows returned, highest 561) and explains the exact shape: `DONE`+`CANCELED` = 420 of the 534 (79%), skewed toward lower numbers (older work finishes first), so an ascending `take:500` scan filled up almost entirely on old, already-settled tickets before it ever reached the newest ~34 (`AWAITING_GATE`/`IN_PROGRESS`/recent `BACKLOG`) — which is exactly the work the owner needed to see.

## The defect — confirmed before touching code

```
$ node scripts/ticket-sync.mjs gates
no gates open (no ticket AWAITING_GATE or changesRequested)

$ node scripts/ticket-sync.mjs show CAM-594
state=Awaiting Gate ... gateRaisedAt=2026-07-27T17:42:43.458Z
```
Same database, contradictory answers — `gates` client-side-filtered the SAME capped, ascending, `getAllTickets()` scan `list`/`index`/`pull` use, so a gate on any ticket above the cliff (561 that day) was invisible to it.

## Decision — what changed, and why (each trade-off named explicitly)

Four shapes were on the table for the general (no-`mode`) read: **raise the cap** · **order descending** · **paginate** · **filter server-side**. None of them alone is a complete fix for every surface, so this story applies each where it actually closes the risk:

1. **`gates` and `audit` — filter server-side (the real fix for these two).** These answer "what needs a human decision" and "does the newest work conform" — a bounded, client-side-filtered slice of "all tickets ordered by number" is a WRONG answer there, not a partial one, because the exact rows that matter (an open gate, a brand-new non-Done story) are exactly the ones a number-ordered cap is likeliest to drop. `mode=gate` (`state=AWAITING_GATE OR changesRequested=true`) and `mode=audit` (`type=EPIC OR state!=DONE`) are targeted Prisma `where` clauses run instead of the general scan — their result sets are inherently small (2 and ~155 rows today respectively, see the ground-truth check above) and their correctness does not depend on the cap's size or direction at all. This is the part of the fix that is NOT a deferral — it holds regardless of how large the total ticket count grows, as long as the *open-gate* / *non-Done* subsets themselves stay under the (generous, defensively-still-capped) `TICKET_LIST_TAKE_CAP`.
2. **`list`/`index`/`pull`/the `/status` board — raise the cap + order descending (a deliberate, named deferral).** These surfaces intentionally show "everything" (bounded), so there is no equivalent targeted filter to fall back on. Raising `500 → TICKET_LIST_TAKE_CAP = 1000` (`lib/delivery/validations.ts`) buys real headroom today (534 < 1000, so this read is actually complete right now, not just "less wrong") but is explicitly a deferral, not a structural fix — **it next bites once unarchived tickets exceed 1000** (at 534 today and climbing by ~30-40/day on an active arc, that's roughly 2-3 weeks out at the current pace, not months). Flipping `orderBy: number asc → desc` changes what happens WHEN it does bite: the rows dropped are now the OLDEST (lowest number, most likely long-settled `DONE`/`CANCELED` work), never the newest in-flight ticket — the exact inversion of the original defect's direction. Real pagination (a `{items, nextCursor}` response shape) or an archival policy (auto-archive `DONE`/`CANCELED` tickets past some retention window) are the actual structural fixes; both are out of scope here (`api.md`'s own rationalization table already names an unbounded response-shape change as something that "breaks the FE unless updated in the same story" — the `/status` board's flat-array consumers were not part of this dispatch's file surface).
3. **Truncation is never silent, on either path (`ops.md` "no silent caps").** `listTickets()` now returns the ticket array with `.total` (the real matching-row count, via `db.ticket.count`) and `.truncated` (`total > length`) attached as extra own properties (`TicketListResult`); `/api/tickets` projects them into the JSON body (`{tickets, total, truncated}`), and `scripts/ticket-sync.mjs` prints `⚠ TRUNCATED (<label>): the server returned N of M matching ticket(s)...` to stderr whenever `truncated===true`, for **every** read (`list`, `gates`, `audit` alike — belt-and-suspenders even though `gate`/`audit` are not expected to truncate today).

## Why `TicketListResult` is an array with extra properties, not `{tickets, total, truncated}`

Two existing, out-of-this-story's-file-surface tests pin the CURRENT contract shape exactly and would break on a naive redesign:
- `__tests__/delivery-tickets-api.test.ts` mocks the WHOLE `@/lib/delivery/tickets` module to an explicit object (no room for a new named export the route would need to call) and asserts `GET /api/tickets` returns **exactly** `{ tickets: [...] }` via `toEqual` (extra keys fail it) for a request with no `mode`.
- `__tests__/delivery-tickets-service.test.ts`'s own `listTickets` tests, and `__tests__/helpers/delivery-fake-client.ts` (the shared fake Prisma double both that file and `delivery-status-adapter.test.ts` use), call `listTickets()` expecting a plain array back (`.length`, `.every(...)`) and implement no `count()` method.

`TicketListResult = Ticket[] & { readonly total: number; readonly truncated: boolean }` (`Object.assign` on the real array) satisfies both: every existing caller that only destructures/iterates the array is unaffected, while `route.ts` reads `.total`/`.truncated` off the SAME return value with no new exported function and no new required Prisma capability on the test double. `NextResponse.json({tickets, total: tickets.total, truncated: tickets.truncated})` relies on a real, checked behavior — `JSON.stringify` drops `undefined`-valued keys — so when a caller's mock resolves a plain array (no `.total`/`.truncated` own properties), the response degrades to exactly the original `{tickets}` shape rather than lying with `truncated:false`. Verified directly: `__tests__/cam-595-tickets-route.test.ts`'s `[compat]` test asserts `"total" in body === false` for that case.

`countMatching()` (inside `lib/delivery/tickets.ts`) feature-detects `db.ticket.count` before calling it (`typeof db.ticket.count !== "function" → return null`) for the identical reason — the shared fake Prisma double has no `count()`. A real Prisma client always has one; a thrown `count()` error is logged structurally (`ticket_list_count_failed`, no secrets/PII) and treated as "unknown," falling back to a conservative length-based heuristic (`tickets.length >= TICKET_LIST_TAKE_CAP`) rather than ever asserting `truncated:false` on a guess.

## Reader/writer inventory — mandatory sweep (architecture.md §15b)

**Search method:** `grep -n "listTickets\b"` across `lib/`, `app/`, `scripts/` (every caller of the changed function) + `grep -n "take: 500\|500\b"` across `lib/delivery/*.ts`, `scripts/ticket-sync.mjs`, `app/api/tickets/route.ts` (every literal reference to the old cap) + reading `app/api/tickets/[id]/route.ts` and `app/status/**` to confirm neither reads `listTickets` directly.

| Reader/writer | Touches the changed read how | Action this story | Why |
|---|---|---|---|
| `lib/delivery/tickets.ts` `listTickets`/`buildTicketWhere`/`countMatching` | the read itself | **NOW** | the fix |
| `app/api/tickets/route.ts` GET | calls `listTickets(parsed.data)`, returns `{tickets}` | **NOW** — added `mode` query param + `total`/`truncated` response fields (additive) | projects the signal; accepts the new targeted filter |
| `lib/delivery/status-adapter.ts` `fetchTicketsFromDbRaw` | its OWN separate `db.ticket.findMany` (not `listTickets`) behind the `/status` board | **NOW** — same cap (imported constant, no longer a duplicated literal + comment-only promise), same `desc` order, a structured server-side log on truncation | closes AC-2 for the board's data source; see "Known gap" below for what did NOT change |
| `lib/linear.ts` (`StatusIssue` type) | consumed by `toStatusIssue`, unrelated to the read/cap | **NO-CHANGE** | out of this story's file surface; no field to add without extending the type — see "Known gap" |
| `app/status/**` (board UI) | renders `StatusIssue[]` from `fetchTicketsFromDb` | **NO-CHANGE, not touched** | out of this story's file surface (dispatch: "unless a response-shape change forces it, and if it does, say so" — flagged, not silently edited) |
| `scripts/ticket-sync.mjs` `getAllTickets`/`cmdList`/`cmdIndex`/`cmdPull` | call the general (no-`mode`) read | **NOW** — `getAllTickets()` prints the truncation warning; `list`/`index`/`pull` unchanged otherwise (they already re-sort locally by identifier, so the `desc`→display reorder is invisible to them) | closes AC-2 |
| `scripts/ticket-sync.mjs` `cmdGates` | used to client-side filter `getAllTickets()`'s result | **NOW** — calls the new targeted `getGateTickets()` (`mode=gate`) instead | closes AC-1, the story's headline defect |
| `scripts/ticket-sync.mjs` `cmdAudit` | used to fetch `getAllTickets()` then filter/build `buildEpicIndex` from it | **NOW** — calls the new targeted `getActiveOrEpicTickets()` (`mode=audit`) instead; `buildEpicIndex`/`isWorkTicket`/the `stories` filter logic itself is UNCHANGED (still correct over the smaller, complete input) | closes AC-3 |
| `app/api/tickets/[id]/route.ts` (single-ticket GET/PATCH) | does not call `listTickets` at all (`getTicketByIdentifier`, a separate `findUnique`) | **VERIFIED, NO-CHANGE NEEDED** | unrelated read path, not capped, not part of this defect |
| `lib/delivery/pulse.ts`, `lib/notify.ts`, `lib/github-dispatch.ts`, the 9 ADR-010 state-machine verbs | unrelated to reads | **VERIFIED, NO-CHANGE** | this is a read-only defect; no mutation/verb logic touched |

## Known gap (flagged, not silently dropped)

The `/status` web board's own truncation signal is **server-log-only**, not on-screen. `fetchTicketsFromDbRaw` returns `StatusIssue[]` (a plain array whose type is owned by `lib/linear.ts`, and every consumer of it lives under `app/status/**`) — both files are outside this dispatch's allowed surface, and the dispatch is explicit that a response-shape change forcing a UI edit should be *said*, not made quietly. This story instead emits a structured `console.warn({event:"status_board_ticket_list_truncated", total, returned, cap})` when the board's own read is truncated (visible to whoever watches server/Vercel logs), and gives the board's read the SAME direction/cap fix as the CLI (so in practice, at today's 534-ticket count, it is not truncated at all). Recommended follow-up if the owner wants an on-screen indicator: add an optional `truncated`/`total` pair to `StatusIssue` (or a sibling summary object) and a small banner in the board's list view — a two-file, out-of-surface change.

## API contract

`GET /api/tickets?state=&epicId=&archived=&mode=`

- `mode` ∈ `{"gate","audit"}`, optional. Mutually exclusive with `state`/`epicId` (zod `.refine`, 400 `invalid_query` on conflict — no new error code, reuses the existing one).
- Response (additive, backward-compatible): `{ tickets: Ticket[], total?: number, truncated?: boolean }`. `total`/`truncated` are present whenever the service layer computes them (always, in production); a caller whose own test double mocks `listTickets` to a plain array simply never sees them (`JSON.stringify` drops `undefined`).
- Error codes unchanged: `400` invalid query (incl. the new mode/state conflict) · `401` unauthorized · `429` rate-limited · `500` internal (generic, no stack — `ticketErrorResponse`, untouched).
- No authz change: same `STATUS_TOKEN` gate as every other `/api/tickets*` route (`isStatusRequestAuthorized`), unedited.

## ADRs

No new ADR — this is a read-path bug fix within the existing self-hosted-ticket design (ADR-010), not a new architectural decision. The performance-budget bounded-read rule (`.claude/rules/performance.md`) is upheld, not superseded.

Confirmation: `__tests__/cam-595-tickets-truncation.test.ts` (service layer — desc ordering + real ticket-number assertions on truncation, `mode=gate`/`mode=audit` targeted-query correctness, `TicketListResult` truncation-signal accuracy, `countMatching` resilience) + `__tests__/cam-595-tickets-route.test.ts` (API layer — `total`/`truncated` projection, the plain-array compat path, `mode` reaching the service call, the `mode`+`state` 400 conflict) + `listTicketsQuerySchema`'s own mode/state-exclusivity assertions (same file). Every pre-existing delivery test (`delivery-tickets-service.test.ts`, `delivery-tickets-api.test.ts`, `delivery-status-adapter.test.ts`, `delivery-boundary.test.ts`, `delivery-client.test.ts`, `delivery-pulse.test.ts`, `delivery-linear-source-switch.test.ts`, `delivery-verify-gate.test.ts`, `map-delivery.test.ts`, `ticket-sync-audit.test.ts`, `ticket-sync-args.test.ts`, `ticket-sync-mapping.test.ts`) passes UNEDITED — confirmed by running them (470/470 green), not by assumption.

## Real-DB behavioral proof (before / after)

Both against the actual shared delivery ticket DB (real CAM-594/CAM-595 rows) — "before" via the pre-fix deployed endpoint (`APP_BASE_URL` default, `https://campvibe-staging.vercel.app`, the same one the ticket's own measurement used); "after" via a throwaway local `next dev -p 3001` in this worktree (never the owner's `localhost:3000`, never restarted or shared), loading `DELIVERY_DATABASE_URL` from the main repo's `.env` the same way `ticket-sync.mjs` already does, torn down immediately after.

```
BEFORE
$ node scripts/ticket-sync.mjs gates
no gates open (no ticket AWAITING_GATE or changesRequested)
$ node scripts/ticket-sync.mjs list | grep -c '^  CAM-'
412
(highest CAM- number printed by `list`: 561)

AFTER  (APP_BASE_URL=http://localhost:3001, this story's code)
$ node scripts/ticket-sync.mjs gates
⏳ CAM-562 WAITING-ON-YOU   [backend-engineer] ...
⏳ CAM-587 WAITING-ON-YOU   [qa-engineer] ...
⏳ CAM-594 WAITING-ON-YOU   [qa-engineer] The navbar overflows the screen at a lar
3 waiting on you · 0 cleared
$ node scripts/ticket-sync.mjs list | grep -c '^  CAM-'
446
(highest CAM- number printed by `list`: 595)
$ node scripts/ticket-sync.mjs audit | grep -E "story ticket|not template-conformant"
98 story ticket(s) (74 BACKLOG pre-DoR skipped) · 17 not template-conformant ...
(CAM-594/CAM-595 both appear in the audit's not-yet-scaffolded list, confirmed present)
(no `⚠ TRUNCATED` line printed by `list` — 534 unarchived < the 1000 cap, so the general read is genuinely complete today)
```

## Links
`lib/delivery/tickets.ts` · `lib/delivery/status-adapter.ts` · `lib/delivery/validations.ts` · `app/api/tickets/route.ts` · `scripts/ticket-sync.mjs` · `.claude/rules/ops.md` ("no silent caps") · `.claude/rules/performance.md` (bounded-read rule) · `story.md`

## Changelog
- v1 (2026-07-28) — created.
