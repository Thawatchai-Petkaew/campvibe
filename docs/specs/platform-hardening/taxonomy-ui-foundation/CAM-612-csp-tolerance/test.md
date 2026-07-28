---
linear: CAM-612
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Platform
artifact: test
owner: qa-engineer
status: done
version: v1
updated: 2026-07-28
---
# Test — tighten the stale CSP-tolerance cap (CAM-612)

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 | H | e2e | `e2e/regression/cam-607-csp-nonce-agreement.spec.ts` | ✅ |
| AC-2 | H | e2e (Prove-It, manual red/green) | `e2e/regression/cam-607-csp-nonce-agreement.spec.ts` (temporary fault injection in `components/Providers.tsx`, reverted, never committed) | ✅ |
| AC-3 | M | owner-verify (decision record, this file) | — | ✅ |

Risk is H on AC-1/AC-2 because this exact cap is the ticket's whole subject
(a stale tolerant cap is a silent hole per CAM-201/CAM-568) — both get the
deepest treatment available: a real run against a real production build,
not a diff read.

## Validation cases (BR-1..3)
- **BR-1 (happy — cap is exactly `0`, real measured count)**: ran
  `e2e/regression/cam-607-csp-nonce-agreement.spec.ts` against a real `next
  build && next start` (port 4612, real local `campvibe` Postgres via the
  real `.env`, real `hoster@campvibe.com` login through the actual `/login`
  form) with the code UNCHANGED from CAM-610's shipped state. Result: **3/3
  passed** — the CSP-header/served-nonce agreement test AND the
  route-protection redirect test. The violation-count assertion read `0`,
  matching CAM-610's own measured `40/40 scripts nonce-matched, zero
  violations` finding, before any edit was made in this story.
- **BR-1 (after tightening the cap to `0` in source)**: re-ran the same spec
  against the same running production server (no rebuild needed — only the
  spec's assertion changed, not app code). Result: **3/3 passed** — the
  tightened assertion passes for the real reason (the real count is `0`),
  not because the test stopped running or the assertion was weakened.
- **BR-2 (teeth / Prove-It — the cap actually fails on a real regression)**:
  temporarily added one un-nonced `<script dangerouslySetInnerHTML=.../>` to
  `components/Providers.tsx` (a scratch, never-committed edit), rebuilt,
  restarted the production server on the same port, and confirmed via `curl`
  that the served HTML now carried a bare `<script>` with no `nonce=`
  attribute. Re-ran the same spec: **the CSP-agreement test FAILED**, with
  the real browser-emitted message captured in the assertion failure:
  `Executing inline script violates the following Content Security Policy
  directive 'script-src ''nonce-...'' ...'. ... The action has been
  blocked.` — `expect(received).toBe(expected)`, `Expected: 0`,
  `Received: 1`. This is a genuine browser CSP enforcement, not a
  source-inspection grep — exactly the CAM-201 "prove teeth" standard.
  Reverted the edit (`git diff --stat -- components/Providers.tsx` → empty,
  `git status --porcelain` confirmed clean), rebuilt, restarted, re-ran:
  **3/3 passed again**.
- **BR-3 (overlap decision recorded)**: see "Overlap decision" below.

## Dev vs production-build run (EC-2 — stated explicitly, not assumed)
Primary evidence above is against a **real production build** (`next build
&& next start`), matching the precedent both CAM-607 and CAM-610 set for
this exact CSP/nonce family, because `.claude/rules/security.md` records
that dev and production behave differently under a nonce CSP (CAM-218's
static-prerender trap only bites a build). As a secondary check, the same
two specs (tightened CAM-607 + CAM-610) were also run against the standard
local harness default (`PW_REGRESSION=1 npm run test:e2e:regression`
equivalent — `next dev` on port 3100, Playwright's own webServer, torn down
automatically on completion): **4/4 passed** (including the
`regression-setup` login).

**What the dev-mode run does and does not prove**: `proxy.ts`'s nonce
generation, the request-header CSP propagation (CAM-607's fix), and the
`ThemeProvider nonce` threading (CAM-610's fix) are all identical code paths
in dev and production — `next dev` genuinely exercises the same mechanism,
so a regression in that propagation would fail here too. It does **not**
prove the CAM-218 failure class (a route statically prerendered at BUILD
time, baking HTML with no per-request nonce) — `next dev` never performs
that static-generation step, so a future regression that made a route
static again could pass in dev while failing on a real build. This is why
the production-build run above is the primary evidence, and the dev-mode
run is stated as a secondary, narrower-scope check — never substituted for
it.

## Overlap decision (AC-3 — answered, not left implicit)
**Kept as two separate specs.** `e2e/regression/cam-607-csp-nonce-agreement.spec.ts`
(this story) and `e2e/regression/cam-610-theme-script-nonce.spec.ts`
(CAM-610's own spec) both now assert a CSP-violation count at exactly `0`,
which looks like the same invariant duplicated — but they differ on two
axes that matter:
1. **Route / render tree.** CAM-607's spec exercises the AUTHENTICATED
   `/dashboard` path (a different Server Component tree, reached only after
   a real login) — plus a SECOND, unrelated `describe` block re-verifying
   route PROTECTION (the unauthenticated redirect), which has no reason to
   live in a public-page spec. CAM-610's spec exercises the PUBLIC `/` route
   specifically because its fix (the nonce threaded into `Providers`/
   `ThemeProvider`) lives in the root layout and applies to every route —
   asserting it on a route that needs no auth is the more direct proof it is
   not a `/dashboard`-only fix.
2. **Strictness of the per-script check.** CAM-607's spec asserts that AT
   LEAST ONE served script nonce agrees with the response header (the
   original CAM-218 "header vs served HTML" agreement check this story
   family exists to prove). CAM-610's spec asserts that EVERY served script
   nonce agrees — a strictly stronger, per-script invariant.

Given different routes exercise different code paths (authenticated
dashboard vs public home) and CAM-610's check is strictly stronger on its
own route, merging one into the other would either weaken CAM-610's
per-script assertion (if folded into CAM-607's "at least one" shape) or
drop CAM-607's route-protection re-verification (if folded into CAM-610's
public-only spec). Two specs, two distinct routes, two distinct strictness
levels — not the same invariant asserted twice for no reason. Decision:
**do not merge**; this reasoning is captured in both this file and the
CAM-607 spec's own updated file-level comment so the next person does not
merge them by mistake.

## Coverage
Not measured via `vitest --coverage` — this story's diff is entirely inside
`e2e/regression/cam-607-csp-nonce-agreement.spec.ts` (a Playwright e2e spec;
Playwright runs are not instrumented by the Vitest coverage tool used for
the ≥80%-new-code gate). The diff itself is a single assertion (`.toBe(0)`
+ a rewritten comment) that was exercised in BOTH directions in this run
(red under the teeth proof, green on the real app) — 100% of the changed
logic was executed both ways.

## Full suite (last act)
`npx vitest run` — **407 test files, 10980 tests, all passed**, run as the
final act after the spec edit (per `.claude/rules/code.md`'s "full suite as
the LAST act" rule) — no regression debris from this diff.

## Links
`story.md` (AC-1..3, BR-1..3, EC-1..2) · `.claude/rules/qa.md` (Prove-It,
CAM-201) ·
`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-607-csp-streaming-script/tech.md` ·
`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-610-theme-script-nonce/tech.md` ·
`e2e/regression/cam-607-csp-nonce-agreement.spec.ts` ·
`e2e/regression/cam-610-theme-script-nonce.spec.ts`

## Changelog
- v1 (2026-07-28) — created; cap tightened `<= 1` → `0`, proven red then
  green against a real production build, cross-checked against `next dev`,
  overlap with CAM-610's spec evaluated and recorded as "keep separate."
