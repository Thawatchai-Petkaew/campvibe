---
linear: CAM-418
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# Test — Booking tools adversarial verify (CAM-418)

> Scope of this pass: independent adversarial QA re-verify of the already-shipped
> unit suite (`__tests__/cam-418-my-bookings-tools.test.ts`). Adds
> `__tests__/cam-418-adversarial-verify.test.ts` closing gaps in HOW cross-user
> isolation and ownership scoping were proven — see that file's header comment
> for the full gap list. No production code was changed by QA (qa.md §5).

## AC→test matrix

| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 (getMyBookings scoped, capped, never cross-user) | H | unit (shipped) + integ-style (adversarial, real 2-user faithful-fake-DB, dispatched by name) | `cam-418-my-bookings-tools.test.ts` + `cam-418-adversarial-verify.test.ts` (a)/(f) | ✅ pass |
| AC-2 (getMyBookingDetail owned → full detail) | H | unit (shipped, getOwnedBooking mocked) + integ-style (adversarial, getOwnedBooking UNMOCKED, real where-clause exercised) | `cam-418-my-bookings-tools.test.ts` + `cam-418-adversarial-verify.test.ts` (b) | ✅ pass |
| AC-3 (not_found identical for wrong-owner / nonexistent, no leak) | H | unit (shipped) + integ-style (adversarial, real cross-user id + real nonexistent id) | `cam-418-my-bookings-tools.test.ts` + `cam-418-adversarial-verify.test.ts` (b) | ✅ pass |
| AC-4 (no userId in either tool's zod/jsonSchema surface) | H | unit (shipped, whole-registry test in `cam-417-tool-registry-tiers.test.ts` + this file's own reconfirm) | `cam-418-my-bookings-tools.test.ts` + `cam-418-adversarial-verify.test.ts` (g) | ✅ pass |
| BR-4/EC-4 (ctx.userId absent → refused, never an unscoped query) | H | unit (shipped, tool's own internal guard, execute() called directly) + integ-style (adversarial, the REGISTRY tier gate via dispatchTool, execute() spied never-invoked) | `cam-418-my-bookings-tools.test.ts` + `cam-418-adversarial-verify.test.ts` (d) | ✅ pass |
| EC-2 (malformed bookingId rejected at zod boundary) | M | unit (shipped, schema.safeParse in isolation) + integ-style (adversarial, through the real dispatchTool registry zod gate) | `cam-418-my-bookings-tools.test.ts` + `cam-418-adversarial-verify.test.ts` (c) | ✅ pass |
| BR-5 (Decimal → plain number, no residue reaches the model-facing JSON) | M | unit (shipped, single-field assertion) + unit (adversarial, full `dispatchTool` result JSON.stringify/parse round-trip, the exact serialization openrouter-client.ts performs) | `cam-418-my-bookings-tools.test.ts` + `cam-418-adversarial-verify.test.ts` (e) | ✅ pass |
| EC-1 (zero bookings → `{bookings:[]}`, not an error) | M | unit (shipped) + integ-style (adversarial, a real fixture userId with zero rows in the 2-user DB, through dispatchTool) | `cam-418-my-bookings-tools.test.ts` + `cam-418-adversarial-verify.test.ts` (f) | ✅ pass |

## Prove-It (ownership scope) — real, observed, not claimed

Two production files were **temporarily** edited (never committed; `git diff --stat` confirmed clean after each revert) to prove the new adversarial test's teeth against the exact regression class it exists to catch:

1. `lib/bookings.ts` `getOwnedBooking`'s `where: { id, userId }` → `where: { id }` (userId dropped).
   **RED**: exactly 1 test failed — `(b) … "userA requesting booking B … -> not_found"` — userA's ctx received userB's real booking-B detail instead of `not_found`.
   Reverted → all-GREEN (13/13).
2. `lib/ai/tools/my-bookings.ts` `getMyBookings`'s `where: { userId: ctx.userId }` → `where: {}`.
   **RED**: exactly 4 tests failed — both `(a)` cross-user cases (userA and userB each received BOTH users' bookings), `(f)`'s EC-1 empty-fixture case, and `(e)`'s getMyBookings Decimal round-trip case (wrong row's amount surfaced).
   Reverted → all-GREEN (13/13).

## Coverage (real run, `npx vitest run --coverage --coverage.reporter=json-summary`)

- `lib/bookings.ts`: **100%** lines/statements/functions/branches (2/2, 1/1, 2/2, 2/2).
- `lib/ai/tools/my-bookings.ts`: **100%** lines/statements/functions/branches (18/18, 21/21, 5/5, 6/6).
- Both well above the ≥80% new-code gate.

## Full suite (last act)

`npx vitest run` (whole repo): **7128/7129 pass** (205 files, 204 pass / 1 fail). The 1 failure is the known pre-existing env-dependent `__tests__/delivery-client.test.ts` (unrelated to this story — noted per the dispatch contract, not chased).

`npm run lint`: 0 errors on the new file. `npm run typecheck`: clean.

## Defects found

None. Both `getMyBookings` and `getMyBookingDetail` implement cross-user isolation and the not-found/no-existence-leak convention correctly; Prove-It confirms the guard tests have real teeth.

## Links

`story.md` (AC/BR) · `.claude/rules/qa.md` · `__tests__/cam-418-adversarial-verify.test.ts` · `__tests__/cam-418-my-bookings-tools.test.ts`

## Changelog

- v1 (2026-07-19) — adversarial verify pass; no defects; test.md authored.
