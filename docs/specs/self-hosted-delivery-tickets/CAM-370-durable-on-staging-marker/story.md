---
linear: CAM-370
feature: self-hosted-delivery-tickets
epic: self-hosted-delivery-tickets (CAM-276)
persona: platform
artifact: story
class: spec-lite
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-07-05
---
# Durable on-staging marker for the delivery tracker (CAM-370)

## Story
As a **Platform** team member (the orchestrator/owner reading `/status`), I want the delivery
tracker to durably record that a ticket rode a batched `dev`→`staging` promote, so that the
board's Dev/Staging/Prod lanes and the `set --add-label on-staging` CLI command reflect the
real dev-branch flow (ops.md §3) instead of silently no-op'ing ("labels are columns now").

Scope: mirrors the existing `releasedAt` one-way-stamp pattern (schema column + `release`
verb + `released` label synthesis + `envOf` lane bucketing), but re-stampable (a story can
ride more than one batched promote over its life) instead of idempotent-guarded. Internal
delivery-tooling story — no end-user-facing UI/Thai copy (the `/status` dashboard is an
owner/AI-team-only ops surface, not the CampVibe product).

Depends on: ADR-010 (self-hosted delivery tickets) · CAM-277/278/279 (the Ticket schema,
tickets service, and `ticket-sync.mjs` CLI this story extends) · the dev-branch-flow rewrite
of `.claude/rules/ops.md` (already merged) that defines the `on-staging` label.

## AC
Internal-tooling story — the AC below verifies mechanism correctness (schema/verb/CLI/board
lane), not "what an end user sees":

