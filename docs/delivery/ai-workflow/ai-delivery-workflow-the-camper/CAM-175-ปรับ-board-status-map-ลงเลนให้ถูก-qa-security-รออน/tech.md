---
linear: CAM-175
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
artifact: tech
owner: frontend-engineer
version: v1
updated: 2026-06-25
---

# CAM-175 — Tech Notes: boardColumnOf + lag fix + SSE token parity

## 1. boardColumnOf — design + dual title/role param rationale

Added `boardColumnOf()` to `lib/status-derive.ts` as a pure exported helper.
Also exported `BOARD_COLUMNS` const and `BoardColumn` type.

**Precedence (top wins):**
1. `statusType === "completed"` or `status === "Done"` → `"Done"`
2. `labels.includes("awaiting-you")` OR `role ∈ {qa-engineer, security-reviewer}` → `"In Review"`
3. `statusType === "started"` → `"In Progress"`
4. `statusType === "unstarted"` → `"Todo"`
5. otherwise → `"Backlog"`

**Dual title/role param rationale:** two consumer shapes exist in the codebase:

- `StatusIssue` (used in `app/status/page.tsx`) — has a raw `.title` with `[role]` tag embedded
  (e.g. `"[qa-engineer] Write tests"`), and has **no `.role` field**.
- `MapEpicStory` (used in `app/status/map/campsite-overlays.tsx`) — has a cleaned `.title`
  (the `[role]` tag is stripped in `lib/status-map-model.ts`), and has a pre-derived
  canonical `.role` field.

`boardColumnOf` accepts both shapes via `{ status, statusType, labels, title?, role? }`.
Resolution: if `.role` is present and non-empty, run it through `canonRole()`; otherwise
extract from `roleOf(title)` + `canonRole()`. Both `canonRole` and `roleOf` are in the
same file, so no new exports were required.

## 2. Four consumers wired to boardColumnOf

All four board consumers now derive lanes via `boardColumnOf()` instead of raw `s.status`:

| Consumer | File | Old pattern | New pattern |
|---|---|---|---|
| Kanban `byCol` | `app/status/map/campsite-overlays.tsx` ~L1117 | `BOARD_COLS.find(([k]) => k === s.status)?.[0] ?? "Backlog"` | `boardColumnOf(s)` |
| Status Board `SB_LANES` | `app/status/map/campsite-overlays.tsx` ~L2274 | `SB_LANES.find(l => l.key === s.status)?.key ?? "Backlog"` | `boardColumnOf(s)` |
| Summary `statusCounts` (feeds MINI_LANES) | `app/status/map/campsite-scene.tsx` ~L1081 | `statusCounts[s.status]` | `statusCounts[boardColumnOf(s)]` |
| Board COLS | `app/status/page.tsx` ~L359 | `it.filter((i) => i.status === name)` | `it.filter((i) => boardColumnOf(i) === name)` |

Also updated the epic mix bar in `page.tsx` (~L182) for consistency.

Lane keys remain unchanged: "Backlog", "Todo", "In Progress", "In Review", "Done" — matching
`BOARD_COLUMNS`. Lane visuals (labels/colors/dots) are untouched.
The `awaiting-you` badge ("รอคุณ") is preserved — a card in In Review can still show it.

## 3. Lag interval changes

| Setting | Before | After | File |
|---|---|---|---|
| `FALLBACK_MS` | `60_000` (60s) | `15_000` (15s) | `app/status/map/campsite-scene.tsx` ~L1369 |
| `STATUS_STREAM_POLL_MS` default | `2500` | `1500` | `app/api/status/stream/route.ts` ~L20 |

The 1500ms SSE poll fires the `readPulse()` DB check. When a pulse arrives, the client
reconciles `/status/map/data`. In the normal case (SSE connected), updates arrive within
~1.5s. If SSE fails to connect, the 15s fallback catches it. Worst case = 15s, meets the
≤15s AC. `STATUS_STREAM_POLL_MS` is env-overridable so tests and staging can set different
values without a code change.

## 4. SSE token parity — finding

**Verdict: already correct. No fix needed.**

Both `reconcile()` and `openStream()` in `campsite-scene.tsx` build `qs` identically:
```ts
const qs = token ? `?token=${encodeURIComponent(token)}` : "";
```

Both `/api/status/stream` and `/status/map/data` use `authorized(req)`:
```ts
function authorized(req: Request): boolean {
  const required = process.env.STATUS_TOKEN;
  if (!required) return true; // open when env is unset
  return new URL(req.url).searchParams.get("token") === required;
}
```

`token` in `campsite-scene.tsx` is a server-side prop passed from `page.tsx` at mount time
and is stable through the component lifetime. SSE will connect and stay connected without
producing a 401 provided the token is correct. There is no token drift or mismatch.

## 5. Orchestrator convention added

Added a "Board lane semantics + create rule" section to `.claude/agents/orchestrator.md`
(near the existing "Gate continuation" section) documenting the five lanes, their meaning,
and the create rule (new stories in Todo/unstarted, not Backlog; first build handoff starts
the story; QA/Security/awaiting-you read as In Review automatically via `boardColumnOf`).

## 6. Tests

Added a `boardColumnOf` describe block plus a source-inspection describe block in
`__tests__/status-derive.test.ts`. Full test matrix:

- completed → Done
- status "Done" (statusType started) → Done
- awaiting-you + statusType started → In Review (beats started)
- role qa-engineer via `.role` field → In Review
- role security-reviewer via `.role` field → In Review
- raw `[qa-engineer]` title + no `.role` → In Review (resolves via roleOf)
- MapEpicStory case (cleaned title + `.role` pre-derived) → In Review
- started, other role → In Progress
- unstarted → Todo
- backlog → Backlog
- precedence: completed beats awaiting-you
- precedence: awaiting-you beats started
- short alias `[qa]` in title → In Review
- short alias `[security]` in title → In Review
- no role, unstarted → Todo

Source-inspection tests assert:
- `campsite-overlays.tsx` imports + uses `boardColumnOf(s)`; old `BOARD_COLS.find` and
  `SB_LANES.find` patterns are absent
- `app/status/page.tsx` imports + uses `boardColumnOf(i) === name`; old `i.status === name`
  board filter is absent

Total: 122 tests pass (110 pre-existing + 12 new boardColumnOf/source-inspection tests).
