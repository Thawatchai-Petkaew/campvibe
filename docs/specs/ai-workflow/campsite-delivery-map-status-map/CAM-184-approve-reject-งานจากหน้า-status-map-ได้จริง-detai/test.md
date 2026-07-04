---
linear: CAM-184
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-150)
persona: platform
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-06-26
---
# Test — Interactive Approve/Reject + Detail Modal + Visual Polish on /status/map (CAM-184)

## AC→test matrix

| AC | Description | test-id | layer | test file | line | pass/fail |
|---|---|---|---|---|---|---|
| AC-1 | Tap gate row → GateDetailModal opens, detail loaded | modal--gate-detail-open | unit | `__tests__/status-approve-endpoints.test.ts` | 308–323 | PASS |
| AC-1 | GET /api/status/issue/[id] 200 with valid id | modal--gate-detail-200 | integ | `__tests__/status-approve-endpoints.test.ts` | 308 | PASS |
| AC-1 | GET /api/status/issue/[id] case-insensitive match | modal--gate-detail-case | integ | `__tests__/status-approve-endpoints.test.ts` | 325 | PASS |
| AC-1 | GET /api/status/issue/[id] 404 when not found | modal--gate-detail-404 | integ | `__tests__/status-approve-endpoints.test.ts` | 331 | PASS |
| AC-1 | GateDetailModal component exported from overlays | modal--gate-detail-export | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 109 | PASS |
| AC-1 | GateDetailModal has role=dialog aria-modal=true | modal--gate-detail-a11y | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 114–122 | PASS |
| AC-1 | GateDetailModal has aria-label รายละเอียดงานรออนุมัติ | modal--gate-detail-aria-label | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 125–127 | PASS |
| AC-1 | fetchGateDetail exported fn calls /api/status/issue | modal--gate-detail-fetch | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 149–151, 253 | PASS |
| AC-2 | POST /approve → removeAwaitingYou called | btn--approve-action | integ | `__tests__/status-approve-endpoints.test.ts` | 164–170 | PASS |
| AC-2 | approve via query param token | btn--approve-token-query | integ | `__tests__/status-approve-endpoints.test.ts` | 164 | PASS |
| AC-2 | approve via x-status-token header | btn--approve-token-header | integ | `__tests__/status-approve-endpoints.test.ts` | 172 | PASS |
| AC-2 | approve returns {ok:true, approved:false} when not found | btn--approve-not-found | integ | `__tests__/status-approve-endpoints.test.ts` | 214 | PASS |
| AC-2 | approveGate exported fn calls /api/status/approve | btn--approve-fn-export | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 241–244 | PASS |
| AC-2 | looksApproved=true when awaiting-you removed, no changes-requested | modal--webhook-approved | integ | `__tests__/status-approve-endpoints.test.ts` | 375–393 | PASS |
| AC-2 | looksApproved=false when changes-requested present | modal--webhook-not-approved | integ | `__tests__/status-approve-endpoints.test.ts` | 395–410 | PASS |
| AC-2 | regression: awaiting-you removed + no CR = approved | modal--webhook-regression | integ | `__tests__/status-approve-endpoints.test.ts` | 457 | PASS |
| AC-3 | POST /reject → addComment + addLabel + removeAwaitingYou in order | btn--reject-order | integ | `__tests__/status-approve-endpoints.test.ts` | 245 | PASS |
| AC-3 | reject uses default Thai reason when empty | btn--reject-default-reason | integ | `__tests__/status-approve-endpoints.test.ts` | 261 | PASS |
| AC-3 | reject caps reason at 2000 chars | btn--reject-reason-cap | integ | `__tests__/status-approve-endpoints.test.ts` | 269 | PASS |
| AC-3 | reject uses default reason for whitespace-only | btn--reject-whitespace | integ | `__tests__/status-approve-endpoints.test.ts` | 276 | PASS |
| AC-3 | rejectGate exported fn calls /api/status/reject | btn--reject-fn-export | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 248–251 | PASS |
| AC-3 | looksRejected=true when changes-requested added | modal--webhook-rejected | integ | `__tests__/status-approve-endpoints.test.ts` | 412 | PASS |
| AC-3 | looksRejected=true does NOT fire proceed-dispatch | modal--webhook-no-dispatch | integ | `__tests__/status-approve-endpoints.test.ts` | 433 | PASS |
| AC-4 | ApprovalCard uses rgba(40,26,6,.42) amber glass | card--approve-amber-bg | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 46 | PASS |
| AC-4 | .hud-appr-badge CSS removed | card--badge-css-removed | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 59 | PASS |
| AC-4 | No hud-appr-badge JSX in ApprovalCard | card--badge-jsx-removed | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 65 | PASS |
| AC-4 | .hud-appr-heading color is #FFB454 | card--heading-color | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 73 | PASS |
| AC-4 | .hud-appr-heading font-weight is 800 | card--heading-weight | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 79 | PASS |
| AC-4 | Gate rows are button elements with aria-label | card--row-button | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 87 | PASS |
| AC-4 | Footer CTA text is "อนุมัติทั้งหมด" | card--cta-text | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 100–103 | PASS |
| AC-4 | GateDetailModal has Approve + ส่งกลับ + reason textarea | modal--gate-actions | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 130–145 | PASS |
| AC-5 | .you-alert font-size is 12px | alert--you-alert-size | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 169 | PASS |
| AC-5 | .you-alert svg icon is 13px | alert--you-alert-icon | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 179 | PASS |
| AC-5 | .you-alert padding is 5px 11px | alert--you-alert-padding | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 184 | PASS |
| AC-5 | .scout.has-gate .popover{display:none} rule present | alert--popover-suppress | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 193 | PASS |
| AC-5 | has-gate class applied when gates present | alert--has-gate-class | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 199 | PASS |
| AC-5 | .popover border uses rgba(255,255,255,.10), not var(--line-2) | alert--popover-border | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 207 | PASS |
| AC-5 | .pop-role border uses rgba(255,255,255,.08), not var(--line) | alert--pop-role-border | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 219 | PASS |
| AC-5 | .badge border uses rgba(255,255,255,.10) | alert--badge-border | unit | `__tests__/cam-184-approve-reject-ui.test.ts` | 229 | PASS |
| AC-6 | 401 on POST /approve without token | btn--approve-401 | integ | `__tests__/status-approve-endpoints.test.ts` | 151 | PASS |
| AC-6 | 401 on POST /approve with wrong token | btn--approve-401-wrong | integ | `__tests__/status-approve-endpoints.test.ts` | 157 | PASS |
| AC-6 | 400 on POST /approve bad id (lowercase) | btn--approve-400-case | integ | `__tests__/status-approve-endpoints.test.ts` | 185 | PASS |
| AC-6 | 400 on POST /approve bad id (no number) | btn--approve-400-fmt | integ | `__tests__/status-approve-endpoints.test.ts` | 190 | PASS |
| AC-6 | 400 on POST /approve empty string id | btn--approve-400-empty | integ | `__tests__/status-approve-endpoints.test.ts` | 195 | PASS |
| AC-6 | 400 on POST /approve missing id field | btn--approve-400-missing | integ | `__tests__/status-approve-endpoints.test.ts` | 199 | PASS |
| AC-6 | 429 on POST /approve when rate-limited | btn--approve-429 | integ | `__tests__/status-approve-endpoints.test.ts` | 206 | PASS |
| AC-6 | 401 on POST /reject without token | btn--reject-401 | integ | `__tests__/status-approve-endpoints.test.ts` | 225 | PASS |
| AC-6 | 401 on POST /reject with wrong header token | btn--reject-401-header | integ | `__tests__/status-approve-endpoints.test.ts` | 231 | PASS |
| AC-6 | 400 on POST /reject bad id | btn--reject-400 | integ | `__tests__/status-approve-endpoints.test.ts` | 238 | PASS |
| AC-6 | 429 on POST /reject when rate-limited | btn--reject-429 | integ | `__tests__/status-approve-endpoints.test.ts` | 281 | PASS |
| AC-6 | 401 on GET /issue/[id] without token | modal--issue-401 | integ | `__tests__/status-approve-endpoints.test.ts` | 296 | PASS |
| AC-6 | 400 on GET /issue/[id] bad id | modal--issue-400 | integ | `__tests__/status-approve-endpoints.test.ts` | 302 | PASS |
| AC-6 | open route 200 in dev/test (no token set) | btn--approve-open | integ | `__tests__/status-approve-endpoints.test.ts` | 179 | PASS |

