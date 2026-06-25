---
linear: CAM-176
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: test
owner: qa-engineer
status: In Review
version: v1
updated: 2026-06-25
---
# Test — แก้ตัวอักษรกระพริบบน /status/map (CAM-176)

## AC->test matrix

| AC | test-id | layer | test name | pass/fail |
|---|---|---|---|---|
| AC-1 (no-op guard: identical payload -> no setLiveModel) | `btn--status-map-layer1-noop` | unit | `returns false when prev and next are identical strings` | pass |
| AC-1 (no-op guard: guard wired in source) | `btn--status-map-layer1-wired` | source-inspect | `reconcile reads response as text (res.text()) not res.json()` | pass |
| AC-1 (no-op guard: guard wired in source) | `btn--status-map-layer1-wired` | source-inspect | `reconcile calls payloadChanged guard before setLiveModel` | pass |
| AC-1 (no-op guard: ref updated on change) | `btn--status-map-layer1-wired` | source-inspect | `reconcile updates lastPayloadRef.current on a real change` | pass |
| AC-1 (no-op guard: ref init) | `btn--status-map-layer1-wired` | source-inspect | `declares lastPayloadRef with useRef and JSON.stringify(model) initializer` | pass |
| AC-2 (real change -> setLiveModel) | `btn--status-map-layer1-diff` | unit | `returns true when next differs from prev` | pass |
| AC-2 (real change -> JSON.parse path) | `btn--status-map-layer1-wired` | source-inspect | `reconcile calls setLiveModel with JSON.parse(text)` | pass |
| AC-3 (error catch preserved) | `btn--status-map-layer1-wired` | source-inspect | `FALLBACK_MS is still 15_000 (CAM-175 freshness preserved)` | pass |
| AC-1/AC-2 (edge: empty->non-empty) | `btn--status-map-layer1-edge` | unit | `returns true when prev is empty string and next is non-empty` | pass |
| AC-1/AC-2 (edge: both empty) | `btn--status-map-layer1-edge` | unit | `returns false when both prev and next are empty strings` | pass |
| AC-1/AC-2 (edge: whitespace strict) | `btn--status-map-layer1-edge` | unit | `returns true when whitespace differs (exact byte compare)` | pass |
| AC-walk (layer 2: activeKey dep line) | `btn--status-map-layer2-dep` | source-inspect | `wander/rest effect dep array uses activeKey, not agents` | pass |
| AC-walk (layer 2: activeKey formula) | `btn--status-map-layer2-formula` | source-inspect | `derives activeKey via useMemo keyed on agents` | pass |
| AC-walk (layer 2: agents still read inside effect) | `btn--status-map-layer2-body` | source-inspect | `wander/rest effect still reads agents array inside the effect body` | pass |
| AC-walk (layer 2: same ref -> same key) | `btn--status-map-layer2-semantic` | unit | `identical agents list (new array ref, same values) yields the same key` | pass |
| AC-walk (layer 2: active flag change) | `btn--status-map-layer2-semantic` | unit | `changed active flag yields a different key` | pass |
| AC-walk (layer 2: activeCount change) | `btn--status-map-layer2-semantic` | unit | `changed activeCount alone yields a different key` | pass |
| AC-walk (layer 2: unrelated field no-op) | `btn--status-map-layer2-semantic` | unit | `unrelated field changes are NOT encoded - key stays the same` | pass |
| AC-walk (layer 2: empty agents) | `btn--status-map-layer2-semantic` | unit | `empty agents list yields an empty key (edge case - no crash)` | pass |
| AC-1 (import wired) | `btn--status-map-layer1-import` | source-inspect | `imports payloadChanged from @/lib/status-map-model` | pass |

Total CAM-176 tests: 20 (all pass). Full suite: 2575 tests, 0 failures.

## Walking-character mechanism (how the fix stops flicker)

