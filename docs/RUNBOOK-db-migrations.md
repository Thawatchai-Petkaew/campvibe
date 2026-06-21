# Runbook — DB migrations during the Atomic Schema refactor (pre-launch)

The Atomic Schema epic (Linear CAM-96) ships **breaking** schema migrations. Production is **pre-launch (no real data)**, so the strategy is **clean breaking migration + reset + re-seed** per story — no backfill / expand-contract. "Reversible" = a tested reset/reseed path + the prior migration set (no hand-written down-SQL). See ADRs in `docs/adr/`.

## Per-story flow

### Local (before opening the PR)
```bash
npx prisma migrate dev --name <story_slug>   # create + apply migration locally
npx prisma migrate reset --force             # drop → re-apply all migrations → run seed
# ^ proves the end-state seed is enum/Decimal/relation-valid — the key regression guard
npm run lint && npm run typecheck && npm run build && npm test
```

### Staging (at merge → `staging` = Done)
`vercel-build` runs `prisma migrate deploy`, which only applies migrations **forward**. A breaking migration against an existing staging DB will fail to apply → **reset staging first**, then let deploy + seed run clean (safe: no real data):
```bash
ALLOW_DB_RESET=1 DATABASE_URL="<staging-connection-string>" npm run db:reset:staging
```
Then verify the story's AC on the real Staging URL → Linear `Done`.

### Production (G5 release boundary, still pre-launch)
Reset prod once when promoting the epic (or a milestone slice), guarded:
```bash
ALLOW_DB_RESET=1 DATABASE_URL="<prod-connection-string>" npm run db:reset:staging   # guard refuses if url/env looks prod
```
> ⚠️ The guard blocks targets that look like production. Once real users exist, **stop using reset** — switch to expand→backfill→contract (see ADR-000 cross-cutting note).

## Guard (`scripts/db-reset.mjs`)
Refuses unless `ALLOW_DB_RESET=1` + `DATABASE_URL` set + target not production-flagged. Masks credentials in logs.
