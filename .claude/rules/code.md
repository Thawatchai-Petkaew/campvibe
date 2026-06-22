---
name: code-standards
description: Standard for frontend and general TypeScript code in CampVibe (components, hooks, pages, client logic, libs). Use when writing or editing a component, hook, page, client logic, or frontend lib. Use when reviewing or debugging TS/TSX. Memory for the Frontend role and any agent that writes TS/TSX. Pairs with DESIGN.md, .claude/rules/api.md, .claude/rules/security.md, .claude/rules/observability.md.
---

# Code Standards (Frontend / General)

## Overview

Code is a liability, not an asset: the easiest code to maintain is code that's easy to delete. Types and boundaries are the cheapest place to catch a bug — a defect the compiler or validator rejects never reaches a user. Every line traces back to a ticket, or it doesn't ship.

## When to Use

- Writing or editing a component, hook, page, client logic, or frontend lib
- Reviewing your own or someone else's TS/TSX diff
- Debugging a frontend or general TypeScript defect
- Before handing off a UI story (read this file + `DESIGN.md` first, every time)

**NOT for:**

- API routes / migrations / authz logic — use `.claude/rules/api.md`
- Tokens / color / spacing / design-system decisions — use `DESIGN.md`
- Structured logging, metrics, tracing details — use `.claude/rules/observability.md`

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

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "`any` makes the error go away." | It hides the bug for runtime. Use `unknown` + zod/narrow. |
| "I'll just `fetch` the DB / use the secret in this client component." | It leaks secrets and opens SSRF. Use a server action / api-client facade. |
| "I'll hardcode `\"จองสำเร็จ\"` / `className=\"text-[#1a7f37]\"` for now." | That breaks i18n and the design system. Use an i18n key + a token from `DESIGN.md`. |
| "One big PR covers more ground." | Multi-concern PRs can't be reviewed or reverted. 1 atomic story, ≤400 lines. |
| "The happy path works, ship it." | Missing error/empty states is a half-built feature. Cover every state per the AC. |
| "I'll write this util now, we'll need it later." | Speculative code is dead weight. Add it when there's a real caller. |

## Verify (exit criteria)

- [ ] Every part traces back to a ticket/AC; all states + validation present per the AC
- [ ] No unjustified `any`, no dead/commented code, copy lives in i18n
- [ ] UI passes the design gate (token-only + a11y + anti-slop) against `DESIGN.md`
- [ ] Self-verify is green: `npm run lint` · `npm run typecheck` · `npm test` · (UI) design gate
- [ ] One PR = 1 story into `staging`; ready to verify AC on the real Staging URL (= Done)