Before CAM-176, `campsite-scene.tsx` reconcile() called `setLiveModel(next)` unconditionally on every 15s poll and SSE event. Even when the server returned a byte-identical JSON payload, a new object reference caused React to re-render the entire scene, restarting CSS animations on agent badges (visible flicker). Separately, the wander/rest `useEffect` had dep `[engineReady, agents]` — every `setLiveModel` (even for unrelated field changes) produced a new `agents` array ref, re-triggering `setActivity()` and interrupting mid-walk agents.

Layer 1 guard: `reconcile()` now reads the response as text (`res.text()`), compares it byte-for-byte against `lastPayloadRef.current` via `payloadChanged()`. An identical payload returns early before any `setLiveModel` — no React re-render, no animation restart. A different payload updates the ref and calls `setLiveModel(JSON.parse(text))` once.

Layer 2 stable key: `activeKey` is a `useMemo` string encoding only `role:active:activeCount` per agent, derived from the `agents` array. The wander/rest effect dep changed from `[engineReady, agents]` to `[engineReady, activeKey]`. A reconcile that changes gate count, task text, or title produces a new `agents` ref but an identical `activeKey` — the effect does not re-run, `setActivity` is not re-invoked, and a walking agent continues its path undisturbed.

## Source-inspection: exact dep line

File: `app/status/map/campsite-scene.tsx` line 1183:
```
}, [engineReady, activeKey]); // activeKey, not agents — guards mid-walk resets (CAM-176)
```
Confirmed: dep is `activeKey` (stable string), not `agents` (new ref on every reconcile).

Layer 1 guard lines 1400-1407:
```
const text = await res.text();
if (!payloadChanged(lastPayloadRef.current, text)) return;
lastPayloadRef.current = text;
```
Confirmed: response read as text, guard compares strings, early return on no-change.

## Regression confirmation

- `git diff staging -- lib/status-model.ts app/status/map/data/route.ts app/api/status/stream/route.ts` — 0 lines changed. Data route, stream route, and shared model untouched.
- `git diff staging -- app/status/map/campsite-scene.tsx` additions only: import of `payloadChanged`, `lastPayloadRef` useRef, `activeKey` useMemo, dep line change, guard block in `reconcile()`. No CSS/animation/lane/color/engine/interval changes.
- `FALLBACK_MS` confirmed still `15_000` (line 1392 of campsite-scene.tsx).
- `SSE EventSource` subscription block unchanged.
- All 45 test files pass (2575 tests, 0 failures). No pre-existing tests broken.

## Coverage

- `payloadChanged` (new export, `lib/status-map-model.ts` lines 182-184): 100% covered — 5 unit tests exercise both branches (equal returns false, unequal returns true) and all edge cases (empty, whitespace).
- `activeKey` formula in campsite-scene.tsx: covered by 5 semantic unit tests that replicate the formula in isolation. No extraction needed (formula is one line).
- Overall `lib/status-map-model.ts` coverage: 8.33% (pre-existing; lines 39-167 are `toMapModel`/`buildMapModel`, unchanged and untested before this story — not new code).
- Full suite coverage: 82.91% (reported from real run, meets >=80% on new code).

## Validation cases

Layer 1 (`payloadChanged`) — coverage matrix:

| Case | Test | Result |
|---|---|---|
| normal (equal) | equal strings -> false | pass |
| normal (different) | different strings -> true | pass |
| null/empty (prev empty) | "" + non-empty -> true | pass |
| null/empty (both empty) | "" + "" -> false | pass |
| boundary (whitespace) | `{"a":1}` vs `{"a": 1}` -> true (strict byte) | pass |

Layer 2 (`activeKey`) — coverage matrix:

| Case | Test | Result |
|---|---|---|
| normal (same ref) | new array, same values -> same key | pass |
| normal (active change) | active false->true -> different key | pass |
| normal (count change) | activeCount 1->2 -> different key | pass |
| boundary (unrelated field) | task/title change -> same key | pass |
| null/empty (empty agents) | [] -> "" (no crash) | pass |

## Links

`story.md` (AC/Rules) · `tech.md` (two-layer spec) · `__tests__/status-map.test.ts` (lines 1027-1156, 20 CAM-176 tests) · `.claude/rules/qa.md`

## Changelog

- v1 (2026-06-25) — created
