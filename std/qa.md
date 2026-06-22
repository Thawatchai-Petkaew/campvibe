---
name: testing-and-quality
description: Standard for proving every AC is true with tests, not chasing coverage theatre. Use when writing or reviewing unit/integration/e2e tests for a story. Use when fixing a bug (write the failing repro first). Use when deciding whether a story is Done. Memory for the QA role; pairs with std/code.md, std/api.md, std/security.md, std/ops.md, DESIGN.md.
---

# Testing & Quality

## Overview

A test is **evidence that an AC is true**, not a coverage ritual. Every test asserts a behavior the ticket promised to the user or the system — "the suite passes" is necessary but never sufficient, because **Done = verify the AC on the real Staging URL**. Lean means no test that doesn't guard a real regression.

## When to Use

- Writing tests for any story — every row of the ticket's AC table needs coverage
- Fixing a bug — reproduce it with a failing test first (Prove-It)
- Reviewing a PR for test quality, coverage, and flakiness before merge into `staging`
- Deciding whether a story is Done (test-green is one gate; Staging verification is the other)

**NOT for:**

- Production behavior visibility (logging/metrics/tracing) — use `std/observability.md`
- API contract / route design itself — use `std/api.md`
- Authz/PDPA threat modeling — use `std/security.md` (you still test server-side authz here)
- The UI design gate — use `DESIGN.md`
- Promote/release decisions and Staging deploy mechanics — use `std/ops.md`

## Standards

**Read before writing:** `std/qa.md` (this file) + the ticket you will test (the AC table = source of truth for cases).

### 1. Stack & runner

- Vitest (unit/integration) + Playwright (e2e). If the project has no runner yet: the first task is to set up Vitest + Playwright and add the `test` script (plus `test:coverage`) before writing the first case.

### 2. Cover every AC

- Every row in the ticket's AC table = at least 1 test (happy + boundary + error/validation per the Rules below).
- Thai copy quoted verbatim in an AC must be asserted **character-for-character** (keep the Thai string exactly as written, e.g. asserting the literal copy from `locales/`).

### 3. Coverage ≥ 80% on new code

- Measure the **diff**, not the whole repo. Pick the level that fits the work:
  - unit = logic / validation / zod
  - integration = API route + DB (Prisma)
  - e2e = user flow per AC, from the "what the user sees" side

### 4. Test ID convention

- Format: `<type>--<module>-<detail>`, e.g. `btn--wishlist-toggle`, `input--login-phone`, `page--wishlist`.
- Allowed `type` values: `page modal section form btn input select checkbox radio table row cell toast alert`.

### 5. Defect handling

- A defect is reported as a **sub-ticket back into the loop** with repro steps + the failing AC (cite #) + expected/actual.
- Do not fix the code yourself — hand it back to the owning role.

### 6. Server-authoritative testing

- Validation/authz must have a **server-side** test (client validation = UX, does not count).
- Never mock the layer you are about to assert.

### 7. Test design

- **Test pyramid** — base is unit (logic/zod/validation), middle is integration (API + Prisma), top is e2e for critical user flows only (never an inverted pyramid).
- **AAA + name = spec** — structure as Arrange-Act-Assert; name the test so it reads as behavior (`[unit] [expected] [condition]`).
- **Coverage matrix per unit** — cover: normal · null/empty · boundary (min/max/0/negative) · error/validation · concurrent/ordering.
- **Prove-It (when fixing a bug)** — write a test that reproduces the bug and **fails first** → fix → confirm it passes + run the suite to guard regression (every bug leaves behind a regression test).
- **API error-code completeness** — per endpoint, fire the full set per the contract: 400 (bad payload) · 401 (no token) · 403 (wrong role/owner) · 404 (not found) · 409 (duplicate / state conflict).
- **Selector** — in component tests, prefer accessible role/label (`getByRole`); use `data-testid` (the existing convention) only when role/label is ambiguous or you must assert a specific element.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It renders without throwing, that's a test." | A test that doesn't assert proves nothing. Assert the result (DOM / return / DB row / copy). |
| "Mock everything so the test passes." | Over-mocking makes the test pass while the real thing breaks. Mock only the outer boundary (network/clock); keep the real logic. |
| "A short `sleep` fixes the flakiness." | Timing/order/`sleep` make it flaky. Wait on a real condition (`findBy*`/`waitFor`); keep tests independent of order. |
| "More tests = better coverage." | Worthless tests just pump the number. Write tests that fail when behavior breaks. |
| "Tests are green locally, ship it." | Not Done until the AC is verified on the real Staging URL (see `std/ops.md`). |

## Verify (exit criteria)

- [ ] Every AC row has a test (happy + boundary + error) and the Thai copy is asserted verbatim
- [ ] The real suite runs 100% green — no flaky/skipped tests left hanging
- [ ] Coverage ≥ 80% on new code (measured on the diff)
- [ ] Tests pass CI (`.github/workflows/ci.yml`) server-side on a PR with base `staging`
- [ ] Each defect found → opened as a sub-ticket with repro + the failing AC
- [ ] **AC verified on the real Staging URL after merge** → story ready for Linear state `Done` (≠ Released; Released = promote `staging`→`main`, see `std/ops.md`)
