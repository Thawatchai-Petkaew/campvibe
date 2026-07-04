# S4 — Tech

## Component structure

```
app/status/map/
  campsite-scene.tsx      — widened MapModel interface; adds overlay state + renders <MapOverlays>
  campsite-overlays.tsx   — (new) <Overlay> primitive + 5 panel components + <MapOverlays> root
  page.tsx                — widened mapModel projection: gates→MapGate[], backlogItems, envLanes
```

## MapModel widening

New exported types in `campsite-scene.tsx`:

```ts
export interface MapGate {
  id: string; title: string; url: string; epicKey: string; priority: string;
}
export interface MapBacklogItem {
  id: string; title: string; role: string; epicKey: string;
}
export interface MapEnvItem {
  id: string; title: string; role: string;
}
export interface MapModel {
  // S1–S3 fields
  projectPct: number;
  gates: MapGate[];          // changed from {id,title,url}[] to MapGate[]
  agents: MapAgent[];
  epicNames: string[];
  // S4 additions
  epicsActive: number;
  totalEpics: number;
  backlogItems: MapBacklogItem[];
  envLanes: { dev: MapEnvItem[]; staging: MapEnvItem[]; prod: MapEnvItem[] };
}
```

## Single-open / Esc / focus-trap mechanics

### State

```ts
const [openOverlay, setOpenOverlay] = useState<string | null>(null);
const openPanel  = useCallback((id: string) => setOpenOverlay(id), []);
const closePanel = useCallback(() => setOpenOverlay(null), []);
```

Held in `CampsiteScene` (the single-mount client component). Passed to `<MapOverlays>` + `<YouScout>` as props. Only one `id` can be `openOverlay` at a time — switching chips sets a new id, implicitly closing the old panel.

### <Overlay> primitive

- **Chip** = `<button aria-expanded={isOpen} aria-controls={panelId}>` — rendered only when `!isOpen`.
- **Panel** = `<div role="dialog" aria-modal="true" aria-labelledby="...">` — rendered only when `isOpen`.
- Mounting in the panel triggers a `useEffect` that:
  1. Moves focus to the first focusable element inside the panel (uses FOCUSABLE selector).
  2. Adds `keydown` listener on `document` (capture phase): Esc → `onClose()` + `chipRef.current?.focus()`; Tab wraps focus within the panel.
  3. Adds `mousedown` listener on `document` (capture phase): if target is outside both the panel and the chip → `onClose()`.
  4. Returns cleanup that removes both listeners.

Port of the `openSwitcher`/`closeSwitcher`/Esc idiom from `dashboard-client.tsx` — same contract, now expressed as React state + `useEffect` instead of imperative DOM mutations.

### Canvas dim

A fixed `aria-hidden` overlay div (z-index 19) is rendered when `openOverlay !== null`. The scene's `map-stage` also transitions to `opacity: 0.82`. Both use `transition: 200ms`. Neither is vestibular motion risk — static fade only.

## MapOverlays root

```tsx
export function MapOverlays({ model, openOverlay, onOpen, onClose }: MapOverlaysProps)
```

Renders 5 `<Overlay>` instances. Each receives:
- `isOpen={openOverlay === id}`
- `onOpen={() => onOpen(id)}` — no extra state, the parent owns it
- `onClose` — same closer for all

The `you-gates` overlay has no chip rendered (chipNode = null) because its trigger is the `<YouScout>` `you-alert` button. When the you-alert button is clicked it calls `onOpenGates` → `openPanel("gates")` in the parent scene. The Overlay for "gates" with `!isOpen` renders nothing (chip is hidden, no chip node). When `openOverlay === "gates"` it renders the dialog panel.

## Projection (page.tsx server-side)

```ts
const gates: MapGate[] = m.gates.map(i => ({
  id: i.id, title: cleanTitle(i.title), url: i.url,
  epicKey: epicOf(i.title), priority: i.priority,
}));

const backlogItems: MapBacklogItem[] = m.backlog.map(i => ({
  id: i.id, title: cleanTitle(i.title),
  role: canonRole(titleRoleOf(i.title)),
  epicKey: epicOf(i.title) || i.parent?.title || "",
}));

const buildEnvItems = (items: StatusIssue[]): MapEnvItem[] =>
  items.map(i => ({ id: i.id, title: cleanTitle(i.title), role: canonRole(titleRoleOf(i.title)) }));

envLanes: { dev: buildEnvItems(m.byEnv.dev), staging: ..., prod: ... }
```

All data comes from `buildModel()` → `m.byEnv` (from `envOf` in `status-derive.ts`), `m.backlog`, `m.gates`, `m.epicNodes`, `m.epicsActive`. Zero new DB calls.

## Removed: map-stat-bar

The S2 `map-stat-bar` (centered top bar with `{projectPct}% · gates`) was removed — its data is now surfaced through the Delivery overlay chip, avoiding duplicate information (anti-slop rule). The CSS for `.map-stat-bar/.stat-pct/.stat-sep/.stat-label` was removed from `SCENE_CSS`.

## Known risks

- Panel max-width is 340px. On very small viewports the panel could overflow, but `/status/map` is an internal ops dashboard not designed for mobile-first. Accept for S4.
- The `you-gates` panel opens centered via CSS `position:fixed; top:50%; left:50%; transform:translate(-50%,-50%)` — if the You character is behind the panel the visual connection is lost. Acceptable trade-off for S4.
- Focus trap requires JS. If JS fails, the panel can still be closed with Esc (browser native) since `role="dialog"` is set. Server-rendered shell with graceful degradation.
