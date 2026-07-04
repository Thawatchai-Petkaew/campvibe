---
linear: CAM-280
feature: self-hosted-delivery-tickets
epic: self-hosted-delivery-tickets (CAM-276)
persona: platform
artifact: delivery
owner: devops-release
status: In Progress
version: v1
updated: 2026-07-03
---
# Delivery — T-4 import 275 ใบจาก Linear + parity check บอร์ด (CAM-280)

## PR & preview
No PR opened yet (explicitly out of scope for this pass — "No push/PR" per the task). Branch
`feat/cam-280-linear-import` off `staging` (base HEAD `2d533f2`), commits:
- `76bd165` feat(delivery): T-4 linear import + parity scripts (CAM-280)
- `97c60d6` fix(delivery): parity-check — don't conflate archived-total vs live 250-cap count (CAM-280)

Scope authored: `scripts/import-linear.mjs`, `scripts/parity-check.mjs`,
`scripts/lib/import-mapping.mjs`, `__tests__/import-mapping.test.ts`, `package.json` scripts,
`.gitignore` allow-list entries.

## Staging verify
Not applicable yet — no PR/merge in this pass. What WAS verified for real, against live systems,
in lieu of a Staging AC walk (per the task's own "Verify (no live delivery DB yet)" section):

- `node scripts/import-linear.mjs --dry-run` run live against the real Linear API (team CAM,
  `LINEAR_API_KEY` from local `.env`) — fetched all 282 issues (3 pages of 100,
  `includeArchived: true`), mapped, printed summary counts, wrote nothing. See the T-4 handoff
  report for the full counts.
- `node scripts/parity-check.mjs` run live against the real Linear API + the real deployed
  `campvibe-staging.vercel.app/api/tickets` endpoint — confirmed the documented graceful
  degradation path: `GET /api/tickets` → 401 (STATUS_TOKEN/DB-not-provisioned) → prints a clear
  "DB side unavailable... db not provisioned" message + linear-only summary → exits 2 (not a
  crash, not a silent skip).

## Migration
None in this story. `prisma/delivery/schema.prisma` (T-1) is unchanged; this story only writes
data through the existing schema via the generated delivery Prisma client — no new migration.
DELIVERY_DATABASE_URL is not provisioned on any environment yet (owner action, ADR-010 §G2) —
`scripts/import-linear.mjs`'s real (non-`--dry-run`) write path has not been run against a live
database and must not be, until that env var exists (see the script's own header comment).

## Release
Not applicable — this story does not reach Done/Released in this pass (no merge to `staging`).
When it does, the release path is: merge → `staging` (G3) → owner provisions
`DELIVERY_DATABASE_URL` → `node scripts/import-linear.mjs --dry-run` re-verified → real
`node scripts/import-linear.mjs` run once against the staging delivery DB → `node
scripts/parity-check.mjs` run again (expect `PARITY OK`, exit 0) → AC verified on the real
Staging URL → Done. Rollback plan (if the real import needs to be undone): the script is
idempotent by `identifier` upsert — there is no destructive delete path in the script itself; a
bad import is rolled back by truncating the delivery DB's `Ticket`/`TicketComment`/`TicketEvent`
tables (all newly-imported data, no product-DB impact — separate database entirely per ADR-010)
and re-running the corrected script. No `git tag`/changelog yet (that is a prod-promote artifact,
not applicable to an unmerged authoring pass).

## Error watch
`pending` — no deploy has happened in this pass.

## Known issues flagged (not fixed in this story — out of scope, surfaced for the architect/owner)
1. **Type-classification edge case** (`scripts/lib/import-mapping.mjs` `mapType()`): 11 legacy
   "Epic · Story"-titled, parentless, project-bearing tickets (CAM-12..18, CAM-128..131) get
   classified `type=EPIC` by this story's literal given rule ("parentless + project ⇒ EPIC"),
   though they are real STORY-level work. Confirmed against live data; implemented literally per
   the given spec; flagged for the architect/owner to confirm before the real import ever runs.
2. **Pre-existing `lib/linear.ts` `first:250` cap**: the live `/status` dashboard's Linear query
   has no pagination. Team CAM has 282 issues total (223 non-archived, confirmed live via
   `parity-check.mjs`) — currently under the 250 cap but only 27 away from it; will start
   silently truncating the oldest issues once non-archived issues cross 250. Pre-existing,
   out of scope for this story — a real follow-up ticket candidate.
3. **`cancel` label vs Linear `Canceled` state**: 11 real tickets carry a `cancel` label while
   their Linear `state.type` is still `backlog`/`unstarted` (never actually moved to Linear's
   Canceled workflow state). Not one of this story's named label conventions, so it lands in
   `legacyLabels` only (no data loss) — noted as an observed data quirk, not fixed here.

## Links
`story.md` (not yet authored — no ticket body was provided verbatim for this pass; see Linear
CAM-280 for the source) · `.claude/rules/ops.md` · `docs/adr/ADR-010-self-hosted-delivery-tickets.md`

## Changelog
- v1 (2026-07-03) — authored `scripts/import-linear.mjs` + `scripts/parity-check.mjs` +
  `scripts/lib/import-mapping.mjs` (46 unit tests); dry-run verified live against Linear;
  parity-check verified live in linear-only degradation mode. Not merged.
