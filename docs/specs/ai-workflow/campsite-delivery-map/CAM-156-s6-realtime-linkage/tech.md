# CAM-156 S6 — Tech

## Component / file structure

```
lib/
  status-map-model.ts         — NEW: toMapModel(m: Model): MapModel + buildMapModel(issues): MapModel
                                 Shared projection extracted from page.tsx so page + data route never drift.

app/status/map/
  page.tsx                    — EDITED: removed inline buildAgents/cleanTitle/epicBucket helpers;
                                now calls toMapModel(buildModel(issues)) from lib/status-map-model.ts
  data/
    route.ts                  — NEW: GET /status/map/data — token-gated MapModel JSON endpoint
  campsite-scene.tsx          — EDITED: token destructured; liveModel state; SSE reconcile useEffect;
                                dashboardHref computation; Dashboard|Map toggle nav in JSX

app/status/
  page.tsx                    — EDITED: topBar() receives tab/epic/group/efilter/tq; renders
                                Dashboard|Map segmented toggle with mapHref() helper

__tests__/
  f5-account-misc.test.ts     — EDITED: feature/cam-156 added to skip-list (S6 owns page.tsx topBar)
  f6-palette-guard.test.ts    — EDITED: feature/cam-156 added to skip-list (same reason)
  status-map.test.ts          — EDITED: test for agents projection updated (toMapModel, not buildAgents)
```

## Why NOT router.refresh on the map

`dashboard-client.tsx` uses `router.refresh()` because `/status` is a fully server-rendered HTML string — a refresh re-injects the entire `<main>` HTML. On `/status/map` this would:

1. Remount `CampsiteScene` (a `dynamic()` client component), tearing down and restarting the rAF loop.
2. Reset all character positions to their entry arm-tip (re-triggering the entrance walk animation).
3. Close any open overlay (React state resets to initial).

The reconcile approach instead:
- Fetches `MapModel` JSON from `/status/map/data` (already cached by the existing 60s pulse-keyed `unstable_cache` inside `fetchStatusIssues` — no extra Linear calls).
- Calls `setLiveModel(next)` — React re-renders only the overlay subtree (chips + panels) with fresh data.
- Calls `engine.triggerWalk(role)` for each agent — DOM-only walk; no React state change; rAF loop keeps running.
- Open overlays stay open (their `isOpen` state is not touched).

## Shared toMapModel extraction

### Before (S1–S5)

`app/status/map/page.tsx` contained three local helpers:
- `titleRoleOf(title)` — extracted `[role]` tag
- `cleanTitle(title)` — stripped epic prefix + role tags
- `buildAgents(work, rmap)` — projected the 7-role `MapAgent[]`

Plus inline closures `buildEnvItems`, `buildEpicStories`, and a 15-line `mapModel` object literal.

### After (S6)

All of the above lives in `lib/status-map-model.ts` as:

```ts
export function toMapModel(m: Model): MapModel
export function buildMapModel(issues: StatusIssue[]): MapModel
```

`page.tsx` now calls:
```ts
const mapModel = toMapModel(buildModel(issues));
```

`data/route.ts` calls:
```ts
const model = buildMapModel(issues); // = toMapModel(buildModel(issues)) in one call
```

Both use the same code path → no drift between SSR initial data and reconcile fetch.

## Reconcile algorithm

```
SSE event received (or 60s fallback interval fires)
  ↓
fetch /status/map/data?token=…
  ↓ (if res.ok)
const next: MapModel = await res.json()
  ↓
setLiveModel(next)
  React re-renders: overlay chips + panels update with new projectPct / gates / agents / epics
  rAF loop untouched; open overlay stays open; agent positions unchanged
  ↓
if (engine && !mq.matches)
  for each agent in next.agents:
    engine.triggerWalk(agent.role)
  → DOM-only BFS walk to home station; exits to idle when arrived
```

Under `prefers-reduced-motion: reduce`:
- `mq.matches === true` → `triggerWalk` block is skipped entirely.
- `setLiveModel` still fires → overlay data updates statically.
- The rAF loop was never started (S2 guarantee) → no position disruption.

## Dashboard|Map param mapping table

| From `/status/map` | To `/status` | Notes |
|---|---|---|
| `scope=all` | `tab=overview` | default on both sides |
| `scope=epic` | `tab=epic` | |
| `epic=X` | `epic=X` | identical key + value |
| `group=feature|persona` | `group=feature|persona` | identical; omit if `feature` (default) |
| `efilter=all|prog|done|todo` | `efilter=all|prog|done|todo` | identical; omit if `all` (default) |
| `token=T` | `token=T` | identical |

| From `/status` | To `/status/map` | Notes |
|---|---|---|
| `tab=overview` | `scope=all` | |
| `tab=epic` | `scope=epic` | |
| `epic=X` | `epic=X` | identical |
| `group=…` | `group=…` | identical |
| `efilter=…` | `efilter=…` | identical |
| `token=T` | `token=T` | extracted from `tq` string `&token=…` |

## SSE connection — same pattern as dashboard-client.tsx

```ts
// Same backoff as dashboard-client.tsx
es.onerror = () => {
  if (es.readyState === EventSource.CLOSED) {
    es.close(); es = null;
    if (guard++ < 5) setTimeout(openStream, 5000 * guard);
  }
};
// Same 60s fallback interval (as setInterval, not router.refresh)
fallbackId = setInterval(reconcile, 60_000);
```

## Token gate for /status/map/data

```ts
function authorized(req: Request): boolean {
  const required = process.env.STATUS_TOKEN;
  if (!required) return true; // parity: open when STATUS_TOKEN not set
  return new URL(req.url).searchParams.get("token") === required;
}
```

Identical logic to `/api/status/stream/route.ts`. Returns `401` on mismatch.

## Cache behaviour

`/status/map/data` calls `fetchStatusIssues(pulse)` → hits the existing `unstable_cache(_, ["linear-status-issues"], { revalidate: 60 })`. If a pulse event just bumped `readPulse()`, the cache key changes → fresh Linear fetch. Otherwise the cached result is returned — no additional Linear API calls per reconcile viewer.

## Known risks / trade-offs

- `triggerWalk` is called for every agent on every reconcile regardless of whether the agent's status actually changed. This means agents walk to their home station even when only the gates count changed. S7 will refine this to a diff-based walk (only walk when `active` flips or `task` changes).
- The 60s fallback interval is `setInterval(reconcile, 60_000)` — this fires even if the SSE stream is healthy, but since `reconcile` is just a fetch + setState it has no visible side-effect and the cache means no extra Linear call.
- If the user's browser blocks EventSource (e.g. strict CSP), the 60s fallback keeps the data fresh silently.
