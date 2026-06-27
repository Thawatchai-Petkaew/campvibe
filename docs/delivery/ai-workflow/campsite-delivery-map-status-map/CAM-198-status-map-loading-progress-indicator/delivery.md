---
artifact: delivery
linear: CAM-198
version: v1
updated: 2026-06-26
---

# CAM-198 — delivery

- **Change:** /status/map loading fallback (`scene-loader.tsx`) — glass card `.map-placeholder` → indeterminate amber **progress bar** (`.map-progress` + `.map-progress-bar`, sweep keyframe, `prefers-reduced-motion` guard). a11y `role=progressbar` + `aria-busy` + Thai aria-label; `data-testid=loading--status-map` kept.
- **No migration.** UI loading-state only. Did NOT touch the error card, the SCENE bg, the engine, or the modal approve spinners.
- **Built on an isolated git worktree** (off origin/staging) to avoid colliding with the concurrent CAM-197 session in the main working tree.
- **Gate:** CAM-198 tests pass (status-map.test 191). CI on the PR is the full-suite check. Rollback = revert the squash-merge on staging.
- **Staging verify:** open /status/map → loading shows a slim amber progress bar (no card/spinner); reduced-motion → static bar; scene loads → bar gone; error still shows the error card.
