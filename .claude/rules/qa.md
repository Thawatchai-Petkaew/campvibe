---
name: testing-and-quality
description: Standard for proving every AC is true with tests, not chasing coverage theatre. Use when writing or reviewing unit/integration/e2e tests for a story. Use when fixing a bug (write the failing repro first). Use when deciding whether a story is Done. Memory for the QA role; pairs with .claude/rules/code.md, .claude/rules/api.md, .claude/rules/security.md, .claude/rules/ops.md, DESIGN.md.
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "__tests__/**"
  - "e2e/**"
---

# Testing & Quality

## Overview

A test is **evidence that an AC is true**, not a coverage ritual. Every test asserts a behavior the ticket promised to the user or the system — "the suite passes" is necessary but never sufficient, because **Done = the AC verified on localhost (dev DB) before merge — and G4 re-verifies on the real Staging URL**. Lean means no test that doesn't guard a real regression.

## Quick Reference

Run + gate:

- `npm test -- --coverage` — run the suite with coverage; gate is **≥ 80% on new code** (measured on the diff, not the repo).

Per-unit coverage matrix — every unit/AC fires this row set:

| Case | What it proves |
|---|---|
| normal | happy path returns/renders the expected result |
| null/empty | missing/empty input handled, no crash |
| boundary | min/max/0/negative edges |
| error/validation | bad input rejected with the right error |
| concurrent/ordering | parallel/out-of-order calls stay correct |

Per-endpoint error codes (fire all per the contract): `400` bad payload · `401` no token · `403` wrong role/owner · `404` not found · `409` duplicate/state conflict · `500` server error.

Bug fix = **Prove-It**: failing repro test first → fix → green + run suite to guard regression.

## When to Use

- Writing tests for any story — every row of the ticket's AC table needs coverage
- Fixing a bug — reproduce it with a failing test first (Prove-It)
- Reviewing a PR for test quality, coverage, and flakiness before merge into `dev`
- Deciding whether a story is Done (test-green is one gate; Staging verification is the other)

**NOT for:**

- Production behavior visibility (logging/metrics/tracing) — use `.claude/rules/observability.md`
- API contract / route design itself — use `.claude/rules/api.md`
- Authz/PDPA threat modeling — use `.claude/rules/security.md` (you still test server-side authz here)
- The UI design gate — use `DESIGN.md`
- Promote/release decisions and Staging deploy mechanics — use `.claude/rules/ops.md`

## Prerequisites

Read first: `.claude/rules/qa.md` (this file) · the ticket you will test (its AC table is the source of truth for cases) · `.claude/rules/api.md` for any endpoint contract you assert against · `DESIGN.md` for accessible-selector and a11y expectations on UI work. Have the test runner in place (Vitest + Playwright); if absent, setting it up is the first task (see Stack & runner).

## Standards

**Read before writing:** `.claude/rules/qa.md` (this file) + the ticket you will test (the AC table = source of truth for cases).

### 1. Stack & runner

- Vitest (unit/integration) + Playwright (e2e). If the project has no runner yet: the first task is to set up Vitest + Playwright and add the `test` script (plus `test:coverage`) before writing the first case.

### 2. Cover every AC

- Every row in the ticket's AC table = at least 1 test (happy + boundary + error/validation per the Rules below).
- Thai copy quoted verbatim in an AC must be asserted **character-for-character** (keep the Thai string exactly as written, e.g. asserting the literal copy from `locales/`).
- The `Neg/edge` column on each AC row + the ticket's `## Edge cases` section (EC-n) are QA's negative-case inventory — every EC-n gets a test.

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

- **Test pyramid** — base is unit (logic/zod/validation), middle is integration (API + Prisma), top is e2e for critical user flows only (never an inverted pyramid). Default type mix across a story's AC→test matrix ≈ 70/20/10 unit/integration/e2e (Google ratio) — a matrix skewed toward e2e is a smell.
- **Risk-based depth** — `test.md`'s AC→test matrix carries a `risk` column (H/M/L = impact × likelihood, ISTQB); order rows by risk and go deepest (more case types, tighter edge coverage) on the H rows first — do not spend equal depth on a cosmetic AC and a payment/authz AC.
- **AAA + name = spec** — structure as Arrange-Act-Assert; name the test so it reads as behavior (`[unit] [expected] [condition]`).
- **Coverage matrix per unit** — cover: normal · null/empty · boundary (min/max/0/negative) · error/validation · concurrent/ordering.
- **Prove-It (when fixing a bug)** — write a test that reproduces the bug and **fails first** → fix → confirm it passes + run the suite to guard regression (every bug leaves behind a regression test).
- **API error-code completeness** — per endpoint, fire the full set per the contract: 400 (bad payload) · 401 (no token) · 403 (wrong role/owner) · 404 (not found) · 409 (duplicate / state conflict).
- **Selector** — in component tests, prefer accessible role/label (`getByRole`); use `data-testid` (the existing convention) only when role/label is ambiguous or you must assert a specific element.