| # | Given | When | What is verified | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | a ticket is `DONE` with no `stagedAt` | `stage(id, actor)` is called (or `ticket-sync.mjs set <CAM> --add-label on-staging` / `ticket-sync.mjs stage <CAM>`) | `stagedAt` is stamped to now; `state` stays `DONE`; a `staged` `TicketEvent` is logged; a "Now on staging" Telegram message is sent | `Ticket.stagedAt` set; `DeliveryPulse` bumped | EC-1 |
| AC-2 | a ticket is `DONE` with `stagedAt` already set (rode an earlier promote) | `stage(id, actor)` is called again | `stagedAt` is overwritten with the new timestamp — no `already_staged`-style error (unlike `release`, this is re-stampable) | `Ticket.stagedAt` updated to the latest value | — |
| AC-3 | a ticket is in any non-`DONE` state | `stage(id, actor)` is called | the call is a silent no-op (ticket returned unchanged, no event, no notification); the CLI detects this from the returned ticket and prints a `⚠ on-staging requires state=Done…` warn line instead of a false "updated"/"staged" | no DB write | EC-2 |
| AC-4 | a ticket has `stagedAt` set (and no `released`) | the `/status` board renders its env lane (`envOf` / `deriveCapsuleStats`) | the ticket buckets into the **Staging** lane (previously: any `Done` ticket bucketed into Staging — CAM-370 corrects this so Staging means "on-staging", not merely "Done") | `StatusIssue.labels` carries `on-staging` (`lib/delivery/status-adapter.ts`, mirroring `released`) | EC-3 |
| AC-5 | `ticket-sync.mjs audit` runs | a ticket carries `stagedAt` set but `state !== DONE` (a data-integrity gap, not reachable via the API's own verbs) | audit prints `✗ <id> stagedAt is set but state=<X> (expected DONE) — integrity gap` and exits 11 | no DB write (read-only check) | — |

## Rules
- BR-1 `stage` only ever writes `stagedAt` while `Ticket.state === "DONE"`; for any other state it is a no-op (does not throw, does not mutate, does not log an event/notification). (proves AC-3)
- BR-2 `stage` is idempotent-but-**re-stampable**: unlike `release` (which throws `already_released` on a second call), calling `stage` on an already-staged, still-`DONE` ticket simply overwrites `stagedAt` with the new timestamp. (proves AC-2)
- BR-3 `envOf` precedence is `released` > `on-staging` > (else) `dev` — a `released` ticket always shows **Prod** even if `on-staging` is also present (a ticket normally rides `on-staging` before `released`, but precedence is defined regardless of history). (proves AC-4)
- BR-4 `ticket-sync.mjs set <CAM> --add-label on-staging` maps onto the `stage` verb (replacing the prior "labels are columns now" no-op warning); `--remove-label on-staging` remains a warn no-op (`stagedAt` has no remove-verb, same shape as `released`). A direct `ticket-sync.mjs stage <CAM>` subcommand is equivalent. (proves AC-1, AC-2)

## Edge cases
- EC-1 IF `stage` is called with no Telegram credentials configured THEN the stamp + event still commit (Telegram send failure is logged structurally and never fails the mutation — same no-throw policy as every other verb in `lib/delivery/tickets.ts`) (BR-1)
- EC-2 IF `set --add-label on-staging` is run across a batch of tickets where some are not yet `DONE` THEN the batch does not hard-fail on those tickets — each prints its own warn line and the run continues (BR-1)
- EC-3 IF a ticket carries `on-staging` AND `released` (rode a promote, then later shipped) THEN the board still shows it as Prod (BR-3), not Staging

## Data
- `prisma/delivery/schema.prisma`: `Ticket.stagedAt DateTime?` (nullable, no default) — added directly after `releasedAt`, same shape/classification (`[Public]`, not PII/Financial).
- Migration: `prisma/delivery/migrations/20260705130100_add_ticket_staged_at/` — `migration.sql` (`ALTER TABLE "Ticket" ADD COLUMN "stagedAt" TIMESTAMP(3);`) + a hand-written `down.sql` (`DROP COLUMN`), reversible — proven up→down→up against a local scratch Postgres database (never against the real delivery DB; this worktree has no `DELIVERY_DATABASE_URL`/`.env`). No backfill needed (nullable, no dependents).

## Seams & refs
- Reuse: `lib/delivery/tickets.ts` `release()` (the verb this mirrors) · `lib/delivery/status-adapter.ts` `toStatusIssue()` label synthesis · `lib/status-derive.ts` `envOf()` · `lib/status-map-model.ts` `deriveCapsuleStats()` (a pre-existing inline duplicate of `envOf`'s semantics, kept in parity here — no new duplication introduced) · `scripts/lib/ticket-sync-mapping.mjs` `mapLegacyLabel()` · `scripts/lib/ticket-sync-audit.mjs` (new pure `hasStagedAtIntegrityGap()`, same extraction pattern as `hasUnresolvedMarker()`).
- Refs: ADR-010 (`docs/adr/ADR-010-self-hosted-delivery-tickets.md`) · `.claude/rules/ops.md` §1/§3 (the dev-branch-flow 4-layer model + `on-staging` label definition this story implements).
- Reader/writer sweep (architecture.md 15b — `envOf` semantics changed, not just where it renders): grepped `envOf(` and `\.labels\b` across `app/status`, `lib/status*.ts`. Readers found: `lib/status-model.ts` `buildModel()`'s `byEnv` (NOW: reflects the corrected lane split, no code change needed — it already just calls `envOf`) · `lib/status-map-model.ts` `deriveCapsuleStats()`'s inline duplicate (NOW: updated in this story to match) · `app/status/map/campsite-overlays.tsx`'s Dev/Staging/Ship HUD bar (NOW: consumes `envLanes`/`capsuleStats` counts only, no direct `envOf` call — no code change needed, count source already corrected upstream) · `app/status/page.tsx` `ENV_META` Thai sub-copy (NOW: the "Staging" row's copy corrected from "Done · พร้อมขึ้น prod" to "on-staging · รอ G4" since it no longer means "any Done ticket").

## Out of scope
- Backfilling `stagedAt` for already-Done/on-staging tickets (e.g. CAM-368) → the orchestrator stamps this via the new `stage` verb after this PR merges, not via a migration data-backfill.
- Updating `docs/specs/self-hosted-delivery-tickets/epic.md`'s rollup table → left to the product-owner on the next epic-rollup pass (Lean — not required for this atomic story).
- A visual "Ship"-style distinct capsule/badge design for the Staging lane beyond the existing Dev▸Staging▸Ship pipeline bar → no new primitive; reuses the existing token-colored bar as instructed.

## Self-verify
- AC-1, AC-2, AC-3 → unit (`__tests__/delivery-tickets-service.test.ts` "stage — CAM-370" describe block, fake in-memory delivery client) + contract test (`__tests__/delivery-tickets-api.test.ts` dispatch-table row for `action: "stage"`).
- AC-4 → unit (`__tests__/status-env.test.ts` envOf, `__tests__/status-map.test.ts` deriveCapsuleStats, `__tests__/delivery-status-adapter.test.ts` label synthesis).
- AC-5 → unit (`__tests__/ticket-sync-audit.test.ts` `hasStagedAtIntegrityGap`).
- Story-specific: migration up→down→up proven against a local scratch Postgres database (transcript in the PR description + `down.sql`'s header comment); CLI mapping unit-tested (`__tests__/ticket-sync-mapping.test.ts` `on-staging` add/remove cases).
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost against the dev DB (ops.md dev-branch flow) — no new browser-visible flow to verify beyond the `/status` board (owner spot-check on the next `/status` load is sufficient; not a new interactive UI state).

## Changelog
- v1 (2026-07-05) — created
