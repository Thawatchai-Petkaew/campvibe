---
linear: CAM-147
feature: discovery-search
epic: camper-discover-search (CAM-33)
persona: camper
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-06-23
---

# Delivery — แสดงคะแนนรีวิวจริงบนการ์ดและ map popup เลิก hardcode 4.8 (CAM-147)

## PR & preview

- PR: opened against `staging` (this G3 run)
- Preview: Vercel ephemeral preview (auto-comment on PR)
- Quality-gate (pre-PR, orchestrator-verified):
  - lint 0 errors
  - typecheck (strict) 0 errors
  - test 2079 pass / 0 fail (full suite green)
  - build success
  - `npm audit --omit=dev` 0 high / 0 critical
  - check:palette + check:ds PASS
  - security PASS (reviews stripped on all surfaces before client; no PII to client; no secrets)

## Migration

None. This story is a read-only change — it threads existing `Review.rating` / `Review.deletedAt` data through server-side includes and reuses the existing `computeAvgRating` / `roundAvgRating` helpers (from CAM-76). No new columns, no `prisma migrate` required; staging DB and prod DB are unchanged.

## Rollback plan

Code-only change (no DB migration). Rollback = **revert the squash-merge commit on `staging`**. This undoes changes to:

- `app/page.tsx`
- `app/wishlist/page.tsx`
- `components/CampgroundCard.tsx`
- `components/CampgroundGrid.tsx`
- `components/WishlistPageClient.tsx`
- `components/MapComponent.tsx`
- `components/CampgroundDetailClient.tsx`
- `locales/translations.json`
- `__tests__/cam-147-card-rating.test.ts`

No data change to undo. Safe to revert at any time.

## Staging verification plan (G4)

Open `https://campvibe-staging.vercel.app/`:

1. **Home page cards** — scan every visible campsite card. No card must display the hardcoded string `4.8`. Cards with 0 reviews must show "ยังไม่มีรีวิว" (correct AC-2 behavior). Cards with reviews show the real computed average.
2. **Wishlist page** (`/wishlist`) — log in as a camper with saved campsites; same check: no `4.8`, empty-state shows "ยังไม่มีรีวิว".
3. **Map popup** — open any campsite on the map marker popup; same check: real avg or "ยังไม่มีรีวิว", not `4.8`.
4. **Detail page** (`/campsites/[id]`) — verify the detail header shows real avg (or empty state) rather than `4.8`.

Note: staging DB currently has ~0 reviews, so almost all cards will show "ยังไม่มีรีวิว". This is correct AC-2 behavior and directly proves the hardcoded 4.8 is gone — the absence of `4.8` on any surface is the pass criterion at G4.

## Release (G5)

Pending — promote `staging`→`main` after G5 owner approval (release train with other Done stories).

Tag + changelog: to be authored at promote-to-prod time (not done yet).

## Error watch

Pending — watch Sentry for the agreed window after promote to prod (not yet at G5).

## Links

`story.md` (AC/Rules) · `design.md` · `tech.md` (approach, helpers reused) · `test.md` · `review.md` (security PASS) · `.claude/rules/ops.md`

Changed files: `app/page.tsx` · `app/wishlist/page.tsx` · `components/CampgroundCard.tsx` · `components/CampgroundGrid.tsx` · `components/WishlistPageClient.tsx` · `components/MapComponent.tsx` · `components/CampgroundDetailClient.tsx` · `locales/translations.json` · `__tests__/cam-147-card-rating.test.ts`

## Changelog

- v1 (2026-06-23) — created; PR opened → staging; gate green (2079/2079 tests, 0 lint/type, build ok, 0 high/critical audit, security PASS); no migration; staging verify plan noted; rollback = revert squash-merge on staging (code-only); G5 pending
