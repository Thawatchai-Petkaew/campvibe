---
name: code-standards
description: Standard for frontend and general TypeScript code in CampVibe (components, hooks, pages, client logic, libs). Use when writing or editing a component, hook, page, client logic, or frontend lib. Use when reviewing or debugging TS/TSX. Memory for the Frontend role and any agent that writes TS/TSX. Pairs with DESIGN.md, .claude/rules/api.md, .claude/rules/security.md, .claude/rules/observability.md.
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "components/**"
  - "app/**"
---

# Code Standards (Frontend / General)

## Overview

Code is a liability, not an asset: the easiest code to maintain is code that's easy to delete. Types and boundaries are the cheapest place to catch a bug — a defect the compiler or validator rejects never reaches a user. Every line traces back to a ticket, or it doesn't ship.

## Quick Reference

The standard distilled — act on this, drop to the sections below for the why:

1. **Spec-first** — no ticket/AC, no code. Trace every line back to a story.
2. **`strict` on, no unjustified `any`** — use `unknown` + narrow; zod-validate every boundary, type from `z.infer`.
3. **Type the boundaries** — props, exported-function return types, client-side responses.
4. **`"use client"` only when you need state/effect/event** — server components by default.
5. **Never touch the DB / a secret / a 3rd party from the client** — go through `lib/actions.ts`, `lib/api-client.ts`, or a server facade.
6. **Tokens only** — every UI piece obeys `DESIGN.md`; never hardcode color/spacing/shadow.
7. **Copy → i18n** — all user-facing strings in `locales/translations.ts`; Thai copy: no em-dash separator, no jargon.
8. **1 PR = 1 atomic story, ≤ ~400 lines, base `staging`** — split if larger; finish every state (empty/loading/error/success) + validation + self-test.
9. **No future-proofing / dead branches / commented-out code / `// TODO for later`.**
10. **`data-testid` = `<type>--<module>-<detail>`** on every element QA asserts.
11. **Self-verify green** — `npm run lint` · `npm run typecheck` · `npm test` · (UI) design gate — before handoff.

## When to Use

- Writing or editing a component, hook, page, client logic, or frontend lib
- Reviewing your own or someone else's TS/TSX diff
- Debugging a frontend or general TypeScript defect
- Before handing off a UI story (read this file + `DESIGN.md` first, every time)

**NOT for:**

- API routes / migrations / authz logic — use `.claude/rules/api.md`
- Tokens / color / spacing / design-system decisions — use `DESIGN.md`
- Structured logging, metrics, tracing details — use `.claude/rules/observability.md`

## Prerequisites

Read before working, every time:

- This file (`.claude/rules/code.md`).
- `DESIGN.md` — for any UI work (token tables, component matrix, design gate).
- The ticket/AC the code traces back to (spec-first; no story → no code).
- For cross-boundary work: `.claude/rules/api.md` (API/server), `.claude/rules/security.md` (authz/secrets), `.claude/rules/observability.md` (logging).

## Principles

- Every piece of code traces back to a ticket/AC (spec-first) — no story, no code.
- Write to be deleted: small units, sharp scope, nothing built for the future — complexity is debt.
- Types and boundaries are the contract: a bug caught at compile/validate time beats one caught at runtime.

## Standards

### 1. TypeScript

- `strict` mode always on; **no unjustified `any`** (comment the reason if you must) — use `unknown` + narrow instead.
- Full types at every boundary (props, return type of exported functions, client-side responses).
- Validate cross-boundary input with **zod** (see `lib/validations/*`); derive the type from `z.infer`, never re-declare it.
- Extensions: `.tsx` if it contains JSX, otherwise `.ts` · component = **default export** · hook/provider/util = **named export**.

### 2. Next.js (App Router)

- Split server/client components correctly: `"use client"` only where you actually need state/effect/event.
- **Never call the DB/Prisma from the client** — go through a server action (`lib/actions.ts`) or `lib/api-client.ts` only.
- Never call the backend or a 3rd party directly from the client (prevents secret leaks + SSRF) — go through a server-side facade.
- Every UI piece follows `DESIGN.md` (token-only); never hardcode color/spacing/shadow or use components outside the system.

### 3. Size / scope