## Validation cases

**Normal (happy path):**
- POST /approve with valid token + valid id → 200 `{ok:true, approved:true}` + `removeAwaitingYou` called with correct id
- POST /reject with reason → 200 `{ok:true}` + addComment + addLabel("changes-requested") + removeAwaitingYou in that order
- GET /issue/[id] → 200 with all fields (id, title, status, statusType, role extracted from `[role]` prefix, description, url, assignee, project, labels)
- Webhook: awaiting-you removed, no changes-requested → `approved:true, rejected:false`, Telegram "Approved" sent
- Webhook: changes-requested added → `rejected:true`, Telegram "Sent back for changes" sent, no dispatch

**Null/empty:**
- POST /reject with no reason → default Thai string `ส่งกลับให้แก้ไขจาก /status/map` used verbatim
- POST /reject with whitespace-only reason → same default Thai string
- GET /issue/[id] with issue having no [role] prefix → `role` field absent in response (not null)

**Boundary:**
- POST /reject reason capped at exactly 2000 chars (3000 char input → 2000 chars passed to addComment)
- GET /issue/[id] with lowercase identifier (cam-9) → case-insensitive match returns CAM-9 data

**Error/validation:**
- All 3 routes: id not matching `^[A-Z]+-\d+$` → 400 (lowercase, no-suffix, empty, missing field tested)
- All 3 routes: STATUS_TOKEN set but token absent or wrong → 401 before any side-effect
- Both POST routes: rate-limit exceeded → 429 + `Retry-After` header, no side-effect called
- GET /issue/[id]: id valid but not in fetchStatusIssues result → 404 `{error:"not_found"}`

