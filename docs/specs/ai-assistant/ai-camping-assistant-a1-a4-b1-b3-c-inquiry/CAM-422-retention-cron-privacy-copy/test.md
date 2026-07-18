---
linear: CAM-422
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-07-19
---
# Test — Retention cron + privacy copy (ADR-013 S8) (CAM-422)

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (idle ≥180d purged, single deleteMany) | H | unit (mocked Prisma — no test-DB infra in this repo; see Verification notes) | `__tests__/cam-422-conversation-store-purge.test.ts` | ✅ |
| AC-2 (soft-deleted-user sweep, same OR/same sweep) | H | unit | `__tests__/cam-422-conversation-store-purge.test.ts` | ✅ |
| AC-3 (401 no/wrong secret; 200 correct secret) | H | unit (`isCronRequestAuthorized`) + integ (route) | `__tests__/cam-422-cron-auth.test.ts`, `__tests__/cam-422-cron-retention-route.test.ts` | ✅ |
| AC-4 (`aiChat.retentionNotice` TH/EN verbatim, 180-day figure) | M | unit | `__tests__/cam-422-retention-copy.test.ts` + `__tests__/cam-272-ai-chat-i18n.test.ts` (structural EN/TH parity + no-em-dash, iterates every `aiChat.*` key incl. `retentionNotice`) | ✅ |

## Validation cases (BR-n)
- BR-1 (single `deleteMany`, exact `OR` shape) — pinned via `toHaveBeenCalledWith` (exact where-object match) + `toHaveBeenCalledTimes(1)`. ✅
- BR-2 (injected clock, strict `lt` not `lte`, boundary to the millisecond) — `EC-purge-3` asserts `FIXED_NOW_MS - cutoffMs === 180*24h` exactly; default-clock test bounds cutoff between two `Date.now()` snapshots (no wall-clock flakiness). ✅
- BR-3 (typed result, never throws raw) — `BR-6` test: DB rejection → `{ok:false, code:'internal_error'}`. ✅
- BR-4 (count-only structured log line) — asserts `Object.keys(logged)` is EXACTLY `['cutoffDate','event','level','purgedCount']` — no conversationId/content/userId. ✅
- BR-5 (secret guard: default-deny, missing header, wrong secret, wrong scheme, wrong length, correct secret, constant-time path) — 6 cases in `cam-422-cron-auth.test.ts` + repeated at the route layer (401/401/200) + `EC-guard-1` (unset secret with header present → still 401). ✅
- BR-6 (system job, no session) — route reads no NextAuth session (confirmed by reading; no test needed — absence of a call, not a behavior to assert). N/A, verified by code inspection.
- BR-7 (EN/TH parity, no em-dash) — covered by the existing `cam-272-ai-chat-i18n.test.ts` structural iteration (confirmed it walks `Object.entries(th)`, so `retentionNotice` is included automatically). ✅

## Coverage
Measured via `npx vitest run --coverage` against the CAM-422 diff's 3 files (combined with the pre-existing CAM-414/421 suites over the shared `conversation-store.ts`, since coverage is measured per FILE not per commit-diff-only):
- `lib/ai/conversation-store.ts`: **100%** stmts/branch/func/line (98/98, 48/48, 18/18, 93/93) — combined `cam-414` + `cam-421` + `cam-422` suites.
- `lib/cron-auth.ts` + `app/api/cron/ai-chat-retention/route.ts`: **100%** stmts/branch/func/line (18/18, 10/10, 3/3, 15/15).
- Well above the ≥80% gate on new code.

## Verification notes (7-point dispatch)
1. **180-day boundary via injected clock** — no real test-DB exists anywhere in this repo (grepped; every `conversation-store` test mocks `@/lib/prisma`), so "kept vs purged" is proven at the correct testable seam: the exact `Date` object + `lt` (not `lte`) operator passed into Prisma's `where`, pinned to the millisecond (`EC-purge-3`) and via a full `toHaveBeenCalledWith` structural match (`AC-purge-1/2`). Trusting Postgres's own `lt` comparison beyond that is out of this repo's test architecture (consistent with `cam-414`/`cam-421` precedent).
2. **Soft-deleted-user sweep** — proven via the same structural pin: the `OR` array's second branch (`{ user: { deletedAt: { not: null } } }`) is asserted verbatim; a code change that dropped it, ANDed it, or duplicated the query was caught by mutation-testing (below).
3. **Active/recent conversations never purged** — proven by construction: the `toHaveBeenCalledWith` assertion pins the *entire* `where` object, so no additional/broader condition can silently sweep in an active conversation without failing the test.
4. **Secret guard** — unset secret (default-deny), missing header, wrong secret (same length), wrong secret (different length — the `timingSafeEqual` constant-time path), missing `Bearer` scheme, and the correct secret: all 6 asserted in `cam-422-cron-auth.test.ts`; 401/401/200/401(unset-with-header) repeated at the route integration layer.
5. **Count-only structured log** — `Object.keys(logged)` asserted to equal exactly `['cutoffDate','event','level','purgedCount']` — any added field (conversationId, userId, content) fails the test.
6. **Privacy copy** — TH/EN asserted verbatim char-for-char; both contain "180"; no em-dash (structural check across all `aiChat.*` keys, `retentionNotice` included); no jargon present in either string (read, confirmed manually).
7. **Single deleteMany (no N+1)** — `toHaveBeenCalledTimes(1)` asserted directly.

## Prove-It (red-then-green, mutation testing)
Since the story landed pre-written (not authored test-first by this QA pass), verification replayed Prove-It via targeted mutation of the already-committed logic, confirming each guard actually fails before being reverted (working tree restored to clean, `git diff` empty after each):
| Mutation | Test(s) that went red | Result |
|---|---|---|
| `lt` → `lte` (off-by-one at the boundary) | `EC-purge-3`, default-clock test | 3/6 failed → reverted |
| Drop the soft-deleted-user `OR` branch (idle-only where) | `AC-purge-1/2`, `EC-purge-3`, default-clock test | 3/6 failed → reverted |
| Split into two `deleteMany` calls (N+1-style) | `toHaveBeenCalledTimes(1)`, log-hygiene (count doubled) | 4/6 failed → reverted |
| `isCronRequestAuthorized` falls open when `CRON_SECRET` unset | unset-secret unit test, `EC-guard-1` route test | 2 failed → reverted |
| Log line gains an extra `debugWhere` field | log-hygiene test | 1/6 failed → reverted |
| `retentionNotice` TH copy drifts 180→90 days | copy-verbatim test, 180-figure test | 2/3 failed → reverted |

All 6 mutations caught red; all reverted cleanly (`git status`/`git diff` clean after each, confirmed).

## Full suite
`npm test` → 7071/7072 pass. The 1 failure is the known pre-existing, env-dependent `__tests__/delivery-client.test.ts` case (unrelated to this story, per dispatch note — not chased).

## Links
`story.md` (AC/BR/EC) · `.claude/rules/qa.md` · ADR-013 (`docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md`)

## Changelog
- v1 (2026-07-19) — QA verify pass: 7/7 dispatch points confirmed green, 6 mutation-tests proved red-then-green, no defects found, coverage 100% on the 3 touched files.
