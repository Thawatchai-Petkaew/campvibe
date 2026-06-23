---
linear: CAM-79
feature: discovery-search
epic: camper-detail-reviews
artifact: delivery
owner: devops
status: In Progress
version: v1
updated: 2026-06-23
---
# Delivery — แสดงรีวิวจริงและดาวเฉลี่ยบนหน้า detail (CAM-79)

## Quality Gate (pre-merge, all verified locally)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors |
| `npm run typecheck` | clean |
| `npm test` | 1979 pass / 0 fail |
| Coverage on `lib/review-summary.ts` | 100% |
| `npm run build` | success |
| `npm audit --omit=dev` | 0 high / 0 critical (2 moderate pre-existing transitive, Next.js ecosystem) |
| `check:palette` + `check:ds` | PASS |
| Security review | PASS — authorId not exposed; deletedAt:null on both queries; STRIDE clean |

## Branch / PR

- Branch: `feat/cam-79-detail-reviews`
- PR: into `staging` (base = staging) — number recorded after merge below
- Merge commit: recorded after merge below

## Migration

**No migration.** This story is read-only — server-side `prisma.review.aggregate` + `prisma.review.findMany` queries only. The `Review` model, all fields used (`rating`, `content`, `authorId`, `campSiteId`, `createdAt`, `deletedAt`), and the `author` relation already exist in the schema. The `StatusPulse` model (previously migrated) is unrelated but also already live on staging and prod DBs. No `prisma migrate deploy` step is required for this story.

## Rollback Plan

Frontend-only change — no DB schema touched.

Rollback command (staging):
```
git revert <merge-commit-sha> --no-edit
git push origin staging
```

This reverts the squash-merge commit on `staging`, restoring the hardcoded "4.8" / "12 รีวิว" display. No DB rollback is needed; no data was written. Vercel auto-deploys on the revert push.

## Post-Merge Staging Verification Plan

URL: https://campvibe-staging.vercel.app

**AC-1 / AC-3 — campsite WITH reviews:**
1. Open a detail page of a campsite that has reviews seeded in the staging DB.
2. Expect: header area shows "{avg} ({n} รีวิว)" with a star icon (e.g. "4.2 (5 รีวิว)"); the booking widget on the right shows the same value.
3. Scroll to the reviews section — expect up to 10 review cards, each showing reviewer name, star rating, date, and content (if any).

**AC-2 / AC-4 — campsite WITHOUT reviews:**
1. Open a detail page of a campsite that has zero reviews in the staging DB.
2. Expect: "ยังไม่มีรีวิว" in the header/widget (no "0" or empty stars).
3. Scroll to the reviews section — expect the empty-state message "ยังไม่มีรีวิวสำหรับแคมป์นี้".

**Note:** If no campsite on staging DB currently has reviews, seed at least one `Review` row against an existing `campSiteId` before verifying AC-1/AC-3. The staging seed routes are guarded (`assertSeedAllowed`) and safe to use in the staging env.

## Artifacts

| Item | Value |
|---|---|
| Staging URL | https://campvibe-staging.vercel.app |
| Production URL | not yet released (G5 pending) |
| Git tag | none (staging only; tag at G5) |
| Changelog entry | none yet (at release) |
| Feature flag | none |

## Links

`story.md` · `review.md` · `tech.md` · `test.md` · `design.md`

## Changelog

- v1 (2026-06-23) — delivery artifact authored at G3 (merge to staging)
