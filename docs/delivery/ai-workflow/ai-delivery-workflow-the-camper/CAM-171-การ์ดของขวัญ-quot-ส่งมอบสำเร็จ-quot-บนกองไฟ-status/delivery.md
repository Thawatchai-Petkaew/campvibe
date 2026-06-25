---
artifact: delivery
ticket: CAM-171
title: 'การ์ดของขวัญ "ส่งมอบสำเร็จ" บนกองไฟ (/status/map)'
version: 1
date: 2026-06-25
status: In Progress
agent: devops
---

# Delivery Record — CAM-171

## Summary

Client-only feature: amber gift indicator above the campfire on `/status/map` when there are unseen Done stories. Clicking opens a modal listing the delivered tickets; closing marks them seen (localStorage) and the gift disappears. No migration, no API route, no DB access.

---

## Gate Results

| Gate | Result | Notes |
|---|---|---|
| G1 Scope | PASS | Owner-approved spec: view-once gift card on the campfire |
| G2 Design | PASS | Design brief approved; amber indicator + modal layout |
| lint | 0 errors | `npm run lint` clean |
| typecheck | 0 errors | `npm run typecheck` clean |
| tests | 2497 pass / 0 fail | `npm test` — 100% branch/line coverage on `lib/map-delivery.ts` |
| build | PASS | `npm run build` success |
| check:palette | PASS | No off-token colours |
| check:ds | PASS | Design-system gate clean |
| Security | PASS | 6-area audit + STRIDE; 0 Critical/Important; npm audit 0 high/critical — see `review.md` |
| G3 Merge | Pending owner approval | PR open; orchestrator merges after G3 sign-off |

---

## Artifacts

### Files committed

| Path | Change |
|---|---|
| `lib/map-delivery.ts` | NEW — pure logic: `selectDeliveries`, `markSeen`, `preloadSeen`; localStorage read/write; 100% test coverage |
| `app/status/map/delivery-gift.tsx` | NEW — `DeliveryGift` client component: amber indicator, badge, modal, SSR-safe localStorage |
| `__tests__/map-delivery.test.ts` | NEW — 2497 test suite; full branch coverage on `map-delivery.ts` |
| `app/status/map/campsite-scene.tsx` | MODIFIED — import + mount `<DeliveryGift>` + append `DELIVERY_GIFT_CSS` to scene style block |
| `locales/translations.json` | MODIFIED — Thai/English copy keys for modal header, labels, close button |
| `docs/delivery/.../story.md` | NEW — story ticket |
| `docs/delivery/.../design.md` | NEW — design brief |
| `docs/delivery/.../tech.md` | NEW — technical spec |
| `docs/delivery/.../test.md` | NEW — test plan |
| `docs/delivery/.../review.md` | NEW — security review (PASS) |
| `docs/delivery/.../delivery.md` | NEW — this file |

### PR

- Branch: `feat/cam-171-delivery-gift` → base `staging`
- PR: opened (pending — see commit step)
- CI: triggered on push

---

## Migration

None. This story is client-only. No Prisma schema change, no `prisma migrate deploy`, no DB access of any kind. localStorage key `cv-map-delivery-seen` stores opaque story id strings in the browser only.

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

Vercel auto-deploys `staging` on push. After the revert deploy, `/status/map` returns to the pre-feature state with no amber indicator. localStorage key `cv-map-delivery-seen` in users' browsers is inert (no reader remains) and harmless.

---

## Staging Verification Plan

URL: https://campvibe-staging.vercel.app/status/map

**Steps to verify AC on the real Staging URL:**

1. Open https://campvibe-staging.vercel.app/status/map in a fresh browser tab.
2. On first ever visit, `preloadSeen` pre-seeds all currently-Done stories as already seen (so existing tickets do not flood the owner on first load). The gift should NOT appear on the very first visit if no new Done story has been completed after the deploy.
3. To trigger the amber gift indicator for testing — use one of two methods:
   - **Method A (localStorage clear):** In browser DevTools, open Application > Local Storage > `campvibe-staging.vercel.app` → delete the key `cv-map-delivery-seen` → reload the page. Any Done story will now appear as unseen.
   - **Method B (new story):** Complete a NEW story ticket to Done state after first load; the next page load will show the gift.
4. **AC-1 verify:** The amber gift indicator is visible above the campfire on the map scene. A badge shows the count of unseen Done stories.
5. **AC-2 verify:** Click the gift indicator. A modal titled "ส่งมอบสำเร็จ" opens listing Done tickets with: title, epic label, and Thai date.
6. **AC-3 verify:** Close the modal. The amber indicator disappears from the campfire. Reload the page — indicator remains gone (localStorage persisted).
7. **AC-4 verify (empty state):** When there are no unseen Done stories, no indicator appears on the campfire.

All 4 AC must pass before the story moves to Linear state `Done`.

---

## Observability

- No new server-side logging added (client-only feature).
- No new metric emitted.
- No Sentry instrumentation needed (no API route, no server action).
- localStorage errors are caught silently (`try/catch`) — degradation = indicator stays visible until seen (safe).
- Post-deploy watch window: standard Sentry baseline on `/status/map` page; no new error spike expected.

---

## Feature Flag

None. The feature ships directly (no flag). The `preloadSeen` pre-seed on first visit prevents flooding the owner with historical Done tickets. Removal/cleanup: n/a (no flag to clean up).

---

## Graduated Rollout

Not applicable for Staging promotion. For the subsequent prod release (G5), this feature has no server-side blast radius (client localStorage only). Standard 100% Vercel deploy is acceptable; no canary ramp required. Rollback remains: revert the merge commit + push.

---

## Next Steps

- G3 owner approval → orchestrator squash-merges PR into `staging` → Vercel auto-deploys → run Staging verification plan above → Linear state `Done`.
- G4 Staging sign-off → G5 promote `staging`→`main` → prod deploy + git tag + changelog + label `released`.
