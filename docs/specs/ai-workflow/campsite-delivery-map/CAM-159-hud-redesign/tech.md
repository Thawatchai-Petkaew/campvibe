# CAM-159 Tech Spec — HUD Redesign

## Component Structure

### Files changed

| File | Change |
|---|---|
| `app/status/map/campsite-overlays.tsx` | Full rewrite of presentation layer: removed `<Overlay>` primitive + corner chip positions; added `CommandDock`, `ExpandPanel`, `KanbanModal`, `ViewToggle` |
| `app/status/map/campsite-scene.tsx` | Import `ViewToggle`; add setScope non-blank guard; add activeEpicData fallback; replace inline nav |
| `__tests__/status-map.test.ts` | Added CAM-159 source-inspection tests (8 describe blocks) |

### Files NOT changed (by design)

- `campsite-engine.ts` — engine unchanged; fix is in the caller (campsite-scene.tsx scope effect)
- `lib/status-map-model.ts` — data shape unchanged
- `lib/status-derive.ts` — derive functions unchanged
- `app/api/status/` — no API changes
- `locales/` — no new i18n keys (internal ops dashboard, copy in component)

## New Component Hierarchy

```
campsite-scene.tsx (client component)
  └── ViewToggle          (from campsite-overlays.tsx) — top-center pill
  └── MapOverlays         (from campsite-overlays.tsx) — overview or epic branch
        └── [CSS: HUD_CSS injected via <style dangerouslySetInnerHTML>]
        └── CommandDock   (hud-dock, role="toolbar")
              └── .hud-seg buttons (6 in overview, 6 in epic including board-btn)
        └── ExpandPanel   (role="dialog" aria-modal, focus-trap)
              └── [DeliveryPanel | CrewPanel | EnvPanel | BacklogPanel |
                   GatesPanel | ScopeSwitcherPanel | EpicProgressPanel |
                   EpicUpNextPanel] (unchanged sub-components, renamed CSS classes)
        └── KanbanModal   (role="dialog" aria-modal, focus-trap, backdrop)
              └── metric pills + progress bar + 5-col Kanban grid
```

## setScope Non-blank Fix

**Location:** `campsite-scene.tsx`, scope effect (the `useEffect` depending on `[scope, activeEpic, group, efilter, epics, engineReady]`).

**Old code:**
```ts
const roles = epicData
  ? [...new Set(epicData.stories.map((s) => s.role).filter(Boolean))]
  : [];
engine.setScope("epic", roles);
```

**New code:**
```ts
const roles = epicData
  ? [...new Set(epicData.stories.map((s) => s.role).filter(Boolean))]
  : [];
if (roles.length > 0) {
  engine.setScope("epic", roles);
} else {
  // Empty roles = unresolved; keep all agents gently visible (fall back to all).
  engine.setScope("all", []);
}
```

**Why:** `engine.setScope("epic", [])` causes ALL agents to receive `opacity: 0.18` (none match any role in an empty set). Falling back to "all" scope keeps all agents at full opacity when no roles are resolvable — the scene is never blank.

## activeEpicData Deep-link Fallback

**Location:** `campsite-scene.tsx`, line declaring `activeEpicData`.

**Old:**
```ts
const activeEpicData = epics.find((e) => e.key === activeEpic) ?? null;
```

**New:**
```ts
const activeEpicData = (activeEpic ? (epics.find((e) => e.key === activeEpic) ?? null) : null);
```

The empty-string guard prevents `find` returning undefined when `activeEpic = ""` (Overview mode). The null fallback ensures panel content uses `activeEpicData?.stories ?? []` safely.

## Old Code Removed

- `<Overlay>` primitive (chipRef, panelRef, CHIP_POSITIONS, PANEL_POSITIONS)
- `OverlayPosition` type and its 7 corner/position values
- `OVERLAY_CSS` CSS string (fully replaced by `HUD_CSS`)
- Old inline `<nav>` in `campsite-scene.tsx` (top:70, left:16 corner position)
- `.ovl-*` CSS class names (replaced by `.hud-*`)

## CSS Architecture

Single `HUD_CSS` string injected via `<style dangerouslySetInnerHTML>` (same pattern as before, internal ops dashboard is exempt from `check:palette` for `app/status/**`). CSS is structured:

1. `.hud-dock` + `.hud-seg` variants — dock geometry and segment states
2. `.hud-panel` + animation — expand panel
3. `.hud-modal-backdrop` + `.hud-modal` + `.hud-modal-box` + animation — Kanban modal
4. `.hud-board` + `.hud-col` + `.hud-card` variants — Kanban grid inside modal
5. `.hud-metric-*` — metric pills
6. Sub-panel content helpers (`.hud-orb-*`, `.hud-crew-*`, `.hud-env-*`, `.hud-bl-*`, `.hud-gate-*`, `.hud-trail-*`, `.hud-queue-*`)
7. `.hud-view-toggle` — top-center pill

All motion wrapped in `@media (prefers-reduced-motion: no-preference)`.

## Focus Management

`useFocusTrap(ref, triggerRef, isOpen, onClose)` — extracted custom hook that:
1. On open: focus first focusable in container (or container itself if none)
2. Tab/Shift+Tab: cycle within the container
3. Escape: close + return focus to `triggerRef.current`
4. Click-outside: close

Used by both `ExpandPanel` and `KanbanModal`.

## Data Flow (unchanged)

```
MapModel (from SSE + /status/map/data) → liveModel state in CampsiteScene
  → passed as props to MapOverlays
    → destructured into dock segments (summary numbers)
    → passed into panel sub-components (full data)
```

No client-side DB or API calls. All data flows through the existing `liveModel` state.
