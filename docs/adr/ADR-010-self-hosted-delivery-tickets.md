# ADR-010 — Self-hosted delivery tickets: schema, state machine, and module boundary

**Status:** Accepted (retro-flipped 2026-07-04 — shipped on staging: `prisma/delivery.prisma` + `scripts/ticket-sync.mjs` live since 2026-07-03; CAM-276 epic 10/10 Done) · **Epic:** Self-hosted Delivery Tickets (CAM-276) · **Story:** CAM-277 (T-1) · **Date:** 2026-07-03

## Context

The AI-delivery pipeline tracks every epic/story/gate as a Linear issue (team `CAM`). Linear's free tier caps out at 275 issues — we hit that cap. Continuing to create tickets (this very story would be one) is no longer possible on the free plan, and the pipeline runs pre-launch with no revenue, so paying for Linear is a cost the owner wants to avoid rather than a cost tied to a real business need.

Beyond the cap, three more problems compound the "just pay for Linear" option:

1. **State discipline.** Linear's own workflow states are generic (`backlog`/`unstarted`/`started`/`completed`/`canceled`). Everything specific to *this* pipeline — gate-wait (`awaiting-you`), role attribution (`role:*` / `[role]` title tag), regression counts (`regression:<role>:<n>`), epic grouping (a `·`-prefixed title, because Linear's native parent/project features were only partially adopted) — is bolted on as **labels and title-string conventions**, enforced by nothing. Nothing stops a script, a slip, or a race in the GitHub-automation webhook from setting a ticket `Done` when it shouldn't be — which is exactly what happened (see CLAUDE.md's own framing: *"the Linear era used states loosely — Done set randomly by GitHub automation, gates as labels"*). Staying on Linear does not fix this; the discipline would still have to be built as a wrapper service on top of Linear's mutation API, at which point half of "our own tracker" is already built without owning the data.
2. **Ownership.** The full audit history of an AI-orchestrated delivery pipeline (275+ issues, and growing) is a genuinely unusual dataset — it is the record of how this entire codebase was built. It living only inside a third party's database, subject to their export tooling and rate limits, is a portability risk the owner wants to close now rather than later.
3. **Event latency.** `/status` refresh today depends on `lib/linear.ts` (60s `unstable_cache`) plus `lib/status-pulse.ts`'s `StatusPulse.version`, bumped by an inbound **Linear webhook** on every issue change. Freshness is bounded by however long Linear takes to fire that webhook and our route to process it — a network hop and a third party's delivery guarantee sit between "a ticket changed" and "the dashboard knows." A self-hosted ticket means the same service call that mutates a `Ticket` can bump the pulse **in-process**, in the same request — no webhook, no external latency floor.

**Locked at G1 (not relitigated here):** strict separation from the CampVibe product (own schema file, own database, `lib/delivery/` module boundary, single project in v1 with design notes only for multi-project); a real, validated state machine with an audit trail; keep `CAM-###` identifiers, import the 275 legacy issues later (T-4); the schema must carry everything `lib/linear.ts`'s `StatusIssue` shape needs, so the future read-adapter can synthesize it without changing `lib/status-model.ts` / `lib/status-derive.ts` / `campsite-scene.tsx`.

## Decision

Ship a separate Prisma schema (`prisma/delivery/schema.prisma`) against a separate Postgres database (`DELIVERY_DATABASE_URL`), modeling the ticket as a real state machine with an append-only event ledger, and design the columns so a later read-adapter reproduces the legacy `StatusIssue` shape byte-for-byte with **zero changes** to the existing `/status` derive/model/render layer.

### Note — one path deviates from the literal file name requested

