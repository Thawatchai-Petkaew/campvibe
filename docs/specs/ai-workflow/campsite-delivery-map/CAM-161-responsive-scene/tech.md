# CAM-161 technical notes

## Files changed

### `app/status/map/campsite-scene.tsx`

1. **SCENE_CSS** — replaced old `.map-stage` with:
   - New `.map-viewport` (grid, place-items:center, overflow:hidden, z-index:5)
   - New `.map-bg` (position:absolute, inset:0, object-fit:cover, z-index:0)
   - New `.map-stage` (width:1920px, height:1080px, transform:scale(var(--s)), transform-origin:center)
   - Removed old `translate(-50%,-50%)`, `--ar`, `--zoom`, `width:calc(max(...))`, `background:url(...)`
   - Changed `--scout-size: clamp(88px,7.2vw,116px)` → `--scout-size: 104px`
   - Added `@media (max-aspect-ratio: 7/5) { :root { --scout-size: 82px; } }`

2. **Layout tables** — added as module-level exports:
   - `LAYOUT_WIDE: Record<string, {x,y}>` — art-measured positions for 7 roles
   - `LAYOUT_NARROW: Record<string, {x,y}>` — centre-cluster positions for 7 roles
   - `YOU_POS_WIDE` and `YOU_POS_NARROW` — separate You positions per layout
   - `currentLayout`, `currentYouPos`, `YOU_POS` — mutable module vars updated by `applyLayout()`

3. **`layoutKey` state** — `useState<"wide" | "narrow">("wide")` added to `CampsiteScene`.
   Triggers re-render when aspect ratio changes so `YouScout` + `homeStyle()` update.

4. **Aspect-ratio listener** — added inside the mount-once `useEffect`:
   ```ts
   const arMq = window.matchMedia("(min-aspect-ratio: 7/5)");
   applyLayout(arMq.matches);
   arMq.addEventListener("change", onArChange);
   // cleanup: arMq.removeEventListener("change", onArChange)
   ```

5. **`homeStyle(role)`** — reads from `currentLayout[role]` (was `NODES[cfg.node]`).

6. **`YouScout`** — added `youPos: { x: number; y: number }` prop; renders `left/top` from prop.

7. **JSX structure** — wrapped `.map-stage` in `.map-viewport`; added `<img class="map-bg">` as sibling before `.map-viewport`.

8. **`youPos` derived in render** — `const youPos = layoutKey === "wide" ? YOU_POS_WIDE : YOU_POS_NARROW`.

### `app/status/map/campsite-engine.ts`

1. **`EngineHandle` interface** — added `setHomes(homes: Record<string, { x: number; y: number }>): void`.

2. **`setHomes` implementation** — iterates scouts; for idle agents: overwrites `s.x`, `s.y`, writes DOM positions directly; for walking/entering agents: overwrites `s.x`, `s.y` (they will snap on next idle transition). No loop logic change. No remount.

### `__tests__/status-map.test.ts`

Added 3 new `describe` blocks:
- `campsite-scene.tsx — CAM-161: fixed-canvas scale model` (8 assertions)
- `campsite-scene.tsx — CAM-161: LAYOUT_WIDE + LAYOUT_NARROW` (8 assertions)
- `campsite-engine.ts — CAM-161: setHomes` (2 assertions)

Updated 1 assertion in the fixed-canvas block to be more precise (removed the `translate(-50%,-50%)` check which appeared in a comment).

## Engine contract preserved

The engine's rAF loop (`startEngine`) is unchanged. It still:
- Writes `style.left/top` as `%` of the scout-layer (= % of the 1920×1080 canvas)
- Calculates z-index as `Math.round(s.y * 12) + 5`
- Uses `NODES` for BFS path traversal (walk graph unchanged)
- Transitions modes: `entering → idle`, `walking → idle` via `enterIdle()`

`setHomes()` is additive: it only overrides resting position coordinates; it does not change the path graph or walking mechanics.

## Important limitations / screenshot-tuning required

1. **LAYOUT_WIDE coordinates** are art-estimated, not pixel-measured from the actual WebP.
   The owner must confirm each character's position on the real staging URL before these are final.
   Adjustment range: ±3–5% per character.

2. **LAYOUT_NARROW coordinates** are a reasonable starting arrangement but need visual confirmation
   on an actual 9:16 portrait device to confirm no overlap and adequate spacing.

3. **`--scout-size: 82px` in narrow mode** is a starting value. If characters feel too small/large
   in the narrow cluster, adjust in the `:root { @media (max-aspect-ratio: 7/5) }` block.

4. **Background alignment on LAYOUT_WIDE**: on 16:9 screens both the bg cover and the canvas
   cover produce a 1:1 mapping to the viewport, so art positions align to the image. On ultrawide
   (21:9) the image is cropped top/bottom, but characters (in the y:26–68 band) stay visible.

## Decisions made here vs by the designer/owner

| Decision | Here (locked) | Owner/screenshot (tunable) |
|---|---|---|
| Canvas-scale model (`transform:scale`) | YES — architecture decision | — |
| Aspect threshold (7/5 = 1.4) | YES | Can adjust if 4:3 tablets clip |
| Wide layout art positions | Starting estimate | MUST confirm via screenshot |
| Narrow cluster arrangement | Starting arrangement | Confirm via portrait screenshot |
| Narrow scout-size (82px design) | Starting value | Adjust for visual fit |
| HUD stays fixed (no scale) | YES — invariant | — |
