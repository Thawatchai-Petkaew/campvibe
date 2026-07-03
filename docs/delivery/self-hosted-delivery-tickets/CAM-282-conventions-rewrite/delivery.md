---
linear: CAM-282
feature: self-hosted-delivery-tickets
epic: self-hosted-delivery-tickets (CAM-276)
persona: platform
artifact: delivery
owner: devops-release
status: In Progress
version: v1
updated: 2026-07-03
---
# Delivery — T-6 conventions rewrite (CAM-282)

## PR & preview

Not yet opened. This story's git-hygiene instructions were explicit: commit on
`docs/cam-282-conventions-rewrite` (branched off `staging`), **no push, no PR** as part of this pass.
Opening the PR + requesting merge is a follow-up action (`open-pr` skill), not done here.

## Staging verify

Pending — no PR/merge yet, so no Staging URL verification applies. Once merged: the only "AC" verifiable
on a real URL is that `/status` still renders correctly (unaffected — this story touches no runtime app
code besides workflow YAML prompt text and one test file) and that `docs/delivery/INDEX.md`/`/status`
still reflect the ticket DB, since none of the rewritten `.md`/`.yml` files are executed at request time.

## Migration

None. No `prisma/schema.prisma` or `prisma/delivery/schema.prisma` change in this story.

## Release

Not applicable yet (pre-merge). No git tag, no changelog entry, no rollback plan beyond the ordinary
`git revert` of this commit if a rewritten convention turns out to be wrong — every prior command surface
(`scripts/ticket-sync.mjs`, `lib/delivery/*`) is unchanged by this story, so reverting the docs/workflow
diff carries zero runtime risk.

## Error watch

Not applicable — no deploy from this story (docs + CI prompt text + one test file only).

## Links

`story.md` (this folder) · `.claude/rules/ops.md` · `.claude/SYNC-ARCHITECTURE.md` (rewritten by this
story) · `lib/delivery/PORTABILITY.md` (authored by this story)

## Changelog

- v1 (2026-07-03) — created (T-6, conventions rewrite; PR/release sections pending — not yet opened)