The story asked for a single file `prisma/delivery.prisma`. I put it at **`prisma/delivery/schema.prisma`** instead (its own folder) for a concrete, verified reason, not a style preference: Prisma 5.22's `migrate dev`/`migrate deploy` has **no flag to redirect the migrations folder** — I confirmed this against `npx prisma migrate dev --help` (options are `--schema`, `--name`, `--create-only`, `--skip-generate`, `--skip-seed`; no `--migrations-path` or equivalent exists in this Prisma major version). Prisma always writes/reads a `migrations/` folder as a **sibling of the schema file**. A flat `prisma/delivery.prisma` would therefore write its migrations into the *same* `prisma/migrations/` folder the product schema already owns — the two unrelated migration histories would interleave in one folder, and `prisma migrate dev --schema prisma/delivery/schema.prisma` would try to replay the product's migrations (which reference `CampSite`/`Booking`/... tables that do not exist in the delivery database) and fail outright the first time anyone ran it. Nesting the schema under `prisma/delivery/` gives it an isolated `prisma/delivery/migrations/` folder — genuine separation (per the G1 "own database" requirement), with no unsupported CLI flag required. The generated client output path (`prisma/delivery/generated/delivery-client`, gitignored) is unaffected either way.

I also skipped one item from the literal index list: the task listed `identifier` as one of four columns needing `@@index([...])`, but `identifier String @unique` already creates a unique index in Postgres — a second, non-unique `@@index([identifier])` on the same column would be a pure-waste duplicate index (extra write overhead, zero query benefit). I kept `@@index([state])`, `@@index([epicId])`, `@@index([archivedAt])` and relied on the existing unique index for `identifier`/`number` lookups.

### The state machine

```text
                         ┌────────────────────────────────────────────┐
                         │                                            │
   create           start(role?)      raiseGate        approve(nextRole) │
(none)──▶ BACKLOG ───────────▶ TODO ───────▶ IN_PROGRESS ───────▶ AWAITING_GATE ─┘
             │  \                 \              ▲   ▲                  │  │
             │   \  start(role)    \ start(role)  │   │  reject          │  │ complete
             │    \─────────────────┴─────────────┘   └──────────────────┘  │
             │                                                              ▼
             │                                                            DONE ──(release)──▶ DONE (releasedAt set)
             │
             │  cancel (from BACKLOG/TODO/IN_PROGRESS/AWAITING_GATE)
             ▼
          CANCELED ───reopen───▶ BACKLOG
```

`DONE` and `CANCELED` are the only terminal states of the guarded machine. `releasedAt` is **not a state** — `release` fires on an already-`DONE` ticket and only stamps a timestamp (Done ≠ Released, per `.claude/rules/ops.md`). `blocked` and `archivedAt` are orthogonal flags, not state-machine nodes (see below).

### Transition table (this becomes T-2's service-layer spec)

| From | To | Verb | Precondition | Side effects | Event (`kind`, `toValue`) |
|---|---|---|---|---|---|
| *(none)* | `BACKLOG` | `create` | — | assign `number`/`identifier`; `roleHistory=[]`; `currentRole=null` unless known at creation | `created`, `"BACKLOG"` |
| `BACKLOG` | `TODO` | `start()` *(no role arg)* | `state=BACKLOG` | queue/triage only — no owner yet | `state_change`, `"TODO"` |
| `BACKLOG` or `TODO` | `IN_PROGRESS` | `start(role)` | `state∈{BACKLOG,TODO}` | `startedAt = startedAt ?? now()` (first time only); `currentRole=role`; push to `roleHistory` if changed | `state_change`, `"IN_PROGRESS"` (+ `handoff` if role changed) |
| `IN_PROGRESS` | `AWAITING_GATE` | `raiseGate` | `state=IN_PROGRESS`, `currentRole≠null` | `gateRaisedAt=now()`; **`currentRole` unchanged** (still shows who raised it) | `gate_raised`, `"AWAITING_GATE"` |
| `AWAITING_GATE` | `IN_PROGRESS` | `approve(nextRole)` | `state=AWAITING_GATE` | not the terminal gate: `gateRaisedAt=null`; `changesRequested=false`; `currentRole=nextRole`; push `roleHistory` if changed | `approved`, `"IN_PROGRESS"` (+ `handoff` if role changed) |
| `AWAITING_GATE` | `DONE` | `complete` | `state=AWAITING_GATE` | the terminal gate (Staging sign-off, ops.md "Done"): `gateRaisedAt=null`; `changesRequested=false`; `completedAt=now()`; `currentRole` unchanged | `approved`, `"DONE"` |
| `AWAITING_GATE` | `IN_PROGRESS` | `reject` | `state=AWAITING_GATE` | `gateRaisedAt=null`; `changesRequested=true`; `regressionRound += 1`; `currentRole` **unchanged** (same role reworks it); no reason field (CAM-275c removed reject-reason UI) | `rejected`, `"IN_PROGRESS"` |
| `DONE` | `DONE` | `release` | `state=DONE`, `releasedAt=null` (idempotent guard — cannot double-stamp) | `releasedAt=now()`; no state change | `released`, `<ISO timestamp>` |
| `BACKLOG`/`TODO`/`IN_PROGRESS`/`AWAITING_GATE` | `CANCELED` | `cancel` | `state∉{DONE,CANCELED}` | `gateRaisedAt=null`; `currentRole`/`regressionRound`/`blocked` preserved as history | `state_change`, `"CANCELED"` |
| `CANCELED` | `BACKLOG` | `reopen` | `state=CANCELED` | `changesRequested=false`; `currentRole`/`regressionRound` preserved (not reset — full history kept) | `state_change`, `"BACKLOG"` |

