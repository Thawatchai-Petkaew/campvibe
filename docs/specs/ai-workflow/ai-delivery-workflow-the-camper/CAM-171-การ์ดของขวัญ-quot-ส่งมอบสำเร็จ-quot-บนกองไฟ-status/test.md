---
linear: CAM-171
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-06-25
---
# Test — การ์ดของขวัญ "ส่งมอบสำเร็จ" บนกองไฟ /status/map (CAM-171)

## Test file

`__tests__/map-delivery.test.ts` — 71 tests, all green.

## Coverage: lib/map-delivery.ts

| Metric | % | Pass |
|---|---|---|
| Statements | 100% (46/46) | >=80% |
| Branches | 100% (24/24) | >=80% |
| Functions | 100% (9/9) | >=80% |
| Lines | 100% (35/35) | >=80% |

Reported from real run: `npx vitest run --coverage --coverage.include='lib/map-delivery.ts'`

## AC → test matrix

| AC# | Test-id / layer | Description | pass/fail |
|---|---|---|---|
| AC#1 | `unit--map-delivery-selectDeliveries` / unit | `selectDeliveries` flattens completed only; sorts newest-first; excludes backlog/started/canceled | PASS |
| AC#1 | `unit--map-delivery-selectDeliveries-nullDate` / unit | null `completedAt` sorts to end; both-null stable; date-before-null branch | PASS |
| AC#2 | `src--map-delivery-modal-testid` / source-inspect | `delivery-gift.tsx` has `data-testid="modal--map-delivery"`, `role="dialog"`, `aria-modal="true"`, modal title "ส่งมอบสำเร็จ" | PASS |
| AC#2 | `src--map-delivery-portal` / source-inspect | `createPortal(…, document.body)` used for modal | PASS |
| AC#3 | `unit--map-delivery-markSeen` / unit | `markSeen` merges+dedupes ids into localStorage; `readSeenIds` returns them back | PASS |
| AC#3 | `src--map-delivery-markSeen-call` / source-inspect | `markSeen(ids)` + `setUnseen([])` called inside `handleClose` | PASS |
| AC#4 | `unit--map-delivery-readWrite` / unit | `writeSeenIds` → `readSeenIds` round-trip confirms persistence across "reloads" (in-process localStorage stub) | PASS |
| AC#4 | `src--map-delivery-storage-event` / source-inspect | cross-tab `storage` event listener wired to `DELIVERY_SEEN_KEY` | PASS |
| AC#5 | `unit--map-delivery-selectUnseen-allSeen` / unit | `selectUnseen` returns [] when all ids in seenIds | PASS |
| AC#5 | `src--map-delivery-returnNull` / source-inspect | `if (unseenCount === 0) return null;` present | PASS |
| AC#5 | `unit--map-delivery-preSeed` / unit | `preSeed` + `selectUnseen` → [] on first visit (no historical dump) | PASS |
| AC#6 | `unit--map-delivery-newAfterPreSeed` / unit | after `preSeed(["hist-1"])`, a new id "new-2" is unseen via `selectUnseen` | PASS |
| i18n | `src--map-delivery-i18n-th` / unit | `th.map.delivery.modalTitle === "ส่งมอบสำเร็จ"` and all 6 TH keys verbatim | PASS |
| i18n | `src--map-delivery-i18n-en` / unit | EN map.delivery namespace present with English values | PASS |
| a11y | `src--map-delivery-btn-testid` / source-inspect | gift button has `data-testid="btn--map-delivery-gift"` + `aria-label` | PASS |
| a11y | `src--map-delivery-close-44px` / source-inspect | `.delivery-modal-close` is 44×44px in `DELIVERY_GIFT_CSS`; Escape key closes modal | PASS |
| SSR  | `unit--map-delivery-ssr` / unit | all 5 localStorage helpers no-throw when `window === undefined` | PASS |
| design | `src--map-delivery-lucide` / source-inspect | `Gift` icon from `lucide-react`; no emoji in source | PASS |
| design | `src--map-delivery-reduced-motion` / source-inspect | `giftFloat`/`giftGlow` gated by `prefers-reduced-motion: no-preference`; `animation: none` in reduce block | PASS |

## Source-inspection note

`delivery-gift.tsx` is a `"use client"` component using `React` hooks, `createPortal`, and
scene-scoped CSS vars. Rendering it in vitest/node would require mocking >10 module
boundaries and would test the mocks, not the real code. Per the CAM-79/147 precedent and
`.claude/rules/qa.md §6`, structural, a11y, animation, and wiring properties are asserted
via source-inspection (`fs.readFileSync`). All pure logic (`selectDeliveries`, `selectUnseen`,
localStorage helpers, `preSeed`/`hasInitialized`) is covered by direct unit tests.

## Prove-It

Three explicit Prove-It tests document what a broken implementation would return:

1. A `selectUnseen` that ignores `seenIds` returns 3 items; the real function returns 1.
2. A `selectDeliveries` without a filter returns both completed+backlog; the real function returns 1.
3. A `selectDeliveries` with ascending sort returns oldest-first; the real function returns newest-first.

Each logical assertion was validated against the broken counterpart before writing the final assertion.

## Suite run summary

```
Test Files  44 passed (44)
     Tests  2497 passed (2497)
  Duration  1.64s
```

`npm run lint`: 0 errors (245 pre-existing warnings, none added).
`npm run typecheck`: 0 errors.

## Defects found

None. All AC assertions pass against the implementation in `lib/map-delivery.ts` and `app/status/map/delivery-gift.tsx`.

## next

Ready for G3 merge → staging; verify AC on real Staging URL after merge (= Done).

## Changelog

- v1 (2026-06-25) — created by qa-engineer (CAM-171)
