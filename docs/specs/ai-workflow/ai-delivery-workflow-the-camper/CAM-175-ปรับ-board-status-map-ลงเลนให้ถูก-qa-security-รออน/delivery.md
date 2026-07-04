---
linear: CAM-175
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: delivery
owner: devops-release
status: In Progress
version: v1
updated: 2026-06-25
---
# Delivery — ปรับ board /status/map ลงเลนให้ถูก (QA/Security/รออนุมัติ = ตรวจสอบ) + แก้ข้อมูลล่าช้า (CAM-175)

## PR & preview

PR: pending (opened against `staging`, see step output)
Branch: `feat/cam-175-status-board-lanes`
Vercel preview: auto-generated on PR open (ephemeral, linked in PR)

## Gate results

- G1 Scope: PASS (story.md authored, gaps closed)
- G2 Design: PASS (display/logic only — no visual/design changes; check:palette + check:ds PASS)
- G3 Merge gate (pre-merge quality gate):
  - lint: 0 errors
  - typecheck: clean
  - npm test: 2555 pass / 0 fail (boardColumnOf matrix 100% lines covered)
  - npm run build: success
  - npm audit --omit=dev: 0 high/critical
  - check:palette: PASS
  - check:ds: PASS
  - security self-check: clean (UI/derive logic only; no data/PII/secrets in diff)

## Staging verify

Verification to run after CI passes and orchestrator merges PR into `staging` (auto-deploy):

URL: https://campvibe-staging.vercel.app/status/map

| # | AC | Verify step | Expected |
|---|---|---|---|
| 1 | QA/Security role → ตรวจสอบ | Open board with a `[qa-engineer]` or `[security-reviewer]` story in progress | Card shows in **ตรวจสอบ** lane, not **กำลังทำ** |
| 2 | awaiting-you → ตรวจสอบ + รอคุณ badge | Open board with a story labelled `awaiting-you` | Card shows in **ตรวจสอบ** lane and retains **รอคุณ** badge |
| 3 | unstarted → To Do | Open board with a scoped (post-G1) but not-started story | Card shows in **To Do** lane |
| 4 | backlog → Backlog | Open board with an idea/uncommitted story | Card shows in **Backlog** lane |
| 5 | State change within ~15s | Trigger a status handoff via Telegram | Board updates within ~15 seconds (not ~1 minute) |
| 6 | /status dashboard agrees | Open https://campvibe-staging.vercel.app/status | Column counts match /status/map lanes |

Result: pending (awaiting G4 Staging sign-off)

## Migration

None — display/derive logic only. No schema, API, or data changes. No `prisma migrate` required.

## Release

Not yet promoted to production (awaiting G4 Staging sign-off, then G5 for prod promote).

Rollback plan (if regression found after merge to staging):
- Run: `git revert <merge-commit-sha>` on `staging` (or use `gh pr revert` via squash-merge commit)
- The revert re-deploys automatically to Staging via Vercel auto-deploy
- No migration to undo (no schema changes)
- Rollback thresholds: error rate >= 2x pre-deploy baseline OR > 10% of /status/* requests erroring → revert + notify

For prod release (G5, future):
- git tag: `v0.9.x` (to be cut at promote time)
- Changelog: append entry for CAM-175 board lane accuracy + freshness fix
- Promote: `staging` → `main` via `/promote-release --to prod` only

## Error watch

Pending — to be watched post-Staging-deploy (Sentry, /status/map error events for ~15 min window).
Thresholds: error rate >= 2x baseline or > 10% of requests erroring = revert + notify.

## Links

`story.md` · `tech.md` · `test.md` · `.claude/rules/ops.md`

## Changelog

- v1 (2026-06-25) — created; PR opened against staging; quality gate results recorded; Staging verification steps defined; no migration