**Concurrent/ordering:**
- POST /reject: addComment → addLabel → removeAwaitingYou order verified via call-order array (load-bearing per spec)

**Webhook security (changes-requested guard):**
- looksApproved guard: `!hasChangesRequested` prevents approve-notification when reject label is present
- looksRejected path: dispatch NOT fired when rejected (no `dispatched` field in response)

## Coverage

New code coverage (measured, `npx vitest run --coverage`):

| File | Stmt% | Branch% | Fn% | Lines% | Uncovered |
|---|---|---|---|---|---|
| `app/api/status/approve/route.ts` | 88.88 | 93.75 | 100 | 88.46 | L55 (invalid_json), L68-69 (500 catch) |
| `app/api/status/reject/route.ts` | 90.62 | 95 | 100 | 90.32 | L61 (invalid_json), L88-89 (500 catch) |
| `app/api/status/issue/[id]/route.ts` | 92 | 100 | 100 | 91.3 | L70-71 (500 catch) |

Uncovered lines are exclusively the `catch` → 500 error handler branches and the `invalid_json` parse-fail branch. These require forcing the mocked module to throw, which adds test complexity without guarding a real regression risk; the 400/401/429/404 error paths are fully covered. All three new routes exceed the 80% threshold.

`lib/linear-actions.ts` (addLabel): coverage shows 0% because the module is entirely mocked via `vi.mock("@/lib/linear-actions")` — this is correct. The boundary is the Linear GraphQL API (external network). The addLabel behavior is verified via the reject route's call-order test which asserts `addLabelFn.toHaveBeenCalledWith("CAM-9", "changes-requested")`.

UI tests (`__tests__/cam-184-approve-reject-ui.test.ts`): static source analysis — coverage not measured (no runtime execution; files are read with `fs.readFileSync`). All 25 UI guard tests pass.

