---
linear: CAM-342
feature: self-hosted-delivery-tickets
epic: self-hosted-delivery-tickets (CAM-276)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-07-04
---
# Active work on the map shows the model tier running it (trial instrumentation) (CAM-342)

## Story
As a **Platform owner**, I want the delivery map to show which model tier (`fable`/`opus`/`sonnet`/`haiku`) is running each active piece of work, so that I can attribute delivery output to a model tier straight from the board and feed the model-tier trial scorecard without cross-referencing dispatch logs (not measured).
Why: trial instrumentation — the visible tier feeds `docs/research/model-tier-trial.md`; today the running model is invisible on `/status/map`.
Scope: a model-tier chip on the ACTIVE agent card + a model row in the ticket detail modal on `/status/map`, sourced from a new stored `agentModel` on the ticket that the orchestrator stamps at dispatch/handoff. Read-only display; latest stamp wins.
Depends on: ADR-010 (self-hosted delivery ticket schema + adapter parity, CAM-276)

## AC
<!-- Then = user-visible (screen text = verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin (EC-n/AC-n). -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | An IN_PROGRESS ticket stamped with model tier `sonnet` | The owner opens the delivery map (`/status/map`) | The ticket's ACTIVE card (lane `กำลังทำ`) shows a small model chip reading `sonnet` | Card reads `Ticket.agentModel` through the read adapter; no write | EC-1 |
| AC-2 | An IN_PROGRESS ticket with no stamped model tier (`agentModel` empty) | The owner opens the delivery map | The ACTIVE card shows no model chip at all (no placeholder text, no empty chip) | Adapter passes an empty model through; the chip element is not rendered | EC-1 |
| AC-3 | A ticket stamped with model tier `sonnet` | The owner opens that ticket's detail modal | The modal meta shows a model row `โมเดล: sonnet` | Modal reads the adapter's model field; read-only | EC-2 |
| AC-4 | A legacy ticket with no stamped model tier | The owner opens that ticket's detail modal | The model row reads `โมเดล: —` | Adapter returns an empty model; the row renders the empty-value dash (parity with the existing `บทบาท: —` row) | EC-2 |
| AC-5 | An active ticket whose card chip currently reads `sonnet` | The orchestrator re-stamps the tier to `opus` at handoff and the owner reloads the map | The ACTIVE card chip now reads `opus` (the earlier `sonnet` is gone) | `Ticket.agentModel` is overwritten `sonnet`→`opus` (latest wins); no per-dispatch history row is kept | EC-3, EC-4 |
| AC-6 | A DONE ticket that still carries a stamped model tier | The owner opens the delivery map | The DONE card shows no model chip | The chip renders only on the ACTIVE card variant; state read-only | EC-5 |

## Rules
- BR-1 The allowed model-tier set is exactly `fable | opus | sonnet | haiku` (lowercase). A stamp value outside this set is rejected at the API boundary (a zod enum in `lib/delivery/validations.ts`, hand-written tuple to match the existing enum-tuple convention) with HTTP `400`, and `agentModel` is left unchanged — never stored. `agentModel` is nullable; default is null (no tier attributed yet). (proves AC-1, AC-3, EC-3)
- BR-2 Display is pass-through text of the stored `agentModel`. Empty/null → the ACTIVE card renders no chip element (EC-1) and the modal model row renders the empty-value marker `โมเดล: —` (EC-2). No fabricated placeholder tier is ever shown. (proves AC-2, AC-4)
- BR-3 The tier is stamped ONLY by the orchestrator, through the `handoff` and `updateFields` API verbs (each gains an optional `agentModel`) and the CLI flag `ticket-sync handoff --model <tier>`. Agents never self-report their own model. Latest stamp wins — a new value overwrites the previous. Omitting the model on a stamp leaves the existing value unchanged (never auto-cleared). (proves AC-5, EC-4)
- BR-4 The chip renders only on the ACTIVE card variant (the card whose lane reads `กำลังทำ`, i.e. `isActive`). Backlog / awaiting-gate / done / canceled cards render no chip regardless of the stored `agentModel`. The modal model row, by contrast, renders for a ticket in any state (it is a detail view, so it shows `โมเดล: —` when empty). (proves AC-6, EC-5)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF a ticket's `agentModel` is empty/null THEN the ACTIVE card renders no chip element — not a `—` placeholder, not an empty chip (BR-2)
- EC-2 IF a ticket's `agentModel` is empty/null THEN the modal model row renders the empty-value dash `โมเดล: —`, matching the existing role row (BR-2)
- EC-3 IF a stamp request carries a tier outside `fable|opus|sonnet|haiku` THEN the API rejects it with `400` and `agentModel` stays unchanged (never stored) (BR-1)
- EC-4 IF a `handoff`/`updateFields` stamp omits the model tier THEN `agentModel` is left unchanged — the field is optional and never accidentally cleared (BR-3)
- EC-5 IF a card is not the ACTIVE variant (backlog / awaiting-gate / done / canceled) THEN no chip renders even when `agentModel` is set (BR-4)

## Data
- New nullable column `agentModel` (type: String, nullable, default null · classification: Public — a model-tier label, no PII/financial) on `Ticket` in `prisma/delivery/schema.prisma` — the DELIVERY database (`DELIVERY_DATABASE_URL`), NOT the product DB (`prisma/schema.prisma`). Allowed values are enforced at the app boundary (zod enum), not as a Prisma enum, matching the hand-written enum-tuple convention in `lib/delivery/validations.ts` (keeps the zod module free of a generated-client dependency).
- Read adapter: `StatusIssue` (in `lib/linear.ts`) gains an optional `agentModel?: string | null`; `toStatusIssue` in `lib/delivery/status-adapter.ts` passes it through additively so existing consumers (`lib/status-model.ts`, `lib/status-derive.ts`, `campsite-scene.tsx`) are untouched (backward-compatible by addition).
- migration: reversible & additive — adds one nullable column, no backfill (existing rows read null → no chip / `—`); down migration drops the column with no data-loss risk (trial-only instrumentation). Tested on the delivery DB before use (ops.md: reversible + tested first). Migration mechanics (up/down SQL) are the architect/backend's to ratify at G2.

## Seams & refs
- Reuse (pointers, never implementation):
  - `prisma/delivery/schema.prisma` — `Ticket` gains `agentModel String?` (delivery DB).
  - `lib/delivery/tickets.ts` — `handoff(...)` + `updateFields(...)` (`UpdateTicketFieldsInput`) accept optional `agentModel`; latest-wins write.
  - `lib/delivery/validations.ts` — add an `AGENT_MODEL_TIERS` tuple + optional `agentModel` on the `handoff` and `updateFields` members of `patchTicketBodySchema`.
  - `scripts/ticket-sync.mjs` + `scripts/lib/ticket-sync-args.mjs` — `parseHandoffFlags` gains `--model`; the CLI maps it into the PATCH body.
  - `lib/delivery/status-adapter.ts` (`toStatusIssue`) → `lib/linear.ts` (`StatusIssue` additive field).
  - `app/status/map/campsite-overlays.tsx` — active card footer near `hud-card-role` (~L1243) renders the chip; the `hud-ticket-modal-meta` block (~L1911, sibling of the `บทบาท:` row) renders the `โมเดล:` row.
  - `__tests__/delivery-tickets-service.test.ts` · `__tests__/delivery-tickets-api.test.ts` · `__tests__/delivery-status-adapter.test.ts` + `__tests__/helpers/delivery-fake-client.ts` (`makeTicketRow` gains `agentModel: null`).
- Refs: ADR-010 (delivery ticket schema + StatusIssue parity)

### Seams correction (post-build, PR #324)
Render pipeline required 4 files beyond the original list — `lib/status-map-model.ts` (buildEpicStories enumerates fields explicitly), `app/status/map/campsite-scene.tsx` (MapEpicStory type), `app/api/status/issue/[id]/route.ts` (shapeIssueDetail — sole modal source), `app/api/tickets/[id]/route.ts` (handoff PATCH destructuring). Lesson: display-feature specs must trace source → API → model → component before writing Seams.

## Out of scope
- The `/status` board page columns / any surface other than `/status/map` (card + modal) → follow-up CAM if the trial needs it.
- A per-dispatch model history / stamped-tier timeline (only the latest value is stored) → future CAM if the scorecard needs per-hop attribution.
- Auto-deriving the tier from the dispatched agent's frontmatter (`.claude/agents/*`) — the orchestrator stamps explicitly instead → out of scope.
- Any product-DB (`prisma/schema.prisma`) change — this story is delivery-DB only.
- Populating / computing the `docs/research/model-tier-trial.md` scorecard from the stored data (the consumer) — this story only makes the tier visible + stored.

## Self-verify
- AC-1, AC-2, AC-6 → unit (`toStatusIssue` pass-through of `agentModel`) + owner-verify (browser-only: chip renders on an active stamped card, absent on unstamped/DONE cards).
- AC-3, AC-4 → owner-verify (browser-only: modal `โมเดล:` row shows the tier, or `—` for a legacy ticket).
- AC-5 → integration (service test: `handoff`/`updateFields` overwrites `agentModel`, latest wins, via the fake client) + unit (`parseHandoffFlags` parses `--model`).
- EC-3 → integration (API test: out-of-set tier → `400`, value unchanged) + unit (validations enum rejects the bad value).
- EC-4 → integration (stamp without `--model`/`agentModel` leaves the value unchanged).
- EC-1, EC-2, EC-5 → unit (adapter null pass-through) + owner-verify (no chip / `—` / no chip on non-active cards, on Staging).
- Story-specific: migration up→down→up on the delivery DB (reversible, additive, no backfill) · `StatusIssue` additive-field back-compat (existing consumers compile; existing adapter tests stay green) · validations enum-tuple drift guard (tuple matches the schema-allowed set) · orchestrator-only stamp path (no agent self-report surface added).
- Gate = /quality-gate · Done = every AC verified on the real Staging URL (`campvibe-staging.vercel.app/status/map`: chip on an active stamped card + `โมเดล: —` in a legacy ticket's modal).

## Changelog
- v3 (2026-07-04) — Seams corrected post-build (4 pipeline files)
- v1 (2026-07-04) — created
