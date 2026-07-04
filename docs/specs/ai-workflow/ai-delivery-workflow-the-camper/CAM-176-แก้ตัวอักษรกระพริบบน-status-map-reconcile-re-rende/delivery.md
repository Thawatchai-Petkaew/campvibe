---
linear: CAM-176
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
artifact: delivery
owner: devops
status: In Review
version: v1
updated: 2026-06-25
---
# CAM-176 — Delivery Record: stop walking-agent flicker on /status/map

## Gates

| Gate | Status | Notes |
|---|---|---|
| G1 Scope | PASS | Story + AC closed, no migration |
| G2 Design | PASS | Frontend render guard only — no visual change |
| G3 Merge → staging | Pending | This PR (fix/cam-176-status-map-flicker → staging) |
| G4 Staging sign-off | Pending | After CI green + AC verify on campvibe-staging.vercel.app |
| G5 Go-live (prod) | Pending | After G4 human sign-off |

## Root Cause

Two independent bugs, both pre-existing, made visible/amplified 4x by CAM-175's shorter poll interval (60s → 15s):

**Layer 1 — no-op reconcile re-render:** `campsite-scene.tsx` `reconcile()` called `setLiveModel(next)` on every poll/SSE pulse even when the server returned a byte-identical JSON payload. A new object reference caused React to re-render the whole scene, restarting CSS animations on agent badges — visible as periodic flicker on Staging/Prod (not local, where data is empty/static).

**Layer 2 — wander/rest effect re-runs on every agents ref change:** The wander/rest `useEffect` carried `[engineReady, agents]` as deps. Every `setLiveModel` produces a new `agents` array reference (even when only unrelated fields like gate count or task title changed). The effect re-ran, calling `engineRef.current?.setActivity(activeByRole)` — a walking agent reset mid-walk, producing character flicker even on real-but-activity-unrelated board updates.

## Two-Layer Fix (surgical, no visual/interval change)

**Layer 1 — `payloadChanged` guard in `reconcile()`:**
Pure helper `payloadChanged(prev, next): boolean` added to `lib/status-map-model.ts`. A `lastPayloadRef` (initialized to `JSON.stringify(model)`) is compared against `res.text()` before `setLiveModel`. Identical payload → early return, no re-render, no animation restart. Different payload → update ref + `setLiveModel(JSON.parse(text))`. Error catch path unchanged.

**Layer 2 — `activeKey` memo replaces `agents` in wander/rest effect deps:**
A stable string `activeKey` encodes only the fields driving `setActivity` — `role`, `active`, `activeCount`. The wander/rest `useEffect` dep changes from `agents` to `activeKey`. Unrelated reconcile changes (gate count, task text, title) → same `activeKey` → effect does not re-run → `setActivity` not re-invoked → walking character undisturbed. Genuine activity change → `activeKey` changes → effect fires → `setActivity` called once.

Both layers preserve CAM-175 freshness: poll interval (15s), SSE subscription, and backoff are all unchanged.

## Migration

None. This is a frontend render guard only — no data model, API, or DB changes.

## Files Changed

| File | Change |
|---|---|
| `lib/status-map-model.ts` | Added `payloadChanged(prev, next): boolean` export |
| `app/status/map/campsite-scene.tsx` | `payloadChanged` import; `lastPayloadRef`; reconcile guard; `activeKey` useMemo; wander/rest effect dep → `activeKey` |
| `__tests__/status-map.test.ts` | 20 new CAM-176 tests (payloadChanged unit + source-inspection layer 1 + source-inspection layer 2 + activeKey semantic) |

## Quality Gate Results

| Check | Result |
|---|---|
| `npm run lint` | 0 errors |
| `npm run typecheck` | clean (0 errors) |
| `npm test` | 2575 passed / 0 failed (20 new CAM-176 tests) |
| `npm run check:palette` | PASS |
| `npm run check:ds` | PASS |
| `npm run build` | clean — /status/map builds as dynamic route |
| Security self-check | clean (render guard only; no data/auth/secrets touched) |

## Rollback Plan

No migration to reverse. Rollback = revert the squash-merge commit on `staging`:

```bash
# identify the merge commit SHA on staging after CI merges this PR
git revert <merge-commit-sha> --no-edit
git push origin staging
```

Vercel will auto-deploy the reverted `staging` branch. The production path is unaffected until G5.

## Staging Verification (AC verify — to run after CI green)

URL: https://campvibe-staging.vercel.app/status/map

- **AC-1 (board nิ่ง):** open /status/map, leave open ~1 min with no Linear activity → agent characters do NOT flicker or reset mid-walk; badges do NOT restart animation.
- **AC-2 (freshness):** trigger a real status change on Linear (move a story to a new state) → within ≤15s the board updates; an unrelated walking agent is NOT interrupted.
- **AC-3 (error resilience):** block `/status/map/data` in DevTools Network → board retains last-known state; no blank screen or crash.
- **AC-walk:** agent in mid-walk completes its path uninterrupted when a poll fires with identical activity (only gate/title/backlog changed on board).
- **Regression:** lanes, scope switcher, overlays, ENV picker, HUD dock visually unchanged.

## Observability

No new metrics or alerts required. This fix reduces main-thread work on unchanged polls. Post-deploy: watch Sentry for any new errors on `/status/map` after staging deploy. Rollback threshold: error rate ≥ 2x pre-deploy baseline.

## Feature Flags

None used.

## Post-Deploy Watch

Watch Sentry on staging for the first 15 min after deploy. No error spike expected (render-only change). Any spike → revert per rollback plan above.
