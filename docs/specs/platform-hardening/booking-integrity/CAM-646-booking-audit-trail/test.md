# CAM-646 — test

## AC -> test matrix

| AC/EC | Test | File | Result |
|---|---|---|---|
| AC-1, BR-5, BR-6 | camper cancels PENDING booking; exactly one AuditLog row, correct fields, no PII | cam-646 | pass |
| AC-2, load-bearing | identical PATCH body sent twice, only session.user.id differs -> actorRole 'camper' vs 'host' | cam-646 | pass |
| EC-2 | admin who is also the camper -> actorRole 'admin' | cam-646 | pass |
| AC-3 | stranger -> 403, nothing written | cam-646 | pass |
| 400 (Rules) | camper requests non-CANCELLED -> 400, nothing written | cam-646 | pass |
| EC-4 | unrecognized status -> 400 before any DB read | cam-646 | pass |
| AC-4, EC-3 | compare-and-swap conflict (count 0) -> 409; exactly one AuditLog row across both calls | cam-646 | pass |
| AC-5, BR-2 | no-op transition -> 409, no transaction opened | cam-646 | pass |
| EC-1, BR-3 | audit write rejects -> whole change fails (500), inverse of the notify contract | cam-646 | pass |
| BR-7 | rate limit full -> 429, no DB read | cam-646 | pass |
| CAM-682 regression | prisma mock updated to updateMany/findUniqueOrThrow/auditLog/$transaction shape; source pin widened for whitespace tolerance | cam-682 | pass (15/15) |

## Localhost dev-DB verification (real Postgres, no UI reader exists)

Connected directly to the dev DB running locally (campvibe, port 5432) since this worktree carries no .env.

Baseline confirmed before any write: `select count(*) from "Booking"` = 2619 (matches tech.md); `select count(*) from "AuditLog" where "entityType" = 'Booking'` = 0.

**Real cancel via the real PATCH handler** (auth mocked to a real seeded camper session; prisma NOT mocked, hit real Postgres): cancelled real booking `4f85be3a-d5b3-4a26-a727-0302a80b11b6` (was PENDING). Response 200. Read back:

```
entityType=Booking entityId=4f85be3a-... action=booking.status.update
actorId=f4af7ba6-... metadata={to:CANCELLED, from:PENDING, actorRole:camper, campSiteId:1b0c4c5f-...}
ipAddress=NULL userAgent=NULL
```

**Real concurrent-race proof against live Postgres** (stronger than the mocked AC-4 test): fired TWO real PATCH calls at the SAME real booking (`9cc90e45-...`, PENDING) via `Promise.all`, both requesting CANCELLED, no mocked prisma. Result: one 200, one 409 (the CAS's real `UPDATE ... WHERE status = 'PENDING'` naturally loses the race in Postgres); exactly ONE AuditLog row exists for that booking afterward. This is the strongest available proof of BR-1/EC-3 short of a UI.

Final dev-DB state: `AuditLog` where entityType='Booking' = 2 rows (the two verification cancels above); `Booking` count unchanged at 2619. Both throwaway verification test files were deleted before the PR — not part of the delivered diff.

## Self-verify commands (all green)

`npm run lint` 0 errors (353 pre-existing warnings, none new) - `npm run typecheck` clean - `npm test` 458 files / 12028 tests passed, 5 files / 25 tests skipped (pre-existing) - `npm run build` succeeded.
