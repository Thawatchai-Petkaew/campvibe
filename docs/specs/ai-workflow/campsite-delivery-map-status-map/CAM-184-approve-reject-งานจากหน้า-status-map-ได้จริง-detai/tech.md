---
linear: CAM-184
feature: ai-workflow
epic: campsite-delivery-map-status-map (CAM-150)
artifact: tech
owner: backend-engineer
version: v1
updated: 2026-06-26
---
# Tech Spec — CAM-184: Approve/Reject/Detail from /status/map (Backend)

## Summary

Three new server-only API routes + a `addLabel` helper + updated webhook approve-vs-reject logic + orchestrator.md gate-continuation docs.  No DB / Prisma migration (Linear + UI only).  All endpoints token-gated via the existing `authorized()` / `STATUS_TOKEN` pattern.

---

## 1. New helper: `addLabel` in `lib/linear-actions.ts`

```
addLabel(identifier: string, labelName: string): Promise<boolean>
```

- Mirrors `removeAwaitingYou`: uses `findIssue()` then `issueUpdate` mutation via `gql()`.
- **Idempotent** — returns `true` immediately if the label is already present (no extra mutation).
- Fetches the team's label list once per call to resolve the label id by name.
- Uses `LINEAR_API_KEY` (server-only; `"use server"` + `import "server-only"` already at top of file).
- Returns `false` if the issue or label does not exist in Linear.

---

## 2. API Contract

### POST `/api/status/approve`

| Field | Value |
|---|---|
| File | `app/api/status/approve/route.ts` |
| Runtime | `nodejs`, `dynamic = force-dynamic` |
| Auth | `STATUS_TOKEN` via `?token=` query param OR `x-status-token` header |
| Rate-limit | 20 req/min per IP (in-process sliding window, `lib/rate-limit.ts`) |

**Request body** (JSON):
```json
{ "id": "CAM-184" }
```

**Validation**: `id` must match `^[A-Z]+-\d+$` exactly (uppercase team prefix + number).

**Response (200)**:
```json
{ "ok": true, "approved": true }
```
`approved` is `false` when the issue was not found or had no `awaiting-you` label.

**Error codes**:
| Code | Condition |
|---|---|
| 400 | `id` missing, empty, or malformed |
| 401 | Token absent or wrong |
| 429 | Rate-limit exceeded; `Retry-After` header set |
| 500 | Internal error (no stack/secret in response) |

**Side effects**: calls `removeAwaitingYou(id)` only.  The "Approved" Telegram notification + `repository_dispatch` are fired by the Linear webhook (single source) — not duplicated here.

---

### POST `/api/status/reject`

| Field | Value |
|---|---|
| File | `app/api/status/reject/route.ts` |
| Runtime | `nodejs`, `dynamic = force-dynamic` |
| Auth | `STATUS_TOKEN` via `?token=` query param OR `x-status-token` header |
| Rate-limit | 20 req/min per IP (in-process sliding window, `lib/rate-limit.ts`) |

**Request body** (JSON):
```json
{ "id": "CAM-184", "reason": "Optional Thai or English explanation" }
```

