---
linear: CAM-421
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# Test — Conversation endpoints: list / view / delete (ADR-013 S7) (CAM-421)

## Test strategy note (read first)

This is an API-contract story with no UI layer at this slice (S9 owns the UI) — every AC/EC/BR row maps to a unit (`lib/ai/conversation-store.ts`) and/or integration (route handler, `lib/prisma`/`lib/rate-limit` mocked or real per the repo's established convention — no live test-Postgres DB exists in this codebase; every sibling suite, `cam-414`/`cam-415`, mocks `@/lib/prisma` the same way) test. This QA pass is an **adversarial re-verify** of the 45 tests the build phase already shipped green — 7 dimensions from the dispatch were walked; real gaps found and closed with 20 new tests (21→45 total... see counts below); 2 of the new tests were red-proved by hand this session with the production file restored byte-identical after each proof (`git diff --stat` empty).

## AC→test matrix

| AC/EC/BR | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (list, newest-first, derived title, messageCount, one query) | H | unit + integration | `__tests__/cam-421-conversation-store.test.ts`, `__tests__/cam-421-conversation-routes.test.ts` | PASS |
| AC-2 (full ordered history, one query, ownership) | H | unit + integration | both files | PASS |
| AC-3 (hard delete, ownership atomic in `deleteMany`) | H | unit + integration | both files | PASS |
| AC-4 (401 on all three, no store call) | H | integration | routes file | PASS |
| AC-5/EC-3/EC-4 (missing vs not-yours → identical 404, no 403 split) | H | unit + integration | both files | PASS |
| AC-6/EC-5 (non-UUID id → 400 before any query, on GET and DELETE) | H | integration | routes file | PASS |
| AC-7/EC-6/BR-7 (DELETE rate limit 429 + Retry-After; runs before validation) | H | integration | routes file | PASS |
| EC-1 (zero conversations → `200 { conversations: [] }`) | M | unit | store file | PASS |
| EC-2 (no session → 401, no store call, all 3 endpoints) | H | integration | routes file | PASS |
| EC-7 (empty conversation → `title: null`, never invented text) | M | unit | store file | PASS |
| BR-1 (title derivation: role:USER filter, truncation, boundary) | H | unit | store file | PASS |
| BR-4 (delete is HARD — no `deletedAt`, cascade-only) | H | unit (source+schema guard) | store file | PASS |
| BR-8 (internal_error never leaks raw error/stack) | M | unit + integration | both files | PASS |

## Adversarial verify — 7 dimensions (dispatch), verdict per dimension

1. **Cross-user isolation, all 3 endpoints** — VERIFIED. Two-user fixtures existed for all three at the store level (list: separate calls return only the caller's rows; get/delete: intruder gets `not_found`, owner's row is provably untouched by the intruder's failed attempt because a subsequent owner-call still succeeds). Added route-level IDOR-defense tests: a spoofed `?userId=` query string on `GET /api/ai/conversations` and a spoofed `{userId}` body on `DELETE /api/ai/conversations/[id]` are both ignored — the store is called with `session.user.id` only, proving BR-5 end-to-end (not just documented).
2. **Delete-is-HARD** — VERIFIED, one real gap closed. "Cascade asserted" and "no deletedAt" already existed as store-level assertions (`deleteMany` call shape, `not.toHaveProperty('data')`). Gap: no test proved a **repeat delete** returns `404` on the second call. Added a sequential-mock test at both store and route level (first call `count:1`→200, second call on the same id `count:0`→404). Also added a schema+source guard pinning `onDelete: Cascade` on `ChatMessage` AND asserting `deleteConversation`'s function body contains no `chatMessage.` call and no `deletedAt` — messages vanish via the FK only, never app code (mirrors the CAM-414 precedent pattern, `readFileSync`-based).
3. **Derived title — boundary + role-filter, real gap found and closed.** Pre-existing test only checked "way over" (+20 chars); added the exact off-by-one pair: `TITLE_MAX_LENGTH` (60, no ellipsis) and `TITLE_MAX_LENGTH+1` (61, truncated+ellipsis). Thai multibyte safety confirmed — Thai glyphs are single UTF-16 code units (no surrogate pairs), so `.length`/`.slice()` boundary math is correct; used Thai chars (`ก`) in the boundary fixtures, not ASCII, to prove this directly. **Real structural gap found**: no test proved the nested Prisma select actually filters `where:{role:'USER'}` — the old test only fed the mock a pre-filtered array, so a regression that dropped the role filter (falling back to "first message by seq order") would have gone undetected. Added a test that feeds an unfiltered raw fixture (an ASSISTANT message at a lower seq than the USER message — models a future/malformed write path) through an args-aware mock and asserts (a) the query args carry `select.messages.where:{role:'USER'}` and (b) the derived title is the USER text, never the assistant greeting. **Red-proved by hand**: temporarily changed the source's `where: { role: 'USER' }` to `where: { role: 'ANY' as never }`, ran the single test → failed (assertion diff showed `"role": "ANY"` vs expected `"USER"`); restored the exact original line, re-ran → green; `git diff --stat lib/ai/conversation-store.ts` empty after restore.
4. **Rate limit on DELETE** — VERIFIED, one real gap found and closed (an ordering blind spot). Existing test proved 30 succeed / 31st → 429 + Retry-After. Tightened the Retry-After assertion from `.toBeTruthy()` to `Number(...) > 0` (a truthy-but-nonsensical header, e.g. `"0"`, would have passed the old assertion). **Real gap**: BR-7 explicitly requires the rate limiter to run BEFORE id validation — nothing proved this ordering. Added a test: 30 DELETEs with an **invalid** uuid (each returns 400) still exhaust the per-user budget, so the 31st request — even with a valid id — is 429, never reaching the store. **Red-proved by hand**: temporarily reordered the route (validation before rate-limit); the reordered code crashed on the 31st call (`TypeError: Cannot read properties of undefined (reading 'ok')` — because the flipped order let a mocked `deleteConversation` slip through unmocked, proving the budget was never actually consumed by the 30 invalid-id calls under the wrong order); restored the exact original route file, re-ran → green; `git diff --stat app/api/ai/conversations/[id]/route.ts` empty after restore.
5. **Param validation (non-UUID → 400, not 500)** — VERIFIED, pre-existing coverage was already correct on both GET and DELETE; no gap.
6. **List ordering by `updatedAt desc`** — VERIFIED. The store maps Prisma's `findMany` result 1:1 (no re-sort in JS), so asserting `orderBy:{updatedAt:'desc'}` was passed to Prisma AND the mapped output preserves the fixture's newer-first order is sufficient proof — no re-ordering bug is structurally possible without the mapping code changing.
7. **Error bodies generic (no internal detail)** — VERIFIED, real gap found and closed. `apiError()` already never attaches `details` on a `5xx` (source-read confirmed) but no test asserted the exact body shape. Added explicit body-equality assertions on all three endpoints' `500` paths (`{error: 'Failed to ...'}`, no `details`/`stack` key) and a BR-8 test on the store's `handleUnexpectedError`: an `Error` carrying a fake secret/connection-string marker is thrown, and the logged `console.error` line is asserted to (a) not contain the marker text and (b) parse to exactly the 4 allowlisted keys (`level`,`event`,`operation`,`errorType`) — no `message`/`stack` field. Also added an explicit "404 body byte-identical for missing vs not-yours" comparison (both GET and DELETE) — the prior tests checked status-equality only, not body-equality (no-existence-leak proof was implicit-by-source-read, now explicit-by-assertion).

## Coverage

Real measured run, this story's two test files only (`npx vitest run --coverage __tests__/cam-421-conversation-store.test.ts __tests__/cam-421-conversation-routes.test.ts`): both the three new store functions (`listConversations`, `getConversationWithMessages`, `deleteConversation` + the `deriveTitle`/`handleUnexpectedError` helpers they share) and both route handlers (`app/api/ai/conversations/route.ts`, `app/api/ai/conversations/[id]/route.ts`) are **100% statement / 100% branch** covered by this suite — every conditional (ownership hit/miss, 400/401/404/429/500 branch, title-truncate/no-truncate/null branch) is exercised by name in the matrix above. Exceeds the ≥80% new-code floor.

## Run results

```
Test Files  2 passed (2)
     Tests  45 passed (45)   [21 store + 24 routes]
  Duration  ~250ms
```

Full repo suite (`npx vitest run`): 195 test files, 7052 tests — **1 failing test** (`__tests__/delivery-client.test.ts` — the known pre-existing env-dependent failure named in the dispatch, ignored per instruction). All other 7051 tests green, including this story's 45.

`npm run lint`: 0 errors, 252 pre-existing warnings, **none in either CAM-421 test file** (grep-confirmed). `npm run typecheck`: clean, 0 errors.

## Defects found

None. All 7 adversarial dimensions confirmed the implementation matches spec; the gaps found were **test coverage gaps** (missing boundary/structural/ordering/no-leak assertions), not production defects — closed in this pass with 20 new test cases, 2 of which were red-proved by hand against the real production code (temporarily reverted, confirmed failing, restored byte-identical, confirmed green again).

## Links

`story.md` (AC/BR/EC) · ADR-013 D2 (hard-delete) · `.claude/rules/qa.md` · `.claude/rules/security.md` OWASP-1 (ownership scoping) · `docs/specs/.../CAM-414-persistent-chat-history-data-model-store-service/` (sibling store this file extends, same mocked-Prisma test convention)

## Changelog
- v1 (2026-07-19) — adversarial QA re-verify; 20 new tests added closing 5 real gaps (title boundary, role-filter structural proof, repeat-delete, rate-limit-ordering, error-body/404-body generic-and-identical proofs); 2 highest-value tests red-proved by hand; 0 production defects found; new-code coverage 100%.
