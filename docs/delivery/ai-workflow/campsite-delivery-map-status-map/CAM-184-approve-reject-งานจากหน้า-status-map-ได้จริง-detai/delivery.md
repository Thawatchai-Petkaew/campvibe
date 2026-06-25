---
linear: CAM-184
feature: ai-workflow
epic: ai-delivery-workflow-the-camper
persona: platform
artifact: delivery
owner: devops-release
status: In Progress
version: v1
updated: 2026-06-26
---
# Delivery — Interactive Approve/Reject + Detail Modal + Visual Polish on /status/map (CAM-184)

## PR & preview

PR: pending (opened this session — see PR number in DevOps handoff output)
Branch: `feat/cam-184-map-approve-reject`
Staging auto-deploy: `campvibe-staging.vercel.app` (triggers on merge to `staging`)

## Quality gate results (orchestrator-verified, pre-commit)

| Gate | Result |
|---|---|
| `npm run lint` | PASS — 0 errors (249 warnings; +1 Suggestion vs baseline; pre-existing 248) |
| `npm run typecheck` | PASS — 0 errors |
| `npm test` (vitest) | PASS — 2704 tests, 0 failures (51 test files) |
| `npm run build` | PASS |
| `npm run check:palette` | PASS |
| `npm run check:ds` | PASS |
| Security audit (6-area) | PASS — 0 Critical, 0 Important blockers |
| `npm audit --omit=dev` | PASS — 0 high/critical |
| QA endpoint coverage | PASS — approve 88.88%, reject 90.62%, issue/[id] 92% (all ≥80%) |

## Staged files (explicit — no public/mockup, no app/layout.tsx)

| Path | Status |
|---|---|
| `app/api/status/approve/route.ts` | NEW |
| `app/api/status/reject/route.ts` | NEW |
| `app/api/status/issue/[id]/route.ts` | NEW |
| `lib/linear-actions.ts` | MODIFIED — addLabel() helper |
| `lib/rate-limit.ts` | NEW — 20 req/min/IP limiter |
| `app/api/linear-webhook/route.ts` | MODIFIED — looksApproved + looksRejected |
| `app/status/map/campsite-overlays.tsx` | MODIFIED — amber ApprovalCard + GateDetailModal + approve/reject fns |
| `app/status/map/campsite-scene.tsx` | MODIFIED — .you-alert resize + popover suppress + neutral borders |
| `.claude/agents/orchestrator.md` | MODIFIED — reject-loop gate continuation docs |
| `__tests__/status-approve-endpoints.test.ts` | NEW — 31 contract tests |
| `__tests__/cam-184-approve-reject-ui.test.ts` | NEW — 25 UI guard tests |
| `__tests__/cam-182-quest-approval-ui.test.ts` | MODIFIED — 4 tests updated for CAM-184 design changes |
| `docs/delivery/ai-workflow/ai-delivery-workflow-the-camper/CAM-184-*/design.md` | EXISTS |
| `docs/delivery/ai-workflow/ai-delivery-workflow-the-camper/CAM-184-*/test.md` | EXISTS |
| `docs/delivery/ai-workflow/ai-delivery-workflow-the-camper/CAM-184-*/delivery.md` | NEW (this file) |

**Excluded from this commit (pre-existing working-tree):**
- `app/layout.tsx` — OG/Twitter meta tag addition (unrelated to CAM-184)
- `public/mockup/**` — deleted campground images (unrelated)

## Dependencies already resolved

- Linear `changes-requested` label: created via Linear MCP before this commit (no file artifact; exists in Linear workspace).

## Migration

None. No Prisma schema changes. No DB migration required.

## Staging verify (post-merge, before G4 sign-off)

URL: `https://campvibe-staging.vercel.app/status/map?token=<STATUS_TOKEN>`

AC verification steps on the real Staging URL:

| AC | Step | Expected result |
|---|---|---|
| AC-1 | With a gate pending (e.g. CAM-183 awaiting-you), tap a gate row in the ApprovalCard | GateDetailModal opens; issue id/title/meta/description loaded |
| AC-2 | In the modal, tap "อนุมัติ" → button morphs to "ยืนยัน?" → tap again to confirm | POST /api/status/approve fires; `awaiting-you` label removed from Linear issue; Telegram "approved" notification received; 0 Anthropic API tokens consumed |
| AC-3 | Open the modal again (new gate), enter a reason in the textarea, tap "ส่งกลับ" | POST /api/status/reject fires; Linear comment added with reason; `changes-requested` label added; `awaiting-you` removed; Telegram "sent back" notification received |
| AC-4 | Inspect ApprovalCard visually | Amber-tinted glass background (rgba(40,26,6,.42) base); no priority badge; heading #FFB454 weight 800; footer CTA reads "อนุมัติทั้งหมด" |
| AC-5 | Hover over the "You" scout when a gate is pending | Notification is smaller (12px font, 13px icon, 5px 11px padding); popover does NOT appear; no teal green border on popover/badge/pop-role |
| AC-6 | Hit /api/status/approve without token | 401 returned |

Linear state after staging verify passes: `Done` (merge to staging = Done per CLAUDE.md).

## Release

Not yet promoted to prod. This PR targets `staging`. No git tag. No changelog entry (prod release deferred).

Rollback plan (if merge to staging causes regressions): revert the squash-merge commit on `staging` via `git revert <merge-sha>` and push. No DB migration to roll back. The `changes-requested` label in Linear is inert if the endpoints are not reachable.

## Security follow-ups (non-blocking, future hardening ticket)

Two Suggestion-severity items identified by security agent — non-blocking for this story, to be tracked in a follow-up ticket:

1. **Token via query param (`?token=…`) vs header**: currently `STATUS_TOKEN` is accepted via `?token=` query parameter (original pattern from CAM-182) AND `x-status-token` header. The query-param path risks the token appearing in server access logs. Future hardening: deprecate query-param path, require header only on new routes.
2. **Generic error on the map page**: the `/status/map` page itself does not have a generic error boundary surfacing a user-friendly message if the HUD SSE stream fails. Future: add an error boundary with Thai copy per the design system.

These are Suggestion severity. Neither blocks staging or G4 sign-off.

## Observability gate

No new backend observability instrumentation required (no new DB queries, no new external service calls beyond Linear GraphQL already instrumented). Existing Sentry integration covers runtime errors on new routes. Endpoint errors (401/400/429) are returned as structured JSON; no secrets or PII in response bodies (verified by security audit).

## Error watch

Pending — to be watched after merge to staging and after any prod promote. Rollback threshold: error rate ≥ 2× pre-deploy baseline or > 10% of requests erroring → rollback + notify.

## Links

`story.md` (CAM-184) · `design.md` (CAM-184) · `test.md` (CAM-184) · `.claude/rules/ops.md`

## Changelog

- v1 (2026-06-26) — created; PR opened targeting staging; all quality gates PASS; no migration; 2 security follow-up suggestions noted; staging verify steps documented; rollback = revert squash-merge.
