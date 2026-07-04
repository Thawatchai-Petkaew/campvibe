---
linear: CAM-127
feature: reviews-reputation
epic: camper-post-trip-review (CAM-35)
persona: camper
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-06-22
---
# Delivery — Wishlist toggle on Campground Detail (CAM-127)

## PR & preview
- PR: [#87](https://github.com/Thawatchai-Petkaew/campvibe/pull/87) → base `staging`
- Preview: Vercel ephemeral preview (auto-comment on the PR)
- Quality-gate (pre-PR): lint 0err · palette · ds · typecheck · test 1584 pass (cov 90% stmt / 81.5% branch) · build · `npm audit --omit=dev` 0 high/critical · design gate PASS

## Migration
- **None** — reuses the existing `Wishlist` model + API (released under CAM-18). No `prisma migrate` needed; staging/prod DB unchanged.

## Staging verify (G4) ✅
- Verified on the real Staging URL (`campvibe-staging.vercel.app`) — toggle renders + AC structurally confirmed; **owner signed off G4 (2026-06-22)**; CAM-127 state → Done.
- Interactive DOM ACs (tap→toast→reload→guest modal) via Playwright e2e on Staging = follow-up (no jsdom in the unit runner; the toggle logic is now unit-covered via `lib/wishlist-toggle.ts`).

## Hardening (post-audit, this branch)
- Operator-PII passthrough on the detail page **fixed** (CAM-128): `operator` select narrowed to `{id,name,image,createdAt}`; `isOwner` via `operatorId`.
- Test integrity: toggle logic extracted to `lib/wishlist-toggle.ts` (100% covered) — tests now exercise shipped code, not a copy.
- `review.md` authored · artifact statuses synced to Done · follow-ups opened: CAM-129/130/131.

## Release (G5)
- _pending_ — promote `staging`→`main` after explicit G5 approval. No migration → rollback = revert the PR.

## Links
- story.md (AC/BR) · design.md · test.md · review.md · `.claude/rules/ops.md`
- security follow-up: CAM-128 (operator-PII passthrough, pre-existing)
