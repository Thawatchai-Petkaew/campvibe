# CAM-158 — Delivery

- **State:** built + self-verified, PR into `staging`.
- **Branch:** `fix/cam-158-status-map-forest-bg`
- **Asset:** `design/campsite-forest.png` (9.6MB, 4000×2250) → optimized to `public/status-map/campsite-forest.webp` (**2000×1125, ~130KB**, WebP q84) — under the 200KB image budget. Source PNG kept in `design/` (untracked), not committed.
- **Wiring:** `app/status/map/campsite-assets.ts` `.map-scene` background = a translucent dark gradient overlay (for text legibility) over the forest WebP (`center/cover`) over a `#070d1c` fallback. Aurora + stars kept on top as atmosphere. Static under reduced-motion.
- **Verify:** lint/typecheck/build green; image < 200KB. AC on the real Staging URL after merge.
- No schema/migration, no deps, no cost, no PII.
