---
linear: CAM-414
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-19
---
# Test — Persistent chat history: data model + store service (CAM-414)

## Test strategy note (read first)

This is an independent QA verify against an already-built store service (no UI/route this story — merge is held pending an owner architecture discussion; this verdict feeds that G3). The build-phase suite (`__tests__/cam-414-conversation-store.test.ts`, 22 tests) already covered every AC/EC row at least once with mocked-Prisma unit tests (the repo's established convention — no real-DB integration harness exists in this codebase; every Prisma-touching test in the repo mocks `@/lib/prisma`). This pass adds 8 adversarial tests the dispatch specifically asked for, closing gaps the original suite asserted only indirectly: transaction shape (tx vs. the outer client), a real mid-tx rollback path, the P2002 backstop exercised at the exact colliding statement, cap/length boundary edges, warn-log field hygiene, the `loadWindow` default-parameter branch, and a schema/migration regression guard. Final count: 30 tests, 100% coverage (stmt/branch/func/line) on `lib/ai/conversation-store.ts`.

## AC→test matrix

| AC/EC/BR | risk | type | test file | status |
|---|---|---|---|---|
| AC-1 (create under cap, no eviction) | M | unit | `createConversation` describe, "AC-1: creates a new conversation when under the cap" | PASS |
| AC-2/EC-1 (at cap: evict least-recently-updated + create, ONE tx) | H | unit | "AC-2/EC-1: at the cap, evicts..." + new "(a) transaction shape" + "(c) migration & schema guard" (eviction orderBy source-guard) | PASS |
| AC-3 (append writes exactly 2 rows, seq N+1/N+2, updatedAt bump, ONE tx) | H | unit | `appendTurn` describe, "AC-3" x2 (with/without prior messages) + new "(a) transaction shape" | PASS |
| AC-4/EC-3 (at 200-cap: typed `conversation_full`, zero writes) | H | unit | "AC-4/EC-3" + new "(d) boundary" (199 succeeds) | PASS |
| AC-5/EC-7 (contentText >4000 truncated, turn still commits) | M | unit | "AC-5/EC-7" + new "(e) boundary" (exactly 4000 unmodified — off-by-one guard) | PASS |
| AC-6/EC-4 (missing/other-user conversationId -> `not_found`, zero writes) | H | unit | "AC-6/EC-4" | PASS |
| AC-7 (loadWindow: newest-N in ascending/chronological order) | H | unit | "AC-7" + new "loadWindow default parameter" (DEFAULT_WINDOW_SIZE branch) | PASS |
| AC-8/EC-4 (loadWindow ownership -> `not_found`, no message query) | H | unit | "AC-8/EC-4" | PASS |
| EC-2 (seq unique-constraint race -> `concurrent_write`, no throw) | H | unit | original "EC-2" ($transaction-level reject) + new "(b) P2002 backstop" (statement-level: `tx.chatMessage.create` itself throws P2002) | PASS |
| EC-5 (<10 messages -> all of them, ascending) | M | unit | "EC-5" | PASS |
| EC-6 (blocks >16KB -> null + warn, turn still commits) | H | unit | "EC-6" + new "(e) ... log hygiene" (warn payload allowlisted fields only, no content leak) | PASS |
| BR-1 (evict by updatedAt, not createdAt) | H | unit (source-inspection guard) | new "(c)/(g) migration & schema guard", "the eviction query orders by updatedAt... never createdAt" | PASS |
| BR-2 (ownership `where:{id,userId}` on every mutation/read, no existence leak) | H | unit | AC-6/AC-8 tests assert the exact `where` shape | PASS |
| BR-4 (FK cascade: ChatMessage rows die with their ChatConversation) | H | unit (schema-inspection guard, Prove-It'd red) | new "(c)/(g) migration & schema guard", "ChatMessage cascades away..." | PASS |
| BR-6 (any unexpected error -> `internal_error`, never a raw throw) | H | unit | 3x "BR-6" (createConversation/appendTurn/loadWindow) + new "branch coverage" (non-Error thrown value) + new "(a) rollback path" (mid-tx generic throw) | PASS |
| (g) migration additive-only | M | unit (source-inspection guard) | new "(c)/(g) migration & schema guard", "the migration is additive only" | PASS |

## The 7 requested verdicts (dispatch scope)

1. **(a) Atomic append — failed turn = ZERO further rows.** Verified two ways: (i) a **transaction-shape** test uses a separate `mockTx` object (distinct from the outer `prisma` mock) and asserts every statement in `createConversation`/`appendTurn` runs on `tx`, never on the outer non-transactional accessor — proving no statement can silently escape the transaction (a real risk this repo's usual `mockTransactionPassthrough` helper can't catch, since it aliases `tx === prisma`). (ii) a **rollback-path** test makes the assistant-message `create` throw mid-callback (after the user-message create already "succeeded" inside the tx) and asserts `internal_error` is returned AND `chatConversation.update` (the `updatedAt` bump) is **never called** — the callback aborts on first throw, which is exactly the condition Prisma's real interactive transaction needs to roll back everything already issued. Same rollback shape proven for `createConversation`'s eviction-delete failing mid-tx (create never attempted). **Verdict: PASS** — real teeth confirmed via Prove-It (see below).

2. **(b) Seq monotonic under simulated concurrent append — P2002 backstop actually exercised.** The original suite only made the outer `$transaction` promise reject with P2002 wholesale. Added a test where `tx.chatMessage.create` **itself** throws the `PrismaClientKnownRequestError(P2002)` — simulating two racing calls that both read the same stale `last.seq` and one loses the unique-index race on insert — asserting `concurrent_write` and that only 1 create was attempted (the losing insert), never a 2nd. **Verdict: PASS.**

3. **(c) Evict-oldest at 20 — by updatedAt not createdAt, cascade verified.** The existing test already asserts the exact `orderBy: { updatedAt: 'asc' }` shape (an exact-match assertion, so a flip to `createdAt` would already fail it). Added a source-inspection regression guard (`orderBy: { updatedAt: 'asc' }` present, `orderBy: { createdAt: 'asc' }` absent) as an explicit second line of defense. Cascade: no real-DB integration harness exists in this repo (confirmed — every Prisma test mocks the client), so cascade is verified at the **schema** level: a new guard test reads `prisma/schema.prisma` and asserts the `ChatMessage.conversation` relation carries `onDelete: Cascade` — Prove-It'd red by temporarily stripping that clause (see below) and the migration's raw SQL independently confirmed to carry `ON DELETE CASCADE` on both new FKs. **Verdict: PASS.**

4. **(d) 200-message cap rejects with the typed code, not a throw.** Already covered (`AC-4/EC-3`, exact `toEqual` on the discriminated-union result, zero `create`/`update` calls). Added the boundary twin — 199 messages (one under cap) still commits — closing the off-by-one edge the original suite didn't test. **Verdict: PASS.**

5. **(e) contentText 4000 cap + blocks >16KB stored-without-blocks + warn log carries no content.** contentText: added the exact-4000 boundary test (unmodified, not off-by-one shortened) alongside the existing over-4000-truncates test. Blocks/log: the existing EC-6 test only checked the warn call's substring; added an explicit **field-hygiene** assertion — `JSON.parse`'d the actual logged line and asserted `Object.keys` equals exactly `['byteLength','conversationId','event','level','maxBytes']` (no `content`/`blocks` key) AND the logged string does **not contain** the literal Thai secret marker used in the oversized fixture. **Verdict: PASS.**

6. **(f) loadWindow: ownership + exactly newest-10 in chronological order.** Ownership (`AC-8/EC-4`) and newest-N-ascending (`AC-7`, `EC-5`) were already covered with custom limits (3, 10). Added a test for the untested **default-parameter branch** (`loadWindow(id, userId)` with no 3rd arg) asserting `findMany` is called with `take: DEFAULT_WINDOW_SIZE` (10) — the one branch of `limit: number = DEFAULT_WINDOW_SIZE` the original suite never exercised. **Verdict: PASS.**

7. **(g) Migration SQL review — additive only, no existing-table ALTER beyond the User relation side.** Manually reviewed `prisma/migrations/20260718173946_cam414_chat_persistence/migration.sql`: 1 `CREATE TYPE`, 2 `CREATE TABLE` (both new), 4 `CREATE INDEX`, 2 `ALTER TABLE ... ADD CONSTRAINT` (both against the **new** tables' FK, referencing `User(id)` — no `ALTER TABLE "User"` anywhere, confirmed by `git diff origin/dev -- prisma/schema.prisma`: the `User` model only gained a Prisma-side relation array field, which generates zero SQL). Added a regression guard test asserting the migration file contains no `DROP TABLE`/`DROP COLUMN` and every `ALTER TABLE` line targets only `"ChatConversation"`/`"ChatMessage"`. **Verdict: PASS — clean additive migration.**

## Prove-It (red-before-green) — new adversarial tests, reverted and confirmed red, then restored

Two representative guards were reverted directly against production files, confirmed red, then restored bit-for-bit (verified via `git diff --stat` empty after each restore):

1. **Transaction-shape guard** — temporarily changed `createConversation`'s eviction delete from `tx.chatConversation.delete(...)` to `prisma.chatConversation.delete(...)` (simulating a statement escaping the transaction). Ran the suite → **red**: `expected "vi.fn()" to be called with arguments: [...] Number of calls: 0` (the `mockTx.chatConversation.delete` assertion failed because the call went to the wrong client). Restored → 28/28 (then 30/30 after two more coverage tests were added) green.
2. **Cascade schema guard** — temporarily stripped `onDelete: Cascade` from `ChatMessage`'s `conversation` relation in `prisma/schema.prisma`. Ran the suite → **red**: the new schema-inspection test failed (`expect(chatMessageModel).toContain('onDelete: Cascade')`). Restored → green.

Both reverts confirmed the guards have real teeth (not source-grep theatre) before being accepted into the permanent suite.

## Coverage

Real measured run, scoped to `lib/ai/conversation-store.ts` (`npx vitest run __tests__/cam-414-conversation-store.test.ts --coverage --coverage.include='lib/ai/conversation-store.ts'`):

```
File                    | % Stmts | % Branch | % Funcs | % Lines
lib/ai/conversation-store.ts | 100     | 100      | 100     | 100
Statements 51/51 · Branches 27/27 · Functions 9/9 · Lines 50/50
```

100% on every axis, well above the ≥80% new-code floor. The 2 branches the original suite left uncovered (defensive `if (oldest)` false-path when a concurrent delete already removed the row between `count` and `findFirst`; the `typeof error` fallback when a non-`Error` value is thrown) are now closed by the new "branch coverage — defensive edges" tests.

## Run results

```
Test Files  1 passed (1)
     Tests  30 passed (30)
```

Full repo suite (`npx vitest run`, isolated worktree `node_modules` via `npm ci`-equivalent install after discovering the worktree's `node_modules` was a symlink to the main tree — see Environment note below): **191 passed | 1 failed** test files, **6982 passed | 1 failed** tests — the 1 failure is the documented pre-existing `__tests__/delivery-client.test.ts` env-dependent case (per dispatch: ignore, do not chase).

`npm run lint`: 0 errors (251 pre-existing warnings, none in the touched files — confirmed via targeted grep). `npx tsc --noEmit`: 0 errors in `lib/ai/conversation-store.ts` / the test file (after the environment fix below restored a correctly-generated Prisma client for this branch's schema).

## Environment note (self-contained incident + fix, not a code defect)

Mid-verification, `npx prisma generate` (run to unblock `tsc` against this branch's new `ChatConversation`/`ChatMessage` models) was discovered to have regenerated the **shared** `@prisma/client` at `/Users/.../CAMPVIBE/node_modules` — this worktree's `node_modules` was a plain symlink to the main tree (the owner's live `dev` dev-server tree), not an isolated copy. Immediately regenerated the client in the main tree from **its own** `dev`-branch `schema.prisma` to restore it (verified 0 `ChatConversation` references in `node_modules/.prisma/client/index.d.ts` afterward, matching `dev`'s actual schema; `git status` on the main tree confirmed no unintended changes). Then removed the symlink in this worktree and ran a fresh `npm install` here to get a fully independent `node_modules`/generated client, so no further command in this session can touch the main tree. No production code in the main tree was altered; the incident window was closed before any test/build ran against the mismatched state.

## Defects found

None. All 7 requested verdicts pass; the store service's implementation matches every AC/BR/EC in `story.md`.

## Links

`story.md` (AC/BR/EC) · `.claude/rules/qa.md` · `.claude/rules/security.md` §OWASP-1 (ownership scoping, verified BR-2) · `.claude/rules/observability.md` (log field hygiene, verified BR-4/EC-6) · `.claude/rules/ops.md` (reversible-migration standard, verified (g))

## Changelog
- v1 (2026-07-19) — independent adversarial QA verify; 8 new tests added (30 total) closing the 7 dispatch-requested gaps; 100% coverage on new code; 0 defects found; 2 guards Prove-It'd red-then-green; merge remains held pending the owner's architecture discussion (per dispatch).