## Examples

✅ **AAA test that asserts real behavior** — name reads as the spec, mocks only the boundary, asserts the result:

```ts
// [unit] toggles wishlist on and persists when the user clicks
it("adds the camp to the wishlist on toggle", async () => {
  // Arrange
  render(<WishlistButton campId="c1" />);
  // Act
  await userEvent.click(screen.getByRole("button", { name: "บันทึก" }));
  // Assert — real outcome, role-based selector, Thai copy verbatim
  expect(screen.getByRole("button", { name: "บันทึกแล้ว" })).toBeInTheDocument();
});
```

❌ **Over-mocked / flaky** — proves nothing and races the clock:

```ts
it("works", async () => {
  const toggle = vi.fn().mockReturnValue(true); // mocked the very logic under test
  render(<WishlistButton onToggle={toggle} />);
  await new Promise((r) => setTimeout(r, 200)); // sleep = flake; wait on a condition instead
  expect(true).toBe(true); // no real assertion
});
```

✅ **Prove-It regression** (bug fix) — failing repro first, then fix, then the test guards forever:

```ts
// Bug: 0 nights priced as a full night. This FAILS before the fix, passes after.
it("[unit] returns 0 for a zero-night booking", () => {
  expect(priceBooking({ nights: 0, rate: 500 })).toBe(0); // was 500
});
```

## Reference Files

- `.claude/rules/code.md` — code standards for the implementation under test
- `.claude/rules/api.md` — API/route contract you assert endpoint behavior against
- `.claude/rules/security.md` — server-side authz/PDPA expectations (you still test authz here)
- `DESIGN.md` — accessible-selector and a11y expectations for component tests
- the `quality-gate` skill — runs lint/typecheck/test+coverage/build/audit before merge

## Next Steps

