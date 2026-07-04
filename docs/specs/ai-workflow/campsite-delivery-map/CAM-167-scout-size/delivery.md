# CAM-167 — Reduce baseline character size

- **Why:** on 1920×1080 the clearing-ring characters overlapped because `--scout-size` baseline was too large (116px on the 1920×1080 design canvas).
- **Change:** `--scout-size` root `116px → 88px`; narrow (`max-aspect-ratio:7/5`) override `90px → 74px`. Coordinate-only/size-only — engine, scale architecture, layout coords, HUD unchanged.
- **Model (confirmed with owner):** size is a fixed design-px on the 1920×1080 canvas; `transform: scale(max(100vw/1920,100vh/1080))` scales characters up proportionally on bigger screens (4K/2K) as one unit with the map — not viewport-px.
- **Files:** `app/status/map/campsite-scene.tsx` (SCENE_CSS `--scout-size`), `__tests__/status-map.test.ts` (assertions 116→88 / 90→74).
- **Verify:** lint/typecheck/test/build/palette green; on Staging `?grid=1` the ring has clear gaps at 1920 and scales up on larger screens. Further tuning (size or ring spread) is a single-value edit.