**`start` is intentionally one verb, branching on whether a role is supplied** — this keeps the design inside the exact 9-verb vocabulary given in scope (`create/start/raiseGate/approve/reject/complete/release/cancel/reopen`) rather than inventing a 10th (`schedule`). This is a service-API-shape choice with **no schema impact either way** — flagged as an open item below for T-2 to confirm before implementing.

**Orthogonal flags (not part of the guarded machine, toggled independently of `state`):**

- `blocked` (Boolean) — a dependency stall; a ticket can be `IN_PROGRESS` *and* `blocked=true` at once. Toggle logs `TicketEvent{kind:"blocked", fromValue:"false"|"true", toValue:"true"|"false"}` (the same `kind` covers both directions — the `from`/`to` pair carries the direction).
- `archivedAt` (DateTime?) — soft-hide from active board views (e.g. legacy-import housekeeping), distinct from `CANCELED` (a real business outcome). Toggle logs `TicketEvent{kind:"archived", toValue:<timestamp>|null}`.

### Atomic columns replacing label/title hacks

| Old (Linear label/title convention) | New (atomic column) |
|---|---|
| `[role]` tag inside the title, parsed by regex (`lib/status-derive.ts roleOf`) | `currentRole DeliveryRole?` |
| `role:*` accumulated labels (workload attribution) | `roleHistory String[]` |
| `awaiting-you` label | `gateRaisedAt DateTime?` (`≠ null` ⟺ has the label) |
| `regression:<role>:<n>` summed labels | `regressionRound Int` (+ `currentRole` for the `<role>` part when the adapter re-synthesizes the label) |
| `·`-prefixed title = epic grouping key (string match) | `epicId String?` self-relation FK — a real join, not a title-string match |
| `released` label | `releasedAt DateTime?` (`≠ null` ⟺ has the label) |
| Linear `Project` = "feature" | `featureName String?` (no separate table in v1 — see Alternatives) |

### Separate schema + database (portability)

Everything lives behind `lib/delivery/` (module boundary) and its own Prisma client (custom `output`, never `@prisma/client`). The **duplicate-to-a-new-project** story the owner wants later becomes: copy `lib/delivery/` + `prisma/delivery/` into the new repo, point `DELIVERY_DATABASE_URL` at a fresh database, done — no filtering tables out of a shared dump, no untangling from product migrations.

**Multi-project, noted but not built:** v1 assumes one project (`CAM`) and one global numeric sequence (`number` + `identifier = "CAM-{number}"`). When a second project is real, the additive path is a nullable `projectKey String?` column (backfilled `"CAM"` for all existing rows) plus a per-project sequence — `identifier` keeps meaning "the globally displayed key," so nothing downstream breaks. Not building this now (no second project exists) — YAGNI per the architecture "lean" principle.

### Single mutation path, no webhook

