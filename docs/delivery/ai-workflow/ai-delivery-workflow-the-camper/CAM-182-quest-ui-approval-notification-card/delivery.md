---
linear: CAM-182
feature: ai-workflow
epic: ai-delivery-workflow-the-camper
persona: platform
artifact: delivery
owner: devops-release
status: In Progress
version: v1
updated: 2026-06-25
---
# Delivery — Quest UI: Approval Notification + Approval Card (CAM-182)

## PR & preview

PR: pending — to be opened against `staging` (feat/cam-182-quest-approval-ui).
Vercel preview: auto-generated on PR open at `campvibe-*.vercel.app` (ephemeral).

## Gate trail

| Gate | Status | Notes |
|---|---|---|
| G1 Scope | Passed | owner-approved scope |
| G2 Design | Passed | owner-approved choices: BellRing (A2), ClipboardCheck card (B1), subtle glow C1, amber crown D1 |
| G3 Merge → staging | Pending | PR open; owner merges |
| G4 Staging sign-off | Pending | verify on campvibe-staging.vercel.app/status/map |
| G5 Prod go-live | Not this round — owner promotes to prod separately |

## Owner G2 choices (locked)

| Dimension | Choice | Detail |
|---|---|---|
| A — Notification icon | A2 BellRing | `BellRing` from lucide-react size 15 strokeWidth 2; overrides design-brief default A1 (ClipboardCheck) |
| B — Approval card icon | B1 ClipboardCheck | `ClipboardCheck` replaces `AlertTriangle` in heading + mini + CTA button |
| C — Card glow intensity | C1 subtle | `apprCardGlow` peaks at `0 0 18px rgba(255,160,52,.22)` |
| D — Header accent | D1 amber crown | amber-only gradient `::before` stripe, 2px, on `.hud-appr-head` |

## Staging verify

Staging URL: `campvibe-staging.vercel.app/status/map`

Verification procedure (to be run after G3 merge auto-deploys):

1. Open `campvibe-staging.vercel.app/status/map` with at least one gate pending (gates.length > 0).
2. Notification bubble (`.you-alert`): confirm `BellRing` icon renders (no `&#9873;` glyph, no DOM dot visible), text at 13px, amber glow ring visible around the pill, `alertPulse` float animates in browser with `prefers-reduced-motion` off.
3. Approval card (`.hud-appr-card`): confirm `ClipboardCheck` in heading and CTA button, no `AlertTriangle`; amber crown stripe visible at top of card; card glow pulses with `prefers-reduced-motion` off; card is static (no pulse) with `prefers-reduced-motion: reduce`.
4. Primary CTA button `ดูและอนุมัติทั้งหมด`: confirm tap target is 44px min-height.
5. Approve flow: confirm the existing modal opens and the approval action works unchanged (logic untouched).
6. Check `prefers-reduced-motion: reduce` via DevTools: notification bubble is static, card glow is static — both hold their elevated static border/shadow states.

Result: pending (after G3 merge + auto-deploy)

## Migration

None. UI-only change. No Prisma schema, no DB migration, no data model touched.

## Release

Not promoted to prod this round. Owner promotes staging → main separately (G5).

When promoted:
- git tag: `v0.11.x` (next in series after v0.10.0)
- Changelog: append entry for CAM-182 quest-like approval notification (BellRing) + fancier approval card (ClipboardCheck, amber crown, subtle glow, 44px button)
- Rollback plan: revert the squash-merge commit of `feat/cam-182-quest-approval-ui` on `staging` (`git revert <merge-commit-sha>` → PR into staging → auto-deploy); for prod: `git revert <prod-merge-sha>` → promote reverted staging → prod. Both UI-only reverts are safe, no DB rollback required.

## Error watch

Not applicable this round (not promoted to prod). Post-promote error watch to be run by owner at G5: watch Sentry for the agreed window; error spike >= 2x baseline = rollback + notify; real error = open bug ticket.

## Quality gate results (orchestrator-verified before PR)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (246 pre-existing warnings, unchanged) |
| `npm run typecheck` | clean (0 errors) |
| `npm test` | 2642 passed (49 files), 0 failed (28 new CAM-182 tests green) |
| `npm run build` | success — /status/map compiled clean |
| `npm run check:palette` | PASS (0 violations) |
| `npm run check:ds` | PASS (0 violations) |
| `npm audit --omit=dev` | not run — UI-only story, no new deps added |

## Files in this PR

| File | Change |
|---|---|
| `app/status/map/campsite-scene.tsx` | BellRing import; .you-alert CSS overhaul; icon markup + popover copy |
| `app/status/map/campsite-overlays.tsx` | AlertTriangle removed; .hud-appr-* CSS redesign; ClipboardCheck icon |
| `__tests__/cam-182-quest-approval-ui.test.ts` | 28 source-inspection guard tests (new) |
| `docs/delivery/.../design.md` | design brief (G2 choices) |
| `docs/delivery/.../tech.md` | implementation spec |
| `docs/delivery/.../test.md` | test matrix (28 tests) |
| `docs/delivery/.../delivery.md` | this file |

## Links

`story.md` (not yet authored — follow-up) · `design.md` · `tech.md` · `test.md` · `.claude/rules/ops.md`

## Changelog

- v1 (2026-06-25) — created; PR not yet open; G3/G4 pending; G5 deferred to owner