`reason` is optional. If absent, empty, or whitespace-only, defaults to `"ส่งกลับให้แก้ไขจาก /status/map"`.  Capped at 2000 characters (plain text; never exec'd or put into a prompt).

**Validation**: same `^[A-Z]+-\d+$` check on `id`.

**Response (200)**:
```json
{ "ok": true }
```

**Error codes**: same set as `/approve` (400 / 401 / 429 / 500).

**Side effects** (in order — this order is load-bearing):
1. `addComment(id, reason)` — writes the owner's reason to Linear before any label change.
2. `addLabel(id, "changes-requested")` — marks the issue as rejected.
3. `removeAwaitingYou(id)` — clears the gate, which fires the Linear webhook.

The webhook detects `awaiting-you` removed + `changes-requested` present → fires "Sent back for changes" Telegram; does NOT fire `repository_dispatch` (the AI must rework before re-raising).

---

### GET `/api/status/issue/[id]`

| Field | Value |
|---|---|
| File | `app/api/status/issue/[id]/route.ts` |
| Runtime | `nodejs`, `dynamic = force-dynamic` |
| Auth | `STATUS_TOKEN` via `?token=` query param OR `x-status-token` header |
| Rate-limit | none (read-only; reuses existing `fetchStatusIssues` cache) |

**Path param**: `id` — Linear identifier, e.g. `CAM-184`.  Case-insensitive match.

**Response (200)**:
```json
{
  "id": "CAM-184",
  "title": "[backend-engineer] Approve/Reject งานจาก /status/map",
  "status": "In Review",
  "statusType": "started",
  "role": "backend-engineer",
  "description": "Description text from Linear...",
  "url": "https://linear.app/campvibe/issue/CAM-184",
  "assignee": { "name": "AI", "displayName": "AI", "avatarUrl": null },
  "project": { "id": "proj-id", "name": "Project name" },
  "labels": ["awaiting-you", "role:backend-engineer"]
}
```

`role` is extracted from the `[role]` prefix in the title via `roleFromTitle()` (already in `lib/notify-messages.ts`); omitted if no `[role]` tag is present.

**Data source**: `fetchStatusIssues(pulse=0)` — reuses the pulse-keyed `unstable_cache` (60s TTL); no extra Linear API call beyond the dashboard's existing budget.

**Error codes**:
| Code | Condition |
|---|---|
| 400 | `id` malformed |
| 401 | Token absent or wrong |
| 404 | Issue not found in `fetchStatusIssues()` result |
| 500 | Internal error (no stack/secret) |

---

## 3. Webhook: approve-vs-reject logic

File: `app/api/linear-webhook/route.ts`

### Before (CAM-184):
```ts
const looksApproved = isGate && labelChanged && !stillAwaiting;
// Only notified "approved" + fired dispatch.
```

### After (CAM-184):
```ts
// APPROVED: awaiting-you removed AND changes-requested absent.
const looksApproved = isGate && labelChanged && !stillAwaiting && !hasChangesRequested;

// REJECTED: changes-requested just added.
const looksRejected = isGate && labelChanged && addedNames.includes("changes-requested");
```

- `looksApproved = true` → "Approved — the team continues" Telegram + `repository_dispatch` (unchanged).
- `looksRejected = true && !looksApproved` → "Sent back for changes" Telegram; **no** `repository_dispatch`.
- Response now includes `{ approved, rejected }` fields for downstream diagnostics.

This means a map-reject (`addLabel("changes-requested")` then `removeAwaitingYou()`) fires two webhook events:
1. Label added (`changes-requested` added while `awaiting-you` still present) → `looksRejected = true` → "Sent back" Telegram.
2. Label removed (`awaiting-you` removed, `changes-requested` present) → `looksApproved = false` → no double-send.

---

## 4. Orchestrator.md — Gate continuation

File: `.claude/agents/orchestrator.md`

The "Gate continuation" section has been extended to document the three approve paths + the new reject path.  Key addition:

**When `awaiting-you` clears, check `changes-requested`:**

| `changes-requested` present? | Meaning | Action |
|---|---|---|
| No | APPROVED | Proceed to next story/step |
| Yes | REJECTED | Read reason via Linear MCP `list_comments`, rework, then re-raise: remove `changes-requested` + re-add `awaiting-you` |

The rework loop is documented as steps 1–4 in the orchestrator's Gate continuation section.

---

## 5. Rate-limit

Both mutating routes (`/approve`, `/reject`) use `lib/rate-limit.ts` (`checkRateLimit`) with:
- `limit: 20` requests per `windowMs: 60_000` (1 minute).
- Key format: `status:approve:<ip>` / `status:reject:<ip>`.
- In-process sliding window — best-effort on serverless (per the existing rate-limit.ts disclaimer); distributed rate-limiting is deferred pending owner's cost approval.
- 429 response includes `Retry-After` header in seconds.

---

## 6. Security notes

- `LINEAR_API_KEY` is used only in `lib/linear-actions.ts` (`"use server"` + `import "server-only"`) — never exposed to the client bundle.
- `STATUS_TOKEN` checked on every new endpoint before any side-effect.
- `reason` is plain text capped at 2000 chars; it is written to a Linear comment and never put into a prompt or exec'd.
- No PII, stack trace, or secret appears in any response body.
- Rate-limit on both POSTs prevents abuse of the Linear API (free-tier rate).
- Seed/scrape routes not touched.

---

## 7. Test coverage

File: `__tests__/status-approve-endpoints.test.ts` (31 tests, all pass)

| Suite | Tests |
|---|---|
| POST /approve | 11 (401 no token, 401 wrong token, 200 query, 200 header, 200 open, 400 bad id ×3, 429 rate, approved=false) |
| POST /reject | 8 (401 no token, 401 wrong header, 400 bad id, order verified, default reason, cap 2000, whitespace default, 429) |
| GET /issue/[id] | 7 (401, 400, 200 detail, case-insensitive, 404, token via query, no-role) |
| webhook approve-vs-reject | 5 (looksApproved true, false with CR, looksRejected true, no dispatch on reject, regression test) |

Existing tests: `linear-webhook.test.ts` (31 tests) + `telegram-webhook.test.ts` (12 tests) — all pass unmodified.

Full suite: **50 test files / 2673 tests — all pass**.

---

## 8. Files changed

| File | Change |
|---|---|
| `lib/linear-actions.ts` | Add `addLabel(identifier, labelName): Promise<boolean>` |
| `app/api/status/approve/route.ts` | **NEW** — POST approve endpoint |
| `app/api/status/reject/route.ts` | **NEW** — POST reject endpoint |
| `app/api/status/issue/[id]/route.ts` | **NEW** — GET issue detail endpoint |
| `app/api/linear-webhook/route.ts` | Extend `looksApproved` + add `looksRejected` |
| `.claude/agents/orchestrator.md` | Extend Gate continuation section |
| `__tests__/status-approve-endpoints.test.ts` | **NEW** — 31 contract tests |

No DB migration. No new dependencies. No `prisma/schema.prisma` change.

---

## 9. What frontend needs

Frontend (`campsite-overlays.tsx` + `campsite-scene.tsx`) should fetch these shapes:

**Approve**: `POST /api/status/approve?token=<TOKEN>` body `{ id }` → `{ ok, approved }`.

**Reject**: `POST /api/status/reject?token=<TOKEN>` body `{ id, reason? }` → `{ ok }`.

**Detail**: `GET /api/status/issue/<ID>?token=<TOKEN>` → `{ id, title, status, statusType, role, description, url, assignee, project, labels }`.

Token passed via `?token=` query param (matching the existing scene `qs = token ? ?token=... : ""` pattern).  On success the frontend should trigger a reconcile (existing SSE/pulse refresh removes the cleared gate from the map).

---

## 10. Frontend changes (CAM-184 UI — appended by Frontend Engineer)

### Files touched

| File | Change |
|---|---|
| `app/status/map/campsite-overlays.tsx` | ApprovalCard amber-tinted glass, gate rows → `<button>`, CTA "อนุมัติทั้งหมด" + confirm-morph, `.hud-appr-badge` removed, new GateDetailModal component, `approveGate` / `rejectGate` / `fetchGateDetail` client fns, GateDetailModal CSS |
| `app/status/map/campsite-scene.tsx` | `.you-alert` smaller (12px/13px icon/5px 11px padding), `.scout.has-gate .popover{display:none}`, `.badge`/`.popover`/`.pop-role` border → neutral (rgba white), `YouScout` gets `has-gate` CSS class + `onOpenFirstGate` prop, `GateDetailModal` rendered from scene, `ApprovalCard` wired with `token` + `onOpenDetail` |
| `__tests__/cam-184-approve-reject-ui.test.ts` | **NEW** — 25 guard tests (static source analysis) |

### Action functions

`approveGate(id, token)` — `POST /api/status/approve?token=<token>` with `{id}` body.  
`rejectGate(id, reason, token)` — `POST /api/status/reject?token=<token>` with `{id, reason?}` body.  
`fetchGateDetail(id, token)` — `GET /api/status/issue/<id>?token=<token>`.  
Token passed as `?token=encodeURIComponent(token)` matching the existing scene pattern.

### Confirm-morph (ApprovalCard + GateDetailModal)

1. First press → button morphs to "ยืนยัน? ({N} รายการ)" / "ยืนยัน?" — auto-reverts after 3 s.  
2. Second press → submits; shows `Loader` spinner; disabled while in-flight.  
3. Success → "อนุมัติแล้ว" (green text) for 1.5 s, then closes/removes gate.  
4. Error → button reverts to "อนุมัติ", inline error chip appears below action row.

### Suppress-popover

CSS rule `.scout.has-gate .popover{display:none;pointer-events:none}` in `SCENE_CSS`.  
`has-gate` class applied to `.scout.you` JSX when `gates.length > 0` (existing `hasGates` boolean).

### Green-line fix

`.badge`, `.popover`, `.pop-role` borders changed from `var(--line-2)` / `var(--line)` / `rgba(150,240,195,.13)` to neutral dark-glass values (`rgba(255,255,255,.10)` / `.08` / `.10`). Focus ring (`rgba(91,233,176,.8)`) unchanged.

### Tokens used (all scene-scoped, exempt from check:palette)

`rgba(40,26,6,.42)` amber glass base · `#FFB454` heading/key · `rgba(255,190,80,...)` borders/bg · `rgba(91,233,176,...)` focus ring/success state · `rgba(255,255,255,.08-.10)` neutral borders.

---

## 11. Quality gate results

| Check | Result |
|---|---|
| `npm run lint` | Pass (warnings in pre-existing files only; 0 errors in new files) |
| `npm run typecheck` | Pass (0 errors) |
| `npm test` | Pass — 50 test files / 2673 tests |
| `npm run build` | Pass (0 errors, 0 warnings on new routes) |
| Migration | N/A — no DB change |
| Secret leak | None — `LINEAR_API_KEY` server-only; no secret in response/log |
| Rate-limit | Present on both POST routes (20 req/min / IP) |
| Seed/scrape | Not touched |
