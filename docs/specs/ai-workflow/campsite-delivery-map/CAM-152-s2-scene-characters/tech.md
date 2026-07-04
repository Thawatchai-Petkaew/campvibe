---
linear: CAM-152
feature: ai-workflow
epic: campsite-delivery-map (CAM-150)
artifact: tech
owner: frontend
status: In Progress
version: v1
updated: 2026-06-24
---
# Tech — S2 static scene + characters from real data (CAM-152)

## Shape of the work

Three things, all anti-slop (every visible signal traces to real data):

1. **Extract sprites** — pull the base64 character frames out of the mockup (`design/campvibe-campsite.html`) into WebP files under `public/status-map/sprites/`, so the artwork is a cacheable static asset outside the JS bundle (AC#5).
2. **Widen the model** — extend `MapModel` / add `MapAgent` so each character carries its per-role workload (`done` / `activeCount` / `queued`), its current task, and its active flag.
3. **Render a static scene** — 7 build-role characters + "You" placed at fixed stations, each one's working/idle state and the You `⚑N` gate badge derived from the real `buildModel` output (`rmap`, `gates`). No motion yet (that is S3).

## Files touched

| File | Change |
|---|---|
| `public/status-map/sprites/*.webp` | **New (15 files).** Extracted from the mockup's base64 sprites → WebP. 6 relax poses, 8 walk frames (front/back × left/right × 2), 1 `you` pose. All < 20KB each (well under the 200KB ceiling). |
| `app/status/map/campsite-scene.tsx` | **Filled in (was a stub at S1).** `"use client"` scene: `ROLE_CONFIG` (node/color/pose/displayName/roleLabel per role), `NODES` (percent coords ported from the mockup), `YOU_POS`, the `MapAgent`/`MapModel` interfaces, the scene CSS (with the `prefers-reduced-motion: no-preference` keyframe guard), and the `AgentScout` / `YouScout` / `CampsiteScene` components. Sprites referenced as `url("/status-map/sprites/<name>.webp")` — no base64. |
| `app/status/map/page.tsx` | Added `buildAgents(work, rmap)` — projects the model into the `agents` array; widened the `mapModel` projection to `{ projectPct, gates, agents, epicNames }`. |

## Sprite extraction

The mockup carried ~2MB of base64 sprite data inline. Extracting to `/public` removes it from the route's JS payload and lets the browser cache the artwork. The engine sets `background-image: url("/status-map/sprites/<name>.webp")` instead of a `data:` URI.

### Sprite size table (all < 200KB ✓)

| File | Bytes | KB |
|---|---|---|
| `relax-0.webp` | 16,262 | 15.9 |
| `relax-1.webp` | 15,422 | 15.1 |
| `relax-2.webp` | 14,064 | 13.7 |
| `relax-3.webp` | 12,572 | 12.3 |
| `relax-4.webp` | 12,024 | 11.7 |
| `relax-5.webp` | 13,308 | 13.0 |
| `walk-back-left-0.webp` | 12,004 | 11.7 |
| `walk-back-left-1.webp` | 11,958 | 11.7 |
| `walk-back-right-0.webp` | 12,680 | 12.4 |
| `walk-back-right-1.webp` | 11,422 | 11.2 |
| `walk-front-left-0.webp` | 13,188 | 12.9 |
| `walk-front-left-1.webp` | 12,306 | 12.0 |
| `walk-front-right-0.webp` | 12,782 | 12.5 |
| `walk-front-right-1.webp` | 12,438 | 12.1 |
| `you.webp` | 18,532 | 18.1 |

Largest file is `you.webp` at 18.1KB — every sprite is an order of magnitude under the 200KB/image budget. Walk frames are extracted now (used by S3); the static scene uses the relax poses + `you`.

## Data projection — `buildAgents` (page.tsx)

`buildAgents(work, rmap)` maps the 7 fixed `BUILD_ROLES` to `MapAgent`s using only real model fields (anti-slop):

```ts
const BUILD_ROLES = [
  "architect", "ux-designer", "backend-engineer", "frontend-engineer",
  "devops-release", "qa-engineer", "security-reviewer",
];

// for each role:
const counts = rmap[role] ?? { total: 0, active: 0, done: 0 };
const queued = Math.max(0, counts.total - counts.done - counts.active);   // not-yet-started
const activeStory = work.find(i => isActive(i) && canonRole(titleRoleOf(i.title)) === role) ?? null;
const task = activeStory ? { id, title: cleanTitle(title), startedAt } : null;
return { role, name: role, active: counts.active > 0, done, activeCount, queued, task };
```

- `active` ← `rmap[role].active > 0` (drives the glow + working badge).
- `task` ← the In Progress story whose `[role]` title tag canonicalizes (via `canonRole`) to this role — that is the speech the working character shows.
- `done` / `activeCount` / `queued` ← from `rmap` (queued is derived, never stored).
- `gates` ← `m.gates` (the `awaiting-you` work items) → the You character's `⚑N` badge; hidden when `N === 0`.

Every number on the scene therefore comes from the same `buildModel` that powers `/status` — no fabricated value.

## MapModel / MapAgent — final shape (S2)

```ts
// app/status/map/campsite-scene.tsx
export interface MapAgent {
  role: string;        // canonical role key, e.g. "frontend-engineer"
  name: string;        // display name source
  active: boolean;     // rmap[role].active > 0
  done: number;
  activeCount: number;
  queued: number;      // total - done - active (derived)
  task: { id: string; title: string; startedAt: string | null } | null;
}

export interface MapModel {
  projectPct: number;
  gates: { id: string; title: string; url: string }[];
  agents: MapAgent[];  // the 7 build-roles, always present
  epicNames: string[];
}
```

`MapAgent` is the S2 widening of the S1 shell projection (S1's `MapModel` had `projectPct`/`gates`/`epicNames` only). The model stays a small JSON payload — the server projects it; the client never re-fetches Linear.

## Scene rendering (static, anti-slop)

- **Stations** — `ROLE_CONFIG[role].node` keys into `NODES` (percent coords ported from the mockup's octagon). `z-index` is depth-sorted by `node.y` so nearer characters overlap correctly. You sits at a fixed `YOU_POS` near the bridge.
- **Working vs idle** — `agent.active` toggles `.working` / `.idle`; working adds the aura glow + colored badge dot + the task ID in the badge; idle shows "พัก". A per-role aura color (from the mockup `AGENTS` config) is passed as a CSS custom prop `--aura`.
- **You gate badge** — when `gates.length > 0`, the amber `⚑N รอตรวจสอบ` alert renders above You with `role="alert"`; the popover lists each gate's id + cleaned title. Hidden entirely at `N === 0` (calm state).
- **Top stat bar** — `{projectPct}% ความคืบหน้าโปรเจกต์`, plus `{N} gate รอ` in amber when gates exist.
- **No base64** — `grep "data:image"` over `campsite-scene.tsx` and `campsite-assets.ts` returns 0 hits; all artwork is `/status-map/sprites/*.webp`.

## 8-state / anti-slop notes (from the plan)

The plan's scene-semantics table maps every character state to a real data condition; S2 implements the static subset (the motion states land in S3):

| State | Meaning | Bound to | S2? |
|---|---|---|---|
| glow + speech (working) | role has an `isActive` story | `rmap[role].active > 0` | ✅ |
| at-rest (idle) | role has no active story | `rmap[role].active === 0` | ✅ |
| idle-sway (breathe) | ambient life, not a data signal | always-on, off at reduced-motion | ✅ (CSS breathe, guarded) |
| walk between stations | a real state change since last refresh | story stage/column change | ⏳ S3 |
| You calm | nothing awaits the human | `gates.length === 0` | ✅ |
| You `⚑N` | N gates awaiting approval | `gates.length` | ✅ |
| faint/gray node | role not in this epic | scope filtering | ⏳ S5 |

Anti-slop rule honored: the only always-on motion is the ambient `breathe` (decorative, first to disable under reduced-motion); every other signal is bound to a real `buildModel` field. Speech/task text only appears when there is a real `clean(title)` to show.

## a11y (S2 baseline; full pass is S7)

- The scout layer is `role="list"`; each character is `role="listitem"` with an `aria-label` stating role + working/idle/gate state, and is `tabIndex={0}`. Decorative sprite layers are `aria-hidden`.
- The You gate alert is `role="alert"` with a descriptive `aria-label` (`{N} gate รอการอนุมัติ`).
- Motion keyframes are wrapped in `@media (prefers-reduced-motion: no-preference)` — at `reduce`, the scene is already static (S2 has no walk), satisfying the reduced-motion requirement for this story.

## Self-verify results

| Check | Result |
|---|---|
| `npm run typecheck` | PASS (0 errors) |
| `npm run lint` | PASS (no new errors) |
| `npm run build` | PASS |
| sprites in `/public` | 15 files, all < 20KB (≪ 200KB ceiling) |
| no base64 in bundle | `grep data:image` → 0 in `campsite-scene.tsx` + `campsite-assets.ts` |

## What QA should target

- AC#1: 7 role characters + You render at fixed stations from `buildModel` workload.
- AC#2: a role with `rmap[role].active > 0` glows + shows the task badge (the In Progress story's id).
- AC#3: a role with `active === 0` is at-rest (no glow).
- AC#4: You shows `⚑N` where `N = gates.length`, hidden at `N === 0`.
- AC#5: sprites load from `/status-map/sprites/`, no `data:image` in the source; each file < 200KB.
- Source-inspection assertions in `__tests__/status-map.test.ts` cover sprite path, no-base64, reduced-motion guard, the widened `MapModel`/`MapAgent`, and the `gates.length` badge. Visual AC verified on the real Staging URL after G3.

## Links

`story.md` · `../feature.md` · `../CAM-151-s1-shared-model-route-shell/tech.md` (S1 MapModel) · `app/status/map/campsite-scene.tsx` · `app/status/map/page.tsx` · `public/status-map/sprites/` · `design/campvibe-campsite.html`

## Changelog

- v1 (2026-06-24) — tech artifact authored; documented the sprite extraction (size table), the `buildAgents` data projection, the final `MapModel`/`MapAgent` shape, and the 8-state/anti-slop mapping.