Every ticket mutation (all 9 verbs + the 2 orthogonal toggles) goes through **one service module** in `lib/delivery/` that: (1) checks the precondition, (2) writes the `Ticket` row, (3) appends the matching `TicketEvent` row(s), (4) bumps `DeliveryPulse.version` — all in the same call (ideally one `$transaction`). There is no webhook layer to build or to lag behind, because nothing external mutates the ticket; this collapses the "mutate → webhook → pulse bump" chain from `lib/status-pulse.ts` into a single step.

### `StatusIssue` coverage — confirmed field-by-field

The future read-adapter (a later story) must reproduce `lib/linear.ts`'s `StatusIssue` exactly. Verified against `lib/status-model.ts` + `lib/status-derive.ts` (grepped for every read site, not assumed):

| `StatusIssue` field | Synthesized from | Note |
|---|---|---|
| `id` | `Ticket.identifier` | verbatim |
| `title` | `Ticket.title` | clean (no more baked-in `·`/`[role]` — those are now atomic columns) |
| `status` | `state` mapped: `BACKLOG→"Backlog"`, `TODO→"Todo"`, `IN_PROGRESS`/`AWAITING_GATE→"In Progress"`, `DONE→"Done"`, `CANCELED→"Canceled"` | `AWAITING_GATE` keeps the raw status "In Progress" for parity — the gate signal rides on `labels` below, matching today's behavior where `awaiting-you` is a label layered on top of an unchanged status |
| `statusType` | `BACKLOG→"backlog"`, `TODO→"unstarted"`, `IN_PROGRESS`/`AWAITING_GATE→"started"`, `DONE→"completed"`, `CANCELED→"canceled"` | — |
| `priority` | `PRIORITY[Ticket.priority]` | same 0..4 ordinal + name array already in `lib/linear.ts`; display string composed at read time (no UI-shaped column) |
| `labels[]` | synthesized, not stored raw: `"awaiting-you"` if `state=AWAITING_GATE`; `"released"` if `releasedAt≠null`; `persona` lower-cased if set; `role:<slug>` per `roleHistory` entry; `regression:<currentRole-slug>:<regressionRound>` if `regressionRound>0`; **plus `legacyLabels[]` appended verbatim** | this is the one field with no single source column — it is *composed*, by design (Buffet, not a raw table) |
| `url` | `legacyUrl` (imported rows) or a new internal `/status` deep link (new rows) | UI route is future work, not this story |
| `description` | `Ticket.description` | — |
| `startedAt` | `Ticket.startedAt` | — |
| `updatedAt` | `Ticket.updatedAt` (`@updatedAt`, Prisma-managed) | strictly fresher than Linear's webhook-relayed `updatedAt` |
| `completedAt` | `Ticket.completedAt` | — |
| `assignee` | `{ name: assigneeName, displayName: assigneeName, avatarUrl: null }` or `null` | confirmed via grep: `avatarUrl` is read at exactly one site (`app/status/page.tsx:343`) with a `roleIcon(...)` fallback when absent — `displayName`/`name` are typed but never read elsewhere. `avatarUrl:null` always takes that existing, already-exercised fallback path; no regression. |
| `project` | `{ id: featureName ?? "", name: featureName ?? "—" }` | confirmed via grep: `project.id` is never read structurally in `status-model.ts`/`status-derive.ts` — only `project.name` via `featureOf()`. `featureName` fully covers it. |
| `parent` | `{ id: epic.id, title: epic.title }` via the `epicId` FK join | strictly better than Linear's title-string match — a real join, cannot drift |

No field of `StatusIssue` is left unmapped; no schema column exists that this read path doesn't need (checked both directions).

### G2 config step (owner action, before T-2)

1. Create a new database named **"delivery"** under the existing Prisma workspace (Prisma Console — same workspace as the product DB, separate database).
2. Add `DELIVERY_DATABASE_URL` to Vercel (Preview scope, at minimum) and to local `.env` (not committed — `.env*` is gitignored).
3. T-2 runs `npm run delivery:migrate` (= `prisma migrate dev --schema prisma/delivery/schema.prisma --skip-seed`) to create + apply the first migration into the new database, then `npm run delivery:generate` to (re-)generate the client if needed (`delivery:migrate` already triggers generation unless `--skip-generate` is passed).

