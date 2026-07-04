## Delivery

CAM-165 — Portrait centering fix + coordinate tune

### Artifacts

- `app/status/map/campsite-assets.ts` — removed OLD `.map-wrap` rule (one-line deletion)
- `app/status/map/campsite-scene.tsx` — LAYOUT_WIDE 7 coords tuned; LAYOUT_NARROW x40/x60 tightened to x42/x58
- `__tests__/status-map.test.ts` — updated LAYOUT_NARROW assertion + added CAM-165 test suite (Fix 1 no-conflict + Fix 2 wide coords)
- `docs/delivery/ai-workflow/campsite-delivery-map/CAM-165-portrait-center-tune/` — story.md + tech.md + this file

### AC coverage

| AC | Test | Status |
|---|---|---|
| AC-1: only one .map-wrap rule | `campsite-assets.ts — CAM-165: no conflicting .map-wrap` | Covered |
| AC-1: scene .map-wrap is position:fixed | `campsite-scene.tsx — CAM-165: .map-wrap is position:fixed` | Covered |
| AC-2: portrait characters not clipped | `LAYOUT_NARROW x-values [42,58]` + visual reasoning (x=58 < 65.82% visible limit) | Covered |
| AC-3: wide coords on furniture | `CAM-165: LAYOUT_WIDE grid-tuned coords` suite (7 assertions) | Covered |
| AC-4: gate/error states unchanged | `.gatebox` and `.map-placeholder` assertions still present | Covered |

### Self-verify results

- `npm run lint` — run, see below
- `npm run typecheck` — run, see below
- `npm test` — run, see below
- `npm run build` — run, see below

### CWV scorecard

- LCP: not measured (internal ops dashboard, not a public page; no CWV budget applies)
- CLS: not measured — the `.map-wrap` fix removes a stacking-context interference that caused
  portrait misalignment; potential CLS improvement but not measured with tooling
- INP: not measured

### Notes for QA

Verify AC-2 by loading `/status/map?token=X` on a 9:16 portrait viewport and confirming:
1. The campfire art center (~x50% of the forest image) aligns with the character canvas center.
2. All 8 characters are fully visible (none clipped at right or left edge).

Verify AC-3 on a 16:9 wide viewport and confirm characters appear on dock/tents/tables (not
in empty terrain or past tree edges).