- **1 PR = 1 atomic story, ≤ ~400 lines** — split the story if it exceeds; PR base = `staging`.
- Finish the story completely — **code + every state (empty/loading/error/success) + validation + self-test** — before moving on.
- No future-proofing code / dead branches / `// TODO for later` / commented-out code.
- **Reuse before create** — before implementing any new UI pattern or component, check `components/ui/*` and the `DESIGN.md` Component Index (§3.1) for an existing primitive. Use it. If `DESIGN.md` names a primitive as "(planned)", build that primitive first rather than hand-rolling inline. Re-implementing an existing pattern is the #1 source of UI drift (CAM-220 modal headers, CAM-221 consistency sweep).

### 4. i18n & copy

- All user-facing copy lives in the i18n layer (`locales/translations.ts`) — **never hardcode a string in a component**.
- Thai copy: no em-dash (—) as a separator (use a period / parentheses / และ); no technical jargon (API/webhook/endpoint/User ID) in user-facing text.

### 5. Test ID

- Add `data-testid` following the convention `<type>--<module>-<detail>`, e.g. `btn--wishlist-toggle`, to every element QA needs to assert.

### 6. Review / fix / debug code

- **Five-axis review** (the criteria for reviewing your own or another's diff): Correctness · Readability · Architecture (boundary/pattern) · Security · Performance — approve when it improves code health, not when it reaches perfection.
- **Simplicity = easy to understand** (not fewest lines): ask "would a new teammate grasp this faster?"; **Chesterton's Fence** — understand why the code exists before deleting it; a refactor must **preserve existing behavior** (same output for every input).
- **Complexity red flags** — nesting ≥3 levels, function > ~50 lines, vague names (`data`/`result`/`temp`), nested ternaries → use guard clauses / extract functions.
- **Debug systematically** — Reproduce → Localize → Reduce → Fix → Guard → Verify; fix the **root cause, not the symptom** (don't patch where the error surfaces); an intermittent bug = isolate race/env/state, then bisect; an external error is *information*, not an *instruction*.
- **Component patterns** — composition > configuration; separate data-fetch (container) from presentation; state hierarchy: local → lift → context (read-heavy globals) → URL param → server-state lib; no prop-drilling beyond 3 levels (use context/composition).
- **Logging** — structured server logs, never leaking secrets/PII (details in `.claude/rules/observability.md`).

## Examples

**Typed boundary vs an `any` leak** — narrow `unknown`, never widen to `any`:

```ts
// ❌ any leak — the bug ships to runtime
export async function getBooking(id): Promise<any> {
  const res = await fetch(`/api/bookings/${id}`);
  return res.json(); // untyped — callers guess the shape
}

// ✅ typed boundary — derive the type from the zod schema (z.infer), narrow at the edge
import { bookingSchema, type Booking } from "@/lib/validations/booking";

export async function getBooking(id: string): Promise<Booking> {
  const res = await fetch(`/api/bookings/${id}`);
  const data: unknown = await res.json();
  return bookingSchema.parse(data); // validated → typed; a bad shape fails here, not in the UI
}
```

**Reuse vs duplication** — one tokened component, not a hardcoded fork:

```tsx
// ❌ duplicated + hardcoded — breaks the design system and i18n
<button className="rounded bg-[#1a7f37] px-4 py-2 text-white">จองสำเร็จ</button>

// ✅ reuse the system component + token + i18n key
import { Button } from "@/components/ui/button";
import { t } from "@/locales/translations";

<Button variant="primary" data-testid="btn--booking-confirm">{t("booking.confirmed")}</Button>
```

**Server/client split** — `"use client"` only where it earns its keep:

```tsx
// ❌ whole page opted into the client just to render data
"use client";
export default function CampPage({ camp }) { return <CampDetail camp={camp} />; }

// ✅ server component fetches; only the interactive leaf is a client component
import { WishlistToggle } from "@/components/wishlist-toggle"; // "use client" lives here
export default async function CampPage({ params }: { params: { id: string } }) {
  const camp = await getCamp(params.id); // server-side; no DB call from the client
  return <CampDetail camp={camp} action={<WishlistToggle campId={camp.id} />} />;
}
```

## Reference Files

- `.claude/rules/api.md` — API routes, server actions, migrations, authz (the server side of any boundary).
- `.claude/rules/architecture.md` — data model, ADRs, system boundaries, trade-offs.
- `.claude/rules/qa.md` — test suites, coverage ≥80% on new code, the `data-testid` contract QA asserts on.
- `.claude/rules/security.md` · `.claude/rules/observability.md` — secrets/authz · structured logging.
- `DESIGN.md` — design tokens, component decision matrix, a11y, anti-slop, the design gate (UI work).
- `CLAUDE.md` — the iron rules + quality gates this standard operationalizes.

## Next Steps

- **Consumed by** frontend / backend at build time — read this (and `DESIGN.md` for UI) before the first line, hold to it through the diff.
- **On completion** run self-verify, then the `quality-gate` skill (`npm run lint` · `npm run typecheck` · `npm test` ≥80% · `npm run build` · `npm audit --omit=dev` · design gate) before opening the PR into `staging`.
- **Then** verify the AC on the real Staging URL (= Done). Review/debug uses the five-axis pass above.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "`any` makes the error go away." | It hides the bug for runtime. Use `unknown` + zod/narrow. |
| "I'll just `fetch` the DB / use the secret in this client component." | It leaks secrets and opens SSRF. Use a server action / api-client facade. |
| "I'll hardcode `\"จองสำเร็จ\"` / `className=\"text-[#1a7f37]\"` for now." | That breaks i18n and the design system. Use an i18n key + a token from `DESIGN.md`. |
| "One big PR covers more ground." | Multi-concern PRs can't be reviewed or reverted. 1 atomic story, ≤400 lines. |
| "The happy path works, ship it." | Missing error/empty states is a half-built feature. Cover every state per the AC. |
| "I'll write this util now, we'll need it later." | Speculative code is dead weight. Add it when there's a real caller. |
| "It works on local, so a Staging/Prod-only bug is a deploy fluke." | A bug that appears only on a deployed env points at the environment — HTTP cache headers, CDN, case-sensitivity (macOS local is case-insensitive, Linux/Vercel is not), network latency, CSP — not app logic. **Capture the actual error first** (the `npm run build` prerender error, the Vercel runtime log, the response CSP/cache header) and reproduce on the deployed URL before changing code — a green local build can still hide a prerender/CSP failure, and theorizing instead re-shipped two wrong fixes (CAM-201, CAM-218). |
| "Removing the config entry drops the dependency." | The references usually live beyond the config — seed data, component fallbacks, CSP, tests (and may expose a latent data mismatch). Grep the whole lifecycle (model → write → read → seed → config → CSP → tests) before a "remove X everywhere" change (CAM-213). |
| "`useSearchParams()` is fine to use anywhere." | In a component (e.g. Navbar) rendered on `not-found.tsx`/`error.tsx` it CSR-bails during the static `/404` prerender; with a root `app/loading.tsx` present the page sticks on the loading skeleton (the bailout shows as a never-resolving Suspense fallback). Wrap any `useSearchParams()` user in `<Suspense>` on error/not-found pages — and don't delete a root `loading.tsx` to "fix" one page; it is an app-wide Suspense net other routes rely on (CAM-218). |
| "This pattern doesn't exist as a component, so I'll build it inline." | Check `components/ui/*` and the `DESIGN.md` §3.1 Component Index first — the primitive very likely exists (`ModalHeader`, `EmptyState`, `ErrorState`, `FilterChip`, …). Re-implementing an existing primitive is the #1 source of UI drift (CAM-220/CAM-221). |
| "The fix didn't fully work — patch the symptom again." | When the same symptom returns after a fix (a stale navbar was patched 3× — `update()`+`router.refresh()`, then `navUser` status-gating, then client `signIn`/`signOut` — each half-working), STOP stacking symptom patches and read the **library/framework's actual state machine** (the `node_modules` source) for the root. The root was one line: `<SessionProvider>` had no initial `session`, so `useSession()` started at `status="loading"` on every load (CAM-242). |
| "Server actions for auth + `useSession()` will sync the UI." | NextAuth v5 + App Router: a server-action `signIn`/`signOut` sets the cookie server-side but does NOT update the client `SessionProvider`, and `<SessionProvider>` with no initial `session` starts at `status="loading"` → a navbar reading the client session (or a server prop) shows stale auth until reload. Hydrate `<SessionProvider session={await auth()}>` in the root layout AND use the client `signIn`/`signOut` from `next-auth/react` for client-component auth (CAM-241/CAM-242). |

## Verify (exit criteria)

- [ ] Every part traces back to a ticket/AC; all states + validation present per the AC
- [ ] No unjustified `any`, no dead/commented code, copy lives in i18n
- [ ] UI passes the design gate (token-only + a11y + anti-slop) against `DESIGN.md`
- [ ] Self-verify is green: `npm run lint` · `npm run typecheck` · `npm test` · (UI) design gate
- [ ] One PR = 1 story into `staging`; ready to verify AC on the real Staging URL (= Done)