Tests green → run the `quality-gate` skill (lint · typecheck · test+coverage ≥ 80% · build · `npm audit --omit=dev`) → **verify the AC on localhost (dev DB)** → merge into `dev` → mark the story state `Done`; the batched promote adds `on-staging` and G4 re-verifies on the real Staging URL.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Tests green + curl 200 = the AC is verified." | Lighthouse CWV (LCP/TBT), CSP console violations, interactive states (skeleton-on-click), and theme visuals are browser-only — not verifiable headless. Mark them owner-verify ACs; verify the curl-able layer (HTTP status, headers, SSR HTML, asset 200, redirect) and never claim a browser-only AC Done from curl alone (CAM-197/CAM-199/CAM-203). |
| "Merged + the key signal looks ok = Done." | Done = walk EVERY AC row and record verified / owner-verify / N-A; a visual or browser-only AC row needs a structured owner sign-off, not a vague "looks ok" or a bare "close" (CAM-197 was closed on a bare `ปิด` with no row-by-row check). |
| "It renders without throwing, that's a test." | A test that doesn't assert proves nothing. Assert the result (DOM / return / DB row / copy). |
| "Mock everything so the test passes." | Over-mocking makes the test pass while the real thing breaks. Mock only the outer boundary (network/clock); keep the real logic. |
| "A short `sleep` (or a fixed drain window) fixes the flakiness." | Timing/order/`sleep` make it flaky — and draining a stream/async output for a FIXED window then asserting flakes under CI load when the event lands late. Wait on a real condition (`findBy*`/`waitFor`, or read until the awaited substring appears and early-exit), lean on a real terminal condition (e.g. the stream self-close) to keep teeth, and keep tests order-independent (CAM-212/223). |
| "More tests = better coverage." | Worthless tests just pump the number. Write tests that fail when behavior breaks. |
| "Tests are green locally, ship it." | Not Done until the AC is verified on localhost against the dev DB BEFORE the merge into `dev` (browser-only ACs: owner check on dev after merge) — see `.claude/rules/ops.md` §3. |
| "My class/token change is correct, so the red guard test is wrong." | A design-system refactor changes canonical classes, so source-inspection tests that pinned the OLD class go red — updating them to the new canonical class is correct, NOT weakening. Prefer asserting at the shared primitive/guard over duplicating exact-class greps across many consumer test files (CAM-224/226/229). |
| "Visual-regression screenshots will just work in CI." | Playwright `toHaveScreenshot` baselines are OS-specific (macOS `-darwin` vs CI `-linux`) → the first CI run shows baseline-missing/pixel-diff red. Commit Linux baselines (or generate them in CI) AND make the visual/a11y job advisory (`continue-on-error` + a non-required check) so cross-OS pixel diffs never block the merge gate; route diffs to review (CAM-230). |
| "That test is just flaky — rerun/quarantine it." | Both "flakes" this period were real defects: a last-write-wins product race (CAM-359 ac6) and a structural stream-drain race (CAM-346). A flaky test is a DEFECT REPORT until root-caused — investigate the mechanism first; retry/quarantine only after the cause is named (CAM-359/CAM-346). |
| "Both static states pass = the gate is covered." | A state-dependent gate fails at the TRANSITION — CAM-396 passed guest→modal and logged-in→POST but broke on login-then-first-retry (a stale server-rendered prop). Test the transition path; a browser-only transition is named an explicit owner-verify AC row at spec time (CAM-396). |
| "The validator change only ADDS accepted shapes, tests for those suffice." | Widening an input surface shipped with accept-tests only — the scheme-rejection invariant (javascript:/data:/file:) had ZERO direct tests until a G3 nit. Widening = add explicit REJECT tests for the security-relevant negative space in the SAME change (CAM-358). |
| "The ticket names the violating spots — fix and verify those." | A measurable gate (axe 0 critical/serious, CWV pass) is scoped by the GATE, not the ticket's example list: scanning the real BUILT app found 4 more same-pattern contrast violations the list missed. Run the actual scan against the build; examples are illustrative (CAM-261). |
| "The guard test asserts the fix's source is present — that's the regression net." | Source-inspection-only guards passed while the real bug persisted (v0.10.1). A guard must FAIL on the real defect: prove teeth once (remove the fix → red, restore → green) and prefer a behavioral/measurable assertion over a source grep where the env allows (CAM-201; Prove-It practice as used in CAM-359/CAM-368). |
| "A prompt/model change passes the diff read (example removed / param set), so it's verified." | A static/diff read can't see a behavioral regression: de-anchoring the province param passed the diff but made the model DROP a user-named province — southern camps mislabeled as Chiang Mai, caught by the owner not tests. Verify an LLM/prompt change BEHAVIORALLY — a `strictParams` golden case + a real-endpoint reproduction — before calling it done (CAM-500). |
| "Unit tests pass AND the real-model guardrail gate is green, so the new tool parameter works." | Both can be green over a surface neither touches. CAM-587 added `district` to `searchCampsites`: 15 unit tests passed because every one SUPPLIED the argument, and the real-model gate passed because none of its cases named a district — so nothing ever exercised the model's decision to SET it. The owner asked for แม่ริม and got "ไม่พบ" while the DB held 6 camps. **A real-model gate is green only over the cases it contains.** Adding a tool parameter adds a `strictParams` golden case asserting the MODEL emits it (and fails if it substitutes `keyword` or a guessed province) — a test that hands the argument in proves the resolver, never the caller (CAM-587/CAM-596). |
| "The eval says these cases fail, so the model is wrong." | A harness mock returning empty data makes a multi-step expected outcome UNREACHABLE — the dispatch mock returned `{}` for every tool, so a single-turn "is ‹named camp› available?" could never chain search→checkAvailability inside the harness (needs a uuid), scoring 3 harness artifacts as model fails. An unreachable expected tool is a harness defect (fix fidelity), not a model miss; verify reachability before trusting the correctness % (eval-harness; pairs with CAM-460 `seededShownResults`). |
| "The `test.fail()` guard documents the known defect — leave it until someone fixes it." | It INVERTS the moment the defect is fixed: Playwright reports "expected to fail, but passed" as a failure, so the fixer's own green PR goes red inside a test file they never touched. CAM-664's guard rang the instant CAM-671's fix merged, costing a CI round mid-epic. A `test.fail()` guard names, in a comment on the test, the ticket that will invert it — and that ticket carries "flip CAM-nnn's guard to a normal assertion" inside its own scope. Keep the provenance comment when you flip it; the guard did its job twice (CAM-664/CAM-671). |
| "Added a new taxonomy code — the code change is done." | Adding a code can invalidate a golden/GUARDRAIL case that pins the OLD best-match for the words that code now serves: SEA made the "ริมทะเล"→expected-BEAC guardrail stale (the model correctly picks SEA), surfacing only at a LATER slice's eval and flipping guardrail below 100%. Sweep the golden/guardrail cases for the matched VALUE when a code is added (the two-guards trap, for the value not just the count) (CAM-513→519). |

## Verify (exit criteria)

- [ ] Every AC row has a test (happy + boundary + error) and the Thai copy is asserted verbatim
- [ ] The real suite runs 100% green — no flaky/skipped tests left hanging
- [ ] Coverage ≥ 80% on new code (measured on the diff)
- [ ] Tests pass CI (`.github/workflows/ci.yml`) server-side on a PR with base `dev`/`staging`/`main`
- [ ] Each defect found → opened as a sub-ticket with repro + the failing AC
- [ ] **AC verified on localhost (dev DB) BEFORE the merge** → story state `Done` at merge into `dev`; G4 re-verifies on the real Staging URL after the batched promote (≠ Released; Released = promote `staging`→`main`, see `.claude/rules/ops.md`)
