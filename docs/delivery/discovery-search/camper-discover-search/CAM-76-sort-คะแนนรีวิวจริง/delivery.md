---
linear: CAM-76
feature: discovery-search
epic: camper-discover-search (CAM-33)
persona: camper
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-06-23
---
# Delivery — Sort คะแนนรีวิวจริง (CAM-76)

## PR & preview

- PR: [#127](https://github.com/Thawatchai-Petkaew/campvibe/pull/127) → base `staging` (merged; merge commit `58feb97`)
- Preview: Vercel ephemeral preview (auto-comment on PR)
- Quality-gate (pre-PR): lint 0 error · typecheck (strict) 0 errors · test **37/37 pass** (`lib/sort-utils.ts` 100% coverage on new code; full suite green) · build success · `npm audit --omit=dev` 0 high/0 critical · check:palette + check:ds PASS · security PASS (sort param allowlisted; reviews stripped before grid; `deletedAt:null` guard)

## Migration

None — this story is a query-layer + in-memory sort change only. Fields used (`Review.rating`, `Review.deletedAt`, `Review.campSiteId`) exist in the schema already. No `prisma migrate` required; staging/prod DB is unchanged.

## Staging verify plan (G4)

Open `https://campvibe-staging.vercel.app/?sort=rating`:

- The #1 campsite card's real average rating must be >= the #2 campsite's real average rating.
- Any campsite with no reviews must appear after all rated campsites.
- Note: staging DB currently has ~0 reviews, so the visible ordering difference is limited until reviews are seeded. The ordering logic is unit-verified at 100% coverage (`__tests__/sort-utils.test.ts`) including null-last placement, descending order, and the 40-cap. CAM-76 state → **Done** on Staging merge.

## Scale-guard follow-up (C-2.5)

The rating sort uses an in-memory approach valid for catalogs up to ~200 published campsites. When the catalog approaches that threshold, the follow-up is to add a stored `CampSite.avgRating Float?` column updated by a background job (flagged in `tech.md` and the SCALE GUARD code comment in `app/page.tsx`). Track as C-2.5 or a separate ticket before the catalog reaches that size.

## Release (G5)

Pending — promote `staging`→`main` after G5 approval (release train with other Done stories).

Rollback plan: no migration was run, so rollback = **revert the squash-merge commit on `staging`** (reverts `app/page.tsx` + `lib/sort-utils.ts` back to the `createdAt` fallback). Safe, no data change to undo.

Tag + changelog: to be authored at promote-to-prod time (not done yet).

## Error watch

Pending — watch Sentry for the agreed window after promote to prod (not yet at G5).

## Links

`story.md` (AC/Rules) · `tech.md` (approach, scale guard) · `test.md` (Prove-It) · `review.md` (security PASS) · `.claude/rules/ops.md` · `lib/sort-utils.ts` (new) · `app/page.tsx`

## Changelog

- v1 (2026-06-23) — created; PR opened → staging; gate green (37/37 tests, 0 lint/type, build ok, 0 high/critical audit, security PASS); no migration; staging verify plan noted; scale-guard follow-up C-2.5 tracked; G5 pending (rollback = revert squash-merge on staging)
