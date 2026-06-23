# S3 — Delivery

- **State:** built + self-verified (lint/typecheck/test/build green). PR into `staging`.
- **Branch:** `feature/cam-153-status-map-animation`
- **Files:** `app/status/map/campsite-engine.ts` (new), `app/status/map/campsite-scene.tsx` (edited)
- **Done criterion:** AC verified on the real Staging URL after G3 merge (`/status/map?token=` shows entrance walk + idle-sway; reduced-motion = static). Full visual smoothness = owner glance.
- **No** schema/migration, no new deps, no cost, no PII.
- **Follow-on for S6:** wire `engineRef.current.triggerWalk(role)` to live pulse; consider prefetching walk sprites.
