---
linear: CAM-127
feature: reviews-reputation
epic: camper-post-trip-review (CAM-35)
persona: camper
artifact: delivery
owner: devops-release
status: In Review
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

## Staging verify (G4)
- _pending_ — verify AC-1..5 on the real Staging URL (`campvibe-staging.vercel.app`) after merge:
  logged-in tap → heart fills + `บันทึกแล้ว` + toast → reload keeps saved → untap removes → guest tap opens login modal (`เข้าสู่ระบบเพื่อบันทึกแคมป์นี้`).
- On pass → `linear-sync set CAM-127 --state Done --remove-label awaiting-you`.

## Release (G5)
- _pending_ — promote `staging`→`main` after the audit + improvement round + explicit G5 approval. No migration → rollback = revert the PR.

## Links
- story.md (AC/BR) · design.md · test.md · review.md · `.claude/rules/ops.md`
- security follow-up: CAM-128 (operator-PII passthrough, pre-existing)
