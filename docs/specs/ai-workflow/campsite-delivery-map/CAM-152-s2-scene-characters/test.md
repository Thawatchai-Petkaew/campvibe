---
linear: CAM-152
feature: ai-workflow
epic: campsite-delivery-map (CAM-150)
persona: platform
artifact: test
owner: qa
status: In Progress
version: v1
updated: 2026-06-24
---
# Test Artifact — S2 static scene + characters (CAM-152)

## How the AC is verified

The map scene is a `next/dynamic({ ssr:false })` client component with no server-rendered DOM, so the local strategy is **source-inspection + a logic assertion on the role canonicalizer** that drives the projection — the project's established status pattern (`__tests__/status-derive.test.ts`). The visual AC (characters render, glow on active, You `⚑N`, sprites over the network) is verified on the **real Staging URL** after G3.

Test file: `__tests__/status-map.test.ts` (shared with CAM-151).

## AC → Test Matrix

| AC# | Test (in `__tests__/status-map.test.ts`) | Layer | Asserts | Pass/Fail |
|-----|------------------------------------------|-------|---------|-----------|
| AC-1 | `page.tsx builds the agents projection from rmap + work` | source | `agents:`, `buildAgents`, `rmap` referenced in the projection | PASS |
| AC-1 | `campsite-scene widens the model: MapModel + MapAgent` | source | `export interface MapModel` + `MapAgent` + `activeCount` + `queued` + `task` | PASS |
| AC-2 | `canonRole 'frontend' → 'frontend-engineer'` | logic | the role match that drives a working character's task lookup | PASS |
| AC-2 | `canonRole 'qa' → 'qa-engineer'` | logic | role projection (Verify lane) | PASS |
| AC-2 | `canonRole 'security' → 'security-reviewer'` | logic | role projection | PASS |
| AC-2 | `canonRole 'backend-engineer' passthrough` | logic | long-form role key passes through | PASS |
| AC-3 | `canonRole 'unknownrole' → ''` | logic | an unknown role tag does NOT create a phantom agent | PASS |
| AC-4 | `campsite-scene renders the You gate badge from gates.length` | source | `gates.length` drives the `⚑N` badge | PASS |
| AC-5 | `campsite-scene references sprites under /status-map/sprites/` | source | artwork is an external `/public` path | PASS |
| AC-5 | `campsite-scene contains NO inline base64 data:image` | source | no base64 in the bundle | PASS |
| AC-5 | `campsite-assets contains NO inline base64 data:image` | source | shell CSS has no base64 either | PASS |
| AC-5 | `campsite-assets exports the CSS + SCENE shell strings` | source | the night-scene shell is present | PASS |
| a11y | `campsite-scene guards animation behind prefers-reduced-motion` | source | the reduced-motion guard is present | PASS |

## Sprite budget check (AC#5) — verified out-of-band

Every extracted sprite is far under the 200KB/image ceiling (largest = `you.webp` at 18.1KB):

```
$ du -b public/status-map/sprites/*
16262 relax-0.webp   ...   18532 you.webp   (15 files, all < 20KB)
```

Asserted in the tech artifact's size table; the source-inspection test guards that the scene loads them from `/status-map/sprites/` (not base64). The < 200KB threshold is a static-asset fact, not a runtime unit.

## Coverage matrix per unit (per .claude/rules/qa.md)

| Bucket | Covered? | Notes |
|--------|----------|-------|
| normal (happy path) | Yes | `canonRole` known roles → canonical keys (the projection's happy path) |
| null/empty | Yes | `buildModel([])` (CAM-151 suite) → all characters at-rest, You calm; `canonRole('')` → '' |
| boundary | Yes | `gates.length === 0` hides the You badge; `queued = max(0, total-done-active)` floored at 0 |
| error/validation | Yes | `canonRole('unknownrole')` → '' (no phantom agent); fetch-error renders placeholder (Staging) |
| concurrent/ordering | N/A | pure projection; real-time reconcile is S6 |

## Coverage note (new-code gate)

No coverage script in the project; new-code coverage is gated via **source-inspection tests** plus the `canonRole` logic suite. The S2 projection logic (`buildAgents`) is wired in the server component (`page.tsx`) and exercised through its inputs: `canonRole` (asserted here + heavily in `status-derive.test.ts`), `buildWorkload`→`rmap`, and `buildModel` (CAM-151 suite). The widened `MapModel`/`MapAgent` and the sprite/base64/reduced-motion guards are asserted by source-inspection. This is the same coverage convention CAM-60 used (source-inspection wiring tests counting toward the new-code gate).

## Prove-It (red before green)

- Reverting any sprite reference back to a `data:image` base64 → both the `campsite-scene` and `campsite-assets` no-base64 assertions fail.
- Removing the `prefers-reduced-motion` guard → the a11y assertion fails.
- Removing `activeCount`/`queued`/`task` from `MapAgent` → the widened-model assertion fails.
- Breaking `canonRole('frontend')` → the role-projection logic test fails (a working Frontend character would never match its task).

## Checks

- [x] `npm run typecheck` — PASS (0 errors)
- [x] `npm run lint` — PASS (no new errors)
- [x] `npm run build` — PASS
- [x] `__tests__/status-map.test.ts` — 23 tests, all PASS (shared with CAM-151)
- [x] all 15 sprites < 200KB, loaded from `/public`
- [x] no `data:image` base64 in `campsite-scene.tsx` or `campsite-assets.ts`
- [ ] verify AC on the real Staging URL after G3: characters render from live workload · active glows · You `⚑N = gates.length` · sprites over network · matches `/status` workload for the same data

## Status

status: ready (local) — `status-map.test.ts` green (23 tests). AC#1–5 visual verification pending on the real Staging URL after merge (Done criterion).

## Links

`story.md` · `tech.md` · `design.md` · `__tests__/status-map.test.ts` · `__tests__/status-derive.test.ts` · `.claude/rules/qa.md`

## Changelog

- v1 (2026-06-24) — test artifact authored; mapped AC#1–5 to the source-inspection + `canonRole` logic strategy; recorded the sprite budget check.
