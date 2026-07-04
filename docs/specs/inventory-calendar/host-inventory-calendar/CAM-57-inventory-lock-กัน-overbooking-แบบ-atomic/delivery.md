---
linear: CAM-57
feature: inventory-calendar
epic: host-inventory-calendar (CAM-22)
persona: host
artifact: delivery
owner: devops-release
status: In Progress
version: v1
updated: 2026-06-24
---
# Delivery — Inventory lock กัน overbooking แบบ atomic (CAM-57)

## PR & preview

- PR: see below (opened during G3 merge step)
- Branch: `feat/cam-57-atomic-inventory-lock` → `staging`
- Staging URL: https://campvibe-staging.vercel.app

## Gates passed (pre-merge)

| Gate | Result |
|---|---|
| `npm run lint` | PASS — 0 errors (pre-existing unused `request` warning on GET handler line 244, unchanged) |
| `npm run typecheck` | PASS — 0 errors |
| `npm test` | PASS — 2259 tests, 0 fail, 0 skip |
| `npm run build` | PASS |
| `check:palette` + `check:ds` | PASS (no UI changes in this story) |
| `npm audit --omit=dev` | PASS — 0 high/critical (2 moderate: postcss via next, non-actionable without breaking Next.js version) |
| Security review | PASS — verdict from `review.md`: userId from NextAuth session only, no raw SQL, parameterized Prisma inside Serializable tx, no P2034/Postgres internals in HTTP response, bounded retry (4 max DB attempts), non-P2034 errors do not retry, no partial write, BlockedDate soft-delete guard in place |

## Migration

None. This story is entirely application-code changes (`app/api/bookings/route.ts`, `lib/campsite-availability.ts`). No schema change, no new columns, no new tables. `npx prisma migrate dev` produces an empty migration (confirmed). `npx prisma migrate deploy` on staging and prod: no-op.

## Staging verify (G4 required before Done)

The unit/integration tests in `__tests__/cam-57-atomic-lock.test.ts` cover retry logic, capacity math, and contract strings. They CANNOT simulate real multi-process Postgres Serializable conflict (P2034) because that requires two simultaneous real transactions from different OS processes.

**G4 staging concurrency verification (required — cannot be unit-tested):**

After merge to staging deploys, run the following script against `campvibe-staging.vercel.app` with a real auth cookie and a seeded campsite+spot:

```
node -e "
const CAMP_ID = '<staging-campsite-id>';
const SPOT_ID = '<staging-spot-id>';
const TOKEN   = '<staging-auth-cookie>';
const BASE    = 'https://campvibe-staging.vercel.app';
const body    = JSON.stringify({ campSiteId: CAMP_ID, spotId: SPOT_ID,
                  checkInDate: '2026-09-01', checkOutDate: '2026-09-02', guests: 2 });
const headers = { 'Content-Type': 'application/json', Cookie: TOKEN };
Promise.all([
  fetch(BASE + '/api/bookings', { method: 'POST', body, headers }),
  fetch(BASE + '/api/bookings', { method: 'POST', body, headers }),
]).then(async ([r1, r2]) => {
  console.log('R1:', r1.status, await r1.json());
  console.log('R2:', r2.status, await r2.json());
  const s = [r1.status, r2.status].sort();
  if (JSON.stringify(s) === '[201,409]') console.log('PASS');
  else { console.error('FAIL', s); process.exit(1); }
});
"
```

Pass criteria:
- Exactly one `201` and one `409` per run.
- DB: `SELECT COUNT(*) FROM "Booking" WHERE "campSiteId"='...' AND status!='CANCELLED'` = 1.
- Repeat 10 times (no flakiness).
- p95 < 1000ms at 50 concurrent requests (load note — measure with k6 or wrk on staging).

AC verification on staging URL:

| AC | Staging verify | Result |
|---|---|---|
| AC#1 — Race: first 201, second 409, 1 booking in DB | Run concurrency script 10x | pending G4 |
| AC#2 — Capacity exceeded (8+3>10) → 409 "Capacity exceeded" | POST with guests=3 to a campsite with 8 booked on that day | pending G4 |
| AC#3 — Concurrent capacity race → exactly 1 wins | Run concurrency script with maxGuestsPerDay seeded | pending G4 |
| AC#4 — BlockedDate inside tx → 409 | POST to dates covered by a BlockedDate | pending G4 |
| AC#5 — Available dates → 201, response shape unchanged | Normal happy-path POST | pending G4 |
| AC#6 — DB error → rollback, 500, no partial write | (hard to force in staging; covered by unit test) | N/A staging |

Status: pending — awaiting G4 sign-off after staging deploy verification.

## Release

Not released. This delivery artifact covers G3 (merge to staging = Done).

When G4 sign-off is received and promote to prod (G5) is authorized:

- Rollback plan: `git revert <merge-sha>` on `main` and re-deploy (code-only, no migration to reverse). The revert restores the pre-CAM-57 POST handler (unlocked reads). No data is at risk: no schema change was made.
- git tag: `vX.Y.Z` to be cut at G5 promote.
- Changelog entry: to be appended at G5 promote.
- ADR-006 reference: `docs/adr/ADR-006-booking-atomic-inventory-lock.md`.

## Error watch

Pending — post-deploy Sentry error watch runs after G5 prod deploy. Rollback threshold: error rate >= 2x pre-deploy baseline or > 10% of booking POST requests erroring.

## Links

`story.md` · `tech.md` · `test.md` · `review.md` · `docs/adr/ADR-006-booking-atomic-inventory-lock.md` · `.claude/rules/ops.md`

## Changelog

- v1 (2026-06-24) — created by DevOps/Release (The Camper); G3 merge step; gates PASS; migration: none; rollback plan: revert squash-merge on staging/main (code-only); G4 staging concurrency verification step documented