`--skip-seed` is deliberate: `package.json`'s `"prisma": { "seed": ... }` config is process-global (there is only one `seed` entry) and points at the **product** seed script. Without `--skip-seed`, `migrate dev` against the delivery schema would still try to invoke the product's `ts-node prisma/seed.ts` — harmless-at-best, a wrong-context failure at worst. A delivery-specific seed (if ever needed — e.g. to backfill a `DeliveryPulse` singleton row) is future work, not this story.

## Alternatives

### (b) Stay on Linear, pay for a paid tier

Rejected:

- The issue cap is a hard functional blocker regardless of budget tolerance — but even ignoring the cap, cost is unjustified for a pre-launch, no-revenue project (`docs/context/non-negotiables.md`: "No monetary cost without asking" — cost discipline is a standing constraint, not new).
- Paying does not fix the underlying problem this ADR exists to solve: Linear's states stay generic; every pipeline-specific concept (gate-wait, role attribution, regression count, epic grouping) would still be bolted on as labels/title-string conventions with no enforcement, because that logic is *ours*, not Linear's. We would still need to build a validating wrapper service around Linear's mutation API to get real transition guarantees — at which point we have built roughly half of "our own tracker" while still not owning the data.
- Ownership stays with a third party regardless of plan tier.

### (c) Same-schema tables (Ticket/TicketEvent inside `prisma/schema.prisma`, the product database)

Rejected:

- Directly reopens the exact problem the strict-separation requirement (locked at G1) exists to close: "duplicate this whole delivery feature set into new projects" would mean filtering specific tables out of a shared database dump — error-prone, and it makes the delivery module's backup/restore/scaling story permanently entangled with the product's.
- One shared `prisma/schema.prisma` means one shared migration history — a delivery-ticket schema change and a product schema change would land in the same linear migration timeline, forcing unrelated domains to validate against each other's migrations. This is exactly the "sharp boundary" principle in `.claude/rules/architecture.md` (#2: "the client never knows the DB; business knowledge lives in one service layer") extended to the schema level — a shared DB here creates a shared blast radius for two unrelated concerns.
- Delivery-ticket data (internal dev-ops metadata: who touched a ticket, when a gate was raised) has a different retention/compliance shape than customer data (PII/Financial, PDPA-scoped) in the product DB — keeping them apart avoids scope-creeping the product database's compliance boundary with unrelated internal tooling data.

### (d) Separate repository

Owner-considered, then explicitly deferred in favor of "same repo, separated module" (this decision). Rejected **for now**:

