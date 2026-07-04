---
linear: CAM-151
feature: ai-workflow
epic: campsite-delivery-map (CAM-150)
artifact: tech
owner: frontend
status: In Progress
version: v1
updated: 2026-06-24
---
# Tech — S1 shared model + route shell (CAM-151)

## Shape of the work

Two moves, no behavior change:

1. **Pure extraction** — lift the delivery model (`buildModel` + `Model`/`EpicNode` + the `groupBy`/issue-state/persona/feature helpers) out of `app/status/page.tsx` into a new `lib/status-model.ts` so both `/status` and `/status/map` import one source. `/status` must render byte-identically (pure-move regression).
2. **Route shell** — scaffold `app/status/map/` as a sibling route: a server page that token-gates, fetches, builds the model, projects it to a small JSON `MapModel`, and mounts a client scene lazily (`next/dynamic({ ssr: false })`). The scene itself is a stub at S1 (CAM-152 fills it in).

## Files touched

| File | Change |
|---|---|
| `lib/status-model.ts` | **New.** Pure move of `buildModel`, `interface Model`, `interface EpicNode`, `groupBy<T>`, and the helpers `epicOf` / `personaOf` / `featureOf` / `isActive` / `isDone` / `hasAwait`. `StatusIssue` is import-type only; no server-only import (`buildWorkload` / `envOf` come from `lib/status-derive.ts`, which is already client-safe). |
| `app/status/page.tsx` | Removed the local `buildModel` + helper declarations; now `import { buildModel, type Model, type EpicNode, epicOf, isActive, isDone, hasAwait, personaOf, featureOf } from "@/lib/status-model"`. `buildTrail`/`epicBucket`/`regressionRound` still come from `lib/status-derive`. No render logic changed. |
| `app/status/map/page.tsx` | **New.** Server component (`force-dynamic`), `STATUS_TOKEN` gate (parity with `/status`), `readPulse()` → `fetchStatusIssues(pulse)` → `buildModel` → project to `MapModel` → render the night-scene shell + `<SceneLoader>`. |
| `app/status/map/scene-loader.tsx` | **New.** `"use client"` wrapper that lazy-loads `campsite-scene` via `next/dynamic` with `ssr: false` + a loading placeholder. |
| `app/status/map/campsite-scene.tsx` | **New** (stub at S1, real at S2). Client scene that receives `MapModel` and renders the characters. |
| `app/status/map/campsite-assets.ts` | **New.** The static night-scene shell: `CSS` (background gradient, aurora, gate box, placeholder) + `SCENE` (the fixed background div). No data, pure presentation. Internal-ops page → exempt from the public OKLCH token rule, same as `/status` (CSS lives in this asset file, injected via `dangerouslySetInnerHTML`). |

## The pure move — what came across unchanged

`lib/status-model.ts` exports (all lifted verbatim from `page.tsx`):

| Export | Kind | Role |
|---|---|---|
| `buildModel(issues)` | function | the model builder — classifies epics/stories/legacy, computes `projectPct`, `gates`, `epicsActive`, `backlog`, `rmap`, env lanes |
| `Model` | interface | the full derived model shape consumed by `/status` (and now the map projection) |
| `EpicNode` | interface | one epic + its stories + feature/persona/legacy flags |
| `groupBy<T>` | function | generic grouping helper (by feature / persona / env) |
| `epicOf` | helper | first `·`-split segment of a title (legacy epic prefix) |
| `personaOf` / `featureOf` | helpers | persona label / Linear project name |
| `isActive` / `isDone` / `hasAwait` | predicates | story state from `status` / `statusType` / `awaiting-you` label |

`buildWorkload(work)` is **called inside** `buildModel` (it produces `rmap`), but it is imported from `lib/status-derive.ts` — it was already shared there, so it did not move. This is why the regression test asserts `buildWorkload(work)` appears in `status-model.ts` (the call site) and no longer in `page.tsx`.

## Route-shell architecture (`/status/map`)

```
StatusMapPage (server, force-dynamic)
  ├─ guard: process.env.STATUS_TOKEN — if set and ?token mismatches → render SCENE + gatebox, stop
  ├─ readPulse() (best-effort; falls back to the 60s time cache on failure)
  ├─ fetchStatusIssues(pulse)            ← same data spine as /status
  ├─ buildModel(issues)                  ← shared model from lib/status-model.ts
  ├─ project → MapModel { projectPct, gates[], agents[], epicNames[] }   (S2 widens agents)
  └─ render <style>CSS</style> + SCENE shell + <SceneLoader model token />
        └─ SceneLoader ("use client") → dynamic(() => import("./campsite-scene"), { ssr:false })
```

- **Token gate parity** — uses `process.env.STATUS_TOKEN`; when set, a missing/wrong `?token=` renders the same gate box (no data fetch). Matches `/status`.
- **Server fetch, no client data path** — `fetchStatusIssues` + `buildModel` run on the server; the client receives only the small projected `MapModel`. No Linear token reaches the browser.
- **Lazy, ssr-disabled scene** — the rAF/canvas scene (S2+) must not SSR; `next/dynamic({ ssr:false })` keeps it out of the server render and out of the first paint until hydration, protecting the route JS budget.
- **Error path** — a failed fetch sets `err` and renders a glass placeholder ("โหลดข้อมูลไม่ได้: …") instead of the scene; the shell still paints.

## MapModel evolution (S1 → S2)

At S1 the projection is the minimal shell contract; S2 (CAM-152) widens it to carry per-role workload + the current task so each character can render its state. Recorded here so the cascade is visible:

```ts
// S1 (shell) — minimal projection
interface MapModel {
  projectPct: number;
  gates: { id: string; title: string; url: string }[];
  epicNames: string[];
  // agents: added in S2
}
```

See `../CAM-152-s2-scene-characters/tech.md` for the final `MapModel` / `MapAgent` shape.

## Self-verify results

| Check | Result |
|---|---|
| `npm run typecheck` | PASS (0 errors) |
| `npm run lint` | PASS (no new errors) |
| `npm run build` | PASS (route `/status/map` compiles) |
| `/status` regression | render path unchanged — only the import source moved; `function buildModel` no longer declared in `page.tsx` |

## What QA should target

- AC#1: `/status` renders identically — assert `page.tsx` imports `buildModel` from `@/lib/status-model` and no longer declares `function buildModel` (source-inspection, `__tests__/status-map.test.ts`).
- AC#1: `lib/status-model.ts` exports `buildModel` + the moved helpers (runtime import) and calls `buildWorkload(work)` internally.
- AC#2: `/status/map?token=` returns the shell (200) — `page.tsx` is `force-dynamic`, gates on `STATUS_TOKEN`, fetches via `fetchStatusIssues`, builds via `buildModel`.
- AC#2: scene is lazy + `ssr:false` (assert in `scene-loader.tsx`).
- AC#3: token gate parity — `STATUS_TOKEN` referenced in `page.tsx`.
- Final AC verification happens on the real Staging URL after G3 (HTML diff of `/status` = empty; `/status/map?token=` = 200 shell; no token = gate box).

## Links

`story.md` · `../feature.md` · `lib/status-model.ts` · `app/status/page.tsx` · `app/status/map/page.tsx` · `app/status/map/scene-loader.tsx` · `lib/status-derive.ts` · `lib/linear.ts`

## Changelog

- v1 (2026-06-24) — tech artifact authored; documented the pure-move extraction, the route-shell architecture, file list, and the S1→S2 MapModel evolution.
