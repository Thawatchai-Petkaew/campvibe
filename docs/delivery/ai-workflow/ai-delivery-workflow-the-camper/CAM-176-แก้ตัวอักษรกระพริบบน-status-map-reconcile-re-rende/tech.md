---
linear: CAM-176
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
artifact: tech
owner: frontend
status: Done
version: v2
updated: 2026-06-25
---
# CAM-176 — Tech Spec: two-layer flicker fix for /status/map

## Root causes (two, independent)

### Layer 1 — no-op reconcile re-render

`campsite-scene.tsx` `reconcile()` called `setLiveModel(next)` on every poll/SSE pulse, even when the server returned a byte-identical JSON payload. A new object reference → React re-renders the whole scene → CSS animations on agent badges restart → visible periodic flicker. CAM-175 reduced the poll interval 60s→15s, making a latent bug 4× more frequent/visible on Staging/Prod (Local has empty/static data and no SSE push).

### Layer 2 — wander/rest effect re-runs on every agents ref change

The wander/rest `useEffect` at ~line 1162 had deps `[engineReady, agents]`. Every `setLiveModel` produces a new `agents` array reference (even when activity is unchanged, e.g. a gate or title field changed). The effect re-ran → `engineRef.current?.setActivity(activeByRole)` re-invoked → a walking agent reset/redirected mid-walk → visible character flicker even when a real but activity-unrelated update landed. This pre-existed before CAM-175 but was triggered more often by the shorter interval.

## Fix — two layers, both surgical

### Layer 1: payload-text guard in `reconcile()`

Pure helper in `lib/status-map-model.ts`:

```ts
export function payloadChanged(prev: string, next: string): boolean {
  return prev !== next;
}
```

Ref initialized to the SSR model's serialization in `campsite-scene.tsx`:

```ts
const lastPayloadRef = useRef<string>(JSON.stringify(model));
```

Guard in `reconcile()`:

```ts
const text = await res.text();
if (!payloadChanged(lastPayloadRef.current, text)) return;
lastPayloadRef.current = text;
setLiveModel(JSON.parse(text) as MapModel);
```

No JSON parse on equal payloads. Unchanged board → early return → no `setLiveModel` → no re-render → no animation restart (AC-1). Changed board → different text → `setLiveModel` → one update (AC-2). Error path unchanged → `catch` keeps last-known liveModel (AC-3).

### Layer 2: stable `activeKey` memo — wander/rest effect

Derive a stable string encoding only the fields that drive `setActivity` (role, active flag, activeCount):

```ts
const activeKey = useMemo(
  () => agents.map((a) => `${a.role}:${a.active ? 1 : 0}:${a.activeCount}`).join("|"),
  [agents],
);
```

Change the wander/rest effect dep from `agents` to `activeKey`:

```ts
useEffect(() => {
  if (!engineReady) return;
  // ... reads agents inside the body as before ...
  engineRef.current?.setActivity(activeByRole);
}, [engineReady, activeKey]); // activeKey, not agents — guards mid-walk resets (CAM-176)
```

A reconcile that changes unrelated fields (gate count, task text, title, backlog) produces a new `agents` ref but an identical `activeKey` → effect does NOT re-run → `setActivity` is not re-invoked → walking character continues undisturbed. A genuine activity change (agent starts/stops work) → `activeKey` changes → effect fires → `setActivity` called once → intended behaviour.

## Why freshness from CAM-175 is preserved

Neither layer touches `FALLBACK_MS` (still 15 000 ms), the SSE subscription, or backoff. Poll/push frequency is identical. A real board change (payload differs OR activity changes) passes both guards and triggers an update within one poll or SSE pulse (≤15s).

## Why `summaryStats` stops recomputing on no-op polls

`summaryStats` depends on `epics` (from `liveModel`). When `setLiveModel` is skipped by layer 1, the `epics` reference stays stable → `useMemo` does not re-run. The `Date.now()` values inside `summaryStats` shift at day boundaries only, not per-poll.

## Files touched

| File | Change |
|---|---|
| `lib/status-map-model.ts` | Added `payloadChanged(prev, next): boolean` export |
| `app/status/map/campsite-scene.tsx` | Added `payloadChanged` import; added `lastPayloadRef`; guarded `reconcile()` with text compare; added `activeKey` useMemo; changed wander/rest effect dep to `activeKey` |
| `__tests__/status-map.test.ts` | 20 new CAM-176 tests (see below) |

## Tests (20 new)

Added to `__tests__/status-map.test.ts`:

1. **`payloadChanged` unit tests** (5): equal → false, different → true, empty→non-empty → true, both empty → false, whitespace-only difference → true (strict byte compare confirmed).
2. **Source-inspection: layer 1 wired** (7): `payloadChanged` imported, `lastPayloadRef` declared with `JSON.stringify(model)` init, `res.text()` used, guard call present, ref updated on change, `JSON.parse(text) as MapModel` used, `FALLBACK_MS` still 15 000 ms.
3. **Source-inspection: layer 2 wired** (3): `activeKey` + formula present in source, `[engineReady, activeKey]` dep array confirmed, `agents` still read inside effect body.
4. **`activeKey` semantic tests** (5): identical agents ref → same key, changed `active` flag → different key, changed `activeCount` → different key, unrelated fields → same key (confirms non-activity changes don't trigger setActivity), empty agents → empty key (no crash).

All 2575 tests pass (was 2555 before this work).

## Self-verify results (v2)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 245 warnings (1 pre-existing warning added by unrelated file, none introduced in changed files) |
| `npm run typecheck` | clean (0 errors) |
| `npm test` | 2575 passed (20 new CAM-176 tests, all green) |
| `npm run check:palette` | PASS (0 violations) |
| `npm run check:ds` | PASS (0 violations) |
| `npm run build` | clean — /status/map builds as dynamic route |

## CWV scorecard

| Metric | Value |
|---|---|
| LCP | not measured (no visual change; layer 1 removes spurious re-renders — potential improvement) |
| CLS | not measured (layer 1 eliminates animation restarts on badges; potential improvement) |
| INP | not measured (both layers reduce main-thread work per poll — potential improvement) |

No regressions introduced. The fix reduces client work on the common case (quiet board); all three CWV metrics are risks toward improvement only.

## QA targets (hand-off)

- **AC-1**: open /status/map on Staging, leave open ~1 min with no Linear activity. Agent characters must not flicker mid-walk and badges must not restart. DevTools React profiler: `CampsiteScene` must not re-render on unchanged polls.
- **AC-2**: trigger a real status change on Linear (move a story to a new state). Within ≤15s the board must update, agents must reflect the new active/idle state. Walking agent on an unrelated role must not be interrupted.
- **AC-3**: block `/status/map/data` in DevTools. Board must retain last-known state, not blank or crash.
- **AC-walk**: agent in mid-walk must complete its walk path uninterrupted when a reconcile poll fires with identical activity (only gate/title/backlog changed).
- Regression: all existing /status/map features (lanes, scope switcher, overlays, ENV picker, HUD dock) must be visually unchanged.
