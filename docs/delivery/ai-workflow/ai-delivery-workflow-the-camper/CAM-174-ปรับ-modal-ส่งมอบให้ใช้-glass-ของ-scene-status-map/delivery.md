---
artifact: delivery
ticket: CAM-174
title: 'ปรับ modal ส่งมอบให้ใช้ glass ของ scene (/status/map)'
version: 1
date: 2026-06-25
status: In Progress
agent: devops
---

# Delivery Record — CAM-174

## Summary

UI-only fix: the delivery modal on `/status/map` now uses dark-green scene glass (mirrors the Backlog/Overview/Kanban HUD panels) instead of the main design-system white Card/Badge components that CAM-173 introduced. Each delivery item is a glass card. The title is decoded to plain text. Close/Esc dismiss. No migration, no API route, no DB access — identical blast radius to CAM-171.

---

## Gate Results

| Gate | Result | Notes |
|---|---|---|
| G1 Scope | PASS | Owner-approved: modal must match scene glass, not main DS |
| G2 Design | PASS | Design brief approved; dark-green glass + hud-modal-box pattern |
| lint | 0 errors | `npm run lint` clean |
| typecheck | 0 errors | `npm run typecheck` clean |
| tests | 2535 pass / 0 fail | `npm test` — coverage maintained on `map-delivery.ts` and `delivery-gift.tsx` |
| build | PASS | `npm run build` success |
| check:palette | PASS | No off-token colours |
| check:ds | PASS | Design-system gate clean |
| Security | PASS | 6-area audit; UI-only, no dangerouslySetInnerHTML, no secret; npm audit 0 high/critical |
| G3 Merge | Pending CI | PR open; orchestrator merges after CI green |

---

## Artifacts

### Files committed

| Path | Change |
|---|---|
| `app/status/map/delivery-gift.tsx` | MODIFIED — modal shell replaced with `hud-modal-box` glass; delivery cards use `hud-card` + `hud-kc` glass tokens; DS `Card`/`Badge` removed; title decoded to plain text; close/Esc logic unchanged |
| `__tests__/map-delivery.test.ts` | MODIFIED — test assertions updated to match new glass class names (`hud-modal-box`, `hud-card`, `hud-kc`) and decoded title expectations |
| `docs/delivery/.../story.md` | NEW — story ticket |
| `docs/delivery/.../design.md` | NEW — design brief |
| `docs/delivery/.../tech.md` | NEW — technical spec |
| `docs/delivery/.../test.md` | NEW — test plan |
| `docs/delivery/.../delivery.md` | NEW — this file |

### PR

- Branch: `feat/cam-174-modal-scene-glass` → base `staging`
- PR: opened (see commit step below)
- CI: triggered on push

---

## Migration

None. This story is UI-only. No Prisma schema change, no `prisma migrate deploy`, no DB access of any kind. The only state is the existing localStorage key `cv-map-delivery-seen` (unchanged).

---

## Rollback Plan

**Rollback = revert the squash-merge commit on `staging`.**

No DB migration to reverse. No server-side state mutated. Steps:

```bash
# Identify the merge commit SHA on staging
git log staging --oneline | head -5

# Revert it (creates a new revert commit — safe, non-destructive)
git revert <merge-commit-sha> --no-edit
git push origin staging
```

Vercel auto-deploys `staging` on push. After the revert deploy, `/status/map` returns to the CAM-173 state (white DS modal). localStorage key `cv-map-delivery-seen` is unaffected.

---

## Staging Verification Plan

URL: https://campvibe-staging.vercel.app/status/map

**Steps to verify AC on the real Staging URL:**

1. Open https://campvibe-staging.vercel.app/status/map in a fresh browser tab.
2. Trigger the gift indicator — in DevTools clear `cv-map-delivery-seen` from Local Storage under `campvibe-staging.vercel.app`, then reload.
3. **AC-glass verify:** Click the amber gift indicator. The modal that opens must be dark-green glass (NOT white/light DS Card). The backdrop uses `hud-modal-box` glass — matches the Backlog/Overview/Kanban panel appearance.
4. **AC-card verify:** Each delivered story in the list is rendered as a glass card (`hud-card` + `hud-kc` tokens), not a DS `Card` component.
5. **AC-title verify:** Story titles display as plain decoded text (no HTML entities such as `&amp;` or `&#39;`).
6. **AC-dismiss verify:** Clicking the X button or pressing Esc closes the modal. The amber indicator disappears. Reload — indicator remains gone (localStorage persisted).
7. **AC-empty verify:** After marking all seen, no indicator appears on the campfire.

All AC must pass before the story moves to Linear state `Done`.

---

## Observability

- No new server-side logging (UI-only fix).
- No new metric emitted.
- No Sentry instrumentation required.
- Post-deploy watch: standard Sentry baseline on `/status/map`; no new error spike expected.

---

## Feature Flag

None. Ships directly. No flag lifecycle to track.

---

## Graduated Rollout

Not applicable for Staging promotion. For the subsequent prod release (G5), the change has no server-side blast radius. Standard 100% Vercel deploy is acceptable; no canary ramp required. Rollback remains: revert the merge commit + push.

---

## Next Steps

- G3 owner approval → orchestrator squash-merges PR into `staging` → Vercel auto-deploys → run Staging verification plan above → Linear state `Done`.
- G4 Staging sign-off → G5 promote `staging`→`main` → prod deploy + git tag + changelog + label `released`.