**Full suite: 51 test files / 2704 tests — 0 failures.**

## Security PASS (6-area audit on new mutating routes)

| Area | Finding |
|---|---|
| Input | `id` validated via `/^[A-Z]+-\d+$/` before any side-effect on all 3 routes. `reason` stripped + capped at 2000 chars, never exec'd. |
| Auth/authz | `authorized()` checks `STATUS_TOKEN` via query param OR header on every new route. 401 fires before rate-limit or side-effect. |
| Data | `LINEAR_API_KEY` used only in `lib/linear-actions.ts` (server-only). No secret, stack trace, or internal path in any response body. |
| Infra | Rate-limit (20 req/min/IP) on both POST routes with `Retry-After` header on 429. Read-only GET has no rate-limit per spec. |
| 3rd-party | No new npm dependencies added. Linear API called server-side only via `lib/linear-actions.ts`. |
| AI/LLM | `reason` is plain text written to a Linear comment only — never placed into a prompt, never exec'd. |

STRIDE scope: no new attack surface beyond rate-limited, token-gated endpoints. No IDOR (no resource ownership beyond single STATUS_TOKEN gate). No mass-assignment (explicit field extraction from body, not spread).

## Regression / scope

Files changed vs `staging` branch (code only):

| File | Status | Note |
|---|---|---|
| `app/api/status/approve/route.ts` | NEW | POST approve endpoint |
| `app/api/status/reject/route.ts` | NEW | POST reject endpoint |
| `app/api/status/issue/[id]/route.ts` | NEW | GET detail endpoint |
| `lib/linear-actions.ts` | MODIFIED | Added `addLabel()` helper (+33 lines) |
| `app/api/linear-webhook/route.ts` | MODIFIED | Extended looksApproved + added looksRejected (+55 lines) |
| `app/status/map/campsite-overlays.tsx` | MODIFIED | ApprovalCard amber + GateDetailModal + action fns (+534 lines) |
| `app/status/map/campsite-scene.tsx` | MODIFIED | .you-alert resize + suppress-popover + neutral borders (+65 lines) |
| `__tests__/status-approve-endpoints.test.ts` | NEW | 31 contract tests |
| `__tests__/cam-184-approve-reject-ui.test.ts` | NEW | 25 UI guard tests |
| `__tests__/cam-182-quest-approval-ui.test.ts` | MODIFIED | 4 tests updated to reflect CAM-184 design changes (font-size 13px→12px, padding 7px 14px→5px 11px, badge removal) |
| `.claude/agents/orchestrator.md` | MODIFIED | Gate continuation docs |

**Engine, data model, fireflies, gift card, board-derive — UNCHANGED.** No Prisma migration. No new dependencies.

**Pre-existing working-tree changes (NOT part of CAM-184 commit set):**
- `app/layout.tsx` — OG/Twitter meta tag addition (unrelated)
- `public/mockup/*` — deleted campground images (unrelated)

**New lint warning added by CAM-184:** 1 new warning in `campsite-overlays.tsx` line 2023 — `setState` called synchronously inside `useEffect` body (ESLint `react-hooks/exhaustive-deps` related rule). Pattern is the GateDetailModal reset block (`setFetchState("loading")` on open). This is a Suggestion-severity item; the pattern is the standard React idiom for resetting modal state on open and does not cause a production defect. Pre-existing warning count was 248; post CAM-184: 249. Routing as Suggestion to frontend for cleanup.

## Links

`story.md` (CAM-184 AC) · `tech.md` (CAM-184 endpoint contract) · `design.md` (CAM-184 UI spec) · `.claude/rules/qa.md` · `__tests__/status-approve-endpoints.test.ts` · `__tests__/cam-184-approve-reject-ui.test.ts`

## Changelog

- v1 (2026-06-26) — created; all 6 ACs mapped; 2704/2704 tests pass; coverage ≥88% on all 3 new routes; security PASS; regression scope confirmed.