- A second repo means a second CI pipeline, a second Vercel project, and cross-repo dependency/versioning management — real operational tax for a solo-owner project, directly against the "Lean" iron rule (CLAUDE.md #6: "anything you add must answer how it makes the work better; otherwise cut it").
- The module still renders inside the existing Next.js app at the same public `/status` URL, reusing the same auth/session infra and `DESIGN.md` tokens/components — a separate repo would force either publishing an internal shared package or duplicating UI, which is the premature-abstraction anti-pattern the architecture rule warns against (nobody needs a second consumer of this UI yet).
- `lib/delivery/` + `prisma/delivery/` as an isolated **module** (not spread through the app) already gets the real benefit (decoupled data/logic, copyable later) without the tax. When a second real consumer of this module exists, the folder pair can be lifted into its own repo at that point — that is the actual moment this trade-off should be revisited, not now.

## Consequences

**Positive:**

- Delivers the portability goal directly: `lib/delivery/` + `prisma/delivery/` is a self-contained, copyable pair.
- Real state machine + append-only `TicketEvent` ledger: `Done` can never again be set by accident — every transition is a guarded service call with a logged before/after, closing the exact failure mode described in Context.
- Atomic columns (`currentRole`, `epicId`, `gateRaisedAt`, `roleHistory`, `regressionRound`, `releasedAt`) replace five separate label/title-parsing conventions with typed, independently queryable fields — confirmed byte-for-byte reproducible as the legacy `StatusIssue` shape, so `lib/status-model.ts` / `lib/status-derive.ts` / `campsite-scene.tsx` need **no changes** for this story or the next two.
- Pulse bump happens in the same service call as the mutation — `/status` freshness is no longer bounded by a third-party webhook's delivery latency.
- No more issue-cap ceiling; this database scales with our own Postgres plan, not Linear's free-tier limit.

**Negative / risks:**

- New operational surface: a second Postgres database to provision, back up, and monitor, and a second `DATABASE_URL`-equivalent env var to keep straight across Preview/Staging/Production (mitigated: same Prisma/Postgres toolchain, no new vendor).
- Import risk (T-4): 275 legacy issues must land without silent data loss. `legacyUrl`/`legacyLabels` exist specifically as a safety net for anything the atomic mapping above doesn't capture; the import script must be idempotent (safely re-runnable) and its row count diffed against Linear's issue count before it is trusted.
- `number`/`identifier` assume one global sequence for the `"CAM"` prefix; multi-project needs an additive `projectKey` later (noted above, not built).
- Rollback: `/status` is a public dashboard and must not go dark mid-cutover. The future read-adapter should be gated behind an env flag — proposed name `TICKETS_SOURCE` (`linear` | `delivery`, default `linear` until T-4's import is verified and diffed) — so a broken delivery read-adapter rolls back to the still-working Linear path with one env flip, no code redeploy. This mirrors the existing `COMING_SOON` flag pattern already in this repo for a similar all-or-nothing cutover.
- Two Prisma clients now run in the same Node process (the product's `@prisma/client` and this schema's custom-output client), each with its own connection pool. T-2 should confirm the delivery database's connection limit is provisioned independently, so a spike on one side cannot starve the other.

## Open trade-offs — for the human to choose at G2

1. **`start` as one overloaded verb vs. a distinct `schedule` verb** for `BACKLOG→TODO`. This ADR defaults to overloading `start(role?)` to stay inside the literal 9-verb list given in scope. No schema impact either way — purely a T-2 service-API-shape choice. Confirm before T-2 implements it.
2. **Does `reopen` ever apply to a `DONE` ticket** (a regression found after release), or does every post-release regression get a brand-new ticket that references the original? Default assumed here: **new ticket** (consistent with the "one atomic story" iron rule and how bug tickets already work in this repo). `reopen` in this design is scoped to `CANCELED→BACKLOG` only. If the owner wants `DONE→IN_PROGRESS` reopening, that is a real design addition (what happens to `completedAt`/`releasedAt`?) that should be decided explicitly, not inferred.
3. **`assigneeName`/`authorName`/`actor` as free-text `String` (PII) vs. a foreign key to a real `Person`/`User` table.** Proportionate for a solo-owner, AI-role-driven pipeline today (lean). If headcount grows beyond one real human approver, a stable-ID join table would be the more correct atomic design (link by ID, not by name string) — revisit then, not now.
4. **`TICKETS_SOURCE` cutover flag** — naming and default proposed above (Consequences); the actual read-adapter and its rollback wiring are a later story's responsibility, but the flag's existence and behavior should be confirmed now so T-2's schema/service design doesn't preclude it.

## Links

- Epic: Self-hosted Delivery Tickets (Linear CAM-276). Story: CAM-277 (T-1, this ADR + schema).
- Read-model reference (must stay reproducible): `lib/linear.ts` (`StatusIssue`), `lib/status-model.ts` (`buildModel`), `lib/status-derive.ts` (`stageOf`/`buildWorkload`/`envOf`/`boardColumnOf`/`epicBucket`).
- Real-time signal precedent: `lib/status-pulse.ts` (`StatusPulse` — the product-side pattern this ADR's `DeliveryPulse` mirrors, minus the webhook).
- Ops precedent for a rollback flag: the `COMING_SOON` gate flag (prod soft-launch).
- `.claude/rules/architecture.md` — Atomic Data Framework (Pixel · Set · Buffet), Resolution Boundary test, ADR lifecycle.
- `.claude/rules/ops.md` — Done ≠ Released; reversible migrations tested on Staging before prod.
