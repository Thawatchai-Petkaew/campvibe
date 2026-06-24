# CAM-156 S6 — Test

## AC coverage

| AC | Test type | What to assert |
|---|---|---|
| AC-1 real-time reconcile | unit (source inspection) | `campsite-scene.tsx` contains `setLiveModel`, `EventSource`, `reconcile`, `openStream` |
| AC-2 data endpoint 200 | integration (API test) | GET `/status/map/data?token=T` → 200 + JSON with `projectPct`, `gates`, `agents` |
| AC-3 data endpoint 401 | integration | GET `/status/map/data` (STATUS_TOKEN set, no token) → 401 |
| AC-4 SSE backoff | unit (source inspection) | scene contains `guard++` + `5000 * guard` + fallback `setInterval` |
| AC-5 reduced-motion | unit (source inspection) | scene contains `!mq.matches` guard before `triggerWalk` calls |
| AC-6 toggle a11y | unit (source inspection) | scene contains `role="tablist"` + `aria-selected` + `minHeight: 44` |
| AC-7 param carry (map→dash) | unit | `dashboardHref` computation: `scope=epic` → `tab=epic`; `epic/group/efilter/token` present |
| AC-8 toggle in topBar | unit (source inspection) | `app/status/page.tsx` contains `แดชบอร์ด` + `แผนที่` + `tablist` + `mapHref` |
| AC-9 param carry (dash→map) | unit | `mapHref()` function: `tab=epic` → `scope=epic`; params carry |
| AC-10 /status unchanged | source diff guard | f5/f6 guards now skip `feature/cam-156`; page renders same except the link |

## Source-inspection tests (already covered or to add to `__tests__/status-map.test.ts`)

```ts
// Existing test updated: agents projection uses toMapModel (not buildAgents in page.tsx)
it("builds the agents projection via shared toMapModel", () => {
  expect(pageSrc).toContain("toMapModel");
  expect(pageSrc).toContain("buildModel");
});

// New: lib/status-map-model.ts exports toMapModel + buildMapModel
it("lib/status-map-model.ts exports toMapModel", () => {
  const src = read("../lib/status-map-model.ts");
  expect(src).toContain("export function toMapModel");
  expect(src).toContain("export function buildMapModel");
});

// New: data endpoint is token-gated
it("data route is token-gated with STATUS_TOKEN parity", () => {
  const src = read("../app/status/map/data/route.ts");
  expect(src).toContain("STATUS_TOKEN");
  expect(src).toContain("401");
  expect(src).toContain("buildMapModel");
});

// New: scene contains SSE reconcile
it("scene subscribes to SSE + reconciles MapModel without router.refresh", () => {
  const src = read("../app/status/map/campsite-scene.tsx");
  expect(src).toContain("EventSource");
  expect(src).toContain("setLiveModel");
  expect(src).toContain("openStream");
  expect(src).not.toContain("router.refresh");
});

// New: Dashboard|Map toggle a11y
it("scene toggle has tablist + aria-selected", () => {
  const src = read("../app/status/map/campsite-scene.tsx");
  expect(src).toContain('role="tablist"');
  expect(src).toContain("aria-selected");
  expect(src).toContain("แดชบอร์ด");
  expect(src).toContain("แผนที่");
});
```

## QA manual checks (verify on Staging URL)

1. Open `/status/map?token=T`. Trigger a Linear webhook bump (or wait for a real issue change). Confirm: overlay numbers update; agents do not reset positions; entrance walk is NOT replayed.
2. Open `/status/map?scope=epic&epic=X&group=persona&efilter=prog&token=T`. Click `แดชบอร์ด`. Confirm URL is `/status?tab=epic&epic=X&group=persona&efilter=prog&token=T`.
3. Open `/status?tab=epic&epic=X&token=T`. Click `แผนที่`. Confirm URL is `/status/map?scope=epic&epic=X&token=T`.
4. Open `/status/map/data` with no token (STATUS_TOKEN set). Confirm: 401 JSON response.
5. Under `prefers-reduced-motion: reduce` (OS setting): confirm overlay updates but no walk animation.
6. Confirm `แผนที่` tab on `/status/map` and `แดชบอร์ด` tab on `/status` each have ≥44px tap target.
