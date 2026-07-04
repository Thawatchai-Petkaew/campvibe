# CAM-155 S5 — Tech

## Component structure

```
app/status/map/
  campsite-engine.ts      — added engine.setScope(scope, epicRoles): DOM-only opacity/pointer-events
  campsite-scene.tsx      — widened MapModel (epics: MapEpicItem[]); scope/epic/group/efilter state;
                            useEffect → engine.setScope + syncUrl; Props extended with initial* params
  campsite-overlays.tsx   — Scope Switcher + Epic overlays (Progress/Up-next/Board); MapOverlaysProps
                            extended with scope/activeEpic/activeEpicData/group/efilter + callbacks
  scene-loader.tsx        — passes initial* params through to CampsiteScene
  page.tsx                — reads scope/epic/group/efilter from searchParams; projects epics into MapModel
```

## MapModel widening (S5 additions)

```ts
// campsite-scene.tsx — new exported types
export interface MapEpicStory {
  id: string;
  title: string;        // cleaned (no epic prefix, no [role] tag)
  status: string;       // "In Progress" | "Done" | "Backlog" | "Todo" | "In Review"
  statusType: string;   // backlog | unstarted | started | completed | canceled
  labels: string[];     // for hasAwait / epicBucket / stageOf (via storyAsIssue adapter)
  role: string;         // canonical role key ("" if untagged)
  url: string;
  startedAt: string | null;
}

export interface MapEpicItem {
  key: string;          // epic key = ?epic= value (= epic title)
  label: string;        // display name
  feature: string;      // Linear Project name
  persona: string;      // persona label ("" = none)
  bucket: "prog" | "done" | "todo";   // epicBucket() result — server-side
  stories: MapEpicStory[];
}

// MapModel (additional field)
MapModel.epics: MapEpicItem[]
```

## engine.setScope() — no remount

```ts
// campsite-engine.ts — EngineHandle.setScope
setScope(scope: "all" | "epic", epicRoles: string[]): void
```

- Called from `useEffect` in `CampsiteScene` when `scope`, `activeEpic`, or `epics` changes.
- DOM-only: iterates `scouts[]` and sets `rootEl.style.opacity` (1 or 0.18) + `rootEl.style.pointerEvents` + `rootEl.style.transition = "opacity 300ms ease-out"`.
- The rAF loop (`startEngine`) continues running — `startEngine` is NOT called again and `stopLoop()` is NOT called. This is the critical anti-remount guarantee.
- In Overview scope: restores all agents to opacity `""` (CSS default = 1).
- In Epic scope: dims agents whose `role` is NOT in `epicRoles`; keeps agents IN the epic at full opacity.

## URL param sync + restore

### Sync (client → URL)

```ts
// campsite-scene.tsx
useEffect(() => {
  engine.setScope(scope, roles);
  syncUrl({ scope, epic, group, efilter });
}, [scope, activeEpic, group, efilter, epics]);

function syncUrl(params): void {
  const u = new URL(location.href);
  // set or delete each param, then history.replaceState
}
```

- Uses `history.replaceState` — no navigation, no re-render of the server component.
- Compatible with `/status` param semantics: `scope=all` ↔ `tab=overview`, `scope=epic` ↔ `tab=epic`; `epic`, `group`, `efilter` are identical keys with identical values on both routes.
- S6 can construct a cross-route deep-link by copying the query string and changing only the path.

### Restore (URL → client state)

```ts
// page.tsx (server) reads searchParams and passes initial values as props to SceneLoader
const initialScope   = sp.scope === "epic" ? "epic" : "all";
const initialEpic    = sp.epic ?? "";
const initialGroup   = sp.group === "persona" ? "persona" : "feature";
const initialEfilter = validEfilters.includes(sp.efilter) ? sp.efilter : "all";
```

- Props flow: `page.tsx` → `SceneLoader` → `CampsiteScene` → `useState(initial*)`.
- This means deep-link `?scope=epic&epic=X` renders in Epic scope from the first paint — no client-side redirect needed.

## Client-side derive parity with /status

`storyAsIssue(s: MapEpicStory)` adapts `MapEpicStory` to the minimal shape expected by `stageOf`, `buildTrail`, and `hasAwait` from `lib/status-derive.ts`:

```ts
function storyAsIssue(s: MapEpicStory): StatusIssue {
  return {
    title: s.role ? `[${s.role}] ${s.title}` : s.title, // reconstruct [role] tag for stageOf
    status: s.status, statusType: s.statusType,
    labels: s.labels,
    // rest: empty/null (not used by these helpers)
  };
}
```

- `stageOf(i)` uses `roleOf(i.title)` → canonical role → `ROLE_STAGE` lookup. Reconstructing `[role]` ensures identical stage assignment.
- `buildTrail` classifies each story by `stageOf` — same algorithm as `/status` renderEpic.
- `epicBucket` is called server-side in `page.tsx` on `node.stories` (raw `StatusIssue[]`) — same input as `/status`.

## Epic roles for setScope

```ts
// campsite-scene.tsx useEffect
const epicData = epics.find((e) => e.key === activeEpic);
const roles = epicData
  ? [...new Set(epicData.stories.map((s) => s.role).filter(Boolean))]
  : [];
engine.setScope("epic", roles);
```

- Role is taken from `s.role` (canonical, from `canonRole(titleRoleOf(i.title))` in `page.tsx`).
- Agents whose `role` is in this set stay at full opacity; others dim to 0.18.

## Known risks / trade-offs

- `storyAsIssue` reconstructs `[role]` in the title string. If a story has multiple accumulated `role:*` labels (from `rolesOf()`), only the current `[role]` tag is used here — same as the primary actor `stageOf` uses. Consistent with `/status`'s display of the current-stage role.
- Board chip at `position="bottom"` (centered) may overlap with the Backlog chip in Overview mode. The two are never shown simultaneously (scope gates which set is rendered), so no conflict.
- `setScope` called immediately on mount if `initialScope === "epic"` — but `engineRef.current` may be null at that point (engine not yet started). The useEffect guard `if (!engine) return` means the initial visual narrowing happens only after the engine starts. For reduced-motion users, the engine never starts, so `setScope` is never called — the scene is always fully visible (static mode). Acceptable: reduced-motion users see all agents.
